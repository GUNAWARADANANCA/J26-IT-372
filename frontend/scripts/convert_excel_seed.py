"""One-off: Excel -> frontend/public/data/*.json"""
import json
import os
from collections import OrderedDict
from datetime import date, datetime

import openpyxl

EXCEL = r"d:\post-office_research\Sri_Lanka_Postal_Employee_KPI_Dataset_1500.xlsx"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

EMP_FIELDS = [
    "Employee_ID",
    "Employee_Name",
    "Post_Office",
    "Designation",
    "Work_Category",
    "Years_of_Experience",
    "Employment_Type",
    "Reports_To",
    "Prior_6Month_Avg_KPI_Score",
    "Promotion_Eligible",
    "Last_Promotion_Date",
    "Months_Since_Last_Promotion",
    "Reward_Received",
    "Reward_Type",
]

LOG_FIELDS = [
    "Employee_ID",
    "Date",
    "Day_of_Week",
    "Route_ID",
    "Route_Length_km",
    "Distance_Covered_km",
    "Primary_Task_Type",
    "Assigned_Work_Count",
    "Completed_Work_Count",
    "Uncompleted_Work_Count",
    "Completion_Rate",
    "Correct_Work_Count",
    "Incorrect_Work_Count",
    "Accuracy_Rate",
    "On_Time_Work_Count",
    "Late_Work_Count",
    "Timeliness_Rate",
    "Approvals_Processed",
    "Accounts_Verified",
    "Revenue_Collected_LKR",
    "KPI_Score",
    "Performance_Category",
]


def to_snake(h: str) -> str:
    return h.lower()


def ser(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v == int(v) and abs(v) < 1e15:
        return int(v)
    return v


def main():
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = list(rows[0])

    employees = OrderedDict()
    logs = []
    for r in rows[1:]:
        row = {headers[i]: ser(r[i] if i < len(r) else None) for i in range(len(headers))}
        eid = row["Employee_ID"]
        if eid not in employees:
            emp = {to_snake(f): row[f] for f in EMP_FIELDS}
            emp["name"] = eid
            employees[eid] = emp
        log = {to_snake(f): row[f] for f in LOG_FIELDS}
        log["name"] = f"{eid}-{row['Date']}"
        logs.append(log)

    os.makedirs(OUT_DIR, exist_ok=True)
    emp_path = os.path.join(OUT_DIR, "employees.json")
    log_path = os.path.join(OUT_DIR, "daily_kpi_logs.json")
    with open(emp_path, "w", encoding="utf-8") as f:
        json.dump(list(employees.values()), f, ensure_ascii=False)
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False)
    print(f"Wrote {len(employees)} employees -> {emp_path}")
    print(f"Wrote {len(logs)} logs -> {log_path}")


if __name__ == "__main__":
    main()
