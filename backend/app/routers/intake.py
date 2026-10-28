"""Counter acceptance workflow (proposal section 4.4, FR02-FR08).

draft -> envelope image (upload or ESP32-CAM) -> OCR / parse suggestions ->
officer confirms fields -> pair fresh scale reading -> versioned quote ->
payment recorded -> one accepted item + label (idempotent).
"""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from ..audit import audit
from ..config import get_settings
from ..db import get_db
from ..schemas import (AcceptIn, CaptureIn, ConfirmFieldsIn, DraftUpdate, ManualWeightIn, NormalizeIn, OcrIn,
                       PairWeightIn, ParseIn, QuoteIn)
from ..security import require_roles
from ..services import state_machine as sm
from ..services.address.lexicon import check_city_postcode
from ..services.address.normalizer import normalize_address
from ..services.address.parser import FIELDS, model_info, parse_address
from ..services.item_views import staff_view
from ..services.notifications.outbox import build_entries
from ..services.images import store_image
from ..services.ocr.htr import get_recognizer
from ..services.ocr.pipeline import OcrUnavailable, run_ocr, tesseract_info
from ..services.ocr.script_id import get_script_identifier
from ..services.scan_events import office_label, tracking_link
from ..services.tariff import TariffError, compute_quote, select_tariff
from ..services.tracking_id import new_tracking_id
from ..services.weighing import placement_key, reading_problems, uncertainty_for
from ..timeutil import SRI_LANKA, utcnow
from .common import get_or_404, not_found, problem, same_office

router = APIRouter(prefix="/api/intake", tags=["intake"])
counter = require_roles("counter_officer", "postmaster")

QUOTE_TTL = timedelta(minutes=10)
MAX_IMAGE_BYTES = 8 * 1024 * 1024
PARTIES = ("sender", "recipient")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^(\+94|0)7\d{8}$")


# --------------------------------------------------------------------------- helpers
def _open_draft(draft_id: str, user: dict) -> dict:
    draft = get_or_404("drafts", draft_id, "draft")
    same_office(user, draft["office_id"])
    if draft["status"] != "draft":
        raise problem("DRAFT_CLOSED", f"draft is {draft['status']}", item_id=draft.get("item_id"))
    return draft


def _canon(v: str) -> str:
    return " ".join((v or "").replace(",", " ").split()).lower()


def contact_problems(n: dict | None) -> list[str]:
    if not n or n.get("channel", "none") == "none":
        return []
    contact = re.sub(r"[\s-]", "", n.get("contact", ""))
    if n["channel"] == "email" and not EMAIL_RE.match(contact):
        return ["notification e-mail address is not valid"]
    if n["channel"] == "sms" and not PHONE_RE.match(contact):
        return ["notification phone number must be a Sri Lankan mobile number (07XXXXXXXX or +947XXXXXXXX)"]
    return []


def required_problems(draft: dict) -> list[str]:
    problems = []
    for party in PARTIES:
        p = draft.get(party) or {}
        for f in ("name", "city"):
            if not (p.get(f) or "").strip():
                problems.append(f"{party} {f} is required")
        if not any((p.get(f) or "").strip() for f in ("house_number", "street", "locality")):
            problems.append(f"{party} needs at least a house number, street or locality")
    problems += contact_problems(draft.get("notification"))
    if not draft.get("destination_office_id"):
        problems.append("destination office is required")
    return problems


def suggest_offices(postcode: str, city: str) -> list[dict]:
    db = get_db()
    out = []
    if postcode:
        out += list(db.offices.find({"postcode": postcode.strip()}, {"name": 1, "postcode": 1, "city": 1}))
    if city and not out:
        out += list(db.offices.find({"city": {"$regex": f"^{re.escape(city.strip())}", "$options": "i"}},
                                    {"name": 1, "postcode": 1, "city": 1}))
    return out


def review_stats(draft: dict) -> tuple[list[dict], dict]:
    """Compare OCR/parse suggestions with the officer-confirmed values."""
    corrections, stats = [], {"suggested": 0, "accepted_unchanged": 0, "corrected": 0, "added_manually": 0, "removed": 0}
    for party in PARTIES:
        suggestion = ((draft.get("suggestions") or {}).get(party) or {}).get("fields") or {}
        final = draft.get(party) or {}
        for f in FIELDS:
            s, v = _canon(suggestion.get(f, "")), _canon(final.get(f, ""))
            if s:
                stats["suggested"] += 1
            if s and s == v:
                stats["accepted_unchanged"] += 1
            elif s and v:
                stats["corrected"] += 1
                corrections.append({"party": party, "field": f, "suggested": suggestion.get(f), "final": final.get(f)})
            elif s and not v:
                stats["removed"] += 1
                corrections.append({"party": party, "field": f, "suggested": suggestion.get(f), "final": ""})
            elif v:
                stats["added_manually"] += 1
    return corrections, stats


# --------------------------------------------------------------------------- capabilities
@router.get("/capabilities")
def capabilities(user: dict = Depends(counter)):
    s = get_settings()
    ident = get_script_identifier()
    reader = get_recognizer()
    return {"ocr": tesseract_info(), "address_model": model_info(),
            "script_model": {"available": ident is not None, **({"meta": ident.meta} if ident else {})},
            "handwriting_model": {"available": reader is not None, **({"trained_at": reader.meta.get("trained_at"),
                                  "training_data": reader.meta.get("training_data"), "test": reader.meta.get("test")} if reader else {})},
            "llm": {"provider": s.llm_provider, "model": s.ollama_model if s.llm_provider == "ollama" else None},
            "weight_range_g": [s.weight_min_g, s.weight_max_g]}


# --------------------------------------------------------------------------- drafts
@router.post("/drafts", status_code=status.HTTP_201_CREATED)
def create_draft(user: dict = Depends(counter)):
    now = utcnow()
    draft = {"_id": "D-" + secrets.token_hex(5).upper(), "status": "draft", "office_id": user["office_id"],
             "created_by": user["username"], "created_at": now, "updated_at": now, "experiment_config": "P1",
             "images": [], "ocr_runs": [], "suggestions": {}, "sender": {}, "recipient": {},
             "notification": {"channel": "none", "contact": "", "language": "en", "updates": "key"},
             "service": {"advice_of_delivery": False, "insured_value_lkr": None},
             "timings": {"started_at": now}}
    get_db().drafts.insert_one(draft)
    return draft


@router.get("/drafts")
def list_drafts(status_filter: str = Query("draft", alias="status"), user: dict = Depends(counter)):
    query = {"status": status_filter}
    if user["role"] != "admin":
        query["office_id"] = user["office_id"]
    cursor = get_db().drafts.find(query, {"ocr_runs": 0}).sort("updated_at", DESCENDING).limit(100)
    return list(cursor)


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: str, user: dict = Depends(counter)):
    draft = get_or_404("drafts", draft_id, "draft")
    same_office(user, draft["office_id"])
    return draft


@router.patch("/drafts/{draft_id}")
def update_draft(draft_id: str, body: DraftUpdate, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    sets: dict = {"updated_at": utcnow()}
    unset: dict = {}
    for key in ("sender", "recipient", "notification", "service"):
        value = getattr(body, key)
        if value is not None:
            sets[key] = value.model_dump()
    if body.experiment_config:
        sets["experiment_config"] = body.experiment_config
    if body.destination_office_id is not None:
        if body.destination_office_id and get_db().offices.find_one({"_id": body.destination_office_id}) is None:
            raise problem("UNKNOWN_OFFICE", "destination office not found", 422)
        sets["destination_office_id"] = body.destination_office_id
    changed_fields = any(k in sets and sets[k] != draft.get(k) for k in ("sender", "recipient", "notification",
                                                                          "destination_office_id"))
    if changed_fields and draft.get("fields_confirmed_at"):
        unset.update({"fields_confirmed_at": "", "confirmed_fields": ""})  # edits after confirmation need re-confirmation
    if "service" in sets and sets["service"] != draft.get("service"):
        unset["quote"] = ""
    update = {"$set": sets}
    if unset:
        update["$unset"] = unset
    return get_db().drafts.find_one_and_update({"_id": draft_id}, update, return_document=True)


@router.post("/drafts/{draft_id}/cancel")
def cancel_draft(draft_id: str, user: dict = Depends(counter)):
    _open_draft(draft_id, user)
    get_db().drafts.update_one({"_id": draft_id}, {"$set": {"status": "cancelled", "updated_at": utcnow()},
                                                   "$unset": {"weight": "", "quote": ""}})
    audit(user["username"], "draft.cancelled", draft_id)
    return {"ok": True}


# --------------------------------------------------------------------------- images
@router.post("/drafts/{draft_id}/image")
async def upload_image(draft_id: str, file: UploadFile = File(...), user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise problem("IMAGE_TOO_LARGE", "image must be smaller than 8 MB", 413)
    try:
        doc = store_image(data, office_id=draft["office_id"], draft_id=draft["_id"], source="upload", actor=user["username"])
    except ValueError as exc:
        raise problem("BAD_IMAGE", str(exc), 422) from None
    return {k: doc[k] for k in ("_id", "width", "height", "quality", "source")}


@router.get("/images/{image_id}")
def get_image(image_id: str, user: dict = Depends(counter)):
    doc = get_or_404("images", image_id, "image")
    same_office(user, doc["office_id"])
    return FileResponse(doc["path"], media_type="image/jpeg", headers={"Cache-Control": "private, max-age=600"})


@router.post("/drafts/{draft_id}/capture", status_code=status.HTTP_202_ACCEPTED)
def request_capture(draft_id: str, body: CaptureIn, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    db = get_db()
    device = get_or_404("devices", body.device_id, "device")
    same_office(user, device["office_id"])
    now = utcnow()
    capture_id = "CAP-" + secrets.token_hex(6).upper()
    db.captures.insert_one({"_id": capture_id, "device_id": device["_id"], "draft_id": draft["_id"],
                            "status": "requested", "requested_at": now, "requested_by": user["username"]})
    db.device_commands.insert_one({"_id": "CMD-" + secrets.token_hex(6).upper(), "device_id": device["_id"],
                                   "type": "capture", "params": {"capture_id": capture_id, "flash": body.flash},
                                   "status": "queued", "created_at": now, "created_by": user["username"]})
    return {"capture_id": capture_id, "status": "requested"}


@router.get("/captures/{capture_id}")
def capture_status(capture_id: str, user: dict = Depends(counter)):
    db = get_db()
    cap = get_or_404("captures", capture_id, "capture")
    if cap["status"] == "requested" and (utcnow() - cap["requested_at"]).total_seconds() > 25:
        db.captures.update_one({"_id": capture_id, "status": "requested"}, {"$set": {"status": "expired"}})
        cap["status"] = "expired"
    out = {"capture_id": capture_id, "status": cap["status"], "image_id": cap.get("image_id"), "error": cap.get("error")}
    if cap.get("image_id"):
        img = db.images.find_one({"_id": cap["image_id"]}, {"quality": 1, "width": 1, "height": 1})
        out.update(quality=img.get("quality"), width=img.get("width"), height=img.get("height"))
    return out


# --------------------------------------------------------------------------- OCR and parsing
@router.post("/drafts/{draft_id}/ocr")
def ocr_draft(draft_id: str, body: OcrIn, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    if not draft.get("current_image_id"):
        raise problem("NO_IMAGE", "capture or upload an envelope image first", 422)
    image = get_or_404("images", draft["current_image_id"], "image")
    with open(image["path"], "rb") as f:
        data = f.read()
    try:
        result = run_ocr(data, mode=body.mode, crop=body.crop.model_dump() if body.crop else None,
                         rotate=body.rotate, script_hint=body.script_hint, writing=body.writing)
    except OcrUnavailable as exc:
        raise problem("OCR_UNAVAILABLE", f"{exc}. Type or paste the address and use 'Parse text' instead.",
                      status.HTTP_503_SERVICE_UNAVAILABLE) from None
    now = utcnow()
    run = {"at": now, "mode": body.mode, "target": body.target, "image_id": image["_id"],
           "crop": body.crop.model_dump() if body.crop else None, "rotate": body.rotate,
           "text": result.get("text"), "fields": result["parse"]["fields"],
           "confidence": result["parse"].get("confidence"), "script": result.get("script"),
           "quality": result.get("quality"), "timings": result.get("timings"), "engine": result.get("engine"),
           "writing": body.writing, "reader": result.get("reader"), "readers": result.get("readers")}
    get_db().drafts.update_one({"_id": draft_id}, {"$push": {"ocr_runs": run}, "$set": {
        f"suggestions.{body.target}": {"source": f"ocr_{body.mode}", "fields": result["parse"]["fields"],
                                       "confidence": result["parse"].get("confidence"),
                                       "needs_review": result["parse"].get("needs_review", []), "at": now},
        "updated_at": now}})
    return result


@router.post("/parse")
def parse_text(body: ParseIn, user: dict = Depends(counter)):
    return parse_address(body.text)


@router.post("/drafts/{draft_id}/parse/{target}")
def parse_into_draft(draft_id: str, target: str, body: ParseIn, user: dict = Depends(counter)):
    if target not in PARTIES:
        raise not_found("target")
    _open_draft(draft_id, user)
    result = parse_address(body.text)
    get_db().drafts.update_one({"_id": draft_id}, {"$set": {
        f"suggestions.{target}": {"source": "parse_typed_text", "fields": result["fields"],
                                  "confidence": result["confidence"], "needs_review": result.get("needs_review", []),
                                  "at": utcnow()}}})
    return result


@router.post("/normalize")
def normalize(body: NormalizeIn, user: dict = Depends(counter)):
    s = get_settings()
    use_llm = body.use_llm and s.llm_provider == "ollama"
    return normalize_address(body.text, use_llm=use_llm, llm_url=s.ollama_url, llm_model=s.ollama_model)


@router.get("/address-check")
def address_check(city: str = "", postcode: str = "", user: dict = Depends(counter)):
    return {"city_postcode": check_city_postcode(city, postcode), "offices": suggest_offices(postcode, city)}


@router.post("/drafts/{draft_id}/confirm-fields")
def confirm_fields(draft_id: str, body: ConfirmFieldsIn, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    missing_confirmations = [k for k in ("sender", "recipient", "notification") if k not in body.confirmed_fields]
    problems = required_problems(draft)
    if missing_confirmations:
        problems.append("officer must confirm: " + ", ".join(missing_confirmations))
    if problems:
        raise problem("FIELDS_INCOMPLETE", "cannot confirm the draft yet", 422,
                      problems=problems)
    corrections, stats = review_stats(draft)
    now = utcnow()
    get_db().drafts.update_one({"_id": draft_id}, {"$set": {
        "fields_confirmed_at": now, "confirmed_by": user["username"], "confirmed_fields": body.confirmed_fields,
        "corrections": corrections, "review_stats": stats, "timings.fields_confirmed_at": now, "updated_at": now}})
    return {"ok": True, "corrections": corrections, "review_stats": stats}


# --------------------------------------------------------------------------- weight
@router.post("/drafts/{draft_id}/weight/pair")
def pair_weight(draft_id: str, body: PairWeightIn, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    s, db = get_settings(), get_db()
    device = get_or_404("devices", body.device_id, "device")
    same_office(user, device["office_id"])
    reading = device.get("latest_reading")
    now = utcnow()
    problems = reading_problems(device, reading, now, s)
    if problems:
        raise problem("WEIGHT_NOT_READY", problems[0]["message"], problems=problems)
    key = placement_key(device["_id"], reading["boot_id"], reading["placement_id"])
    used = db.items.find_one({"weight.placement_key": key}, {"_id": 1})
    if used:
        raise problem("PLACEMENT_ALREADY_USED", f"this reading belongs to item {used['_id']}; lift the letter off "
                                                "the scale and place the new letter")
    weight = {"grams": round(float(reading["net_g"]), 1), "source": "device", "device_id": device["_id"],
              "reading_seq": reading["seq"], "placement_key": key, "calibration_id": reading.get("calibration_id"),
              "spread_g": reading.get("spread_g"), "uncertainty_g": uncertainty_for(device, reading, s),
              "device_captured_at": reading.get("captured_at"), "received_at": reading["received_at"], "paired_at": now,
              "paired_by": user["username"]}
    try:
        db.drafts.update_one({"_id": draft_id, "status": "draft"},
                             {"$set": {"weight": weight, "timings.weight_paired_at": now, "updated_at": now},
                              "$unset": {"quote": ""}})
    except DuplicateKeyError:
        other = db.drafts.find_one({"weight.placement_key": key}, {"_id": 1})
        raise problem("PLACEMENT_ALREADY_USED", f"this reading is already paired to draft {other['_id'] if other else '?'}; "
                                                "lift the letter off the scale and place it again") from None
    audit(user["username"], "draft.weight_paired", draft_id, {"device": device["_id"], "grams": weight["grams"],
                                                              "placement": key})
    return weight


@router.post("/drafts/{draft_id}/weight/manual")
def manual_weight(draft_id: str, body: ManualWeightIn, user: dict = Depends(counter)):
    _open_draft(draft_id, user)
    now = utcnow()
    weight = {"grams": round(body.grams, 1), "source": "manual", "uncertainty_g": 0.0,
              "manual": {"reason": body.reason, "instrument": body.instrument, "by": user["username"], "at": now},
              "paired_at": now, "paired_by": user["username"]}
    get_db().drafts.update_one({"_id": draft_id}, {"$set": {"weight": weight, "timings.weight_paired_at": now,
                                                            "updated_at": now}, "$unset": {"quote": ""}})
    audit(user["username"], "draft.weight_manual", draft_id, {"grams": weight["grams"], "reason": body.reason,
                                                              "instrument": body.instrument}, severity="warning")
    return weight


# --------------------------------------------------------------------------- quote and acceptance
@router.post("/drafts/{draft_id}/quote")
def quote(draft_id: str, body: QuoteIn, user: dict = Depends(counter)):
    draft = _open_draft(draft_id, user)
    weight = draft.get("weight")
    if not weight:
        raise problem("NO_WEIGHT", "pair a scale reading or enter an audited manual weight first",
                      422)
    s, db = get_settings(), get_db()
    try:
        tariff = select_tariff(list(db.tariffs.find({"service": "domestic_registered_letter"})),
                               utcnow().astimezone(SRI_LANKA).date())
        q = compute_quote(tariff, weight["grams"], weight.get("uncertainty_g", 0),
                          advice_of_delivery=body.advice_of_delivery, insured_value_lkr=body.insured_value_lkr,
                          min_g=s.weight_min_g, max_g=s.weight_max_g if weight["source"] == "device" else 2000)
    except TariffError as exc:
        raise problem(exc.code, str(exc)) from None
    now = utcnow()
    q.update(quote_id="Q-" + secrets.token_hex(5).upper(), created_at=now, expires_at=now + QUOTE_TTL,
             weight_source=weight["source"])
    db.drafts.update_one({"_id": draft_id}, {"$set": {"quote": q, "service": body.model_dump(),
                                                      "timings.quoted_at": now, "updated_at": now}})
    return q


@router.post("/drafts/{draft_id}/accept", status_code=status.HTTP_201_CREATED)
def accept(draft_id: str, body: AcceptIn, user: dict = Depends(counter)):
    db, s = get_db(), get_settings()
    draft = get_or_404("drafts", draft_id, "draft")
    same_office(user, draft["office_id"])
    if draft["status"] == "committed":  # repeated request after a timeout (T05)
        item = db.items.find_one({"draft_id": draft_id})
        return {"item": staff_view(item), "repeated": True}
    if draft["status"] != "draft":
        raise problem("DRAFT_CLOSED", f"draft is {draft['status']}")
    problems = required_problems(draft)
    if not draft.get("fields_confirmed_at"):
        problems.append("fields have not been confirmed by the officer")
    q = draft.get("quote")
    if not draft.get("weight"):
        problems.append("no weight")
    if not q or q.get("quote_id") != body.quote_id:
        problems.append("quote is missing or out of date; request a new quote")
    elif q["status"] != "ok":
        problems.append(f"quote status is {q['status']}")
    elif utcnow() > q["expires_at"]:
        problems.append("quote expired; request a new quote")
    elif Decimal(body.payment.amount_lkr) != Decimal(q["total_lkr"]):
        problems.append(f"payment {body.payment.amount_lkr} does not equal the quoted total {q['total_lkr']}")
    if problems:
        raise problem("CANNOT_ACCEPT", "the item cannot be accepted yet", 422,
                      problems=problems)

    now = utcnow()
    token = secrets.token_urlsafe(16)
    event = {"event_id": "acc-" + uuid.uuid4().hex, "requested_status": "accepted", "captured_at": now,
             "received_at": now, "sync_delay_s": 0, "offline": False, "worker": user["username"],
             "worker_role": user["role"], "worker_office_id": draft["office_id"], "device_id": "counter",
             "assessment": {"result": "not_assessed", "reasons": ["counter acceptance"], "reference": None},
             "decision": "accepted", "decision_reasons": [], "flagged": False, "late": False, "applied_to_state": True,
             "policy_version": None, "acknowledgement": None, "reason": "", "notes": ""}
    item = {"draft_id": draft_id, "origin_office_id": draft["office_id"],
            "destination_office_id": draft["destination_office_id"], "accepted_at": now, "accepted_by": user["username"],
            "sender": draft["sender"], "recipient": draft["recipient"], "notification": draft["notification"],
            "service": draft.get("service"), "weight": draft["weight"], "quote": q, "tariff_version": q["tariff_version"],
            "payment": {**body.payment.model_dump(), "recorded_by": user["username"], "recorded_at": now},
            "status": "accepted", "status_captured_at": now, "status_event_id": event["event_id"],
            "status_office_id": draft["office_id"], "direction": "forward", "revision": 1, "assigned_postman": None,
            "events": [event], "outbox": [], "label": {"prints": 0, "reprints": [], "verified_at": None},
            "public_access": {"token": token, "created_at": now}, "experiment_config": draft.get("experiment_config"),
            "intake": {"timings": {**draft.get("timings", {}), "accepted_at": now},
                       "review_stats": draft.get("review_stats"), "corrections": draft.get("corrections")},
            "updated_at": now}

    for _ in range(5):
        item["_id"] = new_tracking_id(s.tracking_prefix)
        if sm.should_notify("accepted", draft["notification"].get("updates", "key")):
            item["outbox"] = build_entries(event=event, item=item, office_label=office_label(db, draft["office_id"]),
                                           place_label="", link=tracking_link(item), delayed_server_time=None, now=now)
        try:
            db.items.insert_one(item)
            break
        except DuplicateKeyError as exc:
            pattern = (exc.details or {}).get("keyPattern", {})
            if "draft_id" in pattern:
                existing = db.items.find_one({"draft_id": draft_id})
                return {"item": staff_view(existing), "repeated": True}
            if "weight.placement_key" in pattern:
                raise problem("PLACEMENT_ALREADY_USED", "this scale reading was already used for another item") from None
            continue  # tracking-ID collision: draw a new one
    else:
        raise problem("ID_ALLOCATION_FAILED", "could not allocate a tracking identifier", 500)

    db.drafts.update_one({"_id": draft_id}, {"$set": {"status": "committed", "item_id": item["_id"],
                                                      "timings.accepted_at": now, "updated_at": now}})
    audit(user["username"], "item.accepted", item["_id"], {"draft": draft_id, "tariff": q["tariff_version"],
                                                           "total": q["total_lkr"], "weight_source": draft["weight"]["source"]})
    return {"item": staff_view(item), "repeated": False}


@router.get("/offices/suggest")
def offices_suggest(postcode: str = "", city: str = "", user: dict = Depends(counter)):
    return suggest_offices(postcode, city)


@router.get("/drafts/{draft_id}/weight/live")
def weight_live(draft_id: str, device_id: str, user: dict = Depends(counter)):
    """Convenience for the counter screen: device reading plus pairing readiness."""
    get_or_404("drafts", draft_id, "draft")
    device = get_or_404("devices", device_id, "device")
    same_office(user, device["office_id"])
    reading = device.get("latest_reading")
    problems = reading_problems(device, reading, utcnow(), get_settings())
    if reading:
        reading = {k: v for k, v in reading.items() if k != "raw"}
    return {"reading": reading, "ready": not problems, "problems": problems}
