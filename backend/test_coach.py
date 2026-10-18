import unittest
from unittest.mock import patch

from fastapi import HTTPException

from coach import build_plan, save_follow_up


class _Store:
    def __init__(self):
        self.docs = {}

    def find_one(self, query):
        return self.docs.get(query["recommendation_id"])

    def replace_one(self, query, doc, upsert=False):
        self.docs[query["recommendation_id"]] = doc


class _Db(dict):
    def __getitem__(self, name):
        if name != "kpi_coach_followup":
            raise AssertionError(name)
        return super().__getitem__(name)


class CoachPlanTests(unittest.TestCase):
    def test_lowest_component_is_ranked_first_and_missing_scores_are_omitted(self):
        low = build_plan({
            "available": True,
            "employee_id": "EMP1",
            "employee_name": "One",
            "week": "2025-01-27",
            "measured_kpi": 65.5,
            "predicted_next_week_kpi": 72.2,
            "timeliness": 61.3,
            "accuracy": 66.3,
            "completion": 68.7,
            "late": 8,
            "incorrect": 7,
            "uncompleted": 9,
            "history": [{"week": "2025-01-27", "timeliness": 61.3, "kpi": 65.5}],
        })
        other = build_plan({
            "available": True,
            "employee_id": "EMP2",
            "week": "2025-02-03",
            "measured_kpi": 90,
            "timeliness": 95,
            "accuracy": 40,
            "completion": 92,
            "late": 0,
            "incorrect": 6,
            "uncompleted": 0,
            "history": [
                {"week": "2025-01-27", "accuracy": 42, "kpi": 80},
                {"week": "2025-02-03", "accuracy": 40, "kpi": 90},
            ],
        })
        self.assertEqual(low["recommendations"][0]["category"], "timeliness")
        self.assertEqual(low["recommendations"][0]["id"], "EMP1|2025-01-27|timeliness")
        self.assertEqual(other["recommendations"][0]["category"], "accuracy")
        self.assertIn("2025-02-03", other["recommendations"][0]["id"])
        self.assertNotIn("recorded result of", low["forecast_note"])
        self.assertIn("not a recorded result", low["forecast_note"])
        self.assertEqual(low["coverage"], "Limited history")
        self.assertIn("initial plan", low["message"].lower())
        missing = build_plan({"available": True, "employee_id": "EMP3", "week": "2025-01-27", "history": []})
        self.assertEqual(missing["recommendations"], [])
        self.assertNotIn(0, [item.get("category") for item in missing["recommendations"]])
        self.assertTrue(low["writes"] is False)

    def test_follow_up_rejects_another_employee_and_does_not_touch_kpi(self):
        with self.assertRaises(HTTPException):
            save_follow_up("EMP1", {"recommendation_id": "EMP2|2025-01-27|timeliness", "status": "Reviewed"})
        store = _Store()
        database = _Db(kpi_coach_followup=store)
        with patch("coach.get_db", return_value=database):
            saved = save_follow_up("EMP1", {
                "recommendation_id": "EMP1|2025-01-27|timeliness",
                "status": "Reviewed",
                "useful": True,
            })
        self.assertEqual(saved["effect_on_kpi"], "none")
        self.assertEqual(saved["status"], "Reviewed")
        self.assertEqual(len(store.docs), 1)
