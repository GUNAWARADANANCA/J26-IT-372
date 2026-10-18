# Synthetic employee-week KPI file

`synthetic_employee_weeks.csv` is **synthetic development data**. It does not describe real postal employees or real operational performance. It was not taken from MongoDB and it does not replace the research workbook or the saved KPI model.

Regenerate it with:

```text
.\.venv\Scripts\python.exe data/synthetic/generate_synthetic_kpi_weeks.py
```

The generator uses Python's `random.Random(42)`. The same seed produces the same file.

## What is in the file

30 simulated employees (`SYN001`–`SYN030`) and 52 Monday-start weeks beginning 2024-01-01. That is 1,560 employee-week rows. Each employee keeps one work category and one years-of-experience value for the whole year.

| Employees | Work category | Assigned items per simulated day |
| --- | --- | --- |
| 16 | Delivery (Field) | 18–36 |
| 10 | Office | 12–28 |
| 4 | Supervisory / Office | 8–18 |

Each week is built from six simulated days, Monday through Saturday. An employee has a stable completion, accuracy, and timeliness level. Each new week keeps 65% of the previous week's shock and adds a small new shock, so neighbouring weeks move together without being copies.

## Formulas

These match the desk, and they were not changed:

- Daily completion rate = completed work / assigned work × 100.
- Daily accuracy rate = correct work / completed work × 100.
- Daily timeliness rate = on-time work / completed work × 100.
- Daily KPI = the average of those three rates.
- Weekly completion, accuracy, and timeliness = the average of that week's daily rates.
- Actual weekly KPI = the average of that week's daily KPI scores.

On-time work and incorrect work are both counted only inside completed work. For every day, correct work = completed − incorrect, and on-time work = completed − late. Unfinished items are not treated as incorrect or late. Every simulated day has at least one completed item, so those denominators are never zero.

`Next_Week_Actual_KPI` is the same employee's `Actual_Weekly_KPI` from the following Monday. The last week, 2024-12-23, has no next-week value.

The weekly rates are averages of daily rates. They are not recomputed from the week's summed counts, because a ratio of sums is not the same number as the average of daily ratios.

## Limits

The file is only for development and testing. Scores on this file do not measure the saved KPI model and do not establish accuracy on real postal work.
