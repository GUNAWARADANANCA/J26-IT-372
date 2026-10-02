"""Registered items: staff search/detail, labels, receipts, assignment (FR08, FR09, FR16)."""
from __future__ import annotations

import re
import secrets

from fastapi import APIRouter, Depends, Query
from pymongo import DESCENDING

from ..audit import audit
from ..db import get_db
from ..schemas import AssignIn, LabelVerifyIn, ReasonIn, RecipientPinIn
from ..security import get_current_user, require_roles
from ..services.item_views import staff_view
from ..services.labels import code128_svg, qr_svg
from ..services.scan_events import office_label, tracking_link
from ..services.tracking_id import normalize_tracking_id
from ..timeutil import local_str, utcnow
from .common import get_or_404, problem

router = APIRouter(prefix="/api/items", tags=["items"])
staff = get_current_user
postmaster = require_roles("postmaster")
counter = require_roles("counter_officer", "postmaster")


def _visible(item: dict, user: dict) -> bool:
    if user["role"] in ("admin", "hub_officer"):
        return True
    return user.get("office_id") in (item["origin_office_id"], item.get("destination_office_id"))


def _item(tracking_id: str, user: dict) -> dict:
    item = get_or_404("items", normalize_tracking_id(tracking_id), "item")
    if not _visible(item, user):
        audit(user["username"], "item.view_denied", item["_id"], severity="security")
        raise problem("NOT_AUTHORISED", "item is not handled by your office", 403)
    return item


@router.get("")
def list_items(status: str = "", q: str = "", limit: int = Query(50, le=200), user: dict = Depends(staff)):
    query: dict = {}
    if status:
        query["status"] = status
    if user["role"] not in ("admin", "hub_officer"):
        query["$or"] = [{"origin_office_id": user.get("office_id")}, {"destination_office_id": user.get("office_id")}]
    if q:
        query["_id"] = {"$regex": re.escape(normalize_tracking_id(q))}
    projection = {"events": 0, "outbox": 0, "public_access": 0, "quote": 0}
    rows = list(get_db().items.find(query, projection).sort("accepted_at", DESCENDING).limit(limit))
    for r in rows:
        r["tracking_id"] = r["_id"]
        if user["role"] == "hub_officer":  # hubs need routing data only
            r.pop("sender", None)
            r["recipient"] = {"city": r.get("recipient", {}).get("city"), "postcode": r.get("recipient", {}).get("postcode")}
    return rows


@router.get("/{tracking_id}")
def get_item(tracking_id: str, user: dict = Depends(staff)):
    return staff_view(_item(tracking_id, user))


@router.get("/{tracking_id}/label")
def label(tracking_id: str, user: dict = Depends(counter)):
    item = _item(tracking_id, user)
    db = get_db()
    link = tracking_link(item)
    return {
        "tracking_id": item["_id"],
        "code128_svg": code128_svg(item["_id"]),
        "qr_svg": qr_svg(item["_id"]),
        "receipt_qr_svg": qr_svg(link),
        "tracking_link": link,
        "origin_office": office_label(db, item["origin_office_id"]),
        "destination_office": office_label(db, item.get("destination_office_id")),
        "accepted_local": local_str(item["accepted_at"]),
        "accepted_by": item["accepted_by"],
        "recipient": {k: item["recipient"].get(k, "") for k in ("name", "house_number", "street", "locality", "city", "postcode")},
        "sender_name": item["sender"].get("name", ""),
        "weight": item["weight"], "quote": item["quote"], "payment": item["payment"],
        "tariff_version": item["tariff_version"], "label": item["label"],
    }


@router.post("/{tracking_id}/label/printed")
def label_printed(tracking_id: str, body: ReasonIn | None = None, user: dict = Depends(counter)):
    """First print, or a reprint (reason required). A reprint never creates a new item (T06)."""
    item = _item(tracking_id, user)
    now = utcnow()
    if item["label"]["prints"] == 0:
        update = {"$inc": {"label.prints": 1}, "$set": {"label.first_printed_at": now}}
    else:
        if body is None:
            raise problem("REASON_REQUIRED", "a reprint needs a reason", 422)
        update = {"$inc": {"label.prints": 1}, "$push": {"label.reprints": {"at": now, "by": user["username"],
                                                                             "reason": body.reason}}}
    get_db().items.update_one({"_id": item["_id"]}, update)
    audit(user["username"], "label.printed" if item["label"]["prints"] == 0 else "label.reprinted", item["_id"],
          {"reason": body.reason if body else None})
    return {"prints": item["label"]["prints"] + 1}


@router.post("/{tracking_id}/label/verify")
def verify_label(tracking_id: str, body: LabelVerifyIn, user: dict = Depends(counter)):
    """Officer scans the printed label before the item goes to the dispatch tray (FR09)."""
    item = _item(tracking_id, user)
    scanned = normalize_tracking_id(body.scanned_value)
    ok = scanned == item["_id"]
    now = utcnow()
    get_db().items.update_one({"_id": item["_id"]}, {"$push": {"label.verifications": {"at": now, "ok": ok,
                                                                                         "by": user["username"]}},
                                                       **({"$set": {"label.verified_at": now,
                                                                    "intake.timings.label_verified_at": now}} if ok else {})})
    if not ok:
        raise problem("LABEL_MISMATCH", f"scanned '{scanned}' but this item is {item['_id']}; reprint the label", 422)
    return {"ok": True, "verified_at": now}


@router.post("/{tracking_id}/assign")
def assign(tracking_id: str, body: AssignIn, user: dict = Depends(postmaster)):
    item = _item(tracking_id, user)
    postman = get_db().users.find_one({"username": body.postman_username, "role": "postman"})
    if not postman or postman.get("office_id") != item.get("destination_office_id"):
        raise problem("BAD_POSTMAN", "postman not found at the destination office", 422)
    get_db().items.update_one({"_id": item["_id"]}, {"$set": {"assigned_postman": postman["username"]}})
    audit(user["username"], "item.assigned", item["_id"], {"postman": postman["username"]})
    return {"assigned_postman": postman["username"]}


@router.post("/{tracking_id}/recipient-pin")
def recipient_pin(tracking_id: str, body: RecipientPinIn, user: dict = Depends(postmaster)):
    """Optional confirmed recipient location (FR17). Provenance is mandatory; a town
    centroid or postcode centre must not be entered here."""
    item = _item(tracking_id, user)
    pin = {**body.model_dump(), "set_by": user["username"], "set_at": utcnow()}
    get_db().items.update_one({"_id": item["_id"]}, {"$set": {"recipient_pin": pin}})
    audit(user["username"], "item.recipient_pin", item["_id"], {"provenance": body.provenance})
    return pin


@router.post("/{tracking_id}/rotate-link")
def rotate_link(tracking_id: str, user: dict = Depends(postmaster)):
    item = _item(tracking_id, user)
    token = secrets.token_urlsafe(16)
    get_db().items.update_one({"_id": item["_id"]}, {"$set": {"public_access": {"token": token, "created_at": utcnow()}}})
    audit(user["username"], "item.link_rotated", item["_id"], severity="warning")
    item["public_access"] = {"token": token}
    return {"tracking_link": tracking_link(item)}
