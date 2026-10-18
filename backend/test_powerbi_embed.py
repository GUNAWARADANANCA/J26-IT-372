"""Power BI stays unconfigured until real workspace values exist."""

import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from powerbi_embed import embed_for, status


class PowerBiStatusTests(unittest.TestCase):
    def test_missing_configuration_exposes_names_only(self):
        cleared = {name: "" for name in (
            "POWERBI_TENANT_ID",
            "POWERBI_CLIENT_ID",
            "POWERBI_CLIENT_SECRET",
            "POWERBI_WORKSPACE_ID",
            "POWERBI_REPORT_PRODUCTIVITY",
            "POWERBI_REPORT_FORECAST_MONITORING",
            "POWERBI_REPORT_KPI_SIMULATOR",
            "POWERBI_REPORT_KPI_FORECASTS",
            "POWERBI_REPORT_POSTAL_KPI_DASHBOARD",
        )}
        with patch.dict(os.environ, cleared, clear=False):
            report = status()
        self.assertFalse(report["configured"])
        self.assertFalse(report["publish_to_web"])
        self.assertIn("POWERBI_CLIENT_SECRET", report["missing"])
        self.assertNotIn("secret-value", json_text(report))
        with self.assertRaises(HTTPException) as raised:
            embed_for("productivity")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertNotIn("accessToken", raised.exception.detail)

    def test_unknown_page_is_rejected_before_a_token_request(self):
        with self.assertRaises(HTTPException) as raised:
            embed_for("payroll")
        self.assertEqual(raised.exception.status_code, 404)


def json_text(value) -> str:
    return str(value)


if __name__ == "__main__":
    unittest.main()
