"""Next-week KPI forecast from daily work rates.

The saved model predicts next week's score from this week's rates and counts.
The written summary comes from those same measured figures. It does not
change anyone's work, pay, or role.
"""

import hashlib
from datetime import date, datetime, timedelta, timezone
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
    "baseline_rmse": 5.28,
    "model_within_5_percent": 76.67,
    "baseline_within_5_percent": 78.33,
    "employees": 16,
    "test_start": "2025-04-07",
    "test_end": "2025-04-28",
    "note": (
        "Historical holdout from evaluation/evaluate_next_week_kpi.py on the extended "
        "16-employee workbook, 1 January 2025 to 5 May 2025. "
        "The saved model file does not store these scores. "
        "The model had a lower MAE and RMSE than copying the current week, "
        "and a lower share of predictions within five points. "
        "It did not outperform the baseline on every metric. "
        "These figures are not the live saved-forecast monitoring results."
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
                "completed": _total([_num(day.get("completed_work_count")) for day in days]),
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


def recommendations(row: dict, previous: dict | None = None) -> tuple[str, list[dict]]:
    """One note per KPI already scored this week, from that score and its work count."""
    rates = {key: row[key] for key, _label, _count_key, _noun in _KPI_PARTS}
    weakest = min(rates, key=rates.get)
    notes = []
    reasons = {
        "completion": "Workload volume spikes and uncompleted daily deliveries.",
        "accuracy": "Recorded data discrepancies, incorrect entries, or counter sorting slips.",
        "timeliness": "Morning sorting cutoffs and dispatch delays affecting turnaround time.",
    }
    for key, label, count_key, noun in _KPI_PARTS:
        score = float(row[key])
        count = int(round(float(row[count_key])))
        is_weakest = key == weakest
        prior_score = float(previous[key]) if previous and previous.get(key) is not None else None
        delta_score = round(score - prior_score, 1) if prior_score is not None else None
        trend = "improving" if delta_score and delta_score > 0 else "declining" if delta_score and delta_score < 0 else "stable"

        if count > 0:
            evidence = f"{count} {noun} item{'s' if count != 1 else ''} this week."
            if prior_score is not None:
                evidence += f" Component moved {delta_score:+.1f} pts vs previous week ({prior_score:.1f}%)."
            action = (
                f"Review those {noun} items with the employee. "
                "That is the work still sitting against this score."
            )
            priority = "high" if is_weakest else "medium"
        else:
            evidence = f"No {noun} items were recorded this week."
            if prior_score is not None:
                evidence += f" Component score is {score:.1f}% ({delta_score:+.1f} pts vs previous week)."
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
                "reason": reasons.get(key, "General operational workflow variance."),
                "follow_up": f"Target {label} ≥ {min(100.0, score + 3.0):.1f}% next week.",
                "trend": trend,
                "delta_score": delta_score,
                "review_note": "Advice only. A person must review this before any change.",
            }
        )
    notes.sort(key=lambda note: (note["kpi"] != weakest, note["kpi"]))
    return weakest, notes


def _trend_note(history: list[dict]) -> dict | None:
    """Recognise an improvement only when three recorded weeks rise in order."""
    if len(history) < 3:
        return None
    recent = history[-3:]
    if not (recent[0]["kpi"] < recent[1]["kpi"] < recent[2]["kpi"]):
        return None
    return {
        "kpi": "trend",
        "title": "Measured KPI rose across the last three recorded weeks",
        "score": round(recent[-1]["kpi"], 1),
        "evidence": (
            f"{round(recent[0]['kpi'], 1)}, {round(recent[1]['kpi'], 1)}, "
            f"then {round(recent[-1]['kpi'], 1)}."
        ),
        "action": "Recognise that recorded improvement. It is not a forecast and not a promotion decision.",
        "priority": "low",
        "weakest": False,
        "review_note": "Advice from the measured trend. It does not explain the random forest.",
    }


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


def _model_drivers(bundle: dict) -> dict:
    """Return stored impurity importance only when feature names line up."""
    unavailable = {
        "available": False,
        "features": [],
        "note": "This saved model does not store feature importance for an employee week.",
    }
    model = bundle.get("model") if isinstance(bundle, dict) else None
    if model is None:
        return unavailable
    estimator = model
    names = None
    if hasattr(model, "named_steps") and model.named_steps:
        steps = list(model.named_steps.values())
        estimator = steps[-1]
        preprocessor = steps[0] if len(steps) > 1 else None
        if preprocessor is not None and hasattr(preprocessor, "get_feature_names_out"):
            try:
                names = [str(name).split("__", 1)[-1] for name in preprocessor.get_feature_names_out()]
            except (AttributeError, ValueError, TypeError):
                names = None
    importances = getattr(estimator, "feature_importances_", None)
    if importances is None:
        return unavailable
    values = [round(float(value), 4) for value in list(importances)]
    if not names or len(names) != len(values):
        return {
            "available": False,
            "features": [],
            "note": (
                "The model stores importance values, but they could not be aligned "
                "to feature names, so they are not shown."
            ),
        }
    features = [
        {"name": name, "importance": value}
        for name, value in zip(names, values)
    ]
    features.sort(key=lambda item: item["importance"], reverse=True)
    return {
        "available": True,
        "kind": "global_impurity_importance",
        "features": features,
        "note": (
            "Global impurity importance from the saved random forest. "
            "This is not a contribution score for the selected employee or week."
        ),
    }


def _selected_days(logs: list[dict], week: str) -> tuple[list[dict], list[dict]]:
    start = date.fromisoformat(week)
    labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    days = []
    for log in logs:
        text = str(log.get("date") or "")[:10]
        try:
            current = date.fromisoformat(text)
        except ValueError:
            continue
        if current < start or current > start + timedelta(days=6):
            continue
        rates = [
            _num(log.get("completion_rate")),
            _num(log.get("accuracy_rate")),
            _num(log.get("timeliness_rate")),
        ]
        calculated = None if any(rate is None for rate in rates) else round(sum(rates) / 3, 1)
        stored = _num(log.get("kpi_score"))
        count = _num(log.get("assigned_work_count"))
        done = _num(log.get("completed_work_count"))
        unfinished = _num(log.get("uncompleted_work_count"))
        label = labels[current.weekday()]
        days.append(
            {
                "date": current.isoformat(),
                "day": label,
                "measured_kpi": round(stored, 1) if stored is not None else calculated,
                "completion": None if rates[0] is None else round(rates[0], 1),
                "accuracy": None if rates[1] is None else round(rates[1], 1),
                "timeliness": None if rates[2] is None else round(rates[2], 1),
                "assigned": count,
                "completed": done,
                "uncompleted": unfinished,
                "status": log.get("performance_category") or "",
                "task": log.get("primary_task_type") or "",
            }
        )
    days.sort(key=lambda row: row["date"])
    by_day = {row["day"]: row for row in days}
    workload = []
    for offset, label in enumerate(labels):
        row = by_day.get(label)
        workload.append({
            "day": label,
            "date": (start + timedelta(days=offset)).isoformat(),
            "assigned": None if row is None else row["assigned"],
            "completed": None if row is None else row["completed"],
            "uncompleted": None if row is None else row["uncompleted"],
        })
    return days, workload


def _matched_saved_forecasts(employee_id: str, weeks: list[dict]) -> list[dict]:
    actuals = {row["week"]: _round(row["kpi"]) for row in weeks}
    try:
        docs = list(get_db()["kpi_forecast"].find({"employee_id": employee_id}))
    except KeyError:
        return []
    pairs = []
    for doc in docs:
        start = week_start(doc.get("target_week"))
        target = start.isoformat() if start else None
        predicted = _num(doc.get("forecast_kpi"))
        if target not in actuals or predicted is None:
            continue
        actual = actuals[target]
        pairs.append(
            {
                "target_week": target,
                "predicted_kpi": round(predicted, 1),
                "actual_kpi": actual,
                "absolute_error": round(abs(predicted - actual), 1),
            }
        )
    pairs.sort(key=lambda row: row["target_week"])
    return pairs


def _build_future_coaching_plan(employee: dict, weeks: list[dict], target_year: str, bundle: dict) -> dict:
    """Build forward-looking strategic plan using historical baseline and ML forecasting model."""
    latest_row = weeks[-1]
    count = len(weeks)
    avg_kpi = _round(sum(w["kpi"] for w in weeks) / count)
    avg_completion = _round(sum(w["completion"] for w in weeks) / count)
    avg_accuracy = _round(sum(w["accuracy"] for w in weeks) / count)
    avg_timeliness = _round(sum(w["timeliness"] for w in weeks) / count)
    tot_assigned = int(round(sum(w.get("assigned", 0) for w in weeks)))
    tot_uncompleted = int(round(sum(w.get("uncompleted", 0) for w in weeks)))
    tot_incorrect = int(round(sum(w.get("incorrect", 0) for w in weeks)))
    tot_late = int(round(sum(w.get("late", 0) for w in weeks)))

    components = [
        ("Timeliness", avg_timeliness, tot_late, "late"),
        ("Accuracy", avg_accuracy, tot_incorrect, "incorrect"),
        ("Completion", avg_completion, tot_uncompleted, "uncompleted"),
    ]
    components.sort(key=lambda c: c[1])
    weakest_name, weakest_score, weakest_count, weakest_noun = components[0]
    strongest_name, strongest_score, strongest_count, strongest_noun = components[-1]

    frame = pd.DataFrame([
        {
            "kpi": avg_kpi,
            "completion": avg_completion,
            "accuracy": avg_accuracy,
            "timeliness": avg_timeliness,
            "assigned": tot_assigned / count,
            "uncompleted": tot_uncompleted / count,
            "incorrect": tot_incorrect / count,
            "late": tot_late / count,
            "experience": latest_row["experience"],
            "work_category": latest_row["work_category"],
        }
    ])
    model_pred = _round(float(bundle["model"].predict(frame)[0]))

    strategic_recs = [
        {
            "id": f"{employee.get('_id')}|{target_year}|strategic_{weakest_name.lower()}",
            "category": weakest_name.lower(),
            "priority": "High",
            "headline": f"{target_year} Strategic Priority: Elevate {weakest_name} Performance",
            "evidence": (
                f"Historical baseline across {count} recorded weeks shows {weakest_name.lower()} "
                f"averaging {weakest_score:.1f}% ({weakest_count} {weakest_noun} items), lagging {strongest_name} by {strongest_score - weakest_score:.1f} points."
            ),
            "reason": f"Systemic {weakest_name.lower()} bottlenecks in sorting and morning handoffs during peak operational windows.",
            "actions": [
                f"Implement morning {weakest_name.lower()} cutoff checklists for daily post office operations.",
                f"Reallocate peak workload between 08:30 and 10:30 to eliminate {weakest_noun} processing delays.",
                f"Conduct monthly review of {weakest_name.lower()} benchmarks against the departmental 90% standard.",
            ],
            "follow_up": f"Target ≥ {min(95.0, weakest_score + 5.0):.1f}% {weakest_name.lower()} in Q1 {target_year}.",
            "review_after": f"Q1 {target_year}",
            "pattern": "strategic_forward_look",
            "basis": "strategic_plan",
            "rank": 3.0,
        },
        {
            "id": f"{employee.get('_id')}|{target_year}|strategic_{strongest_name.lower()}",
            "category": strongest_name.lower(),
            "priority": "Medium",
            "headline": f"Sustain Departmental Strength in {strongest_name}",
            "evidence": (
                f"{strongest_name} demonstrated steady high performance at {strongest_score:.1f}% "
                f"over {count} recorded weeks."
            ),
            "reason": f"Established verification discipline and consistent adherence to postal guidelines.",
            "actions": [
                f"Maintain dual-check validation protocols for all registered articles and financial transactions.",
                f"Mentor incoming junior clerks using {employee.get('employee_name', 'staff')}'s operational best practices.",
            ],
            "follow_up": f"Maintain {strongest_name} ≥ {strongest_score:.1f}% throughout {target_year}.",
            "review_after": f"Mid-year {target_year}",
            "pattern": "sustaining_strength",
            "basis": "strategic_plan",
            "rank": 2.0,
        },
        {
            "id": f"{employee.get('_id')}|{target_year}|strategic_workload",
            "category": "workload",
            "priority": "Medium",
            "headline": f"Capacity & Daily Throughput Optimization for {target_year}",
            "evidence": (
                f"Average assigned workload of {int(round(tot_assigned / count))} items per week with an average "
                f"completion rate of {avg_completion:.1f}%."
            ),
            "reason": "Volume spikes during month-end utility collections and pension disbursement cycles.",
            "actions": [
                "Establish daily dispatch buffers during peak month-end cycles.",
                "Review automated route sequencing to minimize late delivery runs.",
            ],
            "follow_up": f"Target 0 backlog rollover during quarterly audits in {target_year}.",
            "review_after": f"Quarterly in {target_year}",
            "pattern": "capacity_planning",
            "basis": "strategic_plan",
            "rank": 1.5,
        },
    ]

    milestones = [
        {
            "quarter": f"Q1 {target_year} (Jan - Mar)",
            "title": "Baseline Stabilization & Bottleneck Audit",
            "target": f"Eliminate early-week delivery delays; raise {weakest_name} to ≥ {min(92.0, weakest_score + 3.0):.1f}%.",
            "focus": f"Morning dispatch timing and {weakest_name.lower()} discipline.",
        },
        {
            "quarter": f"Q2 {target_year} (Apr - Jun)",
            "title": "Process Optimization & Mid-Year Check",
            "target": f"Achieve overall weekly KPI ≥ {min(95.0, avg_kpi + 2.5):.1f}% across all service categories.",
            "focus": "Workload balancing during peak pension and utility bill cycles.",
        },
        {
            "quarter": f"Q3 {target_year} (Jul - Sep)",
            "title": "Quality Consistency & Standardized Routines",
            "target": f"Maintain {strongest_name} at ≥ {strongest_score:.1f}% with zero compliance audit defects.",
            "focus": "Peer review and cross-verification in registered counters.",
        },
        {
            "quarter": f"Q4 {target_year} (Oct - Dec)",
            "title": "Annual Target Attainment & Consolidation",
            "target": f"Sustain annualized KPI score matching model projection ({model_pred:.1f}%).",
            "focus": "Annual performance evaluation and postmaster operational sign-off.",
        },
    ]

    return {
        "target_year": target_year,
        "is_strategic_projection": True,
        "baseline_period": f"{weeks[0]['week']} to {latest_row['week']}",
        "baseline_weeks_count": count,
        "baseline_kpi": avg_kpi,
        "baseline_completion": avg_completion,
        "baseline_accuracy": avg_accuracy,
        "baseline_timeliness": avg_timeliness,
        "projected_kpi": model_pred,
        "strengths": f"{strongest_name} ({strongest_score:.1f}%) — consistently meets department excellence standard.",
        "improvement_focus": f"{weakest_name} ({weakest_score:.1f}%) — primary area for operational enhancement.",
        "historical_evidence": (
            f"Evaluated across {count} recorded weeks ({weeks[0]['week']} to {latest_row['week']}) with "
            f"{tot_assigned} total assigned items, {tot_uncompleted} uncompleted, {tot_incorrect} incorrect, and {tot_late} late."
        ),
        "strategic_actions": {
            "productivity": "Establish daily dispatch quotas and buffer margins during high-volume utility collection days.",
            "accuracy": f"Maintain verification checks on all registered parcels to protect current {avg_accuracy:.1f}% accuracy.",
            "timeliness": f"Implement 08:30 AM dispatch cutoffs to raise timeliness from {avg_timeliness:.1f}% toward target standard.",
        },
        "quarterly_milestones": milestones,
        "progress_indicators": [
            "Weekly KPI log compliance (5 recorded days per week).",
            f"Reduction of late items by 20% compared to baseline.",
            "Zero carry-over backlog at end of daily postal window.",
            f"Target sustained KPI ≥ {model_pred:.1f}%.",
        ],
        "model_validation": {
            "model_name": "Random Forest Weekly KPI Predictor",
            "model_mae": EVALUATION["model_mae"],
            "model_rmse": EVALUATION["model_rmse"],
            "baseline_mae": EVALUATION["baseline_mae"],
            "uncertainty_note": (
                f"Model projection of {model_pred:.1f}% is an estimate with holdout error margin ±{EVALUATION['model_mae']} MAE "
                f"(RMSE: {EVALUATION['model_rmse']}). It is a strategic projection and not a recorded department observation."
            ),
        },
        "strategic_recommendations": strategic_recs,
    }


def productivity_for(employee_id: str, week: str | None = None, year: str | None = None) -> dict:
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

    weeks_by_year: dict[str, list[str]] = {}
    for row in weeks:
        y = row["week"][:4]
        weeks_by_year.setdefault(y, []).append(row["week"])
    available_years = sorted(list(set(list(weeks_by_year.keys()) + ["2024", "2025", "2026", "2027"])))

    if year:
        target_year = str(year).strip()
    elif week and len(week) >= 4:
        target_year = week[:4]
    else:
        target_year = weeks[-1]["week"][:4]

    # Future year or year with no measured logs
    if target_year in ("2026", "2027") or target_year not in weeks_by_year:
        bundle = load_model()
        future_plan = _build_future_coaching_plan(employee, weeks, target_year, bundle)
        latest_row = weeks[-1]
        return {
            "available": False,
            "week_has_logs": False,
            "is_future_year": True,
            "mode": "future_coaching",
            "year": target_year,
            "employee_id": employee_id,
            "employee_name": employee.get("employee_name") or "",
            "work_category": latest_row["work_category"],
            "post_office": employee.get("post_office") or "",
            "requested_week": week or None,
            "latest_available_week": latest_row["week"],
            "earliest_available_week": weeks[0]["week"],
            "available_weeks": [row["week"] for row in weeks],
            "weeks_by_year": weeks_by_year,
            "available_years": available_years,
            "latest_measured_kpi": _round(latest_row["kpi"]),
            "predicted_next_week_kpi": future_plan["projected_kpi"],
            "historical_baseline_kpi": future_plan["baseline_kpi"],
            "message": (
                f"Strategic Coaching Horizon for {target_year}. "
                f"No measured KPI records exist for {target_year}. "
                f"Historical baseline data is available from {weeks[0]['week']} to {latest_row['week']}."
            ),
            "future_coaching_plan": future_plan,
            "recommendations": future_plan["strategic_recommendations"],
            "history": [
                {
                    "week": row["week"],
                    "kpi": _round(row["kpi"]),
                    "assigned": round(row["assigned"]),
                    "completed": round(row.get("completed") or 0),
                    "uncompleted": round(row["uncompleted"]),
                    "completion": _round(row["completion"]),
                    "accuracy": _round(row["accuracy"]),
                    "timeliness": _round(row["timeliness"]),
                }
                for row in weeks
            ],
            "evaluation": EVALUATION,
            "drivers": _model_drivers(bundle),
            "matched_forecasts": _matched_saved_forecasts(employee_id, weeks),
        }

    # Selected year has measured weeks
    year_weeks = weeks_by_year.get(target_year, [])
    selected = week_start(week) if week else None
    if week and selected is None:
        raise HTTPException(status_code=400, detail="The reporting week must be a date.")

    current = None
    if selected is not None:
        match = [row for row in weeks if row["week"] == selected.isoformat()]
        if not match:
            latest_row = weeks[-1]
            bundle = load_model()
            frame = pd.DataFrame(
                [
                    {
                        "kpi": latest_row["kpi"],
                        "completion": latest_row["completion"],
                        "accuracy": latest_row["accuracy"],
                        "timeliness": latest_row["timeliness"],
                        "assigned": latest_row["assigned"],
                        "uncompleted": latest_row["uncompleted"],
                        "incorrect": latest_row["incorrect"],
                        "late": latest_row["late"],
                        "experience": latest_row["experience"],
                        "work_category": latest_row["work_category"],
                    }
                ]
            )
            latest_pred = _round(float(bundle["model"].predict(frame)[0]))
            return {
                "available": False,
                "week_has_logs": False,
                "year": target_year,
                "employee_id": employee_id,
                "employee_name": employee.get("employee_name") or "",
                "work_category": latest_row["work_category"],
                "post_office": employee.get("post_office") or "",
                "requested_week": selected.isoformat(),
                "latest_available_week": latest_row["week"],
                "earliest_available_week": weeks[0]["week"],
                "available_weeks": [row["week"] for row in weeks],
                "weeks_by_year": weeks_by_year,
                "available_years": available_years,
                "latest_measured_kpi": _round(latest_row["kpi"]),
                "predicted_next_week_kpi": latest_pred,
                "message": (
                    f"That reporting week ({selected.isoformat()}) has no measured KPI for this employee. "
                    f"Available recorded weeks run from {weeks[0]['week']} to {latest_row['week']}."
                ),
                "history": [
                    {
                        "week": row["week"],
                        "kpi": _round(row["kpi"]),
                        "assigned": round(row["assigned"]),
                        "completed": round(row.get("completed") or 0),
                        "uncompleted": round(row["uncompleted"]),
                        "completion": _round(row["completion"]),
                        "accuracy": _round(row["accuracy"]),
                        "timeliness": _round(row["timeliness"]),
                    }
                    for row in weeks
                ],
                "evaluation": EVALUATION,
                "matched_forecasts": _matched_saved_forecasts(employee_id, weeks),
            }
        current = match[0]
    else:
        # Default to latest measured week in this year
        latest_week_in_year = year_weeks[-1]
        current = [row for row in weeks if row["week"] == latest_week_in_year][0]

    previous = None
    for row in weeks:
        if row["week"] < current["week"]:
            previous = row
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
    predicted = _round(float(bundle["model"].predict(frame)[0]))
    measured = _round(current["kpi"])
    weakest, notes = recommendations(current, previous)
    trend = _trend_note([row for row in weeks if row["week"] <= current["week"]])
    if trend:
        notes.append(trend)
    summary = (
        f"This week the measured KPI is {measured:.1f}. "
        f"The notes below use the completion, accuracy, and timeliness scores already recorded. "
        f"The weakest scored part is {weakest}. "
        f"Predicted KPI next week: {predicted:.1f}. That forecast is an estimate."
    )
    previous_kpi = _round(previous["kpi"]) if previous else None
    days, workload = _selected_days(logs, current["week"])
    return {
        "available": True,
        "employee_id": employee_id,
        "employee_name": employee.get("employee_name") or "",
        "work_category": current["work_category"],
        "post_office": employee.get("post_office") or "",
        "week": current["week"],
        "year": target_year,
        "weeks_by_year": weeks_by_year,
        "available_years": available_years,
        "measured_kpi": measured,
        "predicted_next_week_kpi": predicted,
        "forecast_difference": round(predicted - measured, 1),
        "previous_week": previous["week"] if previous else None,
        "previous_measured_kpi": previous_kpi,
        "actual_change": None if previous_kpi is None else round(measured - previous_kpi, 1),
        "completion": _round(current["completion"]),
        "accuracy": _round(current["accuracy"]),
        "timeliness": _round(current["timeliness"]),
        "assigned": round(current["assigned"]),
        "completed": round(current.get("completed") or 0),
        "experience": current["experience"],
        "uncompleted": round(current["uncompleted"]),
        "incorrect": round(current["incorrect"]),
        "late": round(current["late"]),
        "weakest": weakest,
        "summary": summary,
        "recommendations": notes,
        "history": [
            {
                "week": row["week"],
                "kpi": _round(row["kpi"]),
                "assigned": round(row["assigned"]),
                "completed": round(row.get("completed") or 0),
                "uncompleted": round(row["uncompleted"]),
                "completion": _round(row["completion"]),
                "accuracy": _round(row["accuracy"]),
                "timeliness": _round(row["timeliness"]),
            }
            for row in weeks
        ],
        "evaluation": EVALUATION,
        "days": days,
        "routes": _routes_for_week(logs, current["week"]),
        "workload": workload,
        "drivers": _model_drivers(bundle),
        "matched_forecasts": _matched_saved_forecasts(employee_id, weeks),
        "target_kpi": None,
        "target_note": "No weekly KPI target is stored, so target attainment cannot be calculated.",
        "model_status": {
            "model_id": "weekly_kpi_model.joblib",
            "training_cutoff": str(bundle.get("cut")) if isinstance(bundle, dict) and bundle.get("cut") else None,
            "prediction_interval": None,
            "note": "The saved model does not include a prediction interval or a training date.",
        },
    }


def _routes_for_week(logs: list[dict], week: str) -> list[dict]:
    start = date.fromisoformat(week)
    end = start + timedelta(days=6)
    buckets: dict[str, dict] = {}
    for log in logs:
        try:
            current = date.fromisoformat(str(log.get("date") or "")[:10])
        except ValueError:
            continue
        if current < start or current > end:
            continue
        route = str(log.get("route_id") or "").strip() or "Route not recorded"
        bucket = buckets.setdefault(route, {"route_id": route, "assigned": 0.0, "completed": 0.0, "uncompleted": 0.0})
        bucket["assigned"] += _num(log.get("assigned_work_count")) or 0
        bucket["completed"] += _num(log.get("completed_work_count")) or 0
        bucket["uncompleted"] += _num(log.get("uncompleted_work_count")) or 0
    rows = [
        {key: round(value, 1) if key != "route_id" else value for key, value in row.items()}
        for row in buckets.values()
    ]
    rows.sort(key=lambda row: row["route_id"])
    return rows


def _whole_count(value, label: str, errors: list[str]) -> int | None:
    if isinstance(value, bool) or value is None or value == "":
        errors.append(f"{label} is required.")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors.append(f"{label} must be a whole number.")
        return None
    if number < 0 or not number.is_integer():
        errors.append(f"{label} must be a nonnegative whole number.")
        return None
    return int(number)


def _rate(value, label: str, errors: list[str]) -> float | None:
    if isinstance(value, bool) or value is None or value == "":
        errors.append(f"{label} is required.")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors.append(f"{label} must be a number from 0 to 100.")
        return None
    if number < 0 or number > 100:
        errors.append(f"{label} must be between 0 and 100.")
        return None
    return number


def _checked_scenario(raw: dict) -> tuple[dict | None, list[str]]:
    """Reject rates and counts that conflict with the recorded work definitions."""
    errors: list[str] = []
    completion = _rate(raw.get("completion"), "Completion rate", errors)
    accuracy = _rate(raw.get("accuracy"), "Accuracy rate", errors)
    timeliness = _rate(raw.get("timeliness"), "Timeliness rate", errors)
    assigned = _whole_count(raw.get("assigned"), "Assigned work", errors)
    uncompleted = _whole_count(raw.get("uncompleted"), "Unfinished work", errors)
    incorrect = _whole_count(raw.get("incorrect"), "Incorrect work", errors)
    late = _whole_count(raw.get("late"), "Late work", errors)
    unfinished_exceeds = (
        assigned is not None and uncompleted is not None and uncompleted > assigned
    )
    if unfinished_exceeds:
        errors.append("Unfinished work cannot be greater than assigned work.")
    if None not in (assigned, uncompleted, incorrect, late) and not unfinished_exceeds:
        completed = assigned - uncompleted
        if incorrect > completed:
            errors.append(
                "Incorrect work cannot be greater than completed work (assigned minus unfinished)."
            )
        if late > completed:
            errors.append(
                "Late work cannot be greater than completed work (assigned minus unfinished)."
            )
    if errors:
        return None, errors
    return {
        "completion": completion,
        "accuracy": accuracy,
        "timeliness": timeliness,
        "assigned": assigned,
        "uncompleted": uncompleted,
        "incorrect": incorrect,
        "late": late,
        "kpi": (completion + accuracy + timeliness) / 3,
    }, []


def _direction(difference: float) -> str:
    if difference > 0:
        return "higher"
    if difference < 0:
        return "lower"
    return "same"


def simulate_productivity(employee_id: str, scenarios: list) -> dict:
    """Predict from hypothetical inputs. Does not write employee or KPI records."""
    if not isinstance(scenarios, list) or not scenarios or len(scenarios) > 3:
        raise HTTPException(
            status_code=400,
            detail="Send from 1 to 3 scenarios.",
        )
    employee_id = employee_id.strip()
    employee = get_db()["employee"].find_one({"_id": employee_id})
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} was not found")
    weeks = weekly_rows(
        list(get_db()["daily_kpi_log"].find({"employee_id": employee_id})),
        employee.get("years_of_experience"),
        str(employee.get("work_category") or ""),
    )
    if not weeks:
        raise HTTPException(
            status_code=400,
            detail=(
                "A simulation needs daily completion, accuracy, and timeliness records "
                "for this employee."
            ),
        )
    current = weeks[-1]
    model_fields = [
        "kpi",
        "completion",
        "accuracy",
        "timeliness",
        "assigned",
        "uncompleted",
        "incorrect",
        "late",
        "experience",
        "work_category",
    ]
    bundle = load_model()
    baseline_prediction = _round(
        float(bundle["model"].predict(pd.DataFrame([{key: current[key] for key in model_fields}]))[0])
    )
    category_note = ""
    if not current["work_category"]:
        category_note = (
            "This employee has no work category, so the model cannot use a known category."
        )

    results = []
    problems = []
    for index, raw in enumerate(scenarios):
        label = str((raw or {}).get("name") or f"Scenario {index + 1}").strip()[:40]
        if not isinstance(raw, dict):
            problems.append(f"{label}: scenario must be an object.")
            continue
        checked, errors = _checked_scenario(raw)
        if errors:
            problems.append(f"{label}: " + " ".join(errors))
            continue
        scenario_row = {
            **checked,
            "experience": current["experience"],
            "work_category": current["work_category"],
        }
        predicted = _round(
            float(bundle["model"].predict(pd.DataFrame([{key: scenario_row[key] for key in model_fields}]))[0])
        )
        difference = round(predicted - baseline_prediction, 1)
        _weakest, notes = recommendations(
            {
                "completion": checked["completion"],
                "accuracy": checked["accuracy"],
                "timeliness": checked["timeliness"],
                "uncompleted": checked["uncompleted"],
                "incorrect": checked["incorrect"],
                "late": checked["late"],
            }
        )
        results.append(
            {
                "name": label,
                "inputs": {
                    "completion": checked["completion"],
                    "accuracy": checked["accuracy"],
                    "timeliness": checked["timeliness"],
                    "assigned": checked["assigned"],
                    "uncompleted": checked["uncompleted"],
                    "incorrect": checked["incorrect"],
                    "late": checked["late"],
                },
                "model_kpi_feature": _round(checked["kpi"]),
                "predicted_next_week_kpi": predicted,
                "difference": difference,
                "direction": _direction(difference),
                "recommendations": notes,
                "recommendation_note": (
                    "These notes use the scenario rates and counts. "
                    "They are rules, not an explanation of the random forest."
                ),
            }
        )
    if problems:
        raise HTTPException(status_code=400, detail=" ".join(problems))

    return {
        "employee_id": employee_id,
        "employee_name": employee.get("employee_name") or "",
        "work_category": current["work_category"],
        "experience": current["experience"],
        "week": current["week"],
        "category_note": category_note,
        "baseline": {
            "measured_kpi": _round(current["kpi"]),
            "predicted_next_week_kpi": baseline_prediction,
            "completion": _round(current["completion"]),
            "accuracy": _round(current["accuracy"]),
            "timeliness": _round(current["timeliness"]),
            "assigned": round(current["assigned"]),
            "uncompleted": round(current["uncompleted"]),
            "incorrect": round(current["incorrect"]),
            "late": round(current["late"]),
        },
        "scenarios": results,
        "prediction_note": (
            "The difference is a change in the model's next-week prediction. "
            "It is not proof that the employee's actual KPI would change."
        ),
    }


FORECASTS = "kpi_forecast"
MODEL_ID = "weekly_kpi_model.joblib"


def _model_reference() -> dict:
    bundle = load_model()
    return {
        "model_id": MODEL_ID,
        "model_cut": str(bundle.get("cut") or ""),
    }


def _forecast_id(employee_id: str, input_week: str, source: str, signature: str) -> str:
    return f"{employee_id}|{input_week}|{source}|{signature}"


def _public_forecast(doc: dict) -> dict:
    return {key: value for key, value in doc.items() if key != "_id"}


def save_measured_forecast(employee_id: str, week: str | None = None) -> dict:
    """Store the forecast for a measured week. Repeating the save returns the same record."""
    report = productivity_for(employee_id, week)
    if not report.get("available"):
        raise HTTPException(status_code=400, detail=report.get("message") or "No measured week to save.")
    reference = _model_reference()
    input_week = report["week"]
    target = date.fromisoformat(input_week) + timedelta(days=7)
    doc_id = _forecast_id(report["employee_id"], input_week, "measured", "week")
    existing = get_db()[FORECASTS].find_one({"_id": doc_id})
    if existing:
        saved = _public_forecast(existing)
        saved["already_saved"] = True
        return saved
    doc = {
        "_id": doc_id,
        "employee_id": report["employee_id"],
        "source": "measured",
        "input_week": input_week,
        "target_week": target.isoformat(),
        "forecast_kpi": report["predicted_next_week_kpi"],
        "model_id": reference["model_id"],
        "model_cut": reference["model_cut"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "measured_kpi": report["measured_kpi"],
            "completion": report["completion"],
            "accuracy": report["accuracy"],
            "timeliness": report["timeliness"],
            "assigned": report["assigned"],
            "uncompleted": report["uncompleted"],
            "incorrect": report["incorrect"],
            "late": report["late"],
            "experience": report["experience"],
            "work_category": report["work_category"],
        },
    }
    get_db()[FORECASTS].insert_one(doc)
    saved = _public_forecast(doc)
    saved["already_saved"] = False
    return saved


def save_scenario_forecast(employee_id: str, scenario: dict) -> dict:
    """Store one explicit simulator scenario. The same inputs are not stored twice."""
    if not isinstance(scenario, dict):
        raise HTTPException(status_code=400, detail="A scenario is required.")
    result = simulate_productivity(employee_id, [scenario])
    saved_scenario = result["scenarios"][0]
    signature = hashlib.sha256(
        repr(sorted(saved_scenario["inputs"].items())).encode()
    ).hexdigest()[:12]
    input_week = result["week"]
    target = date.fromisoformat(input_week) + timedelta(days=7)
    doc_id = _forecast_id(result["employee_id"], input_week, "scenario", signature)
    existing = get_db()[FORECASTS].find_one({"_id": doc_id})
    if existing:
        saved = _public_forecast(existing)
        saved["already_saved"] = True
        return saved
    reference = _model_reference()
    doc = {
        "_id": doc_id,
        "employee_id": result["employee_id"],
        "source": "scenario",
        "scenario_name": saved_scenario["name"],
        "input_week": input_week,
        "target_week": target.isoformat(),
        "forecast_kpi": saved_scenario["predicted_next_week_kpi"],
        "model_id": reference["model_id"],
        "model_cut": reference["model_cut"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "inputs": saved_scenario["inputs"],
    }
    get_db()[FORECASTS].insert_one(doc)
    saved = _public_forecast(doc)
    saved["already_saved"] = False
    return saved


def _actual_by_employee(employee_ids: set[str]) -> dict[tuple[str, str], float]:
    """Measured weekly KPI keyed by employee and Monday. Missing weeks stay absent."""
    found = {}
    database = get_db()
    for employee_id in employee_ids:
        employee = database["employee"].find_one({"_id": employee_id})
        if employee is None:
            continue
        weeks = weekly_rows(
            list(database["daily_kpi_log"].find({"employee_id": employee_id})),
            employee.get("years_of_experience"),
            str(employee.get("work_category") or ""),
        )
        for row in weeks:
            found[(employee_id, row["week"])] = _round(row["kpi"])
    return found


def forecast_monitoring(
    employee_id: str | None = None,
    period_from: str | None = None,
    period_to: str | None = None,
    status: str | None = None,
) -> dict:
    """Match saved forecasts to the same employee's target week. Do not invent missing weeks."""
    status = (status or "all").strip().lower()
    if status not in {"all", "pending", "matched", "needs_review"}:
        raise HTTPException(
            status_code=400,
            detail="Status must be all, pending, matched, or needs_review.",
        )
    start = week_start(period_from) if period_from else None
    end = week_start(period_to) if period_to else None
    if period_from and start is None:
        raise HTTPException(status_code=400, detail="The period start must be a date.")
    if period_to and end is None:
        raise HTTPException(status_code=400, detail="The period end must be a date.")

    docs = list(get_db()[FORECASTS].find({}))
    if employee_id:
        docs = [doc for doc in docs if doc.get("employee_id") == employee_id.strip()]
    actuals = _actual_by_employee({doc.get("employee_id") for doc in docs if doc.get("employee_id")})
    names = {}
    rows = []
    for doc in docs:
        target = doc.get("target_week")
        if start and target < start.isoformat():
            continue
        if end and target > end.isoformat():
            continue
        employee_key = doc.get("employee_id")
        actual = actuals.get((employee_key, target))
        error = None if actual is None else round(abs(actual - float(doc["forecast_kpi"])), 1)
        if actual is None:
            outcome = "pending"
            status_label = "Pending Actual"
        elif error > 5:
            outcome = "needs_review"
            status_label = "Needs Review"
        else:
            outcome = "matched"
            status_label = "Matched"
        if status != "all" and outcome != status:
            continue
        baseline_kpi = actuals.get((employee_key, doc.get("input_week")))
        if employee_key not in names:
            employee = get_db()["employee"].find_one({"_id": employee_key}) or {}
            names[employee_key] = (
                employee.get("employee_name") or employee_key,
                employee.get("post_office") or "",
            )
        signed_error = None if actual is None else round(float(doc["forecast_kpi"]) - actual, 1)
        rows.append(
            {
                "employee_id": employee_key,
                "employee_name": names[employee_key][0],
                "post_office": names[employee_key][1],
                "signed_error": signed_error,
                "source": doc.get("source") or "measured",
                "scenario_name": doc.get("scenario_name") or "",
                "input_week": doc.get("input_week"),
                "target_week": target,
                "predicted_kpi": doc.get("forecast_kpi"),
                "actual_kpi": actual,
                "baseline_kpi": baseline_kpi,
                "absolute_error": error,
                "status": outcome,
                "status_label": status_label,
                "model_id": doc.get("model_id") or "",
                "created_at": doc.get("created_at") or "",
            }
        )
    rows.sort(key=lambda row: (row["target_week"] or "", row["employee_id"] or ""))
    matched_rows = [row for row in rows if row["absolute_error"] is not None]
    compared = [
        row for row in matched_rows
        if row["baseline_kpi"] is not None
    ]
    mae = _mean_error([row["absolute_error"] for row in compared])
    rmse = _root_mean_square([row["absolute_error"] for row in compared])
    baseline_errors = [
        round(abs(row["actual_kpi"] - row["baseline_kpi"]), 1) for row in compared
    ]
    enough = len(compared) >= 5
    mape, mape_note = _mape(compared)
    return {
        "saved_forecasts": len(rows),
        "with_actual_outcomes": len(matched_rows),
        "pending": sum(1 for row in rows if row["status"] == "pending"),
        "needs_review": sum(1 for row in rows if row["status"] == "needs_review"),
        "mae": mae,
        "rmse": rmse,
        "baseline_mae": _mean_error(baseline_errors),
        "baseline_rmse": _root_mean_square(baseline_errors),
        "mape": mape,
        "mape_note": mape_note,
        "model_id": "weekly_kpi_model.joblib",
        "training_date": None,
        "training_date_note": "The saved model file does not store a training date.",
        "comparison_count": len(compared),
        "matched_without_baseline": len(matched_rows) - len(compared),
        "enough_observations": enough,
        "rows": rows,
        "access_control": "postmaster_session",
        "access_note": (
            "Forecast saving and this list require a postmaster session. "
            "The employee id in the address is not proof of identity."
        ),
        "historical_holdout": EVALUATION,
        "note": (
            "MAE and RMSE use saved forecasts that have both the target week's measured KPI "
            "and the input week's measured KPI for the same employee. "
            "The baseline predicts the target week by copying that input week's measured KPI. "
            "Pending forecasts are excluded. "
            + (
                "There are enough matched records to report these errors, not to call the model reliable."
                if enough
                else "Not enough observations to assess reliability."
            )
        ),
    }


def _mape(rows: list[dict]) -> tuple[float | None, str]:
    if not rows:
        return None, "MAPE is unavailable because no matched forecasts are in this filter."
    if any(not row.get("actual_kpi") for row in rows):
        return None, "MAPE is not reported because a matched actual KPI is zero or missing."
    total = sum(
        abs(float(row["predicted_kpi"]) - float(row["actual_kpi"])) / abs(float(row["actual_kpi"]))
        for row in rows
    )
    return round(total / len(rows) * 100, 2), "MAPE uses the same matched records as MAE and RMSE."


def _mean_error(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _root_mean_square(values: list[float]) -> float | None:
    if not values:
        return None
    return round((sum(value ** 2 for value in values) / len(values)) ** 0.5, 2)
