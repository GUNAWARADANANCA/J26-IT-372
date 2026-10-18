"""Evidence-based coaching notes. This is not the weekly KPI forecast model.

Ranking constants below are exploratory relative weights. They are not
statistically validated operational thresholds.
"""

from datetime import datetime, timezone

from fastapi import HTTPException

from db import get_db
from productivity import productivity_for

PARTS = (
    ("timeliness", "Timeliness", "late", "workflow and timing"),
    ("accuracy", "Accuracy", "incorrect", "checking the recorded items"),
    ("completion", "Completion", "uncompleted", "unfinished work and dependencies"),
)
NOTICE = (
    "Recommendations are suggestions based on recorded KPI data. "
    "They are not promotion, pay, or disciplinary decisions. "
    "Review the evidence and consider operational context before taking action."
)
FOLLOWUP_STATUSES = {
    "Suggested",
    "Accepted for follow-up",
    "In progress",
    "Reviewed",
    "Completed",
    "Not applicable",
}
# Exploratory only. Gap is measured in recorded score points versus the
# employee's best available component this week.
EXPLORATORY_WEIGHTS = {"gap": 1.0, "related_items": 0.4, "not_improved": 2.0}


def _coverage(history: list) -> str:
    count = len([row for row in history or [] if row.get("week")])
    if count >= 4:
        return "Supported by multiple recorded weeks"
    if count >= 2:
        return "Based on current-week records"
    return "Limited history"


def _pattern(score: float, prior) -> str:
    if prior is None:
        return "uncertain"
    if float(score) > float(prior):
        return "improving"
    if float(score) < float(prior):
        return "new"
    return "recurring"


def build_plan(report: dict, followups: list | None = None) -> dict:
    followups = followups or []
    if not report.get("available"):
        history = report.get("history") or []
        hist_recs = []
        if history:
            latest = history[-1]
            # Build historical recommendation from the employee's latest recorded week
            parts_scores = [
                ("timeliness", "Timeliness", latest.get("timeliness")),
                ("accuracy", "Accuracy", latest.get("accuracy")),
                ("completion", "Completion", latest.get("completion")),
            ]
            valid_parts = [(k, lbl, val) for k, lbl, val in parts_scores if val is not None]
            if valid_parts:
                weak_k, weak_lbl, weak_val = min(valid_parts, key=lambda x: float(x[2]))
                hist_recs.append({
                    "id": f"{report.get('employee_id')}|{latest.get('week')}|historical_{weak_k}",
                    "category": weak_k,
                    "headline": f"Historical Focus: Review {weak_lbl} (from week of {latest.get('week')})",
                    "evidence": f"In the latest recorded week ({latest.get('week')}), {weak_lbl.lower()} was {float(weak_val):.1f}% with an overall KPI of {latest.get('kpi')}%.",
                    "explanation": "Current-week recommendations cannot be generated because the selected week has no daily KPI logs. This suggestion is based on the employee's historical records.",
                    "why_prioritized": f"Lowest component in the most recent available week ({latest.get('week')}).",
                    "actions": [
                        f"Switch to week {latest.get('week')} to inspect full daily breakdowns.",
                        f"Monitor {weak_lbl.lower()} when new daily logs are recorded.",
                    ],
                    "follow_up": "Select an active week with logs for current-week coaching.",
                    "review_after": "next recorded week",
                    "pattern": "historical",
                    "rank": 1.0,
                    "coverage": _coverage(history),
                    "basis": "historical",
                })
        return {
            "available": False,
            "notice": NOTICE,
            "employee_id": report.get("employee_id"),
            "employee_name": report.get("employee_name"),
            "requested_week": report.get("requested_week"),
            "latest_available_week": report.get("latest_available_week"),
            "earliest_available_week": report.get("earliest_available_week"),
            "available_weeks": report.get("available_weeks") or [],
            "message": report.get("message") or "No measured week is available for coaching.",
            "current_week_note": "Recommendations requiring current-week daily logs cannot be generated for the selected week.",
            "recommendations": hist_recs,
            "coverage": _coverage(history),
            "writes": False,
        }
    history = [row for row in report.get("history") or [] if row.get("week", "") <= report.get("week", "")]
    previous = history[-2] if len(history) > 1 else None
    scores = {key: report.get(key) for key, *_rest in PARTS if report.get(key) is not None}
    best = max(scores.values()) if scores else None
    candidates = []
    for key, label, count_key, action_theme in PARTS:
        score = scores.get(key)
        if score is None:
            continue
        count = report.get(count_key)
        count_value = None if count is None else int(round(float(count)))
        prior = None if previous is None else previous.get(key)
        pattern = _pattern(float(score), prior)
        gap = 0 if best is None else float(best) - float(score)
        rank = (
            EXPLORATORY_WEIGHTS["gap"] * gap
            + (EXPLORATORY_WEIGHTS["related_items"] * min(count_value or 0, 10))
            + (EXPLORATORY_WEIGHTS["not_improved"] if pattern in {"recurring", "new"} else 0)
        )
        same = [
            row for row in followups
            if row.get("category") == key and str(row.get("week") or "") < str(report.get("week") or "")
        ]
        if same and pattern == "improving":
            headline = f"Check whether the earlier {label.lower()} follow-up still fits"
            rank = max(0, rank - EXPLORATORY_WEIGHTS["not_improved"])
        else:
            headline = f"Review {label.lower()} through {action_theme}"
        evidence = {
            "week": report.get("week"),
            "metric": key,
            "score": float(score),
            "related_count": count_value,
            "prior_score": None if prior is None else float(prior),
            "pattern": pattern,
        }
        text = f"{float(score):.1f} recorded {label.lower()} score"
        if count_value:
            text += f" and {count_value} related recorded items"
        text += f" in the week of {report.get('week')}."
        candidates.append(
            {
                "id": f"{report.get('employee_id')}|{report.get('week')}|{key}",
                "category": key,
                "headline": headline,
                "evidence": text,
                "evidence_fields": evidence,
                "explanation": (
                    f"{label} is {float(score):.1f} for the week of {report.get('week')}. "
                    "The rank compares this score with the employee's other recorded components "
                    "and, when present, the previous recorded week. "
                    "The weights are exploratory, not a validated benchmark."
                ),
                "why_prioritized": "",
                "actions": [
                    "Review the affected daily records with the employee.",
                    f"Look for recorded {action_theme} issues in this week.",
                    "Agree on one practical check for the next measured week.",
                ],
                "follow_up": (
                    f"Compare the next measured {label.lower()} score"
                    + (f" and the related item count" if count_value is not None else "")
                    + " with this week."
                ),
                "review_after": "the next measured week",
                "pattern": pattern,
                "rank": round(rank, 2),
                "coverage": _coverage(history),
            }
        )
    assigned = report.get("assigned")
    unfinished = report.get("uncompleted")
    if assigned and unfinished is not None and float(assigned) > 0 and float(unfinished) >= float(assigned) * 0.25:
        candidates.append(
            {
                "id": f"{report.get('employee_id')}|{report.get('week')}|workload",
                "category": "workload",
                "headline": "Review unfinished items against the recorded assigned workload",
                "evidence": (
                    f"{int(round(float(unfinished)))} unfinished items and "
                    f"{int(round(float(assigned)))} assigned items in the week of {report.get('week')}."
                ),
                "evidence_fields": {
                    "week": report.get("week"),
                    "metric": "workload",
                    "unfinished": float(unfinished),
                    "assigned": float(assigned),
                    "pattern": "current week",
                },
                "explanation": (
                    "Unfinished items are at least a quarter of the recorded assigned work. "
                    "That comparison is exploratory. It does not show what caused the unfinished work."
                ),
                "why_prioritized": "Recorded unfinished work is large relative to assigned work this week.",
                "actions": [
                    "Review the unfinished records and any recorded dependencies.",
                    "Agree which items can be finished in the next measured week.",
                ],
                "follow_up": "Compare the next measured unfinished count with this week.",
                "review_after": "the next measured week",
                "pattern": "current week",
                "rank": round(EXPLORATORY_WEIGHTS["related_items"] * min(float(unfinished), 10), 2),
                "coverage": _coverage(history),
            }
        )
    coverage = _coverage(history)
    limitation = ""
    if coverage == "Limited history":
        limitation = "History is too short to separate a one-week result from a repeated pattern. This is an initial plan from the selected week."
    if not candidates:
        return {
            "available": True,
            "notice": NOTICE,
            "employee_id": report.get("employee_id"),
            "employee_name": report.get("employee_name"),
            "week": report.get("week"),
            "measured_kpi": report.get("measured_kpi"),
            "predicted_next_week_kpi": report.get("predicted_next_week_kpi"),
            "forecast_note": "The next-week figure is a forecast estimate, not a recorded result.",
            "coverage": coverage,
            "message": limitation or "Component scores are missing, so no recommendation is ranked.",
            "recommendations": [],
            "writes": False,
        }
    weakest = min(
        (item for item in candidates if item["category"] in scores),
        key=lambda item: scores[item["category"]],
        default=candidates[0],
    )
    for item in candidates:
        if item["category"] == weakest["category"]:
            item["why_prioritized"] = "This is the lowest recorded component this week."
        elif not item["why_prioritized"]:
            item["why_prioritized"] = "This is a smaller recorded gap than the main component."
    ranked = sorted(candidates, key=lambda item: item["rank"], reverse=True)
    prior_kpis = [row.get("kpi") for row in history[:-1] if row.get("kpi") is not None]
    if prior_kpis and report.get("measured_kpi") is not None and float(report["measured_kpi"]) > float(prior_kpis[-1]):
        ranked.append(
            {
                "id": f"{report.get('employee_id')}|{report.get('week')}|maintain",
                "category": "maintain",
                "headline": "Keep the practices that coincide with the recent recorded improvement",
                "evidence": (
                    f"Measured KPI {float(report['measured_kpi']):.1f} is above the previous recorded week "
                    f"({float(prior_kpis[-1]):.1f})."
                ),
                "evidence_fields": {
                    "week": report.get("week"),
                    "metric": "kpi",
                    "score": float(report["measured_kpi"]),
                    "prior_score": float(prior_kpis[-1]),
                    "pattern": "improving",
                },
                "explanation": "The measured weekly KPI is higher than the previous recorded week. That is a comparison, not a cause.",
                "why_prioritized": "The recent recorded week is higher than the previous one.",
                "actions": ["Note which recorded checks stayed in place.", "Review the same measured KPI next week."],
                "follow_up": "Compare the next measured weekly KPI with this week.",
                "review_after": "the next measured week",
                "pattern": "improving",
                "rank": 0.5,
                "coverage": coverage,
            }
        )
        ranked = sorted(ranked, key=lambda item: item["rank"], reverse=True)
    return {
        "available": True,
        "notice": NOTICE,
        "employee_id": report.get("employee_id"),
        "employee_name": report.get("employee_name"),
        "week": report.get("week"),
        "measured_kpi": report.get("measured_kpi"),
        "historical_comparison": (
            None
            if not prior_kpis
            else round(float(report.get("measured_kpi") or 0) - float(prior_kpis[-1]), 1)
            if report.get("measured_kpi") is not None
            else None
        ),
        "predicted_next_week_kpi": report.get("predicted_next_week_kpi"),
        "forecast_note": "The next-week figure is a forecast estimate, not a recorded result and not a promised effect of these suggestions.",
        "main_opportunity": weakest["category"],
        "coverage": coverage,
        "message": limitation,
        "recommendations": ranked[:3],
        "ranking": "exploratory relative comparison",
        "writes": False,
    }


def _prior_followups(employee_id: str) -> list:
    try:
        return list(get_db()["kpi_coach_followup"].find({"employee_id": employee_id}, {"_id": 0}))
    except Exception:
        return []


def coach_for(employee_id: str, week: str | None = None) -> dict:
    return build_plan(productivity_for(employee_id, week), _prior_followups(employee_id))


def answer(employee_id: str, week: str | None, question: str) -> dict:
    plan = coach_for(employee_id, week)
    text = (question or "").strip().lower()
    report_week = plan.get("week")
    if not plan.get("available"):
        reply = plan.get("message")
    elif "missing" in text or "information" in text:
        reply = (
            f"Coverage: {plan.get('coverage')}. "
            "Absent component scores are omitted rather than treated as zero. "
            f"{plan.get('message') or ''}"
        ).strip()
    elif "previous" in text or "compare" in text:
        reply = (
            f"This plan uses the week of {report_week} for {plan.get('employee_id')}. "
            f"Change versus the previous recorded week: {plan.get('historical_comparison')}. "
            f"{plan.get('coverage')}."
        )
    elif "forecast" in text or "next week" in text or "focus" in text:
        top = (plan.get("recommendations") or [{}])[0]
        reply = (
            f"The measured KPI for {report_week} is {plan.get('measured_kpi')}. "
            f"The model estimate for the following week is {plan.get('predicted_next_week_kpi')}. "
            "That estimate is not a recorded result. "
            f"A practical focus is: {top.get('headline') or 'review the recorded component scores'}."
        )
    elif "unfinished" in text:
        reply = "Use the unfinished-item count on the selected week. Do not treat a missing count as zero."
        for item in plan.get("recommendations") or []:
            if item["category"] in {"completion", "workload"}:
                reply = f"{item['evidence']} {item['follow_up']}"
                break
    elif "improved" in text:
        reply = f"Recorded change versus the previous week is {plan.get('historical_comparison')} KPI points. A positive number means the measured weekly KPI is higher."
    elif "plan" in text or "priority" in text or "why" in text or plan.get("recommendations"):
        top = (plan.get("recommendations") or [None])[0]
        if not top:
            reply = plan.get("message") or "No ranked recommendation is available for this week."
        else:
            reply = f"{top['headline']} {top['evidence']} {top['why_prioritized']} {top['follow_up']}"
    else:
        reply = plan.get("message") or "No ranked recommendation is available for this week."
    return {
        "employee_id": employee_id,
        "week": report_week,
        "reply": reply,
        "notice": NOTICE,
    }


def save_follow_up(employee_id: str, body: dict) -> dict:
    recommendation_id = str((body or {}).get("recommendation_id") or "").strip()
    status = str((body or {}).get("status") or "Accepted for follow-up").strip()
    if status not in FOLLOWUP_STATUSES:
        raise HTTPException(status_code=400, detail="That follow-up status is not recognised.")
    if not recommendation_id.startswith(f"{employee_id}|"):
        raise HTTPException(status_code=400, detail="The recommendation does not belong to this employee.")
    parts = recommendation_id.split("|")
    now = datetime.now(timezone.utc).isoformat()
    existing = get_db()["kpi_coach_followup"].find_one({"recommendation_id": recommendation_id}) or {}
    doc = {
        "recommendation_id": recommendation_id,
        "employee_id": employee_id,
        "week": parts[1] if len(parts) > 1 else "",
        "category": parts[2] if len(parts) > 2 else "",
        "evidence": (body or {}).get("evidence") if isinstance((body or {}).get("evidence"), dict) else {},
        "suggested_action": str((body or {}).get("suggested_action") or existing.get("suggested_action") or "")[:300],
        "status": status,
        "feedback": str((body or {}).get("feedback") or "")[:500],
        "useful": (body or {}).get("useful") if (body or {}).get("useful") in {True, False, None} else None,
        "created_at": existing.get("created_at") or now,
        "updated_at": now,
        "reviewed_at": now if status in {"Reviewed", "Completed", "Not applicable"} else existing.get("reviewed_at"),
    }
    get_db()["kpi_coach_followup"].replace_one({"recommendation_id": recommendation_id}, doc, upsert=True)
    doc["effect_on_kpi"] = "none"
    return doc


def coach_activity() -> dict:
    rows = list(get_db()["kpi_coach_followup"].find({}, {"_id": 0, "employee_id": 1, "status": 1, "useful": 1, "category": 1}))
    reviewed = {"Reviewed", "Completed", "Not applicable"}
    return {
        "follow_ups_recorded": len(rows),
        "reviewed": sum(1 for row in rows if row.get("status") in reviewed),
        "marked_useful": sum(1 for row in rows if row.get("useful") is True),
        "note": "These figures describe recorded follow-up choices. They do not show that a suggestion caused a KPI change.",
    }
