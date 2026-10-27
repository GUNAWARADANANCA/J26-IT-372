"""Random Forest preview stays off MongoDB and off generate_forecasts."""

import math
import unittest

from pydantic import ValidationError

from rf_kpi_preview import FEATURE_COLUMNS, MODEL_PATH, RandomForestPreview, load_random_forest, preview_next_week_kpi


VALID = {
    "KPI_Score": 80.0,
    "KPI_Lag_1": 78.0,
    "KPI_Lag_2": 76.0,
    "KPI_Mean_Previous_4": 77.5,
    "Years_of_Experience": 5,
    "Post_Office": "Kaduwela",
    "Designation": "Postman",
    "Work_Category": "Delivery (Field)",
    "Employment_Type": "Permanent",
}


class RandomForestPreviewTests(unittest.TestCase):
    @unittest.skipUnless(MODEL_PATH.exists(), "Local 91.5 MB kpi_forecast_model.joblib not present in CI checkout")
    def test_model_loads_with_training_columns(self):
        pipeline = load_random_forest()
        self.assertEqual(tuple(pipeline.feature_names_in_), FEATURE_COLUMNS)
        self.assertIn("regressor", pipeline.named_steps)

    @unittest.skipUnless(MODEL_PATH.exists(), "Local 91.5 MB kpi_forecast_model.joblib not present in CI checkout")
    def test_valid_row_is_inferred(self):
        result = preview_next_week_kpi(RandomForestPreview(**VALID))
        self.assertEqual(result["model"], "kpi_forecast_model.joblib")
        self.assertEqual(result["target"], "Target_KPI")
        self.assertTrue(math.isfinite(result["predicted_kpi"]))

    def test_missing_feature_is_rejected(self):
        payload = dict(VALID)
        del payload["KPI_Lag_2"]
        with self.assertRaises(ValidationError):
            RandomForestPreview(**payload)

    def test_blank_category_is_rejected(self):
        payload = dict(VALID)
        payload["Post_Office"] = "  "
        with self.assertRaises(ValidationError):
            RandomForestPreview(**payload)
