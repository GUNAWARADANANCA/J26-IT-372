"""MongoDB connection for the PostAssist backend with resilient in-memory database."""

import os
import re
import socket
import threading
import time
from dotenv import load_dotenv

load_dotenv()

from pymongo import MongoClient

_client: MongoClient | None = None
_mock_client = None
_lock = threading.Lock()
_last_failed_connect_time: float = 0.0

# Check whether to use in-memory database (default true for local offline/development stability)
USE_IN_MEMORY = os.environ.get("USE_IN_MEMORY_DB", "1").strip().lower() in ("1", "true", "yes")


def _seed_mock_db(db):
    try:
        from auth import hash_password, ROLE_POSTMASTER, ROLE_CLERK
        from attendance_credential import hash_credential_code
        from attendance import DEFAULT_SETTINGS

        pm_pass = os.environ.get("POSTMASTER_PASSWORD", "YourStrongDemoPassword123!")
        clerk_pass = os.environ.get("CLERK_PASSWORD", "Clerk@123456")

        db["app_user"].replace_one(
            {"_id": "postmaster"},
            {
                "_id": "postmaster",
                "username": "postmaster",
                "password_hash": hash_password(pm_pass),
                "hashed_password": hash_password(pm_pass),
                "role": ROLE_POSTMASTER,
                "full_name": "Chief Postmaster",
                "office_id": "PO-COLOMBO-CENTRAL",
            },
            upsert=True,
        )
        db["app_user"].replace_one(
            {"_id": "admin"},
            {
                "_id": "admin",
                "username": "admin",
                "password_hash": hash_password(pm_pass),
                "hashed_password": hash_password(pm_pass),
                "role": ROLE_POSTMASTER,
                "full_name": "System Administrator",
                "office_id": "PO-COLOMBO-CENTRAL",
            },
            upsert=True,
        )
        db["app_user"].replace_one(
            {"_id": "clerk"},
            {
                "_id": "clerk",
                "username": "clerk",
                "password_hash": hash_password(clerk_pass),
                "hashed_password": hash_password(clerk_pass),
                "role": ROLE_CLERK,
                "full_name": "Amila Silva",
                "office_id": "PO-COLOMBO-CENTRAL",
            },
            upsert=True,
        )

        mock_employees = [
            {"_id": "EMP1137", "employee_id": "EMP1137", "employee_name": "Nuwan Priyantha Fernando", "post_office": "Kaduwela", "designation": "Counter Clerk", "work_category": "Postal Operations", "department": "Postal Operations", "employment_type": "Permanent", "years_of_experience": 6.0},
            {"_id": "EMP1138", "employee_id": "EMP1138", "employee_name": "Sunil Chaminda Perera", "post_office": "Kaduwela", "designation": "Postal Officer", "work_category": "Delivery", "department": "Delivery", "employment_type": "Permanent", "years_of_experience": 8.0},
            {"_id": "EMP1139", "employee_id": "EMP1139", "employee_name": "Kamal Wickramasinghe", "post_office": "Kaduwela", "designation": "Senior Postman", "work_category": "Delivery", "department": "Delivery", "employment_type": "Permanent", "years_of_experience": 12.0},
            {"_id": "EMP1140", "employee_id": "EMP1140", "employee_name": "Anura Kumara Silva", "post_office": "Kaduwela", "designation": "Mail Sorter", "work_category": "Sorting", "department": "Sorting", "employment_type": "Permanent", "years_of_experience": 5.0},
            {"_id": "EMP1141", "employee_id": "EMP1141", "employee_name": "Dinesh Bandara", "post_office": "Kaduwela", "designation": "Postal Assistant", "work_category": "Postal Operations", "department": "Postal Operations", "employment_type": "Permanent", "years_of_experience": 4.0},
            {"_id": "EMP1142", "employee_id": "EMP1142", "employee_name": "Roshan Jayawardena", "post_office": "Kaduwela", "designation": "Postman", "work_category": "Delivery", "department": "Delivery", "employment_type": "Permanent", "years_of_experience": 7.0},
            {"_id": "EMP1143", "employee_id": "EMP1143", "employee_name": "Chathura Nilanga Rodrigo", "post_office": "Kaduwela", "designation": "Postal Officer", "work_category": "Counter Services", "department": "Counter Services", "employment_type": "Permanent", "years_of_experience": 9.0},
        ]
        for emp in mock_employees:
            db["employee"].replace_one({"_id": emp["_id"]}, emp, upsert=True)
            eid = emp["employee_id"]
            digits = re.search(r"(\d+)", eid)
            num_suffix = digits.group(1) if digits else "1001"
            code = f"SLP-{num_suffix}"
            db["employee_attendance_credential"].replace_one(
                {"employee_id": eid},
                {
                    "_id": f"cred_{eid}",
                    "employee_id": eid,
                    "credential_hash": hash_credential_code(code),
                    "active": True,
                    "created_at": "2026-10-20T00:00:00Z",
                    "updated_at": "2026-10-20T00:00:00Z",
                    "failed_attempt_count": 0,
                    "locked_until": None,
                },
                upsert=True,
            )

        db["settings"].replace_one({"_id": "attendance"}, dict(DEFAULT_SETTINGS), upsert=True)

        # Seed Daily Accounts Demo Data
        from daily_accounts import seed_demo_daily_accounts
        seed_demo_daily_accounts("PO-COLOMBO-CENTRAL")

        # Seed Preserved Historical KPI Logs & Trained Model Forecasts
        seed_historical_kpi_and_forecasts(db)

        print("Resilient in-memory database successfully initialized and seeded.", flush=True)
    except Exception as exc:
        print(f"Mock DB seeding note: {exc}", flush=True)


def seed_historical_kpi_and_forecasts(db):
    """Seed historical KPI logs and 16 saved forecast records per employee from verified artifacts."""
    try:
        if db["kpi_model_forecast"].count_documents({}) > 0:
            return

        import csv
        from datetime import date, timedelta
        from pathlib import Path

        ml_dir = Path(__file__).resolve().parent / "ml_models"
        test_csv = ml_dir / "test_forecasts.csv"
        latest_csv = ml_dir / "latest_employee_forecasts_with_actions.csv"

        employees = list(db["employee"].find())
        emp_map = {e["_id"]: e for e in employees}
        for e in employees:
            if e.get("employee_id"):
                emp_map[e["employee_id"]] = e

        actions_by_emp = {}
        if latest_csv.exists():
            with open(latest_csv, "r", encoding="utf-8") as f:
                for r in csv.DictReader(f):
                    actions_by_emp[r["Employee_ID"]] = r

        def _cat(change):
            if change >= 2:
                return "Improving"
            if change <= -2:
                return "Needs Review"
            return "Relatively Stable"

        def _rec(cat):
            if cat == "Needs Review":
                return (
                    "Ask the supervisor to review workload, route conditions, accuracy, timeliness, "
                    "attendance, and support needs with the employee. This is not a warning, a pay change, "
                    "or a promotion decision."
                )
            if cat == "Improving":
                return (
                    "Monitor the actual result next week and note working practices that may be helping. "
                    "This is not a reward or a promotion decision."
                )
            return (
                "Continue routine monitoring and compare next week's actual KPI with this forecast. "
                "This is not an official performance rating."
            )

        if test_csv.exists():
            with open(test_csv, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    eid = r["Employee_ID"]
                    emp = emp_map.get(eid) or {}
                    week = r["Week_Start"]
                    actual = round(float(r["KPI_Current"]), 2)
                    pred = round(float(r["Predicted_KPI"]), 2)
                    change = round(pred - actual, 2)
                    cat = _cat(change)
                    action_rec = (
                        actions_by_emp.get(eid, {}).get("Recommended_Action")
                        if week == "2025-12-15"
                        else None
                    )
                    rec = action_rec or _rec(cat)

                    doc = {
                        "_id": f"{eid}|{week}",
                        "employee_id": eid,
                        "employee_name": emp.get("employee_name") or r.get("Employee_Name", eid),
                        "post_office": emp.get("post_office") or r.get("Post_Office", "Kaduwela"),
                        "designation": emp.get("designation") or "Postal Officer",
                        "work_category": emp.get("work_category") or "Operations",
                        "source_week": week,
                        "forecast_week": r["Forecast_Week"],
                        "latest_actual_kpi": actual,
                        "predicted_kpi": pred,
                        "predicted_change": change,
                        "monitoring_category": cat,
                        "recommendation": rec,
                        "model_version": "post_assist_kpi_model.joblib",
                        "generated_at": f"{week}T00:00:00Z",
                        "historical_file_note": "The attached forecast file ends in December 2025 and is not this live prediction.",
                        "data_note": "",
                        "completion_rate": actual,
                        "accuracy_rate": actual,
                        "timeliness_rate": actual,
                        "assigned_work_count": 100,
                        "days_worked": 5,
                    }
                    db["kpi_model_forecast"].replace_one({"_id": doc["_id"]}, doc, upsert=True)

                    # Only seed historical daily logs for registered employees
                    if eid in emp_map:
                        week_start = date.fromisoformat(week)
                        score = float(r["KPI_Current"])
                        for i in range(5):
                            day = week_start + timedelta(days=i)
                            day_str = day.isoformat()
                            assigned = 20
                            completed = max(1, round(assigned * (score / 100.0)))
                            correct = max(1, round(completed * (score / 100.0)))
                            on_time = max(1, round(completed * (score / 100.0)))
                            log_id = f"{eid}-{day_str}"
                            # Do not overwrite today's logs if present
                            if not db["daily_kpi_log"].find_one({"_id": log_id}):
                                db["daily_kpi_log"].replace_one(
                                    {"_id": log_id},
                                    {
                                        "_id": log_id,
                                        "employee_id": eid,
                                        "employee_name": emp.get("employee_name") or r.get("Employee_Name", eid),
                                        "post_office": emp.get("post_office") or r.get("Post_Office", "Kaduwela"),
                                        "designation": emp.get("designation") or "Postal Officer",
                                        "work_category": emp.get("work_category") or "Operations",
                                        "date": day_str,
                                        "assigned_work_count": assigned,
                                        "completed_work_count": completed,
                                        "uncompleted_work_count": assigned - completed,
                                        "correct_work_count": correct,
                                        "incorrect_work_count": completed - correct,
                                        "on_time_work_count": on_time,
                                        "late_work_count": completed - on_time,
                                        "completion_rate": round(completed / assigned * 100, 1),
                                        "accuracy_rate": round(correct / completed * 100, 1),
                                        "timeliness_rate": round(on_time / completed * 100, 1),
                                        "kpi_score": round(score, 1),
                                        "route_length_km": 12,
                                        "distance_covered_km": 10,
                                    },
                                    upsert=True,
                                )
    except Exception as exc:
        print(f"Historical KPI & Forecasts seeding note: {exc}", flush=True)


def _get_mock_client():
    global _mock_client
    if _mock_client is not None:
        return _mock_client
    try:
        import mongomock
        client = mongomock.MongoClient()
        _seed_mock_db(client["postassist"])
        _mock_client = client
        return _mock_client
    except Exception as exc:
        print(f"Could not initialize mongomock client: {exc}", flush=True)
        raise


def _uri() -> str:
    uri = os.environ.get("KPI_MONGODB_URI", "").strip() or os.environ.get("MONGODB_URI", "").strip()
    return uri or "mongodb://localhost:27017"


def connect():
    """Return an active MongoDB client. If USE_IN_MEMORY is enabled or Atlas unreachable, returns mock client."""
    global _client, _last_failed_connect_time

    if USE_IN_MEMORY:
        return _get_mock_client()

    if time.time() - _last_failed_connect_time < 30.0:
        return _get_mock_client()

    with _lock:
        if _client is not None:
            topology = getattr(_client, "_topology", None)
            if topology is not None and not getattr(topology, "_closed", False):
                return _client
            _client = None

        try:
            client = MongoClient(
                _uri(),
                serverSelectionTimeoutMS=1000,
                connectTimeoutMS=1000,
                socketTimeoutMS=1000,
                maxIdleTimeMS=45000,
            )
            from pymongo import ReadPreference
            client.admin.command("ping", read_preference=ReadPreference.NEAREST)
            _client = client
            return client
        except Exception as exc:
            _last_failed_connect_time = time.time()
            disconnect()
            print(f"MongoDB Atlas unreachable ({exc}). Falling back to in-memory database.", flush=True)
            return _get_mock_client()


def init_performance_indexes() -> None:
    try:
        d = get_db()
        d["employee"].create_index([("employee_id", 1)])
        d["employee"].create_index([("post_office", 1)])
        d["attendance_log"].create_index([("date", 1)])
        d["attendance_log"].create_index([("date", 1), ("post_office", 1)])
        d["attendance_log"].create_index([("employee_id", 1)])
        d["daily_kpi"].create_index([("date", 1)])
        d["daily_kpi"].create_index([("employee_id", 1), ("date", 1)])
        d["employee_attendance_credential"].create_index([("employee_id", 1)], unique=True)
    except Exception:
        pass


def disconnect() -> None:
    global _client
    with _lock:
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
            _client = None


def reset_client() -> None:
    disconnect()


def get_db():
    name = (
        os.environ.get("KPI_MONGODB_DB", "").strip()
        or os.environ.get("MONGODB_DB", "postassist").strip()
        or "postassist"
    )
    return connect()[name]
