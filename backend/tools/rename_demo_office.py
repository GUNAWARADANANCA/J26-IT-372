"""One-off migration: SLIIT-DEMO "SLIIT Malabe demo counter" -> MLB-PO "Malabe Post Office".

Also drops "(SLIIT demo)" from the four staff names and renames the account
hubdemo -> hub2 (matching counter2 / postman2 / pm2). The office keeps its
current reference point and radii, so campus trials behave as before.

Every affected collection is written to storage/backups/<timestamp>/ first.
The audit log is history and is left as it was; one entry records the rename.
Safe to run twice: the second run finds nothing to change.

    cd backend
    .venv\\Scripts\\python.exe tools\\rename_demo_office.py [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bson import json_util

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.audit import audit  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.timeutil import utcnow  # noqa: E402

OLD_ID, NEW_ID = "SLIIT-DEMO", "MLB-PO"
OLD_NAME, NEW_NAME = "SLIIT Malabe demo counter", "Malabe Post Office"
OLD_USER, NEW_USER = "hubdemo", "hub2"
FULL_NAMES = {
    "counter2": "Counter Officer (Malabe)",
    NEW_USER: "Hub Officer (Malabe)",
    "postman2": "Postman (Malabe)",
    "pm2": "Postmaster (Malabe)",
}
PROVENANCE = ("trial reference point on the SLIIT Malabe campus, not the post office building - "
              "set it on site with 'Use my location' on the Offices page")
COLLECTIONS = ("offices", "users", "devices", "drafts", "images", "items", "notifications", "scan_queue")
USER_KEYS = {"worker", "actor", "username", "created_by", "decided_by", "reviewed_by", "updated_by"}


def rewrite(value, key=None):
    """Return value with the old office id/name and username replaced, recursively."""
    if isinstance(value, dict):
        return {k: v if k == "_id" else rewrite(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite(v, key) for v in value]
    if isinstance(value, str):
        if value == OLD_ID:
            return NEW_ID
        if value == OLD_USER and key in USER_KEYS:
            return NEW_USER
        return value.replace(OLD_NAME, NEW_NAME)
    return value


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="count the changes without writing")
    args = ap.parse_args()

    db = get_db()
    names = set(db.list_collection_names())
    collections = [c for c in COLLECTIONS if c in names]

    if not args.dry_run:
        backup = get_settings().storage_dir / "backups" / f"rename_office_{utcnow():%Y%m%dT%H%M%SZ}"
        backup.mkdir(parents=True, exist_ok=True)
        for c in collections:
            (backup / f"{c}.json").write_text(json_util.dumps(list(db[c].find()), indent=1), encoding="utf-8")
        print(f"backup: {backup}")

    # A running API with DEMO_SEED=true re-seeds as soon as seed.py changes, so the new office and
    # account may already exist as fresh, unused copies. The old records win: they carry the history.
    old_office = db.offices.find_one({"_id": OLD_ID})
    if old_office:
        new_office = {**old_office, "_id": NEW_ID, "name": NEW_NAME, "provenance": PROVENANCE, "updated_at": utcnow()}
        if not args.dry_run:
            db.offices.delete_one({"_id": NEW_ID})
            db.offices.insert_one(new_office)
            db.offices.delete_one({"_id": OLD_ID})
        print(f"offices: {OLD_ID} -> {NEW_ID} ({NEW_NAME})")

    if db.users.find_one({"username": OLD_USER}):
        if db.users.find_one({"username": NEW_USER}) and db.audit_log.find_one({"actor": NEW_USER}):
            sys.exit(f"{NEW_USER} already exists and has been used - rename {OLD_USER} by hand")
        if not args.dry_run:
            db.users.delete_one({"username": NEW_USER})
            db.users.update_one({"username": OLD_USER}, {"$set": {"username": NEW_USER}})
        print(f"users: {OLD_USER} -> {NEW_USER}")

    for c in collections:
        changed = 0
        for doc in db[c].find():
            new = rewrite(doc)
            if new != doc:
                changed += 1
                if not args.dry_run:
                    db[c].replace_one({"_id": doc["_id"]}, new)
        print(f"{c}: {changed} document(s) updated")

    for username, full_name in FULL_NAMES.items():
        if not args.dry_run:
            db.users.update_one({"username": username, "office_id": NEW_ID}, {"$set": {"full_name": full_name}})

    if not args.dry_run and old_office:
        audit("system", "office.renamed", NEW_ID, {"from_id": OLD_ID, "from_name": OLD_NAME, "to_name": NEW_NAME,
                                                   "account_renamed": {OLD_USER: NEW_USER}})
    print("dry run - nothing written" if args.dry_run else "done")


if __name__ == "__main__":
    main()
