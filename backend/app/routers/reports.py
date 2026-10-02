"""CSV exports for the evaluation chapter (proposal 3.5, 3.12).

They contain identifiers, timings, decisions and metrics - not names or
addresses - so they can be analysed outside the system (NFR06).
"""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..db import get_db
from ..security import require_roles

router = APIRouter(prefix="/api/reports", tags=["reports"])
supervisor = require_roles("postmaster")


def _csv(rows: list[dict], fields: list[str], name: str) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={name}"})


def _secs(a, b):
    return round((b - a).total_seconds(), 1) if a and b else ""


@router.get("/intake.csv")
def intake_csv(user: dict = Depends(supervisor)):
    rows = []
    for d in get_db().drafts.find({"status": "committed"}):
        t = d.get("timings", {})
        stats = d.get("review_stats") or {}
        last_ocr = (d.get("ocr_runs") or [{}])[-1]
        rows.append({
            "draft_id": d["_id"], "item_id": d.get("item_id"), "office_id": d["office_id"], "officer": d["created_by"],
            "config": d.get("experiment_config"), "ocr_mode": last_ocr.get("mode"),
            "script": (last_ocr.get("script") or {}).get("script"),
            "image_to_confirmed_s": _secs(t.get("first_image_at"), t.get("fields_confirmed_at")),
            "start_to_accept_s": _secs(t.get("started_at"), t.get("accepted_at")),
            "suggested_fields": stats.get("suggested"), "accepted_unchanged": stats.get("accepted_unchanged"),
            "corrected": stats.get("corrected"), "added_manually": stats.get("added_manually"), "removed": stats.get("removed"),
            "weight_source": (d.get("weight") or {}).get("source"), "weight_g": (d.get("weight") or {}).get("grams"),
            "quote_total": (d.get("quote") or {}).get("total_lkr"), "tariff": (d.get("quote") or {}).get("tariff_version"),
        })
    fields = list(rows[0].keys()) if rows else ["draft_id"]
    return _csv(rows, fields, "intake_tasks.csv")


@router.get("/events.csv")
def events_csv(user: dict = Depends(supervisor)):
    rows = []
    for item in get_db().items.find({}, {"events": 1}):
        for e in item["events"]:
            a = e.get("assessment") or {}
            loc = e.get("location") or {}
            rows.append({
                "tracking_id": item["_id"], "event_id": e["event_id"], "status": e["requested_status"],
                "decision": e["decision"], "applied": e.get("applied_to_state"), "late": e.get("late"),
                "flagged": e.get("flagged"), "policy_version": e.get("policy_version"), "mode": a.get("mode"),
                "location_result": a.get("result"), "p_inside": a.get("p_inside"), "distance_m": a.get("distance_m"),
                "accuracy_m": loc.get("accuracy_m"), "fix_age_s": loc.get("fix_age_s"), "mock": loc.get("mock"),
                "offline": e.get("offline"), "sync_delay_s": e.get("sync_delay_s"), "worker_role": e.get("worker_role"),
                "captured_at": e["captured_at"].isoformat(), "received_at": e["received_at"].isoformat(),
                "review": (e.get("review") or {}).get("status"),
            })
    fields = list(rows[0].keys()) if rows else ["tracking_id"]
    return _csv(rows, fields, "scan_events.csv")


@router.get("/notifications.csv")
def notifications_csv(user: dict = Depends(supervisor)):
    rows = []
    for item in get_db().items.find({"outbox.0": {"$exists": True}}, {"outbox": 1, "events": 1}):
        committed = {e["event_id"]: e["received_at"] for e in item["events"]}
        for o in item["outbox"]:
            rows.append({"tracking_id": item["_id"], "event_id": o["event_id"], "status_code": o["status_code"],
                         "channel": o["channel"], "language": o["language"], "status": o["status"],
                         "attempts": o["attempts"], "adapter": o.get("adapter"),
                         "commit_to_provider_s": _secs(committed.get(o["event_id"]), o.get("accepted_at")),
                         "template_version": o["template_version"]})
    fields = list(rows[0].keys()) if rows else ["tracking_id"]
    return _csv(rows, fields, "notifications.csv")


@router.get("/summary")
def summary(user: dict = Depends(supervisor)):
    db = get_db()
    by_status = {r["_id"]: r["n"] for r in db.items.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    held = next(db.items.aggregate([{"$unwind": "$events"}, {"$match": {"events.review.status": "pending"}},
                                    {"$count": "n"}]), {"n": 0})["n"]
    outbox = {r["_id"]: r["n"] for r in db.items.aggregate([{"$unwind": "$outbox"},
                                                             {"$group": {"_id": "$outbox.status", "n": {"$sum": 1}}}])}
    return {"items_by_status": by_status, "held_events": held, "outbox_by_status": outbox,
            "open_drafts": db.drafts.count_documents({"status": "draft"})}
