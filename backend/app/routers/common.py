"""Small helpers shared by the routers."""
from __future__ import annotations

from fastapi import HTTPException, status

from ..db import get_db


def not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


def get_or_404(collection: str, _id: str, what: str | None = None) -> dict:
    doc = get_db()[collection].find_one({"_id": _id})
    if doc is None:
        raise not_found(what or collection[:-1])
    return doc


def problem(code: str, message: str, http: int = status.HTTP_409_CONFLICT, **extra) -> HTTPException:
    return HTTPException(http, {"code": code, "message": message, **extra})


def same_office(user: dict, office_id: str | None) -> None:
    if user["role"] != "admin" and user.get("office_id") != office_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "this record belongs to another office")
