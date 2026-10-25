"""Registered-letter state model (proposal section 4.5, figure 6).

Mail status, location assessment and event decision are kept as three separate
dimensions, so a poor GPS fix is never mistaken for a transport state.
"""
from __future__ import annotations

STATUSES = [
    "accepted", "dispatched", "in_transit", "at_destination_office", "out_for_delivery",
    "delivery_attempted", "delivered", "return_started", "returned_to_sender",
]
TERMINAL = {"delivered", "returned_to_sender"}

LABELS = {
    "accepted": "Accepted at counter",
    "dispatched": "Dispatched from origin office",
    "in_transit": "In transit (handover scan)",
    "at_destination_office": "Arrived at destination office",
    "out_for_delivery": "Out for delivery",
    "delivery_attempted": "Delivery attempted",
    "delivered": "Delivered",
    "return_started": "Return to sender started",
    "returned_to_sender": "Returned to sender",
}

_FORWARD = {
    "accepted": {"dispatched"},
    "dispatched": {"in_transit", "at_destination_office"},
    "in_transit": {"in_transit", "at_destination_office"},
    "at_destination_office": {"out_for_delivery", "return_started"},
    "out_for_delivery": {"delivered", "delivery_attempted"},
    "delivery_attempted": {"out_for_delivery", "at_destination_office", "return_started"},
    "return_started": {"in_transit", "returned_to_sender"},
    "delivered": set(),
    "returned_to_sender": set(),
}
_RETURN = {**_FORWARD, "in_transit": {"in_transit", "returned_to_sender"}}

# Order along the normal forward journey, used to recognise late history events.
FORWARD_ORDER = {s: i for i, s in enumerate(STATUSES[:7])}

# Which role may record which status. Postmasters may record return events and
# act on review; admin may do everything (handled in require_roles).
ROLE_STATUSES = {
    "counter_officer": {"dispatched"},
    "hub_officer": {"dispatched", "in_transit", "at_destination_office"},
    "postman": {"out_for_delivery", "delivery_attempted", "delivered"},
    "postmaster": set(STATUSES) - {"accepted"},
    "admin": set(STATUSES) - {"accepted"},
}

# Statuses that always notify an opted-in sender; transit scans only notify
# senders who asked for "all" updates (suppresses repetitive messages).
KEY_NOTIFY = {"accepted", "out_for_delivery", "delivery_attempted", "delivered", "return_started", "returned_to_sender"}
TRANSIT_NOTIFY = {"dispatched", "in_transit", "at_destination_office"}


def allowed_next(status: str, direction: str = "forward") -> set[str]:
    return (_RETURN if direction == "return" else _FORWARD).get(status, set())


def is_valid_transition(current: str, requested: str, direction: str = "forward") -> bool:
    return requested in allowed_next(current, direction)


def is_late_history(current: str, requested: str, direction: str = "forward") -> bool:
    """A scan of an earlier forward stage that arrives after the item moved on.

    Example (test T13): an offline 'in_transit' scan synchronised after the
    item was already 'delivered'. It is kept in history but must not regress
    the current state.
    """
    if direction != "forward":
        return requested in FORWARD_ORDER and current in ("return_started", "in_transit", "returned_to_sender")
    if current in FORWARD_ORDER and requested in FORWARD_ORDER:
        return FORWARD_ORDER[requested] < FORWARD_ORDER[current] or (
            current in TERMINAL and requested != current)
    return False


def should_notify(status: str, preference: str) -> bool:
    if preference == "none":
        return False
    if status in KEY_NOTIFY:
        return True
    return preference == "all" and status in TRANSIT_NOTIFY
