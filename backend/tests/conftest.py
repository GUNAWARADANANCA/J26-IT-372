"""Test configuration.

Integration tests need a running MongoDB (default mongodb://127.0.0.1:27017).
Each test session uses a throw-away database that is dropped afterwards.
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

TEST_DB = f"postassist_test_{secrets.token_hex(4)}"
os.environ.update({
    "MONGODB_DB": TEST_DB,
    "OUTBOX_WORKER_ENABLED": "false",
    "DEMO_SEED": "true",
    "DEMO_PASSWORD": "Test#Password1",
    "SEED_DEVICE_ID": "SCALECAM-T1",
    "SEED_DEVICE_KEY": "test-device-key-123",
    "JWT_SECRET": "test-secret-" + secrets.token_hex(24),
    "NOTIFY_EMAIL_ADAPTER": "file",
    "STORAGE_DIR": str(BACKEND / "storage" / "test_runs" / TEST_DB),
    "PUBLIC_BASE_URL": "http://test.local",
})

DEVICE_HEADERS = {"X-Device-Id": "SCALECAM-T1", "X-Device-Key": "test-device-key-123"}
PASSWORD = "Test#Password1"


def _mongo_available() -> bool:
    try:
        from pymongo import MongoClient
        MongoClient(os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017"), serverSelectionTimeoutMS=1500).admin.command("ping")
        return True
    except Exception:  # noqa: BLE001
        return False


MONGO = _mongo_available()
requires_mongo = pytest.mark.skipif(not MONGO, reason="MongoDB is not running")


@pytest.fixture(scope="session")
def client():
    if not MONGO:
        pytest.skip("MongoDB is not running")
    from fastapi.testclient import TestClient

    from pymongo import MongoClient

    from app.main import app
    with TestClient(app) as c:
        yield c
    MongoClient(os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017")).drop_database(TEST_DB)
    import shutil
    shutil.rmtree(os.environ["STORAGE_DIR"], ignore_errors=True)


@pytest.fixture(scope="session")
def tokens(client):
    out = {}
    for user in ("counter2", "counter1", "hubdemo", "hub1", "hubjaf", "postman1", "postman2", "pm1", "pm2", "admin"):
        r = client.post("/api/auth/login", json={"username": user, "password": PASSWORD})
        assert r.status_code == 200, r.text
        out[user] = {"Authorization": f"Bearer {r.json()['token']}"}
    return out
