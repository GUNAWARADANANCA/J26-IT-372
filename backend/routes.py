"""CRUD for the three desk collections."""

from fastapi import APIRouter, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from db import get_db

router = APIRouter(prefix="/api")

DOCTYPES = ("employee", "daily_kpi_log", "attendance_log")


def _collection(doctype: str):
    if doctype not in DOCTYPES:
        raise HTTPException(status_code=404, detail=f"Unknown doctype {doctype}")
    return get_db()[doctype]


def _public(doc: dict) -> dict:
    return {key: value for key, value in doc.items() if key != "_id"}


def _require_name(doc: dict) -> str:
    name = str(doc.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Document name is required")
    return name


@router.get("/{doctype}")
def list_docs(doctype: str, request: Request, search: str = ""):
    collection = _collection(doctype)
    query = {}
    for key, value in request.query_params.items():
        if key == "search" or value == "":
            continue
        query[key] = value

    rows = [_public(doc) for doc in collection.find(query)]
    needle = search.strip().lower()
    if needle:
        rows = [
            row
            for row in rows
            if any(needle in str(value).lower() for value in row.values())
        ]
    return rows


@router.get("/{doctype}/{name:path}")
def get_doc(doctype: str, name: str):
    collection = _collection(doctype)
    doc = collection.find_one({"_id": name})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")
    return _public(doc)


@router.post("/{doctype}", status_code=201)
def create_doc(doctype: str, doc: dict):
    collection = _collection(doctype)
    name = _require_name(doc)
    stored = {key: value for key, value in doc.items() if key != "_id"}
    stored["name"] = name
    stored["_id"] = name
    try:
        collection.insert_one(stored)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409, detail=f"Document {name} already exists"
        ) from None
    return _public(stored)


@router.put("/{doctype}/{name:path}")
def update_doc(doctype: str, name: str, doc: dict):
    collection = _collection(doctype)
    current = collection.find_one({"_id": name})
    if current is None:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")

    next_name = _require_name({**doc, "name": doc.get("name") or name})
    stored = {key: value for key, value in doc.items() if key != "_id"}
    stored["name"] = next_name
    stored["_id"] = next_name

    if next_name != name:
        if collection.find_one({"_id": next_name}):
            raise HTTPException(
                status_code=409, detail=f"Document {next_name} already exists"
            )
        collection.delete_one({"_id": name})
        collection.insert_one(stored)
    else:
        collection.replace_one({"_id": name}, stored)
    return _public(stored)


@router.delete("/{doctype}/{name:path}")
def delete_doc(doctype: str, name: str):
    collection = _collection(doctype)
    result = collection.delete_one({"_id": name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")
    return {"ok": True}
