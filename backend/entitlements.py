"""Employee Entitlements module for Post-Assist LK / SL POSTAL KPI DESK.

Manages employee benefits, allowances, deductions, service-period calculations,
statutory rules (EPF, Gratuity, Housing Loan), approval workflows, and audit history.
"""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from attendance import get_settings
from db import get_db

COLLECTION_ENTITLEMENTS = "entitlement_record"
COLLECTION_AUDIT = "entitlement_audit"

VALID_CATEGORIES = {"allowance", "deduction", "service_benefit"}
VALID_FREQUENCIES = {"Monthly", "Annual", "One-time", "Quarterly", "Calculated"}
VALID_ELIGIBILITIES = {"Applicable", "Not applicable", "Pending verification", "Approved"}
VALID_STATUSES = {"Active", "Pending", "Approved", "Rejected", "Expired", "Inactive"}
VALID_AMOUNT_TYPES = {"fixed", "percentage", "calculated"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _money(val: Any) -> float:
    try:
        return round(float(val or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _parse_date(text: str | None) -> date | None:
    if not text:
        return None
    val = str(text).strip()
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", val)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def calculate_service_period(
    appointment_date_str: str | None,
    years_of_experience: int | float | None = None,
    as_of: date | None = None,
) -> dict:
    """Calculate service duration from appointment date or years of experience."""
    target_date = as_of or date.today()
    appt = _parse_date(appointment_date_str)

    if appt:
        total_months = (target_date.year - appt.year) * 12 + (target_date.month - appt.month)
        if target_date.day < appt.day:
            total_months -= 1
        total_months = max(0, total_months)
        years = total_months // 12
        months = total_months % 12
        parts = []
        if years > 0:
            parts.append(f"{years} year{'s' if years != 1 else ''}")
        if months > 0 or years == 0:
            parts.append(f"{months} month{'s' if months != 1 else ''}")
        formatted = ", ".join(parts)
        return {
            "is_available": True,
            "appointment_date": appt.isoformat(),
            "service_years": years,
            "service_months": months,
            "total_months": total_months,
            "formatted": formatted,
        }

    if years_of_experience is not None:
        try:
            years = int(years_of_experience)
            if years >= 0:
                return {
                    "is_available": True,
                    "appointment_date": None,
                    "service_years": years,
                    "service_months": 0,
                    "total_months": years * 12,
                    "formatted": f"{years} year{'s' if years != 1 else ''}",
                }
        except (TypeError, ValueError):
            pass

    return {
        "is_available": False,
        "appointment_date": None,
        "service_years": 0,
        "service_months": 0,
        "total_months": 0,
        "formatted": "Not available",
    }


def evaluate_benefit_rules(employee: dict) -> list[dict]:
    """Evaluate departmental postal service benefits based on verified eligibility rules."""
    basic_salary = _money(employee.get("basic_salary"))
    emp_type = str(employee.get("employment_type") or "Permanent").strip()
    service = calculate_service_period(
        employee.get("appointment_date"),
        employee.get("years_of_experience"),
    )
    years = service["service_years"]
    is_perm = emp_type.lower() == "permanent"

    benefits = []

    # 1. Gratuity (Statutory: 5+ years completed service, 0.5 month basic per completed year)
    gratuity_eligible = service["is_available"] and years >= 5 and basic_salary > 0
    gratuity_amount = round((basic_salary / 2.0) * years, 2) if gratuity_eligible else None
    benefits.append(
        {
            "benefit_key": "gratuity",
            "name": "Gratuity Eligibility",
            "eligibility_status": "Eligible" if gratuity_eligible else "Not eligible",
            "applicable": gratuity_eligible,
            "estimated_amount": gratuity_amount,
            "rule_note": (
                f"Statutory entitlement: Requires 5+ completed years. Currently {years} years. "
                "Formula: (Basic Salary / 2) × Completed Years."
            ),
        }
    )

    # 2. Government Housing Loan Scheme (Permanent staff with at least 3 years completed service)
    housing_eligible = is_perm and service["is_available"] and years >= 3
    benefits.append(
        {
            "benefit_key": "housing_loan",
            "name": "Postal Housing Loan Scheme",
            "eligibility_status": "Eligible" if housing_eligible else "Not eligible",
            "applicable": housing_eligible,
            "estimated_amount": min(basic_salary * 120, 3000000.0) if housing_eligible else None,
            "rule_note": "Departmental policy: Permanent appointment with minimum 3 years confirmed service.",
        }
    )

    # 3. Festival Advance / Distress Loan
    advance_eligible = is_perm or (service["is_available"] and years >= 1)
    benefits.append(
        {
            "benefit_key": "festival_advance",
            "name": "Annual Festival Advance",
            "eligibility_status": "Eligible" if advance_eligible else "Not eligible",
            "applicable": advance_eligible,
            "estimated_amount": 25000.0 if advance_eligible else None,
            "rule_note": "Concessionary annual festival advance repayable in 10 equal monthly installments.",
        }
    )

    # 4. Distress Loan Facility
    distress_eligible = is_perm and service["is_available"] and years >= 2
    benefits.append(
        {
            "benefit_key": "distress_loan",
            "name": "Government Distress Loan",
            "eligibility_status": "Eligible" if distress_eligible else "Not eligible",
            "applicable": distress_eligible,
            "estimated_amount": min(basic_salary * 10, 500000.0) if distress_eligible else None,
            "rule_note": "Emergency assistance loan up to 10 months basic salary, repayable over 60 months.",
        }
    )

    return benefits


def calculate_entitlement_amount(entitlement: dict, basic_salary: float) -> float:
    """Compute effective monthly LKR amount for an entitlement."""
    amt_type = entitlement.get("amount_type", "fixed")
    freq = entitlement.get("frequency", "Monthly")

    raw_amount = _money(entitlement.get("amount"))
    if amt_type == "percentage":
        pct = float(entitlement.get("percentage_value") or 0.0)
        raw_amount = round(basic_salary * (pct / 100.0), 2)

    # Normalize to monthly equivalent for recurring totals
    if freq == "Annual":
        return round(raw_amount / 12.0, 2)
    if freq == "Quarterly":
        return round(raw_amount / 3.0, 2)
    if freq == "One-time":
        return raw_amount
    return raw_amount


def get_entitlements_summary() -> dict:
    """Dashboard summary metrics."""
    seed_default_entitlements_if_empty()
    db = get_db()
    total_employees = db["employee"].count_documents({})

    records = list(db[COLLECTION_ENTITLEMENTS].find())
    now_date = date.today()

    active_allowances = []
    active_deductions = []
    pending_reviews = []
    expiring_soon = []
    eligible_emp_ids = set()

    # Preload employee salaries for accurate percentage deduction/allowance totals
    emp_salaries = {
        (doc.get("employee_id") or doc.get("_id")): _money(doc.get("basic_salary"))
        for doc in db["employee"].find()
    }

    for rec in records:
        status = rec.get("approval_status")
        category = rec.get("category")
        emp_id = rec.get("employee_id")
        emp_salary = emp_salaries.get(emp_id, 0.0)
        eff_amount = calculate_entitlement_amount(rec, emp_salary)

        if status == "Pending":
            pending_reviews.append(rec)

        # Check expiry
        exp = _parse_date(rec.get("expiry_date"))
        if exp and exp >= now_date and (exp - now_date).days <= 30:
            expiring_soon.append(rec)

        is_active = status in {"Active", "Approved"}
        if is_active:
            eligible_emp_ids.add(emp_id)
            if category == "allowance":
                active_allowances.append(eff_amount)
            elif category == "deduction":
                active_deductions.append(eff_amount)

    # Check gratuity eligibility for total eligible count
    for emp in db["employee"].find():
        emp_id = emp.get("employee_id") or emp.get("_id")
        service = calculate_service_period(emp.get("appointment_date"), emp.get("years_of_experience"))
        if service["is_available"] and service["service_years"] >= 5:
            eligible_emp_ids.add(emp_id)

    return {
        "total_employees": total_employees,
        "eligible_count": len(eligible_emp_ids),
        "active_allowances_count": len(active_allowances),
        "active_allowances_monthly_lkr": round(sum(active_allowances), 2),
        "active_deductions_count": len(active_deductions),
        "active_deductions_monthly_lkr": round(sum(active_deductions), 2),
        "pending_reviews_count": len(pending_reviews),
        "expiring_soon_count": len(expiring_soon),
    }


def list_entitlement_records(
    employee_id: str | None = None,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Retrieve filtered entitlement records with computed employee and amount fields."""
    seed_default_entitlements_if_empty()
    db = get_db()
    query: dict[str, Any] = {}

    if employee_id:
        query["employee_id"] = str(employee_id).strip()
    if category and category != "all":
        query["category"] = str(category).strip().lower()
    if status and status != "all":
        query["approval_status"] = str(status).strip()

    docs = list(db[COLLECTION_ENTITLEMENTS].find(query).sort("created_at", -1))
    emp_map = {
        (e.get("employee_id") or e.get("_id")): e
        for e in db["employee"].find()
    }

    filtered = []
    term = (search or "").strip().lower()

    for doc in docs:
        emp = emp_map.get(doc.get("employee_id"), {})
        emp_name = emp.get("employee_name") or doc.get("employee_name") or ""
        ent_name = doc.get("entitlement_name") or ""
        emp_id = doc.get("employee_id") or ""
        salary = _money(emp.get("basic_salary"))

        # Text search matching
        if term:
            haystack = f"{emp_name} {emp_id} {ent_name} {doc.get('category')} {doc.get('approval_status')}".lower()
            if term not in haystack:
                continue

        item = {key: value for key, value in doc.items() if key != "_id"}
        item["id"] = str(doc["_id"])
        item["employee_name"] = emp_name
        item["designation"] = emp.get("designation") or "Staff"
        item["post_office"] = emp.get("post_office") or "Kaduwela"
        item["basic_salary"] = salary
        item["effective_amount"] = calculate_entitlement_amount(doc, salary)
        filtered.append(item)

    return filtered


def get_employee_entitlements(employee_id: str) -> dict:
    """Retrieve full entitlement profile, calculations, and benefits for an employee."""
    seed_default_entitlements_if_empty()
    db = get_db()
    employee = db["employee"].find_one({"_id": employee_id}) or db["employee"].find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    resolved_id = employee.get("employee_id") or employee.get("_id")
    salary = _money(employee.get("basic_salary"))

    service = calculate_service_period(
        employee.get("appointment_date"),
        employee.get("years_of_experience"),
    )

    records = list_entitlement_records(employee_id=resolved_id)

    allowances = [r for r in records if r.get("category") == "allowance"]
    deductions = [r for r in records if r.get("category") == "deduction"]
    benefits = [r for r in records if r.get("category") == "service_benefit"]

    # Statutory service benefits evaluated by policy
    statutory_benefits = evaluate_benefit_rules(employee)

    active_allowances = [a for a in allowances if a.get("approval_status") in {"Active", "Approved"}]
    active_deductions = [d for d in deductions if d.get("approval_status") in {"Active", "Approved"}]

    monthly_allowances_total = round(sum(a["effective_amount"] for a in active_allowances if a.get("frequency") != "One-time"), 2)
    monthly_deductions_total = round(sum(d["effective_amount"] for d in active_deductions if d.get("frequency") != "One-time"), 2)
    net_monthly_impact = round(monthly_allowances_total - monthly_deductions_total, 2)

    return {
        "employee": {
            "employee_id": resolved_id,
            "employee_name": employee.get("employee_name") or "",
            "designation": employee.get("designation") or "Staff",
            "post_office": employee.get("post_office") or "Kaduwela",
            "work_category": employee.get("work_category") or "Office",
            "employment_type": employee.get("employment_type") or "Permanent",
            "appointment_date": employee.get("appointment_date"),
            "years_of_experience": employee.get("years_of_experience"),
            "basic_salary": salary if salary > 0 else None,
            "service_period": service,
        },
        "summary": {
            "monthly_allowances_total": monthly_allowances_total,
            "monthly_deductions_total": monthly_deductions_total,
            "net_monthly_impact": net_monthly_impact,
            "active_allowance_count": len(active_allowances),
            "active_deduction_count": len(active_deductions),
            "pending_count": len([r for r in records if r.get("approval_status") == "Pending"]),
        },
        "allowances": allowances,
        "deductions": deductions,
        "service_benefits": benefits,
        "statutory_benefits": statutory_benefits,
    }


def create_entitlement_record(body: dict, user: str = "postmaster") -> dict:
    """Create a new employee entitlement with strict validation and audit recording."""
    db = get_db()
    emp_id = str(body.get("employee_id") or "").strip()
    if not emp_id:
        raise HTTPException(status_code=400, detail="Employee selection is required")

    employee = db["employee"].find_one({"_id": emp_id}) or db["employee"].find_one({"employee_id": emp_id})
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {emp_id} does not exist")

    category = str(body.get("category") or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}")

    entitlement_name = str(body.get("entitlement_name") or "").strip()
    if not entitlement_name:
        raise HTTPException(status_code=400, detail="Entitlement name is required")

    amount_type = str(body.get("amount_type") or "fixed").strip().lower()
    if amount_type not in VALID_AMOUNT_TYPES:
        amount_type = "fixed"

    amount = None
    percentage_value = None
    percentage_basis = None

    if amount_type == "percentage":
        try:
            percentage_value = float(body.get("percentage_value") or 0.0)
            if percentage_value < 0 or percentage_value > 100:
                raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Valid percentage is required") from exc
        percentage_basis = str(body.get("percentage_basis") or "basic_salary").strip()
    else:
        try:
            raw_amt = body.get("amount")
            amount = float(raw_amt) if raw_amt not in (None, "") else 0.0
            if amount < 0:
                raise HTTPException(status_code=400, detail="Entitlement amount cannot be negative")
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="A valid monetary amount is required") from exc

    frequency = str(body.get("frequency") or "Monthly").strip()
    if frequency not in VALID_FREQUENCIES:
        frequency = "Monthly"

    eligibility = str(body.get("eligibility_status") or "Applicable").strip()
    if eligibility not in VALID_ELIGIBILITIES:
        eligibility = "Applicable"

    approval = str(body.get("approval_status") or "Approved").strip()
    if approval not in VALID_STATUSES:
        approval = "Approved"

    effective_date = str(body.get("effective_date") or "").strip()
    if not _parse_date(effective_date):
        effective_date = date.today().isoformat()

    expiry_date = str(body.get("expiry_date") or "").strip() or None
    if expiry_date:
        parsed_exp = _parse_date(expiry_date)
        parsed_eff = _parse_date(effective_date)
        if not parsed_exp:
            raise HTTPException(status_code=400, detail="Invalid expiry date format")
        if parsed_eff and parsed_exp < parsed_eff:
            raise HTTPException(status_code=400, detail="Expiry date cannot precede the effective date")

    # Prevent duplicate active entitlement of the same name for this employee
    existing = db[COLLECTION_ENTITLEMENTS].find_one(
        {
            "employee_id": emp_id,
            "category": category,
            "entitlement_name": entitlement_name,
            "approval_status": {"$in": ["Active", "Approved", "Pending"]},
        }
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An active or pending entitlement for '{entitlement_name}' already exists for this employee.",
        )

    doc_id = str(uuid.uuid4())
    now_str = _now_iso()

    doc = {
        "_id": doc_id,
        "employee_id": emp_id,
        "employee_name": employee.get("employee_name") or "",
        "category": category,
        "entitlement_name": entitlement_name,
        "amount": amount,
        "amount_type": amount_type,
        "percentage_value": percentage_value,
        "percentage_basis": percentage_basis,
        "frequency": frequency,
        "eligibility_status": eligibility,
        "approval_status": approval,
        "effective_date": effective_date,
        "expiry_date": expiry_date,
        "notes": str(body.get("notes") or "").strip(),
        "created_at": now_str,
        "created_by": user,
        "updated_at": now_str,
        "updated_by": user,
        "approved_by": user if approval == "Approved" else None,
        "approved_at": now_str if approval == "Approved" else None,
    }

    db[COLLECTION_ENTITLEMENTS].insert_one(doc)

    # Record audit trail
    _audit_entitlement(
        entitlement_id=doc_id,
        employee_id=emp_id,
        action="created",
        performed_by=user,
        new_values=doc,
        notes=f"Created {category} '{entitlement_name}' with status {approval}.",
    )

    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = doc_id
    out["effective_amount"] = calculate_entitlement_amount(doc, _money(employee.get("basic_salary")))
    return out


def update_entitlement_record(record_id: str, body: dict, user: str = "postmaster") -> dict:
    """Update an existing entitlement record with change tracking."""
    db = get_db()
    existing = db[COLLECTION_ENTITLEMENTS].find_one({"_id": record_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Entitlement record not found")

    updates: dict[str, Any] = {}

    if "entitlement_name" in body:
        name = str(body["entitlement_name"]).strip()
        if not name:
            raise HTTPException(status_code=400, detail="Entitlement name cannot be blank")
        updates["entitlement_name"] = name

    if "amount_type" in body:
        amt_type = str(body["amount_type"]).strip().lower()
        if amt_type in VALID_AMOUNT_TYPES:
            updates["amount_type"] = amt_type

    if "amount" in body:
        try:
            amt = float(body["amount"]) if body["amount"] not in (None, "") else 0.0
            if amt < 0:
                raise HTTPException(status_code=400, detail="Amount cannot be negative")
            updates["amount"] = amt
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid monetary amount") from exc

    if "percentage_value" in body:
        try:
            pv = float(body["percentage_value"]) if body["percentage_value"] not in (None, "") else None
            if pv is not None and (pv < 0 or pv > 100):
                raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
            updates["percentage_value"] = pv
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid percentage") from exc

    if "percentage_basis" in body:
        updates["percentage_basis"] = str(body["percentage_basis"] or "basic_salary").strip()

    if "frequency" in body:
        freq = str(body["frequency"]).strip()
        if freq in VALID_FREQUENCIES:
            updates["frequency"] = freq

    if "eligibility_status" in body:
        elig = str(body["eligibility_status"]).strip()
        if elig in VALID_ELIGIBILITIES:
            updates["eligibility_status"] = elig

    if "approval_status" in body:
        app = str(body["approval_status"]).strip()
        if app in VALID_STATUSES:
            updates["approval_status"] = app
            if app == "Approved" and not existing.get("approved_by"):
                updates["approved_by"] = user
                updates["approved_at"] = _now_iso()

    if "effective_date" in body:
        eff = str(body["effective_date"]).strip()
        if _parse_date(eff):
            updates["effective_date"] = eff

    if "expiry_date" in body:
        exp = str(body["expiry_date"]).strip() or None
        if exp and not _parse_date(exp):
            raise HTTPException(status_code=400, detail="Invalid expiry date format")
        updates["expiry_date"] = exp

    if "notes" in body:
        updates["notes"] = str(body["notes"] or "").strip()

    updates["updated_at"] = _now_iso()
    updates["updated_by"] = user

    db[COLLECTION_ENTITLEMENTS].update_one({"_id": record_id}, {"$set": updates})

    _audit_entitlement(
        entitlement_id=record_id,
        employee_id=existing.get("employee_id", ""),
        action="updated",
        performed_by=user,
        previous_values={k: existing.get(k) for k in updates if k in existing},
        new_values=updates,
        notes=f"Updated entitlement {existing.get('entitlement_name')}.",
    )

    updated = db[COLLECTION_ENTITLEMENTS].find_one({"_id": record_id})
    out = {k: v for k, v in updated.items() if k != "_id"}
    out["id"] = record_id
    return out


def action_entitlement_record(record_id: str, action: str, notes: str = "", user: str = "postmaster") -> dict:
    """Perform consequential status actions (approve, reject, deactivate, activate) with audit."""
    db = get_db()
    existing = db[COLLECTION_ENTITLEMENTS].find_one({"_id": record_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Entitlement record not found")

    action_clean = str(action).strip().lower()
    now_str = _now_iso()
    status_map = {
        "approve": "Approved",
        "reject": "Rejected",
        "deactivate": "Inactive",
        "activate": "Approved",
    }

    if action_clean not in status_map:
        raise HTTPException(status_code=400, detail=f"Unsupported action '{action}'. Use approve, reject, deactivate, or activate.")

    new_status = status_map[action_clean]
    updates = {
        "approval_status": new_status,
        "updated_at": now_str,
        "updated_by": user,
    }
    if action_clean in {"approve", "activate"}:
        updates["approved_by"] = user
        updates["approved_at"] = now_str

    db[COLLECTION_ENTITLEMENTS].update_one({"_id": record_id}, {"$set": updates})

    _audit_entitlement(
        entitlement_id=record_id,
        employee_id=existing.get("employee_id", ""),
        action=action_clean,
        performed_by=user,
        previous_values={"approval_status": existing.get("approval_status")},
        new_values=updates,
        notes=notes or f"Action '{action_clean}' changed status to {new_status}.",
    )

    return {
        "ok": True,
        "id": record_id,
        "approval_status": new_status,
        "action": action_clean,
        "updated_by": user,
    }


def update_employee_service_profile(employee_id: str, data: dict, user: str = "postmaster") -> dict:
    """Update employee service dates and basic salary."""
    db = get_db()
    emp = db["employee"].find_one({"_id": employee_id}) or db["employee"].find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    resolved_id = emp.get("employee_id") or emp.get("_id")
    updates: dict[str, Any] = {}

    if "appointment_date" in data:
        appt = str(data["appointment_date"]).strip() or None
        if appt and not _parse_date(appt):
            raise HTTPException(status_code=400, detail="Invalid appointment date format (YYYY-MM-DD required)")
        updates["appointment_date"] = appt

    if "basic_salary" in data:
        try:
            sal = float(data["basic_salary"]) if data["basic_salary"] not in (None, "") else None
            if sal is not None and sal < 0:
                raise HTTPException(status_code=400, detail="Basic salary cannot be negative")
            updates["basic_salary"] = sal
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid basic salary amount") from exc

    if "years_of_experience" in data:
        try:
            yoe = int(data["years_of_experience"]) if data["years_of_experience"] not in (None, "") else None
            if yoe is not None and yoe < 0:
                raise HTTPException(status_code=400, detail="Years of experience cannot be negative")
            updates["years_of_experience"] = yoe
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid years of experience") from exc

    if "employment_type" in data:
        et = str(data["employment_type"]).strip()
        if et in {"Permanent", "Contract", "Temporary", "Probation"}:
            updates["employment_type"] = et

    if updates:
        db["employee"].update_one({"_id": resolved_id}, {"$set": updates})
        _audit_entitlement(
            entitlement_id=f"profile-{resolved_id}",
            employee_id=resolved_id,
            action="profile_updated",
            performed_by=user,
            previous_values={k: emp.get(k) for k in updates if k in emp},
            new_values=updates,
            notes=f"Updated service profile fields: {', '.join(updates.keys())}.",
        )

    return get_employee_entitlements(resolved_id)


def _audit_entitlement(
    entitlement_id: str,
    employee_id: str,
    action: str,
    performed_by: str,
    new_values: dict,
    previous_values: dict | None = None,
    notes: str = "",
) -> None:
    try:
        db = get_db()
        db[COLLECTION_AUDIT].insert_one(
            {
                "_id": str(uuid.uuid4()),
                "entitlement_id": entitlement_id,
                "employee_id": employee_id,
                "action": action,
                "performed_by": performed_by,
                "timestamp": _now_iso(),
                "previous_values": previous_values,
                "new_values": {k: v for k, v in new_values.items() if k != "_id"},
                "notes": notes,
            }
        )
    except Exception as exc:
        print(f"Failed to record entitlement audit log: {exc}")


def get_entitlement_audit_trail(record_id: str) -> list[dict]:
    """Retrieve audit history for an entitlement record."""
    db = get_db()
    logs = list(
        db[COLLECTION_AUDIT]
        .find({"entitlement_id": record_id})
        .sort("timestamp", -1)
    )
    return [{k: v for k, v in log.items() if k != "_id"} for log in logs]


def get_entitlements_report_data() -> dict:
    """Generate comprehensive entitlement reporting summaries."""
    summary = get_entitlements_summary()
    records = list_entitlement_records()
    db = get_db()
    employees = list(db["employee"].find())

    # Allowance breakdowns
    allowances_by_type: dict[str, dict] = {}
    deductions_by_type: dict[str, dict] = {}

    for r in records:
        if r.get("approval_status") not in {"Active", "Approved"}:
            continue
        cat = r.get("category")
        name = r.get("entitlement_name")
        amt = r.get("effective_amount", 0.0)

        if cat == "allowance":
            curr = allowances_by_type.get(name, {"type": name, "count": 0, "total_monthly": 0.0})
            curr["count"] += 1
            curr["total_monthly"] = round(curr["total_monthly"] + amt, 2)
            allowances_by_type[name] = curr
        elif cat == "deduction":
            curr = deductions_by_type.get(name, {"type": name, "count": 0, "total_monthly": 0.0})
            curr["count"] += 1
            curr["total_monthly"] = round(curr["total_monthly"] + amt, 2)
            deductions_by_type[name] = curr

    # Per-employee summaries
    emp_summaries = []
    for emp in employees:
        emp_id = emp.get("employee_id") or emp.get("_id")
        emp_records = [r for r in records if r.get("employee_id") == emp_id and r.get("approval_status") in {"Active", "Approved"}]
        basic = _money(emp.get("basic_salary"))
        tot_allow = round(sum(r["effective_amount"] for r in emp_records if r.get("category") == "allowance"), 2)
        tot_ded = round(sum(r["effective_amount"] for r in emp_records if r.get("category") == "deduction"), 2)
        service = calculate_service_period(emp.get("appointment_date"), emp.get("years_of_experience"))
        benefits = evaluate_benefit_rules(emp)

        emp_summaries.append(
            {
                "employee_id": emp_id,
                "employee_name": emp.get("employee_name") or "",
                "designation": emp.get("designation") or "Staff",
                "post_office": emp.get("post_office") or "Kaduwela",
                "service_period": service["formatted"],
                "basic_salary": basic,
                "total_allowances": tot_allow,
                "total_deductions": tot_ded,
                "net_impact": round(tot_allow - tot_ded, 2),
                "gratuity_eligible": any(b["benefit_key"] == "gratuity" and b["applicable"] for b in benefits),
                "housing_loan_eligible": any(b["benefit_key"] == "housing_loan" and b["applicable"] for b in benefits),
            }
        )

    # Pending approvals & expiring lists
    now_date = date.today()
    pending = [r for r in records if r.get("approval_status") == "Pending"]
    expiring = []
    for r in records:
        exp = _parse_date(r.get("expiry_date"))
        if exp and exp >= now_date and (exp - now_date).days <= 60:
            expiring.append({**r, "days_remaining": (exp - now_date).days})

    return {
        "summary": summary,
        "allowance_breakdown": list(allowances_by_type.values()),
        "deduction_breakdown": list(deductions_by_type.values()),
        "employee_summaries": emp_summaries,
        "pending_approvals": pending,
        "expiring_entitlements": expiring,
    }


def generate_entitlements_csv() -> str:
    """Export all entitlements to a CSV string."""
    records = list_entitlement_records()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        [
            "Employee ID",
            "Employee Name",
            "Designation",
            "Office",
            "Category",
            "Entitlement Name",
            "Amount (LKR)",
            "Frequency",
            "Eligibility Status",
            "Effective Date",
            "Expiry Date",
            "Approval Status",
            "Notes",
        ]
    )

    for r in records:
        writer.writerow(
            [
                r.get("employee_id"),
                r.get("employee_name"),
                r.get("designation"),
                r.get("post_office"),
                r.get("category"),
                r.get("entitlement_name"),
                r.get("effective_amount"),
                r.get("frequency"),
                r.get("eligibility_status"),
                r.get("effective_date"),
                r.get("expiry_date") or "—",
                r.get("approval_status"),
                r.get("notes") or "",
            ]
        )

    return output.getvalue()


# ── Initial Baseline Seeding for Departmental Records ─────────────────────────

DEFAULT_APPOINTMENTS: dict[str, dict] = {
    "EMP1137": {"appointment_date": "2018-03-01", "basic_salary": 48000.0, "years_of_experience": 8},
    "EMP1138": {"appointment_date": "2020-07-15", "basic_salary": 42000.0, "years_of_experience": 6},
    "EMP1139": {"appointment_date": "2017-02-10", "basic_salary": 44000.0, "years_of_experience": 9},
    "EMP1140": {"appointment_date": "2016-09-01", "basic_salary": 50000.0, "years_of_experience": 10},
    "EMP1141": {"appointment_date": "2022-04-01", "basic_salary": 38000.0, "years_of_experience": 4},
    "EMP1142": {"appointment_date": "2019-11-15", "basic_salary": 42000.0, "years_of_experience": 7},
    "EMP1143": {"appointment_date": "2024-01-10", "basic_salary": 35000.0, "years_of_experience": 2},
    "EMP1144": {"appointment_date": "2015-05-20", "basic_salary": 52000.0, "years_of_experience": 11},
    "EMP1145": {"appointment_date": "2021-08-01", "basic_salary": 40000.0, "years_of_experience": 5},
    "EMP1146": {"appointment_date": "2019-01-15", "basic_salary": 42000.0, "years_of_experience": 7},
    "EMP1147": {"appointment_date": "2023-03-01", "basic_salary": 38000.0, "years_of_experience": 3},
    "EMP1148": {"appointment_date": "2006-06-15", "basic_salary": 58000.0, "years_of_experience": 20},
    "EMP1149": {"appointment_date": "2014-08-01", "basic_salary": 65000.0, "years_of_experience": 12},
    "EMP1150": {"appointment_date": "2018-10-10", "basic_salary": 46000.0, "years_of_experience": 8},
    "EMP1151": {"appointment_date": "2017-06-01", "basic_salary": 45000.0, "years_of_experience": 9},
    "EMP1152": {"appointment_date": "2021-02-15", "basic_salary": 43000.0, "years_of_experience": 5},
}


def seed_default_entitlements_if_empty() -> None:
    """Populate baseline service dates and verified postal entitlement records if empty."""
    db = get_db()

    # 1. Enrich employees with baseline appointment dates & salaries if missing
    for emp_id, data in DEFAULT_APPOINTMENTS.items():
        doc = db["employee"].find_one({"_id": emp_id}) or db["employee"].find_one({"employee_id": emp_id})
        if doc:
            updates = {}
            if not doc.get("appointment_date") and data.get("appointment_date"):
                updates["appointment_date"] = data["appointment_date"]
            if not doc.get("basic_salary") and data.get("basic_salary"):
                updates["basic_salary"] = data["basic_salary"]
            if not doc.get("years_of_experience") and data.get("years_of_experience"):
                updates["years_of_experience"] = data["years_of_experience"]
            if updates:
                db["employee"].update_one({"_id": doc["_id"]}, {"$set": updates})

    # 2. Check if entitlement records collection already has data
    if db[COLLECTION_ENTITLEMENTS].count_documents({}) > 0:
        return

    now_str = _now_iso()
    batch = []

    for emp in db["employee"].find():
        emp_id = emp.get("employee_id") or emp.get("_id")
        emp_name = emp.get("employee_name") or ""
        designation = emp.get("designation") or ""
        is_field = "postman" in designation.lower() or "delivery" in designation.lower()
        is_sup = "postmaster" in designation.lower()

        # A. Cost of Living Allowance (Universal statutory state allowance: LKR 15,000)
        batch.append(
            {
                "_id": str(uuid.uuid4()),
                "employee_id": emp_id,
                "employee_name": emp_name,
                "category": "allowance",
                "entitlement_name": "Cost of Living Allowance",
                "amount": 15000.0,
                "amount_type": "fixed",
                "percentage_value": None,
                "percentage_basis": None,
                "frequency": "Monthly",
                "eligibility_status": "Approved",
                "approval_status": "Approved",
                "effective_date": "2024-01-01",
                "expiry_date": None,
                "notes": "State administrative circular for public service cost of living compensation.",
                "created_at": now_str,
                "created_by": "system",
                "updated_at": now_str,
                "updated_by": "system",
                "approved_by": "postmaster",
                "approved_at": now_str,
            }
        )

        # B. Transport / Field Mobility Allowance
        transport_amt = 5000.0 if is_field else 2500.0
        batch.append(
            {
                "_id": str(uuid.uuid4()),
                "employee_id": emp_id,
                "employee_name": emp_name,
                "category": "allowance",
                "entitlement_name": "Transport Allowance",
                "amount": transport_amt,
                "amount_type": "fixed",
                "percentage_value": None,
                "percentage_basis": None,
                "frequency": "Monthly",
                "eligibility_status": "Approved",
                "approval_status": "Approved",
                "effective_date": "2024-01-01",
                "expiry_date": None,
                "notes": f"Delivery beat travel reimbursement for {designation}.",
                "created_at": now_str,
                "created_by": "system",
                "updated_at": now_str,
                "updated_by": "system",
                "approved_by": "postmaster",
                "approved_at": now_str,
            }
        )

        # C. Administrative Allowance (Supervisory/Postmaster)
        if is_sup:
            batch.append(
                {
                    "_id": str(uuid.uuid4()),
                    "employee_id": emp_id,
                    "employee_name": emp_name,
                    "category": "allowance",
                    "entitlement_name": "Administrative Allowance",
                    "amount": 7500.0,
                    "amount_type": "fixed",
                    "percentage_value": None,
                    "percentage_basis": None,
                    "frequency": "Monthly",
                    "eligibility_status": "Approved",
                    "approval_status": "Approved",
                    "effective_date": "2024-01-01",
                    "expiry_date": None,
                    "notes": "Divisional supervisory and counter oversight duty compensation.",
                    "created_at": now_str,
                    "created_by": "system",
                    "updated_at": now_str,
                    "updated_by": "system",
                    "approved_by": "postmaster",
                    "approved_at": now_str,
                }
            )

        # D. Employee EPF Contribution (8% of basic salary)
        batch.append(
            {
                "_id": str(uuid.uuid4()),
                "employee_id": emp_id,
                "employee_name": emp_name,
                "category": "deduction",
                "entitlement_name": "Employee EPF Contribution (8%)",
                "amount": None,
                "amount_type": "percentage",
                "percentage_value": 8.0,
                "percentage_basis": "basic_salary",
                "frequency": "Monthly",
                "eligibility_status": "Approved",
                "approval_status": "Approved",
                "effective_date": "2024-01-01",
                "expiry_date": None,
                "notes": "Statutory Employees Provident Fund deduction (Act No. 15 of 1958).",
                "created_at": now_str,
                "created_by": "system",
                "updated_at": now_str,
                "updated_by": "system",
                "approved_by": "postmaster",
                "approved_at": now_str,
            }
        )

    # E. Add a couple of sample pending/review deductions and loans
    sample_pendings = [
        {
            "_id": str(uuid.uuid4()),
            "employee_id": "EMP1137",
            "employee_name": "Nuwan Priyantha Fernando",
            "category": "deduction",
            "entitlement_name": "Postal Welfare Society Contribution",
            "amount": 1200.0,
            "amount_type": "fixed",
            "percentage_value": None,
            "percentage_basis": None,
            "frequency": "Monthly",
            "eligibility_status": "Approved",
            "approval_status": "Approved",
            "effective_date": "2024-01-01",
            "expiry_date": None,
            "notes": "Voluntary departmental staff mutual benefit fund contribution.",
            "created_at": now_str,
            "created_by": "system",
            "updated_at": now_str,
            "updated_by": "system",
            "approved_by": "postmaster",
            "approved_at": now_str,
        },
        {
            "_id": str(uuid.uuid4()),
            "employee_id": "EMP1138",
            "employee_name": "Sunil Chaminda Perera",
            "category": "deduction",
            "entitlement_name": "Festival Advance Repayment",
            "amount": 2500.0,
            "amount_type": "fixed",
            "percentage_value": None,
            "percentage_basis": None,
            "frequency": "Monthly",
            "eligibility_status": "Approved",
            "approval_status": "Approved",
            "effective_date": "2025-01-01",
            "expiry_date": "2025-10-31",
            "notes": "Installment 1 of 10 for Sinhala & Tamil New Year advance.",
            "created_at": now_str,
            "created_by": "system",
            "updated_at": now_str,
            "updated_by": "system",
            "approved_by": "postmaster",
            "approved_at": now_str,
        },
        {
            "_id": str(uuid.uuid4()),
            "employee_id": "EMP1141",
            "employee_name": "Prasanna Madushanka Dias",
            "category": "allowance",
            "entitlement_name": "Motorcycle Fuel Subsidy",
            "amount": 3500.0,
            "amount_type": "fixed",
            "percentage_value": None,
            "percentage_basis": None,
            "frequency": "Monthly",
            "eligibility_status": "Pending verification",
            "approval_status": "Pending",
            "effective_date": "2025-02-01",
            "expiry_date": None,
            "notes": "Submitted route fuel subsidy request pending Divisional Postmaster sign-off.",
            "created_at": now_str,
            "created_by": "EMP1141",
            "updated_at": now_str,
            "updated_by": "EMP1141",
            "approved_by": None,
            "approved_at": None,
        },
    ]
    batch.extend(sample_pendings)

    if batch:
        db[COLLECTION_ENTITLEMENTS].insert_many(batch)
