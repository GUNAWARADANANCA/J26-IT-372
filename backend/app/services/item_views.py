"""How a registered item is presented to staff and to the public (privacy, FR15/NFR06)."""
from __future__ import annotations

from ..timeutil import local_str
from . import state_machine as sm
from .scan_events import tracking_link

DELAY_NOTE_SECONDS = 600


def staff_view(item: dict, *, include_outbox: bool = True) -> dict:
    view = {k: v for k, v in item.items() if k not in ("public_access", "outbox")}
    view["tracking_id"] = item["_id"]
    view["status_label"] = sm.LABELS.get(item["status"], item["status"])
    view["tracking_link"] = tracking_link(item)
    view["allowed_next"] = sorted(sm.allowed_next(item["status"], item.get("direction", "forward")))
    if include_outbox:
        view["outbox"] = [{k: v for k, v in e.items() if k != "variables"} for e in item.get("outbox", [])]
    return view


def public_timeline(item: dict, offices: dict[str, str]) -> dict:
    """Sender view: accepted events only, coarse place labels, no coordinates,
    no worker identities, no acknowledgement details (proposal 4.5)."""
    events = []
    for e in item.get("events", []):
        if e.get("decision") not in ("accepted", "accepted_after_review"):
            continue
        ref = (e.get("assessment") or {}).get("reference") or {}
        place = offices.get(e.get("worker_office_id") or "", "")
        if ref.get("type", "").startswith("office") and e["assessment"].get("result") == "consistent":
            place = ref.get("label") or place
        delay = e.get("sync_delay_s") or 0
        events.append({
            "status": e["requested_status"], "status_label": sm.LABELS.get(e["requested_status"], e["requested_status"]),
            "captured_at": e["captured_at"], "captured_local": local_str(e["captured_at"]),
            "place": place, "history_only": not e.get("applied_to_state", True),
            "synchronised_later": delay > DELAY_NOTE_SECONDS,
            "received_local": local_str(e.get("received_at")) if delay > DELAY_NOTE_SECONDS else None,
        })
    events.sort(key=lambda x: x["captured_at"])
    recipient = item.get("recipient", {})
    return {
        "tracking_id": item["_id"],
        "status": item["status"], "status_label": sm.LABELS.get(item["status"], item["status"]),
        "accepted_local": local_str(item.get("accepted_at")),
        "origin_office": offices.get(item["origin_office_id"], ""),
        "destination_town": recipient.get("city", ""),
        "events": events,
        "notice": "Status is recorded when authorised staff scan the item. Locations are shown as office names only; "
                  "the map position of a scan is not proof of delivery.",
    }
