"""MongoDB connection for the PostAssist backend."""

import os
import socket
import threading
from dotenv import load_dotenv

load_dotenv()

import dns.resolver
from pymongo import MongoClient
from pymongo.database import Database

# Configure resilient DNS resolution for mongodb+srv:// to prevent SRV lookup hangs on local gateways
try:
    _res = dns.resolver.get_default_resolver()
    for _ns in ["8.8.8.8", "1.1.1.1"]:
        if _ns not in _res.nameservers:
            _res.nameservers.append(_ns)
    _res.lifetime = 4.0
except Exception:
    pass

_client: MongoClient | None = None
_lock = threading.Lock()

# This network publishes DNS64 addresses. Atlas closes TLS on that path.
_original_getaddrinfo = socket.getaddrinfo


def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        ipv4 = _original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
    except socket.gaierror:
        ipv4 = []
    if ipv4:
        return ipv4
    return _original_getaddrinfo(host, port, family, type, proto, flags)


socket.getaddrinfo = _ipv4_getaddrinfo


def _uri() -> str:
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri or "<db_password>" in uri:
        raise RuntimeError(
            "Set MONGODB_URI in backend/.env and replace <db_password> "
            "with the Atlas database user password."
        )
    return uri


def connect() -> MongoClient:
    """Open the shared client and confirm Atlas is reachable."""
    global _client
    with _lock:
        if _client is not None:
            topology = getattr(_client, "_topology", None)
            if topology is not None and not getattr(topology, "_closed", False):
                return _client
            _client = None

        client = MongoClient(
            _uri(),
            serverSelectionTimeoutMS=20000,
            connectTimeoutMS=15000,
            socketTimeoutMS=15000,
            maxIdleTimeMS=45000,
            retryWrites=True,
            retryReads=True,
            readPreference="primaryPreferred",
            maxPoolSize=50,
            minPoolSize=0,
        )
        _client = client
    try:
        from pymongo import ReadPreference
        client.admin.command("ping", read_preference=ReadPreference.NEAREST)
    except Exception:
        disconnect()
        raise
    print("You successfully connected to MongoDB!", flush=True)
    return client


def init_performance_indexes() -> None:
    """Ensure essential indexes for high-throughput queries exist in MongoDB."""
    try:
        d = get_db()
        d["employee"].create_index([("employee_id", 1)], background=True)
        d["employee"].create_index([("post_office", 1)], background=True)
        d["attendance_log"].create_index([("date", 1)], background=True)
        d["attendance_log"].create_index([("date", 1), ("post_office", 1)], background=True)
        d["attendance_log"].create_index([("employee_id", 1)], background=True)
        d["daily_kpi"].create_index([("date", 1)], background=True)
        d["daily_kpi"].create_index([("employee_id", 1), ("date", 1)], background=True)
        d["employee_attendance_credential"].create_index([("employee_id", 1)], unique=True, background=True)
        d["sessions"].create_index([("expires_at", 1)], background=True)
        d["sessions"].create_index([("username", 1)], background=True)
    except Exception as exc:
        print(f"Warning: index initialization skipped or failed: {exc}", flush=True)


def disconnect() -> None:
    """Close the client. Call this when the process exits."""
    global _client
    with _lock:
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
            _client = None


def reset_client() -> None:
    """Drop a client whose sockets were closed by Atlas so the next request reconnects."""
    disconnect()


def get_db() -> Database:
    name = os.environ.get("MONGODB_DB", "postassist").strip() or "postassist"
    try:
        return connect()[name]
    except Exception:
        # Retry once after reset if connection failed or client was closed
        reset_client()
        return connect()[name]
