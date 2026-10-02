"""End-to-end acceptance tests mapped to the proposal's scenario catalogue (Table 15).

Needs MongoDB. Run:  .venv/Scripts/python -m pytest -q
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from conftest import DEVICE_HEADERS, requires_mongo

pytestmark = requires_mongo

DEMO = {"lat": 6.91470, "lon": 79.97290}   # SLIIT-DEMO office reference point
_seq = iter(range(1, 10_000))


def reading(client, *, net, stable=True, loaded=True, placement=1, boot="boot-A", cal="CAL-1"):
    body = {"seq": next(_seq), "boot_id": boot, "uptime_ms": 1000, "net_g": net, "spread_g": 0.4, "stable": stable,
            "loaded": loaded, "placement_id": placement, "calibration_id": cal, "sensor_ok": True, "sample_count": 10,
            "fw": "test", "camera_ok": True}
    r = client.post("/api/iot/readings", json=body, headers=DEVICE_HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def new_draft(client, h, *, notify=True):
    d = client.post("/api/intake/drafts", headers=h).json()
    body = {
        "sender": {"name": "Nimal Silva", "house_number": "12", "street": "New Kandy Road", "city": "Malabe"},
        "recipient": {"name": "K. Sivarajah", "house_number": "7", "street": "Kasthuriyar Road", "city": "Malabe",
                      "postcode": "10115"},
        "notification": {"channel": "email" if notify else "none", "contact": "sender@example.test" if notify else "",
                         "language": "en", "updates": "all"},
        "destination_office_id": "SLIIT-DEMO",
    }
    r = client.patch(f"/api/intake/drafts/{d['_id']}", headers=h, json=body)
    assert r.status_code == 200, r.text
    return d["_id"]


def confirm(client, h, draft_id):
    r = client.post(f"/api/intake/drafts/{draft_id}/confirm-fields", headers=h,
                    json={"confirmed_fields": ["sender", "recipient", "notification"]})
    assert r.status_code == 200, r.text


def accept_item(client, h, *, grams=20.0, placement, notify=True):
    draft_id = new_draft(client, h, notify=notify)
    confirm(client, h, draft_id)
    reading(client, net=grams, placement=placement)
    r = client.post(f"/api/intake/drafts/{draft_id}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"})
    assert r.status_code == 200, r.text
    q = client.post(f"/api/intake/drafts/{draft_id}/quote", headers=h, json={}).json()
    assert q["status"] == "ok", q
    r = client.post(f"/api/intake/drafts/{draft_id}/accept", headers=h,
                    json={"quote_id": q["quote_id"], "payment": {"method": "cash", "amount_lkr": q["total_lkr"]}})
    assert r.status_code == 201, r.text
    return draft_id, r.json()["item"]


def scan(client, h, tid, status, *, lat=DEMO["lat"], lon=DEMO["lon"], acc=8.0, age=3.0, ack=None, event_id=None,
         captured=None, **extra):
    body = {"event_id": event_id or uuid.uuid4().hex, "item_id": tid, "requested_status": status,
            "captured_at": (captured or datetime.now(timezone.utc)).isoformat(),
            "location": {"latitude": lat, "longitude": lon, "accuracy_m": acc, "fix_age_s": age, "permission": "granted",
                         "mock": False} if lat is not None else {"permission": "denied"},
            "device_id": "test-phone", **extra}
    if ack:
        body["acknowledgement"] = ack
    return client.post("/api/scans", headers=h, json=body)


def run_outbox():
    from app.config import get_settings
    from app.services.notifications.outbox import OutboxWorker
    return OutboxWorker(get_settings()).run_once()


# ---------------------------------------------------------------------------------------------
def test_device_auth_rejects_wrong_key(client):
    r = client.post("/api/iot/readings", json={"seq": 1, "boot_id": "x", "uptime_ms": 1},
                    headers={"X-Device-Id": "SCALECAM-T1", "X-Device-Key": "wrong"})
    assert r.status_code == 401


def test_weight_pairing_rules_T03(client, tokens):
    h = tokens["counter2"]
    d1, d2 = new_draft(client, h), new_draft(client, h)
    reading(client, net=18.0, stable=False, placement=100)
    r = client.post(f"/api/intake/drafts/{d1}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "WEIGHT_NOT_READY"   # unstable
    reading(client, net=18.0, placement=100)
    assert client.post(f"/api/intake/drafts/{d1}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"}).status_code == 200
    # Same placement offered to a second draft -> refused (previous letter's weight is never reused).
    r = client.post(f"/api/intake/drafts/{d2}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PLACEMENT_ALREADY_USED"
    # Stale reading
    from app.db import get_db
    get_db().devices.update_one({"_id": "SCALECAM-T1"}, {"$set": {"latest_reading.received_at":
                                                                  datetime.now(timezone.utc) - timedelta(seconds=30)}})
    r = client.post(f"/api/intake/drafts/{d2}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"})
    assert r.json()["detail"]["problems"][0]["code"] == "STALE_READING"


def test_unconfirmed_fields_block_acceptance_FR04(client, tokens):
    h = tokens["counter2"]
    d = client.post("/api/intake/drafts", headers=h).json()["_id"]
    r = client.post(f"/api/intake/drafts/{d}/confirm-fields", headers=h, json={"confirmed_fields": ["sender"]})
    assert r.status_code == 422
    assert any("recipient name" in p for p in r.json()["detail"]["problems"])


def test_quote_boundary_T04(client, tokens):
    h = tokens["counter2"]
    d = new_draft(client, h)
    reading(client, net=29.2, placement=200)
    client.post(f"/api/intake/drafts/{d}/weight/pair", headers=h, json={"device_id": "SCALECAM-T1"})
    q = client.post(f"/api/intake/drafts/{d}/quote", headers=h, json={}).json()
    assert q["status"] == "reweigh_required"


def test_accept_is_idempotent_and_label_reprint_T05_T06(client, tokens):
    h = tokens["counter2"]
    draft_id, item = accept_item(client, h, grams=20.0, placement=300)
    assert item["status"] == "accepted" and item["quote"]["total_lkr"] == "130.00"
    again = client.post(f"/api/intake/drafts/{draft_id}/accept", headers=h,
                        json={"quote_id": "whatever", "payment": {"method": "cash", "amount_lkr": "130.00"}}).json()
    assert again["repeated"] and again["item"]["tracking_id"] == item["tracking_id"]
    tid = item["tracking_id"]
    label = client.get(f"/api/items/{tid}/label", headers=h).json()
    assert label["code128_svg"].startswith("<svg") and "Sivarajah" not in label["code128_svg"]
    assert client.post(f"/api/items/{tid}/label/printed", headers=h).status_code == 200
    assert client.post(f"/api/items/{tid}/label/printed", headers=h).status_code == 422   # reprint needs reason
    assert client.post(f"/api/items/{tid}/label/printed", headers=h, json={"reason": "printer jam"}).json()["prints"] == 2
    assert client.post(f"/api/items/{tid}/label/verify", headers=h, json={"scanned_value": "PA-DEMO-XXXX"}).status_code == 422
    assert client.post(f"/api/items/{tid}/label/verify", headers=h, json={"scanned_value": tid.lower()}).status_code == 200


def test_full_journey_with_location_review_and_messages(client, tokens):
    h = tokens["counter2"]
    _, item = accept_item(client, h, placement=400)
    tid = item["tracking_id"]

    # T07: a postman of another office cannot touch it
    r = scan(client, tokens["postman1"], tid, "out_for_delivery")
    assert r.status_code == 403

    assert scan(client, h, tid, "dispatched").json()["decision"] == "accepted"
    assert scan(client, tokens["hub1"], tid, "in_transit", lat=6.9325787, lon=79.8515473).json()["decision"] == "accepted"

    # T08: arrival scan clearly outside the destination zone -> held, no status change, no message
    r = scan(client, tokens["hubdemo"], tid, "at_destination_office", lat=6.95, lon=79.97)
    assert r.status_code == 202 and r.json()["decision"] == "held_for_review"
    held_event = r.json()["event_id"]
    assert client.get(f"/api/items/{tid}", headers=h).json()["status"] == "in_transit"
    queue = client.get("/api/review/held", headers=tokens["pm2"]).json()
    assert any(row["event"]["event_id"] == held_event for row in queue)
    r = client.post(f"/api/review/{tid}/{held_event}", headers=tokens["pm2"],
                    json={"action": "approve", "reason": "officer confirmed arrival by phone"})
    assert r.status_code == 200 and r.json()["applied_to_state"]

    assert scan(client, tokens["postman2"], tid, "out_for_delivery").json()["decision"] == "accepted"

    # T10: delivered without acknowledgement is refused
    r = scan(client, tokens["postman2"], tid, "delivered")
    assert r.status_code == 422 and r.json()["reasons"][0]["code"] == "ACK_REQUIRED"
    r = scan(client, tokens["postman2"], tid, "delivered", ack={"type": "recipient_name", "recipient_name": "K. Sivarajah"})
    assert r.json()["decision"] == "accepted"

    # T13: an offline in-transit scan synchronised after delivery is history only
    late = scan(client, tokens["hub1"], tid, "in_transit", lat=6.9325787, lon=79.8515473,
                captured=datetime.now(timezone.utc) - timedelta(hours=5), offline=True)
    assert late.json()["late"] is True and late.json()["applied_to_state"] is False
    detail = client.get(f"/api/items/{tid}", headers=h).json()
    assert detail["status"] == "delivered"

    # Messages: one per notifying event, all from committed events
    statuses = sorted(e["status_code"] for e in detail["outbox"])
    assert statuses == sorted(["accepted", "dispatched", "in_transit", "at_destination_office", "out_for_delivery",
                               "delivered"])
    assert run_outbox() >= 6
    outbox = client.get(f"/api/items/{tid}", headers=h).json()["outbox"]
    assert {e["status"] for e in outbox} == {"provider_accepted"}

    # T16: public page needs the token; no coordinates or worker names leak
    assert client.get(f"/api/public/track/{tid}").status_code == 404
    assert client.get(f"/api/public/track/{tid}", headers={"X-Tracking-Token": "guess"}).status_code == 404
    token = detail["tracking_link"].split("#t=")[1]
    pub = client.get(f"/api/public/track/{tid}", headers={"X-Tracking-Token": token})
    assert pub.status_code == 200
    text = pub.text
    assert "latitude" not in text and "postman2" not in text and "Sivarajah" not in text
    assert pub.json()["status"] == "delivered"


def test_replay_1000_times_T12(client, tokens):
    h = tokens["counter2"]
    _, item = accept_item(client, h, placement=500)
    tid = item["tracking_id"]
    event_id = uuid.uuid4().hex
    captured = datetime.now(timezone.utc)
    decisions = [scan(client, h, tid, "dispatched", event_id=event_id, captured=captured).json()["decision"]
                 for _ in range(1000)]
    assert decisions[0] == "accepted" and set(decisions[1:]) == {"duplicate"}
    detail = client.get(f"/api/items/{tid}", headers=h).json()
    assert sum(1 for e in detail["events"] if e["event_id"] == event_id) == 1
    assert sum(1 for e in detail["outbox"] if e["event_id"] == event_id) == 1


def test_unlocated_arrival_is_held_T09_and_held_events_never_notify_T14(client, tokens):
    h = tokens["counter2"]
    _, item = accept_item(client, h, placement=600)
    tid = item["tracking_id"]
    scan(client, h, tid, "dispatched")
    r = scan(client, tokens["hubdemo"], tid, "at_destination_office", lat=None)
    assert r.json()["decision"] == "held_for_review"
    detail = client.get(f"/api/items/{tid}", headers=h).json()
    assert not any(e["status_code"] == "at_destination_office" for e in detail["outbox"])


def test_return_path_T17(client, tokens):
    h = tokens["counter2"]
    _, item = accept_item(client, h, placement=700, notify=False)
    tid = item["tracking_id"]
    scan(client, h, tid, "dispatched")
    scan(client, tokens["hubdemo"], tid, "at_destination_office")
    scan(client, tokens["postman2"], tid, "out_for_delivery")
    assert scan(client, tokens["postman2"], tid, "delivery_attempted").status_code == 422      # reason required
    assert scan(client, tokens["postman2"], tid, "delivery_attempted", reason="house locked").json()["decision"] == "accepted"
    assert scan(client, tokens["pm2"], tid, "return_started", reason="recipient moved").json()["decision"] == "accepted"
    assert scan(client, tokens["hubdemo"], tid, "in_transit").json()["decision"] == "accepted"
    assert scan(client, tokens["pm2"], tid, "returned_to_sender").json()["decision"] == "accepted"
    detail = client.get(f"/api/items/{tid}", headers=h).json()
    assert detail["status"] == "returned_to_sender" and detail["direction"] == "return"
    assert [e["requested_status"] for e in detail["events"]].count("delivery_attempted") == 1


def test_provider_failures_T15(client, tokens, monkeypatch):
    from app.config import get_settings
    from app.services.notifications.outbox import OutboxWorker
    h = tokens["counter2"]
    _, item = accept_item(client, h, placement=800)
    tid = item["tracking_id"]
    s = get_settings()
    monkeypatch.setattr(s, "outbox_fault_mode", "timeout_once")
    worker = OutboxWorker(s)        # file adapter de-duplicates by key -> ambiguous outcome is retried safely
    worker.run_once()
    entry = client.get(f"/api/items/{tid}", headers=h).json()["outbox"][0]
    assert entry["status"] == "retry" and entry["history"][0]["outcome"] == "ambiguous"
    from app.db import get_db
    get_db().items.update_one({"_id": tid}, {"$set": {"outbox.0.next_attempt_at": datetime.now(timezone.utc)}})
    worker.run_once()
    entry = client.get(f"/api/items/{tid}", headers=h).json()["outbox"][0]
    assert entry["status"] == "provider_accepted" and entry["attempts"] == 2
    monkeypatch.setattr(s, "outbox_fault_mode", "permanent")
    _, item2 = accept_item(client, h, placement=801)
    OutboxWorker(s).run_once()
    entry = client.get(f"/api/items/{item2['tracking_id']}", headers=h).json()["outbox"][0]
    assert entry["status"] == "failed_permanent"
    failed = client.get("/api/notifications?status=failed_permanent", headers=tokens["pm2"]).json()
    assert failed["counts"].get("failed_permanent", 0) >= 1


def test_reports_export(client, tokens):
    r = client.get("/api/reports/intake.csv", headers=tokens["pm2"])
    assert r.status_code == 200 and "start_to_accept_s" in r.text.splitlines()[0]
    assert client.get("/api/reports/events.csv", headers=tokens["pm2"]).status_code == 200
    assert client.get("/api/reports/intake.csv", headers=tokens["counter2"]).status_code == 403
