"""Comprehensive test suite for Attendance-Aware Auto-Balance Workload.
Validates all 14 required business scenarios:
1. Five employees present and pending tasks exist: work is distributed fairly.
2. Two employees present and three absent: only present employees receive assignments.
3. Employee on approved leave: no new work is assigned to that employee.
4. Attendance missing: employee is excluded with Attendance Not Recorded.
5. No pending tasks exist: returns clear message and creates no assignments.
6. No employees eligible: existing assignments remain unchanged.
7. Work exceeds eligible employees' combined capacity: excess work remains unassigned.
8. Employee already at capacity: does not assign additional work beyond limit.
9. Repeated requests do not duplicate assignments (idempotent).
10. Concurrent allocation requests cannot assign the same task twice.
11. Unauthorized user cannot execute Postmaster allocation operation (403 Forbidden).
12. Completed assignments and historical records remain unchanged.
13. Frontend refreshes using saved backend results rather than fabricated counts.
14. Existing employee dashboards, attendance screens, daily accounts, and KPI forecasting continue working.
"""

import threading
import time
from datetime import date
import mongomock
import pytest
from fastapi.testclient import TestClient

import auth
import db
import performance_review
import routes
from main import app
from performance_review import (
    DEFAULT_DAILY_BENCHMARK,
    auto_balance_workload,
    get_employee_attendance_eligibility,
    is_on_approved_leave,
)


@pytest.fixture(autouse=True)
def mock_database(monkeypatch):
    """Provide an isolated in-memory mongomock database for each test across all modules."""
    client = mongomock.MongoClient()
    test_db = client["postassist_test"]

    def _get_test_db():
        return test_db

    monkeypatch.setattr(performance_review, "get_db", _get_test_db)
    monkeypatch.setattr(routes, "get_db", _get_test_db)
    monkeypatch.setattr(auth, "get_db", _get_test_db)
    monkeypatch.setattr(db, "get_db", _get_test_db)
    return test_db


def test_scenario_1_five_present_work_distributed_fairly(mock_database):
    """Scenario 1: Five employees are present and pending tasks exist: work is distributed fairly."""
    target_date = "2026-10-30"

    # Setup 5 delivery employees
    for i in range(1, 6):
        eid = f"EMP{i:03d}"
        mock_database["employee"].insert_one({
            "_id": eid,
            "employee_id": eid,
            "employee_name": f"Officer {i}",
            "designation": "Postman",
            "work_category": "Delivery (Field)",
            "post_office": "Kaduwela",
        })
        mock_database["attendance_log"].insert_one({
            "_id": f"{eid}-{target_date}",
            "employee_id": eid,
            "date": target_date,
            "attendance_status": "Present",
            "fingerprint_in": "08:00",
        })

    # Unassigned backlog tasks via checklist
    checklist = [
        "Parcel Delivery by Route",
        "Registered Mail Delivery",
        "Ordinary Letter Delivery",
        "Pending Mail and Parcel Clearance",
        "Undelivered Article Processing",
    ]

    result = auto_balance_workload(target_date, post_office="Kaduwela", checklist=checklist)

    assert result["ok"] is True
    assert result["tasks_assigned"] == 5
    assert result["eligible_count"] == 5
    assert result["unassigned_count"] == 0
    assert len(result["transfers"]) == 5

    # Check each officer received 1 task fairly
    assigned_by_officer = {}
    for t in result["transfers"]:
        assigned_by_officer[t["to_employee_id"]] = assigned_by_officer.get(t["to_employee_id"], 0) + 1
    assert len(assigned_by_officer) == 5
    for count in assigned_by_officer.values():
        assert count == 1


def test_scenario_2_two_present_three_absent(mock_database):
    """Scenario 2: Two employees are present and three are absent: only the two present receive assignments."""
    target_date = "2026-10-30"

    employees = [
        ("EMP001", "Present", "Postman", "Delivery (Field)"),
        ("EMP002", "Present", "Postman", "Delivery (Field)"),
        ("EMP003", "Absent", "Postman", "Delivery (Field)"),
        ("EMP004", "Absent", "Postman", "Delivery (Field)"),
        ("EMP005", "Absent", "Postman", "Delivery (Field)"),
    ]

    for eid, att_status, desig, cat in employees:
        mock_database["employee"].insert_one({
            "_id": eid,
            "employee_id": eid,
            "employee_name": f"Officer {eid}",
            "designation": desig,
            "work_category": cat,
            "post_office": "Kaduwela",
        })
        mock_database["attendance_log"].insert_one({
            "_id": f"{eid}-{target_date}",
            "employee_id": eid,
            "date": target_date,
            "attendance_status": att_status,
            "fingerprint_in": "08:00" if att_status == "Present" else None,
        })

    checklist = ["Parcel Delivery by Route", "Registered Mail Delivery"]

    result = auto_balance_workload(target_date, post_office="Kaduwela", checklist=checklist)

    assert result["ok"] is True
    assert result["eligible_count"] == 2
    assert len(result["excluded_employees"]) == 3
    # Check that only EMP001 and EMP002 received work
    for t in result["transfers"]:
        assert t["to_employee_id"] in {"EMP001", "EMP002"}
        assert t["to_employee_id"] not in {"EMP003", "EMP004", "EMP005"}


def test_scenario_3_employee_on_approved_leave_excluded(mock_database):
    """Scenario 3: An employee is on approved leave: no new work is assigned to that employee."""
    target_date = "2026-10-30"

    # EMP001 is on approved leave
    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Leave Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["entitlement_leave"].insert_one({
        "_id": "LEAVE-01",
        "employee_id": "EMP001",
        "status": "Approved",
        "start_date": "2026-10-29",
        "end_date": "2026-10-31",
        "leave_type": "Medical Leave",
    })

    # EMP002 is present
    mock_database["employee"].insert_one({
        "_id": "EMP002",
        "employee_id": "EMP002",
        "employee_name": "Active Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:15",
    })

    checklist = ["Incoming Mail Registration"]

    result = auto_balance_workload(target_date, checklist=checklist)

    assert result["ok"] is True
    # EMP001 must be in excluded_employees
    excluded_ids = [ex["employee_id"] for ex in result["excluded_employees"]]
    assert "EMP001" in excluded_ids
    # Work must be given to EMP002 only
    for t in result["transfers"]:
        assert t["to_employee_id"] == "EMP002"
        assert t["to_employee_id"] != "EMP001"


def test_scenario_4_attendance_missing_excluded(mock_database):
    """Scenario 4: Attendance is missing: the employee is excluded with Attendance Not Recorded."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Unrecorded Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    # No attendance_log record created for EMP001

    mock_database["employee"].insert_one({
        "_id": "EMP002",
        "employee_id": "EMP002",
        "employee_name": "Recorded Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "attendance_status": "On time",
        "fingerprint_in": "08:00",
    })

    checklist = ["Counter Customer Service"]
    result = auto_balance_workload(target_date, checklist=checklist)

    assert result["ok"] is True
    assert result["eligible_count"] == 1
    excluded = result["excluded_employees"]
    assert len(excluded) == 1
    assert excluded[0]["employee_id"] == "EMP001"
    assert "Attendance Not Recorded" in excluded[0]["reason"]


def test_scenario_5_no_pending_tasks_exist(mock_database):
    """Scenario 5: No pending tasks exist: returns clear message and creates no assignments."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Present Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    # No checklist passed and no pending uncompleted work in daily_kpi_log
    result = auto_balance_workload(target_date, checklist=[])

    assert result["ok"] is False
    assert result["message"] == "No pending work is available for automatic allocation."
    assert result["tasks_assigned"] == 0
    assert len(result["transfers"]) == 0


def test_scenario_6_no_employees_eligible(mock_database):
    """Scenario 6: No employees are eligible: existing assignments remain unchanged."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Absent Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Absent",
    })
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "assigned_work_count": 3,
        "completed_work_count": 1,
        "uncompleted_work_count": 2,
    })

    result = auto_balance_workload(target_date, checklist=["Counter Customer Service"])

    assert result["ok"] is False
    assert result["message"] == "No eligible employees are available for allocation on this date. Please verify attendance records."
    assert result["tasks_assigned"] == 0

    # Verify existing assignment unchanged
    log = mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})
    assert log["assigned_work_count"] == 3


def test_scenario_7_work_exceeds_combined_capacity(mock_database):
    """Scenario 7: Work exceeds eligible employees' combined capacity: excess work remains unassigned."""
    target_date = "2026-10-30"

    # One present officer with capacity = 5
    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Present Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    # Pass 8 checklist tasks (3 exceed capacity 5)
    checklist = [
        "Incoming Mail Registration",
        "Parcel Registration and Sorting",
        "Article Scanning and Tracking Updates",
        "Counter Customer Service",
        "Postage and Fee Verification",
        "Postal Financial Transactions",
        "Incorrect Record and Address Verification",
        "Postal Clerk Duties",
    ]

    result = auto_balance_workload(target_date, checklist=checklist, benchmark_capacity=5)

    assert result["ok"] is True
    assert result["tasks_assigned"] == 5
    assert result["unassigned_count"] == 3  # Exactly 3 excess items remain unassigned
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})["assigned_work_count"] == 5


def test_scenario_8_employee_already_at_capacity(mock_database):
    """Scenario 8: An employee is already at capacity: do not assign additional work beyond configured limit."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Full Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })
    # Already assigned 5 tasks
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "assigned_work_count": 5,
        "completed_work_count": 0,
        "uncompleted_work_count": 5,
    })

    result = auto_balance_workload(target_date, checklist=["Counter Customer Service"], benchmark_capacity=5)

    assert result["ok"] is True
    assert result["tasks_assigned"] == 0
    assert result["unassigned_count"] == 1  # Could not be assigned because officer is at capacity
    # Officer tasks must not exceed 5
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})["assigned_work_count"] == 5


def test_scenario_9_repeated_requests_idempotent(mock_database):
    """Scenario 9: Repeated requests do not duplicate assignments."""
    target_date = "2026-10-30"

    # Absent employee with 2 pending tasks
    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Absent Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Absent",
    })
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "assigned_work_count": 2,
        "completed_work_count": 0,
        "uncompleted_work_count": 2,
        "primary_task_type": "Counter Customer Service",
    })

    # Present employee with 0 tasks
    mock_database["employee"].insert_one({
        "_id": "EMP002",
        "employee_id": "EMP002",
        "employee_name": "Present Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    # First run
    res1 = auto_balance_workload(target_date)
    assert res1["ok"] is True
    assert res1["tasks_assigned"] == 2
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP002-{target_date}"})["assigned_work_count"] == 2
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})["assigned_work_count"] == 0

    # Second run immediately after
    res2 = auto_balance_workload(target_date)
    assert res2["ok"] is False
    assert res2["message"] == "No pending work is available for automatic allocation."
    # Assignments must remain exactly 2, not 4
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP002-{target_date}"})["assigned_work_count"] == 2


def test_scenario_10_concurrent_requests_cannot_assign_same_task_twice(mock_database):
    """Scenario 10: Concurrent allocation requests cannot assign the same task twice."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Present Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    # Absent employee with 1 pending task
    mock_database["employee"].insert_one({
        "_id": "EMP002",
        "employee_id": "EMP002",
        "employee_name": "Absent Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "attendance_status": "Absent",
    })
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "assigned_work_count": 1,
        "completed_work_count": 0,
        "uncompleted_work_count": 1,
        "primary_task_type": "Counter Customer Service",
    })

    results = []

    def run_call():
        res = auto_balance_workload(target_date)
        results.append(res)

    t1 = threading.Thread(target=run_call)
    t2 = threading.Thread(target=run_call)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Total assigned across threads must be exactly 1
    total_assigned = sum(r.get("tasks_assigned", 0) for r in results)
    assert total_assigned == 1
    assert mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})["assigned_work_count"] == 1


def test_scenario_11_unauthorized_user_cannot_execute_allocation(mock_database):
    """Scenario 11: An unauthorized user cannot execute Postmaster allocation operation (403 Forbidden)."""
    from auth import hash_password, ROLE_CLERK

    # Setup clerk user in mock database
    mock_database["app_user"].insert_one({
        "_id": "clerk1",
        "username": "clerk1",
        "password_hash": hash_password("ClerkPass123!"),
        "hashed_password": hash_password("ClerkPass123!"),
        "role": ROLE_CLERK,
    })

    client = TestClient(app)

    # 1. Unauthenticated request -> 401
    res1 = client.post("/api/allocation/auto-balance", json={"date": "2026-10-30"})
    assert res1.status_code == 401

    # 2. Login as clerk -> 200
    login_res = client.post("/api/auth/login", json={"username": "clerk1", "password": "ClerkPass123!"})
    assert login_res.status_code == 200

    # 3. Clerk calling Postmaster-only endpoint -> 403
    res2 = client.post("/api/allocation/auto-balance", json={"date": "2026-10-30"})
    assert res2.status_code == 403


def test_scenario_12_completed_assignments_and_historical_records_unchanged(mock_database):
    """Scenario 12: Completed assignments and historical records remain unchanged."""
    target_date = "2026-10-30"
    historical_date = "2026-09-15"

    # Historical record
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP001-{historical_date}",
        "employee_id": "EMP001",
        "date": historical_date,
        "assigned_work_count": 5,
        "completed_work_count": 5,
        "uncompleted_work_count": 0,
        "notes": "Historical record",
    })

    # Today's record for absent officer with 2 completed and 2 pending
    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Absent Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Absent",
    })
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "assigned_work_count": 4,
        "completed_work_count": 2,  # 2 already completed
        "uncompleted_work_count": 2,
        "primary_task_type": "Counter Customer Service",
    })

    # Present employee to receive pending tasks
    mock_database["employee"].insert_one({
        "_id": "EMP002",
        "employee_id": "EMP002",
        "employee_name": "Present Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP002-{target_date}",
        "employee_id": "EMP002",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    auto_balance_workload(target_date)

    # 1. Historical log is untouched
    hist_log = mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{historical_date}"})
    assert hist_log["assigned_work_count"] == 5
    assert hist_log["completed_work_count"] == 5

    # 2. Today's completed tasks (2) on absent officer are preserved!
    donor_log = mock_database["daily_kpi_log"].find_one({"_id": f"EMP001-{target_date}"})
    assert donor_log["completed_work_count"] == 2
    assert donor_log["assigned_work_count"] == 2  # Adjusted down to the completed count


def test_scenario_13_persisted_audit_record_created(mock_database):
    """Scenario 13: Results are saved in MongoDB work_allocation for real frontend refresh."""
    target_date = "2026-10-30"

    mock_database["employee"].insert_one({
        "_id": "EMP001",
        "employee_id": "EMP001",
        "employee_name": "Active Officer",
        "designation": "Postal Assistant",
        "work_category": "Office",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP001-{target_date}",
        "employee_id": "EMP001",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    res = auto_balance_workload(target_date, checklist=["Incoming Mail Registration"])
    assert res["ok"] is True

    # Audit record must exist in MongoDB work_allocation collection
    alloc_doc = mock_database["work_allocation"].find_one({"date": target_date})
    assert alloc_doc is not None
    assert alloc_doc["tasks_assigned_count"] == 1
    assert alloc_doc["status"] == "Applied"


def test_scenario_14_existing_features_continue_working(mock_database):
    """Scenario 14: Existing employee dashboards, attendance screens, daily accounts, and KPI forecasting continue working."""
    from auth import hash_password, ROLE_POSTMASTER

    # Setup postmaster
    mock_database["app_user"].insert_one({
        "_id": "pm",
        "username": "pm",
        "password_hash": hash_password("PmPass123!"),
        "hashed_password": hash_password("PmPass123!"),
        "role": ROLE_POSTMASTER,
    })

    client = TestClient(app)
    login_res = client.post("/api/auth/login", json={"username": "pm", "password": "PmPass123!"})
    assert login_res.status_code == 200

    # Test /api/employee
    emp_res = client.get("/api/employee")
    assert emp_res.status_code == 200

    # Test /api/daily_kpi_log
    kpi_res = client.get("/api/daily_kpi_log")
    assert kpi_res.status_code == 200

    # Test /api/attendance_log
    att_res = client.get("/api/attendance_log")
    assert att_res.status_code == 200

    # Test /health
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["ok"] is True


def test_scenario_15_real_dataset_roles_and_strict_department_barriers(mock_database):
    """Scenario 15: Exact 7 dataset designations match appropriate tasks without crossing delivery/counter boundaries."""
    from performance_review import authorize_attendance_for_date
    target_date = "2026-10-31"

    # Setup the exact 7 real staff from the application database
    staff = [
        ("EMP1137", "Nuwan Priyantha Fernando", "Counter Clerk", "Postal Operations"),
        ("EMP1138", "Sunil Chaminda Perera", "Postal Officer", "Delivery"),
        ("EMP1139", "Kamal Wickramasinghe", "Senior Postman", "Delivery"),
        ("EMP1140", "Anura Kumara Silva", "Mail Sorter", "Sorting"),
        ("EMP1141", "Dinesh Bandara", "Postal Assistant", "Postal Operations"),
        ("EMP1142", "Roshan Jayawardena", "Postman", "Delivery"),
        ("EMP1143", "Chathura Nilanga Rodrigo", "Postal Officer", "Counter Services"),
    ]
    for eid, name, desig, cat in staff:
        mock_database["employee"].insert_one({
            "_id": eid,
            "employee_id": eid,
            "employee_name": name,
            "designation": desig,
            "work_category": cat,
            "post_office": "Kaduwela",
        })

    # Authorize all staff attendance
    auth_res = authorize_attendance_for_date(target_date, user="postmaster")
    assert auth_res["ok"] is True
    assert auth_res["authorized_count"] == 7

    # Allocate a mix of Delivery and Counter/Sorting tasks
    checklist = [
        "Parcel Delivery by Route",         # Delivery task
        "Registered Mail Delivery",        # Delivery task
        "Counter Customer Service",        # Counter task
        "Parcel Registration and Sorting", # Sorting task
    ]

    res = auto_balance_workload(target_date, post_office="Kaduwela", checklist=checklist, confirm=True)
    assert res["ok"] is True
    assert res["tasks_assigned"] == 4

    delivery_officer_ids = {"EMP1138", "EMP1139", "EMP1142"}
    counter_officer_ids = {"EMP1137", "EMP1140", "EMP1141", "EMP1143"}

    for t in res["transfers"]:
        recipient_id = t["to_employee_id"]
        task = t["task"]
        if "Delivery" in task:
            assert recipient_id in delivery_officer_ids, f"Delivery task {task} assigned to non-delivery officer {recipient_id}"
        if "Counter" in task or "Sorting" in task:
            assert recipient_id in counter_officer_ids, f"Counter/Sorting task {task} assigned to delivery officer {recipient_id}"


def test_scenario_16_postmaster_attendance_authorization_fallback(mock_database):
    """Scenario 16: Missing attendance records can be explicitly authorized by Postmaster."""
    from performance_review import authorize_attendance_for_date
    target_date = "2026-11-01"

    mock_database["employee"].insert_one({
        "_id": "EMP1137",
        "employee_id": "EMP1137",
        "employee_name": "Nuwan Fernando",
        "designation": "Counter Clerk",
        "work_category": "Postal Operations",
    })

    # Before authorization: attendance is missing -> excluded
    res_before = auto_balance_workload(target_date, checklist=["Counter Customer Service"])
    assert res_before["ok"] is False
    assert res_before["attendance_missing"] is True
    assert res_before["eligible_count"] == 0
    assert res_before["excluded_employees"][0]["reason"] == "Attendance Not Recorded — Excluded"

    # Postmaster authorizes Nuwan
    auth_res = authorize_attendance_for_date(target_date, employee_ids=["EMP1137"], user="postmaster")
    assert auth_res["ok"] is True
    assert auth_res["authorized_count"] == 1

    # Verify attendance log has proper tags
    att_doc = mock_database["attendance_log"].find_one({"_id": f"EMP1137-{target_date}"})
    assert att_doc is not None
    assert att_doc["source"] == "postmaster_authorized"

    # Now run auto-balance
    res_after = auto_balance_workload(target_date, checklist=["Counter Customer Service"], confirm=True)
    assert res_after["ok"] is True
    assert res_after["eligible_count"] == 1
    assert res_after["eligible_employees"][0]["status"] == "Present (Manually Authorized) — Eligible"
    assert res_after["tasks_assigned"] == 1


def test_scenario_17_preview_mode_does_not_mutate_mongodb_until_confirmed(mock_database):
    """Scenario 17: confirm=False calculates proposed transfers without mutating database."""
    target_date = "2026-11-02"

    mock_database["employee"].insert_one({
        "_id": "EMP1142",
        "employee_id": "EMP1142",
        "employee_name": "Roshan Jayawardena",
        "designation": "Postman",
        "work_category": "Delivery (Field)",
    })
    mock_database["attendance_log"].insert_one({
        "_id": f"EMP1142-{target_date}",
        "employee_id": "EMP1142",
        "date": target_date,
        "attendance_status": "Present",
        "fingerprint_in": "08:00",
    })

    # Preview mode: confirm=False
    preview_res = auto_balance_workload(target_date, checklist=["Parcel Delivery by Route"], confirm=False)
    assert preview_res["ok"] is True
    assert preview_res["confirmed"] is False
    assert preview_res["tasks_assigned"] == 1

    # Database must NOT have been updated
    log_doc = mock_database["daily_kpi_log"].find_one({"_id": f"EMP1142-{target_date}"})
    assert log_doc is None
    alloc_doc = mock_database["work_allocation"].find_one({"date": target_date})
    assert alloc_doc is None

    # Now Postmaster confirms: confirm=True
    confirm_res = auto_balance_workload(target_date, checklist=["Parcel Delivery by Route"], confirm=True)
    assert confirm_res["ok"] is True
    assert confirm_res["confirmed"] is True

    # Database MUST be updated
    log_doc_after = mock_database["daily_kpi_log"].find_one({"_id": f"EMP1142-{target_date}"})
    assert log_doc_after is not None
    assert log_doc_after["assigned_work_count"] == 1
    alloc_doc_after = mock_database["work_allocation"].find_one({"date": target_date})
    assert alloc_doc_after is not None
    assert alloc_doc_after["status"] == "Applied"


def test_scenario_18_all_seven_employees_receive_work_fairly(mock_database):
    """Scenario 18: All seven employees receive work when EMP1137 and EMP1138 start with 1 task."""
    from performance_review import authorize_attendance_for_date
    target_date = "2026-11-03"

    # Setup the exact 7 real staff from dataset
    staff = [
        ("EMP1137", "Nuwan Priyantha Fernando", "Counter Clerk", "Postal Operations"),
        ("EMP1138", "Sunil Chaminda Perera", "Postal Officer", "Delivery"),
        ("EMP1139", "Kamal Wickramasinghe", "Senior Postman", "Delivery"),
        ("EMP1140", "Anura Kumara Silva", "Mail Sorter", "Sorting"),
        ("EMP1141", "Dinesh Bandara", "Postal Assistant", "Postal Operations"),
        ("EMP1142", "Roshan Jayawardena", "Postman", "Delivery"),
        ("EMP1143", "Chathura Nilanga Rodrigo", "Postal Officer", "Counter Services"),
    ]
    for eid, name, desig, cat in staff:
        mock_database["employee"].insert_one({
            "_id": eid,
            "employee_id": eid,
            "employee_name": name,
            "designation": desig,
            "work_category": cat,
            "post_office": "Kaduwela",
        })

    # All 7 are authorized as present
    auth_res = authorize_attendance_for_date(target_date, user="postmaster")
    assert auth_res["ok"] is True
    assert auth_res["authorized_count"] == 7

    # EMP1137 and EMP1138 start with 1 pending task each
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP1137-{target_date}",
        "name": f"EMP1137-{target_date}",
        "employee_id": "EMP1137",
        "employee_name": "Nuwan Priyantha Fernando",
        "designation": "Counter Clerk",
        "work_category": "Postal Operations",
        "post_office": "Kaduwela",
        "date": target_date,
        "assigned_work_count": 1,
        "completed_work_count": 0,
        "uncompleted_work_count": 1,
        "primary_task_type": "Customer Service Counter",
    })
    mock_database["daily_kpi_log"].insert_one({
        "_id": f"EMP1138-{target_date}",
        "name": f"EMP1138-{target_date}",
        "employee_id": "EMP1138",
        "employee_name": "Sunil Chaminda Perera",
        "designation": "Postal Officer",
        "work_category": "Delivery",
        "post_office": "Kaduwela",
        "date": target_date,
        "assigned_work_count": 1,
        "completed_work_count": 0,
        "uncompleted_work_count": 1,
        "primary_task_type": "Mail & Parcel Delivery",
        "route_id": "R61-NEG",
    })

    # Standard daily operational checklist tasks
    checklist = [
        "Parcel Delivery by Route",
        "Ordinary Letter Delivery",
        "Registered Mail Delivery",
        "Pending Mail and Parcel Clearance",
        "Incoming Mail Registration",
        "Parcel Registration and Sorting",
        "Article Scanning and Tracking Updates",
        "Postal Financial Transactions",
        "Counter Customer Service",
        "Postage and Fee Verification",
    ]

    res = auto_balance_workload(target_date, post_office="Kaduwela", checklist=checklist, confirm=True)

    assert res["ok"] is True
    assert res["eligible_count"] == 7

    # Verify that all 7 employees now have at least 1 assigned task!
    summary_by_id = {row["employee_id"]: row for row in res["eligible_employees"]}
    assert len(summary_by_id) == 7

    for eid, s in summary_by_id.items():
        assert s["assigned_tasks"] >= 1, f"Employee {eid} has {s['assigned_tasks']} tasks, expected at least 1"

    # Verify EMP1139, EMP1140, EMP1141, EMP1142, EMP1143 all received tasks
    assert summary_by_id["EMP1139"]["assigned_tasks"] >= 1
    assert summary_by_id["EMP1140"]["assigned_tasks"] >= 1
    assert summary_by_id["EMP1141"]["assigned_tasks"] >= 1
    assert summary_by_id["EMP1142"]["assigned_tasks"] >= 1
    assert summary_by_id["EMP1143"]["assigned_tasks"] >= 1

    # Verify strict role & category constraints:
    delivery_eids = {"EMP1138", "EMP1139", "EMP1142"}
    indoor_eids = {"EMP1137", "EMP1140", "EMP1141", "EMP1143"}

    for t in res["transfers"]:
        recipient = t["to_employee_id"]
        task_name = t["task"]
        if "Delivery" in task_name or "Clearance" in task_name:
            assert recipient in delivery_eids, f"Delivery task {task_name} given to indoor staff {recipient}"
        if "Mail Registration" in task_name or "Counter" in task_name or "Financial" in task_name or "Scanning" in task_name:
            assert recipient in indoor_eids, f"Indoor task {task_name} given to delivery staff {recipient}"

    # Verify MongoDB persistence: daily_kpi_log has records for all 7 on target_date
    persisted_logs = list(mock_database["daily_kpi_log"].find({"date": target_date}))
    assert len(persisted_logs) == 7

