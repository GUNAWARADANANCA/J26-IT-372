"""Postal KPI dashboard totals stay behind the postmaster session."""

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from postal_kpi import dashboard
from routes import read_postal_kpi_dashboard


class _Collection:
    def __init__(self, docs):
        self.docs = docs

    def find(self, query=None):
        return list(self.docs)


class _Database(dict):
    def __getitem__(self, name):
        return dict.__getitem__(self, name)


class PostalKpiTests(unittest.TestCase):
    def _database(self):
        return _Database(
            employee=_Collection([
                {"_id": "EMP1", "employee_id": "EMP1", "employee_name": "Test Officer"},
                {"_id": "EMP2", "employee_name": "Second Officer"},
            ]),
            daily_kpi_log=_Collection([
                {"employee_id": "EMP1", "route_id": "R1", "date": "2025-04-07", "assigned_work_count": 10, "completed_work_count": 8, "uncompleted_work_count": 2, "kpi_score": 80},
                {"employee_id": "EMP1", "route_id": "R2", "date": "2026-01-06", "assigned_work_count": 5, "completed_work_count": 5, "uncompleted_work_count": 0, "kpi_score": 100},
                {"employee_id": "EMP2", "route_id": "R1", "date": "2025-04-08", "assigned_work_count": 4, "completed_work_count": 1, "uncompleted_work_count": 3, "kpi_score": None},
            ]),
        )

    def test_totals_match_the_filtered_charts(self):
        with patch("postal_kpi.get_db", return_value=self._database()):
            report = dashboard()
            one_route = dashboard(route_id="R1", year="2025")
        self.assertEqual(report["summary"]["assigned_work"], 19)
        self.assertEqual(report["summary"]["completed_work"], 14)
        self.assertEqual(report["summary"]["uncompleted_work"], 5)
        self.assertEqual(report["summary"]["average_kpi_score"], 90)
        self.assertEqual(report["summary"]["kpi_score_rows"], 2)
        self.assertEqual(sum(row["completed"] for row in report["by_year"]), 14)
        self.assertEqual(sum(row["completed"] for row in report["by_employee"]), 14)
        self.assertEqual(one_route["summary"]["completed_work"], 9)
        self.assertEqual(one_route["by_employee"][0]["employee_id"], "EMP1")
        self.assertEqual([item["id"] for item in report["options"]["employees"]], ["EMP2", "EMP1"])

    def test_invalid_year_and_empty_filter(self):
        with patch("postal_kpi.get_db", return_value=self._database()):
            with self.assertRaises(HTTPException) as raised:
                dashboard(year="25")
            empty = dashboard(employee_id="EMP9")
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(empty["summary"]["log_rows"], 0)
        self.assertIsNone(empty["summary"]["average_kpi_score"])

    def test_unauthenticated_dashboard_is_rejected(self):
        request = Request({"type": "http", "method": "GET", "headers": [], "query_string": b"", "path": "/"})
        with self.assertRaises(HTTPException) as raised:
            read_postal_kpi_dashboard(request)
        self.assertEqual(raised.exception.status_code, 401)
