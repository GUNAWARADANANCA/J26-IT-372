"""Demo reference data for a clean, standalone demonstration (FR18, NFR10).

Creates (only if missing): offices with documented coordinate provenance, one
staff account per role, the transcribed 2026 tariff, the default location
policy and the IoT scale/camera device. Run automatically at start-up when
DEMO_SEED=true, or manually:  python -m app.seed
"""
from __future__ import annotations

import json
import logging
import secrets

from .config import get_settings
from .db import ensure_indexes, get_db
from .security import hash_password, hash_secret
from .services.address.lexicon import REFERENCE_DIR
from .services.location import DEFAULT_POLICY
from .timeutil import utcnow

log = logging.getLogger(__name__)

OSM = "OpenStreetMap {ref} (ODbL) - verify on site before location trials"

OFFICES = [
    {"_id": "MLB-PO", "name": "Malabe Post Office", "type": "post_office", "postcode": "10115",
     "city": "Malabe", "latitude": 6.91470, "longitude": 79.97290, "zone_radius_m": 150, "service_radius_m": 2000,
     "provenance": "trial reference point on the SLIIT Malabe campus, not the post office building - "
                   "set it on site with 'Use my location' on the Offices page"},
    {"_id": "KDW-PO", "name": "Kaduwela Post Office", "type": "post_office", "postcode": "10640", "city": "Kaduwela",
     "latitude": 6.9335663, "longitude": 79.9835762, "zone_radius_m": 120, "service_radius_m": 3000,
     "provenance": OSM.format(ref="node/2755818385")},
    {"_id": "COL-CMX", "name": "Central Mail Exchange, Colombo", "type": "sorting_centre", "postcode": "01000",
     "city": "Colombo 10", "latitude": 6.9325787, "longitude": 79.8515473, "zone_radius_m": 200, "service_radius_m": 3000,
     "provenance": OSM.format(ref="way/528048894")},
    {"_id": "COL-GPO", "name": "General Post Office, Colombo", "type": "post_office", "postcode": "00100",
     "city": "Colombo 01", "latitude": 6.9352820, "longitude": 79.8455950, "zone_radius_m": 120, "service_radius_m": 2500,
     "provenance": OSM.format(ref="node/5279228321")},
    {"_id": "KDY-PC", "name": "Kandy Postal Complex", "type": "post_office", "postcode": "20000", "city": "Kandy",
     "latitude": 7.2903702, "longitude": 80.6320954, "zone_radius_m": 150, "service_radius_m": 4000,
     "provenance": OSM.format(ref="way/286531866")},
    {"_id": "JAF-HPO", "name": "Jaffna Main Post Office", "name_ta": "பிரதான அஞ்சல் அலுவலகம் யாழ்ப்பாணம்",
     "type": "post_office", "postcode": "40000", "city": "Jaffna", "latitude": 9.6651137, "longitude": 80.0099843,
     "zone_radius_m": 150, "service_radius_m": 4000, "provenance": OSM.format(ref="way/236941418")},
]

USERS = [
    ("admin", "System Administrator", "admin", "COL-GPO", []),
    ("counter1", "Counter Officer (Kaduwela)", "counter_officer", "KDW-PO", []),
    ("counter2", "Counter Officer (Malabe)", "counter_officer", "MLB-PO", []),
    ("hub1", "Hub Officer (Central Mail Exchange)", "hub_officer", "COL-CMX", []),
    ("hubjaf", "Hub Officer (Jaffna)", "hub_officer", "JAF-HPO", []),
    ("hub2", "Hub Officer (Malabe)", "hub_officer", "MLB-PO", []),
    ("postman1", "Postman (Jaffna)", "postman", "JAF-HPO", ["40000"]),
    ("postman2", "Postman (Malabe)", "postman", "MLB-PO", []),
    ("pm1", "Postmaster (Jaffna)", "postmaster", "JAF-HPO", []),
    ("pm2", "Postmaster (Malabe)", "postmaster", "MLB-PO", []),
]


def seed(db=None) -> dict:
    s = get_settings()
    db = db if db is not None else get_db()
    ensure_indexes(db)
    now = utcnow()
    created = {"offices": 0, "users": 0, "tariffs": 0, "policies": 0, "devices": 0}

    for office in OFFICES:
        res = db.offices.update_one({"_id": office["_id"]}, {"$setOnInsert": {**office, "created_at": now}}, upsert=True)
        created["offices"] += res.upserted_id is not None

    for username, full_name, role, office_id, beat in USERS:
        res = db.users.update_one({"username": username}, {"$setOnInsert": {
            "username": username, "full_name": full_name, "role": role, "office_id": office_id,
            "beat_postcodes": beat, "active": True, "password_hash": hash_password(s.demo_password),
            "created_at": now}}, upsert=True)
        created["users"] += res.upserted_id is not None

    tariff = json.loads((REFERENCE_DIR / "tariff_slpost_domestic_2026-02-09.json").read_text(encoding="utf-8"))
    tariff.pop("consistency_check", None)
    res = db.tariffs.update_one({"tariff_version": tariff["tariff_version"]},
                                {"$setOnInsert": {**tariff, "loaded_at": now}}, upsert=True)
    created["tariffs"] += res.upserted_id is not None

    res = db.location_policies.update_one({"policy_version": DEFAULT_POLICY["policy_version"]},
                                          {"$setOnInsert": {**DEFAULT_POLICY, "active": True, "activated_at": now,
                                                            "activated_by": "seed"}}, upsert=True)
    created["policies"] += res.upserted_id is not None

    key = s.seed_device_key or secrets.token_urlsafe(24)
    res = db.devices.update_one({"_id": s.seed_device_id}, {"$setOnInsert": {
        "type": "scale_camera", "description": "ESP32-CAM (OV3660) + HX711 + 1 kg load cell", "office_id": "MLB-PO",
        "key_hash": hash_secret(key), "active": True, "created_at": now,
        "calibration": {"status": "uncalibrated", "expanded_uncertainty_g": None}}}, upsert=True)
    if res.upserted_id is not None:
        created["devices"] += 1
        if not s.seed_device_key:
            key_file = s.storage_dir / "seed_device_key.txt"
            key_file.write_text(f"{s.seed_device_id}\n{key}\n", encoding="utf-8")
            log.warning("generated a key for device %s; it is in %s (copy it into the firmware config.h)",
                        s.seed_device_id, key_file)
    if any(created.values()):
        log.info("demo seed: %s", created)
    return created


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(seed())
