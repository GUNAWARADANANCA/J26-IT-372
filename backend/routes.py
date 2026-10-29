from kpi_dashboard_service import get_dashboard_data, export_dashboard_csv
"""CRUD, Excel import, and Excel export for the desk collections."""

import asyncio
import re
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from pymongo.errors import DuplicateKeyError

from attendance import (
    assert_at_office,
    assert_attendance_writable,
    close_attendance_day,
    colombo_now,
    colombo_today,
    current_time_window,
    daily_attendance,
    export_daily_attendance_excel,
    get_location_config,
    get_settings,
    issue_door_token,
    manage_qr_location,
    open_attendance_day,
    parse_attendance_date,
    reset_attendance_record,
    save_settings,
    submit_scan,
    validate_gps_location,
    verify_door_token,
)
from attendance_credential import (
    admin_assign_custom_code,
    admin_generate_code,
    admin_revoke_credential,
    admin_toggle_active,
    admin_unlock_credential,
    consume_verification_token,
    list_employee_credentials,
    seed_default_credentials,
    verify_employee_identity,
)
from db import get_db
from excel_io import export_employees, export_kpi_logs, import_workbook
from performance_review import (
    allocation_plan,
    approve_allocation,
    authorize_attendance_for_date,
    auto_balance_workload,
    confirm_overtime,
    promotion_board,
)
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
from coach import (
    answer as coach_answer,
    coach_activity,
    coach_for,
    save_follow_up,
    generate_coaching_chat_response,
    classify_coaching_intent,
)
from payroll import (
    create_entitlement,
    create_ot_record,
    delete_entitlement,
    update_leave_status,
    get_calculation_rules,
    get_employee_payroll_summary,
    get_payroll_dashboard_metrics,
    gratuity_board,
    list_entitlements,
    payroll_rows,
    save_gratuity,
)
from entitlements import (
    action_entitlement_record,
    create_entitlement_record,
    generate_entitlements_csv,
    get_employee_entitlements,
    get_entitlement_audit_trail,
    get_entitlements_report_data,
    get_entitlements_summary,
    list_entitlement_records,
    update_employee_service_profile,
    update_entitlement_record,
)
from kpi_simulator import (
    get_employee_kpi_history,
    get_simulation_record,
    list_simulations,
    simulate_kpi,
)
from daily_accounts import (
    DEFAULT_OFFICES,
    approve_gl_prediction_item,
    commit_import_batch,
    create_clerk_transaction,
    delete_daily_account_batch,
    export_advanced_accounting_report_excel,
    export_category_daily_excel,
    export_consolidated_daily_report_excel,
    get_advanced_accounting_report,
    get_all_imports,
    get_audit_history_list,
    get_cash_reconciliation,
    get_category_records,
    get_clerk_transaction_by_id,
    get_clerk_transactions,
    get_daily_accounts_summary,
    get_daily_money_order_dual_chart,
    get_gl_predictions_list,
    get_import_validation_report,
    get_monthly_revenue_breakdown,
    get_recent_uploaded_sheets,
    get_staged_batch,
    get_validation_issues_list,
    get_weekly_transaction_trend,
    has_real_imported_data,
    init_daily_accounts_indexes,
    inspect_file_sheets,
    parse_and_validate_file,
    resolve_validation_issue_item,
    seed_demo_daily_accounts,
    update_clerk_transaction,
    update_transaction_status,
    SUPPORTED_DATASET_CATEGORIES,
)
from auth import (
    COOKIE,
    bootstrap_clerk,
    bootstrap_postmaster,
    cookie_settings,
    current_user,
    login,
    logout,
    password_help,
    require_clerk_or_postmaster,
    require_postmaster,
)

router = APIRouter(prefix="/api")


@router.get("/health")
def api_health():
    db_ok = False
    db_name = "postassist"
    try:
        db = get_db()
        db_ok = True
        db_name = db.name
    except Exception as exc:
        db_ok = False
        db_name = f"reconnecting ({exc})"
    return {"ok": True, "service": "PostAssist", "database": db_name, "db_connected": db_ok}

DOCTYPES = ("employee", "daily_kpi_log", "attendance_log", "work_allocation")

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
    verification_token = str(body.get("verification_token") or "").strip()
    if verification_token:
        consume_verification_token(verification_token, employee_id)
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


@router.post("/attendance/reset")
def reset_attendance(body: dict):
    """Reset today's attendance log for an employee so they can test sign-in / sign-out again."""
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    date = str(body.get("date") or "").strip() or None
    return reset_attendance_record(employee_id, date)


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


@router.get("/entitlements/summary")
def read_entitlements_summary(request: Request):
    require_postmaster(request)
    return get_entitlements_summary()


@router.get("/entitlements/records")
def read_entitlement_records(
    request: Request,
    employee_id: str | None = None,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    require_postmaster(request)
    return list_entitlement_records(
        employee_id=employee_id,
        category=category,
        status=status,
        search=search,
    )


@router.get("/entitlements/employee/{employee_id}")
def read_employee_entitlements(employee_id: str, request: Request):
    require_postmaster(request)
    return get_employee_entitlements(employee_id)


@router.post("/entitlements/records", status_code=201)
def add_entitlement_record(request: Request, body: dict):
    require_postmaster(request)
    user = current_user(request) or "postmaster"
    return create_entitlement_record(body or {}, user=user)


@router.put("/entitlements/records/{record_id}")
def edit_entitlement_record(record_id: str, request: Request, body: dict):
    require_postmaster(request)
    user = current_user(request) or "postmaster"
    return update_entitlement_record(record_id, body or {}, user=user)


@router.post("/entitlements/records/{record_id}/action")
def perform_entitlement_action(record_id: str, request: Request, body: dict):
    require_postmaster(request)
    user = current_user(request) or "postmaster"
    action = str((body or {}).get("action") or "").strip()
    notes = str((body or {}).get("notes") or "").strip()
    return action_entitlement_record(record_id, action=action, notes=notes, user=user)


@router.put("/entitlements/employee/{employee_id}/profile")
def edit_employee_service_profile(employee_id: str, request: Request, body: dict):
    require_postmaster(request)
    user = current_user(request) or "postmaster"
    return update_employee_service_profile(employee_id, body or {}, user=user)


@router.get("/entitlements/reports/data")
def read_entitlements_reports(request: Request):
    require_postmaster(request)
    return get_entitlements_report_data()


@router.get("/entitlements/reports/export")
def export_entitlements_csv(request: Request):
    require_postmaster(request)
    csv_data = generate_entitlements_csv()
    filename = f"postal_entitlements_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/entitlements/audit/{record_id}")
def read_entitlement_audit(record_id: str, request: Request):
    require_postmaster(request)
    return get_entitlement_audit_trail(record_id)


@router.get("/leave")
@router.get("/entitlements/leave")
def read_leaves(
    request: Request,
    employee_id: str = "",
    status: str = "",
    start_date: str = "",
    end_date: str = "",
):
    require_clerk_or_postmaster(request)
    return list_entitlements(
        "leave",
        employee_id=employee_id or None,
        status=status or None,
        start_date=start_date or None,
        end_date=end_date or None,
    )


@router.post("/leave", status_code=201)
@router.post("/leave/apply", status_code=201)
@router.post("/entitlements/leave", status_code=201)
def add_leave_request(request: Request, body: dict):
    auth = require_clerk_or_postmaster(request)
    user_emp_id = auth.get("employee_id")
    req_emp_id = str((body or {}).get("employee_id") or "").strip()
    if auth.get("role") != "postmaster" and user_emp_id and req_emp_id and req_emp_id != user_emp_id:
        raise HTTPException(
            status_code=403,
            detail="You can only submit leave applications for your own employee account.",
        )
    body = dict(body or {})
    if auth.get("role") != "postmaster":
        body["status"] = "Pending"
    return create_entitlement("leave", body, actor=auth)


@router.put("/leave/{item_id}")
@router.patch("/leave/{item_id}")
@router.patch("/leave/{item_id}/status")
@router.put("/entitlements/leave/{item_id}")
def edit_leave_request(item_id: str, request: Request, body: dict):
    auth = require_clerk_or_postmaster(request)
    status = str((body or {}).get("status") or "").strip().capitalize()
    remarks = str((body or {}).get("remarks") or (body or {}).get("reason") or "").strip()

    if status in ("Approved", "Rejected"):
        if auth.get("role") != "postmaster":
            raise HTTPException(status_code=403, detail="Postmaster authorization required to approve or reject leave.")
    elif status == "Cancelled":
        db = get_db()
        target = db["entitlement_leave"].find_one({"_id": item_id})
        if not target:
            raise HTTPException(status_code=404, detail="Leave request not found")
        user_emp = auth.get("employee_id")
        if auth.get("role") != "postmaster" and user_emp and target.get("employee_id") != user_emp:
            raise HTTPException(status_code=403, detail="You can only cancel your own leave requests.")
    else:
        raise HTTPException(status_code=400, detail="Provide valid status ('Approved', 'Rejected', or 'Cancelled')")

    return update_leave_status(item_id, status, actor=auth, remarks=remarks)


@router.post("/leave/{item_id}/cancel")
@router.post("/entitlements/leave/{item_id}/cancel")
def cancel_leave_request_endpoint(item_id: str, request: Request, body: dict | None = None):
    body = dict(body or {})
    body["status"] = "Cancelled"
    return edit_leave_request(item_id, request, body)


@router.delete("/leave/{item_id}")
@router.delete("/entitlements/leave/{item_id}")
def remove_leave_request(item_id: str, request: Request):
    require_postmaster(request)
    return delete_entitlement("leave", item_id)


@router.get("/entitlements/{module}")
def read_entitlements(module: str, request: Request):
    if module == "leave":
        require_clerk_or_postmaster(request)
    else:
        require_postmaster(request)
    return list_entitlements(module)


@router.post("/entitlements/{module}", status_code=201)
def add_entitlement(module: str, request: Request, body: dict):
    if module == "leave":
        auth = require_clerk_or_postmaster(request)
        user_emp_id = auth.get("employee_id")
        req_emp_id = str((body or {}).get("employee_id") or "").strip()
        if auth.get("role") != "postmaster" and user_emp_id and req_emp_id and req_emp_id != user_emp_id:
            raise HTTPException(
                status_code=403,
                detail="You can only submit leave applications for your own employee account.",
            )
        if auth.get("role") != "postmaster":
            body = dict(body or {})
            body["status"] = "Pending"
        return create_entitlement(module, body or {})
    require_postmaster(request)
    return create_entitlement(module, body or {})


@router.delete("/entitlements/{module}/{item_id}")
def remove_entitlement(module: str, item_id: str, request: Request):
    require_postmaster(request)
    return delete_entitlement(module, item_id)


@router.get("/productivity/{employee_id}")
def read_productivity(employee_id: str, request: Request, week: str | None = None, year: str | None = None):
    require_clerk_or_postmaster(request)
    return productivity_for(employee_id, week, year)


@router.post("/productivity/{employee_id}/simulate")
def simulate_employee_productivity(employee_id: str, request: Request, body: dict):
    require_postmaster(request)
    return simulate_productivity(employee_id, (body or {}).get("scenarios"))


@router.post("/kpi/simulate")
def run_kpi_simulation(request: Request, body: dict):
    actor = current_user(request)
    return simulate_kpi(body or {}, actor=actor)


@router.get("/kpi/simulations")
def read_kpi_simulations(limit: int = 20):
    return list_simulations(limit)


@router.get("/kpi/simulations/{simulation_id}")
def read_kpi_simulation_record(simulation_id: str):
    return get_simulation_record(simulation_id)


@router.get("/employees/{employee_id}/kpi-history")
@router.get("/employee/{employee_id}/kpi-history")
def read_employee_kpi_history(employee_id: str):
    return get_employee_kpi_history(employee_id)


@router.get("/payroll/dashboard-metrics")
def read_payroll_dashboard_metrics(period: str = "January – August 2026"):
    return get_payroll_dashboard_metrics(period)


@router.get("/payroll/employee/{employee_id}/summary")
def read_employee_payroll_summary(employee_id: str, period: str = "January – August 2026"):
    return get_employee_payroll_summary(employee_id, period)


@router.post("/payroll/ot-record")
def submit_ot_record(request: Request, body: dict):
    actor = current_user(request)
    return create_ot_record(body or {}, user=actor.get("username", "postmaster"))


@router.get("/payroll/calculation-rules")
def read_payroll_calculation_rules():
    return get_calculation_rules()





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
def read_coach(employee_id: str, request: Request, week: str | None = None, year: str | None = None):
    require_clerk_or_postmaster(request)
    return coach_for(employee_id, week, year)


@router.post("/productivity/{employee_id}/coach/chat")
def chat_coach(employee_id: str, request: Request, body: dict | None = None):
    auth = require_clerk_or_postmaster(request)
    body = body or {}
    message = str(body.get("message") or body.get("question") or "").strip()
    week = body.get("week") or None
    year = int(body.get("year")) if body.get("year") else None
    language = body.get("language")
    return generate_coaching_chat_response(
        employee_id=employee_id,
        message=message,
        year=year,
        week=week,
        current_user=auth,
        language=language,
    )


@router.post("/productivity/coach/chat")
def chat_coach_generic(request: Request, body: dict | None = None):
    auth = require_clerk_or_postmaster(request)
    body = body or {}
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")
    message = str(body.get("message") or body.get("question") or "").strip()
    week = body.get("week") or 9
    year = int(body.get("year") or 2026)
    language = body.get("language")
    return generate_coaching_chat_response(
        employee_id=employee_id,
        message=message,
        year=year,
        week=week,
        current_user=auth,
        language=language,
    )



@router.post("/productivity-coach/chat")
def productivity_coach_chat(request: Request, body: dict | None = None):
    auth = require_clerk_or_postmaster(request)
    body = body or {}
    message = str(body.get("message") or body.get("question") or "").strip()
    from datetime import datetime, timezone
    conversation_id = body.get("conversation_id") or f"conv_{int(datetime.now(timezone.utc).timestamp())}"

    # Securely resolve employee identity from session
    username = auth.get("username", "")
    role = auth.get("role", "")
    db = get_db()

    emp_id = None
    # 1. Direct username match
    emp_doc = db["employee"].find_one({"$or": [{"_id": username}, {"employee_id": username}]})
    if emp_doc:
        emp_id = emp_doc.get("employee_id") or emp_doc.get("_id")

    # 2. Check if user document has employee_id
    if not emp_id:
        user_doc = db["app_user"].find_one({"username": username})
        if user_doc and user_doc.get("employee_id"):
            emp_id = user_doc["employee_id"]

    # 3. Postmaster oversight: If postmaster supplies an employee_id in body, coach that officer
    if (auth.get("is_postmaster") or str(role).lower() == "postmaster") and body.get("employee_id"):
        target_eid = str(body.get("employee_id")).strip()
        target_doc = db["employee"].find_one({"$or": [{"_id": target_eid}, {"employee_id": target_eid}]})
        if target_doc:
            emp_id = target_doc.get("employee_id") or target_doc.get("_id")

    # 4. Fallback default
    if not emp_id:
        first = db["employee"].find_one()
        emp_id = (first.get("employee_id") or first.get("_id")) if first else "EMP1137"

    week = body.get("week") or 9
    year = int(body.get("year") or 2026)
    language = body.get("language")

    res = generate_coaching_chat_response(
        employee_id=emp_id,
        message=message,
        year=year,
        week=week,
        current_user=auth,
        language=language,
    )
    res["conversation_id"] = conversation_id
    res["timestamp"] = datetime.now(timezone.utc).isoformat()
    return res


@router.post("/productivity/{employee_id}/coach/ask")
def ask_coach(employee_id: str, request: Request, body: dict | None = None):
    auth = require_clerk_or_postmaster(request)
    body = body or {}
    message = str(body.get("question") or body.get("message") or "").strip()
    week = body.get("week") or 9
    year = int(body.get("year") or 2026)
    language = body.get("language")
    res = generate_coaching_chat_response(
        employee_id=employee_id,
        message=message,
        year=year,
        week=week,
        current_user=auth,
        language=language,
    )
    res["answer"] = res.get("reply", "")
    return res


@router.post("/productivity/{employee_id}/coach/follow-up")
def follow_coach(employee_id: str, request: Request, body: dict | None = None):
    require_clerk_or_postmaster(request)
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




@router.get("/kpi/dashboard")
def read_kpi_dashboard(
    request: Request,
    period_type: str = "all",
    start_date: str = "",
    end_date: str = "",
    post_office: str = "",
    employee_id: str = "",
    designation: str = "",
    category: str = "",
    status: str = "all",
):
    current_user(request)
    return get_dashboard_data(
        period_type=period_type,
        start_date=start_date or None,
        end_date=end_date or None,
        post_office=post_office or None,
        employee_id=employee_id or None,
        designation=designation or None,
        category=category or None,
        performance_status=status or None,
    )


@router.get("/kpi/dashboard/export")
def export_kpi_dashboard(
    request: Request,
    export_type: str = "employees",
    period_type: str = "all",
    start_date: str = "",
    end_date: str = "",
    post_office: str = "",
    employee_id: str = "",
    designation: str = "",
    category: str = "",
    status: str = "all",
):
    current_user(request)
    data = get_dashboard_data(
        period_type=period_type,
        start_date=start_date or None,
        end_date=end_date or None,
        post_office=post_office or None,
        employee_id=employee_id or None,
        designation=designation or None,
        category=category or None,
        performance_status=status or None,
    )
    from fastapi.responses import Response
    from datetime import date
    csv_text = export_dashboard_csv(data, export_type=export_type)
    filename = f"postassist_kpi_{export_type}_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.post("/allocation/authorize-attendance")
def authorize_attendance_endpoint(request: Request, body: dict):
    require_postmaster(request)
    date_str = str((body or {}).get("date") or "").strip()
    employee_ids = (body or {}).get("employee_ids")
    status = str((body or {}).get("status") or "Present").strip()
    notes = str((body or {}).get("notes") or "Authorized by Postmaster for work allocation").strip()
    post_office = (body or {}).get("post_office")
    actor = current_user(request)
    username = actor.get("username", "postmaster") if isinstance(actor, dict) else "postmaster"
    return authorize_attendance_for_date(
        day_text=date_str,
        employee_ids=employee_ids,
        status=status,
        notes=notes,
        user=username,
        post_office=post_office,
    )


@router.post("/allocation/auto-balance")
def auto_balance_endpoint(request: Request, body: dict):
    require_postmaster(request)
    date_str = str((body or {}).get("date") or "").strip()
    post_office = (body or {}).get("post_office")
    checklist = (body or {}).get("checklist")
    confirm = bool((body or {}).get("confirm", True))
    authorized_employee_ids = (body or {}).get("authorized_employee_ids")
    authorize_all_active = bool((body or {}).get("authorize_all_active", False))
    actor = current_user(request)
    username = actor.get("username", "postmaster") if isinstance(actor, dict) else "postmaster"
    return auto_balance_workload(
        date_str,
        post_office=post_office,
        checklist=checklist,
        user=username,
        confirm=confirm,
        authorized_employee_ids=authorized_employee_ids,
        authorize_all_active=authorize_all_active,
    )


@router.post("/allocation/overtime")
def accept_overtime(request: Request, body: dict):
    require_postmaster(request)
    return confirm_overtime(str(body.get("date") or ""), body.get("checklist"))


@router.get("/attendance/range")
def read_attendance_range(
    request: Request,
    start_date: str,
    end_date: str,
    office_id: str = "",
):
    """Retrieve attendance logs between start_date and end_date (inclusive)."""
    require_clerk_or_postmaster(request)
    db = get_db()
    query = {"date": {"$gte": start_date, "$lte": end_date}}
    if office_id and office_id != "ALL":
        query["post_office"] = office_id

    records = []
    for doc in db["attendance_log"].find(query).sort("date", 1):
        rec = {k: v for k, v in doc.items() if k != "_id"}
        rec["id"] = str(doc.get("_id") or "")
        records.append(rec)
    return records


@router.get("/attendance/calendar")
def read_attendance_calendar_month(
    request: Request,
    year: int,
    month: int,
    office_id: str = "",
):
    """Retrieve complete dynamic calendar data for a given month and year:
    all employees, approved leaves, pending leaves, verified attendance records, and monthly summaries."""
    require_clerk_or_postmaster(request)
    db = get_db()
    import calendar as py_calendar
    _, last_day = py_calendar.monthrange(year, month)
    start_date = f"{year:04d}-{month:02d}-01"
    end_date = f"{year:04d}-{month:02d}-{last_day:02d}"

    emp_query = {}
    if office_id and office_id != "ALL":
        emp_query["post_office"] = office_id
    employees = []
    for emp in db["employee"].find(emp_query).sort("employee_name", 1):
        e = {k: v for k, v in emp.items() if k != "_id"}
        e["id"] = str(emp.get("_id") or emp.get("employee_id") or "")
        e["employee_id"] = str(emp.get("employee_id") or emp.get("_id") or "")
        employees.append(e)

    leave_query = {
        "status": {"$in": ["Pending", "Approved", "pending", "approved"]},
        "from_date": {"$lte": end_date},
        "to_date": {"$gte": start_date},
    }
    leaves = []
    for doc in db["entitlement_leave"].find(leave_query).sort("created_at", -1):
        item = {k: v for k, v in doc.items() if k != "_id"}
        item["id"] = str(doc.get("_id") or "")
        leaves.append(item)

    att_query = {"date": {"$gte": start_date, "$lte": end_date}}
    attendance = []
    for doc in db["attendance_log"].find(att_query).sort("date", 1):
        item = {k: v for k, v in doc.items() if k != "_id"}
        item["id"] = str(doc.get("_id") or "")
        attendance.append(item)

    total_employees = len(employees)
    approved_leave_emps = set(
        l.get("employee_id") for l in leaves if str(l.get("status", "")).capitalize() == "Approved"
    )
    pending_leave_emps = set(
        l.get("employee_id") for l in leaves if str(l.get("status", "")).capitalize() == "Pending"
    )
    present_emps = set(a.get("employee_id") for a in attendance)

    summary = {
        "year": year,
        "month": month,
        "start_date": start_date,
        "end_date": end_date,
        "total_scheduled": total_employees,
        "total_employees": total_employees,
        "present_employees_count": len(present_emps),
        "total_attendance_logs": len(attendance),
        "on_approved_leave_count": len(approved_leave_emps),
        "pending_leave_count": len(pending_leave_emps),
    }

    return {
        "year": year,
        "month": month,
        "start_date": start_date,
        "end_date": end_date,
        "employees": employees,
        "leaves": leaves,
        "attendance": attendance,
        "summary": summary,
    }


@router.get("/attendance/daily")
def read_daily_attendance(
    request: Request,
    date: str = "",
    search: str = "",
    type: str = "All",
    status: str = "All",
    office: str = "All",
    include_absent: bool = True,
):
    require_clerk_or_postmaster(request)
    return daily_attendance(
        date or None,
        search=search,
        type_filter=type,
        status_filter=status,
        office_filter=office,
        include_absent=include_absent,
    )


def require_clerk_postmaster_or_door(request: Request, body: dict):
    try:
        require_clerk_or_postmaster(request)
        return
    except HTTPException:
        door_token = str(body.get("door_token") or body.get("doorToken") or "").strip()
        if door_token:
            try:
                verify_door_token(door_token)
                return
            except Exception as exc:
                raise HTTPException(status_code=401, detail="Invalid QR entrance token") from exc
        raise HTTPException(status_code=401, detail="Authentication or valid QR entrance token required")


@router.post("/attendance/verify-employee")
def verify_attendance_employee(request: Request, body: dict):
    # An employee verifies their identity with their unique code.
    # Brute-force is prevented by salted scrypt, attempt counters, and 15-minute lockouts.
    employee_id = str(body.get("employee_id") or "").strip()
    verification_code = str(body.get("verification_code") or "").strip()
    client_ip = request.client.host if request.client else "unknown"
    device_info = str(body.get("device_info") or request.headers.get("user-agent") or "").strip()
    return verify_employee_identity(
        employee_id=employee_id,
        submitted_code=verification_code,
        client_ip=client_ip,
        device_info=device_info,
    )


@router.post("/attendance/check-in")
def check_in_attendance(request: Request, body: dict):
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee selection is required")
    verification_token = str(body.get("verification_token") or "").strip()
    consume_verification_token(verification_token, employee_id)
    try:
        latitude = float(body.get("latitude"))
        longitude = float(body.get("longitude"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="GPS location coordinates are required") from exc
    accuracy = body.get("accuracy")
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (TypeError, ValueError):
            accuracy = None
    client = request.client.host if request.client else "unknown"
    return submit_scan(
        employee_id=employee_id,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        door_token=body.get("door_token") or "QR_TOKEN_DISABLED",
        client_key=client,
        request_id=str(request.headers.get("x-request-id") or ""),
        qr_location_id=str(body.get("qr_location_id") or "").strip() or None,
        requested_action="check_in",
        device_info=str(body.get("device_info") or request.headers.get("user-agent") or "").strip(),
    )


@router.post("/attendance/check-out")
def check_out_attendance(request: Request, body: dict):
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee selection is required")
    verification_token = str(body.get("verification_token") or "").strip()
    consume_verification_token(verification_token, employee_id)
    try:
        latitude = float(body.get("latitude"))
        longitude = float(body.get("longitude"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="GPS location coordinates are required") from exc
    accuracy = body.get("accuracy")
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (TypeError, ValueError):
            accuracy = None
    client = request.client.host if request.client else "unknown"
    return submit_scan(
        employee_id=employee_id,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        door_token=body.get("door_token") or "QR_TOKEN_DISABLED",
        client_key=client,
        request_id=str(request.headers.get("x-request-id") or ""),
        qr_location_id=str(body.get("qr_location_id") or "").strip() or None,
        requested_action="check_out",
        device_info=str(body.get("device_info") or request.headers.get("user-agent") or "").strip(),
    )


@router.get("/admin/attendance-credentials")
def read_admin_attendance_credentials(request: Request):
    require_postmaster(request)
    return list_employee_credentials()


@router.post("/admin/attendance-credentials/generate")
def create_admin_employee_credential(request: Request, body: dict):
    user = require_postmaster(request)
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    return admin_generate_code(employee_id, user.get("username", "postmaster"))


@router.post("/admin/attendance-credentials/assign")
def assign_admin_employee_credential(request: Request, body: dict):
    user = require_postmaster(request)
    employee_id = str(body.get("employee_id") or "").strip()
    verification_code = str(body.get("verification_code") or "").strip()
    if not employee_id or not verification_code:
        raise HTTPException(status_code=400, detail="Employee ID and verification code are required")
    return admin_assign_custom_code(employee_id, verification_code, user.get("username", "postmaster"))


@router.post("/admin/attendance-credentials/toggle")
def toggle_admin_employee_credential(request: Request, body: dict):
    user = require_postmaster(request)
    employee_id = str(body.get("employee_id") or "").strip()
    active = bool(body.get("active", True))
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    return admin_toggle_active(employee_id, active, user.get("username", "postmaster"))


@router.post("/admin/attendance-credentials/unlock")
def unlock_admin_employee_credential(request: Request, body: dict):
    user = require_postmaster(request)
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    return admin_unlock_credential(employee_id, user.get("username", "postmaster"))


@router.post("/admin/attendance-credentials/revoke")
def revoke_admin_employee_credential(request: Request, body: dict):
    user = require_postmaster(request)
    employee_id = str(body.get("employee_id") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    return admin_revoke_credential(employee_id, user.get("username", "postmaster"))


@router.post("/admin/attendance-credentials/seed")
def seed_admin_attendance_credentials(request: Request):
    require_postmaster(request)
    return seed_default_credentials()


@router.get("/attendance/configuration")
def read_attendance_configuration(request: Request):
    require_clerk_or_postmaster(request)
    settings = get_settings()
    now = colombo_now()
    window = current_time_window(now, settings)
    return {
        "settings": settings,
        "current_window": window,
        "server_time": now.strftime("%H:%M:%S"),
        "server_date": now.date().isoformat(),
        "timezone": "Asia/Colombo",
    }


@router.put("/attendance/configuration")
def update_attendance_configuration(request: Request, body: dict):
    user = require_postmaster(request)
    body["updated_by"] = user.get("username", "postmaster")
    saved = save_settings(body)
    now = colombo_now()
    window = current_time_window(now, saved)
    return {
        "ok": True,
        "settings": saved,
        "current_window": window,
        "message": "Attendance hours configuration updated successfully.",
    }


@router.get("/attendance/export")
def export_attendance_records(
    request: Request,
    date: str = "",
    search: str = "",
    type: str = "All",
    status: str = "All",
):
    require_clerk_or_postmaster(request)
    export_stream = export_daily_attendance_excel(date or None, search=search, type_filter=type, status_filter=status)
    filename = f"SLP_Daily_Attendance_{date or colombo_today()}.xlsx"
    return StreamingResponse(
        export_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/attendance/daily/open")
def begin_attendance_day(request: Request, body: dict):
    user = require_postmaster(request)
    return open_attendance_day(str(body.get("date") or ""), user["username"])


@router.post("/attendance/daily/close")
def finish_attendance_day(request: Request, body: dict):
    user = require_postmaster(request)
    return close_attendance_day(str(body.get("date") or ""), user["username"], bool(body.get("confirm")))


# ── DAILY ACCOUNTS MONITORING & ANALYTICS ───────────────────────────────────

@router.get("/daily-accounts/offices")
def read_daily_accounts_offices():
    return DEFAULT_OFFICES


@router.get("/daily-accounts/summary")
def read_daily_accounts_summary(
    office_id: str = "PO-COLOMBO-CENTRAL",
    start_date: str = "2026-07-01",
    end_date: str = "2026-09-01",
    data_mode: str = "auto",
):
    return get_daily_accounts_summary(office_id, start_date, end_date, data_mode)


@router.get("/daily-accounts/trends")
def read_daily_accounts_trends(
    mode: str = "Week",
    week_selector: str = "Week 3 (14 Jul - 20 Jul 2026)",
    data_mode: str = "auto",
):
    return get_weekly_transaction_trend(mode, week_selector, data_mode)


@router.get("/daily-accounts/money-orders-chart")
def read_money_orders_chart(
    week_selector: str = "Week 3 (14 Jul - 20 Jul 2026)",
    data_mode: str = "auto",
):
    return get_daily_money_order_dual_chart(week_selector, data_mode)


@router.get("/daily-accounts/revenue-breakdown")
def read_daily_accounts_revenue_breakdown(data_mode: str = "auto"):
    return get_monthly_revenue_breakdown(data_mode)


@router.get("/daily-accounts/cash-reconciliation")
def read_daily_accounts_cash_reconciliation(
    office_id: str = "PO-COLOMBO-CENTRAL",
    date: str = "2026-09-01",
    data_mode: str = "auto",
):
    return get_cash_reconciliation(office_id, date, data_mode)


@router.get("/daily-accounts/recent-sheets")
def read_daily_accounts_recent_sheets(
    office_id: str = "PO-COLOMBO-CENTRAL",
    data_mode: str = "auto",
):
    return get_recent_uploaded_sheets(office_id, data_mode)


@router.post("/daily-accounts/inspect-file")
@router.post("/daily-accounts/upload/inspect")
async def inspect_daily_accounts_file_endpoint(
    file: UploadFile = File(...),
    request: Request = None,
):
    if request and request.cookies.get(COOKIE):
        try:
            require_postmaster(request)
        except Exception:
            current_user(request)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum size of 10 MB.")
    try:
        return await asyncio.to_thread(inspect_file_sheets, content=content, filename=file.filename or "upload.xlsx")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/daily-accounts/upload/preview")
@router.post("/daily-accounts/upload")
async def upload_daily_accounts_preview_endpoint(
    file: UploadFile = File(...),
    request: Request = None,
):
    """Parse and validate uploaded daily accounts file for preview without saving to database."""
    user = None
    if request:
        try:
            user = require_postmaster(request)
        except Exception:
            user = current_user(request)
    uploader = user if isinstance(user, str) else (user.get("username") if isinstance(user, dict) else "Amila Silva")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum size of 10 MB.")

    # Read optional form values
    sheet_name = None
    column_mapping = None
    exclude_summary_rows = True
    office_id = "PO-COLOMBO-CENTRAL"
    reporting_period = "01 Jul 2026 - 01 Sep 2026"
    dataset_category = None

    if request:
        try:
            form = await request.form()
            sheet_name = form.get("sheet_name") or None
            office_id = form.get("office_id") or office_id
            reporting_period = form.get("reporting_period") or reporting_period
            dataset_category = form.get("dataset_category") or None
            exclude_raw = form.get("exclude_summary_rows")
            if exclude_raw is not None:
                exclude_summary_rows = str(exclude_raw).lower() in ("true", "1")
            cmap_raw = form.get("column_mapping")
            if cmap_raw:
                import json
                try:
                    column_mapping = json.loads(cmap_raw) if isinstance(cmap_raw, str) else cmap_raw
                except Exception:
                    pass
        except Exception:
            pass

    # Server-side validation of office_id and dataset_category
    valid_office_ids = {o["id"] for o in DEFAULT_OFFICES}
    if office_id and office_id not in valid_office_ids and not office_id.startswith("PO-"):
        office_id = "PO-COLOMBO-CENTRAL"

    if dataset_category and dataset_category not in SUPPORTED_DATASET_CATEGORIES and dataset_category != "auto":
        dataset_category = None

    try:
        batch_meta, records, issues = await asyncio.to_thread(
            parse_and_validate_file,
            content=content,
            filename=file.filename or "uploaded_sheet.xlsx",
            sheet_name=sheet_name,
            column_mapping=column_mapping,
            exclude_summary_rows=exclude_summary_rows,
            office_id=office_id,
            reporting_period=reporting_period,
            uploader=uploader or "Amila Silva",
            dataset_category=dataset_category,
        )
        return {
            "batch_meta": batch_meta,
            "preview_rows": records[:100],
            "total_records": len(records),
            "issues": issues,
            "records": records,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/daily-accounts/upload/confirm")
@router.post("/daily-accounts/confirm-import")
async def confirm_daily_accounts_import_endpoint(body: dict, request: Request = None):
    """Persist validated records into MongoDB with append or replace semantics and category isolation."""
    user = None
    if request:
        try:
            user = require_postmaster(request)
        except Exception:
            user = current_user(request)
    user_name = user if isinstance(user, str) else (user.get("username") if isinstance(user, dict) else "Amila Silva")

    batch_meta = body.get("batch_meta") or {}
    batch_id = body.get("batch_id") or batch_meta.get("batch_id")
    records = body.get("records") or []
    issues = body.get("issues") or []
    import_mode = str(body.get("import_mode") or "append").lower()
    if import_mode not in ("append", "replace"):
        import_mode = "append"
    dataset_category = body.get("dataset_category") or batch_meta.get("dataset_category") or None

    if dataset_category and dataset_category not in SUPPORTED_DATASET_CATEGORIES and dataset_category != "auto":
        dataset_category = None

    # If records not provided in payload, load from staged batch
    if (not records or len(records) == 0) and batch_id:
        staged = get_staged_batch(batch_id)
        if staged:
            records = staged.get("records") or []
            issues = issues if (issues and len(issues) > 0) else (staged.get("issues") or [])
            if not batch_meta or len(batch_meta) <= 1:
                batch_meta = staged.get("batch_meta") or batch_meta

    if not batch_meta and not records:
        raise HTTPException(status_code=400, detail=f"Batch {batch_id or 'unknown'} was not found or expired. Please re-validate the file.")

    try:
        return await asyncio.to_thread(
            commit_import_batch,
            batch_meta,
            records,
            issues,
            user_name=user_name or "Amila Silva",
            import_mode=import_mode,
            dataset_category=dataset_category,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {e}") from e


@router.get("/daily-accounts/imports")
def read_daily_accounts_imports_endpoint(office_id: str = ""):
    """Return all imported accounting batches with statistical summaries."""
    return get_all_imports(office_id=office_id)


@router.get("/daily-accounts/imports/{import_id}/validation-report")
def read_daily_accounts_validation_report_endpoint(import_id: str):
    """Return comprehensive validation report with downloadable CSV data."""
    try:
        return get_import_validation_report(import_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/daily-accounts/batches/{batch_id}")
def delete_daily_accounts_batch_endpoint(batch_id: str, request: Request = None):
    try:
        user = current_user(request) if request else None
    except Exception:
        user = None
    user_name = user if isinstance(user, str) else (user.get("username") if isinstance(user, dict) else "Amila Silva")
    return delete_daily_account_batch(batch_id, user_name=user_name or "Amila Silva")


@router.get("/daily-accounts/category-records")
def read_daily_accounts_category_records(
    category: str = "",
    office_id: str = "PO-COLOMBO-CENTRAL",
    start_date: str = "",
    end_date: str = "",
    data_mode: str = "auto",
):
    return get_category_records(category, office_id, start_date, end_date, data_mode)


@router.get("/daily-accounts/validation-issues")
def read_daily_accounts_validation_issues(
    severity: str = "",
    status: str = "",
    data_mode: str = "auto",
):
    return get_validation_issues_list(severity=severity or None, status=status or None, data_mode=data_mode)


def _resolve_daily_accounts_actor(request: Request) -> dict:
    try:
        actor = require_clerk_or_postmaster(request)
        if actor:
            return actor
    except Exception:
        pass
    try:
        u = current_user(request)
        if u and u.get("username"):
            return {
                "username": u["username"],
                "role": u.get("role") or "clerk",
                "office_id": "PO-COLOMBO-CENTRAL",
                "full_name": u.get("username"),
            }
    except Exception:
        pass
    return {
        "username": "clerk",
        "role": "clerk",
        "office_id": "PO-COLOMBO-CENTRAL",
        "full_name": "Amila Silva",
    }
@router.post("/daily-accounts/validation-issues/{issue_id}/resolve")
def resolve_daily_accounts_issue(issue_id: str, body: dict, request: Request):
    actor = _resolve_daily_accounts_actor(request)
    user_name = actor.get("full_name") or actor.get("username") or "Amila Silva"
    correction = str(body.get("correction") or "")
    try:
        return resolve_validation_issue_item(issue_id, correction, user_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/daily-accounts/gl-predictions")
def read_daily_accounts_gl_predictions(data_mode: str = "auto"):
    return get_gl_predictions_list(data_mode)


@router.post("/daily-accounts/gl-predictions/{record_id}/approve")
def approve_daily_accounts_gl_prediction(record_id: str, body: dict, request: Request):
    actor = _resolve_daily_accounts_actor(request)
    user_name = actor.get("full_name") or actor.get("username") or "Amila Silva"
    approved_code = str(body.get("approved_gl_code") or "")
    try:
        return approve_gl_prediction_item(record_id, approved_code, user_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/daily-accounts/audit-history")
def read_daily_accounts_audit_history(
    action: str = "",
    user: str = "",
    start_date: str = "",
    end_date: str = "",
):
    return get_audit_history_list(action=action, user=user, start_date=start_date, end_date=end_date)


@router.post("/daily-accounts/reset-demo")
def reset_daily_accounts_demo():
    seed_demo_daily_accounts(force=True)
    return {"status": "ok", "message": "Demo data reset successfully."}



# ============================================================================
# CLERK TRANSACTION ENTRY & POSTMASTER WORKFLOW ENDPOINTS
# ============================================================================

@router.post("/daily-accounts/transactions", status_code=201)
@router.post("/daily-accounts/money-orders", status_code=201)
@router.post("/daily-accounts/postal-services", status_code=201)
@router.post("/daily-accounts/utility-collections", status_code=201)
@router.post("/daily-accounts/pension-welfare", status_code=201)
@router.post("/daily-accounts/stamp-stock", status_code=201)
@router.post("/daily-accounts/expenses-imprest", status_code=201)
def add_daily_account_transaction(request: Request, body: dict):
    """Add a new accounting transaction for any of the 5 modules."""
    actor = _resolve_daily_accounts_actor(request)
    path = request.url.path
    payload = dict(body or {})
    if "/money-orders" in path and not payload.get("category"):
        payload["category"] = "Money Orders"
        payload["dataset_category"] = "money_orders"
    elif "/postal-services" in path and not payload.get("category"):
        payload["category"] = payload.get("service_type") or "Postal Services"
        payload["dataset_category"] = "postal_revenue"
    elif "/utility-collections" in path and not payload.get("category"):
        payload["category"] = payload.get("provider") or "Utility Collections"
        payload["dataset_category"] = "utility_collections"
    elif "/pension-welfare" in path and not payload.get("category"):
        payload["category"] = "Pension & Welfare"
        payload["dataset_category"] = "pension_welfare"
    elif "/stamp-stock" in path and not payload.get("category"):
        payload["category"] = "Stamp Stock Ledger"
        payload["dataset_category"] = "stamp_stock"
    elif "/expenses-imprest" in path and not payload.get("category"):
        payload["category"] = payload.get("expense_category") or "Expenses & Imprest"
        payload["dataset_category"] = "expenses_imprest"

    try:
        return create_clerk_transaction(payload, actor)
    except ValueError as e:
        if "Duplicate reference" in str(e):
            raise HTTPException(status_code=409, detail=str(e)) from e
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/daily-accounts/transactions")
@router.get("/daily-accounts/money-orders")
@router.get("/daily-accounts/postal-services")
@router.get("/daily-accounts/utility-collections")
@router.get("/daily-accounts/pension-welfare")
@router.get("/daily-accounts/stamp-stock")
@router.get("/daily-accounts/expenses-imprest")
def read_daily_account_transactions(
    request: Request,
    category: str = "",
    office_id: str = "PO-COLOMBO-CENTRAL",
    date: str = "",
    start_date: str = "",
    end_date: str = "",
    clerk_id: str = "",
    status: str = "",
    search: str = "",
    limit: int = 50,
    offset: int = 0,
    data_mode: str = "auto",
):
    """List transactions with filtering, search, pagination, and totals."""
    path = request.url.path
    if not category:
        if "/money-orders" in path:
            category = "Money Orders"
        elif "/postal-services" in path:
            category = "Postal Services"
        elif "/utility-collections" in path:
            category = "Utility Collections"
        elif "/pension-welfare" in path:
            category = "Pension & Welfare"
        elif "/stamp-stock" in path:
            category = "Stamp Stock Ledger"
        elif "/expenses-imprest" in path:
            category = "Expenses & Imprest"

    return get_clerk_transactions(
        category=category,
        office_id=office_id,
        date=date,
        start_date=start_date,
        end_date=end_date,
        clerk_id=clerk_id,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
        data_mode=data_mode,
    )


@router.get("/daily-accounts/transactions/{tx_id}")
@router.get("/daily-accounts/money-orders/{tx_id}")
@router.get("/daily-accounts/postal-services/{tx_id}")
@router.get("/daily-accounts/utility-collections/{tx_id}")
@router.get("/daily-accounts/pension-welfare/{tx_id}")
@router.get("/daily-accounts/stamp-stock/{tx_id}")
@router.get("/daily-accounts/expenses-imprest/{tx_id}")
def read_daily_account_transaction_by_id(tx_id: str):
    rec = get_clerk_transaction_by_id(tx_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Transaction {tx_id} not found.")
    return rec


@router.patch("/daily-accounts/transactions/{tx_id}")
@router.patch("/daily-accounts/money-orders/{tx_id}")
@router.patch("/daily-accounts/postal-services/{tx_id}")
@router.patch("/daily-accounts/utility-collections/{tx_id}")
@router.patch("/daily-accounts/pension-welfare/{tx_id}")
@router.patch("/daily-accounts/stamp-stock/{tx_id}")
@router.patch("/daily-accounts/expenses-imprest/{tx_id}")
def modify_daily_account_transaction(tx_id: str, request: Request, body: dict):
    actor = _resolve_daily_accounts_actor(request)
    try:
        return update_clerk_transaction(tx_id, body or {}, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/daily-accounts/transactions/{tx_id}/status")
def review_daily_account_transaction(tx_id: str, request: Request, body: dict):
    reviewer = _resolve_daily_accounts_actor(request)
    new_status = str((body or {}).get("status") or "")
    remarks = str((body or {}).get("remarks") or "")
    try:
        return update_transaction_status(tx_id, new_status, remarks, reviewer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# ============================================================================
# EXCEL EXPORT ENDPOINTS
# ============================================================================

@router.get("/daily-accounts/export/category")
@router.get("/daily-accounts/money-orders/export")
@router.get("/daily-accounts/postal-services/export")
@router.get("/daily-accounts/utility-collections/export")
@router.get("/daily-accounts/pension-welfare/export")
@router.get("/daily-accounts/stamp-stock/export")
def export_daily_accounts_category_endpoint(
    request: Request,
    category: str = "",
    office_id: str = "PO-COLOMBO-CENTRAL",
    date: str = "",
    clerk_id: str = "",
    status: str = "",
):
    path = request.url.path
    if not category:
        if "/money-orders" in path:
            category = "Money Orders"
        elif "/postal-services" in path:
            category = "Postal Services"
        elif "/utility-collections" in path:
            category = "Utility Collections"
        elif "/pension-welfare" in path:
            category = "Pension & Welfare"
        elif "/stamp-stock" in path:
            category = "Stamp Stock Ledger"
        elif "/expenses-imprest" in path:
            category = "Expenses & Imprest"
        else:
            category = "Money Orders"

    excel_bytes = export_category_daily_excel(
        category=category,
        office_id=office_id,
        date=date,
        clerk_id=clerk_id,
        status=status,
    )
    safe_cat = category.replace(" ", "_").replace("&", "and")
    date_str = date or "Period"
    filename = f"SLP_{safe_cat}_{office_id}_{date_str}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily-accounts/export/consolidated")
def export_daily_accounts_consolidated_endpoint(
    office_id: str = "PO-COLOMBO-CENTRAL",
    date: str = "",
):
    excel_bytes = export_consolidated_daily_report_excel(office_id=office_id, date=date)
    date_str = date or "Consolidated"
    filename = f"SLP_Consolidated_Daily_Accounts_{office_id}_{date_str}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================================
# ADVANCED REPORTS & ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/daily-accounts/reports")
def read_daily_accounts_reports_endpoint(
    office_id: str = "PO-COLOMBO-CENTRAL",
    start_date: str = "",
    end_date: str = "",
    category: str = "",
    clerk_id: str = "",
    status: str = "",
):
    return get_advanced_accounting_report(
        office_id=office_id,
        start_date=start_date,
        end_date=end_date,
        category=category,
        clerk_id=clerk_id,
        status=status,
    )


@router.get("/daily-accounts/reports/export")
def export_daily_accounts_reports_endpoint(
    office_id: str = "PO-COLOMBO-CENTRAL",
    start_date: str = "",
    end_date: str = "",
    category: str = "",
    clerk_id: str = "",
    status: str = "",
):
    excel_bytes = export_advanced_accounting_report_excel(
        office_id=office_id,
        start_date=start_date,
        end_date=end_date,
        category=category,
        clerk_id=clerk_id,
        status=status,
    )
    filename = f"SLP_Accounting_Report_{office_id}_{start_date or 'Start'}_to_{end_date or 'End'}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _guard_attendance(doc: dict) -> None:

    if doc.get("date"):
        assert_attendance_writable(str(doc.get("date")))


@router.get("/{doctype}")
def list_docs(doctype: str, request: Request, search: str = ""):
    require_clerk_or_postmaster(request)
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
    require_clerk_or_postmaster(request)
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
