"""Device-facing endpoints used by the ESP32-CAM scale firmware (iot/postassist_scale_cam).

Authentication: ``X-Device-Id`` and ``X-Device-Key`` headers on every request.

POST /api/iot/readings                 every ~0.5-1 s; response carries queued commands
POST /api/iot/captures/{capture_id}    raw JPEG body after a 'capture' command
POST /api/iot/commands/{cmd_id}/result acknowledgement of tare / calibrate / capture
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from pymongo import ASCENDING

from ..audit import audit
from ..db import get_db
from ..schemas import CommandResultIn, ReadingIn
from ..security import get_device
from ..services.images import store_image
from ..timeutil import utcnow
from .common import problem

router = APIRouter(prefix="/api/iot", tags=["iot (device)"])
MAX_JPEG = 2 * 1024 * 1024
LOG_IDLE_EVERY = timedelta(seconds=30)
COMMAND_TTL = timedelta(seconds=60)


@router.post("/readings")
def post_reading(body: ReadingIn, request: Request, device: dict = Depends(get_device)):
    db = get_db()
    now = utcnow()
    reading = body.model_dump()
    reading["received_at"] = now
    if reading.get("net_g") is not None:
        reading["net_g"] = round(reading["net_g"], 2)
    previous = device.get("latest_reading") or {}
    changed = any(previous.get(k) != reading.get(k)
                  for k in ("stable", "loaded", "placement_id", "boot_id", "sensor_ok", "needs_tare"))
    if reading["loaded"] or changed or now - previous.get("received_at", now - LOG_IDLE_EVERY) >= LOG_IDLE_EVERY:
        db.device_readings.insert_one({"device_id": device["_id"], **reading})

    sets = {"latest_reading": reading, "last_seen": now, "ip": body.ip or (request.client.host if request.client else ""),
            "firmware": body.fw, "rssi": body.rssi, "boot_id": body.boot_id, "camera_ok": body.camera_ok}
    cal = device.get("calibration") or {}
    if body.calibration_id and cal.get("calibration_id") != body.calibration_id:
        # The device holds its own calibration (NVS). A new calibration invalidates the
        # previous expanded uncertainty until new reference-mass trials are recorded.
        sets["calibration"] = {"status": "calibrated", "calibration_id": body.calibration_id, "reported_at": now,
                               "expanded_uncertainty_g": None}
    elif not body.calibration_id and cal.get("calibration_id"):
        # The device says it holds no calibration (new or replaced hardware): do not keep showing the old one.
        sets["calibration"] = {"status": "uncalibrated", "previous_calibration_id": cal["calibration_id"],
                               "reported_at": now}
    db.devices.update_one({"_id": device["_id"]}, {"$set": sets})

    db.device_commands.update_many({"device_id": device["_id"], "status": "queued", "created_at": {"$lt": now - COMMAND_TTL}},
                                   {"$set": {"status": "expired"}})
    commands = []
    for cmd in db.device_commands.find({"device_id": device["_id"], "status": "queued"}).sort("created_at", ASCENDING).limit(3):
        db.device_commands.update_one({"_id": cmd["_id"], "status": "queued"}, {"$set": {"status": "sent", "sent_at": now}})
        commands.append({"id": cmd["_id"], "type": cmd["type"], "params": cmd.get("params", {})})
    return {"server_time": now.isoformat(), "commands": commands}


@router.post("/captures/{capture_id}")
async def post_capture(capture_id: str, request: Request, device: dict = Depends(get_device)):
    db = get_db()
    cap = db.captures.find_one({"_id": capture_id, "device_id": device["_id"]})
    if cap is None:
        raise problem("UNKNOWN_CAPTURE", "no such capture request for this device", 404)
    if cap["status"] != "requested":
        raise problem("CAPTURE_CLOSED", f"capture is {cap['status']}")
    data = await request.body()
    if not data or len(data) > MAX_JPEG:
        raise problem("BAD_IMAGE", "empty or too large JPEG", 413)
    draft_id = cap.get("draft_id")
    if draft_id:
        draft = db.drafts.find_one({"_id": draft_id}, {"status": 1})
        if not draft or draft["status"] != "draft":
            draft_id = None
    try:
        doc = store_image(data, office_id=device["office_id"], draft_id=draft_id, source=f"device:{device['_id']}",
                          actor=device["_id"])
    except ValueError as exc:
        db.captures.update_one({"_id": capture_id}, {"$set": {"status": "failed", "error": str(exc)}})
        raise problem("BAD_IMAGE", str(exc), 422) from None
    db.captures.update_one({"_id": capture_id}, {"$set": {"status": "received", "image_id": doc["_id"],
                                                          "received_at": utcnow(), "bytes": len(data)}})
    return {"ok": True, "image_id": doc["_id"], "quality_ok": doc["quality"]["ok"]}


@router.post("/commands/{cmd_id}/result")
def command_result(cmd_id: str, body: CommandResultIn, device: dict = Depends(get_device)):
    db = get_db()
    cmd = db.device_commands.find_one({"_id": cmd_id, "device_id": device["_id"]})
    if cmd is None:
        raise problem("UNKNOWN_COMMAND", "no such command", 404)
    now = utcnow()
    db.device_commands.update_one({"_id": cmd_id}, {"$set": {"status": body.status, "result": body.result, "done_at": now}})
    if cmd["type"] == "calibrate" and body.status == "done":
        db.devices.update_one({"_id": device["_id"]}, {"$set": {"calibration": {
            "status": "calibrated", "calibration_id": body.result.get("calibration_id"),
            "factor": body.result.get("factor"), "reference_g": cmd.get("params", {}).get("known_g"),
            "calibrated_at": now, "calibrated_by": cmd.get("created_by"), "expanded_uncertainty_g": None}}})
    if cmd["type"] == "capture" and body.status == "failed":
        db.captures.update_one({"_id": cmd.get("params", {}).get("capture_id"), "status": "requested"},
                               {"$set": {"status": "failed", "error": str(body.result.get("error", "capture failed"))}})
    audit(device["_id"], f"device.{cmd['type']}.{body.status}", device["_id"], {"command": cmd_id, "result": body.result})
    return {"ok": True}
