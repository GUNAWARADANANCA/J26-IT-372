"""Office location check and attendance time-in / time-out."""

import hashlib
import hmac
import os
import re
import socket
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException

from db import get_db

import io
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

AUDIT = "attendance_audit"
DAY_STATUS = "attendance_day"
try:
    COLOMBO = ZoneInfo("Asia/Colombo")
except Exception:
    COLOMBO = timezone(timedelta(hours=5, minutes=30), name="Asia/Colombo")
RATE_LIMIT = 8
RATE_WINDOW = timedelta(minutes=1)
_scan_attempts: dict[str, list[datetime]] = {}
_consumed_tokens: dict[str, int] = {}

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

CONFIG_TOGGLES = (
    "on_time_enabled",
    "late_enabled",
    "half_day_enabled",
    "checkout_enabled",
)

DEFAULT_SETTINGS = {
    "_id": "attendance",
    "office_id": "PO-KADUWELA",
    "office_name": "Kaduwela Head Post Office",
    "qr_location_id": "LOC-KADUWELA-01",
    "qr_active": True,
    "latitude": 6.927763,
    "longitude": 79.949514,
    "radius_meters": 50,
    "max_accuracy_meters": 100,
    "on_time_start": "18:00",
    "on_time_end": "20:40",
    "on_time_enabled": True,
    "late_start": "20:40",
    "late_end": "23:00",
    "late_enabled": True,
    "half_day_start": "12:00",
    "half_day_end": "14:00",
    "half_day_enabled": True,
    "checkout_start": "16:00",
    "checkout_end": "22:00",
    "checkout_enabled": True,
    "open_days": [0, 1, 2, 3, 4, 5],
    "epf_employee_percent": 8,
    "epf_employer_percent": 12,
    "etf_percent": 3,
    "late_deduction_lkr": 1000,
    "ot_rate_lkr": 1000,
    "timezone": "Asia/Colombo",
    "updated_by": "System Administrator",
    "updated_at": "2026-10-20T05:30:00+05:30",
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
        "office_id": str(merged.get("office_id") or DEFAULT_SETTINGS["office_id"]),
        "office_name": str(merged.get("office_name") or DEFAULT_SETTINGS["office_name"]),
        "qr_location_id": str(merged.get("qr_location_id") or DEFAULT_SETTINGS["qr_location_id"]),
        "qr_active": bool(merged.get("qr_active", True)),
        "max_accuracy_meters": int(merged.get("max_accuracy_meters", 100)),
        "latitude": float(merged["latitude"]),
        "longitude": float(merged["longitude"]),
        "radius_meters": int(merged["radius_meters"]),
        **{field: str(merged[field]) for field in TIME_FIELDS},
        **{field: bool(merged.get(field, True)) for field in CONFIG_TOGGLES},
        "open_days": [int(day) for day in open_days],
        "epf_employee_percent": float(merged.get("epf_employee_percent", 8)),
        "epf_employer_percent": float(merged.get("epf_employer_percent", 12)),
        "etf_percent": float(merged.get("etf_percent", 3)),
        "late_deduction_lkr": float(merged.get("late_deduction_lkr", 1000)),
        "ot_rate_lkr": float(merged.get("ot_rate_lkr", 1000)),
        "timezone": str(merged.get("timezone") or "Asia/Colombo"),
        "updated_by": str(merged.get("updated_by") or "System Administrator"),
        "updated_at": str(merged.get("updated_at") or "2026-10-20T05:30:00+05:30"),
        "on_time": {
            "start": str(merged["on_time_start"]),
            "end": str(merged["on_time_end"]),
            "enabled": bool(merged.get("on_time_enabled", True)),
        },
        "late": {
            "start": str(merged["late_start"]),
            "end": str(merged["late_end"]),
            "enabled": bool(merged.get("late_enabled", True)),
        },
        "half_day": {
            "start": str(merged["half_day_start"]),
            "end": str(merged["half_day_end"]),
            "enabled": bool(merged.get("half_day_enabled", True)),
        },
        "evening_checkout": {
            "start": str(merged["checkout_start"]),
            "end": str(merged["checkout_end"]),
            "enabled": bool(merged.get("checkout_enabled", True)),
        },
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
    # Unpack structured configuration window objects if sent by modern UI
    if "on_time" in updates and isinstance(updates["on_time"], dict):
        if "start" in updates["on_time"]:
            updates["on_time_start"] = updates["on_time"]["start"]
        if "end" in updates["on_time"]:
            updates["on_time_end"] = updates["on_time"]["end"]
        if "enabled" in updates["on_time"]:
            updates["on_time_enabled"] = updates["on_time"]["enabled"]

    if "late" in updates and isinstance(updates["late"], dict):
        if "start" in updates["late"]:
            updates["late_start"] = updates["late"]["start"]
        if "end" in updates["late"]:
            updates["late_end"] = updates["late"]["end"]
        if "enabled" in updates["late"]:
            updates["late_enabled"] = updates["late"]["enabled"]

    if "half_day" in updates and isinstance(updates["half_day"], dict):
        if "start" in updates["half_day"]:
            updates["half_day_start"] = updates["half_day"]["start"]
        if "end" in updates["half_day"]:
            updates["half_day_end"] = updates["half_day"]["end"]
        if "enabled" in updates["half_day"]:
            updates["half_day_enabled"] = updates["half_day"]["enabled"]

    if "evening_checkout" in updates and isinstance(updates["evening_checkout"], dict):
        if "start" in updates["evening_checkout"]:
            updates["checkout_start"] = updates["evening_checkout"]["start"]
        if "end" in updates["evening_checkout"]:
            updates["checkout_end"] = updates["evening_checkout"]["end"]
        if "enabled" in updates["evening_checkout"]:
            updates["checkout_enabled"] = updates["evening_checkout"]["enabled"]
    elif "checkout" in updates and isinstance(updates["checkout"], dict):
        if "start" in updates["checkout"]:
            updates["checkout_start"] = updates["checkout"]["start"]
        if "end" in updates["checkout"]:
            updates["checkout_end"] = updates["checkout"]["end"]
        if "enabled" in updates["checkout"]:
            updates["checkout_enabled"] = updates["checkout"]["enabled"]

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

    office_id = str(updates.get("office_id", current.get("office_id")) or DEFAULT_SETTINGS["office_id"]).strip()
    office_name = str(updates.get("office_name", current.get("office_name")) or DEFAULT_SETTINGS["office_name"]).strip()
    qr_location_id = str(updates.get("qr_location_id", current.get("qr_location_id")) or DEFAULT_SETTINGS["qr_location_id"]).strip()
    qr_active = bool(updates.get("qr_active", current.get("qr_active", True)))
    try:
        max_accuracy_meters = int(updates.get("max_accuracy_meters", current.get("max_accuracy_meters", 250)))
    except (TypeError, ValueError):
        max_accuracy_meters = 250

    toggles = {
        field: bool(updates.get(field, current.get(field, True)))
        for field in CONFIG_TOGGLES
    }
    updated_by = str(updates.get("updated_by") or "System Administrator").strip()
    updated_at = colombo_now().isoformat(timespec="seconds")

    stored = {
        "_id": "attendance",
        "office_id": office_id,
        "office_name": office_name,
        "qr_location_id": qr_location_id,
        "qr_active": qr_active,
        "max_accuracy_meters": max(25, min(max_accuracy_meters, 1000)),
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
        **times,
        **toggles,
        "open_days": open_days,
        **rates,
        "timezone": "Asia/Colombo",
        "updated_by": updated_by,
        "updated_at": updated_at,
    }
    get_db()["settings"].replace_one({"_id": "attendance"}, stored, upsert=True)
    return _public_settings(stored)


def _in_window(now_minutes: int, start: str, end: str) -> bool:
    return _minutes(start) <= now_minutes <= _minutes(end)


def current_time_window(now: datetime, settings: dict) -> dict:
    """Return the active attendance window for UI display with explicit gap policies."""
    if now.weekday() not in settings.get("open_days", [0, 1, 2, 3, 4, 5, 6]):
        return {"window": "closed_day", "label": "Office Closed Today", "allowed_actions": []}
    clock = now.hour * 60 + now.minute
    ot_start = _minutes(settings["on_time_start"])
    ot_end = _minutes(settings["on_time_end"])
    lt_start = _minutes(settings["late_start"])
    lt_end = _minutes(settings["late_end"])
    hd_start = _minutes(settings["half_day_start"])
    hd_end = _minutes(settings["half_day_end"])
    co_start = _minutes(settings["checkout_start"])
    co_end = _minutes(settings["checkout_end"])

    # 1. Half-day window: 12:00 to 14:00
    if settings.get("half_day_enabled", True) and hd_start <= clock <= hd_end:
        return {"window": "half_day", "label": "Half Day Window (12:00–14:00)", "allowed_actions": ["check_in", "check_out"]}

    # 2. On-Time Check-In: 18:00 inclusive to 20:40 exclusive
    if settings.get("on_time_enabled", True) and ot_start <= clock < ot_end:
        return {"window": "on_time", "label": "Present / On Time (18:00–20:40)", "allowed_actions": ["check_in"]}

    # 3. Late Check-In: 20:40 inclusive to 23:00 inclusive
    if settings.get("late_enabled", True) and lt_start <= clock <= lt_end:
        return {"window": "late", "label": "Late Check-In (20:40–23:00)", "allowed_actions": ["check_in"]}

    # 4. Evening Check-Out: 16:00 to 22:00
    if settings.get("checkout_enabled", True) and co_start <= clock <= co_end:
        return {"window": "checkout", "label": "Evening Check-Out (16:00–22:00)", "allowed_actions": ["check_out"]}

    # Informative labels for non-window hours
    if clock < hd_start:
        return {
            "window": "morning_operations",
            "label": f"Morning Shift (Next window: Half-Day {settings.get('half_day_start', '12:00')})",
            "allowed_actions": [],
        }
    if hd_end < clock < co_start:
        return {
            "window": "afternoon_operations",
            "label": f"Afternoon Dispatch (Check-Out opens {settings.get('checkout_start', '16:00')})",
            "allowed_actions": [],
        }
    return {
        "window": "closed_hours",
        "label": "Attendance Closed",
        "allowed_actions": [],
    }


def get_location_config(location_id: str | None = None) -> dict:
    """Return public post office geofencing configuration for the QR attendance page."""
    settings = get_settings()
    if not settings.get("qr_active", True):
        raise HTTPException(
            status_code=403,
            detail="This post office QR attendance code has been deactivated by the Postmaster.",
        )
    wanted = str(location_id or "").strip()
    if wanted and wanted != settings["qr_location_id"] and wanted != settings["office_id"]:
        raise HTTPException(
            status_code=404,
            detail="Unrecognized post office QR location identifier.",
        )
    now = colombo_now()
    eligibility = current_time_window(now, settings)
    lan_ip = detect_lan_ipv4()
    configured_base = os.environ.get("PUBLIC_APP_URL", "").strip().rstrip("/")
    port = os.environ.get("FRONTEND_PORT", "5173").strip()
    if not configured_base:
        configured_base = f"https://{lan_ip}:{port}" if lan_ip != "127.0.0.1" else f"https://localhost:{port}"
    return {
        "office_id": settings["office_id"],
        "office_name": settings["office_name"],
        "qr_location_id": settings["qr_location_id"],
        "qr_active": settings["qr_active"],
        "latitude": settings["latitude"],
        "longitude": settings["longitude"],
        "radius_meters": settings["radius_meters"],
        "max_accuracy_meters": settings["max_accuracy_meters"],
        "on_time_start": settings["on_time_start"],
        "on_time_end": settings["on_time_end"],
        "late_start": settings["late_start"],
        "late_end": settings["late_end"],
        "half_day_start": settings["half_day_start"],
        "half_day_end": settings["half_day_end"],
        "checkout_start": settings["checkout_start"],
        "checkout_end": settings["checkout_end"],
        "open_days": settings["open_days"],
        "server_date": now.date().isoformat(),
        "server_time": now.strftime("%H:%M:%S"),
        "timezone": "Asia/Colombo",
        "eligibility": eligibility,
        "lan_ip": lan_ip,
        "public_base_url": configured_base,
        "door_token": issue_door_token(settings["qr_location_id"])["token"] if settings.get("qr_location_id") else "",
    }


def reset_attendance_record(employee_id: str, date: str | None = None) -> dict:
    """Reset today's attendance log and duplicate guard for an employee to allow fresh sign-in / sign-out testing."""
    claimed = str(employee_id or "").strip()
    db = get_db()
    emp_doc = db["employee"].find_one({"_id": claimed})
    if emp_doc is None:
        emp_doc = db["employee"].find_one({
            "$or": [
                {"employee_name": {"$regex": f"^{re.escape(claimed)}$", "$options": "i"}},
                {"name": {"$regex": f"^{re.escape(claimed)}$", "$options": "i"}},
            ]
        })
    if emp_doc:
        claimed = str(emp_doc["_id"])
    if not date:
        date = colombo_today()
    name = f"{claimed}-{date}"
    deleted = db["attendance_log"].delete_one({"_id": name})
    try:
        db["attendance_scan_guard"].delete_one({"_id": f"{claimed}:in"})
        db["attendance_scan_guard"].delete_one({"_id": f"{claimed}:out"})
        db["attendance_scan_guard"].delete_one({"_id": f"{claimed}:check_in"})
        db["attendance_scan_guard"].delete_one({"_id": f"{claimed}:check_out"})
        db["attendance_scan_guard"].delete_one({"_id": claimed})
        if emp_doc and emp_doc.get("employee_name"):
            ename = emp_doc["employee_name"]
            db["attendance_scan_guard"].delete_one({"_id": f"{ename}:in"})
            db["attendance_scan_guard"].delete_one({"_id": f"{ename}:out"})
            db["attendance_scan_guard"].delete_one({"_id": f"{ename}:check_in"})
            db["attendance_scan_guard"].delete_one({"_id": f"{ename}:check_out"})
            db["attendance_scan_guard"].delete_one({"_id": ename})
    except Exception:
        pass
    return {
        "ok": True,
        "employee_id": claimed,
        "date": date,
        "deleted": bool(deleted.deleted_count),
    }


def manage_qr_location(action: str, office_name: str | None = None, office_id: str | None = None) -> dict:
    """Regenerate, activate, or deactivate the post office QR location identifier."""
    settings = get_settings()
    updates = dict(settings)
    if office_name:
        updates["office_name"] = str(office_name).strip()
    if office_id:
        updates["office_id"] = str(office_id).strip()
    act = str(action or "").strip().lower()
    if act == "regenerate":
        suffix = hashlib.sha256(f"{time.time()}-{os.urandom(8).hex()}".encode()).hexdigest()[:6].upper()
        base = re.sub(r"[^A-Z0-9]+", "-", updates["office_id"].upper()).strip("-") or "LOC"
        updates["qr_location_id"] = f"{base}-{suffix}"
        updates["qr_active"] = True
    elif act == "deactivate":
        updates["qr_active"] = False
    elif act == "activate":
        updates["qr_active"] = True
    else:
        raise HTTPException(status_code=400, detail="Unsupported QR management action.")
    saved = save_settings(updates)
    token_info = issue_door_token()
    return {**saved, "door_token": token_info}


def classify_attendance_time(clock_minutes: int, settings: dict) -> dict:
    """Classify attendance time based on configured windows:
    - Half Day: 12:00 to 14:00 inclusive
    - On Time: 18:00 inclusive to 20:40 exclusive
    - Late: 20:40 inclusive to 23:00 inclusive
    """
    ot_start = _minutes(settings.get("on_time_start", "18:00"))
    ot_end = _minutes(settings.get("on_time_end", "20:40"))
    lt_start = _minutes(settings.get("late_start", "20:40"))
    lt_end = _minutes(settings.get("late_end", "23:00"))
    hd_start = _minutes(settings.get("half_day_start", "12:00"))
    hd_end = _minutes(settings.get("half_day_end", "14:00"))

    if settings.get("half_day_enabled", True) and hd_start <= clock_minutes <= hd_end:
        return {"type": "Half Day", "status": "Half day", "late_minutes": 0, "is_valid": True}
    if settings.get("on_time_enabled", True) and ot_start <= clock_minutes < ot_end:
        return {"type": "On Time", "status": "On time", "late_minutes": 0, "is_valid": True}
    if settings.get("late_enabled", True) and lt_start <= clock_minutes <= lt_end:
        return {"type": "Late", "status": "Late", "late_minutes": max(0, clock_minutes - ot_end), "is_valid": True}
    return {"type": "Unclassified", "status": "Unclassified", "late_minutes": 0, "is_valid": False}


def classify_scan(now: datetime, settings: dict, current: dict | None, requested_action: str | None = None) -> dict:
    clock = now.hour * 60 + now.minute
    fingerprint_in = (current or {}).get("fingerprint_in") or (current or {}).get("check_in_time")
    fingerprint_out = (current or {}).get("fingerprint_out") or (current or {}).get("check_out_time")
    act = str(requested_action or "").strip().lower()

    ot_start = _minutes(settings["on_time_start"])
    ot_end = _minutes(settings["on_time_end"])
    lt_start = _minutes(settings["late_start"])
    lt_end = _minutes(settings["late_end"])
    hd_start = _minutes(settings["half_day_start"])
    hd_end = _minutes(settings["half_day_end"])
    co_start = _minutes(settings.get("checkout_start", "16:00"))
    co_end = _minutes(settings.get("checkout_end", "22:00"))

    # 1. When the employee explicitly requests Check-In:
    if act in ("in", "check_in"):
        if fingerprint_in:
            raise HTTPException(
                status_code=409,
                detail=f"This employee has already signed in today at {fingerprint_in}. Duplicate sign-in is not allowed.",
            )

        # Half Day: 12:00 to 14:00 inclusive
        if settings.get("half_day_enabled", True) and hd_start <= clock <= hd_end:
            return {"kind": "check_in", "status": "Half day", "type": "Half Day", "late_minutes": 0}

        # On Time: 18:00 inclusive to 20:40 exclusive
        if settings.get("on_time_enabled", True) and ot_start <= clock < ot_end:
            return {"kind": "check_in", "status": "On time", "type": "On Time", "late_minutes": 0}

        # Late: 20:40 inclusive to 23:00 inclusive
        if settings.get("late_enabled", True) and lt_start <= clock <= lt_end:
            late_mins = max(0, clock - ot_end)
            return {"kind": "check_in", "status": "Late", "type": "Late", "late_minutes": late_mins}

        # Fallback if in other periods or closed
        curr_str = now.strftime("%H:%M")
        raise HTTPException(
            status_code=403,
            detail=(
                f"Current check-in time ({curr_str}) is outside all configured check-in windows. "
                f"Active check-in windows: Half-Day ({settings.get('half_day_start', '12:00')}–{settings.get('half_day_end', '14:00')}), "
                f"On-Time ({settings.get('on_time_start', '18:00')}–{settings.get('on_time_end', '20:40')}), "
                f"Late ({settings.get('late_start', '20:40')}–{settings.get('late_end', '23:00')})."
            ),
        )

    # 2. When the employee explicitly requests Check-Out:
    if act in ("out", "check_out"):
        if not fingerprint_in:
            raise HTTPException(
                status_code=409,
                detail="This employee has not signed in today yet. Please Check-In first before Checking Out.",
            )
        if fingerprint_out:
            raise HTTPException(
                status_code=409,
                detail=f"This employee has already signed out today at {fingerprint_out}. Duplicate sign-out is not allowed.",
            )

        # Check-out window validation
        if settings.get("checkout_enabled", True) and not (co_start <= clock <= co_end):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Current check-out time ({now.strftime('%H:%M')}) is outside the permitted evening check-out window "
                    f"({settings.get('checkout_start', '16:00')}–{settings.get('checkout_end', '22:00')})."
                ),
            )

        in_clock = _minutes(str(fingerprint_in))
        duration_mins = max(0, clock - in_clock)
        status = (current or {}).get("attendance_status") or "Present"
        orig_type = (current or {}).get("check_in_type") or ("Late" if status == "Late" else ("Half Day" if status == "Half day" else "On Time"))
        return {
            "kind": "check_out",
            "status": status,
            "type": orig_type,
            "working_duration": duration_mins,
        }

    # 3. Automatic classification when no explicit button is passed:
    if now.weekday() not in settings.get("open_days", [0, 1, 2, 3, 4, 5, 6]):
        raise HTTPException(status_code=403, detail="The post office is closed today.")

    in_on_time = settings.get("on_time_enabled", True) and ot_start <= clock < ot_end
    in_late = settings.get("late_enabled", True) and lt_start <= clock <= lt_end
    in_half_day = settings.get("half_day_enabled", True) and hd_start <= clock <= hd_end
    in_checkout = settings.get("checkout_enabled", True) and co_start <= clock <= co_end

    if in_on_time:
        if fingerprint_in:
            raise HTTPException(status_code=409, detail="You have already checked in today.")
        return {"kind": "check_in", "status": "On time", "type": "On Time", "late_minutes": 0}
    elif in_late:
        if fingerprint_in:
            raise HTTPException(status_code=409, detail="You have already checked in today.")
        late_mins = max(0, clock - ot_end)
        return {"kind": "check_in", "status": "Late", "type": "Late", "late_minutes": late_mins}
    elif in_half_day:
        morning_check_in = bool(fingerprint_in) and _minutes(str(fingerprint_in)) < hd_start
        if morning_check_in:
            if fingerprint_out:
                raise HTTPException(status_code=409, detail="You have already checked out today.")
            in_clock = _minutes(str(fingerprint_in))
            return {
                "kind": "check_out",
                "status": "Half day",
                "type": "Half Day",
                "working_duration": max(0, clock - in_clock),
            }
        else:
            if fingerprint_in:
                raise HTTPException(status_code=409, detail="You have already checked in today.")
            return {"kind": "check_in", "status": "Half day", "type": "Half Day", "late_minutes": 0}
    elif in_checkout:
        if not fingerprint_in:
            raise HTTPException(status_code=409, detail="This employee has not signed in today yet. Please Check-In first before Checking Out.")
        if fingerprint_out:
            raise HTTPException(status_code=409, detail="You have already checked out today.")
        in_clock = _minutes(str(fingerprint_in))
        status = (current or {}).get("attendance_status") or "Present"
        orig_type = (current or {}).get("check_in_type") or "On Time"
        return {
            "kind": "check_out",
            "status": status,
            "type": orig_type,
            "working_duration": max(0, clock - in_clock),
        }
    else:
        raise HTTPException(status_code=403, detail="Attendance is not open at this time.")


def detect_lan_ipv4() -> str:
    """Detect the host computer's primary LAN IPv4 address for mobile QR scanning."""
    override = os.environ.get("ATTENDANCE_LAN_IP", "").strip()
    if override:
        return override
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(0.3)
            sock.connect(("10.255.255.255", 1))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                return ip
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                return ip
    except Exception:
        pass
    return "127.0.0.1"


def _door_secret() -> bytes:
    secret = os.environ.get("ATTENDANCE_DOOR_SECRET", "").strip()
    if len(secret) < 16:
        raise HTTPException(status_code=503, detail="The door code is not configured.")
    return secret.encode("utf-8")


def _token_lifetime() -> int:
    try:
        return max(int(os.environ.get("ATTENDANCE_TOKEN_SECONDS", "300")), 1)
    except ValueError:
        return 300


def issue_door_token(location_id: str | None = None, origin_port: str | None = None) -> dict:
    """Short-lived door code. It does not identify an employee or prove presence."""
    issued = int(time.time())
    expires = issued + _token_lifetime()
    payload = f"{issued}.{expires}"
    signature = hmac.new(_door_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token = f"{payload}.{signature}"

    lan_ip = detect_lan_ipv4()
    configured_base = os.environ.get("PUBLIC_APP_URL", "").strip().rstrip("/")
    port = str(origin_port or os.environ.get("FRONTEND_PORT", "5173")).strip()
    if not configured_base:
        configured_base = f"https://{lan_ip}:{port}" if lan_ip != "127.0.0.1" else f"https://localhost:{port}"

    loc_id = str(location_id or "").strip()
    if not loc_id:
        try:
            loc_id = get_settings().get("qr_location_id", "LOC-KADUWELA-01")
        except Exception:
            loc_id = "LOC-KADUWELA-01"

    return {
        "token": token,
        "issued_at": issued,
        "expires_at": expires,
        "expires_in": _token_lifetime(),
        "lan_ip": lan_ip,
        "public_base_url": configured_base,
        "qr_location_id": loc_id,
    }


def verify_door_token(token: str | None) -> str:
    text = str(token or "").strip()
    if text == "QR_TOKEN_DISABLED" and os.environ.get("ENABLE_QR_DOOR_TOKEN", "false").lower() != "true":
        return text
    if "#" in text:
        text = text.rsplit("#", 1)[-1].strip()
    if "code=" in text:
        text = text.rsplit("code=", 1)[-1].split("&", 1)[0].strip()
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
    if issued > now + 60 or expires < now or expires <= issued or expires - issued > _token_lifetime() + 30:
        raise HTTPException(status_code=403, detail="The door code has expired.")
    return text


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
    qr_location_id: str | None = None,
    requested_action: str | None = None,
    device_info: str = "",
) -> dict:
    """Accept a door scan. The employee id is the name selected on the phone, not proof of identity."""
    claimed = str(employee_id or "").strip()
    if not claimed:
        raise HTTPException(status_code=400, detail="Choose your name")
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Location is required") from exc
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Invalid GPS coordinates detected.")
    guard_key = f"{claimed}:{requested_action}" if requested_action else claimed
    reserved = False
    previous = None
    try:
        _limit_scans(client_key or "unknown")
        require_token = os.environ.get("ENABLE_QR_DOOR_TOKEN", "false").lower() == "true"
        if require_token or requested_action is None:
            verify_door_token(door_token)
        emp_doc = get_db()["employee"].find_one({"_id": claimed})
        if emp_doc is None:
            for emp in get_db()["employee"].find():
                if emp.get("employee_name") == claimed or emp.get("name") == claimed:
                    emp_doc = emp
                    break
        if emp_doc is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        claimed = str(emp_doc["_id"])
        guard_key = f"{claimed}:{requested_action}" if requested_action else claimed
        previous = _claim_scan(guard_key)
        reserved = True
        extra = {}
        if qr_location_id is not None:
            extra["qr_location_id"] = qr_location_id
        if requested_action is not None:
            extra["requested_action"] = requested_action
        if device_info:
            extra["device_info"] = device_info
        saved = (
            record_scan(claimed, latitude, longitude, accuracy, **extra)
            if extra
            else record_scan(claimed, latitude, longitude, accuracy)
        )
    except HTTPException as exc:
        if reserved:
            _release_scan(guard_key, previous)
        _audit("rejected", str(exc.detail), claimed, request_id)
        raise
    _audit("accepted", saved.get("action") or "recorded", claimed, request_id)
    saved["identity"] = "selected_on_phone"
    return saved


def validate_gps_location(
    latitude: float,
    longitude: float,
    accuracy: float | None = None,
    location_id: str | None = None,
) -> dict:
    """Calculate distance and validate geofencing without throwing unless location_id is deactivated/invalid."""
    config = get_location_config(location_id)
    meters = distance_meters(
        latitude,
        longitude,
        config["latitude"],
        config["longitude"],
    )
    radius = config["radius_meters"]
    within_radius = meters <= radius
    max_acc = config.get("max_accuracy_meters", 100)
    accuracy_flagged = False
    if accuracy is not None:
        try:
            acc_val = float(accuracy)
            if acc_val <= 0 or acc_val > max_acc:
                accuracy_flagged = True
        except (TypeError, ValueError):
            pass

    if not within_radius:
        geofence_status = "Outside"
    elif accuracy_flagged:
        geofence_status = "Flagged"
    else:
        geofence_status = "Passed"

    return {
        "within_radius": within_radius,
        "distance_meters": round(meters, 1),
        "radius_meters": radius,
        "geofence_status": geofence_status,
        "accuracy_flagged": accuracy_flagged,
        "office_id": config["office_id"],
        "office_name": config["office_name"],
        "qr_location_id": config["qr_location_id"],
        "office_latitude": config["latitude"],
        "office_longitude": config["longitude"],
        "eligibility": config["eligibility"],
    }


def assert_at_office(
    latitude: float,
    longitude: float,
    accuracy: float | None = None,
    location_id: str | None = None,
) -> dict:
    settings = get_settings()
    if not settings.get("qr_active", True):
        raise HTTPException(
            status_code=403,
            detail="This post office QR attendance code has been deactivated by the Postmaster.",
        )
    wanted = str(location_id or "").strip()
    if wanted and wanted != settings["qr_location_id"] and wanted != settings["office_id"]:
        raise HTTPException(
            status_code=403,
            detail="You scanned a QR code for a different or unrecognized post office location.",
        )
    meters = distance_meters(
        latitude,
        longitude,
        settings["latitude"],
        settings["longitude"],
    )
    if meters > settings["radius_meters"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"You are outside the permitted office attendance area ({round(meters, 1)}m away). "
                f"Please move within {settings['radius_meters']} meters of the registered post office and try again."
            ),
        )
    geofence_status = "Passed"
    if accuracy is not None:
        try:
            acc_val = float(accuracy)
            if acc_val <= 0:
                raise HTTPException(status_code=400, detail="Suspicious or invalid GPS accuracy reading rejected.")
            if acc_val > 1000:
                raise HTTPException(
                    status_code=400,
                    detail=f"GPS signal is too inaccurate (±{round(acc_val)}m). Move outdoors or enable High Accuracy GPS and try again.",
                )
            if acc_val > settings.get("max_accuracy_meters", 100):
                geofence_status = "Flagged"
        except (TypeError, ValueError):
            pass

    return {
        "distance_meters": round(meters, 1),
        "geofence_status": geofence_status,
        **settings,
    }


def record_scan(
    employee_id: str,
    latitude: float,
    longitude: float,
    accuracy,
    qr_location_id: str | None = None,
    requested_action: str | None = None,
    device_info: str = "",
    notes: str = "",
) -> dict:
    location = assert_at_office(latitude, longitude, accuracy, qr_location_id)
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
    settings = get_settings()
    decision = classify_scan(now, settings, current, requested_action)

    geofence_status = location.get("geofence_status", "Passed")
    office_id = settings.get("office_id") or "PO-KADUWELA"
    resolved_qr_loc = qr_location_id or settings.get("qr_location_id") or "LOC-KADUWELA-01"
    office_label = employee.get("post_office") or settings.get("office_name") or "Kaduwela Head Post Office"
    department = employee.get("work_category") or employee.get("department") or "Postal Operations"

    status = decision["status"]
    check_in_type = decision.get("type") or ("On Time" if status == "On time" else status)
    late_mins = decision.get("late_minutes", 0)
    late_formatted = f"{late_mins}m" if late_mins > 0 else "0m"

    working_duration_mins = decision.get("working_duration")
    if working_duration_mins is not None:
        working_formatted = f"{working_duration_mins // 60}h {working_duration_mins % 60}m"
    else:
        working_formatted = "—"

    position = {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "gps_accuracy_meters": accuracy,
        "distance_meters": location["distance_meters"],
        "geofence_status": geofence_status,
        "geofence_verified": geofence_status == "Passed",
        "qr_verified": True,
        "verification_method": "Geofence GPS + Door QR",
        "office_id": office_id,
        "qr_location_id": resolved_qr_loc,
        "device_info": str(device_info or "")[:200],
        "notes": str(notes or "")[:300],
    }

    if current is None:
        doc = {
            "_id": name,
            "name": name,
            "employee_id": employee_id,
            "employee_name": employee.get("employee_name") or "",
            "post_office": office_label,
            "designation": employee.get("designation") or "",
            "department": department,
            "work_category": department,
            "date": today,
            "attendance_date": today,
            "fingerprint_in": clock if decision["kind"] == "check_in" else None,
            "fingerprint_out": clock if decision["kind"] == "check_out" else None,
            "check_in_time": clock if decision["kind"] == "check_in" else None,
            "check_out_time": clock if decision["kind"] == "check_out" else None,
            "check_in_type": check_in_type if decision["kind"] == "check_in" else None,
            "check_in_latitude": latitude if decision["kind"] == "check_in" else None,
            "check_in_longitude": longitude if decision["kind"] == "check_in" else None,
            "check_out_latitude": latitude if decision["kind"] == "check_out" else None,
            "check_out_longitude": longitude if decision["kind"] == "check_out" else None,
            "attendance_status": status,
            "late_duration_minutes": late_mins if decision["kind"] == "check_in" else 0,
            "late_duration_formatted": late_formatted if decision["kind"] == "check_in" else "0m",
            "working_duration_minutes": working_duration_mins,
            "working_duration_formatted": working_formatted,
            "source": "door_scan",
            "created_at": now.isoformat(timespec="seconds"),
            "updated_at": now.isoformat(timespec="seconds"),
            **position,
        }
        logs.insert_one(doc)
    elif decision["kind"] == "check_in":
        logs.update_one(
            {"_id": name},
            {
                "$set": {
                    "fingerprint_in": clock,
                    "check_in_time": clock,
                    "check_in_type": check_in_type,
                    "check_in_latitude": latitude,
                    "check_in_longitude": longitude,
                    "attendance_status": status,
                    "late_duration_minutes": late_mins,
                    "late_duration_formatted": late_formatted,
                    "updated_at": now.isoformat(timespec="seconds"),
                    **position,
                }
            },
        )
    else:
        # Check-Out preserves original check-in type and updates durations
        changes = {
            "fingerprint_out": clock,
            "check_out_time": clock,
            "check_out_latitude": latitude,
            "check_out_longitude": longitude,
            "working_duration_minutes": working_duration_mins,
            "working_duration_formatted": working_formatted,
            "updated_at": now.isoformat(timespec="seconds"),
            **position,
        }
        if status:
            changes["attendance_status"] = status
        logs.update_one({"_id": name}, {"$set": changes})

    return {
        "action": "in" if decision["kind"] == "check_in" else "out",
        "status": status,
        "attendance_type": check_in_type,
        "time": clock,
        "date": today,
        "attendance_date": today,
        "employee_id": employee_id,
        "employee_name": employee.get("employee_name") or "",
        "post_office": office_label,
        "office_id": office_id,
        "qr_location_id": resolved_qr_loc,
        "designation": employee.get("designation") or "",
        "department": department,
        "distance_meters": location["distance_meters"],
        "radius_meters": settings["radius_meters"],
        "geofence_status": geofence_status,
        "geofence_verified": geofence_status == "Passed",
        "qr_verified": True,
        "gps_accuracy_meters": accuracy,
        "late_duration_minutes": late_mins if decision["kind"] == "check_in" else current.get("late_duration_minutes", 0) if current else 0,
        "late_duration_formatted": late_formatted if decision["kind"] == "check_in" else current.get("late_duration_formatted", "0m") if current else "0m",
        "working_duration_minutes": working_duration_mins,
        "working_duration_formatted": working_formatted,
        "verification_method": "Geofence GPS + Door QR",
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


def daily_attendance(
    date: str | None = None,
    search: str = "",
    type_filter: str = "All",
    status_filter: str = "All",
    office_filter: str = "All",
    include_absent: bool = True,
) -> dict:
    day = parse_attendance_date(date) if date else colombo_today()
    db = get_db()
    logs = db["attendance_log"]
    if hasattr(logs, "create_index"):
        try:
            logs.create_index([("employee_id", 1), ("date", 1)], unique=True, name="employee_date")
        except Exception:
            pass

    # Fetch all employees for employee lookup and absent calculation
    employees_map = {}
    try:
        emp_coll = db["employee"]
        if emp_coll is not None:
            for emp in emp_coll.find():
                eid = emp.get("_id") or emp.get("employee_id") or emp.get("name")
                if eid:
                    employees_map[str(eid)] = emp
    except Exception:
        pass

    # Pre-query approved leaves for the target day
    approved_leaves_map = {}
    try:
        leave_coll = db["entitlement_leave"]
        if leave_coll is not None:
            for l_doc in leave_coll.find({
                "status": {"$in": ["Approved", "approved"]},
                "from_date": {"$lte": day},
                "to_date": {"$gte": day},
            }):
                emp_key = str(l_doc.get("employee_id") or "")
                if emp_key:
                    approved_leaves_map[emp_key] = l_doc
    except Exception:
        pass

    raw_logs = list(logs.find({"date": day}))
    logged_ids = set()
    settings = get_settings()

    rows = []
    for record in raw_logs:
        eid = str(record.get("employee_id") or "")
        logged_ids.add(eid)
        emp = employees_map.get(eid, {})

        in_time = record.get("check_in_time") or record.get("fingerprint_in")
        out_time = record.get("check_out_time") or record.get("fingerprint_out")

        # Normalize classification type
        att_type = record.get("check_in_type") or record.get("attendance_type")
        if not att_type:
            raw_st = str(record.get("attendance_status") or "")
            if raw_st.lower() in ("on time", "late", "half day"):
                att_type = raw_st
            elif in_time and in_time != "—":
                try:
                    att_type = classify_attendance_time(_minutes(in_time), settings)["type"]
                except Exception:
                    att_type = "On Time"
            else:
                att_type = "On Time"

        if str(att_type).lower() in ("on time", "on_time"):
            att_type = "On Time"
        elif str(att_type).lower() in ("late", "late_check_in"):
            att_type = "Late"
        elif str(att_type).lower() in ("half day", "half_day"):
            att_type = "Half Day"
        else:
            att_type = "On Time"

        att_status = "Present" if att_type in ("On Time", "Late") else (att_type if att_type == "Half Day" else "Present")

        dist = record.get("distance_meters")
        geo_status = record.get("geofence_status") or ("Passed" if dist is not None and dist <= settings["radius_meters"] else "Not Required")
        gps_verif = "Verified" if geo_status == "Passed" else ("Failed" if geo_status == "Outside" else "Verified")

        work_mins = record.get("working_duration_minutes")
        if work_mins is None and in_time and out_time:
            try:
                work_mins = max(0, _minutes(out_time) - _minutes(in_time))
            except Exception:
                work_mins = None
        work_formatted = f"{work_mins // 60}h {work_mins % 60}m" if work_mins is not None else "—"

        late_mins = record.get("late_duration_minutes", 0)
        late_formatted = f"{late_mins}m" if late_mins > 0 else "0m"

        has_in = bool(in_time and str(in_time).strip() not in ("—", "-"))
        has_out = bool(out_time and str(out_time).strip() not in ("—", "-"))
        is_checked_in = has_in and not has_out

        public = {key: value for key, value in record.items() if key != "_id"}
        public["name"] = record.get("name") or record.get("_id")
        public["employee_id"] = eid
        public["employee_name"] = record.get("employee_name") or emp.get("employee_name") or eid
        public["designation"] = record.get("designation") or emp.get("designation") or "Officer"
        public["post_office"] = record.get("post_office") or emp.get("post_office") or settings["office_name"]
        public["department"] = record.get("department") or emp.get("work_category") or "Postal Operations"
        public["date"] = day
        public["attendance_date"] = day
        public["check_in_time"] = in_time or "—"
        public["check_out_time"] = out_time or "—"
        public["attendance_type"] = att_type
        public["attendance_status"] = att_status
        public["display_status"] = display_status(record)
        public["gps_verification"] = gps_verif
        public["geofence_status"] = geo_status
        public["distance_meters"] = dist
        public["working_duration_minutes"] = work_mins
        public["working_duration_formatted"] = work_formatted
        public["late_duration_minutes"] = late_mins
        public["late_duration_formatted"] = late_formatted
        public["verification_method"] = record.get("verification_method") or "Geofence GPS + Door QR"
        public["is_currently_checked_in"] = is_checked_in
        public["is_absent"] = False
        if eid in approved_leaves_map:
            l_doc = approved_leaves_map[eid]
            public["has_leave_conflict"] = True
            public["approved_leave_type"] = l_doc.get("leave_type")
            public["conflict_notice"] = f"Approved leave active ({l_doc.get('leave_type')}) with attendance check-in."
        rows.append(public)

    # Summary metrics calculation
    total_employees = len(employees_map) if employees_map else len(rows)
    present_today = len(rows)
    on_time_count = sum(1 for r in rows if r["attendance_type"] == "On Time")
    late_count = sum(1 for r in rows if r["attendance_type"] == "Late")
    half_day_count = sum(1 for r in rows if r["attendance_type"] == "Half Day")
    currently_checked_in = sum(1 for r in rows if r["is_currently_checked_in"])
    absent_count = max(0, total_employees - present_today)
    attendance_rate = round((present_today / total_employees) * 100, 1) if total_employees > 0 else 0.0

    summary = {
        "total_employees": total_employees,
        "present_today": present_today,
        "on_time_count": on_time_count,
        "late_count": late_count,
        "half_day_count": half_day_count,
        "absent_count": absent_count,
        "currently_checked_in": currently_checked_in,
        "checked_in_now": currently_checked_in,
        "attendance_rate": attendance_rate,
    }

    # Synthesize Absent & On-Leave Employees list
    absent_rows = []
    if employees_map:
        # Pre-query approved leaves for the target day
        approved_leaves_map = {}
        try:
            leave_coll = db["entitlement_leave"]
            if leave_coll is not None:
                for l_doc in leave_coll.find({
                    "status": {"$regex": "^approved$", "$options": "i"},
                    "from_date": {"$lte": day},
                    "to_date": {"$gte": day},
                }):
                    emp_key = str(l_doc.get("employee_id") or "")
                    if emp_key:
                        approved_leaves_map[emp_key] = l_doc
        except Exception:
            pass

        for eid, emp in employees_map.items():
            if eid not in logged_ids:
                app_leave = approved_leaves_map.get(eid) or approved_leaves_map.get(str(emp.get("employee_id") or ""))
                if app_leave:
                    l_type = app_leave.get("leave_type") or "Approved Leave"
                    abs_rec = {
                        "name": f"{eid}-{day}",
                        "employee_id": eid,
                        "employee_name": emp.get("employee_name") or emp.get("name") or eid,
                        "designation": emp.get("designation") or "Officer",
                        "post_office": emp.get("post_office") or settings["office_name"],
                        "department": emp.get("work_category") or "Postal Operations",
                        "date": day,
                        "attendance_date": day,
                        "check_in_time": "—",
                        "check_out_time": "—",
                        "fingerprint_in": None,
                        "fingerprint_out": None,
                        "attendance_type": "On Leave",
                        "attendance_status": "On Leave",
                        "display_status": "On Leave",
                        "gps_verification": "Not Required",
                        "geofence_status": "—",
                        "distance_meters": None,
                        "working_duration_minutes": 0,
                        "working_duration_formatted": "—",
                        "late_duration_minutes": 0,
                        "late_duration_formatted": "—",
                        "verification_method": f"Approved {l_type}",
                        "is_currently_checked_in": False,
                        "is_absent": False,
                        "on_leave": True,
                        "leave_type": l_type,
                    }
                else:
                    abs_rec = {
                        "name": f"{eid}-{day}",
                        "employee_id": eid,
                        "employee_name": emp.get("employee_name") or emp.get("name") or eid,
                        "designation": emp.get("designation") or "Officer",
                        "post_office": emp.get("post_office") or settings["office_name"],
                        "department": emp.get("work_category") or "Postal Operations",
                        "date": day,
                        "attendance_date": day,
                        "check_in_time": "—",
                        "check_out_time": "—",
                        "fingerprint_in": None,
                        "fingerprint_out": None,
                        "attendance_type": "Absent",
                        "attendance_status": "Absent",
                        "display_status": "Absent",
                        "gps_verification": "Not Required",
                        "geofence_status": "—",
                        "distance_meters": None,
                        "working_duration_minutes": 0,
                        "working_duration_formatted": "—",
                        "late_duration_minutes": 0,
                        "late_duration_formatted": "—",
                        "verification_method": "—",
                        "is_currently_checked_in": False,
                        "is_absent": True,
                        "on_leave": False,
                    }
                absent_rows.append(abs_rec)

    all_table_records = list(rows)
    if include_absent:
        all_table_records.extend(absent_rows)

    # Recalculate summary metrics with On Leave counts
    on_leave_count = len(approved_leaves_map)
    actual_absent_count = sum(1 for r in absent_rows if r.get("attendance_type") == "Absent")
    summary["on_leave_count"] = on_leave_count
    summary["absent_count"] = actual_absent_count

    # Filter rows based on search and parameters
    filtered = all_table_records
    needle = search.strip().lower()
    if needle:
        filtered = [
            r for r in filtered
            if needle in str(r.get("employee_id") or "").lower()
            or needle in str(r.get("employee_name") or "").lower()
            or needle in str(r.get("designation") or "").lower()
        ]
    if type_filter and type_filter != "All":
        filtered = [r for r in filtered if r.get("attendance_type") == type_filter]
    if status_filter and status_filter != "All":
        if status_filter == "Currently Checked In":
            filtered = [r for r in filtered if r.get("is_currently_checked_in")]
        else:
            filtered = [r for r in filtered if r.get("attendance_status") == status_filter]
    if office_filter and office_filter != "All":
        filtered = [r for r in filtered if r.get("post_office") == office_filter or r.get("department") == office_filter]

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
        "summary": summary,
        "records": filtered,
        "present_records": rows,
        "absent_employees": absent_rows,
        "settings": settings,
    }


def export_daily_attendance_excel(
    date: str | None = None,
    search: str = "",
    type_filter: str = "All",
    status_filter: str = "All",
) -> io.BytesIO:
    data = daily_attendance(date, search, type_filter, status_filter)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Daily Attendance"
    ws.views.sheetView[0].showGridLines = True

    header_fill = PatternFill(start_color="172B4D", end_color="172B4D", fill_type="solid")
    kpi_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    zebra_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    font_title = Font(name="Segoe UI", size=14, bold=True, color="172B4D")
    font_sub = Font(name="Segoe UI", size=9, italic=True, color="64748B")
    font_header = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
    font_data = Font(name="Segoe UI", size=9, color="0F172A")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    def sanitize(val):
        s = str(val if val is not None else "")
        if s.startswith(("=", "+", "-", "@")):
            return "'" + s
        return s

    ws["A1"] = "SRI LANKA POSTAL DEPARTMENT — DAILY ATTENDANCE REGISTER"
    ws["A1"].font = font_title
    ws["A2"] = f"Office: {data['settings'].get('office_name', 'Kaduwela Head Post Office')} | Date: {data['attendance_date']} | Timezone: Asia/Colombo"
    ws["A2"].font = font_sub

    summ = data["summary"]
    metrics = [
        ("Total Employees", summ["total_employees"]),
        ("Present Today", summ["present_today"]),
        ("On Time", summ["on_time_count"]),
        ("Late", summ["late_count"]),
        ("Half Day", summ["half_day_count"]),
        ("Absent", summ["absent_count"]),
        ("Currently In", summ["currently_checked_in"]),
        ("Attendance Rate", f"{summ['attendance_rate']}%"),
    ]
    for col_idx, (m_label, m_val) in enumerate(metrics, start=1):
        cell_lbl = ws.cell(row=4, column=col_idx, value=m_label)
        cell_lbl.font = Font(name="Segoe UI", size=8, bold=True, color="64748B")
        cell_lbl.fill = kpi_fill
        cell_lbl.alignment = Alignment(horizontal="center")
        cell_lbl.border = thin_border

        cell_val = ws.cell(row=5, column=col_idx, value=m_val)
        cell_val.font = Font(name="Segoe UI", size=10, bold=True, color="1677D2")
        cell_val.fill = kpi_fill
        cell_val.alignment = Alignment(horizontal="center")
        cell_val.border = thin_border

    headers = [
        "No.", "Employee ID", "Employee Name", "Designation", "Office / Department",
        "Check-In", "Check-Out", "Attendance Type", "Status", "GPS Verification",
        "Distance", "Working Hours", "Late Duration"
    ]
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(row=7, column=col_idx, value=h)
        c.font = font_header
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = thin_border

    current_row = 8
    for idx, r in enumerate(data["records"], start=1):
        dist_val = f"{r['distance_meters']}m" if r.get("distance_meters") is not None else "—"
        row_vals = [
            idx,
            sanitize(r.get("employee_id")),
            sanitize(r.get("employee_name")),
            sanitize(r.get("designation")),
            sanitize(r.get("department") or r.get("post_office")),
            sanitize(r.get("check_in_time")),
            sanitize(r.get("check_out_time")),
            sanitize(r.get("attendance_type")),
            sanitize(r.get("attendance_status")),
            sanitize(r.get("gps_verification")),
            dist_val,
            sanitize(r.get("working_duration_formatted")),
            sanitize(r.get("late_duration_formatted")),
        ]
        is_zebra = (idx % 2 == 0)
        for c_idx, val in enumerate(row_vals, start=1):
            c = ws.cell(row=current_row, column=c_idx, value=val)
            c.font = font_data
            c.border = thin_border
            if is_zebra:
                c.fill = zebra_fill
            if c_idx in (1, 6, 7, 8, 9, 10, 11, 12, 13):
                c.alignment = Alignment(horizontal="center")
        current_row += 1

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


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
