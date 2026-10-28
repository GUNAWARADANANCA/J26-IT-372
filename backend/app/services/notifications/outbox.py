"""Transactional outbox for sender notifications (proposal section 3.11, SO4).

* ``build_entries`` is called while an event is being committed; the entries
  are written in the *same atomic update* as the event and the status change,
  so a rolled-back or held event can never produce a message (T14, T10).
* The de-duplication key is SHA-256(event, recipient, channel, template version),
  so replaying an event 1,000 times yields at most one message (T12).
* ``OutboxWorker`` claims due entries with an atomic compare-and-set, sends
  them through an adapter and records the outcome. Retries use exponential
  back-off with a bounded number of attempts; permanent failures and
  ambiguous outcomes appear on the postmaster's dashboard.
* A worker crash while an entry is 'sending' leaves a lease that expires; the
  entry then becomes 'ambiguous' because we cannot know whether it was sent.
"""
from __future__ import annotations

import hashlib
import logging
import threading
from datetime import timedelta

from ...config import Settings
from ...db import get_db
from ...timeutil import local_str, utcnow
from .adapters import build_adapters
from .templates import TEMPLATE_VERSION, render

log = logging.getLogger(__name__)

LEASE_SECONDS = 60
DUE_STATES = ("queued", "retry")


def dedupe_key(event_id: str, recipient: str, channel: str) -> str:
    raw = f"{event_id}|{recipient.strip().lower()}|{channel}|{TEMPLATE_VERSION}"
    return hashlib.sha256(raw.encode()).hexdigest()[:40]


def build_entries(*, event: dict, item: dict, office_label: str, place_label: str, link: str,
                  delayed_server_time: str | None, now) -> list[dict]:
    prefs = item.get("notification") or {}
    channel, contact = prefs.get("channel", "none"), (prefs.get("contact") or "").strip()
    if channel not in ("email", "sms") or not contact:
        return []
    variables = {
        "tracking_id": item["_id"], "office": office_label, "place": place_label or office_label,
        "time": local_str(event["captured_at"]), "reason": event.get("reason") or "",
        "link": link, "server_time": delayed_server_time or "",
    }
    return [{
        "key": dedupe_key(event["event_id"], contact, channel),
        "event_id": event["event_id"], "status_code": event["requested_status"],
        "channel": channel, "to": contact, "language": prefs.get("language", "en"),
        "template_version": TEMPLATE_VERSION, "variables": variables,
        "status": "queued", "attempts": 0, "next_attempt_at": now, "created_at": now, "history": [],
    }]


class OutboxWorker:
    def __init__(self, s: Settings):
        self.s = s
        self.adapters = build_adapters(s)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # -- lifecycle -------------------------------------------------------------
    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._loop, name="outbox-worker", daemon=True)
            self._thread.start()
            log.info("outbox worker started (adapter=%s)", self.adapters["email"].name)

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.run_once()
            except Exception:  # noqa: BLE001 - keep the worker alive
                log.exception("outbox worker iteration failed")
            self._stop.wait(self.s.outbox_poll_seconds)

    # -- one pass --------------------------------------------------------------
    def run_once(self) -> int:
        db = get_db()
        now = utcnow()
        self._expire_leases(db, now)
        processed = 0
        cursor = db.items.find(
            {"outbox": {"$elemMatch": {"status": {"$in": list(DUE_STATES)}, "next_attempt_at": {"$lte": now}}}},
            {"outbox": 1}).limit(100)
        for item in cursor:
            for entry in item.get("outbox", []):
                if entry["status"] in DUE_STATES and entry["next_attempt_at"] <= now:
                    processed += self._process(db, item["_id"], entry)
        return processed

    def _expire_leases(self, db, now) -> None:
        for item in db.items.find({"outbox": {"$elemMatch": {"status": "sending", "lease_until": {"$lt": now}}}},
                                  {"outbox": 1}):
            for entry in item["outbox"]:
                if entry["status"] == "sending" and entry.get("lease_until") and entry["lease_until"] < now:
                    adapter = self.adapters.get(entry["channel"])
                    new_status = "retry" if adapter and adapter.supports_idempotency else "ambiguous"
                    db.items.update_one({"_id": item["_id"], "outbox": {"$elemMatch": {"key": entry["key"], "status": "sending"}}},
                                        {"$set": {"outbox.$.status": new_status, "outbox.$.next_attempt_at": now},
                                         "$push": {"outbox.$.history": {"at": now, "outcome": "lease_expired",
                                                                         "detail": "worker stopped while sending"}}})

    def _process(self, db, item_id: str, entry: dict) -> int:
        now = utcnow()
        claimed = db.items.find_one_and_update(
            {"_id": item_id, "outbox": {"$elemMatch": {"key": entry["key"], "status": entry["status"],
                                                        "attempts": entry["attempts"]}}},
            {"$set": {"outbox.$.status": "sending", "outbox.$.lease_until": now + timedelta(seconds=LEASE_SECONDS)},
             "$inc": {"outbox.$.attempts": 1}})
        if claimed is None:
            return 0  # another worker took it
        adapter = self.adapters.get(entry["channel"])
        subject, body = render(entry["language"], entry["status_code"], entry["variables"])
        result = adapter.send(to=entry["to"], subject=subject, body=body, key=entry["key"])
        attempts = entry["attempts"] + 1
        update = {"outbox.$.last_attempt_at": now, "outbox.$.adapter": adapter.name}
        if result.outcome == "accepted":
            update.update({"outbox.$.status": "provider_accepted", "outbox.$.provider_message_id": result.provider_message_id,
                           "outbox.$.accepted_at": now})
        elif result.outcome == "permanent" or (result.outcome == "retryable" and attempts >= self.s.outbox_max_attempts):
            update.update({"outbox.$.status": "failed_permanent"})
        elif result.outcome == "ambiguous" and not adapter.supports_idempotency:
            update.update({"outbox.$.status": "ambiguous"})
        else:  # retryable, or ambiguous with an idempotent provider
            if attempts >= self.s.outbox_max_attempts:
                update.update({"outbox.$.status": "failed_permanent"})
            else:
                backoff = min(10 * 2 ** (attempts - 1), 3600)
                update.update({"outbox.$.status": "retry", "outbox.$.next_attempt_at": now + timedelta(seconds=backoff)})
        db.items.update_one(
            {"_id": item_id, "outbox": {"$elemMatch": {"key": entry["key"], "status": "sending"}}},
            {"$set": update, "$unset": {"outbox.$.lease_until": ""},
             "$push": {"outbox.$.history": {"at": now, "outcome": result.outcome, "detail": result.detail[:300]}}})
        return 1
