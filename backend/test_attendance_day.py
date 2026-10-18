"""Daily attendance is stored per date and is not deleted when a day closes."""

import unittest
from unittest.mock import patch

from fastapi import HTTPException

from attendance import close_attendance_day, daily_attendance, display_status, open_attendance_day
from routes import finish_attendance_day, read_daily_attendance


class _Result:
    def __init__(self, count=1):
        self.matched_count = count
        self.deleted_count = count


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None):
        query = query or {}
        rows = []
        for doc in self.docs:
            if all(doc.get(key) == value for key, value in query.items()):
                rows.append(doc)
        return rows

    def find_one(self, query):
        rows = self.find(query)
        return rows[0] if rows else None

    def insert_one(self, doc):
        if any(item.get("_id") == doc.get("_id") for item in self.docs):
            raise RuntimeError("duplicate")
        self.docs.append(doc)

    def replace_one(self, query, doc, upsert=False):
        current = self.find_one(query)
        if current is None and upsert:
            self.docs.append(doc)
            return _Result(1)
        if current is None:
            return _Result(0)
        current.clear()
        current.update(doc)
        return _Result(1)


class _Database(dict):
    def __getitem__(self, name):
        if name not in self:
            self[name] = _Collection([])
        return dict.__getitem__(self, name)


def _request():
    from starlette.requests import Request

    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 5000),
            "server": ("127.0.0.1", 8000),
        }
    )


class DailyAttendanceTests(unittest.TestCase):
    def setUp(self):
        self.database = _Database(
            attendance_log=_Collection(
                [
                    {
                        "_id": "EMP1-2026-10-14",
                        "name": "EMP1-2026-10-14",
                        "employee_id": "EMP1",
                        "employee_name": "Nimal",
                        "post_office": "Kaduwela",
                        "designation": "Postman",
                        "date": "2026-10-14",
                        "fingerprint_in": "08:10",
                        "fingerprint_out": "17:05",
                        "attendance_status": "On time",
                    },
                    {
                        "_id": "EMP2-2026-10-15",
                        "name": "EMP2-2026-10-15",
                        "employee_id": "EMP2",
                        "employee_name": "Kamal",
                        "date": "2026-10-15",
                        "fingerprint_in": "08:20",
                        "fingerprint_out": "",
                        "attendance_status": "On time",
                    },
                ]
            ),
            attendance_day=_Collection([]),
        )
        self.patch = patch("attendance.get_db", return_value=self.database)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def test_selected_date_does_not_include_other_days(self):
        today = daily_attendance("2026-10-15")
        self.assertEqual([row["employee_id"] for row in today["records"]], ["EMP2"])
        self.assertEqual(today["records"][0]["display_status"], "Incomplete")
        yesterday = daily_attendance("2026-10-14")
        self.assertEqual(yesterday["count"], 1)
        self.assertEqual(yesterday["records"][0]["display_status"], "On time")
        self.assertEqual(daily_attendance("2026-10-16")["count"], 0)

    def test_missing_fingerprint_is_not_absence(self):
        self.assertEqual(display_status({"fingerprint_in": "", "fingerprint_out": ""}), "Pending")
        self.assertNotEqual(display_status({"fingerprint_in": "08:00"}), "Absent")

    def test_close_keeps_records_and_blocks_reopen(self):
        closed = close_attendance_day("2026-10-14", "postmaster", True)
        self.assertEqual(closed["day_status"], "closed")
        self.assertEqual(closed["count"], 1)
        with self.assertRaises(HTTPException) as again:
            open_attendance_day("2026-10-14", "postmaster")
        self.assertEqual(again.exception.status_code, 403)
        opened = open_attendance_day("2026-10-16", "postmaster")
        self.assertEqual(opened["attendance_date"], "2026-10-16")
        self.assertEqual(daily_attendance("2026-10-14")["count"], 1)

    def test_incomplete_close_needs_confirmation(self):
        with self.assertRaises(HTTPException) as warned:
            close_attendance_day("2026-10-15", "postmaster", False)
        self.assertEqual(warned.exception.status_code, 409)
        self.assertIn("fingerprint", warned.exception.detail)

    def test_daily_routes_require_a_postmaster(self):
        with self.assertRaises(HTTPException) as denied:
            read_daily_attendance(_request(), "2026-10-15")
        self.assertEqual(denied.exception.status_code, 401)
        with self.assertRaises(HTTPException) as close:
            finish_attendance_day(_request(), {"date": "2026-10-15", "confirm": True})
        self.assertEqual(close.exception.status_code, 401)

    def test_duplicate_employee_date_is_rejected(self):
        with self.assertRaises(RuntimeError):
            self.database["attendance_log"].insert_one({"_id": "EMP1-2026-10-14", "date": "2026-10-14"})


if __name__ == "__main__":
    unittest.main()
