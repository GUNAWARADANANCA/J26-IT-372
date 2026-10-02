"""Scan-event ingestion: the decision pipeline for every handover/delivery scan.

Order of checks (proposal 3.10 - a good location can never override a failed
authorisation or an impossible transition):

    1. item exists                               -> 404 rejected
    2. same event_id already stored (replay)     -> duplicate (idempotent, T12)
    3. role + object-level authorisation         -> 403 rejected, security audit (T07)
    4. state transition / late history           -> 409 rejected, or history-only (T13)
    5. delivery evidence (acknowledgement)       -> 422 rejected, or held (T10)
    6. clock sanity, mock location               -> held
    7. location assessment + policy action       -> accepted / accepted (flagged) / held (T08, T09)
    8. atomic commit: event + status + outbox, guarded by the item revision

Rejected requests are never written into the item (they go to the audit log);
held events are stored but do not change the status or trigger messages until
a postmaster approves them.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from ..audit import audit
from ..config import get_settings
from ..schemas import ScanIn
from ..timeutil import local_str, utcnow
from . import state_machine as sm
from .location import DEFAULT_POLICY, action_for, assess
from .notifications.outbox import build_entries
from .tracking_id import normalize_tracking_id

log = logging.getLogger(__name__)
DELAYED_SYNC_NOTICE = timedelta(minutes=10)


class ScanResult(dict):
    @property
    def http_status(self) -> int:
        return self.pop("_http", 200)


def _reject(code: str, message: str, http: int, **extra) -> ScanResult:
    return ScanResult(decision="rejected", reasons=[{"code": code, "message": message}], _http=http, **extra)


def active_policy(db) -> dict:
    policy = db.location_policies.find_one({"active": True}, sort=[("activated_at", -1)])
    return policy or DEFAULT_POLICY


def office_label(db, office_id: str | None) -> str:
    if not office_id:
        return ""
    office = db.offices.find_one({"_id": office_id}, {"name": 1})
    return office["name"] if office else office_id


def office_zone(db, office_id: str | None, kind: str = "facility") -> dict | None:
    if not office_id:
        return None
    office = db.offices.find_one({"_id": office_id})
    if not office or office.get("latitude") is None:
        return None
    radius = office.get("zone_radius_m", 150) if kind == "facility" else office.get("service_radius_m", 3000)
    return {"type": f"office_{kind}", "id": office_id, "label": office["name"], "latitude": office["latitude"],
            "longitude": office["longitude"], "radius_m": radius, "provenance": office.get("provenance")}


def reference_zone(db, item: dict, status: str, user: dict) -> dict | None:
    """Which approved area a scan of ``status`` should be compared with (proposal 3.10)."""
    if status == "dispatched":
        return office_zone(db, item["origin_office_id"])
    if status == "in_transit":
        return office_zone(db, user.get("office_id"))
    if status == "at_destination_office":
        return office_zone(db, item.get("destination_office_id"))
    if status == "out_for_delivery":
        return office_zone(db, item.get("destination_office_id"), "service")
    if status in ("delivery_attempted", "delivered"):
        pin = item.get("recipient_pin")
        if pin and pin.get("provenance"):
            return {"type": "recipient_pin", "id": item["_id"], "label": "confirmed recipient location",
                    "latitude": pin["latitude"], "longitude": pin["longitude"], "radius_m": pin.get("radius_m", 50),
                    "provenance": pin["provenance"]}
        # A town centroid is not the recipient's house: compare with the delivery service area only.
        return office_zone(db, item.get("destination_office_id"), "service")
    if status == "return_started":
        return office_zone(db, user.get("office_id"))
    if status == "returned_to_sender":
        return office_zone(db, item["origin_office_id"])
    return None


def authorize(user: dict, item: dict, status: str) -> str | None:
    """Return a refusal reason, or None when the worker may record ``status`` for ``item``."""
    role = user["role"]
    if status not in sm.ROLE_STATUSES.get(role, set()):
        return f"role '{role}' may not record '{status}'"
    if role == "admin":
        return None
    office = user.get("office_id")
    if role == "counter_officer" and office != item["origin_office_id"]:
        return "item was not accepted at your office"
    if role == "hub_officer":
        if status == "dispatched" and office != item["origin_office_id"]:
            return "only the origin office can dispatch this item"
        if status == "at_destination_office" and office != item.get("destination_office_id"):
            return "your office is not this item's destination office; record an in-transit handover instead"
    if role == "postman":
        if office != item.get("destination_office_id"):
            return "item is not for your delivery office"
        assigned = item.get("assigned_postman")
        if status == "out_for_delivery":
            if assigned and assigned != user["username"]:
                return "item is assigned to another postman"
            beat = user.get("beat_postcodes") or []
            if not assigned and beat and (item.get("recipient", {}).get("postcode") or "") not in beat:
                return "item's postcode is outside your delivery beat; ask the postmaster to assign it"
        elif assigned != user["username"]:
            return "item is not assigned to you"
    if role == "postmaster" and office not in (item["origin_office_id"], item.get("destination_office_id")):
        return "item is not handled by your office"
    return None


def tracking_link(item: dict) -> str:
    token = (item.get("public_access") or {}).get("token", "")
    return f"{get_settings().public_base_url}/track/{item['_id']}#t={token}"


def _sanitize_ack(ack) -> dict | None:
    if ack is None or ack.type == "none":
        return None
    return {"type": ack.type, "recipient_name": ack.recipient_name.strip()[:120],
            "relationship": ack.relationship.strip()[:60], "reference": ack.reference.strip()[:60],
            "signature_svg": ack.signature_svg if ack.type == "signature" else ""}


def ingest_scan(db, user: dict, scan: ScanIn, *, max_retries: int = 5) -> ScanResult:
    tracking_id = normalize_tracking_id(scan.item_id)
    for _ in range(max_retries):
        item = db.items.find_one({"_id": tracking_id})
        if item is None:
            audit(user["username"], "scan.unknown_item", tracking_id, {"event_id": scan.event_id})
            return _reject("UNKNOWN_ITEM", "no registered item with this identifier", 404)

        existing = next((e for e in item.get("events", []) if e["event_id"] == scan.event_id), None)
        if existing is not None:
            if existing.get("worker") != user["username"]:
                audit(user["username"], "scan.event_id_reuse", tracking_id, {"event_id": scan.event_id}, severity="security")
                return _reject("EVENT_ID_CONFLICT", "event id already used by another worker", 409)
            return ScanResult(decision="duplicate", original_decision=existing["decision"], event_id=scan.event_id,
                              item_status=item["status"], committed_revision=item["revision"], _http=200)

        status = scan.requested_status
        if status not in sm.STATUSES or status == "accepted":
            return _reject("UNKNOWN_STATUS", f"'{status}' is not a scan status", 422)
        refusal = authorize(user, item, status)
        if refusal:
            audit(user["username"], "scan.denied", tracking_id, {"status": status, "reason": refusal,
                                                                 "event_id": scan.event_id}, severity="security")
            return _reject("NOT_AUTHORISED", refusal, 403)

        now = utcnow()
        captured = scan.captured_at if scan.captured_at.tzinfo else scan.captured_at.replace(tzinfo=now.tzinfo)
        direction = item.get("direction", "forward")
        applied = True
        late = False
        if not sm.is_valid_transition(item["status"], status, direction):
            if sm.is_late_history(item["status"], status, direction) and captured < item["status_captured_at"]:
                applied, late = False, True
            else:
                audit(user["username"], "scan.invalid_transition", tracking_id,
                      {"from": item["status"], "to": status, "event_id": scan.event_id})
                return _reject("INVALID_TRANSITION", f"cannot move from '{item['status']}' to '{status}'", 409,
                               item_status=item["status"])

        policy = active_policy(db)
        holds: list[dict] = []
        ack = _sanitize_ack(scan.acknowledgement)
        if status == "delivered" and policy.get("delivered_requires_acknowledgement", True) and ack is None:
            if not scan.exception_reason.strip():
                return _reject("ACK_REQUIRED", "a delivered scan needs the permitted acknowledgement "
                                               "(signature, recipient name or reference) or a documented exception", 422)
            holds.append({"code": "ACK_EXCEPTION", "message": f"delivered without acknowledgement: {scan.exception_reason.strip()}"})
        if status in ("delivery_attempted", "return_started") and not scan.reason.strip():
            return _reject("REASON_REQUIRED", f"'{status}' needs a reason", 422)
        if captured > now + timedelta(seconds=policy.get("future_tolerance_s", 300)):
            holds.append({"code": "FUTURE_TIME", "message": "capture time is in the future; device clock may be wrong"})

        fix = scan.location.model_dump() if scan.location else None
        zone = reference_zone(db, item, status, user)
        assessment = assess(fix, zone, policy)
        action = action_for(status, assessment["result"], policy)
        if assessment.get("mock_location") and policy.get("mock_location_action") == "hold":
            action = "hold"
            holds.append({"code": "MOCK_LOCATION", "message": "device reported a simulated location"})
        if action == "hold" and assessment["result"] in ("mismatch", "unlocated", "uncertain"):
            holds.append({"code": f"LOCATION_{assessment['result'].upper()}", "message": "; ".join(assessment["reasons"])})

        decision = "held_for_review" if holds else "accepted"
        event = {
            "event_id": scan.event_id, "requested_status": status, "captured_at": captured, "received_at": now,
            "sync_delay_s": round((now - captured).total_seconds(), 1), "offline": scan.offline,
            "worker": user["username"], "worker_role": user["role"], "worker_office_id": user.get("office_id"),
            "device_id": scan.device_id[:64], "client_version": scan.client_version[:32],
            "expected_revision": scan.expected_revision, "location": fix, "assessment": assessment,
            "decision": decision, "decision_reasons": holds, "flagged": action == "accept_flagged",
            "policy_version": policy.get("policy_version"), "late": late,
            "applied_to_state": decision == "accepted" and applied,
            "acknowledgement": ack, "reason": scan.reason.strip()[:200],
            "exception_reason": scan.exception_reason.strip()[:200], "notes": scan.notes.strip(),
        }
        if decision == "held_for_review":
            event["review"] = {"status": "pending"}

        update = {"$push": {"events": event}, "$inc": {"revision": 1}, "$set": {"updated_at": now}}
        if event["applied_to_state"]:
            update["$set"].update(apply_status_fields(item, event, user))
            entries = notification_entries(db, item, event, now)
            if entries:
                update["$push"]["outbox"] = {"$each": entries}
        try:
            res = db.items.update_one({"_id": tracking_id, "revision": item["revision"],
                                       "events.event_id": {"$ne": scan.event_id}}, update)
        except DuplicateKeyError:
            audit(user["username"], "scan.event_id_reuse", tracking_id, {"event_id": scan.event_id}, severity="security")
            return _reject("EVENT_ID_CONFLICT", "event id already used for another item", 409)
        if res.modified_count == 1:
            audit(user["username"], f"scan.{decision}", tracking_id,
                  {"event_id": scan.event_id, "status": status, "location": assessment["result"], "late": late})
            return ScanResult(decision=decision, reasons=holds, event_id=scan.event_id,
                              item_status=event["requested_status"] if event["applied_to_state"] else item["status"],
                              applied_to_state=event["applied_to_state"], late=late, flagged=event["flagged"],
                              location=_public_assessment(assessment), committed_revision=item["revision"] + 1,
                              _http=202 if decision == "held_for_review" else 200)
        # Someone else changed the item (or stored this event) between read and write: re-evaluate.
    return _reject("CONFLICT", "item is being updated concurrently; retry", 409)


def apply_status_fields(item: dict, event: dict, user: dict) -> dict:
    fields = {"status": event["requested_status"], "status_captured_at": event["captured_at"],
              "status_event_id": event["event_id"], "status_office_id": user.get("office_id")}
    if event["requested_status"] == "out_for_delivery":
        fields["assigned_postman"] = event["worker"]
    if event["requested_status"] == "return_started":
        fields["direction"] = "return"
    return fields


def notification_entries(db, item: dict, event: dict, now) -> list[dict]:
    prefs = item.get("notification") or {}
    if not sm.should_notify(event["requested_status"], prefs.get("updates", "key")):
        return []
    ref = event["assessment"].get("reference") or {}
    place = ref.get("label") if event["assessment"].get("result") == "consistent" and ref.get("type", "").startswith("office") \
        else office_label(db, event.get("worker_office_id"))
    delayed = local_str(now) if now - event["captured_at"] > DELAYED_SYNC_NOTICE else None
    return build_entries(event=event, item=item, office_label=office_label(db, item.get("destination_office_id")
                                                                           if event["requested_status"] != "accepted"
                                                                           else item["origin_office_id"]),
                         place_label=place, link=tracking_link(item), delayed_server_time=delayed, now=now)


def _public_assessment(a: dict) -> dict:
    return {k: a.get(k) for k in ("result", "mode", "p_inside", "distance_m", "accuracy_m", "reasons")}


def review_event(db, reviewer: dict, tracking_id: str, event_id: str, action: str, reason: str) -> ScanResult:
    for _ in range(5):
        item = db.items.find_one({"_id": tracking_id})
        if item is None:
            return _reject("UNKNOWN_ITEM", "no such item", 404)
        if reviewer["role"] != "admin" and reviewer.get("office_id") not in (item["origin_office_id"], item.get("destination_office_id")):
            return _reject("NOT_AUTHORISED", "item is not handled by your office", 403)
        event = next((e for e in item["events"] if e["event_id"] == event_id), None)
        if event is None or (event.get("review") or {}).get("status") != "pending":
            return _reject("NOT_PENDING", "event is not waiting for review", 409)
        now = utcnow()
        review = {"status": "approved" if action == "approve" else "rejected", "by": reviewer["username"],
                  "at": now, "reason": reason}
        sets = {"events.$[e].review": review, "updated_at": now}
        update = {"$set": sets, "$inc": {"revision": 1}}
        applied = False
        if action == "approve":
            direction = item.get("direction", "forward")
            if sm.is_valid_transition(item["status"], event["requested_status"], direction):
                applied = True
                sets["events.$[e].decision"] = "accepted_after_review"
                sets["events.$[e].applied_to_state"] = True
                sets.update(apply_status_fields(item, event, {"office_id": event.get("worker_office_id")}))
                event_for_outbox = {**event, "decision": "accepted_after_review"}
                entries = notification_entries(db, item, event_for_outbox, now)
                if entries:
                    update["$push"] = {"outbox": {"$each": entries}}
            elif sm.is_late_history(item["status"], event["requested_status"], direction):
                sets["events.$[e].decision"] = "accepted_after_review"
                sets["events.$[e].late"] = True
            else:
                return _reject("INVALID_TRANSITION", f"the item is now '{item['status']}', so this event can no longer be "
                                                     "applied; reject it instead", 409)
        else:
            sets["events.$[e].decision"] = "rejected_after_review"
        res = db.items.update_one({"_id": tracking_id, "revision": item["revision"]}, update,
                                  array_filters=[{"e.event_id": event_id}])
        if res.modified_count == 1:
            audit(reviewer["username"], f"review.{action}", tracking_id, {"event_id": event_id, "reason": reason,
                                                                           "applied": applied})
            return ScanResult(decision=review["status"], applied_to_state=applied, _http=200)
    return _reject("CONFLICT", "item changed during review; retry", 409)
