"""Monthly pay from basic salary, late attendance, overtime, and contribution rates."""

import re
import uuid

from fastapi import HTTPException

from attendance import get_settings
from db import get_db

ENTITLEMENTS = {
    "leave",
    "holiday-pay",
    "overtime",
    "gratuity",
    "promotion",
    "transfer",
    "family-benefit",
    "retirement",
    "loan",
}


def _money(value) -> float:
    return round(float(value or 0), 2)


def _month(value: str) -> str:
    text = str(value or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}", text):
        raise HTTPException(status_code=400, detail="Choose a month")
    return text


def payroll_rows(month: str) -> dict:
    month = _month(month)
    settings = get_settings()
    db = get_db()
    employees = list(db["employee"].find().sort("employee_id", 1))
    late_counts: dict[str, int] = {}
    for log in db["attendance_log"].find(
        {"date": {"$regex": f"^{month}"}, "attendance_status": "Late"}
    ):
        employee_id = log.get("employee_id")
        if employee_id:
            late_counts[employee_id] = late_counts.get(employee_id, 0) + 1

    ot_hours: dict[str, float] = {}
    for row in db["overtime"].find({"date": {"$regex": f"^{month}"}, "status": "Approved"}):
        employee_id = row.get("employee_id")
        if employee_id:
            ot_hours[employee_id] = ot_hours.get(employee_id, 0) + float(row.get("hours") or 0)

    pending_overtime = db["overtime"].count_documents(
        {"date": {"$regex": f"^{month}"}, "status": "Pending"}
    )
    rows = []
    net_total = 0.0
    for employee in employees:
        employee_id = employee.get("employee_id") or employee.get("name")
        basic = _money(employee.get("basic_salary"))
        late_days = late_counts.get(employee_id, 0)
        hours = round(ot_hours.get(employee_id, 0), 2)
        overtime_pay = _money(hours * settings["ot_rate_lkr"])
        late_deduction = _money(late_days * settings["late_deduction_lkr"])
        epf_employee = _money(basic * settings["epf_employee_percent"] / 100)
        epf_employer = _money(basic * settings["epf_employer_percent"] / 100)
        etf = _money(basic * settings["etf_percent"] / 100)
        net = _money(basic + overtime_pay - late_deduction - epf_employee)
        net_total += net
        rows.append(
            {
                "employee_id": employee_id,
                "employee_name": employee.get("employee_name") or "",
                "designation": employee.get("designation") or "",
                "post_office": employee.get("post_office") or "",
                "basic_salary": basic,
                "late_days": late_days,
                "late_deduction": late_deduction,
                "overtime_hours": hours,
                "overtime_pay": overtime_pay,
                "epf_employee": epf_employee,
                "epf_employer": epf_employer,
                "etf": etf,
                "net_salary": net,
            }
        )
    return {
        "month": month,
        "rates": {
            "epf_employee_percent": settings["epf_employee_percent"],
            "epf_employer_percent": settings["epf_employer_percent"],
            "etf_percent": settings["etf_percent"],
            "late_deduction_lkr": settings["late_deduction_lkr"],
            "ot_rate_lkr": settings["ot_rate_lkr"],
        },
        "summary": {
            "employee_count": len(rows),
            "late_employees": len(late_counts),
            "pending_overtime": pending_overtime,
            "payroll_total": _money(net_total),
        },
        "rows": rows,
    }


def _collection(module: str):
    if module not in ENTITLEMENTS:
        raise HTTPException(status_code=404, detail="Unknown entitlement")
    name = "overtime" if module == "overtime" else f"entitlement_{module.replace('-', '_')}"
    return get_db()[name]


def list_entitlements(module: str) -> list[dict]:
    rows = []
    for doc in _collection(module).find().sort("employee_name", 1):
        item = {key: value for key, value in doc.items() if key != "_id"}
        item["id"] = str(doc["_id"])
        rows.append(item)
    return rows


def create_entitlement(module: str, body: dict) -> dict:
    employee_id = str(body.get("employee_id") or "").strip()
    employee = get_db()["employee"].find_one({"_id": employee_id})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    stored = {key: value for key, value in body.items() if key not in {"_id", "id"}}
    stored["employee_id"] = employee_id
    stored["employee_name"] = employee.get("employee_name") or ""
    if module == "overtime":
        try:
            stored["hours"] = float(stored.get("hours") or 0)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Enter the overtime hours") from exc
        if stored["hours"] < 0:
            raise HTTPException(status_code=400, detail="Overtime hours cannot be negative")
        stored["status"] = stored.get("status") or "Pending"
        if stored["status"] not in {"Pending", "Approved", "Rejected"}:
            raise HTTPException(status_code=400, detail="Choose a valid overtime status")
    stored["_id"] = str(uuid.uuid4())
    _collection(module).insert_one(stored)
    item = {key: value for key, value in stored.items() if key != "_id"}
    item["id"] = stored["_id"]
    return item


def delete_entitlement(module: str, item_id: str) -> dict:
    result = _collection(module).delete_one({"_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}
