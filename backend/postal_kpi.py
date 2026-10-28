"""Native Postal KPI Dashboard totals from daily work logs. Read only."""

from fastapi import HTTPException

from db import get_db


def _number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _rows():
    logs = []
    for doc in get_db()["daily_kpi_log"].find():
        day = str(doc.get("date") or "")[:10]
        logs.append(
            {
                "employee_id": str(doc.get("employee_id") or ""),
                "route_id": str(doc.get("route_id") or ""),
                "year": day[:4] if len(day) >= 4 and day[:4].isdigit() else "",
                "month": day[:7] if len(day) >= 7 and day[4] == "-" else "",
                "assigned": _number(doc.get("assigned_work_count")) or 0.0,
                "completed": _number(doc.get("completed_work_count")) or 0.0,
                "uncompleted": _number(doc.get("uncompleted_work_count")) or 0.0,
                "kpi_score": _number(doc.get("kpi_score")),
            }
        )
    return logs


def _names():
    names = {}
    for doc in get_db()["employee"].find():
        employee_id = str(doc.get("employee_id") or doc.get("_id") or "")
        if employee_id:
            names[employee_id] = str(doc.get("employee_name") or employee_id)
    return names


def dashboard(employee_id: str = "", route_id: str = "", year: str = "") -> dict:
    employee_id = employee_id.strip()
    route_id = route_id.strip()
    year = year.strip()
    if year and (len(year) != 4 or not year.isdigit()):
        raise HTTPException(status_code=400, detail="Year must be a four-digit year.")
    logs = _rows()
    names = _names()
    people = {}
    for row in logs:
        if row["employee_id"] and row["employee_id"] not in people:
            people[row["employee_id"]] = names.get(row["employee_id"], row["employee_id"])
    options = {
        "employees": [
            {"id": employee_id, "name": name}
            for employee_id, name in sorted(people.items(), key=lambda item: item[1])
        ],
        "routes": sorted({row["route_id"] for row in logs if row["route_id"]}),
        "years": sorted({row["year"] for row in logs if row["year"]}),
    }
    selected = [
        row for row in logs
        if (not employee_id or row["employee_id"] == employee_id)
        and (not route_id or row["route_id"] == route_id)
        and (not year or row["year"] == year)
    ]
    assigned = round(sum(row["assigned"] for row in selected), 2)
    completed = round(sum(row["completed"] for row in selected), 2)
    uncompleted = round(sum(row["uncompleted"] for row in selected), 2)
    scores = [row["kpi_score"] for row in selected if row["kpi_score"] is not None]
    by_year = {}
    for row in selected:
        if not row["year"]:
            continue
        bucket = by_year.setdefault(row["year"], {"year": row["year"], "assigned": 0.0, "completed": 0.0})
        bucket["assigned"] += row["assigned"]
        bucket["completed"] += row["completed"]
    by_month = {}
    for row in selected:
        if not row["month"]:
            continue
        bucket = by_month.setdefault(row["month"], {"month": row["month"], "assigned": 0.0, "completed": 0.0, "uncompleted": 0.0})
        bucket["assigned"] += row["assigned"]
        bucket["completed"] += row["completed"]
        bucket["uncompleted"] += row["uncompleted"]
    by_route = {}
    for row in selected:
        label = row["route_id"] or "No route"
        bucket = by_route.setdefault(label, {"route_id": label, "assigned": 0.0, "completed": 0.0, "uncompleted": 0.0})
        bucket["assigned"] += row["assigned"]
        bucket["completed"] += row["completed"]
        bucket["uncompleted"] += row["uncompleted"]
    by_employee = {}
    for row in selected:
        if not row["employee_id"]:
            continue
        bucket = by_employee.setdefault(
            row["employee_id"],
            {
                "employee_id": row["employee_id"],
                "employee_name": names.get(row["employee_id"], row["employee_id"]),
                "assigned": 0.0,
                "completed": 0.0,
                "uncompleted": 0.0,
                "scores": [],
            },
        )
        bucket["assigned"] += row["assigned"]
        bucket["completed"] += row["completed"]
        bucket["uncompleted"] += row["uncompleted"]
        if row["kpi_score"] is not None:
            bucket["scores"].append(row["kpi_score"])
    return {
        "summary": {
            "assigned_work": assigned,
            "completed_work": completed,
            "uncompleted_work": uncompleted,
            "average_kpi_score": None if not scores else round(sum(scores) / len(scores), 2),
            "kpi_score_rows": len(scores),
            "log_rows": len(selected),
        },
        "by_year": [
            {"year": row["year"], "assigned": round(row["assigned"], 2), "completed": round(row["completed"], 2)}
            for row in sorted(by_year.values(), key=lambda item: item["year"])
        ],
        "by_month": [
            {
                "month": row["month"],
                "assigned": round(row["assigned"], 2),
                "completed": round(row["completed"], 2),
                "uncompleted": round(row["uncompleted"], 2),
            }
            for row in sorted(by_month.values(), key=lambda item: item["month"])
        ],
        "by_route": [
            {
                "route_id": row["route_id"],
                "assigned": round(row["assigned"], 2),
                "completed": round(row["completed"], 2),
                "uncompleted": round(row["uncompleted"], 2),
            }
            for row in sorted(by_route.values(), key=lambda item: (-item["completed"], item["route_id"]))
        ],
        "by_employee": [
            {
                "employee_id": row["employee_id"],
                "employee_name": row["employee_name"],
                "assigned": round(row["assigned"], 2),
                "completed": round(row["completed"], 2),
                "uncompleted": round(row["uncompleted"], 2),
                "average_kpi_score": None if not row["scores"] else round(sum(row["scores"]) / len(row["scores"]), 2),
            }
            for row in sorted(by_employee.values(), key=lambda item: (-item["completed"], item["employee_id"]))
        ],
        "options": options,
        "definition": {
            "grain": "One daily_kpi_log row is one employee day.",
            "assigned_work": "Sum of assigned_work_count.",
            "completed_work": "Sum of completed_work_count.",
            "uncompleted_work": "Sum of uncompleted_work_count. On the current logs this equals assigned minus completed.",
            "average_kpi_score": "Mean of stored kpi_score values. Days without a stored score are left out of the average.",
        },
    }
