"""Office location check and attendance time-in / time-out."""

import re
from datetime import datetime
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException

from db import get_db

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

    stored = {
        "_id": "attendance",
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
        **times,
        "open_days": open_days,
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

    now = datetime.now()
    today = now.date().isoformat()
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
            **position,
        }
        logs.insert_one(doc)
    elif decision["kind"] == "check_in":
        logs.update_one(
            {"_id": name},
            {"$set": {"fingerprint_in": clock, "attendance_status": status, **position}},
        )
    else:
        changes = {"fingerprint_out": clock, **position}
        if status:
            changes["attendance_status"] = status
        logs.update_one({"_id": name}, {"$set": changes})

    return {
        "action": "in" if decision["kind"] == "check_in" else "out",
        "status": status,
        "time": clock,
        "date": today,
        "employee_name": employee.get("employee_name") or "",
        "distance_meters": location["distance_meters"],
    }
