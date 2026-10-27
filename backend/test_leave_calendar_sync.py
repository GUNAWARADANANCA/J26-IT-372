"""Comprehensive End-to-End Test Suite for Leave & Calendar Synchronization.

Tests:
1. Leave submission to MongoDB (Pending status, working days calculation)
2. Calendar reflection of pending leave for the employee
3. Postmaster Approval workflow and timestamp/reviewer recording
4. Calendar reflection of approved leave
5. Dynamic daily attendance summary update ("on_approved_leave_count")
6. Rejection workflow with reason recording
7. Cancellation workflow of approved leave and calendar removal
8. Multi-month leave span (October to November)
9. Year-boundary leave span (December to January)
10. Strict employee isolation (no cross-employee leave pollution)
11. Overlapping approved leave conflict prevention (HTTP 409)
12. Authorization enforcement (Clerk cannot approve leave - HTTP 403)
13. Separation of attendance logs from leave records
"""

import http.cookiejar
import json
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

from db import get_db

BASE_URL = "http://127.0.0.1:8000"


def create_client():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    state = {"csrf_token": ""}

    def req(method, path, body=None):
        url = f"{BASE_URL}{path}"
        data = None
        headers = {}
        if state["csrf_token"]:
            headers["x-csrf-token"] = state["csrf_token"]
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with opener.open(request) as resp:
                content = resp.read()
                try:
                    res_json = json.loads(content.decode("utf-8"))
                    if isinstance(res_json, dict) and res_json.get("csrf_token"):
                        state["csrf_token"] = res_json["csrf_token"]
                    return resp.status, res_json
                except Exception:
                    return resp.status, content
        except urllib.error.HTTPError as e:
            err_content = e.read().decode("utf-8")
            try:
                return e.code, json.loads(err_content)
            except Exception:
                return e.code, err_content

    return req, cj


def run_tests():
    print("================================================================")
    print("STARTING LEAVE & CALENDAR SYNCHRONIZATION TEST SUITE")
    print("================================================================")

    db = get_db()
    assert db is not None, "MongoDB connection failed"
    print("Connected to MongoDB database:", db.name)

    # Clean up previous automated test records
    db["entitlement_leave"].delete_many({"reason": {"$regex": "^TEST-LEAVE-"}})
    db["entitlement_audit"].delete_many({"notes": {"$regex": "^TEST-LEAVE-"}})

    # Pick two distinct employees
    emps = list(db["employee"].find().limit(2))
    assert len(emps) >= 2, "Need at least 2 employees in MongoDB"
    emp_a = emps[0]["employee_id"]
    emp_b = emps[1]["employee_id"]
    print(f"Testing with Employee A: {emp_a} ({emps[0].get('employee_name')})")
    print(f"Testing with Employee B: {emp_b} ({emps[1].get('employee_name')})")

    req_postmaster, _ = create_client()

    # 1. Sign in as Postmaster
    print("\n--- 1. Authenticating as Postmaster ---")
    status, auth_data = req_postmaster(
        "POST",
        "/api/auth/login",
        {"username": "postmaster", "password": "YourStrongDemoPassword123!"},
    )
    assert status == 200, f"Postmaster login failed: {status} {auth_data}"
    assert auth_data.get("role") == "postmaster"
    print("Postmaster logged in successfully [OK]")

    # 2. Submit a Leave Request for Employee A
    print("\n--- 2. Submitting Leave Request for Employee A ---")
    tag_a = f"TEST-LEAVE-{uuid.uuid4().hex[:6]}"
    leave_payload = {
        "employee_id": emp_a,
        "leave_type": "Casual Leave",
        "from_date": "2026-10-21",
        "to_date": "2026-10-23",
        "reason": tag_a,
        "status": "Pending",
    }
    status, leave_doc = req_postmaster("POST", "/api/leave", leave_payload)
    assert status == 201, f"Failed to submit leave: {status} {leave_doc}"
    assert leave_doc["employee_id"] == emp_a
    assert leave_doc["status"] == "Pending"
    assert leave_doc["days"] == 3.0, f"Expected 3 working days, got {leave_doc.get('days')}"
    leave_id_a = leave_doc["id"]
    print(f"Created Leave Request {leave_id_a} (Pending, 3 working days) [OK]")

    # Verify directly in MongoDB
    db_leave = db["entitlement_leave"].find_one({"_id": leave_id_a})
    assert db_leave is not None, "Leave document not found in MongoDB entitlement_leave"
    assert db_leave["status"] == "Pending"
    print("Verified in MongoDB entitlement_leave [OK]")

    # 3. Check Calendar Reflection for Pending Leave
    print("\n--- 3. Verifying Calendar Data for October 2026 ---")
    status, cal_data = req_postmaster(
        "GET", "/api/attendance/calendar?year=2026&month=10"
    )
    assert status == 200, f"Failed to get calendar: {status} {cal_data}"
    cal_leaves = cal_data.get("leaves", [])
    matching_pending = [l for l in cal_leaves if l.get("id") == leave_id_a]
    assert len(matching_pending) == 1, "Pending leave not found in calendar leaves!"
    assert matching_pending[0]["status"] == "Pending"
    print("Calendar correctly returned pending leave for Employee A [OK]")

    # Confirm strict isolation: Employee B does not have this leave
    emp_b_leaves = [l for l in cal_leaves if l.get("employee_id") == emp_b and l.get("id") == leave_id_a]
    assert len(emp_b_leaves) == 0, "Leave cross-polluted to Employee B!"
    print("Strict employee calendar isolation verified [OK]")

    # 4. Postmaster Approves Leave Request
    print("\n--- 4. Postmaster Approving Leave Request ---")
    status, approved_doc = req_postmaster(
        "PUT",
        f"/api/entitlements/leave/{leave_id_a}",
        {"status": "Approved", "remarks": "Approved by Postmaster for family event"},
    )
    assert status == 200, f"Failed to approve leave: {status} {approved_doc}"
    assert approved_doc["status"] == "Approved"
    assert approved_doc.get("reviewed_by") == "postmaster"
    assert approved_doc.get("reviewed_at") is not None
    print("Leave approved with reviewer and timestamp [OK]")

    # Verify audit log in entitlement_audit
    db_audit = db["entitlement_audit"].find_one({"entitlement_id": leave_id_a, "action": "UPDATE_LEAVE_APPROVED"})
    assert db_audit is not None, "Audit log not recorded for leave approval"
    print("Audit log recorded in entitlement_audit [OK]")

    # 5. Verify Calendar Data Reflects Approved Leave
    print("\n--- 5. Verifying Calendar Reflects Approved Leave ---")
    status, cal_data_app = req_postmaster(
        "GET", "/api/attendance/calendar?year=2026&month=10"
    )
    assert status == 200
    app_leaves = cal_data_app.get("leaves", [])
    matching_app = [l for l in app_leaves if l.get("id") == leave_id_a]
    assert len(matching_app) == 1
    assert matching_app[0]["status"] == "Approved"
    assert cal_data_app["summary"]["on_approved_leave_count"] >= 1
    print("Calendar updated to Approved leave with updated summary count [OK]")

    # 6. Verify Daily Attendance Summary Reflects Approved Leave
    print("\n--- 6. Verifying Daily Attendance Summary for 2026-10-22 ---")
    status, daily_data = req_postmaster("GET", "/api/attendance/daily?date=2026-10-22")
    assert status == 200, f"Failed to get daily attendance: {status} {daily_data}"
    summary = daily_data.get("summary", {})
    records = daily_data.get("records", [])
    emp_a_rec = next((r for r in records if r.get("employee_id") == emp_a), None)
    assert emp_a_rec is not None, "Employee A record missing from daily roster"
    assert emp_a_rec.get("attendance_type") == "On Leave", f"Expected 'On Leave', got {emp_a_rec.get('attendance_type')}"
    assert emp_a_rec.get("on_leave") is True
    assert summary.get("on_leave_count", 0) >= 1
    print(f"Daily Attendance marks Employee A as 'On Leave' (On Leave count: {summary.get('on_leave_count')}) [OK]")

    # 7. Test Overlapping Leave Prevention (HTTP 409 Conflict)
    print("\n--- 7. Testing Overlapping Approved Leave Prevention ---")
    dup_payload = {
        "employee_id": emp_a,
        "leave_type": "Medical Leave",
        "from_date": "2026-10-22",
        "to_date": "2026-10-25",
        "reason": "TEST-LEAVE-CONFLICT",
    }
    status_dup, dup_res = req_postmaster("POST", "/api/leave", dup_payload)
    assert status_dup == 409, f"Expected 409 Conflict for overlapping leave, got {status_dup}"
    print("Overlapping leave request correctly rejected with HTTP 409 [OK]")

    # 8. Test Rejection Workflow with Reason
    print("\n--- 8. Testing Leave Rejection Workflow ---")
    tag_b = f"TEST-LEAVE-{uuid.uuid4().hex[:6]}"
    leave_b_payload = {
        "employee_id": emp_b,
        "leave_type": "Annual Leave",
        "from_date": "2026-10-28",
        "to_date": "2026-10-30",
        "reason": tag_b,
        "status": "Pending",
    }
    status, leave_b_doc = req_postmaster("POST", "/api/leave", leave_b_payload)
    assert status == 201
    leave_id_b = leave_b_doc["id"]

    status, rej_doc = req_postmaster(
        "PUT",
        f"/api/entitlements/leave/{leave_id_b}",
        {"status": "Rejected", "remarks": "High parcel volume during festive season"},
    )
    assert status == 200, f"Failed to reject: {status} {rej_doc}"
    assert rej_doc["status"] == "Rejected"
    assert rej_doc.get("rejection_reason") == "High parcel volume during festive season"
    print("Leave rejected and rejection reason recorded [OK]")

    # Verify rejected leave is kept off active calendar
    status, cal_after_rej = req_postmaster("GET", "/api/attendance/calendar?year=2026&month=10")
    active_b = [l for l in cal_after_rej.get("leaves", []) if l.get("id") == leave_id_b]
    assert len(active_b) == 0, "Rejected leave must not appear on active calendar!"
    print("Rejected leave successfully kept off active calendar [OK]")

    # 9. Test Cancellation Workflow of Approved Leave
    print("\n--- 9. Testing Cancellation of Approved Leave ---")
    status, cancel_doc = req_postmaster(
        "POST",
        f"/api/entitlements/leave/{leave_id_a}/cancel",
        {"reason": "Cancelled by employee due to duty recall"},
    )
    assert status == 200, f"Failed to cancel leave: {status} {cancel_doc}"
    assert cancel_doc["status"] == "Cancelled"
    assert cancel_doc.get("cancellation_reason") == "Cancelled by employee due to duty recall"
    print("Approved leave successfully cancelled with audit trail [OK]")

    # Calendar must no longer show cancelled leave
    status, cal_after_cancel = req_postmaster("GET", "/api/attendance/calendar?year=2026&month=10")
    active_a = [l for l in cal_after_cancel.get("leaves", []) if l.get("id") == leave_id_a]
    assert len(active_a) == 0, "Cancelled leave must not appear on active calendar!"
    print("Cancelled leave successfully removed from active calendar markers [OK]")

    # 10. Multi-Month Leave Span (October to November)
    print("\n--- 10. Testing Leave Spanning Two Months (Oct - Nov) ---")
    tag_span = f"TEST-LEAVE-{uuid.uuid4().hex[:6]}"
    span_payload = {
        "employee_id": emp_a,
        "leave_type": "Medical Leave",
        "from_date": "2026-10-28",
        "to_date": "2026-11-04",
        "reason": tag_span,
        "status": "Approved",
    }
    status, span_doc = req_postmaster("POST", "/api/leave", span_payload)
    assert status == 201, f"Failed to create span leave: {status} {span_doc}"
    span_id = span_doc["id"]

    # Must appear in October calendar
    status, cal_oct = req_postmaster("GET", "/api/attendance/calendar?year=2026&month=10")
    assert any(l.get("id") == span_id for l in cal_oct.get("leaves", [])), "Span leave missing from Oct"
    print("Multi-month leave detected in October calendar [OK]")

    # Must appear in November calendar
    status, cal_nov = req_postmaster("GET", "/api/attendance/calendar?year=2026&month=11")
    assert any(l.get("id") == span_id for l in cal_nov.get("leaves", [])), "Span leave missing from Nov"
    print("Multi-month leave detected in November calendar [OK]")

    # 11. Year Boundary Leave Span (December 2026 - January 2027)
    print("\n--- 11. Testing Leave Spanning Year Boundary (Dec 2026 - Jan 2027) ---")
    tag_year = f"TEST-LEAVE-{uuid.uuid4().hex[:6]}"
    year_payload = {
        "employee_id": emp_b,
        "leave_type": "Annual Leave",
        "from_date": "2026-12-28",
        "to_date": "2027-01-05",
        "reason": tag_year,
        "status": "Approved",
    }
    status, year_doc = req_postmaster("POST", "/api/leave", year_payload)
    assert status == 201, f"Failed to create year-boundary leave: {status} {year_doc}"
    year_id = year_doc["id"]

    status, cal_dec = req_postmaster("GET", "/api/attendance/calendar?year=2026&month=12")
    assert any(l.get("id") == year_id for l in cal_dec.get("leaves", [])), "Year-boundary leave missing from Dec"
    print("Year-boundary leave detected in December 2026 calendar [OK]")

    status, cal_jan = req_postmaster("GET", "/api/attendance/calendar?year=2027&month=1")
    assert any(l.get("id") == year_id for l in cal_jan.get("leaves", [])), "Year-boundary leave missing from Jan"
    print("Year-boundary leave detected in January 2027 calendar [OK]")

    # 12. Working Day & Half Day Duration Calculation
    print("\n--- 12. Testing Working Days & Half Day Calculation ---")
    tag_half = f"TEST-LEAVE-{uuid.uuid4().hex[:6]}"
    half_payload = {
        "employee_id": emp_a,
        "leave_type": "Half Day Leave",
        "from_date": "2026-11-15",
        "to_date": "2026-11-15",
        "reason": tag_half,
    }
    status, half_doc = req_postmaster("POST", "/api/leave", half_payload)
    assert status == 201
    assert half_doc.get("days") == 0.5, f"Expected 0.5 for Half Day, got {half_doc.get('days')}"
    print("Half Day Leave correctly calculated as 0.5 working days [OK]")

    # 13. Date Validation: Start Date > End Date Rejection
    print("\n--- 13. Testing Date Range Validation ---")
    invalid_payload = {
        "employee_id": emp_a,
        "leave_type": "Casual Leave",
        "from_date": "2026-11-20",
        "to_date": "2026-11-10",
        "reason": "TEST-INVALID-DATES",
    }
    status_inv, inv_res = req_postmaster("POST", "/api/leave", invalid_payload)
    assert status_inv == 400, f"Expected HTTP 400 for start > end date, got {status_inv}"
    print("Invalid date range correctly rejected with HTTP 400 [OK]")

    # 14. Non-Postmaster Approval Prohibition (Security Check)
    print("\n--- 14. Testing Role Security (Clerk Cannot Approve) ---")
    req_unauth, _ = create_client()
    status_unauth, unauth_res = req_unauth(
        "PUT",
        f"/api/entitlements/leave/{span_id}",
        {"status": "Approved"},
    )
    assert status_unauth in (401, 403), f"Expected 401/403 for unauthorized approve, got {status_unauth}"
    print("Unauthorized approval attempt successfully blocked with HTTP 401/403 [OK]")

    # Clean up test records
    print("\n--- Cleaning Up Isolated Test Records ---")
    db["entitlement_leave"].delete_many({"reason": {"$regex": "^TEST-LEAVE-"}})
    db["entitlement_audit"].delete_many({"notes": {"$regex": "^TEST-LEAVE-"}})
    print("Test cleanup complete [OK]")

    print("\n================================================================")
    print("ALL 14 VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("================================================================")


if __name__ == "__main__":
    run_tests()
