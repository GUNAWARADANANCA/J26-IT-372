import unittest
from kpi_dashboard_service import get_dashboard_data, export_dashboard_csv, _calc_kpi, _classify_status


class TestKpiDashboardService(unittest.TestCase):
    def test_provisional_formula_calculation(self):
        # 40% completion, 30% accuracy, 30% timeliness
        # 100 * 0.4 + 100 * 0.3 + 100 * 0.3 = 100.0
        self.assertEqual(_calc_kpi(100.0, 100.0, 100.0), 100.0)
        # 80 * 0.4 + 70 * 0.3 + 90 * 0.3 = 32 + 21 + 27 = 80.0
        self.assertEqual(_calc_kpi(80.0, 70.0, 90.0), 80.0)
        # Missing values return None
        self.assertIsNone(_calc_kpi(None, 80.0, 80.0))
        self.assertIsNone(_calc_kpi(80.0, None, 80.0))
        self.assertIsNone(_calc_kpi(80.0, 80.0, None))

    def test_performance_tier_classification(self):
        self.assertEqual(_classify_status(85.0), "On Track")
        self.assertEqual(_classify_status(80.0), "On Track")
        self.assertEqual(_classify_status(75.0), "Needs Improvement")
        self.assertEqual(_classify_status(70.0), "Needs Improvement")
        self.assertEqual(_classify_status(69.9), "Poor")
        self.assertEqual(_classify_status(None), "Not Evaluated")

    def test_dashboard_data_defaults(self):
        data = get_dashboard_data(period_type="all")
        summary = data["summary"]
        # Must have all 15 executive summary metrics
        self.assertIn("total_active_employees", summary)
        self.assertIn("evaluated_employees", summary)
        self.assertIn("average_kpi_score", summary)
        self.assertIn("meeting_target_count", summary)
        self.assertIn("below_target_count", summary)
        self.assertIn("unevaluated_count", summary)
        self.assertIn("average_completion_rate", summary)
        self.assertIn("average_accuracy_rate", summary)
        self.assertIn("average_timeliness_rate", summary)
        self.assertIn("total_assigned_tasks", summary)
        self.assertIn("total_completed_tasks", summary)
        self.assertIn("total_pending_tasks", summary)
        self.assertIn("total_overdue_tasks", summary)
        self.assertIn("attendance_rate", summary)
        self.assertIn("requiring_review_count", summary)

        self.assertEqual(summary["total_active_employees"], 7)
        self.assertGreater(summary["evaluated_employees"], 0)
        self.assertIsNotNone(summary["average_kpi_score"])
        self.assertEqual(len(data["employee_rows"]), 7)
        self.assertGreater(len(data["historical_trends"]), 0)

    def test_dashboard_data_daily_scope(self):
        # A day with data
        data_active = get_dashboard_data(period_type="daily", start_date="2025-12-15")
        self.assertEqual(data_active["summary"]["evaluated_employees"], 7)

        # A date without end-of-shift clearance (e.g. today 2026-10-28)
        data_today = get_dashboard_data(period_type="daily", start_date="2026-10-28")
        self.assertEqual(data_today["summary"]["evaluated_employees"], 0)
        self.assertEqual(data_today["summary"]["unevaluated_count"], 7)
        self.assertIsNone(data_today["summary"]["average_kpi_score"])

    def test_dashboard_status_filtering(self):
        data_on_track = get_dashboard_data(period_type="all", performance_status="on_track")
        for r in data_on_track["employee_rows"]:
            self.assertEqual(r["performance_status"], "On Track")

    def test_dashboard_csv_export(self):
        data = get_dashboard_data(period_type="all")
        csv_emp = export_dashboard_csv(data, export_type="employees")
        self.assertIn("Employee_ID,Employee_Name", csv_emp)
        self.assertIn("EMP1137", csv_emp)

        csv_sum = export_dashboard_csv(data, export_type="summary")
        self.assertIn("Total Active Employees,7", csv_sum)

        csv_trends = export_dashboard_csv(data, export_type="trends")
        self.assertIn("Week,Overall_KPI", csv_trends)


if __name__ == "__main__":
    unittest.main()
