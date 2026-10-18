"""Checks for the gradient-boosting next-week KPI forecast."""

import unittest
from datetime import date
from unittest.mock import patch

from fastapi import HTTPException

from kpi_forecast import (
    COLLECTION,
    build_features,
    clamp_kpi,
    generate_forecasts,
    monitoring_category,
    provisional_kpi,
    recommendation_for,
    weekly_history,
)
from routes import read_kpi_forecasts


def _request():
    from starlette.requests import Request
    return Request({
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 5000),
        "server": ("127.0.0.1", 8000),
    })


def _status(call):
    try:
        call()
    except HTTPException as exc:
        return exc.status_code
    return None


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None):
        query = query or {}
        rows = self.docs
        if "employee_id" in query:
            rows = [doc for doc in rows if doc.get("employee_id") == query["employee_id"]]
        return list(rows)

    def find_one(self, query):
        for doc in self.find(query):
            if query.get("_id") in (None, doc.get("_id")):
                return doc
        return None

    def replace_one(self, query, doc, upsert=False):
        for index, current in enumerate(self.docs):
            if current.get("_id") == query.get("_id"):
                self.docs[index] = doc
                return
        if upsert:
            self.docs.append(doc)


class _Database(dict):
    def __getitem__(self, name):
        if name not in self:
            self[name] = _Collection()
        return dict.__getitem__(self, name)


def _employee():
    return {
        "_id": "EMP1",
        "employee_name": "Test Officer",
        "post_office": "Kaduwela",
        "designation": "Postman",
        "work_category": "Delivery (Field)",
        "employment_type": "Permanent",
        "years_of_experience": 4,
    }


def _log(day, assigned=10, completed=8, correct=7, on_time=6):
    return {
        "employee_id": "EMP1",
        "date": day,
        "assigned_work_count": assigned,
        "completed_work_count": completed,
        "uncompleted_work_count": assigned - completed,
        "correct_work_count": correct,
        "incorrect_work_count": completed - correct,
        "on_time_work_count": on_time,
        "late_work_count": completed - on_time,
        "route_length_km": 12,
        "distance_covered_km": 10,
    }


class ForecastRuleTests(unittest.TestCase):
    def test_category_boundaries(self):
        self.assertEqual(monitoring_category(2), "Improving")
        self.assertEqual(monitoring_category(1.9), "Relatively Stable")
        self.assertEqual(monitoring_category(-2), "Needs Review")
        self.assertEqual(monitoring_category(-1.9), "Relatively Stable")

    def test_recommendations_are_not_disciplinary(self):
        for category in ("Improving", "Needs Review", "Relatively Stable"):
            text = recommendation_for(category).lower()
            self.assertNotIn("salary", text)
            self.assertNotIn("warning", text) if category != "Needs Review" else self.assertIn("not a warning", text)

    def test_kpi_uses_provisional_weights_and_stays_in_range(self):
        self.assertAlmostEqual(provisional_kpi(100, 100, 100), 100)
        self.assertAlmostEqual(provisional_kpi(50, 0, 0), 20)
        self.assertEqual(clamp_kpi(140), 100)
        self.assertEqual(clamp_kpi(-4), 0)

    def test_week_advances_seven_days_and_feature_order(self):
        history = weekly_history([_log("2025-12-15"), _log("2025-12-16")])
        self.assertEqual(history[0]["week"], date(2025, 12, 15))
        database = _Database({"overtime": _Collection()})
        with patch("kpi_forecast.get_db", return_value=database):
            features = build_features(_employee(), history, date(2025, 12, 15))
        from kpi_forecast import load_model
        _model, columns = load_model()
        self.assertEqual(list(features), [
            "Years_of_Experience", "Route_Length_km", "Distance_Covered_km",
            "Assigned_Work_Count", "Completed_Work_Count", "Uncompleted_Work_Count",
            "Completion_Rate", "Correct_Work_Count", "Incorrect_Work_Count", "Accuracy_Rate",
            "On_Time_Work_Count", "Late_Work_Count", "Timeliness_Rate", "Days_Worked",
            "Leave_Days_Weekly", "Overtime_Hours_Weekly", "KPI_Current", "KPI_Previous_1",
            "KPI_Previous_2", "KPI_Mean_4_Weeks", "KPI_Std_4_Weeks", "Post_Office",
            "Designation", "Work_Category", "Employment_Type", "Doing_Overtime_Weekly",
        ])
        self.assertEqual(columns, list(features))
        self.assertIsNone(features["KPI_Previous_1"])

    def test_supplied_test_file_matches_reported_error(self):
        import csv
        from pathlib import Path
        path = Path(__file__).resolve().parents[0] / "ml_models" / "test_forecasts.csv"
        with path.open(encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        errors = [abs(float(row["Predicted_KPI"]) - float(row["Actual_KPI"])) for row in rows]
        mae = sum(errors) / len(errors)
        self.assertGreater(len(rows), 100)
        self.assertAlmostEqual(mae, 3.209, delta=0.05)

    def test_missing_logs_are_skipped_and_repeat_generate_does_not_duplicate(self):
        database = _Database({
            "employee": _Collection([_employee(), {"_id": "EMP2", "employee_name": "No Logs", "post_office": "Kaduwela", "designation": "Postman", "work_category": "Office", "employment_type": "Permanent"}]),
            "daily_kpi_log": _Collection([_log("2025-12-15")]),
            "overtime": _Collection(),
            COLLECTION: _Collection(),
        })
        with patch("kpi_forecast.get_db", return_value=database), patch("kpi_forecast.predict_row", return_value=80.0):
            first = generate_forecasts("2025-12-15")
            second = generate_forecasts("2025-12-15")
        self.assertEqual(first["generated"], 1)
        self.assertEqual(second["generated"], 1)
        self.assertEqual(len(database[COLLECTION].docs), 1)
        self.assertEqual(database[COLLECTION].docs[0]["forecast_week"], "2025-12-22")
        self.assertEqual(first["skipped"][0]["employee_id"], "EMP2")

    def test_unknown_employee_detail_and_unauthenticated_list(self):
        from kpi_forecast import forecast_detail
        database = _Database({"employee": _Collection(), COLLECTION: _Collection()})
        with patch("kpi_forecast.get_db", return_value=database):
            with self.assertRaises(HTTPException) as raised:
                forecast_detail("MISSING")
        self.assertEqual(raised.exception.status_code, 404)
        with self.assertRaises(HTTPException) as denied:
            read_kpi_forecasts(_request())
        self.assertEqual(denied.exception.status_code, 401)
        from routes import create_kpi_forecasts, read_kpi_forecast, read_kpi_summary
        self.assertEqual(_status(lambda: read_kpi_summary(_request())), 401)
        self.assertEqual(_status(lambda: read_kpi_forecast("EMP1", _request())), 401)
        post = _request()
        post.scope["method"] = "POST"
        self.assertEqual(_status(lambda: create_kpi_forecasts(post, {})), 401)

    def test_later_incomplete_week_is_not_used_as_the_source(self):
        incomplete = _log("2026-10-06", assigned=3, completed=0, correct=0, on_time=0)
        incomplete["correct_work_count"] = None
        incomplete["on_time_work_count"] = None
        database = _Database({
            "employee": _Collection([_employee()]),
            "daily_kpi_log": _Collection([_log("2025-12-15"), incomplete]),
            "overtime": _Collection(),
            "entitlement_leave": _Collection([
                {"employee_id": "EMP1", "from_date": "", "to_date": "", "days": "2"},
            ]),
            COLLECTION: _Collection(),
        })
        with patch("kpi_forecast.get_db", return_value=database), patch("kpi_forecast.predict_row", return_value=70.0):
            result = generate_forecasts()
        saved = database[COLLECTION].docs[0]
        self.assertEqual(result["generated"], 1)
        self.assertEqual(saved["source_week"], "2025-12-15")
        self.assertEqual(saved["forecast_week"], "2025-12-22")
        self.assertIn("2026-10-05", saved["data_note"])
        self.assertNotIn("December 2025", saved["source_week"])

    def test_dated_leave_overlaps_the_week_and_blank_leave_does_not(self):
        from kpi_forecast import _leave_days
        database = _Database({
            "entitlement_leave": _Collection([
                {"employee_id": "EMP1", "from_date": "", "to_date": "", "days": "2"},
                {"employee_id": "EMP1", "from_date": "2025-12-16", "to_date": "2025-12-17", "days": "2"},
            ]),
        })
        with patch("kpi_forecast.get_db", return_value=database):
            self.assertEqual(_leave_days("EMP1", date(2025, 12, 15)), 2)
            self.assertIsNone(_leave_days("EMP9", date(2025, 12, 15)))


if __name__ == "__main__":
    unittest.main()
