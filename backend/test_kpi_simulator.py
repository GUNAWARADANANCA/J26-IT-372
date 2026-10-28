"""Unit tests for the KPI Simulator engine and endpoints."""

import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from kpi_simulator import (
    get_employee_kpi_history,
    get_simulation_record,
    list_simulations,
    simulate_kpi,
)


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None):
        query = query or {}
        rows = self.docs
        if "employee_id" in query:
            rows = [doc for doc in rows if doc.get("employee_id") == query["employee_id"]]
        return _MockCursor(rows)

    def find_one(self, query):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc
        return None

    def insert_one(self, doc):
        self.docs.append(doc)

    def replace_one(self, query, doc, upsert=False):
        for index, current in enumerate(self.docs):
            if current.get("_id") == query.get("_id"):
                self.docs[index] = doc
                return
        if upsert:
            self.docs.append(doc)


class _MockCursor(list):
    def sort(self, *args, **kwargs):
        return self

    def limit(self, count):
        return self[:count]


class _Database(dict):
    def __getitem__(self, name):
        if name not in self:
            self[name] = _Collection()
        return dict.__getitem__(self, name)


def _mock_employee():
    return {
        "_id": "EMP1137",
        "employee_name": "Nuwan Priyantha Fernando",
        "designation": "Senior Postman",
        "post_office": "Kaduwela Post Office",
        "work_category": "Delivery (Field)",
        "employment_type": "Permanent",
        "years_of_experience": 8,
    }


def _mock_log(day, assigned=100, completed=90, correct=85, on_time=82):
    return {
        "employee_id": "EMP1137",
        "date": day,
        "assigned_work_count": assigned,
        "completed_work_count": completed,
        "uncompleted_work_count": assigned - completed,
        "correct_work_count": correct,
        "incorrect_work_count": completed - correct,
        "on_time_work_count": on_time,
        "late_work_count": completed - on_time,
        "route_length_km": 15,
        "distance_covered_km": 14,
    }


class KpiSimulatorTests(unittest.TestCase):
    def setUp(self):
        self.db = _Database({
            "employee": _Collection([_mock_employee()]),
            "daily_kpi_log": _Collection([
                _mock_log("2026-01-05"),
                _mock_log("2026-01-06"),
                _mock_log("2026-01-07"),
                _mock_log("2026-01-08"),
                _mock_log("2026-01-09"),
            ]),
            "overtime": _Collection(),
            "entitlement_leave": _Collection(),
            "kpi_simulation_history": _Collection(),
        })

    def test_get_employee_kpi_history_not_found(self):
        with patch("kpi_simulator.get_db", return_value=self.db):
            with self.assertRaises(HTTPException) as ctx:
                get_employee_kpi_history("NONEXISTENT")
            self.assertEqual(ctx.exception.status_code, 404)

    def test_get_employee_kpi_history_valid(self):
        with patch("db.get_db", return_value=self.db), patch("kpi_simulator.get_db", return_value=self.db), patch("kpi_forecast.get_db", return_value=self.db):
            data = get_employee_kpi_history("EMP1137")
            self.assertEqual(data["employee_id"], "EMP1137")
            self.assertEqual(data["employee_name"], "Nuwan Priyantha Fernando")
            self.assertTrue(data["has_real_logs"])
            self.assertGreater(data["baseline_kpi"], 0)
            self.assertIn("completion_rate", data["indicators"])
            self.assertIn("accuracy_rate", data["indicators"])

    def test_simulate_kpi_parameter_validation(self):
        with patch("db.get_db", return_value=self.db), patch("kpi_simulator.get_db", return_value=self.db), patch("kpi_forecast.get_db", return_value=self.db):
            # Missing employee
            with self.assertRaises(HTTPException) as ctx:
                simulate_kpi({"employee_id": ""})
            self.assertEqual(ctx.exception.status_code, 400)

            # Invalid workload adjustment > 50%
            with self.assertRaises(HTTPException) as ctx:
                simulate_kpi({
                    "employee_id": "EMP1137",
                    "workload_adjustment_percent": 60,
                })
            self.assertEqual(ctx.exception.status_code, 422)

            # Invalid extra hours > 20
            with self.assertRaises(HTTPException) as ctx:
                simulate_kpi({
                    "employee_id": "EMP1137",
                    "extra_hours_per_week": 25,
                })
            self.assertEqual(ctx.exception.status_code, 422)

            # Invalid absence rate > 50%
            with self.assertRaises(HTTPException) as ctx:
                simulate_kpi({
                    "employee_id": "EMP1137",
                    "absence_rate_percent": 60,
                })
            self.assertEqual(ctx.exception.status_code, 422)

    def test_simulate_kpi_run_and_trend(self):
        with patch("db.get_db", return_value=self.db), patch("kpi_simulator.get_db", return_value=self.db), patch("kpi_forecast.get_db", return_value=self.db):
            with patch("kpi_simulator.predict_row", return_value=89.8):
                res = simulate_kpi({
                    "employee_id": "EMP1137",
                    "scenario": "Increase Workload by 20%",
                    "workload_adjustment_percent": 20,
                    "extra_hours_per_week": 5,
                    "absence_rate_percent": 0,
                    "period_weeks": 4,
                })
                self.assertEqual(res["employee_id"], "EMP1137")
                self.assertEqual(res["simulated_kpi"], 89.8)
                self.assertEqual(len(res["trend"]["labels"]), 4)
                self.assertEqual(len(res["trend"]["current"]), 4)
                self.assertEqual(len(res["trend"]["simulated"]), 4)
                self.assertIn("Trained Gradient Boosting model", res["model_name"])
                self.assertTrue(len(res["assumptions"]) >= 3)
                self.assertIn("simulation_id", res)

    def test_simulation_history_and_retrieval(self):
        with patch("db.get_db", return_value=self.db), patch("kpi_simulator.get_db", return_value=self.db), patch("kpi_forecast.get_db", return_value=self.db):
            with patch("kpi_simulator.predict_row", return_value=89.8):
                res = simulate_kpi({
                    "employee_id": "EMP1137",
                    "scenario": "Increase Workload by 20%",
                    "workload_adjustment_percent": 20,
                    "extra_hours_per_week": 5,
                    "absence_rate_percent": 0,
                    "period_weeks": 4,
                })
                sim_id = res["simulation_id"]
                history = list_simulations(limit=10)
                self.assertEqual(len(history), 1)
                self.assertEqual(history[0]["simulation_id"], sim_id)

                record = get_simulation_record(sim_id)
                self.assertEqual(record["simulation_id"], sim_id)
                self.assertEqual(record["employee_id"], "EMP1137")


if __name__ == "__main__":
    unittest.main()
