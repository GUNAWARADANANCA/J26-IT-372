"""Checks for the weekly score built from daily rates."""

import unittest
from datetime import date
from unittest.mock import patch

from productivity import productivity_for, recommendations, week_start, weekly_rows


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

    def find_one(self, _query):
        return self.docs[0] if self.docs else None

    def find(self, _query):
        return self.docs


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


if __name__ == "__main__":
    unittest.main()
