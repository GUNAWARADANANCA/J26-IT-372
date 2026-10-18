"""Office location check and attendance time-in / time-out."""

import hashlib
import hmac
import os
import re
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException

from db import get_db

AUDIT = "attendance_audit"
DAY_STATUS = "attendance_day"
COLOMBO = ZoneInfo("Asia/Colombo")
RATE_LIMIT = 8
RATE_WINDOW = timedelta(minutes=1)
_scan_attempts: dict[str, list[datetime]] = {}

TIME_FIELDS = (
    "on_time_start",
    "on_time_end",
    "late_start",
    "late_end",
    "half_day_start",
    "half_day_end",
    "checkout_start",
    "checkout_end",
)

DEFAULT_SETTINGS = {
    "_id": "attendance",
    "latitude": 6.933586,
    "longitude": 79.983529,
    "radius_meters": 150,
    "on_time_start": "06:00",
    "on_time_end": "08:40",
    "late_start": "08:40",
    "late_end": "11:00",
    "half_day_start": "12:00",
    "half_day_end": "14:00",
    "checkout_start": "16:00",
    "checkout_end": "18:00",
    "open_days": [0, 1, 2, 3, 4, 5],
    "epf_employee_percent": 8,
    "epf_employer_percent": 12,
    "etf_percent": 3,
    "late_deduction_lkr": 0,
    "ot_rate_lkr": 0,
}


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth = 6_371_000
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * earth * asin(sqrt(a))


def _minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _public_settings(current: dict) -> dict:
    merged = {**DEFAULT_SETTINGS, **current}
    open_days = merged.get("open_days") or DEFAULT_SETTINGS["open_days"]
    return {
        "latitude": float(merged["latitude"]),
        "longitude": float(merged["longitude"]),
        "radius_meters": int(merged["radius_meters"]),
        **{field: str(merged[field]) for field in TIME_FIELDS},
        "open_days": [int(day) for day in open_days],
        "epf_employee_percent": float(merged.get("epf_employee_percent", 8)),
        "epf_employer_percent": float(merged.get("epf_employer_percent", 12)),
        "etf_percent": float(merged.get("etf_percent", 3)),
        "late_deduction_lkr": float(merged.get("late_deduction_lkr", 0)),
        "ot_rate_lkr": float(merged.get("ot_rate_lkr", 0)),
    }


def get_settings() -> dict:
    collection = get_db()["settings"]
    current = collection.find_one({"_id": "attendance"})
    if current is None:
        collection.insert_one(dict(DEFAULT_SETTINGS))
        current = dict(DEFAULT_SETTINGS)
    return _public_settings(current)


def _valid_time(value: str) -> str:
    text = str(value or "").strip()
    if not re.fullmatch(r"\d{2}:\d{2}", text):
        raise HTTPException(status_code=400, detail="Enter times as HH:MM")
    hour, minute = (int(part) for part in text.split(":"))
    if hour > 23 or minute > 59:
        raise HTTPException(status_code=400, detail="Enter a real time")
    return text


def save_settings(updates: dict) -> dict:
    current = get_settings()
    try:
        latitude = float(updates.get("latitude", current["latitude"]))
        longitude = float(updates.get("longitude", current["longitude"]))
        radius_meters = int(updates.get("radius_meters", current["radius_meters"]))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400, detail="Enter a latitude, longitude, and radius"
        ) from exc
    if not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
    if not 20 <= radius_meters <= 1000:
        raise HTTPException(status_code=400, detail="Radius must be between 20 and 1000 meters")

    times = {}
    for field in TIME_FIELDS:
        times[field] = _valid_time(updates.get(field, current[field]))
    for start_field, end_field, label in (
        ("on_time_start", "on_time_end", "On-time check-in"),
        ("late_start", "late_end", "Late check-in"),
        ("half_day_start", "half_day_end", "Half day"),
        ("checkout_start", "checkout_end", "Evening check-out"),
    ):
        if _minutes(times[start_field]) > _minutes(times[end_field]):
            raise HTTPException(
                status_code=400, detail=f"{label} must start before it ends"
            )

    raw_days = updates.get("open_days", current["open_days"])
    if not isinstance(raw_days, list) or not raw_days:
        raise HTTPException(status_code=400, detail="Choose at least one open day")
    try:
        open_days = sorted({int(day) for day in raw_days})
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Choose the open days") from exc
    if any(day < 0 or day > 6 for day in open_days):
        raise HTTPException(status_code=400, detail="Choose the open days")

    rates = {}
    for field in (
        "epf_employee_percent",
        "epf_employer_percent",
        "etf_percent",
        "late_deduction_lkr",
        "ot_rate_lkr",
    ):
        try:
            rates[field] = float(updates.get(field, current[field]))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Enter the payroll rates") from exc
        if rates[field] < 0:
            raise HTTPException(status_code=400, detail="Payroll rates cannot be negative")
    for field in ("epf_employee_percent", "epf_employer_percent", "etf_percent"):
        if rates[field] > 100:
            raise HTTPException(status_code=400, detail="Contribution percents cannot exceed 100")

    stored = {
        "_id": "attendance",
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
        **times,
        "open_days": open_days,
        **rates,
    }
    get_db()["settings"].replace_one({"_id": "attendance"}, stored, upsert=True)
    return _public_settings(stored)


def _in_window(now_minutes: int, start: str, end: str) -> bool:
    return _minutes(start) <= now_minutes <= _minutes(end)


def classify_scan(now: datetime, settings: dict, current: dict | None) -> dict:
    if now.weekday() not in settings["open_days"]:
        raise HTTPException(status_code=403, detail="The post office is closed today.")

    clock = now.hour * 60 + now.minute
    fingerprint_in = (current or {}).get("fingerprint_in")
    morning_check_in = bool(fingerprint_in) and _minutes(str(fingerprint_in)) < _minutes(
        settings["half_day_start"]
    )

    if _in_window(clock, settings["on_time_start"], settings["on_time_end"]):
        kind = "check_in"
        status = "On time"
    elif _in_window(clock, settings["late_start"], settings["late_end"]):
        kind = "check_in"
        status = "Late"
    elif _in_window(clock, settings["half_day_start"], settings["half_day_end"]):
        if morning_check_in:
            kind = "check_out"
            status = "Half day"
        else:
            kind = "check_in"
            status = "Half day"
    elif _in_window(clock, settings["checkout_start"], settings["checkout_end"]):
        kind = "check_out"
        status = (current or {}).get("attendance_status")
    else:
        raise HTTPException(status_code=403, detail="Attendance is not open at this time.")

    if kind == "check_in" and fingerprint_in:
        raise HTTPException(status_code=409, detail="You have already checked in today.")
    if kind == "check_out" and current and current.get("fingerprint_out"):
        raise HTTPException(status_code=409, detail="You have already checked out today.")
    return {"kind": kind, "status": status}


def _door_secret() -> bytes:
    secret = os.environ.get("ATTENDANCE_DOOR_SECRET", "").strip()
    if len(secret) < 16:
        raise HTTPException(status_code=503, detail="The door code is not configured.")
    return secret.encode("utf-8")


def _token_lifetime() -> int:
    try:
        return max(int(os.environ.get("ATTENDANCE_TOKEN_SECONDS", "120")), 1)
    except ValueError:
        return 120


def issue_door_token() -> dict:
    """Short-lived door code. It does not identify an employee or prove presence."""
    issued = int(time.time())
    expires = issued + _token_lifetime()
    payload = f"{issued}.{expires}"
    signature = hmac.new(_door_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return {"token": f"{payload}.{signature}", "issued_at": issued, "expires_at": expires, "expires_in": _token_lifetime()}


def verify_door_token(token: str | None) -> None:
    text = str(token or "").strip()
    if "#" in text:
        text = text.rsplit("#", 1)[-1].strip()
    parts = text.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=403, detail="The door code is not valid.")
    issued_text, expires_text, signature = parts
    expected = hmac.new(_door_secret(), f"{issued_text}.{expires_text}".encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=403, detail="The door code is not valid.")
    try:
        issued = int(issued_text)
        expires = int(expires_text)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="The door code is not valid.") from exc
    now = int(time.time())
    if issued > now + 30 or expires < now or expires - issued > _token_lifetime() + 5:
        raise HTTPException(status_code=403, detail="The door code has expired.")


def _rate_limit() -> int:
    try:
        return max(int(os.environ.get("ATTENDANCE_RATE_LIMIT", str(RATE_LIMIT))), 1)
    except ValueError:
        return RATE_LIMIT


def _limit_scans(client_key: str) -> None:
    """Count attempts for this server-seen caller. A request field cannot change the key.

    Each attempt is recorded by a compare-and-swap on one document. MongoDB applies
    that update to the document atomically, so two workers cannot both admit the
    same slot. Stamps older than 60 seconds are removed in that same update.
    """
    now = time.time()
    cutoff = now - 60
    limit = _rate_limit()
    key = client_key or "unknown"
    collection = get_db()["attendance_rate"]
    for _ in range(8):
        current = collection.find_one({"_id": key})
        stored = list(current.get("stamps", [])) if current else []
        recent = [float(stamp) for stamp in stored if float(stamp) > cutoff]
        if len(recent) >= limit:
            if current is not None and recent != stored:
                cleaned = collection.update_one({"_id": key, "stamps": stored}, {"$set": {"stamps": recent}})
                if not getattr(cleaned, "matched_count", 0):
                    continue
            raise HTTPException(status_code=429, detail="Too many attendance attempts. Wait a minute.")
        proposed = recent + [now]
        if current is None:
            try:
                collection.insert_one({"_id": key, "stamps": proposed})
                return
            except Exception:
                continue
        result = collection.update_one(
            {"_id": key, "stamps": stored},
            {"$set": {"stamps": proposed}},
        )
        if getattr(result, "matched_count", 0):
            return
    raise HTTPException(status_code=429, detail="Too many attendance attempts. Wait a minute.")


def _duplicate_window() -> timedelta:
    try:
        seconds = int(os.environ.get("ATTENDANCE_DUPLICATE_SECONDS", "90"))
    except ValueError:
        seconds = 90
    return timedelta(seconds=max(seconds, 1))


def _claim_scan(employee_id: str) -> str | None:
    """Reserve this employee for the duplicate window. Returns the previous time, or None if new."""
    collection = get_db()["attendance_scan_guard"]
    now = datetime.now().isoformat(timespec="seconds")
    cutoff = (datetime.now() - _duplicate_window()).isoformat(timespec="seconds")
    current = collection.find_one({"_id": employee_id})
    if current is None:
        try:
            collection.insert_one({"_id": employee_id, "accepted_at": now})
            return None
        except Exception:
            raise HTTPException(status_code=409, detail="This attendance was just recorded. Wait before trying again.") from None
    if str(current.get("accepted_at") or "") >= cutoff:
        raise HTTPException(status_code=409, detail="This attendance was just recorded. Wait before trying again.")
    result = collection.update_one(
        {"_id": employee_id, "accepted_at": current.get("accepted_at")},
        {"$set": {"accepted_at": now}},
    )
    if not getattr(result, "matched_count", 0):
        raise HTTPException(status_code=409, detail="This attendance was just recorded. Wait before trying again.")
    return str(current.get("accepted_at") or "")


def _release_scan(employee_id: str, previous: str | None) -> None:
    collection = get_db()["attendance_scan_guard"]
    if previous is None:
        collection.delete_one({"_id": employee_id})
        return
    collection.update_one({"_id": employee_id}, {"$set": {"accepted_at": previous}})


def _audit(result: str, reason: str, employee_id: str, request_id: str) -> None:
    try:
        get_db()[AUDIT].insert_one(
            {
                "at": datetime.now().isoformat(timespec="seconds"),
                "result": result,
                "reason": reason,
                "claimed_employee_id": employee_id,
                "request_id": str(request_id or "")[:80],
            }
        )
    except Exception:
        print("Attendance audit could not be saved.")


def submit_scan(
    employee_id: str,
    latitude: float,
    longitude: float,
    accuracy,
    door_token: str | None,
    client_key: str,
    request_id: str = "",
) -> dict:
    """Accept a door scan. The employee id is the name selected on the phone, not proof of identity."""
    claimed = str(employee_id or "").strip()
    if not claimed or any(character.isspace() for character in claimed):
        raise HTTPException(status_code=400, detail="Choose your name")
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Location is required") from exc
    reserved = False
    previous = None
    try:
        _limit_scans(client_key or "unknown")
        verify_door_token(door_token)
        if get_db()["employee"].find_one({"_id": claimed}) is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        previous = _claim_scan(claimed)
        reserved = True
        saved = record_scan(claimed, latitude, longitude, accuracy)
    except HTTPException as exc:
        if reserved:
            _release_scan(claimed, previous)
        _audit("rejected", str(exc.detail), claimed, request_id)
        raise
    _audit("accepted", saved.get("action") or "recorded", claimed, request_id)
    saved["identity"] = "selected_on_phone"
    return saved


def assert_at_office(latitude: float, longitude: float) -> dict:
    settings = get_settings()
    meters = distance_meters(
        latitude,
        longitude,
        settings["latitude"],
        settings["longitude"],
    )
    if meters > settings["radius_meters"]:
        raise HTTPException(
            status_code=403,
            detail="You are not at the post office.",
        )
    return {"distance_meters": round(meters, 1), **settings}


def record_scan(employee_id: str, latitude: float, longitude: float, accuracy) -> dict:
    location = assert_at_office(latitude, longitude)
    employee = get_db()["employee"].find_one({"_id": employee_id})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    now = colombo_now()
    today = now.date().isoformat()
    assert_attendance_writable(today)
    clock = now.strftime("%H:%M")
    name = f"{employee_id}-{today}"
    logs = get_db()["attendance_log"]
    current = logs.find_one({"_id": name})
    decision = classify_scan(now, get_settings(), current)

    position = {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
    }
    status = decision["status"]

    if current is None:
        doc = {
            "_id": name,
            "name": name,
            "employee_id": employee_id,
            "employee_name": employee.get("employee_name") or "",
            "post_office": employee.get("post_office") or "",
            "designation": employee.get("designation") or "",
            "date": today,
            "fingerprint_in": clock if decision["kind"] == "check_in" else None,
            "fingerprint_out": clock if decision["kind"] == "check_out" else None,
            "attendance_status": status,
            "source": "door_scan",
            "created_at": now.isoformat(timespec="seconds"),
            "updated_at": now.isoformat(timespec="seconds"),
            **position,
        }
        logs.insert_one(doc)
    elif decision["kind"] == "check_in":
        logs.update_one(
            {"_id": name},
            {"$set": {"fingerprint_in": clock, "attendance_status": status, "updated_at": now.isoformat(timespec="seconds"), **position}},
        )
    else:
        changes = {"fingerprint_out": clock, "updated_at": now.isoformat(timespec="seconds"), **position}
        if status:
            changes["attendance_status"] = status
        logs.update_one({"_id": name}, {"$set": changes})

    return {
        "action": "in" if decision["kind"] == "check_in" else "out",
        "status": status,
        "time": clock,
        "date": today,
        "employee_id": employee_id,
        "employee_name": employee.get("employee_name") or "",
        "post_office": employee.get("post_office") or "",
        "designation": employee.get("designation") or "",
        "distance_meters": location["distance_meters"],
    }


def colombo_now() -> datetime:
    return datetime.now(COLOMBO)


def colombo_today() -> str:
    return colombo_now().date().isoformat()


def parse_attendance_date(value: str | None) -> str:
    text = str(value or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        raise HTTPException(status_code=400, detail="Choose a date as YYYY-MM-DD")
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Choose a real date") from exc
    return text


def _day(date: str) -> dict | None:
    return get_db()[DAY_STATUS].find_one({"_id": date})


def assert_attendance_writable(date: str) -> None:
    day = parse_attendance_date(date)
    current = _day(day)
    if current and current.get("status") == "closed":
        raise HTTPException(status_code=403, detail="This attendance day is closed.")


def display_status(record: dict) -> str:
    """Label a saved row. Missing fingerprints are not treated as absence."""
    arrived = bool(str(record.get("fingerprint_in") or "").strip())
    left = bool(str(record.get("fingerprint_out") or "").strip())
    if arrived and left:
        stored = str(record.get("attendance_status") or "")
        if stored in {"On time", "Late", "Half day", "Present"}:
            return stored
        return "Present"
    if arrived or left:
        return "Incomplete"
    return "Pending"


def daily_attendance(date: str | None, search: str = "") -> dict:
    day = parse_attendance_date(date) if date else colombo_today()
    logs = get_db()["attendance_log"]
    if hasattr(logs, "create_index"):
        logs.create_index([("employee_id", 1), ("date", 1)], unique=True, name="employee_date")
    rows = []
    for record in logs.find({"date": day}):
        public = {key: value for key, value in record.items() if key != "_id"}
        public["name"] = record.get("name") or record.get("_id")
        public["display_status"] = display_status(record)
        rows.append(public)
    needle = search.strip().lower()
    if needle:
        rows = [
            row
            for row in rows
            if needle in str(row.get("employee_id") or "").lower()
            or needle in str(row.get("employee_name") or "").lower()
        ]
    status = _day(day)
    incomplete = sum(1 for row in rows if row["display_status"] == "Incomplete")
    return {
        "attendance_date": day,
        "today": colombo_today(),
        "timezone": "Asia/Colombo",
        "day_status": (status or {}).get("status") or "open",
        "opened_by": (status or {}).get("opened_by") or "",
        "opened_at": (status or {}).get("opened_at") or "",
        "closed_by": (status or {}).get("closed_by") or "",
        "closed_at": (status or {}).get("closed_at") or "",
        "count": len(rows),
        "incomplete_count": incomplete,
        "records": rows,
    }


def open_attendance_day(date: str, username: str) -> dict:
    day = parse_attendance_date(date)
    current = _day(day)
    if current and current.get("status") == "closed":
        raise HTTPException(status_code=403, detail="A closed day cannot be opened again.")
    if current and current.get("status") == "open":
        return daily_attendance(day)
    stamp = colombo_now().isoformat(timespec="seconds")
    get_db()[DAY_STATUS].insert_one(
        {
            "_id": day,
            "attendance_date": day,
            "status": "open",
            "opened_by": username,
            "opened_at": stamp,
            "closed_by": "",
            "closed_at": "",
        }
    )
    return daily_attendance(day)


def close_attendance_day(date: str, username: str, confirm: bool) -> dict:
    day = parse_attendance_date(date)
    current = _day(day)
    if current and current.get("status") == "closed":
        raise HTTPException(status_code=409, detail="This attendance day is already closed.")
    preview = daily_attendance(day)
    if preview["incomplete_count"] and not confirm:
        raise HTTPException(
            status_code=409,
            detail=f"{preview['incomplete_count']} record(s) are missing a fingerprint time. Confirm to close the day.",
        )
    stamp = colombo_now().isoformat(timespec="seconds")
    stored = {
        "_id": day,
        "attendance_date": day,
        "status": "closed",
        "opened_by": (current or {}).get("opened_by") or "",
        "opened_at": (current or {}).get("opened_at") or "",
        "closed_by": username,
        "closed_at": stamp,
    }
    get_db()[DAY_STATUS].replace_one({"_id": day}, stored, upsert=True)
    return daily_attendance(day)
