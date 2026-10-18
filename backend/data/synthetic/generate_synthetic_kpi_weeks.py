"""Create a reproducible synthetic employee-week file.

This does not read MongoDB, does not train a model, and does not describe
real postal employees. Run from the backend directory:

    .\\.venv\\Scripts\\python.exe data/synthetic/generate_synthetic_kpi_weeks.py
"""

from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path
from random import Random

SEED = 42
EMPLOYEE_COUNT = 30
WEEK_COUNT = 52
FIRST_MONDAY = date(2024, 1, 1)
OUTPUT = Path(__file__).with_name("synthetic_employee_weeks.csv")

CATEGORIES = (
    ("Delivery (Field)", 16, (18, 36)),
    ("Office", 10, (12, 28)),
    ("Supervisory / Office", 4, (8, 18)),
)

COLUMNS = [
    "Data_Origin",
    "Employee_ID",
    "Week_Start",
    "Work_Category",
    "Years_of_Experience",
    "Assigned_Work_Count",
    "Completed_Work_Count",
    "Uncompleted_Work_Count",
    "Correct_Work_Count",
    "Incorrect_Work_Count",
    "On_Time_Work_Count",
    "Late_Work_Count",
    "Completion_Rate",
    "Accuracy_Rate",
    "Timeliness_Rate",
    "Actual_Weekly_KPI",
    "Next_Week_Actual_KPI",
]


def round2(value: float) -> float:
    return round(value * 100) / 100


def daily_rates(completed: int, assigned: int, incorrect: int, late: int) -> tuple[float, float, float, float]:
    """Match the desk formulas. Accuracy and timeliness use completed work as the denominator."""
    completion = round2(100 * completed / assigned)
    correct = completed - incorrect
    on_time = completed - late
    accuracy = round2(100 * correct / completed)
    timeliness = round2(100 * on_time / completed)
    kpi = round2((completion + accuracy + timeliness) / 3)
    return completion, accuracy, timeliness, kpi


def build_employees(rng: Random) -> list[dict]:
    employees = []
    number = 1
    for category, count, _assigned_span in CATEGORIES:
        for _ in range(count):
            employees.append(
                {
                    "employee_id": f"SYN{number:03d}",
                    "work_category": category,
                    "years_of_experience": rng.randint(1, 24),
                    "completion_level": rng.uniform(0.78, 0.98),
                    "accuracy_level": rng.uniform(0.80, 0.99),
                    "timeliness_level": rng.uniform(0.75, 0.98),
                }
            )
            number += 1
    return employees


def assigned_span(category: str) -> tuple[int, int]:
    for name, _count, span in CATEGORIES:
        if name == category:
            return span
    raise KeyError(category)


def one_day(rng: Random, employee: dict, shock: float) -> dict:
    low, high = assigned_span(employee["work_category"])
    assigned = rng.randint(low, high)
    completion_p = min(0.99, max(0.55, employee["completion_level"] + shock))
    accuracy_p = min(0.99, max(0.60, employee["accuracy_level"] + shock * 0.6))
    timeliness_p = min(0.99, max(0.55, employee["timeliness_level"] + shock * 0.8))
    completed = min(assigned, max(1, round(assigned * completion_p)))
    incorrect = min(completed, round(completed * (1 - accuracy_p)))
    late = min(completed, round(completed * (1 - timeliness_p)))
    completion, accuracy, timeliness, kpi = daily_rates(completed, assigned, incorrect, late)
    return {
        "assigned": assigned,
        "completed": completed,
        "incorrect": incorrect,
        "late": late,
        "completion": completion,
        "accuracy": accuracy,
        "timeliness": timeliness,
        "kpi": kpi,
    }


def week_record(rng: Random, employee: dict, week_start: date, shock: float) -> dict:
    """Six days, Monday through Saturday, then average the daily scores."""
    days = [one_day(rng, employee, shock + rng.uniform(-0.03, 0.03)) for _ in range(6)]
    assigned = sum(day["assigned"] for day in days)
    completed = sum(day["completed"] for day in days)
    incorrect = sum(day["incorrect"] for day in days)
    late = sum(day["late"] for day in days)
    completion = round2(sum(day["completion"] for day in days) / len(days))
    accuracy = round2(sum(day["accuracy"] for day in days) / len(days))
    timeliness = round2(sum(day["timeliness"] for day in days) / len(days))
    kpi = round2(sum(day["kpi"] for day in days) / len(days))
    return {
        "Data_Origin": "synthetic",
        "Employee_ID": employee["employee_id"],
        "Week_Start": week_start.isoformat(),
        "Work_Category": employee["work_category"],
        "Years_of_Experience": employee["years_of_experience"],
        "Assigned_Work_Count": assigned,
        "Completed_Work_Count": completed,
        "Uncompleted_Work_Count": assigned - completed,
        "Correct_Work_Count": completed - incorrect,
        "Incorrect_Work_Count": incorrect,
        "On_Time_Work_Count": completed - late,
        "Late_Work_Count": late,
        "Completion_Rate": completion,
        "Accuracy_Rate": accuracy,
        "Timeliness_Rate": timeliness,
        "Actual_Weekly_KPI": kpi,
        "Next_Week_Actual_KPI": "",
    }


def generate() -> list[dict]:
    rng = Random(SEED)
    rows = []
    for employee in build_employees(rng):
        shock = 0.0
        for index in range(WEEK_COUNT):
            shock = 0.65 * shock + rng.uniform(-0.06, 0.06)
            week_start = FIRST_MONDAY + timedelta(days=7 * index)
            rows.append(week_record(rng, employee, week_start, shock))
    by_employee: dict[str, list[dict]] = {}
    for row in rows:
        by_employee.setdefault(row["Employee_ID"], []).append(row)
    for group in by_employee.values():
        group.sort(key=lambda row: row["Week_Start"])
        for current, nxt in zip(group, group[1:]):
            current["Next_Week_Actual_KPI"] = nxt["Actual_Weekly_KPI"]
    return rows


def write_csv(rows: list[dict]) -> None:
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows = generate()
    write_csv(rows)
    print(f"Wrote {len(rows)} synthetic rows to {OUTPUT}")


if __name__ == "__main__":
    main()
