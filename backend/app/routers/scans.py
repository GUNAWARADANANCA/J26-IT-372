"""Field scan events from the postman/hub app (FR10-FR13)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..db import get_db
from ..schemas import ScanBatchIn, ScanIn
from ..security import get_current_user, require_roles
from ..services import state_machine as sm
from ..services.scan_events import active_policy, authorize, ingest_scan, office_label
from ..services.tracking_id import is_valid_tracking_id, normalize_tracking_id
from .common import problem

router = APIRouter(prefix="/api/scans", tags=["scans"])
field_roles = require_roles("postman", "hub_officer", "counter_officer", "postmaster")


@router.post("")
def scan(body: ScanIn, user: dict = Depends(field_roles)):
    result = ingest_scan(get_db(), user, body)
    code = result.http_status
    return JSONResponse(status_code=code, content=_jsonable(result))


@router.post("/batch")
def scan_batch(body: ScanBatchIn, user: dict = Depends(field_roles)):
    """Offline queue upload. Events are processed in capture order; every event gets
    its own durable answer, and the client removes an event only after receiving it."""
    results = []
    db = get_db()
    for ev in sorted(body.events, key=lambda e: e.captured_at):
        r = ingest_scan(db, user, ev)
        code = r.http_status
        results.append({"event_id": ev.event_id, "http_status": code, **_jsonable(r)})
    return {"results": results}


@router.get("/lookup/{tracking_id}")
def lookup(tracking_id: str, user: dict = Depends(get_current_user)):
    """What the scanning worker needs to know - and nothing more (minimal PII)."""
    tid = normalize_tracking_id(tracking_id)
    db = get_db()
    item = db.items.find_one({"_id": tid}, {"events": 0, "outbox": 0, "public_access": 0, "quote": 0, "payment": 0})
    if item is None:
        raise problem("UNKNOWN_ITEM", "no registered item with this identifier" +
                      ("" if is_valid_tracking_id(tid) else " (the check character does not match - rescan)"), 404)
    candidates = sm.allowed_next(item["status"], item.get("direction", "forward"))
    allowed = sorted(s for s in candidates if authorize(user, item, s) is None)
    view = {
        "tracking_id": tid, "status": item["status"], "status_label": sm.LABELS[item["status"]],
        "revision": item["revision"], "direction": item.get("direction", "forward"),
        "destination_office": office_label(db, item.get("destination_office_id")),
        "assigned_postman": item.get("assigned_postman"),
        "allowed_statuses": [{"status": s, "label": sm.LABELS[s]} for s in allowed],
        "requires_acknowledgement": active_policy(db).get("delivered_requires_acknowledgement", True),
        "destination_town": item.get("recipient", {}).get("city"),
    }
    # Only the assigned / eligible postman sees the delivery address and name.
    if user["role"] == "postman" and user.get("office_id") == item.get("destination_office_id"):
        view["recipient"] = {k: item["recipient"].get(k, "") for k in
                             ("name", "house_number", "street", "locality", "city", "postcode")}
    return view


@router.get("/statuses")
def statuses(user: dict = Depends(get_current_user)):
    return {"statuses": [{"status": s, "label": sm.LABELS[s]} for s in sorted(sm.ROLE_STATUSES.get(user["role"], set()))]}


def _jsonable(d: dict) -> dict:
    import json
    from fastapi.encoders import jsonable_encoder
    return json.loads(json.dumps(jsonable_encoder(dict(d))))
