"""Next-week KPI forecast from daily work rates.

The saved model predicts next week's score from this week's rates and counts.
The written summary comes from those same measured figures. It does not
change anyone's work, pay, or role.
"""

from datetime import date, timedelta
from pathlib import Path

import joblib
import pandas as pd
from fastapi import HTTPException

from db import get_db

MODEL_PATH = Path(__file__).with_name("models") / "weekly_kpi_model.joblib"

# Held-out test from the training run: 16 employees, 224 earlier weeks, 60 later weeks.
EVALUATION = {
    "train_rows": 224,
    "test_rows": 60,
    "baseline_mae": 7.93,
    "copy_week_mae": 3.81,
    "model_mae": 3.41,
    "model_rmse": 4.55,
    "note": (
        "Tested on later weeks from the research file. "
        "The next-week number is an estimate, usually off by about 3.4 points. "
        "It is not a measured score and is not a basis for discipline, promotion, or pay."
    ),
}

_bundle = None


def week_start(value) -> date | None:
    """Monday of the week, matching the Colab period that ends on Sunday."""
    if value is None or value == "":
        return None
    text = str(value)[:10]
    try:
        day = date.fromisoformat(text)
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


def _mean(values: list) -> float | None:
    nums = [value for value in values if value is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


def _total(values: list) -> float:
    nums = [value for value in values if value is not None]
    if not nums:
        return 0.0
    return float(sum(nums))


def weekly_rows(logs: list[dict], experience, work_category: str) -> list[dict]:
    """One row per week. The score is the average of the three daily rates."""
    grouped: dict[date, list[dict]] = {}
    for log in logs:
        start = week_start(log.get("date"))
        if start is None:
            continue
        grouped.setdefault(start, []).append(log)

    rows = []
    for start in sorted(grouped):
        days = grouped[start]
        completion = _mean([_num(day.get("completion_rate")) for day in days])
        accuracy = _mean([_num(day.get("accuracy_rate")) for day in days])
        timeliness = _mean([_num(day.get("timeliness_rate")) for day in days])
        daily_scores = []
        for day in days:
            rates = [
                _num(day.get("completion_rate")),
                _num(day.get("accuracy_rate")),
                _num(day.get("timeliness_rate")),
            ]
            if any(rate is None for rate in rates):
                continue
            daily_scores.append(sum(rates) / 3)
        kpi = _mean(daily_scores)
        if kpi is None or completion is None or accuracy is None or timeliness is None:
            continue
        rows.append(
            {
                "week": start.isoformat(),
                "kpi": kpi,
                "completion": completion,
                "accuracy": accuracy,
                "timeliness": timeliness,
                "assigned": _total([_num(day.get("assigned_work_count")) for day in days]),
                "uncompleted": _total([_num(day.get("uncompleted_work_count")) for day in days]),
                "incorrect": _total([_num(day.get("incorrect_work_count")) for day in days]),
                "late": _total([_num(day.get("late_work_count")) for day in days]),
                "experience": _num(experience) or 0.0,
                "work_category": work_category or "",
            }
        )
    return rows


_KPI_PARTS = (
    ("completion", "Completion", "uncompleted", "unfinished"),
    ("accuracy", "Accuracy", "incorrect", "incorrect"),
    ("timeliness", "Timeliness", "late", "late"),
)


def recommendations(row: dict) -> tuple[str, list[dict]]:
    """One note per KPI already scored this week, from that score and its work count."""
    rates = {key: row[key] for key, _label, _count_key, _noun in _KPI_PARTS}
    weakest = min(rates, key=rates.get)
    notes = []
    for key, label, count_key, noun in _KPI_PARTS:
        score = float(row[key])
        count = int(round(float(row[count_key])))
        is_weakest = key == weakest
        if count > 0:
            evidence = f"{count} {noun} item{'s' if count != 1 else ''} this week."
            action = (
                f"Review those {noun} items with the employee. "
                "That is the work still sitting against this score."
            )
            priority = "high" if is_weakest else "medium"
        else:
            evidence = f"No {noun} items were recorded this week."
            action = "This part does not need a change from the current week's work."
            priority = "low"
        notes.append(
            {
                "kpi": key,
                "title": f"{label} is already {score:.1f}",
                "score": round(score, 1),
                "evidence": evidence,
                "action": action,
                "priority": priority,
                "weakest": is_weakest,
                "review_note": "Advice only. A person must review this before any change.",
            }
        )
    notes.sort(key=lambda note: (note["kpi"] != weakest, note["kpi"]))
    return weakest, notes


def load_model():
    global _bundle
    if _bundle is None:
        if not MODEL_PATH.is_file():
            raise HTTPException(
                status_code=503,
                detail="A reliable prediction is not available yet. The trained model file is missing.",
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def _round(value: float) -> float:
    return round(float(value), 1)


def productivity_for(employee_id: str) -> dict:
    employee_id = employee_id.strip()
    employee = get_db()["employee"].find_one({"_id": employee_id})
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} was not found")

    logs = list(get_db()["daily_kpi_log"].find({"employee_id": employee_id}))
    weeks = weekly_rows(
        logs,
        employee.get("years_of_experience"),
        str(employee.get("work_category") or ""),
    )
    if not weeks:
        return {
            "available": False,
            "employee_id": employee_id,
            "employee_name": employee.get("employee_name") or "",
            "message": (
                "A reliable prediction is not available yet. "
                "This employee needs daily completion, accuracy, and timeliness records."
            ),
            "evaluation": EVALUATION,
        }

    current = weeks[-1]
    bundle = load_model()
    frame = pd.DataFrame(
        [
            {
                "kpi": current["kpi"],
                "completion": current["completion"],
                "accuracy": current["accuracy"],
                "timeliness": current["timeliness"],
                "assigned": current["assigned"],
                "uncompleted": current["uncompleted"],
                "incorrect": current["incorrect"],
                "late": current["late"],
                "experience": current["experience"],
                "work_category": current["work_category"],
            }
        ]
    )
    predicted = float(bundle["model"].predict(frame)[0])
    weakest, notes = recommendations(current)
    summary = (
        f"This week the measured KPI is {current['kpi']:.1f}. "
        f"The notes below use the completion, accuracy, and timeliness scores already recorded. "
        f"The weakest scored part is {weakest}. "
        f"Predicted KPI next week: {predicted:.1f}. That forecast is an estimate."
    )
    return {
        "available": True,
        "employee_id": employee_id,
        "employee_name": employee.get("employee_name") or "",
        "work_category": current["work_category"],
        "post_office": employee.get("post_office") or "",
        "week": current["week"],
        "measured_kpi": _round(current["kpi"]),
        "predicted_next_week_kpi": _round(predicted),
        "completion": _round(current["completion"]),
        "accuracy": _round(current["accuracy"]),
        "timeliness": _round(current["timeliness"]),
        "assigned": round(current["assigned"]),
        "uncompleted": round(current["uncompleted"]),
        "incorrect": round(current["incorrect"]),
        "late": round(current["late"]),
        "weakest": weakest,
        "summary": summary,
        "recommendations": notes,
        "history": [
            {"week": row["week"], "kpi": _round(row["kpi"])} for row in weeks[-8:]
        ],
        "evaluation": EVALUATION,
    }
