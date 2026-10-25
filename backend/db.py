"""MongoDB connection for the PostAssist backend."""

import os

from pymongo import MongoClient
from pymongo.database import Database

_client: MongoClient | None = None


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
    if _client is None:
        _client = MongoClient(_uri(), serverSelectionTimeoutMS=8000)
        _client.admin.command("ping")
        print("You successfully connected to MongoDB!")
    return _client


def disconnect() -> None:
    """Close the client. Call this when the process exits."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_db() -> Database:
    name = (os.environ.get("KPI_MONGODB_DB", "").strip() or os.environ.get("MONGODB_DB", "postassist").strip()
            or "postassist")
    return connect()[name]
