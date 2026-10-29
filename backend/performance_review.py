"""24-month promotion review and daily allocation for the postmaster.

The next-week KPI model is not used here. Review rules are examples for this
desk. They are not official Sri Lanka Post promotion standards. A person must
approve any promotion or any change to the day's work.
"""

import re
import threading
import time
from datetime import date, datetime, timedelta

from fastapi import HTTPException

from db import get_db

WINDOW_MONTHS = 24
MIN_MONTHS_WITH_WORK = 12
MIN_MEAN_KPI = 85
MIN_RATE = 80
MIN_ATTENDANCE = 90
MIN_MONTHS_SINCE_PROMOTION = 12
EXAMPLE_DAILY_CAPACITY = 40
DEFAULT_DAILY_BENCHMARK = 5
PRESENT_STATUSES = {"on time", "late", "half day", "present"}
STANDARD_DAY_HOURS = 8
SALARY_HOURS = 240
OT_MULTIPLIER = 1.5
COVER_ROUTE_HOURS = 4
EXTRA_TASK_HOURS = 1
DELIVERY_ROLES = {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}
COUNTER_OFFICE_ROLES = {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer", "Mail Sorter"}
SUPERVISORY_ROLES = {"Postmaster (Head)", "Postmaster"}


def normalize_role(role_name: str, category: str = "") -> str:
    """Normalize role string to handle casing, spaces, and equivalent designation labels."""
    r = str(role_name or "").strip().lower()
    c = str(category or "").strip().lower()
    if "postmaster" in r or "head" in r:
        return "Postmaster (Head)"
    if "senior postman" in r:
        return "Senior Postman"
    if "postman" in r:
        return "Postman"
    if "mail sorter" in r or "sorter" in r:
        return "Mail Sorter"
    if "counter clerk" in r:
        return "Counter Clerk"
    if "postal assistant" in r:
        return "Postal Assistant"
    if "postal clerk" in r:
        return "Postal Clerk"
    if "postal officer" in r:
        return "Postal Officer"
    if "delivery officer" in r:
        return "Delivery Officer"
    return str(role_name or "").strip()

# Example desk rules for which current role may receive a task. Not an official postal standard.
# A person's designation and work category are never changed by allocation.
TASK_FIT = {
    "Mail & Parcel Delivery": {
        "roles": {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"},
        "categories": {"Delivery (Field)", "Delivery"},
    },
    "Customer Service Counter": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations", "Counter Services"},
    },
    "Money Order Processing": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations", "Counter Services"},
    },
    "Postal Clerk Duties": {
        "roles": {"Counter Clerk", "Postal Clerk", "Postal Assistant", "Postal Officer", "Postmaster (Head)"},
        "categories": {"Office", "Postal Operations", "Counter Services", "Supervisory / Office"},
    },
    "Data Entry": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations"},
    },
    "Accounts Processing": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations"},
    },
    "Accounts Verification": {
        "roles": {"Postmaster (Head)", "Postal Officer"},
        "categories": {"Supervisory / Office", "Office"},
    },
    "Correspondence Handling": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations"},
    },
    "Communication Support": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations"},
    },
    "Calendar Management": {
        "roles": {"Postal Assistant", "Postal Clerk", "Counter Clerk"},
        "categories": {"Office", "Postal Operations"},
    },
    "Stock & Inventory Check": {
        "roles": {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"},
        "categories": {"Office", "Postal Operations"},
    },
    "Ad-hoc Project Support": {
        "roles": {"Postal Assistant", "Postal Clerk", "Postal Officer", "Counter Clerk"},
        "categories": {"Office", "Postal Operations"},
    },
    "Workflow Coordination": {
        "roles": {"Postal Assistant", "Postal Clerk", "Postal Officer", "Counter Clerk"},
        "categories": {"Office", "Postal Operations"},
    },
    "Team Coordination": {
        "roles": {"Postal Assistant", "Postal Clerk", "Postal Officer", "Counter Clerk"},
        "categories": {"Office", "Postal Operations"},
    },
    "Approvals & Audit": {
        "roles": {"Postmaster (Head)"},
        "category": "Supervisory / Office",
    },
    "Staff Performance Review": {
        "roles": {"Postmaster (Head)"},
        "category": "Supervisory / Office",
    },
    "Work Allocation & Supervision": {
        "roles": {"Postmaster (Head)"},
        "category": "Supervisory / Office",
    },
}

# Daily checklist labels and the current role that may receive each one.
CHECKLIST_FIT = {
    "Incoming Mail Registration": ("Office", {"Mail Sorter", "Postal Assistant", "Postal Clerk", "Counter Clerk", "Postal Officer"}),
    "Parcel Registration and Sorting": ("Office", {"Mail Sorter", "Postal Assistant", "Postal Clerk", "Counter Clerk", "Postal Officer"}),
    "Registered Mail Delivery": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Parcel Delivery by Route": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Ordinary Letter Delivery": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Article Scanning and Tracking Updates": ("Office", {"Mail Sorter", "Postal Assistant", "Postal Clerk", "Counter Clerk", "Postal Officer"}),
    "Pending Mail and Parcel Clearance": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Undelivered Article Processing": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Counter Customer Service": ("Office", {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"}),
    "Postage and Fee Verification": ("Office", {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"}),
    "Postal Financial Transactions": ("Office", {"Counter Clerk", "Postal Assistant", "Postal Clerk", "Postal Officer"}),
    "Proof of Delivery Verification": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Late Delivery Follow-up": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Returned Mail and Parcel Processing": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer", "Postal Officer"}),
    "Attendance and Staff Availability Review": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Daily Work Allocation Review": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Incomplete Task Follow-up": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Incorrect Record and Address Verification": ("Office", {"Postal Assistant", "Postal Clerk", "Counter Clerk", "Postal Officer"}),
    "Daily Productivity and Workload Review": ("Supervisory / Office", {"Postmaster (Head)"}),
    "End-of-Day Reconciliation and Reporting": ("Supervisory / Office", {"Postmaster (Head)"}),
}
DEFAULT_CHECKLIST = list(CHECKLIST_FIT)

CRITERIA_NOTE = (
    "Example review rules for this desk, not official Sri Lanka Post standards. "
    f"A recommendation needs {MIN_MONTHS_WITH_WORK} months of work inside the last "
    f"{WINDOW_MONTHS} months, a mean KPI of at least {MIN_MEAN_KPI}, completion, "
    f"accuracy, and timeliness of at least {MIN_RATE}, attendance of at least "
    f"{MIN_ATTENDANCE}% on days with work logs, promotion marked Yes, and at least "
    f"{MIN_MONTHS_SINCE_PROMOTION} months since the last promotion. "
    "The next-week KPI forecast is not used."
)


def parse_day(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value)[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def shift_months(day: date, months: int) -> date:
    index = day.year * 12 + (day.month - 1) - months
    year, month0 = divmod(index, 12)
    month = month0 + 1
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    lengths = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(day.day, lengths[month - 1]))


def _num(value) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def is_present(record: dict) -> bool:
    status = str(record.get("attendance_status") or "").strip().lower()
    return status in PRESENT_STATUSES


def attended(record: dict) -> bool:
    """True when this person came to work, including a scan that has a time but no status."""
    status = str(record.get("attendance_status") or "").strip().lower()
    if status == "absent":
        return False
    if is_present(record):
        return True
    return bool(str(record.get("fingerprint_in") or "").strip() or str(record.get("fingerprint_out") or "").strip())


def _months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


def review_employee(employee: dict, logs: list[dict], attendance: list[dict], as_of: date) -> dict:
    """Decide whether this employee can be put forward for promotion review."""
    window_start = shift_months(as_of, WINDOW_MONTHS)
    work = []
    for log in logs:
        day = parse_day(log.get("date"))
        if day is None or day < window_start or day > as_of:
            continue
        work.append((day, log))
    present_days = set()
    for record in attendance:
        day = parse_day(record.get("date"))
        if day is None or day < window_start or day > as_of:
            continue
        if is_present(record):
            present_days.add(day)

    months = {day.strftime("%Y-%m") for day, _log in work}
    kpis = []
    completion = []
    accuracy = []
    timeliness = []
    assigned = []
    unfinished = 0.0
    incorrect = 0.0
    late = 0.0
    work_days = set()
    weekly = {}
    for day, log in work:
        work_days.add(day)
        rates = [
            log.get("completion_rate"),
            log.get("accuracy_rate"),
            log.get("timeliness_rate"),
        ]
        if all(item not in (None, "") for item in rates):
            kpi = (_num(rates[0]) + _num(rates[1]) + _num(rates[2])) / 3
            kpis.append(kpi)
            week = day - timedelta(days=day.weekday())
            weekly.setdefault(week, []).append(kpi)
        if log.get("completion_rate") not in (None, ""):
            completion.append(_num(log.get("completion_rate")))
        if log.get("accuracy_rate") not in (None, ""):
            accuracy.append(_num(log.get("accuracy_rate")))
        if log.get("timeliness_rate") not in (None, ""):
            timeliness.append(_num(log.get("timeliness_rate")))
        assigned.append(_num(log.get("assigned_work_count")))
        unfinished += _num(log.get("uncompleted_work_count"))
        incorrect += _num(log.get("incorrect_work_count"))
        late += _num(log.get("late_work_count"))

    week_means = [sum(values) / len(values) for values in weekly.values() if values]
    consistency = None
    if len(week_means) >= 2:
        avg = sum(week_means) / len(week_means)
        consistency = (sum((value - avg) ** 2 for value in week_means) / len(week_means)) ** 0.5

    attended = len(work_days & present_days)
    attendance_rate = round(100 * attended / len(work_days), 1) if work_days else None
    mean_kpi = round(_mean(kpis), 1) if kpis else None
    evidence = {
        "months_with_work": len(months),
        "work_days": len(work_days),
        "mean_kpi": mean_kpi,
        "completion": round(_mean(completion), 1) if completion else None,
        "accuracy": round(_mean(accuracy), 1) if accuracy else None,
        "timeliness": round(_mean(timeliness), 1) if timeliness else None,
        "attendance_rate": attendance_rate,
        "consistency": round(consistency, 1) if consistency is not None else None,
        "mean_assigned": round(_mean(assigned), 1) if assigned else None,
        "unfinished": int(round(unfinished)),
        "incorrect": int(round(incorrect)),
        "late": int(round(late)),
    }

    gaps = []
    if len(months) < MIN_MONTHS_WITH_WORK:
        gaps.append(
            f"Only {len(months)} month(s) of work logs in the last {WINDOW_MONTHS} months. "
            f"{MIN_MONTHS_WITH_WORK} are required."
        )
    if not present_days:
        gaps.append("No attendance record marked present in this window, so attendance cannot be checked.")
    eligible = str(employee.get("promotion_eligible") or "").strip().lower()
    if eligible not in {"yes", "no"}:
        gaps.append("Promotion eligibility is not recorded.")
    last_promotion = parse_day(employee.get("last_promotion_date"))
    months_since = None
    if last_promotion is None:
        gaps.append("The last promotion date is not recorded.")
    else:
        months_since = _months_between(last_promotion, as_of)
        evidence["months_since_promotion"] = round(months_since, 1)

    if gaps:
        return _result(employee, "more_information_needed", gaps, evidence, None)

    reasons = []
    if eligible != "yes":
        reasons.append("Promotion eligibility is recorded as No.")
    if mean_kpi is None or mean_kpi < MIN_MEAN_KPI:
        reasons.append(f"Mean KPI is {mean_kpi if mean_kpi is not None else 'missing'}; the example line is {MIN_MEAN_KPI}.")
    for label, value in (
        ("Completion", evidence["completion"]),
        ("Accuracy", evidence["accuracy"]),
        ("Timeliness", evidence["timeliness"]),
    ):
        if value is None or value < MIN_RATE:
            reasons.append(f"{label} is {value if value is not None else 'missing'}; the example line is {MIN_RATE}.")
    if attendance_rate is None or attendance_rate < MIN_ATTENDANCE:
        reasons.append(
            f"Attendance on work days is {attendance_rate if attendance_rate is not None else 'missing'}%. "
            f"The example line is {MIN_ATTENDANCE}%."
        )
    if months_since < MIN_MONTHS_SINCE_PROMOTION:
        reasons.append(
            f"{months_since} month(s) since the last promotion. "
            f"The example wait is {MIN_MONTHS_SINCE_PROMOTION} months."
        )
    if reasons:
        return _result(employee, "not_recommended", reasons, evidence, None)

    summary = (
        f"Mean KPI {mean_kpi} over {len(months)} months, attendance {attendance_rate}% "
        f"on work days, and {months_since} months since the last promotion. "
        "This is a review suggestion only."
    )
    rank_score = mean_kpi
    return _result(employee, "recommended", [summary], evidence, rank_score)


def _result(employee, status, reasons, evidence, rank_score):
    return {
        "employee_id": employee.get("employee_id") or employee.get("_id"),
        "employee_name": employee.get("employee_name") or "",
        "designation": employee.get("designation") or "",
        "work_category": employee.get("work_category") or "",
        "post_office": employee.get("post_office") or "",
        "status": status,
        "reasons": reasons,
        "evidence": evidence,
        "rank_score": rank_score,
    }


def promotion_board(as_of: date | None = None) -> dict:
    as_of = as_of or date.today()
    window_start = shift_months(as_of, WINDOW_MONTHS)
    db = get_db()
    employees = list(db["employee"].find())
    logs_by_employee: dict[str, list] = {}
    for log in db["daily_kpi_log"].find():
        logs_by_employee.setdefault(log.get("employee_id"), []).append(log)
    attendance_by_employee: dict[str, list] = {}
    for record in db["attendance_log"].find():
        attendance_by_employee.setdefault(record.get("employee_id"), []).append(record)

    rows = [
        review_employee(
            employee,
            logs_by_employee.get(employee.get("employee_id") or employee.get("_id"), []),
            attendance_by_employee.get(employee.get("employee_id") or employee.get("_id"), []),
            as_of,
        )
        for employee in employees
    ]
    recommended = [row for row in rows if row["status"] == "recommended"]
    recommended.sort(key=lambda row: (-(row["rank_score"] or 0), row["employee_name"]))
    for index, row in enumerate(recommended, start=1):
        row["rank"] = index
    others = [row for row in rows if row["status"] != "recommended"]
    others.sort(key=lambda row: (row["status"], row["employee_name"]))
    return {
        "as_of": as_of.isoformat(),
        "window_start": window_start.isoformat(),
        "criteria_note": CRITERIA_NOTE,
        "advisory": (
            "These names are for promotion review next year. "
            "A manager must approve any promotion. The next-week KPI forecast is not part of this list."
        ),
        "recommended": recommended,
        "others": others,
    }


def _unfinished(log: dict) -> int:
    if log.get("uncompleted_work_count") not in (None, ""):
        return max(0, int(round(_num(log.get("uncompleted_work_count")))))
    assigned = _num(log.get("assigned_work_count"))
    completed = _num(log.get("completed_work_count"))
    return max(0, int(round(assigned - completed)))


def _task_name(log: dict) -> str:
    return str(log.get("primary_task_type") or "").strip()


def _normalize_category(cat: str) -> str:
    c = str(cat or "").strip().lower()
    if "delivery" in c or "field" in c:
        return "delivery"
    if "sort" in c:
        return "sorting"
    if "counter" in c:
        return "counter"
    if "supervis" in c or "head" in c:
        return "supervisory"
    if "office" in c or "operation" in c or "clerk" in c:
        return "office"
    return c


def _categories_match(emp_cat: str, task_cat: str) -> bool:
    if not emp_cat or not task_cat:
        return True
    ec = _normalize_category(emp_cat)
    tc = _normalize_category(task_cat)
    if ec == tc:
        return True
    # Office, counter, and sorting are all non-delivery administrative/indoor operations
    non_delivery = {"office", "counter", "sorting", "supervisory"}
    if ec in non_delivery and tc in non_delivery:
        return True
    return False


def _can_do_task(employee: dict, task: str) -> bool | None:
    """True when this person's current role may receive the task.
    Enforces strict departmental boundary: Delivery officers cannot receive
    counter/office tasks; Counter/Office/Sorting staff cannot receive delivery route tasks.
    """
    fit = TASK_FIT.get(task)
    if fit is None:
        cfit = CHECKLIST_FIT.get(task)
        if cfit:
            cat, roles = cfit
            fit = {"roles": roles, "categories": {cat}}
        else:
            return None

    designation = str(employee.get("designation") or "").strip()
    category = str(employee.get("work_category") or "").strip()
    emp_norm_cat = _normalize_category(category)

    categories = fit.get("categories")
    if categories is None:
        categories = {fit.get("category")}
    task_norm_cats = {_normalize_category(c) for c in categories if c}

    is_delivery_task = "delivery" in task_norm_cats
    is_delivery_emp = emp_norm_cat == "delivery"

    # Strictly enforce delivery vs. counter / office barrier
    if is_delivery_task != is_delivery_emp:
        return False

    norm_role = normalize_role(designation, category)
    allowed_roles = set(fit.get("roles") or [])

    if designation in allowed_roles or norm_role in allowed_roles:
        return True

    # Postal Officer: Delivery category performs delivery; Counter/Office performs counter/office
    if "postal officer" in designation.lower():
        if is_delivery_emp and is_delivery_task:
            return True
        if not is_delivery_emp and not is_delivery_task:
            return True

    return False


def _prior_work(logs: list[dict], day: date) -> tuple[dict, dict]:
    """Tasks and routes each person has already completed, up to this day."""
    tasks: dict[str, set] = {}
    routes: dict[str, set] = {}
    for log in logs:
        log_day = parse_day(log.get("date"))
        if log_day is None or log_day > day:
            continue
        if _num(log.get("completed_work_count")) <= 0:
            continue
        employee_id = log.get("employee_id")
        task = _task_name(log)
        if task:
            tasks.setdefault(employee_id, set()).add(task)
        route = str(log.get("route_id") or "").strip()
        if route:
            routes.setdefault(employee_id, set()).add(route)
    return tasks, routes


def _checklist_labels(checklist) -> list[str]:
    if checklist is None:
        return list(DEFAULT_CHECKLIST)
    labels = []
    for item in checklist:
        if isinstance(item, str):
            label = item.strip()
        elif isinstance(item, dict):
            if item.get("checked") is False:
                continue
            label = str(item.get("label") or "").strip()
        else:
            continue
        if label:
            labels.append(label)
    return labels


def _assign_checklist(present: list[dict], checklist, done_tasks: dict) -> tuple[list[dict], list[dict]]:
    """Give each checked checklist task to one attended employee whose role can do it."""
    load = {employee.get("employee_id"): 0 for employee in present}
    assigned = []
    unmet = []
    for label in _checklist_labels(checklist):
        fit = CHECKLIST_FIT.get(label)
        if fit is None:
            unmet.append(
                {
                    "task": label,
                    "needed_roles": "a listed role",
                    "reason": f"{label} is not on the role list, so it was not assigned.",
                }
            )
            continue
        category, roles = fit
        candidates = [
            employee
            for employee in present
            if str(employee.get("designation") or "").strip() in roles
            and str(employee.get("work_category") or "").strip() == category
        ]
        if not candidates:
            unmet.append(
                {
                    "task": label,
                    "needed_roles": ", ".join(sorted(roles)),
                    "reason": (
                        f"{label} needs a present {', '.join(sorted(roles))}. "
                        "It was not given to anyone else."
                    ),
                }
            )
            continue
        candidates.sort(
            key=lambda employee: (
                0 if label in done_tasks.get(employee.get("employee_id"), ()) else 1,
                load.get(employee.get("employee_id"), 0),
                employee.get("employee_name") or "",
            )
        )
        chosen = candidates[0]
        load[chosen.get("employee_id")] = load.get(chosen.get("employee_id"), 0) + 1
        assigned.append(
            {
                "task": label,
                "employee_id": chosen.get("employee_id"),
                "employee_name": chosen.get("employee_name") or "",
                "designation": chosen.get("designation") or "",
                "work_category": chosen.get("work_category") or "",
                "reason": (
                    f"{chosen.get('employee_name') or chosen.get('employee_id')} attended and stays a "
                    f"{chosen.get('designation') or 'current role'}, so {label} is offered to them."
                ),
            }
        )
    return assigned, unmet


def _salary(employee: dict) -> float | None:
    value = employee.get("basic_salary")
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _overtime_estimates(employees: list[dict], present: list[dict], checklist_assigned: list[dict]) -> list[dict]:
    """Estimate overtime when someone covers an absent colleague or takes extra tasks."""
    present_ids = {employee.get("employee_id") for employee in present}
    covers: dict[str, list[dict]] = {employee.get("employee_id"): [] for employee in present}
    absent_by_role: dict[str, list[dict]] = {}
    for employee in employees:
        employee_id = employee.get("employee_id") or employee.get("_id")
        if employee_id in present_ids:
            continue
        designation = str(employee.get("designation") or "").strip()
        category = str(employee.get("work_category") or "").strip()
        if category != "Delivery (Field)" or designation not in DELIVERY_ROLES:
            continue
        absent_by_role.setdefault(designation, []).append(employee)

    for designation, absent_people in absent_by_role.items():
        pool = [
            employee
            for employee in present
            if str(employee.get("designation") or "").strip() == designation
        ]
        if not pool:
            continue
        for absent in absent_people:
            chosen = min(
                pool,
                key=lambda employee: (
                    len(covers.get(employee.get("employee_id"), [])),
                    employee.get("employee_name") or "",
                ),
            )
            covers.setdefault(chosen.get("employee_id"), []).append(absent)

    task_counts: dict[str, int] = {}
    for item in checklist_assigned:
        employee_id = item.get("employee_id")
        task_counts[employee_id] = task_counts.get(employee_id, 0) + 1

    rows = []
    for employee in present:
        employee_id = employee.get("employee_id")
        cover_list = covers.get(employee_id, [])
        extra_tasks = max(0, task_counts.get(employee_id, 0) - 1)
        extra_beyond_covers = max(0, extra_tasks - len(cover_list))
        overtime_hours = len(cover_list) * COVER_ROUTE_HOURS + extra_beyond_covers * EXTRA_TASK_HOURS
        if overtime_hours < 1:
            continue
        salary = _salary(employee)
        hourly = round(salary / SALARY_HOURS, 2) if salary is not None else None
        overtime_rate = round(hourly * OT_MULTIPLIER, 2) if hourly is not None else None
        overtime_pay = round(overtime_hours * overtime_rate, 2) if overtime_rate is not None else None
        covered_names = ", ".join(
            person.get("employee_name") or person.get("employee_id") or "" for person in cover_list
        )
        parts = []
        if cover_list:
            parts.append(
                f"Covers {len(cover_list)} absent {employee.get('designation')} "
                f"({covered_names}). Each route is estimated at {COVER_ROUTE_HOURS} hours "
                f"beyond the {STANDARD_DAY_HOURS}-hour day."
            )
        if extra_beyond_covers:
            parts.append(
                f"{extra_beyond_covers} further assigned task(s) add {extra_beyond_covers} hour(s). "
                "One extra hour still counts as overtime."
            )
        rows.append(
            {
                "employee_id": employee_id,
                "employee_name": employee.get("employee_name") or "",
                "designation": employee.get("designation") or "",
                "basic_salary": salary,
                "cover_count": len(cover_list),
                "covered_names": covered_names,
                "overtime_hours": overtime_hours,
                "hourly_rate": hourly,
                "overtime_rate": overtime_rate,
                "overtime_pay": overtime_pay,
                "reason": " ".join(parts),
            }
        )
    rows.sort(key=lambda row: row["employee_name"])
    return rows


def build_allocation(
    employees: list[dict],
    logs: list[dict],
    attendance: list[dict],
    day: date,
    checklist=None,
) -> dict:
    """Suggest where unfinished work can sit among people present that day."""
    by_id = {employee.get("employee_id") or employee.get("_id"): employee for employee in employees}
    present_ids = set()
    present = []
    for record in attendance:
        if parse_day(record.get("date")) != day or not attended(record):
            continue
        employee_id = record.get("employee_id")
        if employee_id in present_ids or employee_id not in by_id:
            continue
        present_ids.add(employee_id)
        present.append(by_id[employee_id])

    logs_today = {}
    for log in logs:
        if parse_day(log.get("date")) != day:
            continue
        logs_today[log.get("employee_id")] = log

    done_tasks, done_routes = _prior_work(logs, day)

    pending_sources: dict[str, list[dict]] = {}
    for employee_id, log in logs_today.items():
        employee = by_id.get(employee_id)
        if employee is None:
            continue
        unfinished = _unfinished(log)
        assigned = int(round(_num(log.get("assigned_work_count"))))
        if employee_id in present_ids:
            movable = min(unfinished, max(0, assigned - EXAMPLE_DAILY_CAPACITY))
        else:
            movable = unfinished
        if movable <= 0:
            continue
        task = _task_name(log)
        category = employee.get("work_category") or ""
        group = f"task:{task}" if task in TASK_FIT else f"category:{category}"
        pending_sources.setdefault(group, []).append(
            {
                "employee_id": employee_id,
                "employee_name": employee.get("employee_name") or "",
                "count": movable,
                "present": employee_id in present_ids,
                "task": task,
                "category": category,
                "route_id": str(log.get("route_id") or "").strip(),
            }
        )

    moves = []
    unmet = []
    blocked = []
    blocked_keys = set()
    for sources in pending_sources.values():
        sample = sources[0]
        task = sample["task"]
        category = sample["category"]
        known_task = task in TASK_FIT
        pool = []
        for employee in present:
            employee_id = employee.get("employee_id")
            if known_task:
                allowed = _can_do_task(employee, task)
            else:
                allowed = (employee.get("work_category") or "") == category
            if not allowed:
                if known_task:
                    key = (employee_id, task)
                    if key not in blocked_keys:
                        blocked_keys.add(key)
                        designation = employee.get("designation") or "unspecified role"
                        blocked.append(
                            {
                                "employee_id": employee_id,
                                "employee_name": employee.get("employee_name") or "",
                                "designation": designation,
                                "task": task,
                                "reason": (
                                    f"{employee.get('employee_name') or employee_id} is a {designation}, "
                                    f"so {task} is not offered."
                                ),
                            }
                        )
                continue
            assigned = int(round(_num((logs_today.get(employee_id) or {}).get("assigned_work_count"))))
            room = max(0, EXAMPLE_DAILY_CAPACITY - assigned)
            if room > 0:
                pool.append({"employee": employee, "room": room})

        for source in sources:
            route = source["route_id"]
            pool.sort(
                key=lambda item: (
                    1 if route and route in done_routes.get(item["employee"].get("employee_id"), ()) else 0,
                    1 if task and task in done_tasks.get(item["employee"].get("employee_id"), ()) else 0,
                    item["room"],
                ),
                reverse=True,
            )
            left = source["count"]
            for slot in pool:
                if left <= 0:
                    break
                destination = slot["employee"]
                if destination.get("employee_id") == source["employee_id"]:
                    continue
                give = min(slot["room"], left)
                if give <= 0:
                    continue
                did_task = bool(task and task in done_tasks.get(destination.get("employee_id"), ()))
                did_route = bool(route and route in done_routes.get(destination.get("employee_id"), ()))
                reason = (
                    f"{destination.get('employee_name') or destination.get('employee_id')} stays a "
                    f"{destination.get('designation') or 'current role'}"
                )
                if task:
                    reason += f" and can do {task}"
                if did_route:
                    reason += f", and has completed route {route} before"
                elif did_task:
                    reason += ", and has completed this task before"
                reason += "."
                moves.append(
                    {
                        "from_employee_id": source["employee_id"],
                        "from_employee_name": source["employee_name"],
                        "to_employee_id": destination.get("employee_id"),
                        "to_employee_name": destination.get("employee_name") or "",
                        "designation": destination.get("designation") or "",
                        "work_category": destination.get("work_category") or category,
                        "task": task,
                        "route_id": route,
                        "count": give,
                        "reason": reason,
                    }
                )
                slot["room"] -= give
                left -= give
            if left > 0:
                fit = TASK_FIT.get(task)
                needed = ", ".join(sorted(fit["roles"])) if fit else category or "the same work category"
                unmet.append(
                    {
                        "employee_id": source["employee_id"],
                        "employee_name": source["employee_name"],
                        "work_category": category,
                        "task": task,
                        "count": left,
                        "needed_roles": needed,
                    }
                )

    checklist_assigned, checklist_unmet = _assign_checklist(present, checklist, done_tasks)
    overtime = _overtime_estimates(employees, present, checklist_assigned)

    return {
        "date": day.isoformat(),
        "capacity": EXAMPLE_DAILY_CAPACITY,
        "capacity_note": (
            f"Example daily cap of {EXAMPLE_DAILY_CAPACITY} assigned items. "
            "A task is offered only to a present employee whose current designation and work category can do it. "
            "Roles are left unchanged. This is not an official workload standard."
        ),
        "present": [
            {
                "employee_id": employee.get("employee_id"),
                "employee_name": employee.get("employee_name") or "",
                "designation": employee.get("designation") or "",
                "work_category": employee.get("work_category") or "",
            }
            for employee in present
        ],
        "moves": moves,
        "unmet": unmet,
        "blocked": blocked,
        "checklist": checklist_assigned,
        "checklist_unmet": checklist_unmet,
        "overtime": overtime,
        "overtime_note": (
            "Example desk formula, not an official Sri Lanka Post rate. "
            "Hourly rate = monthly salary / 240. Overtime rate = that hourly rate × 1.5. "
            "A person's own work sits inside an 8-hour day. "
            "Covering one absent colleague of the same role is estimated at 4 hours. "
            "Each further assigned task adds 1 hour, and that hour counts as overtime. "
            "The postmaster confirms the amount before it is saved."
        ),
        "advisory": "The postmaster approves this distribution. It does not use the next-week KPI forecast.",
    }


def allocation_plan(day_text: str, checklist=None) -> dict:
    day = parse_day(day_text)
    if day is None:
        raise HTTPException(status_code=400, detail="Enter a valid date")
    db = get_db()
    return build_allocation(
        list(db["employee"].find()),
        list(db["daily_kpi_log"].find()),
        list(db["attendance_log"].find({"date": day.isoformat()})),
        day,
        checklist,
    )


def _log_id(employee_id: str, day: date) -> str:
    return f"{employee_id}-{day.isoformat()}"


def _set_counts(log: dict, assigned: int) -> None:
    completed = int(round(_num(log.get("completed_work_count"))))
    assigned = max(assigned, completed)
    log["assigned_work_count"] = assigned
    log["uncompleted_work_count"] = assigned - completed


def approve_allocation(day_text: str, checklist=None) -> dict:
    plan = allocation_plan(day_text, checklist)
    if not plan["moves"] and not plan["checklist"]:
        raise HTTPException(status_code=400, detail="There is no pending work to approve for this date")
    day = parse_day(day_text)
    logs = get_db()["daily_kpi_log"]
    for move in plan["moves"]:
        count = int(move["count"])
        source_id = _log_id(move["from_employee_id"], day)
        source = logs.find_one({"_id": source_id})
        if source is not None:
            _set_counts(source, int(round(_num(source.get("assigned_work_count")))) - count)
            logs.replace_one({"_id": source_id}, source)

        dest_id = _log_id(move["to_employee_id"], day)
        dest = logs.find_one({"_id": dest_id}) or {
            "_id": dest_id,
            "name": dest_id,
            "employee_id": move["to_employee_id"],
            "date": day.isoformat(),
            "completed_work_count": 0,
        }
        receiver = get_db()["employee"].find_one(
            {"$or": [{"_id": move["to_employee_id"]}, {"employee_id": move["to_employee_id"]}]}
        ) or {}
        dest.setdefault("employee_name", receiver.get("employee_name") or move.get("to_employee_name") or "")
        dest.setdefault("designation", receiver.get("designation") or move.get("designation") or "")
        dest.setdefault("work_category", receiver.get("work_category") or move.get("work_category") or "")
        dest.setdefault("post_office", receiver.get("post_office") or "")
        if move.get("task") and not dest.get("primary_task_type"):
            dest["primary_task_type"] = move["task"]
        if move.get("route_id") and not dest.get("route_id"):
            dest["route_id"] = move["route_id"]
        _set_counts(dest, int(round(_num(dest.get("assigned_work_count")))) + count)
        logs.replace_one({"_id": dest_id}, dest, upsert=True)

    grouped: dict[str, list[str]] = {}
    for item in plan["checklist"]:
        grouped.setdefault(item["employee_id"], []).append(item["task"])
    for employee_id, tasks in grouped.items():
        dest_id = _log_id(employee_id, day)
        dest = logs.find_one({"_id": dest_id})
        is_new = dest is None
        if is_new:
            dest = {
                "_id": dest_id,
                "name": dest_id,
                "employee_id": employee_id,
                "date": day.isoformat(),
                "completed_work_count": 0,
            }
        sample = next(row for row in plan["checklist"] if row["employee_id"] == employee_id)
        receiver = get_db()["employee"].find_one(
            {"$or": [{"_id": employee_id}, {"employee_id": employee_id}]}
        ) or {}
        dest.setdefault("employee_name", receiver.get("employee_name") or sample.get("employee_name") or "")
        dest.setdefault("designation", receiver.get("designation") or sample.get("designation") or "")
        dest.setdefault("work_category", receiver.get("work_category") or sample.get("work_category") or "")
        dest.setdefault("post_office", receiver.get("post_office") or "")
        dest["checklist_tasks"] = tasks
        if is_new:
            _set_counts(dest, len(tasks))
        logs.replace_one({"_id": dest_id}, dest, upsert=True)
    return {
        "ok": True,
        "applied": len(plan["moves"]) + len(plan["checklist"]),
        "plan": allocation_plan(day_text, checklist),
    }


def confirm_overtime(day_text: str, checklist=None) -> dict:
    """Save confirmed overtime. The same employee and date is replaced, not duplicated."""
    plan = allocation_plan(day_text, checklist)
    day = parse_day(day_text)
    if not plan["overtime"]:
        raise HTTPException(status_code=400, detail="There is no overtime to confirm for this date")
    collection = get_db()["overtime"]
    saved = []
    skipped = []
    for row in plan["overtime"]:
        if row["overtime_pay"] is None:
            skipped.append(
                {
                    "employee_id": row["employee_id"],
                    "employee_name": row["employee_name"],
                    "reason": "Basic salary is missing, so the overtime amount cannot be calculated.",
                }
            )
            continue
        doc_id = f"{row['employee_id']}-{day.isoformat()}-overtime"
        doc = {
            "_id": doc_id,
            "name": doc_id,
            "employee_id": row["employee_id"],
            "employee_name": row["employee_name"],
            "date": day.isoformat(),
            "hours": row["overtime_hours"],
            "amount": row["overtime_pay"],
            "hourly_rate": row["hourly_rate"],
            "overtime_rate": row["overtime_rate"],
            "status": "Approved",
            "note": row["reason"],
        }
        collection.replace_one({"_id": doc_id}, doc, upsert=True)
        saved.append(
            {
                "employee_id": row["employee_id"],
                "employee_name": row["employee_name"],
                "hours": row["overtime_hours"],
                "amount": row["overtime_pay"],
            }
        )
    if not saved:
        raise HTTPException(
            status_code=400,
            detail="Overtime could not be confirmed because basic salary is missing.",
        )
    return {"ok": True, "saved": saved, "skipped": skipped, "plan": plan}


_auto_balance_lock = threading.Lock()


def is_on_approved_leave(employee_id: str, day: date, db) -> tuple[bool, str]:
    """Check if the employee has an approved leave overlapping this day."""
    if not employee_id:
        return False, ""
    day_iso = day.isoformat()
    try:
        query = {
            "employee_id": employee_id,
            "status": {"$regex": "^approved$", "$options": "i"},
        }
        for row in db["entitlement_leave"].find(query):
            start = str(row.get("start_date") or row.get("from_date") or "")[:10]
            end = str(row.get("end_date") or row.get("to_date") or "")[:10]
            l_type = row.get("leave_type") or "Approved Leave"
            if start and end:
                if start <= day_iso <= end:
                    return True, f"Approved leave ({l_type}) from {start} to {end}."
            elif not start and not end:
                return True, f"Approved leave ({l_type}) on file."
    except Exception:
        pass

    try:
        if "leave_request" in db.list_collection_names():
            for row in db["leave_request"].find({"employee_id": employee_id, "status": {"$regex": "^approved$", "$options": "i"}}):
                start = str(row.get("start_date") or row.get("from_date") or "")[:10]
                end = str(row.get("end_date") or row.get("to_date") or "")[:10]
                l_type = row.get("leave_type") or "Approved Leave"
                if start and end:
                    if start <= day_iso <= end:
                        return True, f"Approved leave ({l_type}) from {start} to {end}."
                elif not start and not end:
                    return True, f"Approved leave ({l_type}) on file."
    except Exception:
        pass

    return False, ""


def get_employee_attendance_eligibility(
    employee: dict,
    day: date,
    db,
    benchmark_capacity: int = DEFAULT_DAILY_BENCHMARK,
) -> dict:
    """Classify employee eligibility based on confirmed attendance records and approved leave."""
    emp_id = str(employee.get("employee_id") or employee.get("_id") or "").strip()
    emp_name = str(employee.get("employee_name") or emp_id).strip()
    day_iso = day.isoformat()

    # 1. Approved Leave Check
    on_leave, leave_reason = is_on_approved_leave(emp_id, day, db)
    if on_leave:
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": False,
            "status": "On Leave",
            "tag": "On Leave — Excluded",
            "reason": leave_reason or "Employee is on approved leave on this date.",
            "capacity": 0,
            "is_half_day": False,
        }

    # 2. Attendance Record Check
    att_doc = db["attendance_log"].find_one({"employee_id": emp_id, "date": day_iso})
    if not att_doc:
        att_doc = db["attendance_log"].find_one({"_id": f"{emp_id}-{day_iso}"})
    if not att_doc:
        att_doc = db["attendance_log"].find_one({"employee_id": emp_id, "attendance_date": day_iso})
    if not att_doc:
        try:
            att_doc = db["attendance_log"].find_one({
                "employee_id": {"$regex": f"^{re.escape(emp_id)}$", "$options": "i"},
                "$or": [
                    {"date": {"$regex": f"^{day_iso}"}},
                    {"attendance_date": {"$regex": f"^{day_iso}"}},
                ],
            })
        except Exception:
            pass

    if not att_doc:
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": False,
            "status": "Attendance Not Recorded",
            "tag": "Attendance Not Recorded — Excluded",
            "reason": "Attendance has not been recorded for this date. Cannot verify presence.",
            "capacity": 0,
            "is_half_day": False,
        }

    att_status = str(att_doc.get("attendance_status") or "").strip().lower()
    fingerprint_in = str(att_doc.get("fingerprint_in") or att_doc.get("check_in_time") or "").strip()
    source = str(att_doc.get("source") or "").strip().lower()

    if att_status == "absent":
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": False,
            "status": "Absent",
            "tag": "Absent — Excluded",
            "reason": "Employee is marked absent on this date.",
            "capacity": 0,
            "is_half_day": False,
        }

    # Manually authorized by Postmaster fallback
    if source == "postmaster_authorized" or att_status in {"manually authorized", "authorized"}:
        half_cap = max(1, round(benchmark_capacity * 0.5))
        is_half = "half" in att_status
        cap = half_cap if is_half else benchmark_capacity
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": True,
            "status": "Manually Authorized",
            "tag": "Present (Manually Authorized) — Eligible",
            "reason": f"Authorized by Postmaster for {day_iso}. Configured capacity: {cap} tasks.",
            "capacity": cap,
            "is_half_day": is_half,
        }

    if att_status == "half day":
        half_cap = max(1, round(benchmark_capacity * 0.5))
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": True,
            "status": "Half day",
            "tag": "Present (Half Day) — Eligible",
            "reason": f"Confirmed attendance: Half Day (working capacity adjusted to {half_cap} tasks).",
            "capacity": half_cap,
            "is_half_day": True,
        }

    if att_status in {"on time", "late", "present"} or fingerprint_in:
        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "eligible": True,
            "status": "Present",
            "tag": "Present — Eligible",
            "reason": f"Confirmed attendance ({att_doc.get('attendance_status') or 'Present'}). Standard capacity: {benchmark_capacity} tasks.",
            "capacity": benchmark_capacity,
            "is_half_day": False,
        }

    return {
        "employee_id": emp_id,
        "employee_name": emp_name,
        "eligible": False,
        "status": att_status.capitalize() or "Unavailable",
        "tag": "Unavailable — Excluded",
        "reason": f"Attendance status '{att_status}' is not eligible for daily task allocation.",
        "capacity": 0,
        "is_half_day": False,
    }


def authorize_attendance_for_date(
    day_text: str,
    employee_ids: list[str] | None = None,
    status: str = "Present",
    notes: str = "Authorized by Postmaster for work allocation",
    user: str = "postmaster",
    post_office: str | None = None,
) -> dict:
    """Postmaster explicitly authorizes attendance for selected or all active non-leave employees."""
    day = parse_day(day_text)
    if not day:
        raise HTTPException(status_code=400, detail="Invalid date format.")
    day_iso = day.isoformat()
    db = get_db()
    emp_col = db["employee"]
    att_col = db["attendance_log"]

    q = {}
    if post_office and post_office != "All":
        q["$or"] = [{"post_office": post_office}, {"office_id": post_office}]
    all_emps = list(emp_col.find(q))
    if not all_emps:
        all_emps = list(emp_col.find({}))

    authorized_records = []
    skipped_records = []
    target_ids = set(employee_ids) if employee_ids is not None else {str(e.get("employee_id") or e.get("_id")) for e in all_emps}

    for emp in all_emps:
        eid = str(emp.get("employee_id") or emp.get("_id"))
        if eid not in target_ids:
            continue

        on_leave, leave_reason = is_on_approved_leave(eid, day, db)
        if on_leave:
            skipped_records.append({"employee_id": eid, "reason": leave_reason})
            continue

        doc_id = f"{eid}-{day_iso}"
        rec = {
            "_id": doc_id,
            "name": doc_id,
            "employee_id": eid,
            "employee_name": emp.get("employee_name") or eid,
            "designation": emp.get("designation") or "",
            "department": emp.get("work_category") or emp.get("department") or "Postal Operations",
            "work_category": emp.get("work_category") or "Postal Operations",
            "post_office": emp.get("post_office") or "Kaduwela",
            "date": day_iso,
            "attendance_date": day_iso,
            "fingerprint_in": "08:00",
            "check_in_time": "08:00",
            "attendance_status": status,
            "source": "postmaster_authorized",
            "authorized_by": user,
            "verification_method": "Postmaster Manual Authorization",
            "notes": notes,
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        att_col.replace_one({"_id": doc_id}, rec, upsert=True)
        authorized_records.append(eid)

    return {
        "ok": True,
        "date": day_iso,
        "authorized_count": len(authorized_records),
        "authorized_employee_ids": authorized_records,
        "skipped_count": len(skipped_records),
        "skipped": skipped_records,
        "message": f"Successfully authorized attendance for {len(authorized_records)} officer(s) on {day_iso}.",
    }


def auto_balance_workload(
    day_text: str,
    post_office: str | None = None,
    checklist=None,
    user: str = "postmaster",
    benchmark_capacity: int = DEFAULT_DAILY_BENCHMARK,
    confirm: bool = True,
    authorized_employee_ids: list[str] | None = None,
    authorize_all_active: bool = False,
) -> dict:
    """Automatically balance workload among eligible present employees based on attendance."""
    day = parse_day(day_text)
    if day is None:
        raise HTTPException(status_code=400, detail="Enter a valid date")
    day_iso = day.isoformat()
    db = get_db()

    with _auto_balance_lock:
        # Pre-authorize attendance if requested by Postmaster
        if authorize_all_active or authorized_employee_ids is not None:
            authorize_attendance_for_date(
                day_text=day_iso,
                employee_ids=authorized_employee_ids,
                user=user,
                post_office=post_office,
            )

        # Check settings for open days / holidays if configured
        try:
            settings = db["settings"].find_one({"_id": "attendance"}) or {}
            open_days = settings.get("open_days", [0, 1, 2, 3, 4, 5, 6])
            if day.weekday() not in open_days:
                return {
                    "ok": False,
                    "message": f"Post office is closed on {day.strftime('%A')} ({day_iso}). Routine daily assignments cannot be created.",
                    "date": day_iso,
                    "tasks_assigned": 0,
                    "eligible_count": 0,
                    "unassigned_count": 0,
                    "excluded_employees": [],
                    "eligible_employees": [],
                    "transfers": [],
                }
        except Exception:
            pass

        # Retrieve employees
        emp_query = {}
        if post_office and post_office != "All":
            emp_query["$or"] = [
                {"post_office": post_office},
                {"office_id": post_office},
            ]
        employees = list(db["employee"].find(emp_query))
        if not employees:
            employees = list(db["employee"].find({}))

        by_id = {str(e.get("employee_id") or e.get("_id")): e for e in employees}

        # Check attendance & availability for all employees
        eligibility_by_id = {}
        for emp in employees:
            eid = str(emp.get("employee_id") or emp.get("_id"))
            eligibility_by_id[eid] = get_employee_attendance_eligibility(emp, day, db, benchmark_capacity)

        eligible_list = [e for eid, e in eligibility_by_id.items() if e["eligible"]]
        excluded_list = [
            {
                "employee_id": e["employee_id"],
                "employee_name": e["employee_name"],
                "designation": by_id.get(e["employee_id"], {}).get("designation") or "",
                "attendance_status": e["status"],
                "reason": e["tag"],
                "details": e["reason"],
            }
            for eid, e in eligibility_by_id.items()
            if not e["eligible"]
        ]

        # 5. Handle No Eligible Employees
        if not eligible_list:
            return {
                "ok": False,
                "attendance_missing": True,
                "message": "No eligible employees are available for allocation on this date. Please verify attendance records.",
                "date": day_iso,
                "tasks_assigned": 0,
                "eligible_count": 0,
                "unassigned_count": 0,
                "excluded_employees": excluded_list,
                "eligible_employees": [],
                "transfers": [],
                "overloaded_count": 0,
                "balanced_count": 0,
                "underutilized_count": 0,
            }

        # Retrieve daily KPI logs on that date
        logs_today_docs = list(db["daily_kpi_log"].find({"date": day_iso}))
        logs_today = {str(log.get("employee_id")): log for log in logs_today_docs}

        # Compute prior work for route & task affinity
        all_logs = list(db["daily_kpi_log"].find())
        done_tasks, done_routes = _prior_work(all_logs, day)

        # Track live assignments and capacity per employee
        state = {}
        for emp in employees:
            eid = str(emp.get("employee_id") or emp.get("_id"))
            log = logs_today.get(eid)
            assigned = int(round(_num(log.get("assigned_work_count")))) if log else 0
            completed = int(round(_num(log.get("completed_work_count")))) if log else 0
            uncompleted = int(round(_num(log.get("uncompleted_work_count")))) if log and log.get("uncompleted_work_count") is not None else max(0, assigned - completed)
            cap = eligibility_by_id[eid]["capacity"] if eligibility_by_id[eid]["eligible"] else 0
            is_eligible = eligibility_by_id[eid]["eligible"]

            tag = eligibility_by_id[eid]["tag"]
            if is_eligible and assigned >= cap and cap > 0:
                tag = "At Capacity — No additional work"

            state[eid] = {
                "employee": emp,
                "employee_id": eid,
                "employee_name": emp.get("employee_name") or eid,
                "designation": emp.get("designation") or "",
                "work_category": emp.get("work_category") or "",
                "eligible": is_eligible,
                "status": tag,
                "capacity": cap,
                "initial_assigned": assigned,
                "current_assigned": assigned,
                "completed": completed,
                "uncompleted": uncompleted,
                "log": log,
            }

        # 2. Retrieve Work That Needs Assignment
        # Items to allocate:
        # A. Movable uncompleted work from excluded / absent / on-leave employees
        # B. Movable uncompleted work from overloaded eligible employees (> capacity)
        # C. Any checklist / backlog work items passed in request
        assignable_units = []

        # From excluded employees (e.g. absent, on leave, unrecorded)
        for eid, s in state.items():
            if not s["eligible"] and s["uncompleted"] > 0:
                log = s["log"]
                task = _task_name(log) if log else ("Mail & Parcel Delivery" if s["work_category"] == "Delivery (Field)" else "Customer Service Counter")
                route = str(log.get("route_id") or "") if log else ""
                route_km = _num(log.get("route_length_km")) if log else 0
                deliv_pts = _num(log.get("delivery_points")) if log else 0
                priority = str(log.get("priority") or "Normal") if log else "Normal"
                count = s["uncompleted"]
                for _ in range(count):
                    assignable_units.append({
                        "source_type": "ineligible_reassign",
                        "donor_id": eid,
                        "donor_name": s["employee_name"],
                        "task": task,
                        "route_id": route,
                        "route_length_km": route_km,
                        "delivery_points": deliv_pts,
                        "priority": priority,
                        "work_category": s["work_category"],
                        "reason": f"Reassigned from {s['employee_name']} ({s['status']})",
                    })

        # From overloaded eligible employees
        for eid, s in state.items():
            if s["eligible"] and s["current_assigned"] > s["capacity"] and s["uncompleted"] > 0:
                excess = min(s["uncompleted"], s["current_assigned"] - s["capacity"])
                if excess > 0:
                    log = s["log"]
                    task = _task_name(log) if log else ("Mail & Parcel Delivery" if s["work_category"] == "Delivery (Field)" else "Customer Service Counter")
                    route = str(log.get("route_id") or "") if log else ""
                    route_km = _num(log.get("route_length_km")) if log else 0
                    deliv_pts = _num(log.get("delivery_points")) if log else 0
                    priority = str(log.get("priority") or "Normal") if log else "Normal"
                    for _ in range(excess):
                        assignable_units.append({
                            "source_type": "overload_balance",
                            "donor_id": eid,
                            "donor_name": s["employee_name"],
                            "task": task,
                            "route_id": route,
                            "route_length_km": route_km,
                            "delivery_points": deliv_pts,
                            "priority": priority,
                            "work_category": s["work_category"],
                            "reason": f"Balanced from overloaded {s['employee_name']} ({s['current_assigned']} tasks > benchmark {s['capacity']})",
                        })

        # From checklist / unassigned items if provided
        if checklist is not None:
            labels = _checklist_labels(checklist)
            for label in labels:
                assignable_units.append({
                    "source_type": "checklist",
                    "donor_id": None,
                    "donor_name": "Daily Operations Checklist",
                    "task": label,
                    "route_id": "",
                    "route_length_km": 0,
                    "delivery_points": 0,
                    "priority": "Normal",
                    "work_category": CHECKLIST_FIT.get(label, ("Office", set()))[0],
                    "reason": f"Operational checklist: {label}",
                })

        # Calculate pre-allocation metrics
        overloaded_pre = sum(1 for s in state.values() if s["eligible"] and s["current_assigned"] > s["capacity"])
        balanced_pre = sum(1 for s in state.values() if s["eligible"] and s["capacity"] > 0 and 0.70 <= (s["current_assigned"] / s["capacity"]) <= 1.10)
        underutilized_pre = sum(1 for s in state.values() if s["eligible"] and s["capacity"] > 0 and (s["current_assigned"] / s["capacity"]) < 0.70)

        # If no assignable work exists:
        if not assignable_units:
            eligible_summary = [
                {
                    "employee_id": s["employee_id"],
                    "employee_name": s["employee_name"],
                    "designation": s["designation"],
                    "work_category": s["work_category"],
                    "status": s["status"],
                    "assigned_tasks": s["current_assigned"],
                    "before_assigned": s["initial_assigned"],
                    "after_assigned": s["current_assigned"],
                    "completed_tasks": s["completed"],
                    "pending_tasks": s["uncompleted"],
                    "capacity": s["capacity"],
                    "workload_pct": round((s["current_assigned"] / s["capacity"]) * 100) if s["capacity"] > 0 else 0,
                    "workload_status": "Overloaded" if (s["capacity"] > 0 and (s["current_assigned"] / s["capacity"]) > 1.10) else ("Balanced" if (s["capacity"] > 0 and (s["current_assigned"] / s["capacity"]) >= 0.70) else "Underutilized"),
                }
                for s in state.values()
                if s["eligible"]
            ]
            return {
                "ok": False,
                "attendance_missing": False,
                "message": "No pending work is available for automatic allocation.",
                "date": day_iso,
                "tasks_assigned": 0,
                "eligible_count": len(eligible_list),
                "unassigned_count": 0,
                "excluded_employees": excluded_list,
                "eligible_employees": eligible_summary,
                "transfers": [],
                "overloaded_count": overloaded_pre,
                "balanced_count": balanced_pre,
                "underutilized_count": underutilized_pre,
            }

        # 3. Fair Work Distribution Among Eligible Attending Employees
        transfers = []
        unassigned_units = []

        prio_weights = {"urgent": 4, "high": 3, "normal": 2, "low": 1}
        assignable_units.sort(
            key=lambda u: prio_weights.get(str(u.get("priority") or "").lower(), 2),
            reverse=True,
        )

        for unit in assignable_units:
            task = unit["task"]
            route = unit.get("route_id") or ""
            donor_id = unit.get("donor_id")

            # Find candidates among eligible employees who have current_assigned < capacity
            candidates = []
            for eid, s in state.items():
                if not s["eligible"]:
                    continue
                if eid == donor_id:
                    continue
                if s["current_assigned"] >= s["capacity"]:
                    continue

                # Check task/role fit
                task_allowed = _can_do_task(s["employee"], task)
                if task_allowed is None:
                    cfit = CHECKLIST_FIT.get(task)
                    if cfit:
                        cat, roles = cfit
                        task_allowed = s["designation"] in roles and _categories_match(s["work_category"], cat)
                    else:
                        task_allowed = _categories_match(s["work_category"], unit.get("work_category", s["work_category"]))

                if not task_allowed:
                    continue

                candidates.append(s)

            if not candidates:
                unassigned_units.append(unit)
                continue

            # Prioritize candidates:
            # 1. Route affinity (done this route before)
            # 2. Task affinity (done this task before)
            # 3. Most spare capacity (capacity - current_assigned)
            # 4. Name
            candidates.sort(
                key=lambda s: (
                    1 if route and route in done_routes.get(s["employee_id"], ()) else 0,
                    1 if task and task in done_tasks.get(s["employee_id"], ()) else 0,
                    s["capacity"] - s["current_assigned"],
                ),
                reverse=True,
            )

            chosen = candidates[0]
            before_from = state[donor_id]["current_assigned"] if donor_id and donor_id in state else 0
            before_to = chosen["current_assigned"]

            chosen["current_assigned"] += 1
            chosen["uncompleted"] += 1

            if donor_id and donor_id in state:
                state[donor_id]["current_assigned"] -= 1
                state[donor_id]["uncompleted"] = max(0, state[donor_id]["uncompleted"] - 1)

            transfers.append({
                "from_employee_id": donor_id or "UNASSIGNED",
                "from_employee_name": unit.get("donor_name") or "Unassigned Backlog",
                "from_designation": state[donor_id]["designation"] if donor_id and donor_id in state else "Unassigned",
                "to_employee_id": chosen["employee_id"],
                "to_employee_name": chosen["employee_name"],
                "to_designation": chosen["designation"],
                "designation": chosen["designation"],
                "work_category": chosen["work_category"],
                "task": task,
                "route_id": route,
                "tasks_moved": 1,
                "before_from_tasks": before_from,
                "after_from_tasks": state[donor_id]["current_assigned"] if donor_id and donor_id in state else 0,
                "before_to_tasks": before_to,
                "after_to_tasks": chosen["current_assigned"],
                "reason": unit.get("reason") or f"Allocated {task} to attending {chosen['designation']}",
            })

        # 4. Persist to MongoDB only if confirm is True
        if confirm:
            logs_col = db["daily_kpi_log"]
            # Save updated daily KPI logs
            for eid, s in state.items():
                if s["current_assigned"] != s["initial_assigned"]:
                    doc_id = _log_id(eid, day)
                    cur = logs_col.find_one({"_id": doc_id})
                    if cur is None:
                        cur = {
                            "_id": doc_id,
                            "name": doc_id,
                            "employee_id": eid,
                            "employee_name": s["employee_name"],
                            "designation": s["designation"],
                            "work_category": s["work_category"],
                            "post_office": s["employee"].get("post_office") or "Kaduwela",
                            "date": day_iso,
                            "completed_work_count": s["completed"],
                        }
                    cur["assigned_work_count"] = s["current_assigned"]
                    cur["uncompleted_work_count"] = max(0, s["current_assigned"] - s["completed"])
                    if not cur.get("primary_task_type"):
                        cur["primary_task_type"] = "Mail & Parcel Delivery" if s["work_category"] == "Delivery (Field)" else "Customer Service Counter"
                    cur["updated_at"] = datetime.now().isoformat(timespec="seconds")
                    cur["notes"] = f"Auto-balanced on {day_iso}. {s['status']}."
                    logs_col.replace_one({"_id": doc_id}, cur, upsert=True)

            # Record audit document in work_allocation collection
            assigned_count = len(transfers)
            alloc_col = db["work_allocation"]
            alloc_record = {
                "_id": f"alloc-{post_office or 'ALL'}-{day_iso}-{int(time.time())}",
                "name": f"alloc-{post_office or 'ALL'}-{day_iso}",
                "date": day_iso,
                "post_office": post_office or "All",
                "allocated_at": datetime.now().isoformat(timespec="seconds"),
                "allocated_by": user,
                "tasks_assigned_count": assigned_count,
                "eligible_employees_count": len(eligible_list),
                "unassigned_tasks_count": len(unassigned_units),
                "excluded_employees": excluded_list,
                "transfers": transfers,
                "status": "Applied",
            }
            alloc_col.insert_one(alloc_record)

        # Prepare summary of eligible employees with their updated status & workload
        assigned_count = len(transfers)
        eligible_summary = []
        for s in state.values():
            if not s["eligible"]:
                continue
            pct = round((s["current_assigned"] / s["capacity"]) * 100) if s["capacity"] > 0 else 0
            if pct > 110:
                wl_status = "Overloaded"
            elif pct >= 96:
                wl_status = "Near Capacity"
            elif pct >= 70:
                wl_status = "Balanced"
            else:
                wl_status = "Underutilized"

            tag = s["status"]
            if s["current_assigned"] >= s["capacity"]:
                tag = "At Capacity — No additional work"

            eligible_summary.append({
                "employee_id": s["employee_id"],
                "employee_name": s["employee_name"],
                "designation": s["designation"],
                "work_category": s["work_category"],
                "status": tag,
                "assigned_tasks": s["current_assigned"],
                "before_assigned": s["initial_assigned"],
                "after_assigned": s["current_assigned"],
                "completed_tasks": s["completed"],
                "pending_tasks": max(0, s["current_assigned"] - s["completed"]),
                "capacity": s["capacity"],
                "workload_pct": pct,
                "workload_status": wl_status,
            })

        overloaded_post = sum(1 for s in eligible_summary if s["workload_status"] == "Overloaded")
        balanced_post = sum(1 for s in eligible_summary if s["workload_status"] in ("Balanced", "Near Capacity"))
        underutilized_post = sum(1 for s in eligible_summary if s["workload_status"] == "Underutilized")

        action_msg = "Successfully auto-balanced" if confirm else "Proposed rebalance plan for"
        return {
            "ok": True,
            "confirmed": confirm,
            "attendance_missing": False,
            "message": f"{action_msg} {assigned_count} task(s) among {len(eligible_summary)} attending officer(s).",
            "date": day_iso,
            "tasks_assigned": assigned_count,
            "eligible_count": len(eligible_summary),
            "unassigned_count": len(unassigned_units),
            "excluded_employees": excluded_list,
            "eligible_employees": eligible_summary,
            "transfers": transfers,
            "overloaded_count": overloaded_post,
            "balanced_count": balanced_post,
            "underutilized_count": underutilized_post,
        }
