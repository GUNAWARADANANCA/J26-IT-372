"""Office location check and attendance time-in / time-out."""

from datetime import datetime
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException

from db import get_db

DEFAULT_SETTINGS = {
    "_id": "attendance",
    "latitude": 6.933586,
    "longitude": 79.983529,
    "radius_meters": 150,
}


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth = 6_371_000
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * earth * asin(sqrt(a))


def get_settings() -> dict:
    collection = get_db()["settings"]
    current = collection.find_one({"_id": "attendance"})
    if current is None:
        collection.insert_one(dict(DEFAULT_SETTINGS))
        current = dict(DEFAULT_SETTINGS)
    return {
        "latitude": float(current["latitude"]),
        "longitude": float(current["longitude"]),
        "radius_meters": int(current["radius_meters"]),
    }


def save_settings(latitude: float, longitude: float, radius_meters: int) -> dict:
    if not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
    if not 20 <= radius_meters <= 1000:
        raise HTTPException(status_code=400, detail="Radius must be between 20 and 1000 meters")
    stored = {
        "_id": "attendance",
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
    }
    get_db()["settings"].replace_one({"_id": "attendance"}, stored, upsert=True)
    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
    }


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

    position = {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
    }

    if current is None:
        doc = {
            "_id": name,
            "name": name,
            "employee_id": employee_id,
            "employee_name": employee.get("employee_name") or "",
            "post_office": employee.get("post_office") or "",
            "designation": employee.get("designation") or "",
            "date": today,
            "fingerprint_in": clock,
            "fingerprint_out": None,
            **position,
        }
        logs.insert_one(doc)
        action = "in"
    elif not current.get("fingerprint_out"):
        logs.update_one(
            {"_id": name},
            {"$set": {"fingerprint_out": clock, **position}},
        )
        action = "out"
    else:
        raise HTTPException(
            status_code=409,
            detail="Attendance for today is already complete.",
        )

    return {
        "action": action,
        "time": clock,
        "date": today,
        "employee_name": employee.get("employee_name") or "",
        "distance_meters": location["distance_meters"],
    }
