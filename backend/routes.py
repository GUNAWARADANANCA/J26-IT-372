"""CRUD, Excel import, and Excel export for the desk collections."""

import re
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile
from pymongo.errors import DuplicateKeyError

from auth import COOKIE, bootstrap_postmaster, cookie_settings, current_user, login, logout, password_help, require_postmaster
from attendance import (
    assert_at_office,
    assert_attendance_writable,
    close_attendance_day,
    colombo_today,
    daily_attendance,
    get_location_config,
    get_settings,
    issue_door_token,
    manage_qr_location,
    open_attendance_day,
    parse_attendance_date,
    save_settings,
    submit_scan,
    validate_gps_location,
    verify_door_token,
)
from db import get_db
from excel_io import export_employees, export_kpi_logs, import_workbook
from performance_review import allocation_plan, approve_allocation, confirm_overtime, promotion_board
from productivity import (
    forecast_monitoring,
    productivity_for,
    save_measured_forecast,
    save_scenario_forecast,
    simulate_productivity,
)
from kpi_forecast import forecast_detail, generate_forecasts, list_forecasts, summary as kpi_summary
from rf_kpi_preview import RandomForestPreview, preview_next_week_kpi
from powerbi_embed import embed_for, status as powerbi_status
from reporting import DATASETS, dataset_csv, dataset_page, workbook_bytes
from postal_kpi import dashboard as postal_kpi_dashboard
from coach import answer as coach_answer, coach_activity, coach_for, save_follow_up
from payroll import (
    create_entitlement,
    delete_entitlement,
    gratuity_board,
    list_entitlements,
    payroll_rows,
    save_gratuity,
)

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
async def import_excel(request: Request, file: UploadFile = File(...)):
    require_postmaster(request)
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
def export_employee_excel(request: Request):
    require_postmaster(request)
    return Response(
        content=export_employees(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="employees.xlsx"'},
    )


@router.get("/export/daily_kpi_log")
def export_kpi_excel(request: Request):
    require_postmaster(request)
    return Response(
        content=export_kpi_logs(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="daily_kpi_logs.xlsx"'},
    )


@router.get("/field-options")
def list_field_options(request: Request):
    require_postmaster(request)
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
def create_field_option(request: Request, body: dict):
    require_postmaster(request)
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
def read_attendance_settings(request: Request):
    require_postmaster(request)
    return get_settings()


@router.put("/settings/attendance")
def update_attendance_settings(request: Request, body: dict):
    require_postmaster(request)
    return save_settings(body)


@router.get("/attendance/location-info")
def read_attendance_location_info(location_id: str = ""):
    return get_location_config(location_id or None)


@router.get("/attendance/location/{location_id}")
def read_attendance_location_by_id(location_id: str):
    return get_location_config(location_id)


@router.post("/attendance/validate-location")
def validate_attendance_gps(body: dict):
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
    return validate_gps_location(
        latitude,
        longitude,
        accuracy,
        str(body.get("qr_location_id") or body.get("location_id") or "").strip() or None,
    )


@router.post("/attendance/qr-manage")
def update_qr_location(request: Request, body: dict):
    require_postmaster(request)
    return manage_qr_location(
        str(body.get("action") or ""),
        body.get("office_name"),
        body.get("office_id"),
    )


@router.post("/attendance/location")
def check_attendance_location(body: dict):
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
    location_id = str(body.get("qr_location_id") or body.get("location_id") or "").strip() or None
    result = assert_at_office(latitude, longitude, accuracy, location_id)
    return {
        "ok": True,
        "distance_meters": result["distance_meters"],
        "radius_meters": result["radius_meters"],
        "geofence_status": result.get("geofence_status", "Passed"),
        "office_id": result.get("office_id"),
        "office_name": result.get("office_name"),
        "qr_location_id": result.get("qr_location_id"),
    }


@router.get("/attendance/door-token")
def read_door_token(request: Request, port: str = "", location_id: str = ""):
    require_postmaster(request)
    detected_port = port.strip()
    if not detected_port:
        referer = str(request.headers.get("referer") or request.headers.get("origin") or "")
        match = re.search(r":(\d{2,5})(?:/|$)", referer)
        if match:
            detected_port = match.group(1)
    return issue_door_token(location_id or None, detected_port or None)


@router.post("/attendance/verify-token")
def verify_attendance_token(body: dict):
    token = str(body.get("door_token") or body.get("code") or "").strip()
    location_id = str(body.get("qr_location_id") or body.get("location_id") or "").strip() or None
    verified = verify_door_token(token)
    config = get_location_config(location_id)
    parts = verified.split(".")
    expires_at = int(parts[1])
    now = int(datetime.now().timestamp())
    return {
        "valid": True,
        "expires_at": expires_at,
        "expires_in_seconds": max(0, expires_at - now),
        "qr_location_id": config["qr_location_id"],
        "office_id": config["office_id"],
        "office_name": config["office_name"],
        "radius_meters": config["radius_meters"],
    }


@router.post("/attendance/scan")
def scan_attendance(request: Request, body: dict):
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
    client = request.client.host if request.client else "unknown"
    qr_location_id = str(body.get("qr_location_id") or "").strip() or None
    requested_action = str(body.get("action") or "").strip().lower() or None
    device_info = str(body.get("device_info") or request.headers.get("user-agent") or "").strip()
    return submit_scan(
        employee_id,
        latitude,
        longitude,
        accuracy,
        body.get("door_token"),
        client,
        str(request.headers.get("x-request-id") or ""),
        qr_location_id=qr_location_id,
        requested_action=requested_action,
        device_info=device_info,
    )


@router.get("/attendance/roster")
def attendance_roster():
    """Names for the door page. Salary and KPI fields are not included."""
    today = colombo_today()
    today_logs = {
        str(log.get("employee_id") or ""): log
        for log in get_db()["attendance_log"].find({"date": today})
    }
    rows = []
    for doc in get_db()["employee"].find({}):
        emp_id = doc.get("employee_id") or doc.get("_id")
        log = today_logs.get(str(emp_id)) or today_logs.get(str(doc.get("_id"))) or {}
        rows.append(
            {
                "name": doc.get("_id"),
                "employee_id": emp_id,
                "employee_name": doc.get("employee_name") or "",
                "post_office": doc.get("post_office") or "",
                "today_check_in": log.get("fingerprint_in") or log.get("check_in_time") or None,
                "today_check_out": log.get("fingerprint_out") or log.get("check_out_time") or None,
            }
        )
    return rows


@router.get("/payroll")
def read_payroll(request: Request, month: str):
    require_postmaster(request)
    return payroll_rows(month)


@router.get("/gratuity")
def read_gratuity(request: Request):
    require_postmaster(request)
    return gratuity_board()


@router.post("/gratuity")
def store_gratuity(request: Request):
    require_postmaster(request)
    return save_gratuity()


@router.get("/entitlements/{module}")
def read_entitlements(module: str, request: Request):
    require_postmaster(request)
    return list_entitlements(module)


@router.post("/entitlements/{module}", status_code=201)
def add_entitlement(module: str, request: Request, body: dict):
    require_postmaster(request)
    return create_entitlement(module, body)


@router.delete("/entitlements/{module}/{item_id}")
def remove_entitlement(module: str, item_id: str, request: Request):
    require_postmaster(request)
    return delete_entitlement(module, item_id)


@router.get("/productivity/{employee_id}")
def read_productivity(employee_id: str, request: Request, week: str | None = None):
    require_postmaster(request)
    return productivity_for(employee_id, week)


@router.post("/productivity/{employee_id}/simulate")
def simulate_employee_productivity(employee_id: str, request: Request, body: dict):
    require_postmaster(request)
    return simulate_productivity(employee_id, (body or {}).get("scenarios"))


@router.post("/auth/forgot-password")
def forgot_password(body: dict | None = None):
    return password_help(str((body or {}).get("username") or ""))


@router.post("/auth/login")
def sign_in(body: dict, response: Response):
    result = login(str((body or {}).get("username") or ""), str((body or {}).get("password") or ""))
    settings = cookie_settings()
    response.set_cookie(value=result["session_id"], **settings)
    return {
        "username": result["username"],
        "role": result["role"],
        "csrf_token": result["csrf_token"],
        "expires_at": result["expires_at"],
    }


@router.post("/auth/logout")
def sign_out(request: Request, response: Response):
    user = current_user(request)
    logout(request)
    response.delete_cookie(COOKIE, path="/", samesite="lax", secure=cookie_settings()["secure"])
    return {"username": user["username"], "signed_out": True}


@router.get("/auth/me")
def who_am_i(request: Request):
    return current_user(request)


@router.post("/productivity/{employee_id}/forecasts")
def save_employee_forecast(employee_id: str, request: Request, body: dict | None = None):
    require_postmaster(request)
    body = body or {}
    if body.get("source") == "scenario":
        return save_scenario_forecast(employee_id, body.get("scenario") or {})
    return save_measured_forecast(employee_id, body.get("week"))


@router.get("/productivity/{employee_id}/coach")
def read_coach(employee_id: str, request: Request, week: str | None = None):
    require_postmaster(request)
    return coach_for(employee_id, week)


@router.post("/productivity/{employee_id}/coach/ask")
def ask_coach(employee_id: str, request: Request, body: dict | None = None):
    require_postmaster(request)
    body = body or {}
    return coach_answer(employee_id, body.get("week"), str(body.get("question") or ""))


@router.post("/productivity/{employee_id}/coach/follow-up")
def follow_coach(employee_id: str, request: Request, body: dict | None = None):
    require_postmaster(request)
    return save_follow_up(employee_id, body or {})


@router.get("/coach/activity")
def read_coach_activity(request: Request):
    require_postmaster(request)
    return coach_activity()


@router.get("/postal-kpi/dashboard")
def read_postal_kpi_dashboard(
    request: Request,
    employee_id: str = "",
    route_id: str = "",
    year: str = "",
):
    require_postmaster(request)
    return postal_kpi_dashboard(employee_id, route_id, year)


@router.get("/reporting/datasets")
def list_reporting_datasets(request: Request):
    require_postmaster(request)
    return {"datasets": list(DATASETS)}


@router.get("/reporting/workbook")
def export_reporting_workbook(request: Request):
    require_postmaster(request)
    return Response(
        content=workbook_bytes(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="postal_kpi_reporting.xlsx"'},
    )


@router.get("/reporting/{dataset}")
def read_reporting_dataset(
    dataset: str,
    request: Request,
    date_from: str = "",
    date_to: str = "",
    limit: int = 500,
    offset: int = 0,
    export: str = "",
):
    require_postmaster(request)
    if export == "csv":
        return Response(
            content=dataset_csv(dataset, date_from or None, date_to or None),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{dataset}.csv"'},
        )
    return dataset_page(dataset, date_from or None, date_to or None, limit, offset)


@router.get("/powerbi/status")
def read_powerbi_status(request: Request):
    require_postmaster(request)
    return powerbi_status()


@router.post("/powerbi/embed")
def create_powerbi_embed(request: Request, body: dict | None = None):
    require_postmaster(request)
    return embed_for(str((body or {}).get("page") or ""))


@router.get("/kpi/forecasts/summary")
def read_kpi_summary(request: Request):
    require_postmaster(request)
    return kpi_summary()


@router.get("/kpi/forecasts")
def read_kpi_forecasts(
    request: Request,
    search: str = "",
    post_office: str = "",
    designation: str = "",
    category: str = "",
):
    require_postmaster(request)
    return list_forecasts(search, post_office, designation, category)


@router.post("/kpi/forecasts/model-preview")
def preview_random_forest_kpi(request: Request, body: RandomForestPreview):
    require_postmaster(request)
    return preview_next_week_kpi(body)


@router.post("/kpi/forecasts/generate")
def create_kpi_forecasts(request: Request, body: dict | None = None):
    require_postmaster(request)
    return generate_forecasts((body or {}).get("week"))


@router.get("/kpi/forecasts/{employee_id}")
def read_kpi_forecast(employee_id: str, request: Request):
    require_postmaster(request)
    return forecast_detail(employee_id)


@router.get("/forecast-monitoring")
def read_forecast_monitoring(
    request: Request,
    employee_id: str | None = None,
    period_from: str | None = None,
    period_to: str | None = None,
    status: str | None = None,
):
    require_postmaster(request)
    return forecast_monitoring(employee_id, period_from, period_to, status)


@router.get("/promotion-review")
def read_promotion_review(request: Request):
    require_postmaster(request)
    return promotion_board()


@router.get("/allocation")
def read_allocation(date: str, request: Request):
    require_postmaster(request)
    return allocation_plan(date)


@router.post("/allocation/review")
def review_allocation(request: Request, body: dict):
    require_postmaster(request)
    return allocation_plan(str(body.get("date") or ""), body.get("checklist"))


@router.post("/allocation/approve")
def accept_allocation(request: Request, body: dict):
    require_postmaster(request)
    return approve_allocation(str(body.get("date") or ""), body.get("checklist"))


@router.post("/allocation/overtime")
def accept_overtime(request: Request, body: dict):
    require_postmaster(request)
    return confirm_overtime(str(body.get("date") or ""), body.get("checklist"))


@router.get("/attendance/daily")
def read_daily_attendance(request: Request, date: str = "", search: str = ""):
    require_postmaster(request)
    return daily_attendance(date or None, search)


@router.post("/attendance/daily/open")
def begin_attendance_day(request: Request, body: dict):
    user = require_postmaster(request)
    return open_attendance_day(str(body.get("date") or ""), user["username"])


@router.post("/attendance/daily/close")
def finish_attendance_day(request: Request, body: dict):
    user = require_postmaster(request)
    return close_attendance_day(str(body.get("date") or ""), user["username"], bool(body.get("confirm")))


def _guard_attendance(doc: dict) -> None:
    if doc.get("date"):
        assert_attendance_writable(str(doc.get("date")))


@router.get("/{doctype}")
def list_docs(doctype: str, request: Request, search: str = ""):
    require_postmaster(request)
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
def get_doc(doctype: str, name: str, request: Request):
    require_postmaster(request)
    collection = _collection(doctype)
    doc = collection.find_one({"_id": name})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")
    return _public(doc)


@router.post("/{doctype}", status_code=201)
def create_doc(doctype: str, request: Request, doc: dict):
    require_postmaster(request)
    collection = _collection(doctype)
    name = _require_name(doc)
    if doctype == "attendance_log":
        _guard_attendance(doc)
        parse_attendance_date(str(doc.get("date") or ""))
    stored = {key: value for key, value in doc.items() if key != "_id"}
    if doctype == "attendance_log":
        stamp = datetime.now().isoformat(timespec="seconds")
        stored.setdefault("source", "manual")
        stored.setdefault("created_at", stamp)
        stored["updated_at"] = stamp
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
def update_doc(doctype: str, name: str, request: Request, doc: dict):
    require_postmaster(request)
    collection = _collection(doctype)
    current = collection.find_one({"_id": name})
    if current is None:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")
    if doctype == "attendance_log":
        _guard_attendance(current)
        if doc.get("date") and str(doc.get("date")) != str(current.get("date")):
            raise HTTPException(status_code=400, detail="An attendance record cannot move to another date.")

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
def delete_doc(doctype: str, name: str, request: Request):
    require_postmaster(request)
    collection = _collection(doctype)
    if doctype == "attendance_log":
        current = collection.find_one({"_id": name})
        if current:
            _guard_attendance(current)
    result = collection.delete_one({"_id": name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Document {name} not found")
    return {"ok": True}
