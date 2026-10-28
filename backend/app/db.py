"""MongoDB connection and index definitions.

Design note (proposal section 3.11, "transactional outbox"): a registered item
is stored as one document that embeds its event history and its notification
outbox. MongoDB updates a single document atomically, so a status change, the
event that caused it and the notification it triggers are committed together
(or not at all) without needing a replica set for multi-document
transactions. Optimistic concurrency uses the item's ``revision`` field.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import sys
import time
from datetime import timezone
from functools import lru_cache
from urllib.parse import urlsplit

from pymongo import ASCENDING, DESCENDING, IndexModel, MongoClient
from pymongo.errors import PyMongoError
from pymongo.database import Database

from .config import get_settings

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    s = get_settings()
    return MongoClient(s.mongodb_uri, tz_aware=True, tzinfo=timezone.utc, serverSelectionTimeoutMS=5000)


def get_db() -> Database:
    return get_client()[get_settings().mongodb_db]


def local_address(uri: str) -> tuple[str, int] | None:
    """(host, port) when the URI points at this computer, else None (Atlas, another server)."""
    if not uri.startswith("mongodb://"):
        return None
    parts = urlsplit(uri)
    if "," in parts.netloc or parts.hostname not in ("127.0.0.1", "localhost", "::1"):
        return None
    return parts.hostname, parts.port or 27017


def _answers(uri: str) -> bool:
    try:
        MongoClient(uri, serverSelectionTimeoutMS=1500).admin.command("ping")
        return True
    except PyMongoError:
        return False


def ensure_server(wait_s: float = 25.0) -> None:
    """Make sure MongoDB answers before the API starts.

    On a development laptop the database is often simply not running yet. When the URI points
    at this computer, the local mongod (MONGOD_PATH, default %USERPROFILE%\\PostAssist\\mongodb)
    is started as a background process without a window, so it keeps running when this
    terminal is closed. Anything else gets a clear message instead of a stack of pymongo frames.
    """
    s = get_settings()
    if _answers(s.mongodb_uri):
        return
    address = local_address(s.mongodb_uri)
    mongod = s.mongod_path if s.mongod_path.exists() else shutil.which("mongod")
    if not (s.mongodb_autostart and address and mongod):
        raise RuntimeError(
            f"MongoDB does not answer at {s.mongodb_uri}. Start it first (Documents/Setup_and_Run_Guide.md section 1)"
            + ("" if mongod else f"; no mongod found at {s.mongod_path} or on PATH") + ".")
    s.mongod_dbpath.mkdir(parents=True, exist_ok=True)
    args = [str(mongod), "--dbpath", str(s.mongod_dbpath), "--bind_ip", address[0], "--port", str(address[1]),
            "--logpath", str(s.mongod_dbpath.parent / "mongod.log"), "--logappend"]
    log.warning("MongoDB is not running - starting %s", mongod)
    quiet = {"stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "close_fds": True}
    if sys.platform == "win32":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        try:   # leave the terminal's job too, so closing the terminal does not stop the database
            subprocess.Popen(args, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **quiet)
        except OSError:
            subprocess.Popen(args, creationflags=flags, **quiet)
    else:
        subprocess.Popen(args, start_new_session=True, **quiet)
    deadline = time.monotonic() + wait_s
    while time.monotonic() < deadline:
        if _answers(s.mongodb_uri):
            log.warning("MongoDB started (data in %s); it keeps running in the background", s.mongod_dbpath)
            return
        time.sleep(1)
    raise RuntimeError(f"Started {mongod} but it did not answer within {wait_s:.0f} s; see {s.mongod_dbpath.parent / 'mongod.log'}")


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
