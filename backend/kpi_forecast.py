"""Next-week KPI forecasts from the supplied gradient-boosting model.

The December 2025 CSV in ml_models is a historical comparison. Live forecasts
are built from daily KPI logs and employee records. Predictions are monitoring
indicators. They do not change pay, warnings, or promotion.
"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import joblib
import pandas as pd
from fastapi import HTTPException

from db import get_db

MODEL_DIR = Path(__file__).with_name("ml_models")
MODEL_PATH = MODEL_DIR / "post_assist_kpi_model.joblib"
CONFIG_PATH = MODEL_DIR / "model_config.json"
MODEL_VERSION = "post_assist_kpi_model.joblib"
COLLECTION = "kpi_model_forecast"
# Provisional weights from model_config.json. Not an official Sri Lanka Post formula.
KPI_WEIGHTS = (0.40, 0.30, 0.30)

_model = None
_columns = None


def load_model():
    global _model, _columns
    if _model is None:
        if not MODEL_PATH.is_file():
            raise HTTPException(status_code=503, detail="The KPI model file is missing.")
        _model = joblib.load(MODEL_PATH)
        with CONFIG_PATH.open(encoding="utf-8") as handle:
            _columns = list(json.load(handle)["feature_columns"])
    return _model, _columns


def monitoring_category(change: float) -> str:
    if change >= 2:
        return "Improving"
    if change <= -2:
        return "Needs Review"
    return "Relatively Stable"


def recommendation_for(category: str) -> str:
    if category == "Needs Review":
        return (
            "Ask the supervisor to review workload, route conditions, accuracy, timeliness, "
            "attendance, and support needs with the employee. This is not a warning, a pay change, "
            "or a promotion decision."
        )
    if category == "Improving":
        return (
            "Monitor the actual result next week and note working practices that may be helping. "
            "This is not a reward or a promotion decision."
        )
    return (
        "Continue routine monitoring and compare next week's actual KPI with this forecast. "
        "This is not an official performance rating."
    )


def _monday(value) -> date | None:
    if value is None or value == "":
        return None
    try:
        day = date.fromisoformat(str(value)[:10])
    except ValueError:
        return None
    return day - timedelta(days=day.weekday())


def _num(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _sum(values):
    nums = [value for value in values if value is not None]
    if not nums:
        return None
    return float(sum(nums))


def _mean(values):
    nums = [value for value in values if value is not None]
    if not nums:
        return None
    return float(sum(nums) / len(nums))


def provisional_kpi(completion, accuracy, timeliness):
    if completion is None or accuracy is None or timeliness is None:
        return None
    score = (
        KPI_WEIGHTS[0] * completion
        + KPI_WEIGHTS[1] * accuracy
        + KPI_WEIGHTS[2] * timeliness
    )
    return score


def _week_record(days: list[dict]) -> dict | None:
    assigned = _sum([_num(day.get("assigned_work_count")) for day in days])
    completed = _sum([_num(day.get("completed_work_count")) for day in days])
    uncompleted = _sum([_num(day.get("uncompleted_work_count")) for day in days])
    correct = _sum([_num(day.get("correct_work_count")) for day in days])
    incorrect = _sum([_num(day.get("incorrect_work_count")) for day in days])
    on_time = _sum([_num(day.get("on_time_work_count")) for day in days])
    late = _sum([_num(day.get("late_work_count")) for day in days])
    completion = (completed / assigned * 100) if assigned else None
    accuracy = (correct / completed * 100) if completed else None
    timeliness = (on_time / completed * 100) if completed else None
    kpi = provisional_kpi(completion, accuracy, timeliness)
    if kpi is None:
        return None
    return {
        "assigned": assigned,
        "completed": completed,
        "uncompleted": uncompleted,
        "completion": completion,
        "correct": correct,
        "incorrect": incorrect,
        "accuracy": accuracy,
        "on_time": on_time,
        "late": late,
        "timeliness": timeliness,
        "days": len(days),
        "route_length": _mean([_num(day.get("route_length_km")) for day in days]),
        "distance": _sum([_num(day.get("distance_covered_km")) for day in days]),
        "kpi": kpi,
    }


def weekly_history(logs: list[dict]) -> list[dict]:
    grouped: dict[date, list[dict]] = {}
    for log in logs:
        start = _monday(log.get("date"))
        if start is None:
            continue
        grouped.setdefault(start, []).append(log)
    rows = []
    for start in sorted(grouped):
        record = _week_record(grouped[start])
        if record is None:
            continue
        record["week"] = start
        rows.append(record)
    return rows


def later_incomplete_weeks(logs: list[dict], used_week: date) -> list[str]:
    """Weeks with logs after the forecast source that cannot form a KPI."""
    grouped: dict[date, list[dict]] = {}
    for log in logs:
        start = _monday(log.get("date"))
        if start is None or start <= used_week:
            continue
        grouped.setdefault(start, []).append(log)
    return [start.isoformat() for start in sorted(grouped) if _week_record(grouped[start]) is None]


def _leave_days(employee_id: str, week: date):
    """Count dated leave that overlaps the week. Undated leave stays missing."""
    end = week + timedelta(days=6)
    counted = 0
    found = False
    try:
        rows = get_db()["entitlement_leave"].find({"employee_id": employee_id})
    except KeyError:
        return None
    for row in rows:
        try:
            start = date.fromisoformat(str(row.get("from_date") or "")[:10])
            finish = date.fromisoformat(str(row.get("to_date") or "")[:10])
        except ValueError:
            continue
        overlap_start = max(start, week)
        overlap_end = min(finish, end)
        if overlap_start <= overlap_end:
            found = True
            counted += (overlap_end - overlap_start).days + 1
    return counted if found else None


def _overtime_hours(employee_id: str, week: date) -> float:
    end = week + timedelta(days=6)
    total = 0.0
    found = False
    try:
        rows = get_db()["overtime"].find({"employee_id": employee_id})
    except KeyError:
        return 0.0
    for row in rows:
        day = _monday(row.get("date"))
        if day is None:
            text = str(row.get("date") or "")[:10]
            try:
                raw = date.fromisoformat(text)
            except ValueError:
                continue
            if week <= raw <= end:
                found = True
                total += _num(row.get("hours")) or 0.0
            continue
        if day == week:
            found = True
            total += _num(row.get("hours")) or 0.0
    return total if found else 0.0


def build_features(employee: dict, history: list[dict], week: date) -> dict | None:
    index = next((i for i, row in enumerate(history) if row["week"] == week), None)
    if index is None:
        return None
    current = history[index]
    previous = [row["kpi"] for row in history[: index + 1]]
    prior = previous[-4:]
    previous_1 = history[index - 1]["kpi"] if index >= 1 else None
    previous_2 = history[index - 2]["kpi"] if index >= 2 else None
    mean_4 = _mean(prior)
    std_4 = None
    if len(prior) >= 2 and mean_4 is not None:
        std_4 = (sum((value - mean_4) ** 2 for value in prior) / len(prior)) ** 0.5
    hours = _overtime_hours(employee["_id"], week)
    missing = [
        label
        for label, value in (
            ("post office", employee.get("post_office")),
            ("designation", employee.get("designation")),
            ("work category", employee.get("work_category")),
            ("employment type", employee.get("employment_type")),
        )
        if not str(value or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Employee {employee['_id']} is missing {', '.join(missing)}.",
        )
    return {
        "Years_of_Experience": _num(employee.get("years_of_experience")),
        "Route_Length_km": current["route_length"],
        "Distance_Covered_km": current["distance"],
        "Assigned_Work_Count": current["assigned"],
        "Completed_Work_Count": current["completed"],
        "Uncompleted_Work_Count": current["uncompleted"],
        "Completion_Rate": current["completion"],
        "Correct_Work_Count": current["correct"],
        "Incorrect_Work_Count": current["incorrect"],
        "Accuracy_Rate": current["accuracy"],
        "On_Time_Work_Count": current["on_time"],
        "Late_Work_Count": current["late"],
        "Timeliness_Rate": current["timeliness"],
        "Days_Worked": current["days"],
        "Leave_Days_Weekly": _leave_days(employee["_id"], week),
        "Overtime_Hours_Weekly": hours,
        "KPI_Current": current["kpi"],
        "KPI_Previous_1": previous_1,
        "KPI_Previous_2": previous_2,
        "KPI_Mean_4_Weeks": mean_4,
        "KPI_Std_4_Weeks": std_4,
        "Post_Office": employee.get("post_office"),
        "Designation": employee.get("designation"),
        "Work_Category": employee.get("work_category"),
        "Employment_Type": employee.get("employment_type"),
        "Doing_Overtime_Weekly": "Yes" if hours > 0 else "No",
    }


def clamp_kpi(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def predict_row(features: dict) -> float:
    model, columns = load_model()
    frame = pd.DataFrame([{column: features.get(column) for column in columns}])
    predicted = float(model.predict(frame)[0])
    return round(clamp_kpi(predicted), 2)


def _public(doc: dict) -> dict:
    return {key: value for key, value in doc.items() if key != "_id"}


def _store(employee: dict, features: dict, week: date, predicted: float, data_note: str = "") -> dict:
    actual = round(float(features["KPI_Current"]), 2)
    change = round(predicted - actual, 2)
    category = monitoring_category(change)
    forecast_week = week + timedelta(days=7)
    doc = {
        "_id": f"{employee['_id']}|{week.isoformat()}",
        "employee_id": employee["_id"],
        "employee_name": employee.get("employee_name") or "",
        "post_office": employee.get("post_office") or "",
        "designation": employee.get("designation") or "",
        "work_category": employee.get("work_category") or "",
        "source_week": week.isoformat(),
        "forecast_week": forecast_week.isoformat(),
        "latest_actual_kpi": actual,
        "predicted_kpi": predicted,
        "predicted_change": change,
        "monitoring_category": category,
        "recommendation": recommendation_for(category),
        "model_version": MODEL_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "completion_rate": None if features["Completion_Rate"] is None else round(features["Completion_Rate"], 2),
        "accuracy_rate": None if features["Accuracy_Rate"] is None else round(features["Accuracy_Rate"], 2),
        "timeliness_rate": None if features["Timeliness_Rate"] is None else round(features["Timeliness_Rate"], 2),
        "assigned_work_count": features["Assigned_Work_Count"],
        "days_worked": features["Days_Worked"],
        "historical_file_note": (
            "The attached forecast file ends in December 2025 and is not this live prediction."
        ),
        "data_note": data_note,
    }
    get_db()[COLLECTION].replace_one({"_id": doc["_id"]}, doc, upsert=True)
    return _public(doc)


def generate_forecasts(week_text: str | None = None) -> dict:
    requested = _monday(week_text) if week_text else None
    if week_text and requested is None:
        raise HTTPException(status_code=422, detail="The forecast source week must be a date.")
    saved = []
    skipped = []
    for employee in get_db()["employee"].find():
        employee_id = employee.get("_id")
        logs = list(get_db()["daily_kpi_log"].find({"employee_id": employee_id}))
        history = weekly_history(logs)
        if not history:
            skipped.append({"employee_id": employee_id, "message": "No weekly KPI can be calculated from the daily logs."})
            continue
        week = requested or history[-1]["week"]
        if requested and all(row["week"] != requested for row in history):
            skipped.append({"employee_id": employee_id, "message": f"No complete week starting {requested.isoformat()}."})
            continue
        try:
            features = build_features(employee, history, week)
        except HTTPException as exc:
            skipped.append({"employee_id": employee_id, "message": str(exc.detail)})
            continue
        if features is None:
            skipped.append({"employee_id": employee_id, "message": "The selected week has no calculated KPI."})
            continue
        later = later_incomplete_weeks(logs, week)
        note = ""
        if later:
            note = (
                f"Later logged weeks {', '.join(later)} do not have completed, correct, and on-time counts, "
                f"so this forecast uses the last complete week {week.isoformat()}."
            )
        saved.append(_store(employee, features, week, predict_row(features), note))
    return {
        "generated": len(saved),
        "skipped": skipped,
        "forecasts": saved,
        "model_version": MODEL_VERSION,
        "kpi_formula_note": (
            "Weekly KPI uses completion 0.40, accuracy 0.30, and timeliness 0.30. "
            "That weighting is provisional and is not an official Sri Lanka Post formula."
        ),
    }


def list_forecasts(search: str = "", post_office: str = "", designation: str = "", category: str = "") -> list[dict]:
    rows = [_public(doc) for doc in get_db()[COLLECTION].find()]
    if post_office:
        rows = [row for row in rows if row.get("post_office") == post_office]
    if designation:
        rows = [row for row in rows if row.get("designation") == designation]
    if category:
        rows = [row for row in rows if row.get("monitoring_category") == category]
    needle = search.strip().lower()
    if needle:
        rows = [
            row for row in rows
            if needle in f"{row.get('employee_id', '')} {row.get('employee_name', '')}".lower()
        ]
    rows.sort(key=lambda row: (row.get("employee_name") or "", row.get("source_week") or ""))
    return rows


def summary() -> dict:
    rows = list_forecasts()
    def count(label):
        return sum(1 for row in rows if row.get("monitoring_category") == label)
    predicted = [float(row["predicted_kpi"]) for row in rows if row.get("predicted_kpi") is not None]
    weeks = sorted({row.get("forecast_week") for row in rows if row.get("forecast_week")})
    return {
        "total": len(rows),
        "improving": count("Improving"),
        "needs_review": count("Needs Review"),
        "stable": count("Relatively Stable"),
        "average_predicted_kpi": None if not predicted else round(sum(predicted) / len(predicted), 2),
        "forecast_period": weeks[-1] if len(weeks) == 1 else (", ".join(weeks) if weeks else None),
        "historical_file_note": "latest_employee_forecasts.csv is the 22 December 2025 comparison file, not the live forecast.",
        "model_version": MODEL_VERSION,
        "explanation": {
            "available": False,
            "note": (
                "Feature importance is not included in model_config.json. "
                "This page does not invent driver scores or prediction intervals."
            ),
        },
    }


def forecast_detail(employee_id: str) -> dict:
    employee_id = employee_id.strip()
    employee = get_db()["employee"].find_one({"_id": employee_id})
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} was not found")
    stored = list(get_db()[COLLECTION].find({"employee_id": employee_id}))
    if not stored:
        raise HTTPException(status_code=404, detail="No forecast has been generated for this employee.")
    latest = sorted(stored, key=lambda row: row.get("source_week") or "")[-1]
    logs = list(get_db()["daily_kpi_log"].find({"employee_id": employee_id}))
    history = [
        {"week": row["week"].isoformat(), "kpi": round(row["kpi"], 2), "record_type": "actual"}
        for row in weekly_history(logs)
    ]
    return {
        "forecast": _public(latest),
        "history": history,
        "indicators": {
            "completion_rate": latest.get("completion_rate"),
            "accuracy_rate": latest.get("accuracy_rate"),
            "timeliness_rate": latest.get("timeliness_rate"),
            "assigned_work_count": latest.get("assigned_work_count"),
            "days_worked": latest.get("days_worked"),
        },
    }
