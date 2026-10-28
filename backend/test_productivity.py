"""Checks for the weekly score built from daily rates."""

import unittest
from datetime import date
from unittest.mock import patch

from fastapi import HTTPException

from productivity import (
    _matched_saved_forecasts,
    forecast_monitoring,
    productivity_for,
    recommendations,
    save_measured_forecast,
    simulate_productivity,
    week_start,
    weekly_rows,
)


class WeeklyScoreTests(unittest.TestCase):
    def test_week_starts_on_monday(self):
        self.assertEqual(week_start("2025-04-07"), date(2025, 4, 7))
        self.assertEqual(week_start("2025-04-06"), date(2025, 3, 31))

    def test_weekly_score_averages_the_three_rates(self):
        logs = [
            {
                "date": "2025-04-07",
                "completion_rate": 80,
                "accuracy_rate": 90,
                "timeliness_rate": 70,
                "assigned_work_count": 10,
                "uncompleted_work_count": 2,
                "incorrect_work_count": 1,
                "late_work_count": 1,
            },
            {
                "date": "2025-04-08",
                "completion_rate": 100,
                "accuracy_rate": 100,
                "timeliness_rate": 100,
                "assigned_work_count": 10,
                "uncompleted_work_count": 0,
                "incorrect_work_count": 0,
                "late_work_count": 0,
            },
        ]
        rows = weekly_rows(logs, 3, "Delivery (Field)")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["week"], "2025-04-07")
        self.assertAlmostEqual(rows[0]["kpi"], 90)
        self.assertAlmostEqual(rows[0]["completion"], 90)
        self.assertEqual(rows[0]["uncompleted"], 2)
        self.assertEqual(rows[0]["work_category"], "Delivery (Field)")

    def test_recommendations_cover_each_scored_kpi(self):
        weakest, notes = recommendations(
            {
                "kpi": 93.8,
                "completion": 87.4,
                "accuracy": 100,
                "timeliness": 94,
                "uncompleted": 5,
                "incorrect": 0,
                "late": 2,
            }
        )
        self.assertEqual(weakest, "completion")
        self.assertEqual([note["kpi"] for note in notes], ["completion", "accuracy", "timeliness"])
        self.assertEqual(notes[0]["priority"], "high")
        self.assertIn("5 unfinished", notes[0]["evidence"])
        self.assertIn("Advice only", notes[0]["review_note"])
        self.assertEqual(notes[1]["priority"], "low")


class _Collection:
    def __init__(self, docs):
        self.docs = docs

    def find_one(self, query):
        wanted = query.get("_id")
        if wanted is not None:
            for doc in self.docs:
                if doc.get("_id") == wanted:
                    return doc
            return None
        return self.docs[0] if self.docs else None

    def find(self, query=None):
        query = query or {}
        rows = self.docs
        if "employee_id" in query:
            rows = [doc for doc in rows if doc.get("employee_id") == query["employee_id"]]
        return list(rows)

    def insert_one(self, doc):
        self.docs.append(doc)


class _Database(dict):
    def __getitem__(self, name):
        return dict.__getitem__(self, name)


class ForecastTests(unittest.TestCase):
    def test_forecast_uses_the_saved_model(self):
        employee = {
            "_id": "EMP1",
            "employee_id": "EMP1",
            "employee_name": "Test Officer",
            "work_category": "Delivery (Field)",
            "years_of_experience": 4,
            "post_office": "Kandy",
        }
        logs = []
        for day, completion in (("2025-04-07", 80), ("2025-04-08", 90)):
            logs.append(
                {
                    "employee_id": "EMP1",
                    "date": day,
                    "completion_rate": completion,
                    "accuracy_rate": 95,
                    "timeliness_rate": 90,
                    "assigned_work_count": 10,
                    "uncompleted_work_count": 1,
                    "incorrect_work_count": 0,
                    "late_work_count": 1,
                }
            )
        database = _Database(
            employee=_Collection([employee]),
            daily_kpi_log=_Collection(logs),
        )
        with patch("productivity.get_db", return_value=database):
            report = productivity_for("EMP1")
        self.assertTrue(report["available"])
        self.assertEqual(report["week"], "2025-04-07")
        self.assertIsInstance(report["predicted_next_week_kpi"], float)
        self.assertEqual(len(report["recommendations"]), 3)
        self.assertIn("Advice only", report["recommendations"][0]["review_note"])
        self.assertEqual(report["evaluation"]["model_mae"], 3.41)
        self.assertIn("assigned", report)
        self.assertIn("experience", report)
        self.assertEqual(report["evaluation"]["test_rows"], 60)
        self.assertIn("forecast_difference", report)


class WeekSelectionTests(unittest.TestCase):
    def test_selected_week_uses_that_week_and_keeps_actual_history(self):
        employee = {
            "_id": "EMP1",
            "employee_name": "Test Officer",
            "work_category": "Office",
            "years_of_experience": 4,
        }
        logs = []
        for day, completion in (("2025-04-07", 80), ("2025-04-14", 60)):
            logs.append(
                {
                    "employee_id": "EMP1",
                    "date": day,
                    "completion_rate": completion,
                    "accuracy_rate": completion,
                    "timeliness_rate": completion,
                    "assigned_work_count": 10,
                    "uncompleted_work_count": 1,
                    "incorrect_work_count": 0,
                    "late_work_count": 0,
                }
            )
        database = _Database(employee=_Collection([employee]), daily_kpi_log=_Collection(logs))

        class _Model:
            def predict(self, frame):
                return [float(frame["kpi"].iloc[0]) + 1]

        with (
            patch("productivity.get_db", return_value=database),
            patch("productivity.load_model", return_value={"model": _Model()}),
        ):
            latest = productivity_for("EMP1")
            earlier = productivity_for("EMP1", "2025-04-07")
        self.assertEqual(latest["week"], "2025-04-14")
        self.assertEqual(earlier["week"], "2025-04-07")
        self.assertEqual(earlier["measured_kpi"], 80.0)
        self.assertEqual(earlier["predicted_next_week_kpi"], 81.0)
        self.assertEqual(earlier["forecast_difference"], 1.0)
        self.assertEqual([row["week"] for row in earlier["history"]], ["2025-04-07", "2025-04-14"])
        self.assertEqual(earlier["actual_change"], None)
        self.assertEqual(latest["actual_change"], -20.0)
        self.assertEqual(earlier["days"][0]["date"], "2025-04-07")
        self.assertEqual(earlier["workload"][0]["day"], "Monday")
        self.assertEqual(earlier["workload"][0]["assigned"], 10)
        self.assertFalse(earlier["drivers"]["available"])
        self.assertIsNone(earlier["target_kpi"])
        self.assertIsNone(earlier["model_status"]["prediction_interval"])

    def test_missing_week_returns_historical_data_and_available_range(self):
        employee = {
            "_id": "EMP1",
            "employee_name": "Test Officer",
            "work_category": "Office",
            "years_of_experience": 4,
        }
        logs = [
            {
                "employee_id": "EMP1",
                "date": "2025-01-27",
                "completion_rate": 95,
                "accuracy_rate": 100,
                "timeliness_rate": 90,
                "assigned_work_count": 10,
                "uncompleted_work_count": 0,
                "incorrect_work_count": 0,
                "late_work_count": 1,
            }
        ]
        database = _Database(employee=_Collection([employee]), daily_kpi_log=_Collection(logs))

        class _Model:
            def predict(self, frame):
                return [float(frame["kpi"].iloc[0]) - 1]

        with (
            patch("productivity.get_db", return_value=database),
            patch("productivity.load_model", return_value={"model": _Model()}),
        ):
            missing = productivity_for("EMP1", "2025-12-29")
        self.assertFalse(missing["available"])
        self.assertFalse(missing["week_has_logs"])
        self.assertEqual(missing["requested_week"], "2025-12-29")
        self.assertEqual(missing["latest_available_week"], "2025-01-27")
        self.assertEqual(missing["available_weeks"], ["2025-01-27"])
        self.assertEqual(len(missing["history"]), 1)
        self.assertEqual(missing["history"][0]["week"], "2025-01-27")
        self.assertIn("2025-12-29", missing["message"])


class ForecastRecordTests(unittest.TestCase):
    def _database(self):
        employee = {
            "_id": "EMP1",
            "employee_name": "Test Officer",
            "work_category": "Office",
            "years_of_experience": 4,
        }
        logs = []
        for day, completion in (("2025-04-07", 80), ("2025-04-14", 70)):
            logs.append(
                {
                    "employee_id": "EMP1",
                    "date": day,
                    "completion_rate": completion,
                    "accuracy_rate": completion,
                    "timeliness_rate": completion,
                    "assigned_work_count": 8,
                    "uncompleted_work_count": 1,
                    "incorrect_work_count": 0,
                    "late_work_count": 0,
                }
            )
        return _Database(
            employee=_Collection([employee]),
            daily_kpi_log=_Collection(logs),
            kpi_forecast=_Collection([]),
        )

    def test_save_is_idempotent_and_matches_only_the_target_week(self):
        database = self._database()

        class _Model:
            def predict(self, frame):
                return [50]

        with (
            patch("productivity.get_db", return_value=database),
            patch("productivity.load_model", return_value={"model": _Model(), "cut": "2025-04-07"}),
        ):
            first = save_measured_forecast("EMP1", "2025-04-07")
            second = save_measured_forecast("EMP1", "2025-04-07")
            board = forecast_monitoring()
        self.assertFalse(first["already_saved"])
        self.assertTrue(second["already_saved"])
        self.assertEqual(len(database["kpi_forecast"].docs), 1)
        self.assertEqual(first["target_week"], "2025-04-14")
        self.assertEqual(first["forecast_kpi"], 50.0)
        self.assertNotIn("employee_name", first)
        self.assertEqual(board["saved_forecasts"], 1)
        self.assertEqual(board["with_actual_outcomes"], 1)
        self.assertEqual(board["rows"][0]["actual_kpi"], 70.0)
        self.assertEqual(board["rows"][0]["absolute_error"], 20.0)
        self.assertEqual(board["mae"], 20.0)
        self.assertEqual(board["rmse"], 20.0)

        with (
            patch("productivity.get_db", return_value=database),
            patch("productivity.load_model", return_value={"model": _Model(), "cut": "2025-04-07"}),
        ):
            latest = save_measured_forecast("EMP1")
            pending = forecast_monitoring(status="pending")
        self.assertEqual(latest["target_week"], "2025-04-21")
        self.assertEqual(pending["with_actual_outcomes"], 0)
        self.assertIsNone(pending["mae"])
        self.assertEqual(pending["rows"][0]["actual_kpi"], None)
        self.assertEqual(pending["rows"][0]["status_label"], "Pending Actual")
        self.assertIsNone(pending["baseline_mae"])


class MonitoringRuleTests(unittest.TestCase):
    def test_empty_monitoring_has_no_error_metrics(self):
        database = _Database(
            employee=_Collection([]),
            daily_kpi_log=_Collection([]),
            kpi_forecast=_Collection([]),
        )
        with patch("productivity.get_db", return_value=database):
            board = forecast_monitoring()
        self.assertEqual(board["saved_forecasts"], 0)
        self.assertIsNone(board["mae"])
        self.assertIsNone(board["rmse"])
        self.assertFalse(board["enough_observations"])
        self.assertEqual(board["access_control"], "postmaster_session")
        self.assertIn("not proof of identity", board["access_note"])

    def test_unknown_employee_and_invalid_week_are_rejected(self):
        database = _Database(
            employee=_Collection([]),
            daily_kpi_log=_Collection([]),
            kpi_forecast=_Collection([]),
        )
        with (
            patch("productivity.get_db", return_value=database),
            patch("productivity.load_model", return_value={"model": object(), "cut": ""}),
        ):
            with self.assertRaises(HTTPException) as missing:
                save_measured_forecast("MISSING")
            with self.assertRaises(HTTPException) as bad_week:
                forecast_monitoring(period_from="not-a-date")
        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(bad_week.exception.status_code, 400)
        self.assertEqual(database["kpi_forecast"].docs, [])

    def test_match_does_not_cross_employees_and_baseline_uses_the_same_rows(self):
        logs = [
            {
                "employee_id": "EMP1",
                "date": "2025-04-14",
                "completion_rate": 80,
                "accuracy_rate": 80,
                "timeliness_rate": 80,
                "assigned_work_count": 4,
                "uncompleted_work_count": 0,
                "incorrect_work_count": 0,
                "late_work_count": 0,
            }
        ]
        logs.append(
            {
                "employee_id": "EMP1",
                "date": "2025-04-07",
                "completion_rate": 60,
                "accuracy_rate": 60,
                "timeliness_rate": 60,
                "assigned_work_count": 4,
                "uncompleted_work_count": 0,
                "incorrect_work_count": 0,
                "late_work_count": 0,
            }
        )
        employees = [
            {"_id": "EMP1", "employee_name": "One", "work_category": "Office", "years_of_experience": 1},
            {"_id": "EMP2", "employee_name": "Two", "work_category": "Office", "years_of_experience": 1},
        ]
        forecasts = [
            {
                "_id": "EMP1|2025-04-07|measured|week",
                "employee_id": "EMP1",
                "source": "measured",
                "input_week": "2025-04-07",
                "target_week": "2025-04-14",
                "forecast_kpi": 70,
                "model_id": "weekly_kpi_model.joblib",
            },
            {
                "_id": "EMP2|2025-04-07|measured|week",
                "employee_id": "EMP2",
                "source": "measured",
                "input_week": "2025-04-07",
                "target_week": "2025-04-14",
                "forecast_kpi": 70,
                "model_id": "weekly_kpi_model.joblib",
            },
        ]
        database = _Database(
            employee=_Collection(employees),
            daily_kpi_log=_Collection(logs),
            kpi_forecast=_Collection(forecasts),
        )
        with patch("productivity.get_db", return_value=database):
            board = forecast_monitoring(period_from="2025-04-16")
        by_employee = {row["employee_id"]: row for row in board["rows"]}
        self.assertEqual(by_employee["EMP1"]["actual_kpi"], 80.0)
        self.assertEqual(by_employee["EMP1"]["absolute_error"], 10.0)
        self.assertEqual(by_employee["EMP1"]["status_label"], "Needs Review")
        self.assertEqual(by_employee["EMP2"]["status_label"], "Pending Actual")
        self.assertIsNone(by_employee["EMP2"]["actual_kpi"])
        self.assertEqual(board["comparison_count"], 1)
        self.assertEqual(board["mae"], 10.0)
        self.assertEqual(board["baseline_mae"], 20.0)
        self.assertEqual(board["baseline_rmse"], 20.0)


class _PredictModel:
    def predict(self, frame):
        return [float(frame["completion"].iloc[0])]


class SimulationTests(unittest.TestCase):
    def setUp(self):
        self.employee = {
            "_id": "EMP1",
            "employee_name": "Test Officer",
            "work_category": "Office",
            "years_of_experience": 4,
        }
        self.logs = [
            {
                "employee_id": "EMP1",
                "date": "2025-04-07",
                "completion_rate": 80,
                "accuracy_rate": 90,
                "timeliness_rate": 70,
                "assigned_work_count": 10,
                "uncompleted_work_count": 2,
                "incorrect_work_count": 1,
                "late_work_count": 1,
            }
        ]
        self.database = _Database(
            employee=_Collection([self.employee]),
            daily_kpi_log=_Collection(self.logs),
        )

    def test_simulation_uses_the_model_and_does_not_write(self):
        with (
            patch("productivity.get_db", return_value=self.database),
            patch("productivity.load_model", return_value={"model": _PredictModel()}),
        ):
            result = simulate_productivity(
                "EMP1",
                [
                    {
                        "name": "Accuracy check",
                        "completion": 88,
                        "accuracy": 95,
                        "timeliness": 70,
                        "assigned": 10,
                        "uncompleted": 2,
                        "incorrect": 1,
                        "late": 1,
                    }
                ],
            )
        self.assertEqual(result["baseline"]["predicted_next_week_kpi"], 80.0)
        self.assertEqual(result["scenarios"][0]["predicted_next_week_kpi"], 88.0)
        self.assertEqual(result["scenarios"][0]["difference"], 8.0)
        self.assertEqual(result["scenarios"][0]["direction"], "higher")
        self.assertIn("not an explanation", result["scenarios"][0]["recommendation_note"])
        self.assertEqual(self.logs[0]["completion_rate"], 80)
        self.assertEqual(len(self.database["employee"].docs), 1)

    def test_simulation_rejects_impossible_counts(self):
        with (
            patch("productivity.get_db", return_value=self.database),
            patch("productivity.load_model", return_value={"model": _PredictModel()}),
        ):
            with self.assertRaises(HTTPException) as caught:
                simulate_productivity(
                    "EMP1",
                    [
                        {
                            "completion": 110,
                            "accuracy": 90,
                            "timeliness": 70,
                            "assigned": 5,
                            "uncompleted": 6,
                            "incorrect": 3,
                            "late": -1,
                        }
                    ],
                )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("between 0 and 100", caught.exception.detail)
        self.assertIn("Unfinished work cannot", caught.exception.detail)
        self.assertIn("nonnegative", caught.exception.detail)


class ForecastMatchTests(unittest.TestCase):
    def test_match_uses_the_target_monday_and_skips_unmatched_weeks(self):
        database = _Database(
            kpi_forecast=_Collection([
                {"employee_id": "EMP1", "target_week": "2025-04-14T18:00:00Z", "forecast_kpi": 81},
                {"employee_id": "EMP1", "target_week": "2025-04-21", "forecast_kpi": 70},
            ]),
        )
        weeks = [{"week": "2025-04-14", "kpi": 90}]
        with patch("productivity.get_db", return_value=database):
            pairs = _matched_saved_forecasts("EMP1", weeks)
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0]["target_week"], "2025-04-14")
        self.assertEqual(pairs[0]["actual_kpi"], 90)
        self.assertEqual(pairs[0]["absolute_error"], 9)
        self.assertEqual(week_start("2025-04-13"), date(2025, 4, 7))


if __name__ == "__main__":
    unittest.main()
