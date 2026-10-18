"""MongoDB connection for the PostAssist backend."""

import os
import socket
import threading

from pymongo import MongoClient
from pymongo.database import Database

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
    # KPI_MONGODB_URI lets this desk use its own server while registered mail (app/) shares
    # backend/.env; without it the desk uses MONGODB_URI as before.
    uri = os.environ.get("KPI_MONGODB_URI", "").strip() or os.environ.get("MONGODB_URI", "").strip()
    if not uri or "<db_password>" in uri:
        raise RuntimeError(
            "Set KPI_MONGODB_URI (or MONGODB_URI) in backend/.env and replace <db_password> "
            "with the Atlas database user password."
        )
    return uri


def connect() -> MongoClient:
    """Open the shared client and confirm Atlas is reachable."""
    global _client
    with _lock:
        if _client is not None:
            return _client
        client = MongoClient(
            _uri(),
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=20000,
        )
        _client = client
    try:
        client.admin.command("ping")
    except Exception:
        disconnect()
        raise
    print("You successfully connected to MongoDB!", flush=True)
    return client


def disconnect() -> None:
    """Close the client. Call this when the process exits."""
    global _client
    with _lock:
        if _client is not None:
            _client.close()
            _client = None


def reset_client() -> None:
    """Drop a client whose sockets were closed by Atlas so the next request reconnects."""
    disconnect()


def get_db() -> Database:
    name = (os.environ.get("KPI_MONGODB_DB", "").strip() or os.environ.get("MONGODB_DB", "postassist").strip()
            or "postassist")
    return connect()[name]
