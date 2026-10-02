"""Staff view of IoT devices: live reading, tare/calibrate/capture commands and
reference-mass trials for the weighing experiment (proposal 3.9, SO2)."""
from __future__ import annotations

import csv
import io
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pymongo import ASCENDING, DESCENDING

from ..audit import audit
from ..config import get_settings
from ..db import get_db
from ..schemas import CalibrationUncertaintyIn, DeviceCommandIn, DeviceCreateIn, TrialIn
from ..security import hash_secret, require_roles
from ..services.weighing import reading_problems
from ..timeutil import utcnow
from .common import get_or_404, problem, same_office

router = APIRouter(prefix="/api/devices", tags=["devices"])
staff = require_roles("counter_officer", "postmaster")
admin = require_roles()  # admin only
supervisor = require_roles("postmaster")


def _device_view(d: dict) -> dict:
    s = get_settings()
    now = utcnow()
    last = d.get("last_seen")
    reading = d.get("latest_reading")
    return {"device_id": d["_id"], "type": d.get("type"), "description": d.get("description"),
            "office_id": d.get("office_id"), "active": d.get("active", True), "ip": d.get("ip"),
            "firmware": d.get("firmware"), "rssi": d.get("rssi"), "camera_ok": d.get("camera_ok"),
            "last_seen": last, "online": bool(last and (now - last).total_seconds() <= s.device_offline_after_s),
            "calibration": d.get("calibration"), "latest_reading": reading,
            "pairing_problems": reading_problems(d, reading, now, s)}


@router.get("")
def list_devices(user: dict = Depends(staff)):
    q = {} if user["role"] == "admin" else {"office_id": user.get("office_id")}
    return [_device_view(d) for d in get_db().devices.find(q)]


@router.post("")
def create_device(body: DeviceCreateIn, user: dict = Depends(admin)):
    key = secrets.token_urlsafe(24)
    get_or_404("offices", body.office_id, "office")
    if get_db().devices.find_one({"_id": body.device_id}):
        raise problem("EXISTS", "device id already registered")
    get_db().devices.insert_one({"_id": body.device_id, "type": "scale_camera", "description": body.description,
                                 "office_id": body.office_id, "key_hash": hash_secret(key), "active": True,
                                 "created_at": utcnow(), "calibration": {"status": "uncalibrated"}})
    audit(user["username"], "device.created", body.device_id, {"office": body.office_id})
    return {"device_id": body.device_id, "device_key": key, "note": "store the key now; it is not shown again"}


@router.post("/{device_id}/rotate-key")
def rotate_key(device_id: str, user: dict = Depends(admin)):
    get_or_404("devices", device_id, "device")
    key = secrets.token_urlsafe(24)
    get_db().devices.update_one({"_id": device_id}, {"$set": {"key_hash": hash_secret(key)}})
    audit(user["username"], "device.key_rotated", device_id, severity="warning")
    return {"device_id": device_id, "device_key": key}


@router.get("/{device_id}/live")
def live(device_id: str, user: dict = Depends(staff)):
    d = get_or_404("devices", device_id, "device")
    same_office(user, d["office_id"])
    view = _device_view(d)
    view["recent_commands"] = list(get_db().device_commands.find({"device_id": device_id}, {"params": 1, "type": 1,
                                   "status": 1, "result": 1, "created_at": 1}).sort("created_at", DESCENDING).limit(5))
    return view


@router.get("/{device_id}/readings")
def readings(device_id: str, minutes: int = Query(5, le=180), user: dict = Depends(staff)):
    d = get_or_404("devices", device_id, "device")
    same_office(user, d["office_id"])
    since = utcnow() - timedelta(minutes=minutes)
    return list(get_db().device_readings.find({"device_id": device_id, "received_at": {"$gte": since}},
                                              {"_id": 0, "net_g": 1, "spread_g": 1, "stable": 1, "loaded": 1,
                                               "placement_id": 1, "received_at": 1}).sort("received_at", ASCENDING))


@router.post("/{device_id}/commands")
def send_command(device_id: str, body: DeviceCommandIn, user: dict = Depends(staff)):
    d = get_or_404("devices", device_id, "device")
    same_office(user, d["office_id"])
    params = dict(body.params)
    if body.type == "calibrate":
        known = float(params.get("known_g") or 0)
        if not 10 <= known <= 1000:
            raise problem("BAD_REFERENCE", "known_g must be a reference mass between 10 g and 1000 g", 422)
        params = {"known_g": known}
    if body.type == "capture":
        capture_id = "CAP-" + secrets.token_hex(6).upper()
        get_db().captures.insert_one({"_id": capture_id, "device_id": device_id, "draft_id": None,
                                      "status": "requested", "requested_at": utcnow(), "requested_by": user["username"]})
        params = {"capture_id": capture_id, "flash": bool(params.get("flash"))}
    cmd = {"_id": "CMD-" + secrets.token_hex(6).upper(), "device_id": device_id, "type": body.type, "params": params,
           "status": "queued", "created_at": utcnow(), "created_by": user["username"]}
    get_db().device_commands.insert_one(cmd)
    audit(user["username"], f"device.command.{body.type}", device_id, {"params": params})
    return cmd


@router.post("/{device_id}/trials")
def record_trial(device_id: str, body: TrialIn, user: dict = Depends(staff)):
    """Record the current stable reading against a reference mass (10 masses x 10 repeats protocol)."""
    d = get_or_404("devices", device_id, "device")
    same_office(user, d["office_id"])
    reading = d.get("latest_reading")
    problems = [p for p in reading_problems(d, reading, utcnow(), get_settings()) if p["code"] != "UNCALIBRATED"]
    if problems:
        raise problem("WEIGHT_NOT_READY", problems[0]["message"], problems=problems)
    trial = {"device_id": device_id, "calibration_id": reading.get("calibration_id"), "reference_g": body.reference_g,
             "reading_g": reading["net_g"], "error_g": round(reading["net_g"] - body.reference_g, 2),
             "spread_g": reading.get("spread_g"), "placement_id": reading.get("placement_id"),
             "condition": body.condition, "note": body.note, "created_at": utcnow(), "by": user["username"]}
    get_db().weighing_trials.insert_one(trial)
    trial.pop("_id", None)
    return trial


@router.get("/{device_id}/trials")
def list_trials(device_id: str, user: dict = Depends(staff)):
    return list(get_db().weighing_trials.find({"device_id": device_id}, {"_id": 0}).sort("created_at", ASCENDING))


@router.get("/{device_id}/trials.csv")
def trials_csv(device_id: str, user: dict = Depends(staff)):
    rows = list_trials(device_id, user)
    buf = io.StringIO()
    fields = ["created_at", "calibration_id", "reference_g", "reading_g", "error_g", "spread_g", "placement_id",
              "condition", "note", "by"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={device_id}_weighing_trials.csv"})


@router.post("/{device_id}/uncertainty")
def set_uncertainty(device_id: str, body: CalibrationUncertaintyIn, user: dict = Depends(supervisor)):
    """Store the expanded uncertainty computed by ml/evaluation/weighing_analysis.py."""
    d = get_or_404("devices", device_id, "device")
    same_office(user, d["office_id"])
    if not (d.get("calibration") or {}).get("calibration_id"):
        raise problem("UNCALIBRATED", "calibrate the scale before setting its uncertainty", 422)
    get_db().devices.update_one({"_id": device_id}, {"$set": {
        "calibration.expanded_uncertainty_g": body.expanded_uncertainty_g, "calibration.uncertainty_evidence": body.evidence,
        "calibration.uncertainty_set_by": user["username"], "calibration.uncertainty_set_at": utcnow()}})
    audit(user["username"], "device.uncertainty_set", device_id, body.model_dump())
    return {"ok": True}
