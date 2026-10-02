"""MongoDB connection and index definitions.

Design note (proposal section 3.11, "transactional outbox"): a registered item
is stored as one document that embeds its event history and its notification
outbox. MongoDB updates a single document atomically, so a status change, the
event that caused it and the notification it triggers are committed together
(or not at all) without needing a replica set for multi-document
transactions. Optimistic concurrency uses the item's ``revision`` field.
"""
from __future__ import annotations

from datetime import timezone
from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, IndexModel, MongoClient
from pymongo.database import Database

from .config import get_settings


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    s = get_settings()
    return MongoClient(s.mongodb_uri, tz_aware=True, tzinfo=timezone.utc, serverSelectionTimeoutMS=5000)


def get_db() -> Database:
    return get_client()[get_settings().mongodb_db]


INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("username", ASCENDING)], unique=True)],
    "devices": [IndexModel([("office_id", ASCENDING)])],
    "device_readings": [
        IndexModel([("device_id", ASCENDING), ("received_at", DESCENDING)]),
        # Raw readings are diagnostic only; paired readings are copied into the draft/item.
        IndexModel([("received_at", ASCENDING)], expireAfterSeconds=3 * 24 * 3600),
    ],
    "device_commands": [IndexModel([("device_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)])],
    "captures": [IndexModel([("device_id", ASCENDING), ("status", ASCENDING)])],
    "images": [IndexModel([("draft_id", ASCENDING)])],
    "drafts": [
        IndexModel([("status", ASCENDING), ("office_id", ASCENDING), ("updated_at", DESCENDING)]),
        # One scale placement can only be paired to one open draft (test T03).
        IndexModel([("weight.placement_key", ASCENDING)], unique=True,
                   partialFilterExpression={"weight.placement_key": {"$exists": True}}),
    ],
    "items": [
        IndexModel([("draft_id", ASCENDING)], unique=True),  # repeated acceptance -> same item (T05)
        IndexModel([("weight.placement_key", ASCENDING)], unique=True,
                   partialFilterExpression={"weight.placement_key": {"$exists": True}}),
        IndexModel([("status", ASCENDING), ("destination_office_id", ASCENDING)]),
        IndexModel([("events.event_id", ASCENDING)], unique=True, sparse=True),
        IndexModel([("events.review.status", ASCENDING)]),
        IndexModel([("outbox.status", ASCENDING), ("outbox.next_attempt_at", ASCENDING)]),
        IndexModel([("accepted_at", DESCENDING)]),
    ],
    "tariffs": [IndexModel([("tariff_version", ASCENDING)], unique=True)],
    "location_policies": [IndexModel([("policy_version", ASCENDING)], unique=True)],
    "weighing_trials": [IndexModel([("device_id", ASCENDING), ("created_at", ASCENDING)])],
    "audit_log": [IndexModel([("at", DESCENDING)]), IndexModel([("target", ASCENDING), ("at", DESCENDING)]),
                  IndexModel([("action", ASCENDING)])],
}


def ensure_indexes(db: Database | None = None) -> None:
    db = db if db is not None else get_db()
    for name, models in INDEXES.items():
        db[name].create_indexes(models)
