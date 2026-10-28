"""Read-only reporting tables for Power BI. These functions do not write."""

import csv
from io import BytesIO, StringIO

from fastapi import HTTPException
from openpyxl import Workbook

from db import get_db
from productivity import forecast_monitoring, weekly_rows

DATASETS = (
    "employees",
    "daily-kpi",
    "weekly-actuals",
    "random-forest-forecasts",
    "gradient-boosting-forecasts",
    "forecast-monitoring",
)

_DATE_FIELD = {
    "daily-kpi": "date",
    "weekly-actuals": "week_start",
    "random-forest-forecasts": "target_week",
    "gradient-boosting-forecasts": "forecast_week",
    "forecast-monitoring": "target_week",
}


def _text(value) -> str:
    if value is None:
        return ""
    return str(value)


def _number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _round(value):
    number = _number(value)
    if number is None:
        return None
    return round(number, 2)


def _employees() -> list[dict]:
    rows = []
    for doc in get_db()["employee"].find():
        employee_id = _text(doc.get("employee_id") or doc.get("_id"))
        if not employee_id:
            continue
        rows.append(
            {
                "employee_id": employee_id,
                "employee_name": _text(doc.get("employee_name")),
                "post_office": _text(doc.get("post_office")),
                "designation": _text(doc.get("designation")),
                "work_category": _text(doc.get("work_category")),
                "years_of_experience": _number(doc.get("years_of_experience")),
                "employment_type": _text(doc.get("employment_type")),
            }
        )
    rows.sort(key=lambda row: row["employee_id"])
    return rows


def _daily() -> list[dict]:
    rows = []
    for doc in get_db()["daily_kpi_log"].find():
        day = _text(doc.get("date"))[:10]
        rows.append(
            {
                "employee_id": _text(doc.get("employee_id")),
                "date": day,
                "day_of_week": _text(doc.get("day_of_week")),
                "route_id": _text(doc.get("route_id")),
                "route_length_km": _number(doc.get("route_length_km")),
                "distance_covered_km": _number(doc.get("distance_covered_km")),
                "primary_task_type": _text(doc.get("primary_task_type")),
                "assigned_work_count": _number(doc.get("assigned_work_count")),
                "completed_work_count": _number(doc.get("completed_work_count")),
                "uncompleted_work_count": _number(doc.get("uncompleted_work_count")),
                "completion_rate": _number(doc.get("completion_rate")),
                "correct_work_count": _number(doc.get("correct_work_count")),
                "incorrect_work_count": _number(doc.get("incorrect_work_count")),
                "accuracy_rate": _number(doc.get("accuracy_rate")),
                "on_time_work_count": _number(doc.get("on_time_work_count")),
                "late_work_count": _number(doc.get("late_work_count")),
                "timeliness_rate": _number(doc.get("timeliness_rate")),
                "kpi_score": _number(doc.get("kpi_score")),
                "performance_category": _text(doc.get("performance_category")),
            }
        )
    rows.sort(key=lambda row: (row["employee_id"], row["date"]))
    return rows


def _weekly() -> list[dict]:
    logs_by_employee: dict[str, list] = {}
    for doc in get_db()["daily_kpi_log"].find():
        logs_by_employee.setdefault(_text(doc.get("employee_id")), []).append(doc)
    employees = {row["employee_id"]: row for row in _employees()}
    rows = []
    for employee_id, logs in logs_by_employee.items():
        employee = employees.get(employee_id, {})
        for week in weekly_rows(logs, employee.get("years_of_experience"), employee.get("work_category") or ""):
            rows.append(
                {
                    "employee_id": employee_id,
                    "week_start": week["week"],
                    "measured_kpi": _round(week["kpi"]),
                    "completion_rate": _round(week["completion"]),
                    "accuracy_rate": _round(week["accuracy"]),
                    "timeliness_rate": _round(week["timeliness"]),
                    "assigned_work_count": _round(week["assigned"]),
                    "uncompleted_work_count": _round(week["uncompleted"]),
                    "incorrect_work_count": _round(week["incorrect"]),
                    "late_work_count": _round(week["late"]),
                }
            )
    rows.sort(key=lambda row: (row["employee_id"], row["week_start"]))
    return rows


def _without_id(doc: dict) -> dict:
    return {key: value for key, value in doc.items() if key != "_id"}


def _random_forest() -> list[dict]:
    rows = []
    for doc in get_db()["kpi_forecast"].find():
        public = _without_id(doc)
        rows.append(
            {
                "employee_id": _text(public.get("employee_id")),
                "source": _text(public.get("source")),
                "scenario_name": _text(public.get("scenario_name")),
                "input_week": _text(public.get("input_week"))[:10],
                "target_week": _text(public.get("target_week"))[:10],
                "forecast_kpi": _number(public.get("forecast_kpi")),
                "model_id": _text(public.get("model_id")),
                "created_at": _text(public.get("created_at")),
            }
        )
    rows.sort(key=lambda row: (row["employee_id"], row["target_week"]))
    return rows


def _gradient() -> list[dict]:
    rows = []
    for doc in get_db()["kpi_model_forecast"].find():
        public = _without_id(doc)
        rows.append(
            {
                "employee_id": _text(public.get("employee_id")),
                "employee_name": _text(public.get("employee_name")),
                "post_office": _text(public.get("post_office")),
                "designation": _text(public.get("designation")),
                "work_category": _text(public.get("work_category")),
                "source_week": _text(public.get("source_week"))[:10],
                "forecast_week": _text(public.get("forecast_week"))[:10],
                "latest_actual_kpi": _number(public.get("latest_actual_kpi")),
                "predicted_kpi": _number(public.get("predicted_kpi")),
                "predicted_change": _number(public.get("predicted_change")),
                "monitoring_category": _text(public.get("monitoring_category")),
                "model_version": _text(public.get("model_version")),
                "generated_at": _text(public.get("generated_at")),
                "completion_rate": _number(public.get("completion_rate")),
                "accuracy_rate": _number(public.get("accuracy_rate")),
                "timeliness_rate": _number(public.get("timeliness_rate")),
                "assigned_work_count": _number(public.get("assigned_work_count")),
                "days_worked": _number(public.get("days_worked")),
            }
        )
    rows.sort(key=lambda row: (row["employee_id"], row["forecast_week"]))
    return rows


def _monitoring() -> list[dict]:
    report = forecast_monitoring()
    rows = []
    for row in report["rows"]:
        rows.append(
            {
                "employee_id": _text(row.get("employee_id")),
                "employee_name": _text(row.get("employee_name")),
                "post_office": _text(row.get("post_office")),
                "input_week": _text(row.get("input_week"))[:10],
                "target_week": _text(row.get("target_week"))[:10],
                "predicted_kpi": _number(row.get("predicted_kpi")),
                "actual_kpi": _number(row.get("actual_kpi")),
                "baseline_kpi": _number(row.get("baseline_kpi")),
                "absolute_error": _number(row.get("absolute_error")),
                "signed_error": _number(row.get("signed_error")),
                "status": _text(row.get("status")),
                "model_id": _text(row.get("model_id")),
            }
        )
    return rows


_BUILDERS = {
    "employees": _employees,
    "daily-kpi": _daily,
    "weekly-actuals": _weekly,
    "random-forest-forecasts": _random_forest,
    "gradient-boosting-forecasts": _gradient,
    "forecast-monitoring": _monitoring,
}


def dataset_rows(name: str, date_from: str | None = None, date_to: str | None = None) -> list[dict]:
    if name not in _BUILDERS:
        raise HTTPException(status_code=404, detail="Unknown reporting dataset.")
    rows = _BUILDERS[name]()
    field = _DATE_FIELD.get(name)
    if field and (date_from or date_to):
        start = (date_from or "")[:10]
        end = (date_to or "")[:10]
        rows = [
            row for row in rows
            if (not start or _text(row.get(field)) >= start)
            and (not end or _text(row.get(field)) <= end)
        ]
    return rows


def dataset_page(name: str, date_from: str | None, date_to: str | None, limit: int, offset: int) -> dict:
    if limit < 1 or limit > 2000:
        raise HTTPException(status_code=400, detail="Limit must be from 1 to 2000.")
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset cannot be negative.")
    rows = dataset_rows(name, date_from, date_to)
    page = rows[offset:offset + limit]
    return {
        "dataset": name,
        "date_field": _DATE_FIELD.get(name),
        "total": len(rows),
        "limit": limit,
        "offset": offset,
        "rows": page,
    }


def dataset_csv(name: str, date_from: str | None = None, date_to: str | None = None) -> str:
    rows = dataset_rows(name, date_from, date_to)
    fields = list(rows[0]) if rows else []
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def workbook_bytes() -> bytes:
    book = Workbook()
    first = True
    for name in DATASETS:
        rows = dataset_rows(name)
        sheet = book.active if first else book.create_sheet()
        first = False
        sheet.title = name[:31]
        fields = list(rows[0]) if rows else ["employee_id"]
        sheet.append(fields)
        for row in rows:
            sheet.append([row.get(field) for field in fields])
    buffer = BytesIO()
    book.save(buffer)
    return buffer.getvalue()
