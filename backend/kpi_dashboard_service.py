"""
kpi_dashboard_service.py
PostAssist LK — Comprehensive KPI Dashboard Service.
Aggregates employee performance, workload, attendance, historical trends,
and ML forecast telemetry from MongoDB collections.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from db import get_db

PROVISIONAL_WEIGHTS = {
    "completion": 0.40,
    "accuracy": 0.30,
    "timeliness": 0.30,
}

KPI_TARGET = 80.0
KPI_REVIEW_THRESHOLD = 70.0


def _num(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        val = float(value)
        return None if val != val else val
    except (TypeError, ValueError):
        return None


def _calc_kpi(comp: Optional[float], acc: Optional[float], time_val: Optional[float]) -> Optional[float]:
    if comp is None or acc is None or time_val is None:
        return None
    score = (
        PROVISIONAL_WEIGHTS["completion"] * comp
        + PROVISIONAL_WEIGHTS["accuracy"] * acc
        + PROVISIONAL_WEIGHTS["timeliness"] * time_val
    )
    return round(max(0.0, min(100.0, score)), 2)


def _classify_status(score: Optional[float]) -> str:
    if score is None:
        return "Not Evaluated"
    if score >= KPI_TARGET:
        return "On Track"
    if score >= KPI_REVIEW_THRESHOLD:
        return "Needs Improvement"
    return "Poor"


def get_dashboard_data(
    period_type: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    post_office: Optional[str] = None,
    employee_id: Optional[str] = None,
    designation: Optional[str] = None,
    category: Optional[str] = None,
    performance_status: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_db()

    # 1. Fetch eligible employees
    emp_query = {}
    if post_office and post_office.strip():
        emp_query["post_office"] = post_office.strip()
    if designation and designation.strip():
        emp_query["designation"] = designation.strip()
    if category and category.strip():
        emp_query["work_category"] = category.strip()
    if employee_id and employee_id.strip():
        emp_query["$or"] = [{"_id": employee_id.strip()}, {"employee_id": employee_id.strip()}]

    employees = list(db["employee"].find(emp_query))
    if not employees and not emp_query:
        employees = list(db["employee"].find())

    emp_map = {}
    for e in employees:
        eid = e.get("employee_id") or e.get("_id")
        emp_map[eid] = {
            "employee_id": eid,
            "employee_name": e.get("employee_name") or eid,
            "post_office": e.get("post_office") or "Central Post Office",
            "designation": e.get("designation") or "Postal Officer",
            "work_category": e.get("work_category") or "Operations",
            "department": e.get("department") or "Postal Operations",
            "employment_type": e.get("employment_type") or "Permanent",
            "years_of_experience": _num(e.get("years_of_experience")) or 5.0,
        }

    eligible_ids = set(emp_map.keys())

    # 2. Determine date filters
    # If no date supplied and period_type is 'all', look across all available logs
    log_query = {}
    if eligible_ids:
        log_query["employee_id"] = {"$in": list(eligible_ids)}

    all_logs = list(db["daily_kpi_log"].find(log_query))
    all_dates = sorted({str(l.get("date") or "")[:10] for l in all_logs if l.get("date")})

    # Period resolution
    filter_start = str(start_date or "")[:10] if start_date else None
    filter_end = str(end_date or "")[:10] if end_date else None

    if period_type == "daily":
        if not filter_start:
            filter_start = all_dates[-1] if all_dates else "2026-10-28"
        filter_end = filter_start
    elif period_type == "weekly":
        if not filter_end:
            filter_end = all_dates[-1] if all_dates else "2025-12-19"
        try:
            end_d = date.fromisoformat(filter_end)
            filter_start = (end_d - timedelta(days=6)).isoformat()
        except ValueError:
            pass
    elif period_type == "monthly":
        if not filter_end:
            filter_end = all_dates[-1] if all_dates else "2025-12-19"
        try:
            end_d = date.fromisoformat(filter_end)
            filter_start = (end_d - timedelta(days=29)).isoformat()
        except ValueError:
            pass
    elif period_type == "quarterly":
        if not filter_end:
            filter_end = all_dates[-1] if all_dates else "2025-12-19"
        try:
            end_d = date.fromisoformat(filter_end)
            filter_start = (end_d - timedelta(days=89)).isoformat()
        except ValueError:
            pass

    # Filter logs for selected period
    period_logs = []
    prev_period_logs = []

    # Calculate previous period window for comparison
    prev_start, prev_end = None, None
    if filter_start and filter_end:
        try:
            d_start = date.fromisoformat(filter_start)
            d_end = date.fromisoformat(filter_end)
            window_days = (d_end - d_start).days + 1
            prev_end = (d_start - timedelta(days=1)).isoformat()
            prev_start = (d_start - timedelta(days=window_days)).isoformat()
        except ValueError:
            pass

    for l in all_logs:
        ldate = str(l.get("date") or "")[:10]
        if not ldate:
            continue
        if filter_start and ldate < filter_start:
            if prev_start and prev_end and prev_start <= ldate <= prev_end:
                prev_period_logs.append(l)
            continue
        if filter_end and ldate > filter_end:
            continue
        period_logs.append(l)

    # 3. Aggregate performance by employee for the period
    emp_aggregates = {}
    for eid, emp_info in emp_map.items():
        emp_aggregates[eid] = {
            **emp_info,
            "period": f"{filter_start or (all_dates[0] if all_dates else '')} to {filter_end or (all_dates[-1] if all_dates else '')}".strip(" to "),
            "assigned_tasks": 0,
            "completed_tasks": 0,
            "uncompleted_tasks": 0,
            "correct_tasks": 0,
            "incorrect_tasks": 0,
            "on_time_tasks": 0,
            "late_tasks": 0,
            "days_logged": 0,
            "last_evaluation_date": None,
            "raw_kpi_scores": [],
        }

    for l in period_logs:
        eid = str(l.get("employee_id") or "")
        if eid not in emp_aggregates:
            continue
        agg = emp_aggregates[eid]
        assigned = _num(l.get("assigned_work_count")) or 0.0
        completed = _num(l.get("completed_work_count")) or 0.0
        uncompleted = _num(l.get("uncompleted_work_count")) or max(0.0, assigned - completed)
        correct = _num(l.get("correct_work_count")) or 0.0
        incorrect = _num(l.get("incorrect_work_count")) or max(0.0, completed - correct)
        on_time = _num(l.get("on_time_work_count")) or 0.0
        late = _num(l.get("late_work_count")) or max(0.0, completed - on_time)

        agg["assigned_tasks"] += int(assigned)
        agg["completed_tasks"] += int(completed)
        agg["uncompleted_tasks"] += int(uncompleted)
        agg["correct_tasks"] += int(correct)
        agg["incorrect_tasks"] += int(incorrect)
        agg["on_time_tasks"] += int(on_time)
        agg["late_tasks"] += int(late)
        agg["days_logged"] += 1

        ldate = str(l.get("date") or "")[:10]
        if not agg["last_evaluation_date"] or ldate > agg["last_evaluation_date"]:
            agg["last_evaluation_date"] = ldate

        kpi_val = _num(l.get("kpi_score"))
        if kpi_val is not None:
            agg["raw_kpi_scores"].append(kpi_val)

    # Calculate previous period KPIs for comparison
    prev_emp_kpis = {}
    for l in prev_period_logs:
        eid = str(l.get("employee_id") or "")
        kpi_val = _num(l.get("kpi_score"))
        if eid and kpi_val is not None:
            prev_emp_kpis.setdefault(eid, []).append(kpi_val)

    # 4. Pull latest ML forecast records from kpi_model_forecast
    forecast_map = {}
    for fc in db["kpi_model_forecast"].find({"employee_id": {"$in": list(eligible_ids)}}):
        eid = str(fc.get("employee_id") or "")
        existing = forecast_map.get(eid)
        if not existing or (fc.get("source_week") or "") > (existing.get("source_week") or ""):
            forecast_map[eid] = fc

    # 5. Finalize employee row records
    employee_rows = []
    evaluated_count = 0
    total_active = len(emp_map)
    total_assigned = 0
    total_completed = 0
    total_pending = 0
    total_overdue = 0

    valid_kpis = []
    valid_completions = []
    valid_accuracies = []
    valid_timeliness = []

    for eid, agg in emp_aggregates.items():
        total_assigned += agg["assigned_tasks"]
        total_completed += agg["completed_tasks"]
        total_pending += agg["uncompleted_tasks"]
        total_overdue += agg["late_tasks"]

        if agg["days_logged"] > 0:
            comp_rate = round((agg["completed_tasks"] / agg["assigned_tasks"] * 100), 2) if agg["assigned_tasks"] > 0 else 100.0
            acc_rate = round((agg["correct_tasks"] / agg["completed_tasks"] * 100), 2) if agg["completed_tasks"] > 0 else 100.0
            time_rate = round((agg["on_time_tasks"] / agg["completed_tasks"] * 100), 2) if agg["completed_tasks"] > 0 else 100.0
            kpi_score = _calc_kpi(comp_rate, acc_rate, time_rate)

            # Fallback to mean of raw logs if task counts were 0
            if kpi_score is None and agg["raw_kpi_scores"]:
                kpi_score = round(sum(agg["raw_kpi_scores"]) / len(agg["raw_kpi_scores"]), 2)
        else:
            comp_rate, acc_rate, time_rate, kpi_score = None, None, None, None

        # Previous period score
        prev_scores = prev_emp_kpis.get(eid, [])
        prev_kpi = round(sum(prev_scores) / len(prev_scores), 2) if prev_scores else None
        kpi_change = round(kpi_score - prev_kpi, 2) if (kpi_score is not None and prev_kpi is not None) else None

        status = _classify_status(kpi_score)
        if kpi_score is not None:
            evaluated_count += 1
            valid_kpis.append(kpi_score)
            if comp_rate is not None:
                valid_completions.append(comp_rate)
            if acc_rate is not None:
                valid_accuracies.append(acc_rate)
            if time_rate is not None:
                valid_timeliness.append(time_rate)

        # Forecast link
        fc = forecast_map.get(eid)
        forecast_info = None
        if fc:
            forecast_info = {
                "source_week": fc.get("source_week"),
                "forecast_week": fc.get("forecast_week"),
                "latest_actual_kpi": fc.get("latest_actual_kpi"),
                "predicted_kpi": fc.get("predicted_kpi"),
                "predicted_change": fc.get("predicted_change"),
                "monitoring_category": fc.get("monitoring_category"),
                "recommendation": fc.get("recommendation"),
            }

        # Filter by performance status if requested
        if performance_status and performance_status.strip().lower() != "all":
            ps = performance_status.strip().lower().replace(" ", "_")
            stat_slug = status.lower().replace(" ", "_")
            if ps != stat_slug:
                continue

        employee_rows.append({
            "employee_id": eid,
            "employee_name": agg["employee_name"],
            "designation": agg["designation"],
            "post_office": agg["post_office"],
            "work_category": agg["work_category"],
            "employment_type": agg["employment_type"],
            "years_of_experience": agg["years_of_experience"],
            "period": agg["period"],
            "completion_rate": comp_rate,
            "accuracy_rate": acc_rate,
            "timeliness_rate": time_rate,
            "kpi_score": kpi_score,
            "previous_kpi": prev_kpi,
            "kpi_change": kpi_change,
            "assigned_tasks": agg["assigned_tasks"],
            "completed_tasks": agg["completed_tasks"],
            "pending_tasks": agg["uncompleted_tasks"],
            "overdue_tasks": agg["late_tasks"],
            "days_logged": agg["days_logged"],
            "attendance_summary": f"{agg['days_logged']} Days Logged" if agg["days_logged"] > 0 else "No Attendance Recorded",
            "performance_status": status,
            "last_evaluation_date": agg["last_evaluation_date"],
            "forecast": forecast_info,
        })

    # Sort employee rows
    employee_rows.sort(key=lambda r: (r.get("performance_status") == "Not Evaluated", -(r.get("kpi_score") or -1), r.get("employee_name") or ""))

    # 6. Performance Distribution
    on_track_count = sum(1 for r in employee_rows if r["performance_status"] == "On Track")
    needs_imp_count = sum(1 for r in employee_rows if r["performance_status"] == "Needs Improvement")
    poor_count = sum(1 for r in employee_rows if r["performance_status"] == "Poor")
    unevaluated_count = total_active - evaluated_count

    distribution = {
        "on_track": {"count": on_track_count, "percentage": round(on_track_count / total_active * 100, 1) if total_active else 0.0},
        "needs_improvement": {"count": needs_imp_count, "percentage": round(needs_imp_count / total_active * 100, 1) if total_active else 0.0},
        "poor": {"count": poor_count, "percentage": round(poor_count / total_active * 100, 1) if total_active else 0.0},
        "unevaluated": {"count": unevaluated_count, "percentage": round(unevaluated_count / total_active * 100, 1) if total_active else 0.0},
    }

    # 7. Summary Cards (15 metrics)
    avg_kpi = round(sum(valid_kpis) / len(valid_kpis), 2) if valid_kpis else None
    avg_comp = round(sum(valid_completions) / len(valid_completions), 2) if valid_completions else None
    avg_acc = round(sum(valid_accuracies) / len(valid_accuracies), 2) if valid_accuracies else None
    avg_time = round(sum(valid_timeliness) / len(valid_timeliness), 2) if valid_timeliness else None

    # Attendance rate calculation across logged days vs working days in period
    total_days_logged = sum(r["days_logged"] for r in employee_rows)
    # Estimate expected shifts if window is known
    expected_shifts = total_active * 5  # default 1 week
    if filter_start and filter_end:
        try:
            d_s = date.fromisoformat(filter_start)
            d_e = date.fromisoformat(filter_end)
            weekdays = sum(1 for d in range((d_e - d_s).days + 1) if (d_s + timedelta(days=d)).weekday() < 5)
            expected_shifts = total_active * max(1, weekdays)
        except ValueError:
            pass

    attendance_rate = round((total_days_logged / expected_shifts) * 100, 1) if expected_shifts > 0 and total_days_logged > 0 else (None if total_days_logged == 0 else 100.0)
    attendance_rate = min(100.0, attendance_rate) if attendance_rate is not None else None

    requiring_review = sum(1 for r in employee_rows if r["performance_status"] in ("Poor", "Needs Improvement") or (r.get("forecast") and r["forecast"].get("monitoring_category") == "Needs Review"))

    summary_cards = {
        "total_active_employees": total_active,
        "evaluated_employees": evaluated_count,
        "average_kpi_score": avg_kpi,
        "meeting_target_count": on_track_count,
        "below_target_count": needs_imp_count + poor_count,
        "unevaluated_count": unevaluated_count,
        "average_completion_rate": avg_comp,
        "average_accuracy_rate": avg_acc,
        "average_timeliness_rate": avg_time,
        "total_assigned_tasks": total_assigned,
        "total_completed_tasks": total_completed,
        "total_pending_tasks": total_pending,
        "total_overdue_tasks": total_overdue,
        "attendance_rate": attendance_rate,
        "requiring_review_count": requiring_review,
        "reporting_period": {
            "type": period_type,
            "start_date": filter_start or (all_dates[0] if all_dates else None),
            "end_date": filter_end or (all_dates[-1] if all_dates else None),
            "available_range": {"earliest": all_dates[0] if all_dates else None, "latest": all_dates[-1] if all_dates else None},
        },
    }

    # 8. Historical Trends by Week
    # Group period logs (or recent 16 weeks if period is all) by week
    trend_logs = period_logs if (filter_start and filter_end) else all_logs
    weekly_buckets = {}
    for l in trend_logs:
        ldate = str(l.get("date") or "")[:10]
        if not ldate:
            continue
        try:
            d = date.fromisoformat(ldate)
            mon = d - timedelta(days=d.weekday())
            w_key = mon.isoformat()
        except ValueError:
            continue

        b = weekly_buckets.setdefault(w_key, {"week": w_key, "scores": [], "comps": [], "accs": [], "times": [], "assigned": 0, "completed": 0, "emp_scores": {}})
        assigned = _num(l.get("assigned_work_count")) or 0.0
        completed = _num(l.get("completed_work_count")) or 0.0
        b["assigned"] += int(assigned)
        b["completed"] += int(completed)
        comp = (completed / assigned * 100) if assigned > 0 else None
        correct = _num(l.get("correct_work_count")) or 0.0
        acc = (correct / completed * 100) if completed > 0 else None
        on_time = _num(l.get("on_time_work_count")) or 0.0
        tim = (on_time / completed * 100) if completed > 0 else None
        score = _calc_kpi(comp, acc, tim)
        if score is None and _num(l.get("kpi_score")) is not None:
            score = _num(l.get("kpi_score"))

        if score is not None:
            b["scores"].append(score)
            eid = str(l.get("employee_id") or "")
            if eid:
                b["emp_scores"].setdefault(eid, []).append(score)
        if comp is not None:
            b["comps"].append(comp)
        if acc is not None:
            b["accs"].append(acc)
        if tim is not None:
            b["times"].append(tim)

    historical_trends = []
    for w in sorted(weekly_buckets.keys()):
        b = weekly_buckets[w]
        emp_weekly_averages = {eid: round(sum(scores) / len(scores), 2) for eid, scores in b["emp_scores"].items() if scores}
        historical_trends.append({
            "week": w,
            "overall_kpi": round(sum(b["scores"]) / len(b["scores"]), 2) if b["scores"] else None,
            "completion_rate": round(sum(b["comps"]) / len(b["comps"]), 2) if b["comps"] else None,
            "accuracy_rate": round(sum(b["accs"]) / len(b["accs"]), 2) if b["accs"] else None,
            "timeliness_rate": round(sum(b["times"]) / len(b["times"]), 2) if b["times"] else None,
            "assigned_work_count": b["assigned"],
            "completed_work_count": b["completed"],
            "employee_scores": emp_weekly_averages,
        })

    # 9. Productivity & Workload Analytics
    workload_summary = {
        "total_assigned": total_assigned,
        "total_completed": total_completed,
        "total_pending": total_pending,
        "average_workload_per_officer": round(total_assigned / total_active, 1) if total_active else 0,
        "completion_rate": round(total_completed / total_assigned * 100, 1) if total_assigned > 0 else 0.0,
        "distribution": [
            {
                "employee_id": r["employee_id"],
                "employee_name": r["employee_name"],
                "assigned": r["assigned_tasks"],
                "completed": r["completed_tasks"],
                "pending": r["pending_tasks"],
                "completion_rate": r["completion_rate"],
                "kpi_score": r["kpi_score"],
                "workload_intensity": "High" if total_assigned > 0 and r["assigned_tasks"] > (total_assigned / total_active * 1.15) else ("Light" if total_assigned > 0 and r["assigned_tasks"] < (total_assigned / total_active * 0.85) else "Balanced"),
            }
            for r in employee_rows
        ]
    }

    # 10. Automated Evidence-Based Alerts
    alerts = []
    for r in employee_rows:
        eid = r["employee_id"]
        ename = r["employee_name"]
        kpi = r["kpi_score"]
        if kpi is not None and kpi < KPI_REVIEW_THRESHOLD:
            alerts.append({
                "severity": "critical",
                "type": "low_kpi",
                "title": f"Performance Review Required — {ename} ({eid})",
                "message": f"{ename} scored {kpi}% in the selected period, which is below the minimum standard of {KPI_REVIEW_THRESHOLD}%.",
                "employee_id": eid,
            })
        elif kpi is not None and kpi < KPI_TARGET:
            alerts.append({
                "severity": "warning",
                "type": "target_miss",
                "title": f"Target Missed — {ename} ({eid})",
                "message": f"{ename} scored {kpi}%, below the Department of Posts target of {KPI_TARGET}%.",
                "employee_id": eid,
            })

        if r.get("kpi_change") is not None and r["kpi_change"] <= -3.0:
            alerts.append({
                "severity": "warning",
                "type": "declining_trend",
                "title": f"Significant KPI Drop — {ename} ({eid})",
                "message": f"KPI dropped by {abs(r['kpi_change'])}% compared to the preceding period.",
                "employee_id": eid,
            })

        if r.get("forecast") and r["forecast"].get("monitoring_category") == "Needs Review":
            alerts.append({
                "severity": "warning",
                "type": "forecast_decline",
                "title": f"ML Forecast Alert — {ename} ({eid})",
                "message": f"Trained ML model predicts next-week KPI decline ({r['forecast'].get('predicted_kpi')}%, delta {r['forecast'].get('predicted_change')}%).",
                "employee_id": eid,
            })

        if r["assigned_tasks"] > 0 and (r.get("completion_rate") or 0) < 70.0:
            alerts.append({
                "severity": "critical",
                "type": "low_completion",
                "title": f"Low Task Completion Rate — {ename} ({eid})",
                "message": f"Completed only {r['completed_tasks']} of {r['assigned_tasks']} tasks ({r.get('completion_rate')}%) with {r['pending_tasks']} pending.",
                "employee_id": eid,
            })

    if unevaluated_count > 0:
        alerts.append({
            "severity": "info",
            "type": "unevaluated_staff",
            "title": f"{unevaluated_count} Staff Unevaluated in This Window",
            "message": f"{unevaluated_count} active employees have not completed KPI logs for this selected period.",
            "employee_id": None,
        })

    # Sort alerts by severity
    sev_order = {"critical": 0, "warning": 1, "info": 2, "positive": 3}
    alerts.sort(key=lambda a: sev_order.get(a["severity"], 9))

    # 11. Available Filter Options
    filter_options = {
        "post_offices": sorted({e.get("post_office") for e in employees if e.get("post_office")}),
        "designations": sorted({e.get("designation") for e in employees if e.get("designation")}),
        "work_categories": sorted({e.get("work_category") for e in employees if e.get("work_category")}),
        "employees": [{"id": e["employee_id"], "name": f"{e['employee_id']} — {e['employee_name']} ({e['designation']})"} for e in sorted(emp_map.values(), key=lambda x: x["employee_name"])],
    }

    return {
        "summary": summary_cards,
        "formula": {
            "name": "Provisional Sri Lanka Post KPI Formula",
            "status": "Configured / Provisional",
            "weights": PROVISIONAL_WEIGHTS,
            "target_threshold": KPI_TARGET,
            "review_threshold": KPI_REVIEW_THRESHOLD,
            "description": "Weekly / Daily KPI = 40% Completion Rate + 30% Accuracy Rate + 30% Timeliness Rate. Valid range 0.0% – 100.0%.",
        },
        "distribution": distribution,
        "employee_rows": employee_rows,
        "historical_trends": historical_trends,
        "workload": workload_summary,
        "alerts": alerts,
        "filter_options": filter_options,
        "model_telemetry": {
            "model_name": "Gradient Boosting (HistGradientBoostingRegressor)",
            "model_version": "post_assist_kpi_model.joblib",
            "mae": 3.21,
            "rmse": 4.15,
            "r2": 0.81,
            "metric_note": "R² (0.81) represents Coefficient of Determination on 1,056 holdout evaluation samples across 66 postal officers.",
            "total_saved_forecasts": db["kpi_model_forecast"].count_documents({}),
        },
    }


def export_dashboard_csv(data: dict, export_type: str = "employees") -> str:
    import io
    import csv
    output = io.StringIO()
    writer = csv.writer(output)

    if export_type == "trends":
        writer.writerow(["Week", "Overall_KPI", "Completion_Rate", "Accuracy_Rate", "Timeliness_Rate", "Assigned_Tasks", "Completed_Tasks"])
        for t in data.get("historical_trends", []):
            writer.writerow([
                t.get("week"),
                t.get("overall_kpi"),
                t.get("completion_rate"),
                t.get("accuracy_rate"),
                t.get("timeliness_rate"),
                t.get("assigned_work_count"),
                t.get("completed_work_count"),
            ])
    elif export_type == "summary":
        s = data.get("summary", {})
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Active Employees", s.get("total_active_employees")])
        writer.writerow(["Evaluated Employees", s.get("evaluated_employees")])
        writer.writerow(["Average Overall KPI (%)", s.get("average_kpi_score")])
        writer.writerow(["Meeting Target (>=80%)", s.get("meeting_target_count")])
        writer.writerow(["Below Target (<80%)", s.get("below_target_count")])
        writer.writerow(["Unevaluated Employees", s.get("unevaluated_count")])
        writer.writerow(["Average Completion Rate (%)", s.get("average_completion_rate")])
        writer.writerow(["Average Accuracy Rate (%)", s.get("average_accuracy_rate")])
        writer.writerow(["Average Timeliness Rate (%)", s.get("average_timeliness_rate")])
        writer.writerow(["Total Assigned Tasks", s.get("total_assigned_tasks")])
        writer.writerow(["Total Completed Tasks", s.get("total_completed_tasks")])
        writer.writerow(["Total Pending Tasks", s.get("total_pending_tasks")])
        writer.writerow(["Total Overdue Tasks", s.get("total_overdue_tasks")])
        writer.writerow(["Attendance Rate (%)", s.get("attendance_rate")])
        writer.writerow(["Employees Requiring Review", s.get("requiring_review_count")])
    else:  # employees
        writer.writerow([
            "Employee_ID", "Employee_Name", "Designation", "Post_Office", "Reporting_Period",
            "Completion_Rate", "Accuracy_Rate", "Timeliness_Rate", "KPI_Score",
            "Previous_KPI", "KPI_Change", "Assigned_Tasks", "Completed_Tasks",
            "Pending_Tasks", "Overdue_Tasks", "Performance_Status", "Last_Evaluation_Date",
            "Predicted_Next_Week_KPI", "Forecast_Status"
        ])
        for r in data.get("employee_rows", []):
            fc = r.get("forecast") or {}
            writer.writerow([
                r.get("employee_id"),
                r.get("employee_name"),
                r.get("designation"),
                r.get("post_office"),
                r.get("period"),
                r.get("completion_rate"),
                r.get("accuracy_rate"),
                r.get("timeliness_rate"),
                r.get("kpi_score"),
                r.get("previous_kpi"),
                r.get("kpi_change"),
                r.get("assigned_tasks"),
                r.get("completed_tasks"),
                r.get("pending_tasks"),
                r.get("overdue_tasks"),
                r.get("performance_status"),
                r.get("last_evaluation_date"),
                fc.get("predicted_kpi"),
                fc.get("monitoring_category"),
            ])
    return output.getvalue()
