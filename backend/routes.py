"""CRUD, Excel import, and Excel export for the desk collections."""

import re

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError

from attendance import (
    assert_at_office,
    get_settings,
    record_scan,
    save_settings,
)
from db import get_db
from excel_io import export_employees, export_kpi_logs, import_workbook

router = APIRouter(prefix="/api")

DOCTYPES = ("employee", "daily_kpi_log", "attendance_log")

# Dropdowns that can grow. Values already stored on documents are included too.
CREATABLE_FIELDS = {
    "post_office": ("employee", "post_office"),
    "designation": ("employee", "designation"),
    "work_category": ("employee", "work_category"),
    "employment_type": ("employee", "employment_type"),
    "reward_type": ("employee", "reward_type"),
    "primary_task_type": ("daily_kpi_log", "primary_task_type"),
}


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


@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload an .xlsx Excel file")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="The Excel file is empty")
    try:
        return import_workbook(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/export/employee")
def export_employee_excel():
    return Response(
        content=export_employees(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="employees.xlsx"'},
    )


@router.get("/export/daily_kpi_log")
def export_kpi_excel():
    return Response(
        content=export_kpi_logs(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="daily_kpi_logs.xlsx"'},
    )


@router.get("/field-options")
def list_field_options():
    db = get_db()
    stored = list(db["field_option"].find())
    grouped = {field: set() for field in CREATABLE_FIELDS}
    for row in stored:
        field = row.get("field")
        value = str(row.get("value") or "").strip()
        if field in grouped and value:
            grouped[field].add(value)
    for field, (collection, key) in CREATABLE_FIELDS.items():
        for value in db[collection].distinct(key):
            text = str(value or "").strip()
            if text:
                grouped[field].add(text)
    return {
        field: sorted(values, key=str.lower) for field, values in grouped.items()
    }


@router.post("/field-options")
def create_field_option(body: dict):
    field = str(body.get("field") or "").strip()
    value = str(body.get("value") or "").strip()
    if field not in CREATABLE_FIELDS:
        raise HTTPException(status_code=400, detail="This field does not allow new values")
    if not value:
        raise HTTPException(status_code=400, detail="Enter a value")

    collection = get_db()["field_option"]
    existing = collection.find_one(
        {
            "field": field,
            "value": {"$regex": f"^{re.escape(value)}$", "$options": "i"},
        }
    )
    if existing:
        return {"field": field, "value": existing["value"]}

    collection.insert_one({"_id": f"{field}:{value}", "field": field, "value": value})
    return {"field": field, "value": value}


@router.get("/settings/attendance")
def read_attendance_settings():
    return get_settings()


@router.put("/settings/attendance")
def update_attendance_settings(body: dict):
    return save_settings(body)


@router.post("/attendance/location")
def check_attendance_location(body: dict):
    try:
        latitude = float(body.get("latitude"))
        longitude = float(body.get("longitude"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Location is required") from exc
    return assert_at_office(latitude, longitude)


@router.post("/attendance/scan")
def scan_attendance(body: dict):
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Choose your name")
    try:
        latitude = float(body.get("latitude"))
        longitude = float(body.get("longitude"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Location is required") from exc
    accuracy = body.get("accuracy")
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (TypeError, ValueError):
            accuracy = None
    return record_scan(employee_id, latitude, longitude, accuracy)


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
