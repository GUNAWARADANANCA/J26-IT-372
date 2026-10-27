from dotenv import load_dotenv
load_dotenv()

"""Tests for leave application workflow without mandatory fingerprint verification."""

import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import attendance
import payroll
import routes
from attendance import classify_scan, daily_attendance


class _MockCollection:
    def __init__(self, docs=None):
        self.docs = [dict(d) for d in (docs or [])]

    def find(self, query=None):
        query = query or {}
        results = []
        for d in self.docs:
            matched = True
            for k, v in query.items():
                if k == "status" and isinstance(v, dict) and "$regex" in v:
                    import re
                    pattern = re.compile(v["$regex"], re.IGNORECASE)
                    if not pattern.match(str(d.get("status") or "")):
                        matched = False
                        break
                elif k == "from_date" and isinstance(v, dict) and "$lte" in v:
                    if str(d.get("from_date") or "") > str(v["$lte"]):
                        matched = False
                        break
                elif k == "to_date" and isinstance(v, dict) and "$gte" in v:
                    if str(d.get("to_date") or "") < str(v["$gte"]):
                        matched = False
                        break
                elif d.get(k) != v:
                    matched = False
                    break
            if matched:
                results.append(dict(d))
        return _MockCursor(results)

    def find_one(self, query):
        res = self.find(query)
        return res[0] if res else None

    def insert_one(self, doc):
        self.docs.append(dict(doc))

    def delete_one(self, query):
        target = self.find_one(query)
        if target:
            self.docs = [d for d in self.docs if d.get("_id") != target.get("_id")]
            return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)

    def find_one_and_update(self, query, update, return_document=True):
        doc = self.find_one(query)
        if not doc:
            return None
        for d in self.docs:
            if d.get("_id") == doc.get("_id"):
                if "$set" in update:
                    d.update(update["$set"])
                return dict(d)
        return None

    def count_documents(self, query=None):
        return len(self.find(query))


class _MockCursor(list):
    def sort(self, *args, **kwargs):
        return self


class _MockDb:
    def __init__(self):
        self.collections = {
            "employee": _MockCollection([
                {
                    "_id": "EMP1137",
                    "employee_id": "EMP1137",
                    "employee_name": "Nuwan Priyantha Fernando",
                    "post_office": "Colombo Central",
                    "designation": "Postal Clerk",
                },
                {
                    "_id": "EMP1138",
                    "employee_id": "EMP1138",
                    "employee_name": "Sunil Chaminda Perera",
                    "post_office": "Kandy",
                    "designation": "Postman",
                },
            ]),
            "entitlement_leave": _MockCollection(),
            "attendance_log": _MockCollection(),
            "app_user": _MockCollection([
                {"_id": "postmaster", "username": "postmaster", "role": "postmaster"},
                {
                    "_id": "clerk",
                    "username": "clerk",
                    "role": "clerk",
                    "employee_id": "EMP1137",
                    "full_name": "Nuwan Priyantha Fernando",
                },
            ]),
            "app_session": _MockCollection(),
            "settings": _MockCollection(),
            "attendance_day": _MockCollection(),
        }

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = _MockCollection()
        return self.collections[name]

    def get(self, name, default=None):
        return self.collections.get(name, default)


class TestLeaveWorkflow(unittest.TestCase):
    def setUp(self):
        self.mock_db = _MockDb()

    def _make_request(self, role="postmaster", session_id="test_session", csrf="valid_token"):
        req = MagicMock()
        if session_id:
            req.cookies = {"postassist_session": session_id}
            req.headers = {"x-csrf-token": csrf}
        else:
            req.cookies = {}
            req.headers = {}
        req.method = "POST"
        return req

    # Scenario 1: Submit a valid leave request without fingerprint data — succeeds
    def test_01_submit_valid_leave_without_fingerprint(self):
        with patch("payroll.get_db", return_value=self.mock_db):
            payload = {
                "employee_id": "EMP1137",
                "leave_type": "Annual Leave",
                "from_date": "2026-10-21",
                "to_date": "2026-10-23",
                "reason": "Personal family event",
                # Note: No fingerprint_in or biometric data
            }
            res = payroll.create_entitlement("leave", payload)

            self.assertIn("id", res)
            self.assertEqual(res["employee_id"], "EMP1137")
            self.assertEqual(res["leave_type"], "Annual Leave")
            self.assertEqual(res["from_date"], "2026-10-21")
            self.assertEqual(res["to_date"], "2026-10-23")
            self.assertEqual(res["days"], 3.0)
            self.assertEqual(res["status"], "Pending")
            # Verify no fingerprint data was required or recorded
            self.assertNotIn("fingerprint_in", res)
            self.assertNotIn("fingerprint_out", res)

    # Scenario 2: Submit a request with a missing required leave date — returns clear validation error
    def test_02_missing_required_leave_date_rejected(self):
        with patch("payroll.get_db", return_value=self.mock_db):
            # Missing from_date
            with self.assertRaises(HTTPException) as cm:
                payroll.create_entitlement("leave", {
                    "employee_id": "EMP1137",
                    "leave_type": "Casual Leave",
                    "from_date": "",
                    "to_date": "2026-10-23",
                })
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("Start date", cm.exception.detail)

            # Missing to_date
            with self.assertRaises(HTTPException) as cm:
                payroll.create_entitlement("leave", {
                    "employee_id": "EMP1137",
                    "leave_type": "Casual Leave",
                    "from_date": "2026-10-21",
                    "to_date": "",
                })
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("End date", cm.exception.detail)

    # Scenario 3: Submit a request where end date is earlier than start date — rejected
    def test_03_end_date_earlier_than_start_date_rejected(self):
        with patch("payroll.get_db", return_value=self.mock_db):
            with self.assertRaises(HTTPException) as cm:
                payroll.create_entitlement("leave", {
                    "employee_id": "EMP1137",
                    "leave_type": "Casual Leave",
                    "from_date": "2026-10-25",
                    "to_date": "2026-10-20",  # earlier!
                })
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("cannot be earlier", cm.exception.detail)

    # Scenario 4: Submit a leave request while not signed in — rejected with 401
    def test_04_not_signed_in_rejected(self):
        req = self._make_request(session_id=None)
        with patch("routes.require_clerk_or_postmaster") as mock_auth:
            mock_auth.side_effect = HTTPException(status_code=401, detail="Sign in required.")
            with self.assertRaises(HTTPException) as cm:
                routes.add_leave_request(req, {"employee_id": "EMP1137"})
            self.assertEqual(cm.exception.status_code, 401)
            self.assertEqual(cm.exception.detail, "Sign in required.")

    # Scenario 5: Submit a leave request as an unauthorized user — rejected with 403
    def test_05_unauthorized_user_rejected(self):
        req = self._make_request(session_id="invalid_session")
        # A clerk trying to submit leave for another employee ID
        with patch("routes.require_clerk_or_postmaster", return_value={
            "username": "clerk",
            "role": "clerk",
            "employee_id": "EMP1137",
        }):
            with self.assertRaises(HTTPException) as cm:
                routes.add_leave_request(req, {
                    "employee_id": "EMP1138",  # not their own ID!
                    "leave_type": "Annual Leave",
                    "from_date": "2026-10-21",
                    "to_date": "2026-10-22",
                })
            self.assertEqual(cm.exception.status_code, 403)
            self.assertIn("only submit leave applications for your own", cm.exception.detail)

    # Scenario 6: Verify approval workflow (Postmaster can approve/reject, Clerk cannot)
    def test_06_approval_workflow(self):
        with patch("payroll.get_db", return_value=self.mock_db):
            # Create a pending leave
            leave_rec = payroll.create_entitlement("leave", {
                "employee_id": "EMP1137",
                "leave_type": "Medical Leave",
                "from_date": "2026-10-24",
                "to_date": "2026-10-26",
                "status": "Pending",
            })
            leave_id = leave_rec["id"]

            # Approve as Postmaster
            approved = payroll.update_leave_status(leave_id, "Approved")
            self.assertEqual(approved["status"], "Approved")

            # Reject as Postmaster
            rejected = payroll.update_leave_status(leave_id, "Rejected")
            self.assertEqual(rejected["status"], "Rejected")

            # Route check: non-postmaster is blocked by require_postmaster
            req_clerk = self._make_request(role="clerk")
            with patch("routes.require_postmaster") as mock_pm:
                mock_pm.side_effect = HTTPException(status_code=403, detail="A postmaster sign-in is required.")
                with self.assertRaises(HTTPException) as cm:
                    routes.edit_leave_request(leave_id, req_clerk, {"status": "Approved"})
                self.assertEqual(cm.exception.status_code, 403)

    # Scenario 7: Verify attendance fingerprint verification still behaves as intended on attendance screens
    def test_07_attendance_fingerprint_verification_intact(self):
        with patch('attendance.get_db', return_value=self.mock_db):
            settings = attendance.get_settings()
        ot_start = settings.get("windows", {}).get("on_time", {}).get("start") or settings.get("on_time_start", "08:00")
        h, m = map(int, ot_start.split(":"))
        now = datetime(2026, 10, 20, h, m + 5)

        # First check-in succeeds with clock time
        decision = classify_scan(now, settings, current=None, requested_action="check_in")
        self.assertEqual(decision["kind"], "check_in")
        self.assertEqual(decision["status"], "On time")

        # Duplicate check-in is rejected if fingerprint_in is present
        with self.assertRaises(HTTPException) as cm:
            classify_scan(now, settings, current={"fingerprint_in": f"{h:02d}:{m:02d}"}, requested_action="check_in")
        self.assertEqual(cm.exception.status_code, 409)
        self.assertIn("already signed in today", cm.exception.detail)

        # Check-out requires fingerprint_in first
        with self.assertRaises(HTTPException) as cm:
            classify_scan(now, settings, current={"fingerprint_in": None}, requested_action="check_out")
        self.assertEqual(cm.exception.status_code, 409)
        self.assertIn("Please Check-In first", cm.exception.detail)

    # Scenario 8: Verify leave calendar and relevant attendance views update correctly after approval
    def test_08_attendance_view_reflects_approved_leave(self):
        # Populate mock_db with an approved leave for EMP1138 on 2026-10-25
        self.mock_db["entitlement_leave"].insert_one({
            "_id": "leave-123",
            "employee_id": "EMP1138",
            "employee_name": "Sunil Chaminda Perera",
            "leave_type": "Casual Leave",
            "from_date": "2026-10-24",
            "to_date": "2026-10-26",
            "status": "Approved",
        })

        with patch("attendance.get_db", return_value=self.mock_db):
            result = daily_attendance(date="2026-10-25")
            records = result["records"]

            # EMP1138 should be labeled "On Leave", not unexcused "Absent"
            emp_rec = next((r for r in records if r["employee_id"] == "EMP1138"), None)
            self.assertIsNotNone(emp_rec)
            self.assertEqual(emp_rec["attendance_status"], "On Leave")
            self.assertEqual(emp_rec["display_status"], "On Leave")
            self.assertEqual(emp_rec["is_absent"], False)
            self.assertEqual(emp_rec["on_leave"], True)
            self.assertEqual(emp_rec["leave_type"], "Casual Leave")

            # EMP1137 has no approved leave and no log, so should be Absent
            emp1137_rec = next((r for r in records if r["employee_id"] == "EMP1137"), None)
            self.assertIsNotNone(emp1137_rec)
            self.assertEqual(emp1137_rec["attendance_status"], "Absent")
            self.assertEqual(emp1137_rec["is_absent"], True)

            # Summary metrics should reflect 1 On Leave
            self.assertEqual(result["summary"]["on_leave_count"], 1)


if __name__ == "__main__":
    unittest.main()
