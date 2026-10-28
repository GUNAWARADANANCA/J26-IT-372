"""Notification outbox dashboard: failures, ambiguous outcomes, retries (FR14, FR16)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..audit import audit
from ..db import get_db
from ..schemas import ReasonIn
from ..security import require_roles
from ..services.notifications.templates import render
from ..services.tracking_id import normalize_tracking_id
from ..timeutil import utcnow
from .common import problem

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
postmaster = require_roles("postmaster", "counter_officer")


@router.get("")
def list_entries(status: str = "", user: dict = Depends(postmaster)):
    match: dict = {}
    if status:
        match["outbox.status"] = status
    office = {} if user["role"] == "admin" else {"$or": [{"origin_office_id": user.get("office_id")},
                                                          {"destination_office_id": user.get("office_id")}]}
    pipeline = [{"$match": {**office, "outbox.0": {"$exists": True}}}, {"$unwind": "$outbox"}]
    if match:
        pipeline.append({"$match": match})
    pipeline += [{"$sort": {"outbox.created_at": -1}}, {"$limit": 300},
                 {"$project": {"_id": 0, "tracking_id": "$_id", "entry": "$outbox"}}]
    rows = list(get_db().items.aggregate(pipeline))
    for r in rows:
        r["entry"].pop("variables", None)
    counts = {}
    for r in rows:
        counts[r["entry"]["status"]] = counts.get(r["entry"]["status"], 0) + 1
    return {"counts": counts, "entries": rows}


def _entry(tracking_id: str, key: str) -> tuple[dict, dict]:
    item = get_db().items.find_one({"_id": normalize_tracking_id(tracking_id), "outbox.key": key})
    if not item:
        raise problem("NOT_FOUND", "notification not found", 404)
    return item, next(e for e in item["outbox"] if e["key"] == key)


@router.get("/{tracking_id}/{key}/preview")
def preview(tracking_id: str, key: str, user: dict = Depends(postmaster)):
    _, entry = _entry(tracking_id, key)
    subject, body = render(entry["language"], entry["status_code"], entry["variables"])
    return {"to": entry["to"], "channel": entry["channel"], "subject": subject, "body": body,
            "template_version": entry["template_version"]}


@router.post("/{tracking_id}/{key}/retry")
def retry(tracking_id: str, key: str, body: ReasonIn, user: dict = Depends(postmaster)):
    item, entry = _entry(tracking_id, key)
    if entry["status"] not in ("failed_permanent", "ambiguous"):
        raise problem("NOT_RETRYABLE", f"entry is {entry['status']}")
    now = utcnow()
    get_db().items.update_one({"_id": item["_id"], "outbox": {"$elemMatch": {"key": key, "status": entry["status"]}}},
                              {"$set": {"outbox.$.status": "retry", "outbox.$.next_attempt_at": now, "outbox.$.attempts": 0},
                               "$push": {"outbox.$.history": {"at": now, "outcome": "manual_retry",
                                                               "detail": f"{user['username']}: {body.reason}"}}})
    audit(user["username"], "notification.retry", item["_id"], {"key": key, "reason": body.reason})
    return {"ok": True}


@router.post("/{tracking_id}/{key}/resolve")
def resolve(tracking_id: str, key: str, body: ReasonIn, user: dict = Depends(postmaster)):
    item, entry = _entry(tracking_id, key)
    if entry["status"] in ("provider_accepted", "resolved_manually"):
        raise problem("ALREADY_DONE", f"entry is {entry['status']}")
    now = utcnow()
    get_db().items.update_one({"_id": item["_id"], "outbox": {"$elemMatch": {"key": key, "status": entry["status"]}}},
                              {"$set": {"outbox.$.status": "resolved_manually"},
                               "$push": {"outbox.$.history": {"at": now, "outcome": "resolved_manually",
                                                               "detail": f"{user['username']}: {body.reason}"}}})
    audit(user["username"], "notification.resolved", item["_id"], {"key": key, "reason": body.reason})
    return {"ok": True}
