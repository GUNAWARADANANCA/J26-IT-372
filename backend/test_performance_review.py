"""Promotion review and daily allocation rules."""

import unittest
from datetime import date

from performance_review import build_allocation, review_employee


def _logs(employee_id, months, rates=(90, 90, 90)):
    rows = []
    for index in range(months):
        day = date(2024, 1, 15)
        month = day.month + index
        year = day.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        rows.append(
            {
                "employee_id": employee_id,
                "date": date(year, month, 15).isoformat(),
                "completion_rate": rates[0],
                "accuracy_rate": rates[1],
                "timeliness_rate": rates[2],
                "assigned_work_count": 20,
                "uncompleted_work_count": 0,
                "incorrect_work_count": 0,
                "late_work_count": 0,
            }
        )
    return rows


def _attendance(employee_id, logs):
    return [
        {"employee_id": employee_id, "date": log["date"], "attendance_status": "On time"}
        for log in logs
    ]


class ReviewTests(unittest.TestCase):
    def test_short_history_asks_for_more_information(self):
        logs = _logs("EMP1", 3)
        employee = {
            "employee_id": "EMP1",
            "employee_name": "A",
            "promotion_eligible": "Yes",
            "last_promotion_date": "2023-01-01",
        }
        result = review_employee(employee, logs, _attendance("EMP1", logs), date(2025, 6, 1))
        self.assertEqual(result["status"], "more_information_needed")

    def test_complete_record_can_be_recommended(self):
        logs = _logs("EMP1", 14)
        employee = {
            "employee_id": "EMP1",
            "employee_name": "A",
            "designation": "Postman",
            "work_category": "Delivery (Field)",
            "promotion_eligible": "Yes",
            "last_promotion_date": "2023-01-01",
        }
        result = review_employee(employee, logs, _attendance("EMP1", logs), date(2025, 6, 1))
        self.assertEqual(result["status"], "recommended")
        self.assertEqual(result["designation"], "Postman")

    def test_low_kpi_is_not_recommended_when_the_record_is_complete(self):
        logs = _logs("EMP1", 14, rates=(60, 60, 60))
        employee = {
            "employee_id": "EMP1",
            "employee_name": "A",
            "promotion_eligible": "Yes",
            "last_promotion_date": "2023-01-01",
        }
        result = review_employee(employee, logs, _attendance("EMP1", logs), date(2025, 6, 1))
        self.assertEqual(result["status"], "not_recommended")


class AllocationTests(unittest.TestCase):
    def test_pending_work_moves_only_to_a_present_colleague_in_the_same_category(self):
        employees = [
            {"employee_id": "A", "employee_name": "Absent", "designation": "Postman", "work_category": "Delivery (Field)"},
            {"employee_id": "B", "employee_name": "Present", "designation": "Postman", "work_category": "Delivery (Field)"},
            {"employee_id": "C", "employee_name": "Office", "designation": "Postal Clerk", "work_category": "Office"},
        ]
        logs = [
            {"employee_id": "A", "date": "2025-06-02", "assigned_work_count": 10, "completed_work_count": 4, "uncompleted_work_count": 6},
            {"employee_id": "B", "date": "2025-06-02", "assigned_work_count": 10, "completed_work_count": 10, "uncompleted_work_count": 0},
            {"employee_id": "C", "date": "2025-06-02", "assigned_work_count": 5, "completed_work_count": 0, "uncompleted_work_count": 5},
        ]
        attendance = [
            {"employee_id": "B", "date": "2025-06-02", "attendance_status": "On time"},
            {"employee_id": "C", "date": "2025-06-02", "attendance_status": "Late"},
        ]
        plan = build_allocation(employees, logs, attendance, date(2025, 6, 2))
        self.assertEqual(len(plan["moves"]), 1)
        self.assertEqual(plan["moves"][0]["to_employee_id"], "B")
        self.assertEqual(plan["moves"][0]["count"], 6)
        self.assertEqual(plan["moves"][0]["work_category"], "Delivery (Field)")
        self.assertEqual(plan["moves"][0]["designation"], "Postman")

    def test_counter_work_is_not_offered_to_a_postman(self):
        employees = [
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
            },
            {
                "employee_id": "EMP1150",
                "employee_name": "Thilini Madhavi Abeysekara",
                "designation": "Postal Assistant",
                "work_category": "Office",
            },
            {
                "employee_id": "EMP1151",
                "employee_name": "Janaka Priyadarshana Ekanayake",
                "designation": "Postal Clerk",
                "work_category": "Office",
            },
        ]
        logs = [
            {
                "employee_id": "EMP1151",
                "date": "2025-06-01",
                "primary_task_type": "Customer Service Counter",
                "assigned_work_count": 12,
                "completed_work_count": 12,
                "uncompleted_work_count": 0,
            },
            {
                "employee_id": "ABSENT",
                "date": "2025-06-02",
                "primary_task_type": "Customer Service Counter",
                "assigned_work_count": 8,
                "completed_work_count": 0,
                "uncompleted_work_count": 8,
            },
            {
                "employee_id": "EMP1139",
                "date": "2025-06-02",
                "primary_task_type": "Mail & Parcel Delivery",
                "assigned_work_count": 10,
                "completed_work_count": 10,
                "uncompleted_work_count": 0,
            },
            {
                "employee_id": "EMP1150",
                "date": "2025-06-02",
                "primary_task_type": "Data Entry",
                "assigned_work_count": 5,
                "completed_work_count": 5,
                "uncompleted_work_count": 0,
            },
            {
                "employee_id": "EMP1151",
                "date": "2025-06-02",
                "primary_task_type": "Postal Clerk Duties",
                "assigned_work_count": 30,
                "completed_work_count": 30,
                "uncompleted_work_count": 0,
            },
        ]
        employees.append(
            {
                "employee_id": "ABSENT",
                "employee_name": "Absent Clerk",
                "designation": "Postal Clerk",
                "work_category": "Office",
            }
        )
        attendance = [
            {"employee_id": "EMP1139", "date": "2025-06-02", "attendance_status": "On time"},
            {"employee_id": "EMP1150", "date": "2025-06-02", "attendance_status": "On time"},
            {"employee_id": "EMP1151", "date": "2025-06-02", "attendance_status": "Late"},
        ]
        plan = build_allocation(employees, logs, attendance, date(2025, 6, 2))
        self.assertEqual(len(plan["moves"]), 1)
        move = plan["moves"][0]
        self.assertEqual(move["to_employee_id"], "EMP1151")
        self.assertEqual(move["task"], "Customer Service Counter")
        self.assertEqual(move["count"], 8)
        self.assertNotIn("EMP1139", {item["to_employee_id"] for item in plan["moves"]})
        blocked = {item["employee_id"] for item in plan["blocked"]}
        self.assertIn("EMP1139", blocked)
        self.assertTrue(any("Postman" in item["reason"] for item in plan["blocked"]))

    def test_counter_work_stays_unassigned_when_only_a_postman_is_present(self):
        employees = [
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
            },
            {
                "employee_id": "ABSENT",
                "employee_name": "Absent Clerk",
                "designation": "Postal Clerk",
                "work_category": "Office",
            },
        ]
        logs = [
            {
                "employee_id": "ABSENT",
                "date": "2025-06-02",
                "primary_task_type": "Customer Service Counter",
                "assigned_work_count": 6,
                "completed_work_count": 0,
                "uncompleted_work_count": 6,
            }
        ]
        attendance = [
            {"employee_id": "EMP1139", "date": "2025-06-02", "attendance_status": "On time"},
        ]
        plan = build_allocation(employees, logs, attendance, date(2025, 6, 2))
        self.assertEqual(plan["moves"], [])
        self.assertEqual(plan["unmet"][0]["count"], 6)
        self.assertIn("Postal Assistant", plan["unmet"][0]["needed_roles"])
        self.assertEqual(plan["blocked"][0]["employee_id"], "EMP1139")

    def test_a_time_scan_without_status_receives_only_suitable_checklist_work(self):
        employees = [
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
            },
            {
                "employee_id": "EMP1151",
                "employee_name": "Janaka Priyadarshana Ekanayake",
                "designation": "Postal Clerk",
                "work_category": "Office",
            },
        ]
        attendance = [
            {"employee_id": "EMP1139", "date": "2026-10-11", "fingerprint_in": "09:07", "fingerprint_out": "18:56"},
            {"employee_id": "EMP1151", "date": "2026-10-11", "fingerprint_out": "21:55"},
        ]
        plan = build_allocation(
            employees,
            [],
            attendance,
            date(2026, 10, 11),
            ["Counter Customer Service", "Registered Mail Delivery"],
        )
        by_task = {item["task"]: item["employee_id"] for item in plan["checklist"]}
        self.assertEqual(sorted(person["employee_id"] for person in plan["present"]), ["EMP1139", "EMP1151"])
        self.assertEqual(by_task["Counter Customer Service"], "EMP1151")
        self.assertEqual(by_task["Registered Mail Delivery"], "EMP1139")

    def test_covering_an_absent_postman_route_estimates_four_hours_overtime(self):
        employees = [
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
                "basic_salary": 42000,
            },
            {
                "employee_id": "EMP1138",
                "employee_name": "Sunil Chaminda Perera",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
                "basic_salary": 42000,
            },
            {
                "employee_id": "EMP1151",
                "employee_name": "Janaka Priyadarshana Ekanayake",
                "designation": "Postal Clerk",
                "work_category": "Office",
                "basic_salary": 52000,
            },
        ]
        attendance = [
            {"employee_id": "EMP1139", "date": "2026-10-11", "fingerprint_in": "09:07"},
            {"employee_id": "EMP1151", "date": "2026-10-11", "attendance_status": "On time"},
        ]
        plan = build_allocation(
            employees,
            [],
            attendance,
            date(2026, 10, 11),
            ["Registered Mail Delivery", "Counter Customer Service"],
        )
        overtime = {row["employee_id"]: row for row in plan["overtime"]}
        self.assertNotIn("EMP1151", overtime)
        dinesh = overtime["EMP1139"]
        self.assertEqual(dinesh["overtime_hours"], 4)
        self.assertEqual(dinesh["hourly_rate"], 175)
        self.assertEqual(dinesh["overtime_rate"], 262.5)
        self.assertEqual(dinesh["overtime_pay"], 1050)
        self.assertIn("Sunil Chaminda Perera", dinesh["covered_names"])

    def test_one_extra_assigned_task_is_one_hour_of_overtime(self):
        employees = [
            {
                "employee_id": "EMP1139",
                "employee_name": "Dinesh Lakmal Silva",
                "designation": "Postman",
                "work_category": "Delivery (Field)",
                "basic_salary": 42000,
            },
        ]
        attendance = [
            {"employee_id": "EMP1139", "date": "2026-10-11", "attendance_status": "On time"},
        ]
        plan = build_allocation(
            employees,
            [],
            attendance,
            date(2026, 10, 11),
            ["Registered Mail Delivery", "Parcel Delivery by Route"],
        )
        self.assertEqual(len(plan["overtime"]), 1)
        self.assertEqual(plan["overtime"][0]["overtime_hours"], 1)
        self.assertEqual(plan["overtime"][0]["overtime_pay"], 262.5)


if __name__ == "__main__":
    unittest.main()
