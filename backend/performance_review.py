"""24-month promotion review and daily allocation for the postmaster.

The next-week KPI model is not used here. Review rules are examples for this
desk. They are not official Sri Lanka Post promotion standards. A person must
approve any promotion or any change to the day's work.
"""

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
PRESENT_STATUSES = {"on time", "late", "half day"}
STANDARD_DAY_HOURS = 8
SALARY_HOURS = 240
OT_MULTIPLIER = 1.5
COVER_ROUTE_HOURS = 4
EXTRA_TASK_HOURS = 1
DELIVERY_ROLES = {"Postman", "Senior Postman", "Delivery Officer"}

# Example desk rules for which current role may receive a task. Not an official postal standard.
# A person's designation and work category are never changed by allocation.
TASK_FIT = {
    "Mail & Parcel Delivery": {
        "roles": {"Postman", "Senior Postman", "Delivery Officer"},
        "category": "Delivery (Field)",
    },
    "Customer Service Counter": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Money Order Processing": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Postal Clerk Duties": {
        "roles": {"Postal Clerk", "Postmaster (Head)"},
        "categories": {"Office", "Supervisory / Office"},
    },
    "Data Entry": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Accounts Processing": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Accounts Verification": {
        "roles": {"Postmaster (Head)"},
        "category": "Supervisory / Office",
    },
    "Correspondence Handling": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Communication Support": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Calendar Management": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Stock & Inventory Check": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Ad-hoc Project Support": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Workflow Coordination": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
    },
    "Team Coordination": {
        "roles": {"Postal Assistant", "Postal Clerk"},
        "category": "Office",
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
    "Incoming Mail Registration": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Parcel Registration and Sorting": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Registered Mail Delivery": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Parcel Delivery by Route": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Ordinary Letter Delivery": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Article Scanning and Tracking Updates": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Pending Mail and Parcel Clearance": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Undelivered Article Processing": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Counter Customer Service": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Postage and Fee Verification": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Postal Financial Transactions": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Proof of Delivery Verification": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Late Delivery Follow-up": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
    "Attendance and Staff Availability Review": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Daily Work Allocation Review": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Incomplete Task Follow-up": ("Supervisory / Office", {"Postmaster (Head)"}),
    "Incorrect Record and Address Verification": ("Office", {"Postal Assistant", "Postal Clerk"}),
    "Returned Mail and Parcel Processing": ("Delivery (Field)", {"Postman", "Senior Postman", "Delivery Officer"}),
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


def _can_do_task(employee: dict, task: str) -> bool | None:
    """True when this person's current role may receive the task.

    None means the task is not in the example list, so allocation keeps the
    older same-category rule.
    """
    fit = TASK_FIT.get(task)
    if fit is None:
        return None
    designation = str(employee.get("designation") or "").strip()
    category = str(employee.get("work_category") or "").strip()
    categories = fit.get("categories")
    if categories is None:
        categories = {fit.get("category")}
    return designation in fit["roles"] and category in categories


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
