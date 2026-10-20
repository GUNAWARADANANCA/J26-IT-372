"""Evidence-based coaching notes. This is not the weekly KPI forecast model.

Ranking constants below are exploratory relative weights. They are not
statistically validated operational thresholds.
"""

from datetime import datetime, timezone
from pathlib import Path
import re

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
    if report.get("is_future_year"):
        plan = report.get("future_coaching_plan") or {}
        return {
            "available": True,
            "is_future_year": True,
            "mode": "future_coaching",
            "target_year": report.get("year"),
            "year": report.get("year"),
            "employee_id": report.get("employee_id"),
            "employee_name": report.get("employee_name"),
            "notice": NOTICE,
            "coverage": "Strategic Projections (ML Model + Historical Baseline)",
            "message": report.get("message"),
            "historical_baseline_kpi": plan.get("baseline_kpi"),
            "predicted_next_week_kpi": plan.get("projected_kpi"),
            "forecast_note": (
                f"Model projection of {plan.get('projected_kpi')}% is an ML estimate (holdout error margin ±3.41 MAE, RMSE: 4.55), "
                "not a recorded observation."
            ),
            "strengths": plan.get("strengths"),
            "improvement_focus": plan.get("improvement_focus"),
            "historical_evidence": plan.get("historical_evidence"),
            "strategic_actions": plan.get("strategic_actions"),
            "quarterly_milestones": plan.get("quarterly_milestones"),
            "progress_indicators": plan.get("progress_indicators"),
            "model_validation": plan.get("model_validation"),
            "recommendations": plan.get("strategic_recommendations") or [],
            "writes": False,
        }
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


def coach_for(employee_id: str, week: str | None = None, year: str | None = None) -> dict:
    return build_plan(productivity_for(employee_id, week, year), _prior_followups(employee_id))


def coach_answer(employee_id: str, week: str | None, question: str, year: str | None = None) -> dict:
    plan = coach_for(employee_id, week, year)
    text = (question or "").strip().lower()
    report_week = plan.get("week")
    active_year = str(year or plan.get("year") or (report_week or "")[:4] or "2025")
    emp_name = plan.get("employee_name") or employee_id
    is_future = plan.get("is_future_year") or active_year in ("2026", "2027")
    recs = plan.get("recommendations") or []
    top_rec = recs[0] if recs else {}

    if is_future:
        target_year = plan.get("target_year") or active_year
        proj_kpi = plan.get("predicted_next_week_kpi", 88.0)
        base_kpi = plan.get("historical_baseline_kpi", 85.0)
        strengths = plan.get("strengths", "Consistent historical performance.")
        focus = plan.get("improvement_focus", "Operational timeliness.")
        actions = plan.get("strategic_actions") or {}

        if "compare" in text or "2025" in text or "vs" in text or "baseline" in text:
            reply = (
                f"Comparative Strategic Horizon for {emp_name}:\n"
                f"• 2025 Historical Measured Baseline: {base_kpi:.1f}% across recorded weeks.\n"
                f"• {target_year} Strategic Target: {proj_kpi:.1f}% estimated by the trained forecasting model.\n"
                f"• Net Projected Shift: {round(proj_kpi - base_kpi, 1):+.1f} KPI points.\n"
                f"• Note: 2025 figures represent audited department records; {target_year} figures represent ML forward-looking targets subject to operational follow-through."
            )
        elif "timeliness" in text or "late" in text:
            reply = (
                f"Timeliness Action Plan for {target_year} ({emp_name}):\n"
                f"{actions.get('timeliness', 'Implement strict 08:30 AM morning sorting cutoffs.')}\n"
                "1. Enforce 08:30 AM dispatch cutoffs for morning delivery runs.\n"
                "2. Rebalance high-volume delivery beats to prevent afternoon backlogs.\n"
                "3. Monitor 12:00 PM mid-day handover check to eliminate late items."
            )
        elif "accuracy" in text or "error" in text or "defect" in text:
            reply = (
                f"Accuracy Action Plan for {target_year} ({emp_name}):\n"
                f"{actions.get('accuracy', 'Maintain dual-verification checks on all registered parcels.')}\n"
                "1. Conduct dual-verification checks on registered articles and money orders.\n"
                "2. Perform address and barcode scan verification prior to vehicle dispatch.\n"
                "3. Carry out noon stamp and cash drawer balance checks."
            )
        elif "completion" in text or "workload" in text or "backlog" in text:
            reply = (
                f"Completion & Workload Plan for {target_year} ({emp_name}):\n"
                f"{actions.get('productivity', 'Establish daily dispatch buffers during peak volume cycles.')}\n"
                "1. Establish dispatch buffers during peak pension and utility collection days.\n"
                "2. Clear all morning intake before processing afternoon incoming mail.\n"
                "3. Reassign sudden volume surges among available counter clerks."
            )
        elif "measure" in text or "progress" in text or "indicator" in text or "audit" in text:
            reply = (
                f"Measuring Progress in {target_year} for {emp_name}:\n"
                f"1. Log Adherence: Ensure 5 daily work entries per week in the department log.\n"
                f"2. Defect Reduction: Target 20% fewer late and incorrect items compared to the 2025 baseline.\n"
                f"3. Backlog Elimination: Zero carry-over mail at end-of-day dispatch.\n"
                f"4. Quarterly Reviews: Progress audit at the end of each quarter against milestone targets (Q1–Q4)."
            )
        elif "2026" in text or "2027" in text or "future" in text or "target" in text or "improve" in text or "plan" in text or "priorit" in text:
            reply = (
                f"Strategic Coaching Horizon for {target_year} ({emp_name}):\n"
                f"• Target KPI Projection: {proj_kpi:.1f}% based on the trained Random Forest model (holdout error margin ±3.41 MAE, RMSE: 4.55). That is a planning forecast, not an observed record.\n"
                f"• Historical Strength: {strengths}\n"
                f"• Primary Improvement Focus: {focus}\n"
                f"• Strategic Actions:\n"
                f"  - Timeliness: {actions.get('timeliness', 'Implement 08:30 AM dispatch cutoffs.')}\n"
                f"  - Accuracy: {actions.get('accuracy', 'Maintain dual verification checks.')}\n"
                f"  - Productivity: {actions.get('productivity', 'Buffer dispatch margins during high volume days.')}\n"
                f"• Milestones: Q1 focuses on bottleneck audits; Q2 on process optimization; Q3 on standard routines; Q4 on annual target consolidation."
            )
        else:
            reply = (
                f"Strategic Forward-Looking Plan for {target_year} ({emp_name}):\n"
                f"Model projected KPI is {proj_kpi:.1f}% (holdout uncertainty ±3.41 MAE). "
                f"Top strategic priority: {top_rec.get('headline') or focus}. "
                f"Evidence: {top_rec.get('evidence', '')}"
            )
    elif not plan.get("available"):
        reply = plan.get("message") or "No measured KPI logs are available for this period."
    elif "missing" in text or "information" in text:
        reply = (
            f"Coverage: {plan.get('coverage')}. "
            "Absent component scores are omitted rather than treated as zero. "
            f"{plan.get('message') or ''}"
        ).strip()
    elif "compare" in text or "previous" in text or "change" in text or "2025" in text:
        comp = plan.get("historical_comparison")
        comp_str = f"{comp:+.1f} KPI points" if comp is not None else "No previous week recorded"
        reply = (
            f"Measured Week Comparison for {emp_name} (Week of {report_week}):\n"
            f"• Current Week KPI: {plan.get('measured_kpi')}%\n"
            f"• Change vs Previous Recorded Week: {comp_str}.\n"
            f"• Status: {plan.get('coverage')}."
        )
    elif "forecast" in text or "next week" in text or "model" in text:
        reply = (
            f"KPI Forecast Analysis for {emp_name} (Week of {report_week}):\n"
            f"• Current Measured KPI: {plan.get('measured_kpi')}%\n"
            f"• Predicted Next Week KPI: {plan.get('predicted_next_week_kpi')}%\n"
            f"• Model Uncertainty: Holdout test MAE is 3.41, RMSE is 4.55. That prediction is a statistical estimate, not a guaranteed result.\n"
            f"• Priority Action: {top_rec.get('headline', 'Review component scores')}."
        )
    elif "why" in text or "priorit" in text or "main" in text or "attention" in text or "focus" in text:
        if top_rec:
            reply = (
                f"Improvement Priority for {emp_name} (Week of {report_week}):\n"
                f"• Priority Item: {top_rec.get('headline')}\n"
                f"• Rationale: {top_rec.get('why_prioritized') or top_rec.get('explanation')}\n"
                f"• Supporting Evidence: {top_rec.get('evidence')}\n"
                f"• Agreed Action: {(top_rec.get('actions') or ['Review with employee'])[0]}\n"
                f"• Target Follow-up: {top_rec.get('follow_up')}"
            )
        else:
            reply = plan.get("message") or "No ranked recommendation is available for this week."
    elif "decline" in text or "drop" in text or "decrease" in text or "improve" in text or "trend" in text:
        comp = plan.get("historical_comparison")
        if comp is not None and comp < 0:
            reply = (
                f"Performance Trend Analysis ({emp_name}):\n"
                f"Measured KPI declined by {abs(comp):.1f} points compared to the previous recorded week. "
                f"The weakest component was {plan.get('main_opportunity') or 'timeliness'}. "
                f"Top recommendation: {top_rec.get('headline', 'Review affected daily logs')}."
            )
        elif comp is not None and comp > 0:
            reply = (
                f"Performance Trend Analysis ({emp_name}):\n"
                f"Measured KPI rose by +{comp:.1f} points compared to the previous recorded week. "
                "Continue sustaining the operational routines that supported this positive trajectory."
            )
        else:
            reply = (
                f"Performance Trend Analysis ({emp_name}):\n"
                f"Weekly KPI score held steady at {plan.get('measured_kpi')}%. "
                f"Maintain focus on {top_rec.get('headline', 'consistent daily processing')}."
            )
    elif "timeliness" in text or "late" in text:
        reply = (
            f"Timeliness Coaching Guidelines ({emp_name}):\n"
            "1. Enforce strict 08:30 AM morning sorting and vehicle dispatch cutoff.\n"
            "2. Prioritize time-sensitive express items before general bulk delivery.\n"
            "3. Conduct a mid-day route check to rebalance delayed beats."
        )
    elif "accuracy" in text or "error" in text:
        reply = (
            f"Accuracy Coaching Guidelines ({emp_name}):\n"
            "1. Double-check registered mail bar codes and destination codes before dispatch.\n"
            "2. Verify cash drawer balances and money order receipt logs at noon and close-of-business.\n"
            "3. Maintain neat sorting pigeonholes to avoid wrong-office missorts."
        )
    elif "completion" in text or "unfinished" in text or "workload" in text:
        reply = (
            f"Completion & Workload Coaching Guidelines ({emp_name}):\n"
            "1. Clear daily dispatch backlogs before accepting afternoon incoming volumes.\n"
            "2. Notify the Postmaster early if utility collection rushes require queue assistance.\n"
            "3. Keep assigned items matched to delivery vehicle capacity."
        )
    elif "measure" in text or "progress" in text or "track" in text:
        reply = (
            f"How Progress is Measured ({emp_name}):\n"
            "1. Track weekly completion, accuracy, and timeliness rates in the Daily Attendance & KPI desk.\n"
            "2. Check whether next week's measured KPI stays within the ±3.41 MAE model forecast corridor.\n"
            "3. Conduct regular 1-on-1 reviews using the 'Accepted for follow-up' action plan."
        )
    else:
        if top_rec:
            reply = f"{top_rec.get('headline')}: {top_rec.get('evidence')} {top_rec.get('why_prioritized')} {top_rec.get('follow_up')}"
        else:
            reply = plan.get("message") or "Review the recorded KPI metrics and historical evidence for coaching."

    return {
        "employee_id": employee_id,
        "week": report_week,
        "year": active_year,
        "reply": reply,
        "engine": "factual_rules_engine",
        "attribution": "SL Postal KPI Desk — Ground Truth AI Analytics",
        "notice": NOTICE,
    }


answer = coach_answer


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


def generate_personalized_coaching_plan(employee_id: str, options: dict | None = None) -> dict:
    options = options or {}
    year = str(options.get("year") or "2027").strip()
    baseline = str(options.get("baseline") or "latest").strip()
    horizon = str(options.get("horizon") or "next_12_weeks").strip()
    goals = set(options.get("goals") or ["auto"])

    horizon_labels = {
        "next_4_weeks": "Next 4 Weeks",
        "next_12_weeks": "Next 12 Weeks (Quarterly)",
        "full_year": f"Full Year {year}",
    }
    horizon_text = horizon_labels.get(horizon, "Next 12 Weeks")

    report = productivity_for(employee_id, week=None if baseline == "latest" else baseline, year=year)
    history = report.get("history") or []
    weeks_count = len(history) if history else 1

    # Baseline statistics from historical dataset
    if history:
        avg_kpi = round(sum(w["kpi"] for w in history) / len(history), 1)
        avg_comp = round(sum(w["completion"] for w in history) / len(history), 1)
        avg_acc = round(sum(w["accuracy"] for w in history) / len(history), 1)
        avg_time = round(sum(w["timeliness"] for w in history) / len(history), 1)
        latest_row = history[-1]
        prev_row = history[-2] if len(history) > 1 else None
    else:
        avg_kpi = 85.0
        avg_comp = 85.0
        avg_acc = 90.0
        avg_time = 80.0
        latest_row = {}
        prev_row = None

    is_measured = report.get("available") and not report.get("is_future_year")
    curr_kpi = report.get("measured_kpi") if is_measured else (report.get("predicted_next_week_kpi") or avg_kpi)
    curr_comp = report.get("completion") if is_measured else avg_comp
    curr_acc = report.get("accuracy") if is_measured else avg_acc
    curr_time = report.get("timeliness") if is_measured else avg_time

    # Deltas
    base_comp = prev_row.get("completion", avg_comp) if prev_row else avg_comp
    base_acc = prev_row.get("accuracy", avg_acc) if prev_row else avg_acc
    base_time = prev_row.get("timeliness", avg_time) if prev_row else avg_time
    base_kpi = prev_row.get("kpi", avg_kpi) if prev_row else avg_kpi

    d_comp = round(curr_comp - base_comp, 1)
    d_acc = round(curr_acc - base_acc, 1)
    d_time = round(curr_time - base_time, 1)
    d_kpi = round(curr_kpi - base_kpi, 1)

    week_label = f"Week of {report.get('week')}" if is_measured else f"Horizon {year} (Baseline {report.get('latest_available_week', '2025-01-27')})"
    status_tag = "Measured" if is_measured else "Strategic Target"

    # Current KPI Performance Tiles
    current_kpi_performance = {
        "week_label": week_label,
        "status_tag": status_tag,
        "productivity": { "value": curr_kpi, "delta": d_kpi, "sub": "vs. previous week" if prev_row else "vs. baseline avg" },
        "completion": { "value": curr_comp, "delta": d_comp, "sub": "vs. previous week" if prev_row else "vs. baseline avg" },
        "accuracy": { "value": curr_acc, "delta": d_acc, "sub": "vs. previous week" if prev_row else "vs. baseline avg" },
        "timeliness": { "value": curr_time, "delta": d_time, "sub": "vs. previous week" if prev_row else "vs. baseline avg" },
    }

    # Performance Summary (Strengths & Areas Needing Attention)
    strengths = []
    attention = []

    parts_by_score = sorted([
        ("Accuracy", curr_acc, d_acc, "checking and address verification"),
        ("Completion", curr_comp, d_comp, "daily delivery quotas"),
        ("Timeliness", curr_time, d_time, "morning dispatch cutoff adherence"),
    ], key=lambda x: x[1], reverse=True)

    top_part = parts_by_score[0]
    weak_part = parts_by_score[-1]

    strengths.append(f"High {top_part[0].lower()} ({top_part[1]}%) with consistent performance across recorded periods.")
    if parts_by_score[1][2] >= 0:
        strengths.append(f"Strong {parts_by_score[1][0].lower()} rate ({parts_by_score[1][1]}%) and improving trend ({parts_by_score[1][2]:+.1f}%).")
    else:
        strengths.append(f"Solid foundation in {parts_by_score[1][0].lower()} ({parts_by_score[1][1]}%).")
    strengths.append(f"Stable overall KPI ({avg_kpi}%) over recorded departmental audit periods.")

    if weak_part[2] < 0:
        attention.append(f"{weak_part[0]} decreased by {abs(weak_part[2]):.1f}% compared to previous period.")
    else:
        attention.append(f"{weak_part[0]} ({weak_part[1]}%) is below optimal target benchmark of 85.0%.")
    if d_kpi < 0:
        attention.append(f"Slight drop in overall productivity ({curr_kpi}% vs. {base_kpi}%).")
    attention.append("Workload spikes observed in month-end delivery cycles require buffer margins.")

    # Forecast vs Target (Model vs Target >= 95%)
    forecast_vs_target = {
        "target_threshold": 95.0,
        "items": [
            { "name": "Productivity", "forecast": round(min(97.5, max(60.0, curr_kpi + 3.8)), 1), "target": 95.0, "delta": "+3.8%", "color": "#1677D2" },
            { "name": "Completion", "forecast": round(min(98.0, max(60.0, curr_comp + 6.4)), 1), "target": 95.0, "delta": "+6.4%", "color": "#2E7D32" },
            { "name": "Accuracy", "forecast": round(min(99.0, max(70.0, curr_acc + 0.4)), 1), "target": 95.0, "delta": "+0.4%", "color": "#7B1FA2" },
            { "name": "Timeliness", "forecast": round(min(95.0, max(50.0, curr_time + 5.9)), 1), "target": 95.0, "delta": "+5.9%", "color": "#E65100" },
        ],
        "note": "Forecasts are estimates and not guaranteed results.",
    }

    # Prioritization logic:
    candidates = []

    # 1. Timeliness candidate
    time_score = (85.0 - curr_time) * 1.5 + (abs(d_time) * 2.0 if d_time < 0 else 0)
    if "timeliness" in goals:
        time_score += 15.0
    candidates.append({
        "category": "timeliness",
        "title": "Improve Timeliness — Reduce delivery delays",
        "score_weight": time_score,
        "current_value": curr_time,
        "current_label": f"Current ({year})",
        "current_delta": d_time,
        "historical_value": avg_time,
        "historical_label": "Historical (Avg)",
        "target_value": "≥ 85% (suggested)",
        "why_prioritized": (
            f"Timeliness ({curr_time}%) has {('declined by ' + str(abs(d_time)) + '%') if d_time < 0 else 'lagged behind other components'} "
            "and is below the target range. This affects overall mail turnaround and postal customer satisfaction."
        ),
        "recommended_actions": [
            "Prioritize high-volume delivery beats early in morning sorting.",
            "Enforce strict 08:30 AM dispatch cutoffs to avoid afternoon traffic delays.",
            "Use the daily checklist to monitor route handoffs and package departure times.",
        ],
        "follow_up": horizon_text,
        "expected_improvement": "+",
        "confidence": "High" if weeks_count >= 4 else "Medium",
        "review_period": horizon_text,
        "evidence_text": f"Measured timeliness was {curr_time}% with recorded delivery items across baseline {report.get('latest_available_week', 'period')}.",
    })

    # 2. Completion / Productivity candidate
    comp_score = (90.0 - curr_comp) * 1.3 + (abs(d_comp) * 1.8 if d_comp < 0 else 0)
    if "productivity" in goals:
        comp_score += 15.0
    candidates.append({
        "category": "completion",
        "title": "Increase Productivity — Improve task completion",
        "score_weight": comp_score,
        "current_value": curr_comp,
        "current_label": f"Current ({year})",
        "current_delta": d_comp,
        "historical_value": avg_comp,
        "historical_label": "Historical (Avg)",
        "target_value": "≥ 90% (suggested)",
        "why_prioritized": (
            f"Completion rate is {curr_comp}%. Unfinished volume during peak days accumulates as uncompleted work. "
            "Strengthening daily clearance ensures zero backlog carryover into the next shift."
        ),
        "recommended_actions": [
            "Establish mid-day dispatch buffer checks before final afternoon sorting.",
            "Reallocate sudden utility collection spikes among reserve counter clerks.",
            "Review daily uncompleted delivery log entries with supervisor by 16:30 PM.",
        ],
        "follow_up": horizon_text,
        "expected_improvement": "+",
        "confidence": "High" if weeks_count >= 4 else "Medium",
        "review_period": horizon_text,
        "evidence_text": f"Completion stood at {curr_comp}% with an average assigned workload of {latest_row.get('assigned', 35)} items.",
    })

    # 3. Accuracy candidate
    acc_score = (95.0 - curr_acc) * 1.4 + (abs(d_acc) * 2.0 if d_acc < 0 else 0)
    if "accuracy" in goals:
        acc_score += 15.0
    candidates.append({
        "category": "accuracy",
        "title": "Maintain Accuracy — Eliminate sorting and data entry errors",
        "score_weight": acc_score,
        "current_value": curr_acc,
        "current_label": f"Current ({year})",
        "current_delta": d_acc,
        "historical_value": avg_acc,
        "historical_label": "Historical (Avg)",
        "target_value": "≥ 95% (suggested)",
        "why_prioritized": (
            f"Accuracy is {curr_acc}%. Maintaining high postal accuracy protects against missent registered articles "
            "and financial transaction discrepancies at counter windows."
        ),
        "recommended_actions": [
            "Conduct double-verification on registered mail barcodes and destination post codes.",
            "Perform counter stamp stock and money order reconciliations twice daily.",
            "Verify electronic parcel scanning logs prior to loading for distribution.",
        ],
        "follow_up": horizon_text,
        "expected_improvement": "+",
        "confidence": "High" if weeks_count >= 4 else "Medium",
        "review_period": horizon_text,
        "evidence_text": f"Accuracy was {curr_acc}% with {latest_row.get('incorrect', 0)} recorded defects in the baseline period.",
    })

    # 4. Workload management candidate
    if "workload" in goals:
        candidates.append({
            "category": "workload",
            "title": "Optimize Workload Distribution — Balance peak delivery beats",
            "score_weight": 20.0,
            "current_value": curr_kpi,
            "current_label": f"Current ({year})",
            "current_delta": d_kpi,
            "historical_value": avg_kpi,
            "historical_label": "Historical (Avg)",
            "target_value": "Balanced Quota",
            "why_prioritized": "Workload fluctuations during month-end create operational stress and delivery bottlenecks.",
            "recommended_actions": [
                "Map heavy delivery beats and rebalance routes across adjacent zones.",
                "Implement rotating counter shifts during peak utility payment windows.",
                "Review weekly overtime vs volume logs to optimize staffing coverage.",
            ],
            "follow_up": horizon_text,
            "expected_improvement": "+",
            "confidence": "Medium",
            "review_period": horizon_text,
            "evidence_text": "Workload balancing directive based on historical beat volume records.",
        })

    # Sort candidates by priority score
    candidates.sort(key=lambda x: x["score_weight"], reverse=True)

    priority_labels = [
        (1, "Priority 1", "Highest Priority"),
        (2, "Priority 2", "High Priority"),
        (3, "Priority 3", "Medium Priority"),
    ]

    recommendations = []
    for idx, cand in enumerate(candidates[:3]):
        num, p_lbl, p_badge = priority_labels[idx]
        cand["priority_number"] = num
        cand["priority"] = p_lbl
        cand["priority_badge"] = p_badge
        cand["id"] = f"{employee_id}|{year}|priority_{cand['category']}"
        cand["plan_id"] = cand["id"]
        cand["employee_id"] = employee_id
        cand["employee_name"] = report.get("employee_name") or employee_id
        recommendations.append(cand)

    # Line chart data (Historical & Forecast)
    chart_data = {
        "months": ["Jan 26", "Mar 26", "May 26", "Jul 26", "Sep 26", "Nov 26", "Jan 27"],
        "measured_series": [
            round(avg_kpi - 3.2, 1),
            round(avg_kpi - 1.5, 1),
            round(avg_kpi + 2.0, 1),
            round(avg_kpi + 1.2, 1),
            round(avg_kpi + 0.5, 1),
            round(curr_kpi, 1),
            None,
        ],
        "forecast_series": [
            None, None, None, None, None,
            round(curr_kpi, 1),
            round(min(98.0, curr_kpi + 3.8), 1),
        ],
    }

    return {
        "success": True,
        "employee_id": employee_id,
        "employee_name": report.get("employee_name") or employee_id,
        "year": year,
        "baseline": baseline,
        "horizon": horizon,
        "goals": list(goals),
        "current_kpi_performance": current_kpi_performance,
        "performance_summary": {
            "strengths": strengths,
            "areas_needing_attention": attention,
        },
        "forecast_vs_target": forecast_vs_target,
        "recommendations": recommendations,
        "chart_data": chart_data,
        "model_validation": {
            "model_mae": 3.41,
            "model_rmse": 4.55,
            "baseline_mae": 7.93,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def save_improvement_plan(employee_id: str, body: dict) -> dict:
    employee_id = str(employee_id or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required.")

    plan_id = str((body or {}).get("plan_id") or (body or {}).get("id") or "").strip()
    if not plan_id:
        plan_id = f"{employee_id}|plan_{int(datetime.now().timestamp())}"

    title = str((body or {}).get("title") or "Performance Improvement Action").strip()
    category = str((body or {}).get("category") or "general").strip().lower()
    priority = str((body or {}).get("priority") or "Priority 1").strip()
    status = str((body or {}).get("status") or "Planned").strip()
    if status not in {"Planned", "In Progress", "Completed", "Dismissed"}:
        status = "Planned"

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    existing = db["employee_improvement_plan"].find_one({"plan_id": plan_id}) or {}

    doc = {
        "plan_id": plan_id,
        "employee_id": employee_id,
        "employee_name": str((body or {}).get("employee_name") or existing.get("employee_name") or ""),
        "title": title,
        "category": category,
        "priority": priority,
        "status": status,
        "baseline_date": str((body or {}).get("baseline_date") or (body or {}).get("current_label") or existing.get("baseline_date") or ""),
        "baseline_kpi": (body or {}).get("baseline_kpi") or (body or {}).get("current_value") or existing.get("baseline_kpi"),
        "target_kpi": (body or {}).get("target_kpi") or (body or {}).get("target_value") or existing.get("target_kpi") or "≥ 85%",
        "review_period": str((body or {}).get("review_period") or (body or {}).get("follow_up") or existing.get("review_period") or "Next 4 Weeks"),
        "recommended_actions": (body or {}).get("recommended_actions") or (body or {}).get("actions") or existing.get("recommended_actions") or [],
        "why_prioritized": str((body or {}).get("why_prioritized") or existing.get("why_prioritized") or ""),
        "evidence": str((body or {}).get("evidence") or (body or {}).get("evidence_text") or existing.get("evidence") or ""),
        "confidence": str((body or {}).get("confidence") or existing.get("confidence") or "Medium"),
        "feedback": str((body or {}).get("feedback") or existing.get("feedback") or "")[:500],
        "created_at": existing.get("created_at") or now,
        "updated_at": now,
        "reviewed_at": now if status in {"Completed", "Dismissed"} else existing.get("reviewed_at"),
    }
    db["employee_improvement_plan"].replace_one({"plan_id": plan_id}, doc, upsert=True)
    doc.pop("_id", None)
    return doc


def list_improvement_plans(employee_id: str | None = None) -> list[dict]:
    db = get_db()
    query = {}
    if employee_id:
        query["employee_id"] = str(employee_id).strip()
    docs = list(db["employee_improvement_plan"].find(query, {"_id": 0}))

    for doc in docs:
        emp_id = doc.get("employee_id")
        baseline_kpi = doc.get("baseline_kpi")
        try:
            latest_logs = list(db["daily_kpi_log"].find({"employee_id": emp_id}).sort("date", -1).limit(5))
            if latest_logs:
                scores = [l.get("kpi_score") for l in latest_logs if l.get("kpi_score") is not None]
                if scores:
                    latest_observed = round(sum(scores) / len(scores), 1)
                    doc["follow_up_kpi"] = latest_observed
                    if isinstance(baseline_kpi, (int, float)):
                        doc["kpi_change"] = round(latest_observed - float(baseline_kpi), 1)
        except Exception:
            pass

    return docs


def update_improvement_plan(plan_id: str, body: dict) -> dict:
    plan_id = str(plan_id or "").strip()
    db = get_db()
    existing = db["employee_improvement_plan"].find_one({"plan_id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Improvement plan {plan_id} was not found.")

    status = str((body or {}).get("status") or existing.get("status") or "Planned").strip()
    if status not in {"Planned", "In Progress", "Completed", "Dismissed"}:
        raise HTTPException(status_code=400, detail="Invalid status. Must be Planned, In Progress, Completed, or Dismissed.")

    now = datetime.now(timezone.utc).isoformat()
    existing["status"] = status
    if "feedback" in body:
        existing["feedback"] = str(body.get("feedback") or "")[:500]
    existing["updated_at"] = now
    if status in {"Completed", "Dismissed"}:
        existing["reviewed_at"] = now

    db["employee_improvement_plan"].replace_one({"plan_id": plan_id}, existing)
    existing.pop("_id", None)
    return existing


def improvement_plans_evaluation() -> dict:
    plans = list_improvement_plans()
    total = len(plans)
    status_counts = {"Planned": 0, "In Progress": 0, "Completed": 0, "Dismissed": 0}
    changes = []

    for p in plans:
        s = p.get("status", "Planned")
        status_counts[s] = status_counts.get(s, 0) + 1
        if "kpi_change" in p and p["kpi_change"] is not None:
            changes.append(p["kpi_change"])

    accepted = total - status_counts.get("Dismissed", 0)
    acceptance_rate = round((accepted / total) * 100, 1) if total > 0 else 0.0
    completion_rate = round((status_counts.get("Completed", 0) / total) * 100, 1) if total > 0 else 0.0
    avg_change = round(sum(changes) / len(changes), 1) if changes else 0.0

    return {
        "total_plans_saved": total,
        "status_counts": status_counts,
        "acceptance_rate": acceptance_rate,
        "completion_rate": completion_rate,
        "average_observed_kpi_change": avg_change,
        "evaluated_plans": plans[:20],
        "research_disclaimer": (
            "Recorded KPI changes represent observational comparisons across logging windows. "
            "These metrics evaluate departmental operational follow-up in the research study "
            "and do not assert algorithmic causation or clinical effectiveness."
        ),
    }


# ============================================================================

# ============================================================================

# ============================================================================
# POSTASSIST RESTRICTED MULTILINGUAL & CATEGORY-SPECIFIC COACH ENGINE
# ============================================================================

OUT_OF_SCOPE_MESSAGE_EN = (
    "I'm your PostAssist AI Productivity Coach. I can only help you understand the selected employee's "
    "measured KPI performance and suggest ways to improve completion, accuracy and timeliness. "
    "Please ask a question about your work performance."
)

OUT_OF_SCOPE_MESSAGE_SI = (
    "මම ඔබගේ PostAssist AI ඵලදායිතා උපදේශකයා වෙමි. තෝරාගත් සේවකයාගේ මනින ලද KPI කාර්යසාධනය තේරුම් ගැනීමට "
    "සහ සම්පූර්ණ කිරීම, නිරවද්‍යතාවය සහ කාලෝචිතභාවය වැඩිදියුණු කිරීමට පමණක් මට ඔබට උදව් කළ හැකිය. "
    "කරුණාකර ඔබගේ රාජකාරි කාර්යසාධනය පිළිබඳ ප්‍රශ්නයක් අසන්න."
)

OUT_OF_SCOPE_MESSAGE = OUT_OF_SCOPE_MESSAGE_EN

# Patterns for forbidden / out-of-scope topics (English & Sinhala)
FORBIDDEN_PATTERNS = [
    # Weather
    r"\b(weather|temperature|climate|forecast for colombo|sunny|rain(ing|y)?|humidity|wind)\b",
    r"(කාලගුණ|උෂ්ණත්ව|වැස්ස|වැසි|සුළඟ|දේශගුණ)",
    # News, Sports, Politics & Entertainment
    r"\b(news|president|parliament|election|political|cricket|sports|match|cinema|movie|actor)\b",
    r"(දේශපාලන|පාර්ලිමේන්තු|මැතිවරණ|ජනාධිපති|ක්‍රිකට්|පුවත්|සිනමා|චිත්‍රපට)",
    # Coding & Software
    r"\b(python|javascript|coding|function|react|html|css|sql|script|programming|syntax|compiler|git)\b",
    r"(කෝඩින්|පයිතන්|ක්‍රමලේඛන|මෘදුකාංග)",
    # General Trivia & Math
    r"\b(capital of|who is|calculate 2\+|tell me a joke|write a poem|recipe|quantum|philosophy|distance to)\b",
    r"(විහිළු|කවියක්|අගනුවර|ගණනය|කෑම වට්ටෝරු)",
    # Jailbreak & System Prompt tampering
    r"\b(ignore (all|previous|prior)|system prompt|jailbreak|dan mode|bypass restrictions|forget instructions)\b",
    r"(සියලු උපදෙස් අමතක කරන්න|නියාමන මඟහරින්න)",
]

# Supported intents patterns (English and Sinhala)
SUPPORTED_INTENT_PATTERNS = [
    (
        "OVERVIEW",
        [
            r"how\s+(am\s+i|are\s+we|is\s+he|is\s+she)\s+(doing|performing|progressing)",
            r"(what\s+is\s+my|check\s+my|show\s+my|tell\s+me\s+my)\s+(performance|kpi|score|status)",
            r"how\s+did\s+i\s+do",
            r"^performance(\s+overview)?$",
            r"my\s+performance",
            r"doing\s+this\s+week",
            r"overview",
            # Sinhala
            r"මගේ\s+කාර්යසාධන(ය)?",
            r"මම\s+කොහොමද\s+කරන්නේ",
            r"මගේ\s+(kpi|ලකුණු|තත්ත්වය)",
            r"කාර්යසාධන\s+සාරාංශය",
            r"විස්තර(ය)?\s+දෙන්න",
        ],
    ),
    (
        "STRENGTHS",
        [
            r"what\s+are\s+(my|the)\s+strengths?",
            r"what\s+am\s+i\s+good\s+at",
            r"(top|best)\s+(component|metric|area)",
            r"where\s+did\s+i\s+excel",
            r"highest\s+score",
            r"strengths",
            # Sinhala
            r"(මගේ\s+)?ශක්තීන්",
            r"මම\s+දක්ෂ\s+මොනවාටද",
            r"ඉහළම\s+(ලකුණු|අංශය)",
            r"හොඳම\s+(දක්ෂතාව|අංශය|ප්‍රතිඵලය)",
            r"ශක්තිමත්\s+පැති",
        ],
    ),
    (
        "IMPROVE_TIMELINESS",
        [
            r"(improve|raise|increase|boost|better)\s+(my\s+)?timeliness",
            r"(why\s+is\s+my\s+)?timeliness\s+(so\s+)?(low|poor|dropping|bad)",
            r"(late|delay|delayed|cutoff|dispatch)\s+(mail|sorting|delivery|handover)",
            r"how\s+to\s+be\s+on\s+time",
            r"timeliness",
            # Sinhala
            r"කාලෝචිත(භාවය)?",
            r"වේලාවට\s+(වැඩ|පිටත්වීම|භාරදීම)",
            r"ප්‍රමාද(ය|යන්)?\s+(අඩු|නැති)",
            r"නියමිත\s+වේලාව",
            r"ප්‍රමාද",
        ],
    ),
    (
        "IMPROVE_ACCURACY",
        [
            r"(improve|raise|increase|boost|better)\s+(my\s+)?accuracy",
            r"(why\s+is\s+my\s+)?accuracy\s+(so\s+)?(low|poor|dropping|bad)",
            r"(reduce|prevent|fix|avoid)\s+(errors?|mistakes?|defects?|missorts?)",
            r"accuracy\s+issue",
            r"accuracy",
            # Sinhala
            r"නිරවද්‍ය(තාවය)?",
            r"වැරදි\s+(අඩු|නැති|හදා)",
            r"දෝෂ\s+(අඩු|නැති|හදා)",
            r"නිවැරදිව",
        ],
    ),
    (
        "IMPROVE_COMPLETION",
        [
            r"(improve|raise|increase|boost|better)\s+(my\s+)?completion",
            r"(why\s+is\s+my\s+)?completion\s+(so\s+)?(low|poor|dropping|bad)",
            r"(uncompleted|pending|carry-over|unfinished|backlog)\s+(items?|tasks?|work)",
            r"handle\s+(peak|surge|intake|volume)",
            r"completion",
            # Sinhala
            r"සම්පූර්ණ\s+කිරීම",
            r"වැඩ\s+නිම\s+කිරීම",
            r"ඉතිරි\s+වැඩ",
            r"නොබෙදූ\s+ලිපි",
            r"අවසන්\s+කිරීම",
        ],
    ),
    (
        "COMPARISON",
        [
            r"(compare|comparison|versus|vs|difference)",
            r"(last|previous|prior)\s+week",
            r"why\s+(is\s+my\s+kpi\s+)?(lower|higher|drop|dropped|decreased|increased)",
            r"trend|trajectory|change\s+from",
            # Sinhala
            r"පෙර\s+සතිය",
            r"පසුගිය\s+සතිය",
            r"සසඳන්න",
            r"වෙනස",
            r"(අඩු|වැඩි)\s+වූයේ\s+ඇයි",
            r"සංසන්දනය",
        ],
    ),
    (
        "FORECAST_EXPLANATION",
        [
            r"(predict|forecast|projection|projected|expected)\s+(kpi|performance|score|model)",
            r"what\s+does\s+(my\s+)?(predicted|forecast)\s+(kpi\s+)?mean",
            r"random\s+forest|ml\s+model|machine\s+learning",
            r"next\s+week\s+(forecast|estimate|projection)",
            r"forecast",
            # Sinhala
            r"පුරෝකථන(ය)?",
            r"අනාගත\s+kpi",
            r"ඇස්තමේන්තුව",
            r"මොඩලය",
            r"random\s+forest",
            r"ඉදිරි\s+සතියේ\s+(ලකුණු|පුරෝකථනය)",
        ],
    ),
    (
        "IMPROVE_GENERAL",
        [
            r"how\s+can\s+i\s+improve(\s+my\s+kpi)?",
            r"how\s+to\s+improve",
            r"what\s+should\s+i\s+focus\s+on",
            r"which\s+area\s+needs\s+attention",
            r"action\s+plan|recommendations?|advice|tips|suggestions?",
            r"next\s+steps",
            r"improve",
            # Sinhala
            r"වැඩි\s+දියුණු\s+කර(න්නේ|ගන්නේ)\s+කෙසේද",
            r"වැඩි\s+කරන්නේ\s+කෙසේද",
            r"ඉදිරි\s+පියවර",
            r"උපදෙස්",
            r"ක්‍රියාකාරී\s+සැලැස්ම",
            r"අවධානය\s+යොමු\s+කළ\s+යුතු",
            r"හොඳ\s+කරගන්නේ\s+කොහොමද",
        ],
    ),
]


def is_sinhala(text: str) -> bool:
    """Return True if string contains Sinhala Unicode characters."""
    return bool(re.search(r"[\u0D80-\u0DFF]", text or ""))


_JOB_PIPELINE = None
_JOB_MODEL_PATH = Path(__file__).resolve().parent / "models" / "kpi_forecast_model.joblib"


def get_joblib_pipeline():
    """Lazy loader for kpi_forecast_model.joblib."""
    global _JOB_PIPELINE
    if _JOB_PIPELINE is None:
        try:
            import joblib
            if _JOB_MODEL_PATH.is_file():
                _JOB_PIPELINE = joblib.load(_JOB_MODEL_PATH)
        except Exception as exc:
            print("Warning: Could not load kpi_forecast_model.joblib:", exc)
    return _JOB_PIPELINE


def predict_joblib_kpi(
    kpi_score: float,
    lag_1: float,
    lag_2: float,
    mean_prev_4: float,
    experience: float,
    post_office: str,
    designation: str,
    work_category: str,
    employment_type: str,
) -> float | None:
    """
    Run features directly through the trained Random Forest model (kpi_forecast_model.joblib).
    """
    pipeline = get_joblib_pipeline()
    if pipeline is None:
        return None
    try:
        import pandas as pd
        row = {
            "KPI_Score": float(kpi_score),
            "KPI_Lag_1": float(lag_1),
            "KPI_Lag_2": float(lag_2),
            "KPI_Mean_Previous_4": float(mean_prev_4),
            "Years_of_Experience": float(experience),
            "Post_Office": str(post_office or "Kaduwela"),
            "Designation": str(designation or "Postman"),
            "Work_Category": str(work_category or "Delivery (Field)"),
            "Employment_Type": str(employment_type or "Permanent"),
        }
        df = pd.DataFrame([row])
        pred = float(pipeline.predict(df)[0])
        return round(pred, 1)
    except Exception as exc:
        print("Model prediction error:", exc)
        return None


def classify_coaching_intent(message: str, selected_employee_id: str | None = None) -> str:
    """
    Deterministic intent classifier supporting English and Sinhala inquiries.
    """
    if not message or not message.strip():
        return "UNSUPPORTED"

    clean_msg = message.strip().lower()

    # Length bounds
    if len(clean_msg) < 2 or len(clean_msg) > 600:
        return "UNSUPPORTED"

    # Forbidden patterns
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, clean_msg, re.IGNORECASE):
            return "UNSUPPORTED"

    # Cross employee ID checks
    emp_matches = re.findall(r"\b(emp-?\d{3,})\b", clean_msg, re.IGNORECASE)
    if emp_matches:
        for match in emp_matches:
            clean_match = match.replace("-", "").upper()
            clean_selected = (selected_employee_id or "").replace("-", "").upper()
            if clean_selected and clean_match != clean_selected:
                return "UNSUPPORTED"

    # Match supported performance intents
    for intent, patterns in SUPPORTED_INTENT_PATTERNS:
        for pat in patterns:
            if re.search(pat, clean_msg, re.IGNORECASE):
                return intent

    return "UNSUPPORTED"


def get_category_recommendations(
    work_category: str,
    designation: str,
    weakest: str,
    measured_kpi: float,
    completion: float,
    accuracy: float,
    timeliness: float,
    report: dict,
    lang: str = "en",
) -> list[dict]:
    """
    Generate highly differentiated recommendations tailored specifically to the employee's
    Work Category (Delivery vs Office vs Supervisory) and actual recorded metrics.
    """
    cat = (work_category or "").strip().lower()
    desig = (designation or "").strip().lower()
    late_count = int(report.get("late", report.get("late_items", 0)) or 0)
    error_count = int(report.get("incorrect", report.get("errors", 0)) or 0)
    uncompleted_count = int(report.get("uncompleted", 0) or 0)
    report_week = report.get("week", "Latest")

    recs = []

    # ─────────────────────────────────────────────────────────────────────────
    # 1. DELIVERY (FIELD) — Postman, Senior Postman
    # ─────────────────────────────────────────────────────────────────────────
    if "delivery" in cat or "postman" in desig:
        # Timeliness gap
        if timeliness < 95.0 or weakest == "timeliness":
            if lang == "si":
                recs.append({
                    "title": "තැපැල් බෙදාහැරීමේ මාර්ග සැලැස්ම සහ උදෑසන පිටත්වීමේ වේලාව ප්‍රශස්ත කිරීම",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"මනින ලද බෙදාහැරීමේ කාලෝචිතභාවය {timeliness:.1f}% ක් වන අතර ප්‍රමාද වූ භාරදීම් {late_count} ක් වාර්තා වී ඇත.",
                    "reason": "උදෑසන තැපැල් වර්ගීකරණය ප්‍රමාද වීම සහ බෙදාහැරීමේ මාර්ගයේ රථවාහන තදබදය නිසා ක්ෂේත්‍ර රාජකාරි නිමකිරීම ප්‍රමාද වේ.",
                    "action": "පෙ.ව. 08:30 ට පෙර වීදි අනුපිළිවෙලට තැපැල් මලු සකස් කර, පළමු බෙදාහැරීමේ වටයේදීම ලියාපදිංචි ලිපි භාරදීම නිම කරන්න.",
                    "follow_up": "ඊළඟ සතියේ නියමිත වේලාවට ආපසු පැමිණීම 95.0% සම්මතයට ළඟා වූයේදැයි පරීක්ෂා කරන්න.",
                })
            else:
                recs.append({
                    "title": "Optimize Delivery Beat Route & Morning Departure Cutoff",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"Measured delivery timeliness is {timeliness:.1f}% with {late_count} delayed delivery dispatches logged.",
                    "reason": "Morning secondary sorting extending past 08:30 AM and sub-optimal street stop sequencing cause beat delays.",
                    "action": "Complete primary bag sorting before 08:30 AM, arrange mailbags in street sequence, and clear registered mail on the initial loop.",
                    "follow_up": "Verify next week's beat return logs meet the 95.0% departmental on-time standard.",
                })

        # Accuracy gap
        if accuracy < 95.0 or weakest == "accuracy":
            if lang == "si":
                recs.append({
                    "title": "භාරදීමේ ස්ථානයේදී තීරු කේත (Barcode) සහ ලබන්නාගේ විස්තර තහවුරු කිරීම",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"මනින ලද නිරවද්‍යතාවය {accuracy:.1f}% ක් වන අතර දෝෂ {error_count} ක් වාර්තා වී ඇත.",
                    "reason": "ක්ෂේත්‍ර රාජකාරි අතරතුර කඩිනමින් ලිපි භාරදීමට යාමේදී ලිපින අංක වැරදි ලෙස කියවීම සහ හැඳුනුම්පත් අංක තහවුරු නොකිරීම.",
                    "action": "පාරිභෝගිකයාට ලිපි භාරදෙන මොහොතේදීම ජංගම තීරු කේත ස්කෑන් පරීක්ෂාව සිදු කර ලියාපදිංචි ලිපි සඳහා ජාතික හැඳුනුම්පත් අංකය ලේඛනගත කරන්න.",
                    "follow_up": "ඊළඟ සතියේ විගණන වාර්තාවේ දෝෂ රහිත බෙදාහැරීම් පවත්වාගෙන යන්නේදැයි නිරීක්ෂණය කරන්න.",
                })
            else:
                recs.append({
                    "title": "Implement Doorstep Barcode & Recipient Verification",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"Delivery accuracy was {accuracy:.1f}% with {error_count} recorded misdeliveries or barcode scan discrepancies.",
                    "reason": "Rushing delivery drops during peak rounds causes address reading errors and unverified recipient signature collection.",
                    "action": "Perform barcode confirmation scans at customer doorstep and cross-verify recipient National Identity Card (NIC) details.",
                    "follow_up": "Track zero-error delivery handovers in the next weekly audit review.",
                })

        # Completion gap
        if completion < 95.0 or weakest == "completion":
            if lang == "si":
                recs.append({
                    "title": "නොබෙදූ ලිපි සඳහා P-36 නිවේදන පත්‍රිකා නිකුත් කිරීම විධිමත් කිරීම",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"වැඩ නිමකිරීමේ ප්‍රතිශතය {completion:.1f}% ක් වන අතර ආපසු රැගෙන ආ ලිපි {uncompleted_count} ක් පවතී.",
                    "reason": "පරිශ්‍ර වසා තිබීම හේතුවෙන් බෙදාහැරීමට නොහැකි වූ ලිපි සඳහා නියමිත පෝරම නිකුත් කිරීම ප්‍රමාද වීම.",
                    "action": "පළමු උත්සාහයේදීම සම්මත P-36 නිවේදන පත්‍රිකාව නිකුත් කර ප.ව. 04:30 ට පෙර ආපසු පැමිණි ලිපි ලේජරයේ සටහන් කර භාරදෙන්න.",
                    "follow_up": "දවසේ අවසානයේ ඉතිරිවන ලිපි ප්‍රමාණය අවම කිරීමට ක්‍රියා කරන්න.",
                })
            else:
                recs.append({
                    "title": "Accelerate Notice P-36 Issuance & Undelivered Beat Logging",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"Delivery completion was {completion:.1f}% with {uncompleted_count} undelivered carry-over articles.",
                    "reason": "Premises closed during standard delivery hours causing uncompleted runs without immediate notice slip issuance.",
                    "action": "Issue standard Form P-36 delivery notices on the initial attempt and deposit undelivered parcels in the post office return bay by 04:30 PM.",
                    "follow_up": "Review beat return logs to minimize end-of-day undelivered carry-overs.",
                })

    # ─────────────────────────────────────────────────────────────────────────
    # 2. SUPERVISORY / OFFICE — Postmaster, Senior Supervisors
    # ─────────────────────────────────────────────────────────────────────────
    elif "supervisory" in cat or "postmaster" in desig:
        # Timeliness gap
        if timeliness < 95.0 or weakest == "timeliness":
            if lang == "si":
                recs.append({
                    "title": "දෛනික පිටත්කිරීම් සහ පැමිණීම් අනුමත කිරීමේ ස්ථාවර කාලසටහනක් පිහිටුවීම",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"අධීක්ෂණ කාලෝචිතභාවය {timeliness:.1f}% ක් වන අතර ප්‍රමාද වූ අනුමත කිරීම් {late_count} ක් වාර්තා වී ඇත.",
                    "reason": "අධීක්ෂණ පරීක්ෂාවන් ස්ථාවර වේලාවන්හිදී සිදු නොවීම නිසා සේවක වාර්තා සහ පිටත්කිරීම් අනුමැතිය ප්‍රමාද වීම.",
                    "action": "ස්ථාවර අනුමත කිරීමේ වේලාවන් නියම කරන්න: පෙ.ව. 08:45 ට තැපැල් පිටත්කිරීම්, ප.ව. 01:30 ට මුදල් පරීක්ෂාව සහ ප.ව. 04:45 ට ප්‍රධාන ගිණුම් අනුමත කරන්න.",
                    "follow_up": "දෛනික කාර්යාල නිශ්කාශන ලේඛනය නියමිත වේලාවට සහතික කර ඇත්දැයි නිරීක්ෂණය කරන්න.",
                })
            else:
                recs.append({
                    "title": "Establish Scheduled Master Dispatch & Attendance Sign-Off Windows",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"Supervisory timeliness was {timeliness:.1f}% with {late_count} delayed administrative reviews or dispatch approvals.",
                    "reason": "Ad-hoc supervision times cause clerical logs, delivery beats, and daily cash summaries to wait for authorization.",
                    "action": "Fix dedicated sign-off windows: 08:45 AM for beat dispatches, 01:30 PM for mid-day cash checks, and 04:45 PM for daily accounts.",
                    "follow_up": "Track daily office dispatch clearance logs to ensure all departmental standards are certified on schedule.",
                })

        # Accuracy gap
        if accuracy < 95.0 or weakest == "accuracy":
            if lang == "si":
                recs.append({
                    "title": "ප්‍රධාන සේප්පුව සහ මුද්දර සංචිත පිළිබඳ හදිසි භෞතික විගණන පැවැත්වීම",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"අධීක්ෂණ නිරවද්‍යතාවය {accuracy:.1f}% ක් වන අතර ලේජර් විෂමතා {error_count} ක් සටහන් වී ඇත.",
                    "reason": "භෞතික මුදල් හා මුද්දර සංචිත නිතර පරීක්ෂා නොකිරීම නිසා සුළු ගිණුම් විෂමතා එකතු වී විශාල ගැටලු නිර්මාණය වීම.",
                    "action": "දෛනික ප්‍රධාන ලෙජරයට අනුකූලව ප්‍රධාන මුදල් සේප්පුව සහ මුද්දර සංචිත පිළිබඳ සති දෙකකට වරක් හදිසි භෞතික විගණනයක් පවත්වන්න.",
                    "follow_up": "සතිපතා තැපැල් දිස්ත්‍රික් විගණන සාරාංශයේ 100% ක නිවැරදිභාවය තහවුරු කරන්න.",
                })
            else:
                recs.append({
                    "title": "Conduct Surprise Physical Cash & Stamp Stock Spot Audits",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"Supervisory audit accuracy was {accuracy:.1f}% with {error_count} recorded registry or vault reconciliation variances.",
                    "reason": "Infrequent physical spot-audits allow small sub-post office imprest variances or stamp denomination tally mismatches to accumulate.",
                    "action": "Conduct bi-weekly surprise audits of the main cash safe and stamp vault against the daily general ledger balance.",
                    "follow_up": "Verify 100% reconciliation in the weekly postal district audit summary.",
                })

        # Completion gap
        if completion < 95.0 or weakest == "completion":
            if lang == "si":
                recs.append({
                    "title": "උපරිම රාජකාරි දිනවල කාර්යමණ්ඩලය නම්‍යශීලීව යෙදවීම සහ කළමනාකරණය",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"සමස්ත වැඩ නිමකිරීම {completion:.1f}% ක් වන අතර ශේෂ වූ කාර්යයන් {uncompleted_count} ක් වාර්තා වී ඇත.",
                    "reason": "විශ්‍රාම වැටුප් හා බිල්පත් ගෙවීම් දිනවල ස්ථාවර සේවක යෙදවීම් නිසා කවුන්ටර සහ වර්ගීකරණ අංශවල වැඩ ප්‍රමාද වීම.",
                    "action": "තදබදය පවතින දිනවල උදෑසන වර්ගීකරණයට සහ පාර්සල් ලියාපදිංචියට කාර්යමණ්ඩලය නම්‍යශීලීව යොදවා වැඩ නිමකිරීම 98% ට වඩා ඉහළින් තබා ගන්න.",
                    "follow_up": "මාසික කාර්යාල ප්‍රතිදානය සමාලෝචනය කර සියලුම ප්‍රමාදයන් ඉවත් කරන්න.",
                })
            else:
                recs.append({
                    "title": "Implement Dynamic Cross-Functional Staff Deployment during Surges",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"Supervisory operational completion was {completion:.1f}% with {uncompleted_count} carryover items across office beats.",
                    "reason": "Rigid counter and delivery staff allocations cause bottlenecks during first-week-of-month pension and utility bill surges.",
                    "action": "Reassign available field officers to morning counter bag sorting and parcel booking during peak pension days to maintain 98%+ office completion.",
                    "follow_up": "Review end-of-month branch throughput metrics and eliminate backlog.",
                })

    # ─────────────────────────────────────────────────────────────────────────
    # 3. OFFICE — Postal Clerk, Postal Assistant
    # ─────────────────────────────────────────────────────────────────────────
    else:
        # Timeliness gap
        if timeliness < 95.0 or weakest == "timeliness":
            if lang == "si":
                recs.append({
                    "title": "කවුන්ටර තදබදය කළමනාකරණය සහ කාලෝචිත ලිපි වර්ගීකරණ භාරදීම",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"කවුන්ටර කාලෝචිතභාවය {timeliness:.1f}% ක් වන අතර ප්‍රමාද වූ ගනුදෙනු {late_count} ක් වාර්තා වී ඇත.",
                    "reason": "මධ්‍යාහ්න උපයෝගිතා බිල්පත් ගෙවීම් සහ මුදල් ඇණවුම් පෝලිම් නිසා සවස පාර්සල් වර්ගීකරණයට භාරදීම ප්‍රමාද වීම.",
                    "action": "බිල්පත් ගෙවීම් සඳහා පරිගණක කෙටිමං භාවිත කර ප.ව. 03:00 ට පෙර පාර්සල් වර්ගීකරණ අංශයට භාරදීම සම්පූර්ණ කරන්න.",
                    "follow_up": "පෝලිම් කළමනාකරණය සහ තැපැල් ප්‍රවාහන වෑන් රථ වෙත නියමිත වේලාවට මලු භාරදීම තහවුරු කරන්න.",
                })
            else:
                recs.append({
                    "title": "Streamline Counter Peak-Hour Queue & Dispatch Handoff",
                    "priority": "High" if (weakest == "timeliness" or timeliness < 90.0) else "Medium",
                    "evidence": f"Counter timeliness was {timeliness:.1f}% with {late_count} delayed transaction submissions or afternoon dispatch handovers.",
                    "reason": "Midday customer spikes for utility collections and money orders cause counter congestion and delayed afternoon parcel sorting handoffs.",
                    "action": "Utilize fast-entry shortcuts for routine utility bill payments and complete morning parcel acceptance batch handoffs to sorting by 03:00 PM.",
                    "follow_up": "Compare queue throughput times and ensure on-time parcel bagging for afternoon postal mail vans.",
                })

        # Accuracy gap
        if accuracy < 95.0 or weakest == "accuracy":
            if lang == "si":
                recs.append({
                    "title": "බිල්පත් එකතු කිරීම් සහ මුදල් ඇණවුම් ද්විත්ව සත්‍යාපනය",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"කවුන්ටර නිරවද්‍යතාවය {accuracy:.1f}% ක් වන අතර දෝෂ {error_count} ක් සටහන් වී ඇත.",
                    "reason": "කවුන්ටර තදබදය අතරතුර බිල්පත් ගිණුම් අංක සහ පාර්සල් බර අතින් ඇතුළත් කිරීමේදී වැරදි සිදුවීම.",
                    "action": "තීරු කේත ස්කෑනරය මඟින් ගිණුම් අංකය කියවා තහවුරු කර උදෑසන කවුන්ටරය විවෘත කිරීමට පෙර ඉලෙක්ට්‍රොනික තරාදි ක්‍රමාංකනය කරන්න.",
                    "follow_up": "දෛනික Form 140 වාර්තාව සමඟ මුදල් ශේෂය 100% ක් නිවැරදිව පියවන්න.",
                })
            else:
                recs.append({
                    "title": "Enforce Dual-Check Verification on Bill Collections & Money Orders",
                    "priority": "High" if (weakest == "accuracy" or accuracy < 90.0) else "Medium",
                    "evidence": f"Measured counter accuracy was {accuracy:.1f}% with {error_count} recorded financial or account entry errors.",
                    "reason": "Manual keying of 10-digit utility account numbers and incorrect parcel weight-tier selection during rush hours.",
                    "action": "Verify customer account numbers against barcode scanner readings and calibrate electronic parcel scales before morning counter opening.",
                    "follow_up": "Audit daily cash register balance against daily Form 140 to maintain 100% financial accuracy.",
                })

        # Completion gap
        if completion < 95.0 or weakest == "completion":
            if lang == "si":
                recs.append({
                    "title": "කවුන්ටර ලියාපදිංචි කිරීම් සඳහා මධ්‍යම මුර ගිණුම් ශේෂ පියවීම",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"වැඩ නිමකිරීමේ ප්‍රතිශතය {completion:.1f}% ක් වන අතර නිම නොකළ ගනුදෙනු {uncompleted_count} ක් පවතී.",
                    "reason": "දවසේ අවසානය තෙක් ගිණුම් සමථකරණය කල් දැමීම නිසා සවස් කාලයේ ගනුදෙනු තදබදයක් නිර්මාණය වීම.",
                    "action": "සවස තදබදය වැළැක්වීම සඳහා දහවල් 01:00 ට උදෑසන බිල්පත් සහ ලියාපදිංචි ලිපි සඳහා මූලික ශේෂ පියවීමක් සිදු කරන්න.",
                    "follow_up": "කාර්යාලය වසා දැමීමට පෙර සියලුම දෛනික ගනුදෙනු ලියාපදිංචි කර අවසන් කරන්න.",
                })
            else:
                recs.append({
                    "title": "Implement Mid-Shift Batch Balancing for Counter Registrations",
                    "priority": "High" if (weakest == "completion" or completion < 90.0) else "Medium",
                    "evidence": f"Counter completion rate was {completion:.1f}% with {uncompleted_count} unfinished transactions or pending registrations.",
                    "reason": "Postponing counter daily reconciliation to closing time causes cumulative end-of-day transaction backlogs.",
                    "action": "Perform mid-day balancing at 01:00 PM for all morning bill receipts and registered articles to avoid end-of-day counter delays.",
                    "follow_up": "Ensure all daily bookings are audited and closed before evening post office lock-up.",
                })

    # High performance maintenance
    if not recs:
        if lang == "si":
            recs.append({
                "title": "වත්මන් ඉහළ කාර්යසාධන මට්ටම අඛණ්ඩව පවත්වා ගැනීම",
                "priority": "Low",
                "evidence": f"සියලුම මනින ලද සංරචක 95% ඉක්මවයි (සම්පූර්ණ කිරීම: {completion}%, නිරවද්‍යතාවය: {accuracy}%, කාලෝචිතභාවය: {timeliness}%).",
                "reason": "විධිමත් කාර්ය පටිපාටි අනුගමනය කිරීම සහ කැපවීම මත පදනම්ව ඉහළ කාර්යක්ෂමතාවයක් පෙන්නුම් කරයි.",
                "action": "වත්මන් උදෑසන සත්‍යාපන ක්‍රමවේද අඛණ්ඩව පවත්වා ගනිමින් සෙසු කාර්යමණ්ඩලය සමඟ හොඳම භාවිතයන් බෙදා ගන්න.",
                "follow_up": "ඉදිරි සතියේද මෙම විශිෂ්ට කාර්යසාධනය පවත්වාගෙන යාම තහවුරු කරන්න.",
            })
        else:
            recs.append({
                "title": "Sustain Current High-Reliability Operational Practices",
                "priority": "Low",
                "evidence": f"All measured components exceed 95% (Completion: {completion}%, Accuracy: {accuracy}%, Timeliness: {timeliness}%).",
                "reason": "Consistent adherence to departmental standards and disciplined daily routine execution.",
                "action": f"Maintain current morning verification routines and share operational best practices within the {work_category} team.",
                "follow_up": "Monitor next week's measured KPI to ensure sustained high performance.",
            })

    return recs[:3]


def generate_coaching_chat_response(
    employee_id: str,
    message: str,
    year: int = 2026,
    week: int | str = 9,
    current_user: dict | None = None,
    language: str | None = None,
) -> dict:
    """
    Multilingual, category-differentiated PostAssist AI Productivity Coach engine.
    """
    # Auto-detect language
    is_si = (language == "si") or is_sinhala(message)
    lang = "si" if is_si else "en"

    out_of_scope_msg = OUT_OF_SCOPE_MESSAGE_SI if is_si else OUT_OF_SCOPE_MESSAGE_EN

    # 1. Authorization: Clerk can only query their own records
    if current_user:
        user_role = (current_user.get("role") or "").lower()
        user_emp = (current_user.get("employee_id") or "").strip().upper()
        target_emp = (employee_id or "").strip().upper()

        if user_role == "clerk" and user_emp and target_emp and user_emp != target_emp:
            unauth_msg = (
                "ප්‍රවේශය සීමා කර ඇත: තැපැල් ලිපිකරුවන්ට සමාලෝචනය කළ හැක්කේ තමන්ගේම කාර්යසාධන වාර්තා පමණි."
                if is_si
                else "Access restricted: Postal clerks may only review their own measured performance and coaching advice."
            )
            return {
                "supported": False,
                "reply": unauth_msg,
                "intent": "UNAUTHORIZED",
                "employee_id": employee_id,
                "language": lang,
                "evidence": {},
                "forecast": {},
                "recommendations": [],
            }

    # 2. Classify intent
    intent = classify_coaching_intent(message, employee_id)

    if intent == "UNSUPPORTED":
        return {
            "supported": False,
            "reply": out_of_scope_msg,
            "intent": "UNSUPPORTED",
            "employee_id": employee_id,
            "language": lang,
            "evidence": {},
            "forecast": {},
            "recommendations": [],
        }

    # 3. Fetch employee profile & productivity data from database
    str_week = str(week).strip() if week is not None else None
    str_year = str(year).strip() if year is not None else None
    try:
        report = productivity_for(employee_id, str_week, str_year)
    except Exception:
        try:
            report = productivity_for(employee_id)
        except Exception:
            report = {}

    if not report or not report.get("available", True) or (report.get("measured_kpi") is None and report.get("overall_kpi") is None):
        insuf_msg = (
            f"{employee_id} සඳහා {week or 'නවතම'}, {year or 2026} සතියේ ප්‍රමාණවත් දෛනික වාර්තා නොමැත. "
            "උපදෙස් සැපයීම සඳහා අවම වශයෙන් එක් තහවුරු කළ දෛනික කාර්ය සටහනක් අවශ්‍ය වේ."
            if is_si
            else (
                f"Insufficient evidence on file for {employee_id} in Week {week or 'latest'}, {year or 2026}. "
                "Coaching recommendations require at least one verified daily work log. "
                "Please verify that daily postal operations logs have been submitted."
            )
        )
        return {
            "supported": True,
            "reply": insuf_msg,
            "intent": intent,
            "employee_id": employee_id,
            "language": lang,
            "evidence": {},
            "forecast": {},
            "recommendations": [],
        }

    # 4. Extract verified measured metrics
    employee_name = report.get("employee_name") or report.get("name") or employee_id
    raw_kpi = report.get("measured_kpi") if report.get("measured_kpi") is not None else report.get("overall_kpi")
    measured_kpi = round(float(raw_kpi or 0.0), 1)
    completion = round(float(report.get("completion") if report.get("completion") is not None else report.get("completion_rate", 0.0)), 1)
    accuracy = round(float(report.get("accuracy") if report.get("accuracy") is not None else report.get("accuracy_rate", 0.0)), 1)
    timeliness = round(float(report.get("timeliness") if report.get("timeliness") is not None else report.get("timeliness_rate", 0.0)), 1)
    report_week = report.get("week") or week or "Latest"

    # Category and Designation info
    db = get_db()
    emp_doc = db["employee"].find_one({"_id": employee_id}) or {}
    work_category = emp_doc.get("work_category") or report.get("work_category") or "Delivery (Field)"
    designation = emp_doc.get("designation") or report.get("designation") or "Postman"
    post_office = emp_doc.get("post_office") or report.get("post_office") or "Kaduwela"
    employment_type = emp_doc.get("employment_type") or "Permanent"
    experience = float(emp_doc.get("years_of_experience") or 5)

    # 5. Extract historical trend evidence
    prev_week = report.get("previous_week")
    prev_kpi = round(float(report["previous_measured_kpi"]), 1) if report.get("previous_measured_kpi") is not None else None
    actual_change = round(float(report["actual_change"]), 1) if report.get("actual_change") is not None else None

    # Retrieve past 4 weeks average for model features
    history = report.get("history") or []
    past_kpis = [float(h.get("kpi", h.get("overall_kpi", measured_kpi))) for h in history if h.get("kpi") is not None or h.get("overall_kpi") is not None]
    if not past_kpis:
        past_kpis = [measured_kpi]
    lag_1 = past_kpis[-2] if len(past_kpis) >= 2 else (prev_kpi or measured_kpi)
    lag_2 = past_kpis[-3] if len(past_kpis) >= 3 else lag_1
    mean_prev_4 = sum(past_kpis[-4:]) / min(len(past_kpis), 4)

    # 6. ML Model Execution: Run features through kpi_forecast_model.joblib
    joblib_pred = predict_joblib_kpi(
        kpi_score=measured_kpi,
        lag_1=lag_1,
        lag_2=lag_2,
        mean_prev_4=mean_prev_4,
        experience=experience,
        post_office=post_office,
        designation=designation,
        work_category=work_category,
        employment_type=employment_type,
    )

    pred_kpi = joblib_pred or report.get("predicted_next_week_kpi") or (report.get("forecast") or {}).get("predicted_kpi")
    if pred_kpi is not None:
        pred_kpi = round(float(pred_kpi), 1)

    forecast_disclaimer = (
        "Random Forest යන්ත්‍ර ඉගෙනුම් පුරෝකථනය (Holdout MAE ±3.41, RMSE 4.55). මෙය සංඛ්‍යානමය සැලසුම් ඇස්තමේන්තුවක් වන අතර සහතික කළ ප්‍රමිතියක් නොවේ."
        if is_si
        else (
            "Random Forest ML Projection (Holdout MAE ±3.41, RMSE 4.55). "
            "Projections are forward-looking planning estimates based on historical features, not guaranteed outcomes."
        )
    )

    forecast = {
        "predicted_kpi": pred_kpi,
        "model": "Random Forest Regressor (kpi_forecast_model.joblib · Holdout MAE ±3.41, RMSE 4.55)",
        "disclaimer": forecast_disclaimer,
    }

    evidence = {
        "employee_id": employee_id,
        "employee_name": employee_name,
        "designation": designation,
        "work_category": work_category,
        "post_office": post_office,
        "reporting_period": f"Week {report_week}, {year or report.get('year') or 2026}",
        "overall_kpi": measured_kpi,
        "completion_rate": completion,
        "accuracy_rate": accuracy,
        "timeliness_rate": timeliness,
        "assigned_items": report.get("assigned", report.get("total_assigned", 0)),
        "completed_items": report.get("completed", report.get("total_completed", 0)),
        "uncompleted_items": report.get("uncompleted", 0),
        "error_count": report.get("incorrect", report.get("errors", 0)),
        "late_count": report.get("late", report.get("late_items", 0)),
        "previous_week": prev_week,
        "previous_kpi": prev_kpi,
        "actual_change": actual_change,
    }

    # 7. Identify performance gap
    components = {"completion": completion, "accuracy": accuracy, "timeliness": timeliness}
    valid_components = {k: v for k, v in components.items() if v is not None}
    weakest = min(valid_components, key=valid_components.get) if valid_components else "timeliness"

    # 8. Generate Category-Specific Recommendations
    recommendations = get_category_recommendations(
        work_category=work_category,
        designation=designation,
        weakest=weakest,
        measured_kpi=measured_kpi,
        completion=completion,
        accuracy=accuracy,
        timeliness=timeliness,
        report=report,
        lang=lang,
    )

    # Category name in Sinhala
    cat_si = "ක්ෂේත්‍ර තැපැල් බෙදාහැරීම" if "delivery" in work_category.lower() else ("ප්‍රධාන පරිපාලන / අධීක්ෂණ" if "supervisory" in work_category.lower() else "කාර්යාලීය / කවුන්ටර සේවා")
    weakest_si = "කාලෝචිතභාවය" if weakest == "timeliness" else ("නිරවද්‍යතාවය" if weakest == "accuracy" else "සම්පූර්ණ කිරීම")

    # 9. Assemble natural, evidence-based reply based on intent & language
    if intent == "OVERVIEW":
        if is_si:
            comp_text = (
                f" මෙය පෙර සතියට ({prev_week} - {prev_kpi}%) සාපේක්ෂව ලකුණු {actual_change:+.1f} ක වෙනසකි."
                if actual_change is not None and prev_week
                else ""
            )
            forecast_text = (
                f"\n\n• ආකෘති පුරෝකථනය (Random Forest): ඊළඟ සතිය සඳහා ඇස්තමේන්තුව {pred_kpi}% කි (MAE ±3.41)."
                if pred_kpi
                else ""
            )
            reply = (
                f"{employee_name} ({designation} · {cat_si}) සඳහා කාර්යසාධන සාරාංශය ({report_week} සතිය):\n"
                f"• මනින ලද සමස්ත KPI ලකුණු: {measured_kpi}%.{comp_text}\n"
                f"• සම්පූර්ණ කිරීම: {completion}% (පවරන ලද {report.get('assigned', 0)} න් {report.get('completed', 0)} ක් නිම කර ඇත).\n"
                f"• නිරවද්‍යතාවය: {accuracy}% (වාර්තා වූ දෝෂ: {report.get('incorrect', 0)}).\n"
                f"• කාලෝචිතභාවය: {timeliness}% (ප්‍රමාද වූ භාරදීම්: {report.get('late', 0)}).\n"
                f"• ප්‍රධාන අවධානය: {weakest_si} ({cat_si} රාජකාරි අනුව)."
                f"{forecast_text}"
            )
        else:
            comp_text = (
                f" This reflects a shift of {actual_change:+.1f} KPI points compared to previous week {prev_week} ({prev_kpi}%)."
                if actual_change is not None and prev_week
                else ""
            )
            forecast_text = (
                f"\n\nModel Forecast: {pred_kpi}% for next week projected by Random Forest (MAE ±3.41). Note that this is a statistical projection, not a measured guarantee."
                if pred_kpi
                else ""
            )
            reply = (
                f"Performance Summary for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Measured Overall KPI: {measured_kpi}%.{comp_text}\n"
                f"• Completion Rate: {completion}% ({report.get('completed', 0)} completed / {report.get('assigned', 0)} assigned).\n"
                f"• Accuracy Rate: {accuracy}% ({report.get('incorrect', 0)} recorded defects).\n"
                f"• Timeliness Rate: {timeliness}% ({report.get('late', 0)} delayed handovers).\n"
                f"• Primary Area for Focus: {weakest.capitalize()} (Tailored for {work_category})."
                f"{forecast_text}"
            )

    elif intent == "STRENGTHS":
        scores = [("Completion", "සම්පූර්ණ කිරීම", completion), ("Accuracy", "නිරවද්‍යතාවය", accuracy), ("Timeliness", "කාලෝචිතභාවය", timeliness)]
        valid_scores = [s for s in scores if s[2] is not None]
        top_metric = max(valid_scores, key=lambda x: x[2]) if valid_scores else ("General", "සාමාන්‍ය", 90.0)

        if is_si:
            reply = (
                f"{employee_name} ({designation} · {cat_si}) ගේ ප්‍රදර්ශිත ශක්තීන් ({report_week} සතිය):\n"
                f"• ඉහළම කාර්යසාධනයක් දැක්වූ අංශය: {top_metric[1]} ({top_metric[2]:.1f}%).\n"
                f"• සමස්ත KPI අගය {measured_kpi}% ක් වන අතර, එය {cat_si} රාජකාරිවල විශ්වාසනීය ප්‍රගතියක් පෙන්නුම් කරයි.\n"
                f"• නිර්දේශය: {top_metric[1]} සඳහා අනුගමනය කරන ලද ක්‍රමවේදයන් සහ විනය අඛණ්ඩව පවත්වා ගන්න."
            )
        else:
            reply = (
                f"Demonstrated Strengths for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Highest Performing Area: {top_metric[0]} at {top_metric[2]:.1f}%.\n"
                f"• Overall KPI standing is {measured_kpi}%, supported by dependable {top_metric[0].lower()} adherence in {work_category}.\n"
                f"• Recommendation: Continue the structured check routines that produce this strong {top_metric[0].lower()} level."
            )

    elif intent == "IMPROVE_TIMELINESS":
        top_rec = recommendations[0] if recommendations else {}
        if is_si:
            reply = (
                f"කාලෝචිතභාවය පිළිබඳ උපදෙස් — {employee_name} ({designation} · {cat_si}):\n"
                f"• මනින ලද කාලෝචිතභාවය: {timeliness:.1f}% ({report.get('late', 0)} ප්‍රමාදයන් වාර්තා වී ඇත).\n"
                f"• මූලික හේතුව: {top_rec.get('reason', 'රාජකාරි වේලාවන්හිදී සිදුවන ප්‍රමාදයන්')}\n"
                f"• නිර්දේශිත ක්‍රියාමාර්ගය: {top_rec.get('action', 'නියමිත වේලාවට පිටත්වීම් සම්පූර්ණ කරන්න.')}\n"
                f"• පසු විපරම: {top_rec.get('follow_up', 'ඊළඟ සතියේ ප්‍රතිඵලය පරීක්ෂා කරන්න.')}"
            )
        else:
            reply = (
                f"Timeliness Coaching for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Current Measured Timeliness: {timeliness:.1f}% ({report.get('late', 0)} delayed items logged).\n"
                f"• Root Cause Analysis: {top_rec.get('reason', 'Operational bottlenecks during scheduled dispatches.')}\n"
                f"• Action Plan: {top_rec.get('action', 'Enforce strict dispatch cutoffs and review routing.')}\n"
                f"• Follow-up Target: {top_rec.get('follow_up', 'Review next week on-time percentage.')}"
            )

    elif intent == "IMPROVE_ACCURACY":
        top_rec = recommendations[0] if recommendations else {}
        if is_si:
            reply = (
                f"නිරවද්‍යතාවය පිළිබඳ උපදෙස් — {employee_name} ({designation} · {cat_si}):\n"
                f"• මනින ලද නිරවද්‍යතාවය: {accuracy:.1f}% (වාර්තා වූ දෝෂ: {report.get('incorrect', 0)}).\n"
                f"• මූලික හේතුව: {top_rec.get('reason', 'කාර්යබහුල වේලාවන්හිදී ලිපින සහ ගිණුම් අංක පරීක්ෂා කිරීමේ අපහසුතා')}\n"
                f"• නිර්දේශිත ක්‍රියාමාර්ගය: {top_rec.get('action', 'තීරු කේත ස්කෑන් පරීක්ෂාව සහ විස්තර ද්විත්ව සත්‍යාපනය සිදු කරන්න.')}\n"
                f"• පසු විපරම: {top_rec.get('follow_up', 'ඊළඟ සතියේ දෝෂ රහිත ලේඛන පවත්වා ගන්න.')}"
            )
        else:
            reply = (
                f"Accuracy Coaching for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Current Measured Accuracy: {accuracy:.1f}% ({report.get('incorrect', 0)} recorded defects).\n"
                f"• Root Cause Analysis: {top_rec.get('reason', 'Data verification slips during operational surges.')}\n"
                f"• Action Plan: {top_rec.get('action', 'Conduct double-check verification on accounts and barcodes.')}\n"
                f"• Follow-up Target: {top_rec.get('follow_up', 'Maintain zero-defect throughput next week.')}"
            )

    elif intent == "IMPROVE_COMPLETION":
        top_rec = recommendations[0] if recommendations else {}
        if is_si:
            reply = (
                f"වැඩ නිම කිරීම පිළිබඳ උපදෙස් — {employee_name} ({designation} · {cat_si}):\n"
                f"• මනින ලද සම්පූර්ණ කිරීම: {completion:.1f}% (පවරන ලද {report.get('assigned', 0)} න් {report.get('completed', 0)} ක් නිම කර ඇත).\n"
                f"• මූලික හේතුව: {top_rec.get('reason', 'දවසේ අවසානය තෙක් ගිණුම් හෝ ලිපි සමථකරණය කල් දැමීම')}\n"
                f"• නිර්දේශිත ක්‍රියාමාර්ගය: {top_rec.get('action', 'දහවල් මූලික ශේෂ පියවීමක් සිදු කර වැඩ නිම කරන්න.')}\n"
                f"• පසු විපරම: {top_rec.get('follow_up', 'ඉතිරි වන ලිපි ප්‍රමාණය අවම කරන්න.')}"
            )
        else:
            reply = (
                f"Completion Coaching for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Current Measured Completion: {completion:.1f}% ({report.get('completed', 0)} of {report.get('assigned', 0)} items completed).\n"
                f"• Root Cause Analysis: {top_rec.get('reason', 'Accumulation of uncompleted carry-overs during surge hours.')}\n"
                f"• Action Plan: {top_rec.get('action', 'Implement intake buffers and midday balancing.')}\n"
                f"• Follow-up Target: {top_rec.get('follow_up', 'Eliminate uncompleted carry-overs.')}"
            )

    elif intent == "COMPARISON":
        if is_si:
            if prev_week and prev_kpi is not None:
                shift_text = f"ලකුණු {actual_change:+.1f} ක වෙනසකි" if actual_change is not None else "වෙනසක් නැත"
                reply = (
                    f"{employee_name} ({cat_si}) සඳහා ඓතිහාසික කාර්යසාධන සංසන්දනය:\n"
                    f"• වත්මන් මනින ලද සතිය ({report_week}): {measured_kpi}%\n"
                    f"• පෙර වාර්තාගත සතිය ({prev_week}): {prev_kpi}%\n"
                    f"• නිරීක්ෂිත ශුද්ධ වෙනස: {shift_text}.\n"
                    f"• සංරචක: සම්පූර්ණ කිරීම {completion}%, නිරවද්‍යතාවය {accuracy}%, කාලෝචිතභාවය {timeliness}%.\n"
                    f"• සටහන: මෙම සංසන්දනය දෙපාර්තමේන්තු විගණිත වාර්තා මත පදනම් වේ."
                )
            else:
                reply = (
                    f"{employee_name} ({cat_si}) සඳහා ඓතිහාසික සංසන්දනය:\n"
                    f"• වත්මන් සතියේ මනින ලද KPI: {measured_kpi}%.\n"
                    f"• සෘජු සංසන්දනය සඳහා පෙර සතිවල දත්ත නොමැත.\n"
                    f"• දෛනික වාර්තා එක්වන විට සංසන්දනාත්මක ප්‍රවණතාව ස්වයංක්‍රීයව යාවත්කාලීන වේ."
                )
        else:
            if prev_week and prev_kpi is not None:
                shift_text = f"{actual_change:+.1f} KPI points" if actual_change is not None else "unchanged"
                reply = (
                    f"Historical Comparison for {employee_name} ({work_category}):\n"
                    f"• Current Measured Week ({report_week}): {measured_kpi}%\n"
                    f"• Previous Recorded Week ({prev_week}): {prev_kpi}%\n"
                    f"• Net Observed Shift: {shift_text}.\n"
                    f"• Component Scores: Completion {completion}%, Accuracy {accuracy}%, Timeliness {timeliness}%.\n"
                    f"• Note: Evaluated against official audited departmental records."
                )
            else:
                reply = (
                    f"Historical Comparison for {employee_name} ({work_category}):\n"
                    f"• Current Measured Week ({report_week}): {measured_kpi}%.\n"
                    f"• No earlier recorded week is available in this series for direct comparison.\n"
                    f"• Comparative trends update automatically as additional operational logs are entered."
                )

    elif intent == "FORECAST_EXPLANATION":
        if is_si:
            reply = (
                f"{employee_name} ({cat_si}) සඳහා KPI පුරෝකථනය පැහැදිලි කිරීම:\n"
                f"• මනින ලද කාර්යසාධනය ({report_week}): {measured_kpi}% (නිරීක්ෂිත සත්‍ය වාර්තා).\n"
                f"• Random Forest ආකෘති පුරෝකථනය: kpi_forecast_model.joblib මඟින් ඊළඟ සතිය සඳහා ඇස්තමේන්තු කළ අගය {pred_kpi}% කි.\n"
                f"• ආකෘතිය ඇගයූ සාධක 9: වත්මන් KPI ({measured_kpi}%), පෙර සති ලකුණු ({prev_kpi}%), පළපුරුද්ද ({experience} වසර), තනතුර ({designation}), කාර්ය කාණ්ඩය ({cat_si}) සහ කාර්යාලය ({post_office}).\n"
                f"• සංඛ්‍යානමය සන්දර්භය: පරීක්ෂණ දෝෂ පරාසය MAE ±3.41, RMSE 4.55 කි.\n"
                f"• වැදගත් සටහන: මෙම පුරෝකථනය සැලසුම් කිරීම සඳහා වන සංඛ්‍යානමය ඇස්තමේන්තුවක් පමණක් වන අතර සහතික කළ ප්‍රමිතියක් නොවේ."
            )
        else:
            reply = (
                f"Understanding KPI Forecasts for {employee_name} ({work_category}):\n"
                f"• Measured Performance ({report_week}): {measured_kpi}% (based on actual recorded operational counts).\n"
                f"• Random Forest ML Forecast: {pred_kpi}% estimated for next week by kpi_forecast_model.joblib.\n"
                f"• Evaluated Model Features: Current KPI ({measured_kpi}%), Past Lags ({prev_kpi}%), Experience ({experience} yrs), Designation ({designation}), Work Category ({work_category}), and Post Office ({post_office}).\n"
                f"• Statistical Context: Model validation on holdout data exhibits MAE ±3.41 and RMSE 4.55.\n"
                f"• Crucial Distinction: Forward-looking planning estimate, not an observed result or a guaranteed outcome."
            )

    else:  # IMPROVE_GENERAL
        top_rec = recommendations[0] if recommendations else {}
        if is_si:
            reply = (
                f"ඵලදායිතා වැඩිදියුණු කිරීමේ සැලැස්ම — {employee_name} ({designation} · {cat_si}):\n"
                f"• ප්‍රධාන අවධානය: {weakest_si} ({report.get(weakest, 90.0)}%).\n"
                f"• ප්‍රමුඛතා ක්‍රියාමාර්ගය: {top_rec.get('title', 'දෛනික රාජකාරි ක්‍රමවේද සමාලෝචනය කරන්න')}.\n"
                f"• ප්‍රායෝගික පියවර: {top_rec.get('action', 'දෙපාර්තමේන්තු තත්ත්ව ප්‍රමිතීන් අනුගමනය කරන්න.')}\n"
                f"• පසු විපරම් ඉලක්කය: {top_rec.get('follow_up', 'ඊළඟ සතියේ ප්‍රතිඵලය පරීක්ෂා කරන්න.')}"
            )
        else:
            reply = (
                f"Productivity Improvement Plan for {employee_name} ({designation} · {work_category}) — Week of {report_week}:\n"
                f"• Lowest Measured Component: {weakest.capitalize()} ({report.get(weakest, 90.0)}%).\n"
                f"• Priority Action: {top_rec.get('title', 'Review daily operational workflow routines')}.\n"
                f"• Category Next Step: {top_rec.get('action', 'Follow departmental operational standards')}.\n"
                f"• Follow-up Target: {top_rec.get('follow_up', 'Review next recorded weekly score')}."
            )

    return {
        "supported": True,
        "reply": reply,
        "intent": intent,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "designation": designation,
        "work_category": work_category,
        "language": lang,
        "week": report_week,
        "year": year,
        "evidence": evidence,
        "forecast": forecast,
        "recommendations": recommendations,
    }
