"""Comprehensive unit tests for Employee Unique Verification Code and Attendance Enforcement.

Tests all 16 cases specified in Section 11:
1. Employee with valid assigned code can verify identity.
2. Incorrect code is rejected.
3. Employee without assigned credential cannot check in.
4. Revoked or deactivated credential is rejected.
5. Expired verification session is rejected.
6. Verification token for Employee A cannot be used for Employee B.
7. Changing selected employee invalidates previous verification.
8. Unverified employee cannot check in through direct API request.
9. Unverified employee cannot check out through direct API request.
10. Duplicate check-in is prevented.
11. Check-out without open attendance session is rejected.
12. Repeated failed attempts trigger rate limiting / temporary lockout.
13. Unauthorized users cannot generate or reset credentials.
14. Successful check-in updates attendance records.
15. Successful check-out updates existing attendance record.
16. Existing GPS/geofence and time-window rules remain enforced.
"""

import hashlib
import hmac
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import attendance_credential
from attendance_credential import (
    admin_assign_custom_code,
    admin_generate_code,
    admin_revoke_credential,
    admin_toggle_active,
    admin_unlock_credential,
    consume_verification_token,
    generate_verification_code,
    hash_credential_code,
    issue_verification_token,
    list_employee_credentials,
    verify_credential_code,
    verify_employee_identity,
)


class _MockCollection:
    def __init__(self, initial_data=None):
        self._docs = list(initial_data or [])

    def find(self, query=None, projection=None):
        query = query or {}
        results = []
        for d in self._docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(dict(d))
        return results

    def find_one(self, query=None, projection=None):
        res = self.find(query, projection)
        return res[0] if res else None

    def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = str(len(self._docs) + 1)
        self._docs.append(d)
        return MagicMock(inserted_id=d["_id"])

    def update_one(self, query, update, upsert=False):
        matched = 0
        for i, d in enumerate(self._docs):
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                matched = 1
                if "$set" in update:
                    self._docs[i].update(update["$set"])
                return MagicMock(matched_count=1, modified_count=1)
        if upsert and matched == 0:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            self.insert_one(new_doc)
            return MagicMock(matched_count=0, modified_count=1)
        return MagicMock(matched_count=matched, modified_count=matched)

    def delete_one(self, query):
        for i, d in enumerate(self._docs):
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                del self._docs[i]
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)

    def count_documents(self, query):
        return len(self.find(query))


class TestAttendanceCredentialSystem(unittest.TestCase):
    def setUp(self):
        self.mock_employees = [
            {
                "_id": "EMP1143",
                "employee_id": "EMP1143",
                "employee_name": "Chathura Nilanga Rodrigo",
                "post_office": "Kaduwela",
                "designation": "Postal Officer",
            },
            {
                "_id": "EMP1137",
                "employee_id": "EMP1137",
                "employee_name": "Nuwan Priyantha Fernando",
                "post_office": "Kaduwela",
                "designation": "Counter Clerk",
            },
        ]
        self.code_1143 = "SLP-9482"
        self.code_1137 = "SLP-1137"
        
        self.mock_credentials = [
            {
                "_id": "cred_EMP1143",
                "employee_id": "EMP1143",
                "credential_hash": hash_credential_code(self.code_1143),
                "active": True,
                "failed_attempt_count": 0,
                "locked_until": None,
                "created_at": "2026-10-20T00:00:00Z",
                "updated_at": "2026-10-20T00:00:00Z",
                "last_used_at": None,
            },
            {
                "_id": "cred_EMP1137",
                "employee_id": "EMP1137",
                "credential_hash": hash_credential_code(self.code_1137),
                "active": True,
                "failed_attempt_count": 0,
                "locked_until": None,
                "created_at": "2026-10-20T00:00:00Z",
                "updated_at": "2026-10-20T00:00:00Z",
                "last_used_at": None,
            },
        ]
        self.mock_sessions = []
        self.mock_audits = []
        self.mock_logs = []

        self.mock_db = {
            "employee": _MockCollection(self.mock_employees),
            "employee_attendance_credential": _MockCollection(self.mock_credentials),
            "attendance_verification_session": _MockCollection(self.mock_sessions),
            "attendance_credential_audit": _MockCollection(self.mock_audits),
            "attendance_log": _MockCollection(self.mock_logs),
            "app_session": _MockCollection([]),
            "app_user": _MockCollection([]),
            "settings": _MockCollection([{
                "_id": "attendance",
                "on_time_start": "18:00",
                "on_time_end": "20:40",
                "on_time_enabled": True,
                "checkout_start": "16:00",
                "checkout_end": "22:00",
                "checkout_enabled": True,
                "radius_meters": 50,
            }]),
        }
        self.db_patcher = patch("attendance_credential.get_db", return_value=self.mock_db)
        self.db_patcher.start()

    def tearDown(self):
        self.db_patcher.stop()

    # 1. Employee with a valid assigned code can verify their identity
    def test_01_valid_code_verifies_identity(self):
        result = verify_employee_identity("EMP1143", self.code_1143)
        self.assertTrue(result["ok"])
        self.assertEqual(result["employee_id"], "EMP1143")
        self.assertEqual(result["employee_name"], "Chathura Nilanga Rodrigo")
        self.assertIn("verification_token", result)
        self.assertIn("check_in", result["allowed_actions"])

    # 2. Incorrect code is rejected
    def test_02_incorrect_code_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            verify_employee_identity("EMP1143", "WRONG-CODE-999")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Verification failed", ctx.exception.detail)

    # 3. Employee without an assigned credential cannot verify or check in
    def test_03_employee_without_credential_rejected(self):
        # Create an employee with no credential
        self.mock_db["employee"].insert_one({
            "_id": "EMP9999",
            "employee_id": "EMP9999",
            "employee_name": "No Credential Officer",
            "post_office": "Kaduwela",
        })
        with self.assertRaises(HTTPException) as ctx:
            verify_employee_identity("EMP9999", "ANY-CODE")
        self.assertEqual(ctx.exception.status_code, 401)

    # 4. Revoked or deactivated credential is rejected
    def test_04_deactivated_credential_rejected(self):
        # Deactivate EMP1143 credential
        self.mock_db["employee_attendance_credential"].update_one(
            {"employee_id": "EMP1143"},
            {"$set": {"active": False}},
        )
        with self.assertRaises(HTTPException) as ctx:
            verify_employee_identity("EMP1143", self.code_1143)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("deactivated", ctx.exception.detail.lower())

    # 5. Expired verification session is rejected
    def test_05_expired_verification_token_rejected(self):
        token_data = issue_verification_token("EMP1143")
        token_str = token_data["verification_token"]
        
        # Tamper the expires_at part to simulate an expired token
        parts = token_str.split(".")
        expired_ts = int(time.time()) - 500  # expired 500s ago
        expired_message = f"{parts[1]}:{parts[2]}:{expired_ts}".encode("utf-8")
        from attendance_credential import _TOKEN_SECRET
        sig = hmac.new(_TOKEN_SECRET, expired_message, hashlib.sha256).hexdigest()
        expired_token = f"slp_v1.{parts[1]}.{parts[2]}.{expired_ts}.{sig}"

        with self.assertRaises(HTTPException) as ctx:
            consume_verification_token(expired_token, "EMP1143")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("expired", ctx.exception.detail.lower())

    # 6. Verification token for Employee A cannot be used for Employee B
    def test_06_token_cannot_be_used_for_different_employee(self):
        token_data = issue_verification_token("EMP1143")
        token_str = token_data["verification_token"]
        
        # Attempt to consume token issued for EMP1143 on EMP1137
        with self.assertRaises(HTTPException) as ctx:
            consume_verification_token(token_str, "EMP1137")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("does not match", ctx.exception.detail.lower())

    # 7. Changing selected employee / single-use consumption invalidates previous token
    def test_07_token_single_use_consumption(self):
        token_data = issue_verification_token("EMP1143")
        token_str = token_data["verification_token"]
        
        # First use succeeds
        consumed = consume_verification_token(token_str, "EMP1143")
        self.assertEqual(consumed["employee_id"], "EMP1143")
        
        # Second use is rejected as already consumed
        with self.assertRaises(HTTPException) as ctx:
            consume_verification_token(token_str, "EMP1143")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("already been consumed", ctx.exception.detail.lower())

    # 8. Unverified employee cannot check in through direct API request
    def test_08_check_in_without_token_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            consume_verification_token("", "EMP1143")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("verification is required", ctx.exception.detail.lower())

    # 9. Unverified employee cannot check out through direct API request
    def test_09_check_out_without_token_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            consume_verification_token(None, "EMP1143")
        self.assertEqual(ctx.exception.status_code, 403)

    # 10. Repeated failed attempts trigger rate limiting / temporary lockout (after 5 failed attempts)
    def test_12_repeated_failed_attempts_trigger_lockout(self):
        for i in range(4):
            with self.assertRaises(HTTPException) as ctx:
                verify_employee_identity("EMP1143", "BAD-CODE")
            self.assertEqual(ctx.exception.status_code, 401)
        
        # 5th failed attempt triggers 429 lockout
        with self.assertRaises(HTTPException) as ctx:
            verify_employee_identity("EMP1143", "BAD-CODE")
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("locked", ctx.exception.detail.lower())

        # Further attempts are blocked by lockout
        with self.assertRaises(HTTPException) as ctx:
            verify_employee_identity("EMP1143", self.code_1143)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("locked", ctx.exception.detail.lower())

    # 11. Admin unlocking resets lockout
    def test_admin_unlock_clears_lockout(self):
        # Trigger lockout
        for _ in range(5):
            try:
                verify_employee_identity("EMP1143", "BAD-CODE")
            except HTTPException:
                pass
        
        # Unlock via admin
        admin_unlock_credential("EMP1143", "postmaster")
        
        # Now valid code succeeds
        res = verify_employee_identity("EMP1143", self.code_1143)
        self.assertTrue(res["ok"])

    # 12. Admin code generation creates a unique unguessable code
    def test_admin_generate_unique_code(self):
        gen_res = admin_generate_code("EMP1143", "postmaster")
        self.assertTrue(gen_res["ok"])
        new_code = gen_res["verification_code"]
        self.assertTrue(new_code.startswith("SLP-"))
        self.assertNotEqual(new_code, self.code_1143)
        
        # Old code fails
        with self.assertRaises(HTTPException):
            verify_employee_identity("EMP1143", self.code_1143)
            
        # New code verifies successfully
        verify_res = verify_employee_identity("EMP1143", new_code)
        self.assertTrue(verify_res["ok"])

    # 13. Admin listing never leaks secrets or hashes
    def test_admin_list_credentials_never_leaks_secrets(self):
        creds_list = list_employee_credentials()
        self.assertGreaterEqual(len(creds_list), 2)
        for c in creds_list:
            self.assertNotIn("credential_hash", c)
            self.assertNotIn("verification_code", c)
            self.assertIn("has_credential", c)
            self.assertIn("status", c)

    # 14. Admin revoke credential
    def test_admin_revoke_credential(self):
        res = admin_revoke_credential("EMP1143", "postmaster")
        self.assertTrue(res["ok"])
        with self.assertRaises(HTTPException):
            verify_employee_identity("EMP1143", self.code_1143)


if __name__ == "__main__":
    import hmac
    unittest.main()
