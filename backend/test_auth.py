"""Sign-in checks for forecast saving and monitoring."""

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from auth import bootstrap_postmaster, cookie_settings, hash_password, login, logout, password_help, require_postmaster
from auth import _failures
from productivity import simulate_productivity
from routes import read_forecast_monitoring, read_payroll, save_employee_forecast


class _Collection:
    def __init__(self, docs):
        self.docs = list(docs)

    def find_one(self, query):
        wanted = query.get("_id")
        role = query.get("role")
        for doc in self.docs:
            if wanted is not None and doc.get("_id") != wanted:
                continue
            if role is not None and doc.get("role") != role:
                continue
            if wanted is None and role is None:
                return doc
            if wanted is not None or role is not None:
                return doc
        return None

    def find(self, query=None):
        query = query or {}
        rows = self.docs
        if "employee_id" in query:
            rows = [doc for doc in rows if doc.get("employee_id") == query["employee_id"]]
        return list(rows)

    def insert_one(self, doc):
        self.docs.append(doc)

    def delete_one(self, query):
        self.docs = [doc for doc in self.docs if doc.get("_id") != query.get("_id")]


class _Database(dict):
    def __getitem__(self, name):
        return dict.__getitem__(self, name)


def _request(method, cookie=None, csrf=None):
    headers = []
    if cookie:
        headers.append((b"cookie", f"postassist_session={cookie}".encode()))
    if csrf:
        headers.append((b"x-csrf-token", csrf.encode()))
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": headers,
            "client": ("127.0.0.1", 5000),
            "server": ("127.0.0.1", 8000),
        }
    )


class _Model:
    def predict(self, frame):
        return [50]


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.database = _Database(
            app_user=_Collection(
                [
                    {
                        "_id": "postmaster",
                        "username": "postmaster",
                        "password_hash": hash_password("test-password"),
                        "role": "postmaster",
                    },
                    {
                        "_id": "clerk",
                        "username": "clerk",
                        "password_hash": hash_password("test-password"),
                        "role": "clerk",
                    },
                ]
            ),
            app_session=_Collection([]),
            employee=_Collection(
                [
                    {
                        "_id": "EMP1",
                        "employee_name": "Test Officer",
                        "work_category": "Office",
                        "years_of_experience": 4,
                    }
                ]
            ),
            daily_kpi_log=_Collection(
                [
                    {
                        "employee_id": "EMP1",
                        "date": "2025-04-07",
                        "completion_rate": 80,
                        "accuracy_rate": 80,
                        "timeliness_rate": 80,
                        "assigned_work_count": 8,
                        "uncompleted_work_count": 1,
                        "incorrect_work_count": 0,
                        "late_work_count": 0,
                    }
                ]
            ),
            kpi_forecast=_Collection([]),
        )
        self.patches = [
            patch("auth.get_db", return_value=self.database),
            patch("productivity.get_db", return_value=self.database),
            patch("productivity.load_model", return_value={"model": _Model(), "cut": "test"}),
        ]
        for item in self.patches:
            item.start()
        _failures.clear()

    def tearDown(self):
        for item in self.patches:
            item.stop()

    def test_invalid_credentials_are_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            login("postmaster", "wrong-password")
        self.assertEqual(caught.exception.status_code, 401)
        self.assertEqual(caught.exception.detail, "Sign-in failed.")

    def test_forecasts_require_a_postmaster_session(self):
        with self.assertRaises(HTTPException) as missing:
            read_forecast_monitoring(_request("GET"))
        self.assertEqual(missing.exception.status_code, 401)
        with self.assertRaises(HTTPException) as save_missing:
            save_employee_forecast("EMP1", _request("POST"), {})
        self.assertEqual(save_missing.exception.status_code, 401)

        clerk = login("clerk", "test-password")
        with self.assertRaises(HTTPException) as forbidden:
            read_forecast_monitoring(_request("GET", clerk["session_id"]))
        self.assertEqual(forbidden.exception.status_code, 403)

        with self.assertRaises(HTTPException) as bad_session:
            read_forecast_monitoring(_request("GET", "not-a-session"))
        self.assertEqual(bad_session.exception.status_code, 401)

        postmaster = login("postmaster", "test-password")
        self.database["app_session"].docs[1]["expires_at"] = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        ).isoformat()
        with self.assertRaises(HTTPException) as expired:
            require_postmaster(_request("GET", postmaster["session_id"]))
        self.assertEqual(expired.exception.status_code, 401)

        active = login("postmaster", "test-password")
        board = read_forecast_monitoring(_request("GET", active["session_id"]))
        self.assertEqual(board["saved_forecasts"], 0)
        saved = save_employee_forecast(
            "EMP1",
            _request("POST", active["session_id"], active["csrf_token"]),
            {"week": "2025-04-07"},
        )
        again = save_employee_forecast(
            "EMP1",
            _request("POST", active["session_id"], active["csrf_token"]),
            {"week": "2025-04-07"},
        )
        self.assertFalse(saved["already_saved"])
        self.assertTrue(again["already_saved"])
        self.assertEqual(len(self.database["kpi_forecast"].docs), 1)
        visible = read_forecast_monitoring(_request("GET", active["session_id"]))
        self.assertEqual(visible["saved_forecasts"], 1)
        self.assertEqual(visible["pending"], 1)
        self.assertIsNone(visible["mae"])

    def test_simulation_does_not_store_a_forecast(self):
        simulate_productivity(
            "EMP1",
            [
                {
                    "completion": 80,
                    "accuracy": 80,
                    "timeliness": 80,
                    "assigned": 8,
                    "uncompleted": 1,
                    "incorrect": 0,
                    "late": 0,
                }
            ],
        )
        self.assertEqual(self.database["kpi_forecast"].docs, [])

    def test_lockout_expires_and_logout_invalidates_the_session(self):
        for _ in range(5):
            with self.assertRaises(HTTPException):
                login("postmaster", "wrong-password")
        with self.assertRaises(HTTPException) as locked:
            login("postmaster", "test-password")
        self.assertEqual(locked.exception.detail, "Sign-in failed.")
        _failures["postmaster"] = [datetime.now(timezone.utc) - timedelta(minutes=5)]
        session = login("postmaster", "test-password")
        self.assertNotIn("password", session)
        logout(_request("POST", session["session_id"], session["csrf_token"]))
        with self.assertRaises(HTTPException) as gone:
            require_postmaster(_request("GET", session["session_id"]))
        self.assertEqual(gone.exception.status_code, 401)

    def test_wrong_csrf_and_open_routes(self):
        session = login("postmaster", "test-password")
        with self.assertRaises(HTTPException) as bad_csrf:
            save_employee_forecast(
                "EMP1",
                _request("POST", session["session_id"], "wrong-token"),
                {"week": "2025-04-07"},
            )
        self.assertEqual(bad_csrf.exception.status_code, 403)
        with self.assertRaises(HTTPException) as payroll:
            read_payroll(_request("GET"), "2025-04")
        self.assertEqual(payroll.exception.status_code, 401)
        settings = cookie_settings()
        self.assertTrue(settings["httponly"])
        self.assertEqual(settings["samesite"], "lax")
        self.assertIn("secure", settings)

    def test_bootstrap_does_not_replace_an_existing_postmaster(self):
        original = self.database["app_user"].docs[0]["password_hash"]
        os.environ["POSTMASTER_USERNAME"] = "postmaster"
        os.environ["POSTMASTER_PASSWORD"] = "another-long-password"
        try:
            bootstrap_postmaster()
        finally:
            os.environ.pop("POSTMASTER_USERNAME", None)
            os.environ.pop("POSTMASTER_PASSWORD", None)
        self.assertEqual(self.database["app_user"].docs[0]["password_hash"], original)
        self.assertNotEqual(hash_password("test-password"), hash_password("test-password"))

    def test_password_help_does_not_change_or_reveal_an_account(self):
        original = self.database["app_user"].docs[0]["password_hash"]
        known = password_help("postmaster")
        unknown = password_help("nobody")
        self.assertEqual(known, unknown)
        self.assertIn("administrator", known["detail"].lower())
        self.assertEqual(self.database["app_user"].docs[0]["password_hash"], original)
        self.assertEqual(len(self.database["app_session"].docs), 0)


if __name__ == "__main__":
    unittest.main()
