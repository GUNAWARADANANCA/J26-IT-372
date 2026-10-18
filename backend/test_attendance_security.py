"""Door scan checks. A selected employee id is not treated as identity."""

import os
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi import HTTPException

from attendance import issue_door_token, submit_scan
from routes import attendance_roster, list_docs, read_door_token


class _Update:
    def __init__(self, count):
        self.matched_count = count
        self.upserted_id = None


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.lock = threading.Lock()

    def find_one(self, query):
        wanted = query.get("_id")
        for doc in self.docs:
            if wanted is None or doc.get("_id") == wanted:
                return doc
        return None

    def find(self, _query=None):
        return list(self.docs)

    def insert_one(self, doc):
        with self.lock:
            if doc.get("_id") is not None and any(item.get("_id") == doc.get("_id") for item in self.docs):
                raise RuntimeError("duplicate")
            self.docs.append(doc)

    def delete_one(self, query):
        with self.lock:
            self.docs = [doc for doc in self.docs if doc.get("_id") != query.get("_id")]

    def update_one(self, query, update, upsert=False):
        with self.lock:
            wanted = query.get("_id")
            for doc in self.docs:
                if doc.get("_id") != wanted:
                    continue
                if "accepted_at" in query and doc.get("accepted_at") != query.get("accepted_at"):
                    return _Update(0)
                if "stamps" in query and doc.get("stamps") != query.get("stamps"):
                    return _Update(0)
                doc.update(update.get("$set", {}))
                return _Update(1)
            if upsert:
                stored = {"_id": wanted, **update.get("$set", {})}
                self.docs.append(stored)
                result = _Update(0)
                result.upserted_id = wanted
                return result
            return _Update(0)


class _Database(dict):
    def __getitem__(self, name):
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


class DoorScanTests(unittest.TestCase):
    def setUp(self):
        os.environ["ATTENDANCE_DOOR_SECRET"] = "test-door-secret-value"
        self.database = _Database(
            employee=_Collection(
                [
                    {
                        "_id": "EMP1",
                        "employee_id": "EMP1",
                        "employee_name": "Test Officer",
                        "post_office": "Kandy",
                        "basic_salary": 42000,
                    }
                ]
            ),
            attendance_audit=_Collection([]),
            attendance_log=_Collection([]),
            attendance_rate=_Collection([]),
            attendance_scan_guard=_Collection([]),
        )
        self.db_patch = patch("attendance.get_db", return_value=self.database)
        self.route_patch = patch("routes.get_db", return_value=self.database)
        self.db_patch.start()
        self.route_patch.start()

    def tearDown(self):
        self.db_patch.stop()
        self.route_patch.stop()
        os.environ.pop("ATTENDANCE_DOOR_SECRET", None)

    def test_forged_and_invalid_tokens_are_rejected(self):
        with self.assertRaises(HTTPException) as missing:
            submit_scan("EMP1", 6.9, 79.9, 10, None, "phone")
        self.assertEqual(missing.exception.status_code, 403)
        with self.assertRaises(HTTPException) as forged:
            submit_scan("EMP1", 6.9, 79.9, 10, "10.not-a-real-signature", "phone")
        self.assertEqual(forged.exception.status_code, 403)
        self.assertEqual({row["result"] for row in self.database["attendance_audit"].docs}, {"rejected"})
        self.assertNotIn("basic_salary", self.database["attendance_audit"].docs[0])

    def test_expired_token_unknown_employee_and_repeat_scan(self):
        issued = issue_door_token()
        expired = issued["token"].split(".")
        expired[1] = str(int(expired[0]) - 5)
        from attendance import _door_secret
        import hashlib
        import hmac

        payload = f"{expired[0]}.{expired[1]}"
        expired[2] = hmac.new(_door_secret(), payload.encode(), hashlib.sha256).hexdigest()
        with self.assertRaises(HTTPException) as old:
            submit_scan("EMP1", 6.9, 79.9, 10, ".".join(expired), "phone-2")
        self.assertEqual(old.exception.status_code, 403)
        self.assertIn("expired", old.exception.detail)
        token = issued["token"]
        with self.assertRaises(HTTPException) as unknown:
            submit_scan("MISSING", 6.9, 79.9, 10, token, "phone-2")
        self.assertEqual(unknown.exception.status_code, 404)
        with self.assertRaises(HTTPException) as blank:
            submit_scan(" ", 6.9, 79.9, 10, token, "phone-2")
        self.assertEqual(blank.exception.status_code, 400)
        with patch("attendance.record_scan", return_value={"action": "in", "status": "On time"}):
            saved = submit_scan("EMP1", 6.9, 79.9, 10, token, "phone-2")
        self.assertEqual(saved["identity"], "selected_on_phone")
        self.assertTrue(any(row["result"] == "accepted" for row in self.database["attendance_audit"].docs))
        self.assertNotIn(token, str(self.database["attendance_audit"].docs))
        with self.assertRaises(HTTPException) as repeat:
            submit_scan("EMP1", 6.9, 79.9, 10, token, "phone-4")
        self.assertEqual(repeat.exception.status_code, 409)
        self.database["attendance_scan_guard"].docs[0]["accepted_at"] = "2000-01-01T00:00:00"
        with patch("attendance.record_scan", return_value={"action": "in", "status": "On time"}):
            again = submit_scan("EMP1", 6.9, 79.9, 10, token, "phone-5")
        self.assertEqual(again["action"], "in")

    def test_rate_limit_and_restricted_roster(self):
        for _ in range(8):
            with self.assertRaises(HTTPException):
                submit_scan("EMP1", 6.9, 79.9, 10, "1.bad", "phone-3")
        with self.assertRaises(HTTPException) as limited:
            submit_scan("EMP1", 6.9, 79.9, 10, "1.bad", "phone-3")
        self.assertEqual(limited.exception.status_code, 429)
        self.database["attendance_rate"].docs[0]["stamps"] = [time.time() - 120] * 8
        with self.assertRaises(HTTPException) as after_window:
            submit_scan("EMP1", 6.9, 79.9, 10, "1.bad", "phone-3")
        self.assertEqual(after_window.exception.status_code, 403)
        self.assertTrue(all(stamp > time.time() - 60 for stamp in self.database["attendance_rate"].docs[0]["stamps"]))

    def test_concurrent_attempts_admit_at_most_eight(self):
        from attendance import _limit_scans

        admitted = []
        rejected = []
        barrier = threading.Barrier(16)

        def hit():
            barrier.wait()
            try:
                _limit_scans("shared-caller")
                admitted.append(1)
            except HTTPException as exc:
                rejected.append(exc.status_code)

        with ThreadPoolExecutor(max_workers=16) as pool:
            list(pool.map(lambda _: hit(), range(16)))
        self.assertEqual(len(admitted), 8)
        self.assertEqual(rejected.count(429), 8)
        _limit_scans("other-caller")
        self.assertEqual(len(self.database["attendance_rate"].docs), 2)
        roster = attendance_roster()
        self.assertEqual(set(roster[0]), {"name", "employee_id", "employee_name", "post_office"})
        with self.assertRaises(HTTPException) as admin:
            list_docs("attendance_log", _request())
        self.assertEqual(admin.exception.status_code, 401)
        with self.assertRaises(HTTPException) as door:
            read_door_token(_request())
        self.assertEqual(door.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
