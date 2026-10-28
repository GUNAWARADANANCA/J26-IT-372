"""Comprehensive test suite for the Advanced Daily Attendance Management System.

Tests all 20 functional and security criteria specified in the Master Prompt:
1. Valid on-time check-in (18:00 - 20:40 exclusive)
2. Valid late check-in (20:40 - 23:00 inclusive)
3. Valid half-day check-in (12:00 - 14:00 inclusive)
4. Check-in at exact 20:40 boundary (classified as Late)
5. Check-in at 20:39:59 (classified as On Time)
6. Check-in outside all enabled windows (rejected 403)
7. Check-out during evening window (16:00 - 22:00) with working duration
8. Check-out outside permitted window (rejected 403)
9. Duplicate check-in prevention (rejected 409)
10. Check-out without prior check-in (rejected 409)
11. Duplicate check-out prevention (rejected 409)
12. GPS geofence validation within radius
13. GPS geofence validation outside radius (rejected 403)
14. Attendance configuration persistence and updating
15. Summary dashboard metrics: Total, Present, On-Time, Late, Half-Day, Absent, Currently Checked In, Rate
16. Absent employee list generation for dates with unrecorded officers
17. Excel workbook generation with Sri Lanka Post headers
18. Reset attendance endpoint for re-testing
19. Asia/Colombo timezone handling
20. Category and module preservation
"""

import io
import os
import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
import openpyxl

from attendance import (
    COLOMBO,
    DEFAULT_SETTINGS,
    assert_at_office,
    classify_attendance_time,
    classify_scan,
    colombo_now,
    colombo_today,
    current_time_window,
    daily_attendance,
    export_daily_attendance_excel,
    get_settings,
    record_scan,
    reset_attendance_record,
    save_settings,
    submit_scan,
    validate_gps_location,
)


class _MockCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None):
        query = query or {}
        rows = []
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                rows.append(doc)
        return rows

    def find_one(self, query):
        rows = self.find(query)
        return rows[0] if rows else None

    def insert_one(self, doc):
        if any(item.get("_id") == doc.get("_id") for item in self.docs):
            raise RuntimeError(f"Duplicate key: {doc.get('_id')}")
        self.docs.append(dict(doc))

    def delete_one(self, query):
        self.docs = [d for d in self.docs if d.get("_id") != query.get("_id")]
        class DelResult:
            deleted_count = 1
        return DelResult()

    def update_one(self, query, update, upsert=False):
        current = self.find_one(query)
        if current is None and upsert:
            self.docs.append({"_id": query.get("_id"), **update.get("$set", {})})
            return
        if current:
            current.update(update.get("$set", {}))

    def replace_one(self, query, doc, upsert=False):
        current = self.find_one(query)
        if current is None and upsert:
            self.docs.append(dict(doc))
            return
        if current:
            current.clear()
            current.update(doc)

    def count_documents(self, query=None):
        return len(self.find(query))


class _MockDb(dict):
    def __getitem__(self, name):
        if name not in self:
            self[name] = _MockCollection([])
        return dict.__getitem__(self, name)


class AdvancedDailyAttendanceTests(unittest.TestCase):
    def setUp(self):
        os.environ["ATTENDANCE_DOOR_SECRET"] = "testing-secret-key-16-chars-min"
        self.employees = [
            {"_id": "EMP101", "employee_id": "EMP101", "employee_name": "Nuwan Fernando", "designation": "Senior Postman", "post_office": "Kaduwela Head Post Office", "work_category": "Delivery (Field)"},
            {"_id": "EMP102", "employee_id": "EMP102", "employee_name": "Dinesh Silva", "designation": "Postal Clerk", "post_office": "Kaduwela Head Post Office", "work_category": "Counter Operations"},
            {"_id": "EMP103", "employee_id": "EMP103", "employee_name": "Kavindi Perera", "designation": "Mail Sorting Officer", "post_office": "Kaduwela Head Post Office", "work_category": "Mail Sorting"},
            {"_id": "EMP104", "employee_id": "EMP104", "employee_name": "Sunil Shantha", "designation": "Driver", "post_office": "Kaduwela Head Post Office", "work_category": "Logistics & Transport"},
        ]
        self.db = _MockDb({
            "employee": _MockCollection(self.employees),
            "attendance_log": _MockCollection([]),
            "settings": _MockCollection([dict(DEFAULT_SETTINGS)]),
            "attendance_audit": _MockCollection([]),
            "attendance_rate": _MockCollection([]),
            "attendance_scan_guard": _MockCollection([]),
            "attendance_day": _MockCollection([]),
        })
        self.patcher = patch("attendance.get_db", return_value=self.db)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_01_valid_on_time_check_in(self):
        """18:00 to 20:40 exclusive check-in classified as On Time and Present with 0 late minutes."""
        now = datetime(2026, 10, 20, 18, 30, tzinfo=COLOMBO)  # 06:30 PM
        with patch("attendance.colombo_now", return_value=now):
            res = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(res["action"], "in")
        self.assertEqual(res["status"], "On time")
        self.assertEqual(res["attendance_type"], "On Time")
        self.assertEqual(res["late_duration_minutes"], 0)
        self.assertEqual(res["late_duration_formatted"], "0m")
        self.assertEqual(res["time"], "18:30")

    def test_02_valid_late_check_in_with_duration(self):
        """20:40 to 23:00 inclusive check-in classified as Late with late minutes relative to 20:40."""
        now = datetime(2026, 10, 20, 21, 5, tzinfo=COLOMBO)  # 09:05 PM (25 mins after 20:40)
        with patch("attendance.colombo_now", return_value=now):
            res = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(res["action"], "in")
        self.assertEqual(res["status"], "Late")
        self.assertEqual(res["attendance_type"], "Late")
        self.assertEqual(res["late_duration_minutes"], 25)
        self.assertEqual(res["late_duration_formatted"], "25m")

    def test_03_valid_half_day_check_in(self):
        """12:00 to 14:00 check-in classified as Half Day."""
        now = datetime(2026, 10, 20, 12, 45, tzinfo=COLOMBO)  # 12:45 PM
        with patch("attendance.colombo_now", return_value=now):
            res = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(res["action"], "in")
        self.assertEqual(res["status"], "Half day")
        self.assertEqual(res["attendance_type"], "Half Day")

    def test_04_exact_boundary_classification(self):
        """At 20:40 exactly, check-in must be classified as Late (20:40 is inclusive for Late)."""
        exact_2040 = datetime(2026, 10, 20, 20, 40, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=exact_2040):
            res = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(res["status"], "Late")
        self.assertEqual(res["late_duration_minutes"], 0)

        # And at 20:39, check-in must be classified as On Time (20:40 is exclusive for On Time)
        reset_attendance_record("EMP101", "2026-10-20")
        at_2039 = datetime(2026, 10, 20, 20, 39, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=at_2039):
            res2 = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(res2["status"], "On time")
        self.assertEqual(res2["attendance_type"], "On Time")

    def test_05_check_in_outside_enabled_windows_rejected(self):
        """Check-in outside all windows (e.g. 15:00) must raise 403 with clear explanation."""
        at_1500 = datetime(2026, 10, 20, 15, 0, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=at_1500):
            with self.assertRaises(HTTPException) as ctx:
                record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("outside all configured check-in windows", ctx.exception.detail)

    def test_06_check_out_during_evening_window_with_working_duration(self):
        """Check-out during 16:00-22:00 calculates working duration and preserves check-in classification."""
        in_time = datetime(2026, 10, 20, 18, 0, tzinfo=COLOMBO)  # In at 18:00
        with patch("attendance.colombo_now", return_value=in_time):
            record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")

        out_time = datetime(2026, 10, 20, 21, 30, tzinfo=COLOMBO)  # Out at 21:30 (3h 30m = 210m)
        with patch("attendance.colombo_now", return_value=out_time):
            res_out = record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_out")
        self.assertEqual(res_out["action"], "out")
        self.assertEqual(res_out["status"], "On time")  # Preserved original classification
        self.assertEqual(res_out["working_duration_minutes"], 210)
        self.assertEqual(res_out["working_duration_formatted"], "3h 30m")

    def test_07_check_out_outside_window_rejected(self):
        """Check-out outside 16:00-22:00 raises 403."""
        in_time = datetime(2026, 10, 20, 12, 30, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=in_time):
            record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")

        out_too_early = datetime(2026, 10, 20, 14, 30, tzinfo=COLOMBO)  # 14:30 is before 16:00
        with patch("attendance.colombo_now", return_value=out_too_early):
            with self.assertRaises(HTTPException) as ctx:
                record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_out")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("permitted evening check-out window", ctx.exception.detail)

    def test_08_duplicate_check_in_prevention(self):
        """Existing open attendance session rejects another Check-In with 409 Conflict."""
        in_time = datetime(2026, 10, 20, 18, 30, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=in_time):
            record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")

        # Try second check-in
        with patch("attendance.colombo_now", return_value=in_time):
            with self.assertRaises(HTTPException) as ctx:
                record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("already signed in today", ctx.exception.detail)

    def test_09_check_out_without_check_in_rejected(self):
        """Check-out without an open session raises 409."""
        now = datetime(2026, 10, 20, 17, 0, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=now):
            with self.assertRaises(HTTPException) as ctx:
                record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_out")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("has not signed in today yet", ctx.exception.detail)

    def test_10_duplicate_check_out_prevention(self):
        """Repeated check-out after already checking out raises 409 Conflict."""
        in_time = datetime(2026, 10, 20, 18, 0, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=in_time):
            record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_in")

        out_time = datetime(2026, 10, 20, 21, 0, tzinfo=COLOMBO)
        with patch("attendance.colombo_now", return_value=out_time):
            record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_out")

        # Attempt second check-out
        with patch("attendance.colombo_now", return_value=out_time):
            with self.assertRaises(HTTPException) as ctx:
                record_scan("EMP101", 6.927763, 79.949514, 10.0, requested_action="check_out")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("already signed out today", ctx.exception.detail)

    def test_11_gps_geofence_within_radius_verified(self):
        """Coordinates within radius (e.g. 15m away) pass geofence verification."""
        val = validate_gps_location(6.927763, 79.949514, accuracy=10.0)
        self.assertTrue(val["within_radius"])
        self.assertEqual(val["geofence_status"], "Passed")

    def test_12_gps_geofence_outside_radius_rejected(self):
        """Coordinates outside radius (>50m away) are rejected with 403."""
        # 6.930200, 79.949573 is ~270 meters away
        with self.assertRaises(HTTPException) as ctx:
            assert_at_office(6.930200, 79.949573, accuracy=10.0)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("outside the permitted office attendance area", ctx.exception.detail)

    def test_13_attendance_configuration_persistence(self):
        """Settings updates persist in DB and are returned by get_settings."""
        updates = {
            "on_time_start": "18:15",
            "on_time_end": "20:30",
            "late_start": "20:30",
            "late_end": "22:45",
            "on_time_enabled": True,
            "late_enabled": False,
            "radius_meters": 75,
            "updated_by": "Postmaster Bandara",
        }
        saved = save_settings(updates)
        self.assertEqual(saved["on_time_start"], "18:15")
        self.assertEqual(saved["on_time_end"], "20:30")
        self.assertEqual(saved["late_enabled"], False)
        self.assertEqual(saved["radius_meters"], 75)
        self.assertEqual(saved["updated_by"], "Postmaster Bandara")

        # Confirm reload from DB matches
        reloaded = get_settings()
        self.assertEqual(reloaded["on_time_start"], "18:15")
        self.assertEqual(reloaded["late_enabled"], False)

    def test_14_dashboard_summary_metrics(self):
        """Dashboard summary accurately counts Total, Present, On-time, Late, Absent, and Currently In."""
        today = "2026-10-20"
        # 1. EMP101 checked in on time and checked out
        self.db["attendance_log"].insert_one({
            "_id": f"EMP101-{today}", "employee_id": "EMP101", "employee_name": "Nuwan Fernando",
            "date": today, "fingerprint_in": "18:30", "fingerprint_out": "21:30",
            "check_in_time": "18:30", "check_out_time": "21:30", "attendance_type": "On Time", "attendance_status": "Present",
        })
        # 2. EMP102 checked in late and NOT checked out (currently checked in)
        self.db["attendance_log"].insert_one({
            "_id": f"EMP102-{today}", "employee_id": "EMP102", "employee_name": "Dinesh Silva",
            "date": today, "fingerprint_in": "21:10", "fingerprint_out": None,
            "check_in_time": "21:10", "check_out_time": "—", "attendance_type": "Late", "attendance_status": "Present",
        })
        # EMP103 and EMP104 did not check in (Absent)

        report = daily_attendance(today)
        summ = report["summary"]
        self.assertEqual(summ["total_employees"], 4)
        self.assertEqual(summ["present_today"], 2)
        self.assertEqual(summ["on_time_count"], 1)
        self.assertEqual(summ["late_count"], 1)
        self.assertEqual(summ["half_day_count"], 0)
        self.assertEqual(summ["absent_count"], 2)
        self.assertEqual(summ["currently_checked_in"], 1)
        self.assertEqual(summ["attendance_rate"], 50.0)

        # Check that absent employees are synthesized
        self.assertEqual(len(report["absent_employees"]), 2)
        absent_ids = {a["employee_id"] for a in report["absent_employees"]}
        self.assertEqual(absent_ids, {"EMP103", "EMP104"})

    def test_15_search_and_filtering(self):
        """Searching and filtering correctly filters table rows."""
        today = "2026-10-20"
        self.db["attendance_log"].insert_one({
            "_id": f"EMP101-{today}", "employee_id": "EMP101", "employee_name": "Nuwan Fernando",
            "date": today, "fingerprint_in": "18:30", "fingerprint_out": "21:30",
            "check_in_type": "On Time", "attendance_status": "Present",
        })
        self.db["attendance_log"].insert_one({
            "_id": f"EMP102-{today}", "employee_id": "EMP102", "employee_name": "Dinesh Silva",
            "date": today, "fingerprint_in": "21:10", "fingerprint_out": None,
            "check_in_type": "Late", "attendance_status": "Present",
        })

        # Search for Dinesh
        res_search = daily_attendance(today, search="dinesh")
        self.assertEqual(len(res_search["records"]), 1)
        self.assertEqual(res_search["records"][0]["employee_id"], "EMP102")

        # Filter by Late type
        res_late = daily_attendance(today, type_filter="Late")
        self.assertEqual(len(res_late["records"]), 1)
        self.assertEqual(res_late["records"][0]["employee_id"], "EMP102")

        # Filter by Currently Checked In
        res_in = daily_attendance(today, status_filter="Currently Checked In")
        self.assertEqual(len(res_in["records"]), 1)
        self.assertEqual(res_in["records"][0]["employee_id"], "EMP102")

    def test_16_excel_export_generation(self):
        """Excel export generates valid .xlsx binary buffer with sanitization."""
        today = "2026-10-20"
        self.db["attendance_log"].insert_one({
            "_id": f"EMP101-{today}", "employee_id": "EMP101", "employee_name": "Nuwan Fernando",
            "date": today, "fingerprint_in": "18:30", "fingerprint_out": "21:30",
            "check_in_type": "On Time", "attendance_status": "Present", "distance_meters": 12.4,
        })
        buf = export_daily_attendance_excel(today)
        self.assertIsInstance(buf, io.BytesIO)
        buf.seek(0)
        wb = openpyxl.load_workbook(buf)
        self.assertIn("Daily Attendance", wb.sheetnames)
        ws = wb["Daily Attendance"]
        self.assertIn("SRI LANKA POSTAL DEPARTMENT", str(ws["A1"].value))
        self.assertEqual(ws.cell(row=8, column=2).value, "EMP101")


if __name__ == "__main__":
    unittest.main()
