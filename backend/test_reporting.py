"""Read-only reporting tables stay behind the postmaster session."""

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from reporting import dataset_csv, dataset_page, workbook_bytes
from routes import read_reporting_dataset


class _Collection:
    def __init__(self, docs):
        self.docs = docs

    def find_one(self, query):
        wanted = query.get("_id")
        for doc in self.docs:
            if doc.get("_id") == wanted:
                return doc
        return None

    def find(self, query=None):
        query = query or {}
        if "employee_id" in query:
            return [doc for doc in self.docs if doc.get("employee_id") == query["employee_id"]]
        return list(self.docs)


class _Database(dict):
    def __getitem__(self, name):
        return dict.__getitem__(self, name)


def _request():
    return Request({"type": "http", "method": "GET", "headers": [], "query_string": b"", "path": "/"})


class ReportingTests(unittest.TestCase):
    def _database(self):
        return _Database(
            employee=_Collection([
                {
                    "_id": "EMP1",
                    "employee_id": "EMP1",
                    "employee_name": "Test Officer",
                    "post_office": "Kaduwela",
                    "designation": "Postman",
                    "work_category": "Delivery (Field)",
                    "years_of_experience": 3,
                    "employment_type": "Permanent",
                }
            ]),
            daily_kpi_log=_Collection([
                {
                    "_id": "log-1",
                    "employee_id": "EMP1",
                    "date": "2025-04-07",
                    "completion_rate": 80,
                    "accuracy_rate": 90,
                    "timeliness_rate": 70,
                    "assigned_work_count": 10,
                },
                {
                    "_id": "log-2",
                    "employee_id": "EMP1",
                    "date": "2025-04-14",
                    "completion_rate": 100,
                    "accuracy_rate": 100,
                    "timeliness_rate": 100,
                    "assigned_work_count": 8,
                },
            ]),
            kpi_forecast=_Collection([
                {
                    "_id": "EMP1|2025-04-07|measured|week",
                    "employee_id": "EMP1",
                    "source": "measured",
                    "input_week": "2025-04-07",
                    "target_week": "2025-04-14",
                    "forecast_kpi": 81.5,
                    "model_id": "weekly_kpi_model.joblib",
                    "created_at": "2025-04-08T00:00:00+00:00",
                }
            ]),
            kpi_model_forecast=_Collection([
                {
                    "_id": "EMP1|2025-04-14",
                    "employee_id": "EMP1",
                    "employee_name": "Test Officer",
                    "source_week": "2025-04-14",
                    "forecast_week": "2025-04-21",
                    "latest_actual_kpi": 100,
                    "predicted_kpi": 93.2,
                    "predicted_change": -6.8,
                    "monitoring_category": "Needs Review",
                    "model_version": "post_assist_kpi_model.joblib",
                }
            ]),
        )

    def test_tables_use_employee_id_and_omit_mongo_ids(self):
        database = self._database()
        with (
            patch("reporting.get_db", return_value=database),
            patch("productivity.get_db", return_value=database),
        ):
            employees = dataset_page("employees", None, None, 50, 0)
            daily = dataset_page("daily-kpi", "2025-04-14", "2025-04-14", 50, 0)
            weekly = dataset_page("weekly-actuals", None, None, 50, 0)
            forest = dataset_page("random-forest-forecasts", None, None, 50, 0)
            boosting = dataset_page("gradient-boosting-forecasts", None, None, 50, 0)
            monitoring = dataset_page("forecast-monitoring", None, None, 50, 0)
            csv_text = dataset_csv("employees")
            workbook = workbook_bytes()
        self.assertEqual(employees["rows"][0]["employee_id"], "EMP1")
        self.assertNotIn("_id", employees["rows"][0])
        self.assertEqual(daily["total"], 1)
        self.assertEqual(daily["rows"][0]["date"], "2025-04-14")
        self.assertEqual(weekly["rows"][0]["week_start"], "2025-04-07")
        self.assertEqual(weekly["rows"][0]["measured_kpi"], 80.0)
        self.assertEqual(forest["rows"][0]["forecast_kpi"], 81.5)
        self.assertNotIn("_id", forest["rows"][0])
        self.assertEqual(boosting["rows"][0]["forecast_week"], "2025-04-21")
        self.assertEqual(monitoring["rows"][0]["actual_kpi"], 100.0)
        self.assertEqual(monitoring["rows"][0]["absolute_error"], 18.5)
        self.assertEqual(monitoring["rows"][0]["status"], "needs_review")
        self.assertEqual(
            csv_text.split("\n", 1)[0],
            "employee_id,employee_name,post_office,designation,work_category,years_of_experience,employment_type",
        )
        self.assertTrue(workbook.startswith(b"PK"))

    def test_unauthenticated_reporting_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            read_reporting_dataset("employees", _request())
        self.assertEqual(raised.exception.status_code, 401)

    def test_unknown_dataset_is_rejected(self):
        with patch("reporting.get_db", return_value=self._database()):
            with self.assertRaises(HTTPException) as raised:
                dataset_page("payroll", None, None, 10, 0)
        self.assertEqual(raised.exception.status_code, 404)
