"""Check the synthetic week file. Does not train a model or read MongoDB."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

PATH = Path(__file__).with_name("synthetic_employee_weeks.csv")
COUNT_FIELDS = [
    "Assigned_Work_Count",
    "Completed_Work_Count",
    "Uncompleted_Work_Count",
    "Correct_Work_Count",
    "Incorrect_Work_Count",
    "On_Time_Work_Count",
    "Late_Work_Count",
]
RATE_FIELDS = ["Completion_Rate", "Accuracy_Rate", "Timeliness_Rate", "Actual_Weekly_KPI"]


def load() -> list[dict]:
    with PATH.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    rows = load()
    errors = []
    keys = [(row["Employee_ID"], row["Week_Start"]) for row in rows]
    if len(rows) != 1560:
        errors.append(f"row count is {len(rows)}, expected 1560")
    if len(set(row["Employee_ID"] for row in rows)) != 30:
        errors.append("employee count is not 30")
    if len(keys) != len(set(keys)):
        errors.append(f"duplicate employee-week keys: {len(keys) - len(set(keys))}")
    weeks_per_employee = Counter(row["Employee_ID"] for row in rows)
    if any(count != 52 for count in weeks_per_employee.values()):
        errors.append("an employee does not have 52 weeks")

    missing_required = 0
    bad_next = 0
    last_week_filled = 0
    formula_mismatch = 0
    for row in rows:
        for column, value in row.items():
            if column == "Next_Week_Actual_KPI":
                continue
            if value == "":
                missing_required += 1
        if row["Data_Origin"] != "synthetic":
            errors.append("a row is not labelled synthetic")
            break
        counts = {name: int(row[name]) for name in COUNT_FIELDS}
        if any(value < 0 for value in counts.values()):
            errors.append("negative count")
            break
        if counts["Completed_Work_Count"] > counts["Assigned_Work_Count"]:
            errors.append("completed exceeds assigned")
            break
        if counts["Incorrect_Work_Count"] > counts["Completed_Work_Count"]:
            errors.append("incorrect exceeds completed")
            break
        if counts["Late_Work_Count"] > counts["Completed_Work_Count"]:
            errors.append("late exceeds completed")
            break
        if counts["Uncompleted_Work_Count"] != counts["Assigned_Work_Count"] - counts["Completed_Work_Count"]:
            errors.append("uncompleted count is inconsistent")
            break
        if counts["Correct_Work_Count"] != counts["Completed_Work_Count"] - counts["Incorrect_Work_Count"]:
            errors.append("correct count is inconsistent")
            break
        if counts["On_Time_Work_Count"] != counts["Completed_Work_Count"] - counts["Late_Work_Count"]:
            errors.append("on-time count is inconsistent")
            break
        rates = [float(row[name]) for name in RATE_FIELDS]
        if any(rate < 0 or rate > 100 for rate in rates):
            errors.append("rate outside 0 to 100")
            break
        expected = round((rates[0] + rates[1] + rates[2]) / 3, 2)
        if abs(expected - rates[3]) > 0.02:
            formula_mismatch += 1

    by_employee: dict[str, list[dict]] = {}
    for row in rows:
        by_employee.setdefault(row["Employee_ID"], []).append(row)
    for group in by_employee.values():
        group.sort(key=lambda row: row["Week_Start"])
        for current, nxt in zip(group, group[1:]):
            if current["Next_Week_Actual_KPI"] != nxt["Actual_Weekly_KPI"]:
                bad_next += 1
        if group[-1]["Next_Week_Actual_KPI"] != "":
            last_week_filled += 1
        if any(row["Next_Week_Actual_KPI"] == "" for row in group[:-1]):
            bad_next += 1

    print(f"rows={len(rows)}")
    print(f"employees={len(weeks_per_employee)}")
    print(f"duplicate_employee_weeks={len(keys) - len(set(keys))}")
    print(f"missing_required_values={missing_required}")
    print(f"next_week_mismatches={bad_next}")
    print(f"last_week_with_target={last_week_filled}")
    print(f"weekly_kpi_formula_mismatches={formula_mismatch}")
    print("result=" + ("fail" if errors or missing_required or bad_next or last_week_filled or formula_mismatch else "pass"))
    for error in errors:
        print("error=" + error)


if __name__ == "__main__":
    main()
