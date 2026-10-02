"""Postmaster review queue, flagged events and audit search (FR16)."""
from __future__ import annotations

from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from pymongo import DESCENDING

from ..db import get_db
from ..schemas import ReviewIn
from ..security import require_roles
from ..services.scan_events import review_event
from ..services.tracking_id import normalize_tracking_id
from ..timeutil import utcnow

router = APIRouter(prefix="/api/review", tags=["review"])
postmaster = require_roles("postmaster")


def _office_filter(user: dict) -> dict:
    if user["role"] == "admin":
        return {}
    return {"$or": [{"origin_office_id": user.get("office_id")}, {"destination_office_id": user.get("office_id")}]}


def _events(match_event: dict, user: dict, limit: int = 200) -> list[dict]:
    pipeline = [
        {"$match": {**_office_filter(user), "events": {"$elemMatch": match_event}}},
        {"$unwind": "$events"},
        {"$match": {f"events.{k}": v for k, v in match_event.items()}},
        {"$sort": {"events.received_at": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0, "tracking_id": "$_id", "item_status": "$status", "event": "$events",
                      "destination_office_id": 1}},
    ]
    return list(get_db().items.aggregate(pipeline))


@router.get("/held")
def held(user: dict = Depends(postmaster)):
    return _events({"review.status": "pending"}, user)


@router.get("/flagged")
def flagged(days: int = 14, user: dict = Depends(postmaster)):
    return _events({"flagged": True, "received_at": {"$gte": utcnow() - timedelta(days=days)}}, user)


@router.post("/{tracking_id}/{event_id}")
def decide(tracking_id: str, event_id: str, body: ReviewIn, user: dict = Depends(postmaster)):
    from fastapi.responses import JSONResponse
    r = review_event(get_db(), user, normalize_tracking_id(tracking_id), event_id, body.action, body.reason)
    code = r.http_status
    return JSONResponse(status_code=code, content=dict(r))


@router.get("/audit")
def audit_search(action: str = "", target: str = "", actor: str = "", severity: str = "",
                 limit: int = Query(100, le=500), user: dict = Depends(postmaster)):
    q: dict = {}
    if action:
        q["action"] = {"$regex": f"^{action}"}
    if target:
        q["target"] = normalize_tracking_id(target) if target.upper().startswith("PA-") else target
    if actor:
        q["actor"] = actor
    if severity:
        q["severity"] = severity
    rows = list(get_db().audit_log.find(q).sort("at", DESCENDING).limit(limit))
    for r in rows:
        r["_id"] = str(r["_id"]) if isinstance(r["_id"], ObjectId) else r["_id"]
    return rows
