"""Sender tracking page API (FR15).

The tracking link is ``/track/<ID>#t=<token>``. The token sits in the URL
*fragment*, which browsers never send to servers, so it does not appear in
access logs; the page sends it in the ``X-Tracking-Token`` header. A wrong
token and an unknown ID return the same 404, so identifiers cannot be
enumerated by changing the URL (test T16).
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, Request

from ..audit import audit
from ..db import get_db
from ..services.item_views import public_timeline
from ..services.tracking_id import normalize_tracking_id
from .common import problem

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/track/{tracking_id}")
def track(tracking_id: str, request: Request, x_tracking_token: str = Header(default="")):
    tid = normalize_tracking_id(tracking_id)
    db = get_db()
    item = db.items.find_one({"_id": tid})
    token = ((item or {}).get("public_access") or {}).get("token", "")
    if not item or not x_tracking_token or not hmac.compare_digest(token, x_tracking_token):
        audit("public", "track.denied", tid, {"client": request.client.host if request.client else None},
              severity="security" if item else "info")
        raise problem("NOT_FOUND", "no tracking record for this link", 404)
    offices = {o["_id"]: o["name"] for o in db.offices.find({}, {"name": 1})}
    return public_timeline(item, offices)
