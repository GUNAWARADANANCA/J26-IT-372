"""Evaluate next-week KPI prediction without touching the live API or model.

This script only reads the saved joblib and spreadsheet or CSV inputs.
It does not write a replacement model, does not connect to MongoDB, and does
not change the KPI formula.

The joblib stores a fitted pipeline, feature names, and a cutoff timestamp.
It does not store the training rows or the target column. The target used
here is the next Monday's weekly KPI, built as the average of that week's
daily KPI scores. Each daily KPI is the average of completion, accuracy,
and timeliness. That target is consistent with the stored cutoff and the
224/60 row counts on the extended research workbook. It is not a value
read back out of the forest.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BACKEND = Path(__file__).resolve().parents[1]
MODEL_PATH = BACKEND / "models" / "weekly_kpi_model.joblib"
SYNTHETIC_PATH = BACKEND / "data" / "synthetic" / "synthetic_employee_weeks.csv"
DOWNLOADS = Path.home() / "Downloads"
EXTENDED_NAME = "Combined_KPI_Data_Final_Extended_with_Past_KPI.xlsx"
JANUARY_NAME = "Sri_Lanka_Postal_Employee_KPI_Dataset_1500.xlsx"
STORED_CUT = pd.Timestamp("2025-04-07")
FEATURE_COLUMNS = [
    "kpi",
    "completion",
    "accuracy",
    "timeliness",
    "assigned",
    "uncompleted",
    "incorrect",
    "late",
    "experience",
    "work_category",
]
NUMERIC_FEATURES = FEATURE_COLUMNS[:-1]


def weekly_frame(daily: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily rows the same way the desk builds a week."""
    frame = daily.copy()
    frame["Date"] = pd.to_datetime(frame["Date"])
    frame["week"] = frame["Date"] - pd.to_timedelta(frame["Date"].dt.weekday, unit="D")
    rows = []
    for (employee_id, week), days in frame.groupby(["Employee_ID", "week"], sort=True):
        completion = days["Completion_Rate"].mean()
        accuracy = days["Accuracy_Rate"].mean()
        timeliness = days["Timeliness_Rate"].mean()
        daily_scores = (
            days["Completion_Rate"] + days["Accuracy_Rate"] + days["Timeliness_Rate"]
        ) / 3
        if pd.isna(completion) or pd.isna(accuracy) or pd.isna(timeliness) or daily_scores.isna().all():
            continue
        experience = float(days["Years_of_Experience"].iloc[0])
        category = str(days["Work_Category"].iloc[0])
        rows.append(
            {
                "employee_id": employee_id,
                "week": pd.Timestamp(week),
                "kpi": float(daily_scores.mean()),
                "completion": float(completion),
                "accuracy": float(accuracy),
                "timeliness": float(timeliness),
                "assigned": float(days["Assigned_Work_Count"].sum()),
                "uncompleted": float(days["Uncompleted_Work_Count"].sum()),
                "incorrect": float(days["Incorrect_Work_Count"].sum()),
                "late": float(days["Late_Work_Count"].sum()),
                "experience": experience,
                "work_category": category,
            }
        )
    return pd.DataFrame(rows)


def add_next_week_target(weeks: pd.DataFrame) -> pd.DataFrame:
    """Shift each employee's own later weekly KPI. Do not cross employees."""
    labeled = weeks.sort_values(["employee_id", "week"]).copy()
    labeled["next_week"] = labeled.groupby("employee_id")["week"].shift(-1)
    labeled["target"] = labeled.groupby("employee_id")["kpi"].shift(-1)
    expected = labeled["week"] + pd.Timedelta(days=7)
    broken = labeled["target"].notna() & (labeled["next_week"] != expected)
    if broken.any():
        raise RuntimeError("A next-week target is not the following Monday for that employee.")
    return labeled.dropna(subset=["target"]).reset_index(drop=True)


def chronological_split(labeled: pd.DataFrame, cut: pd.Timestamp) -> tuple[pd.DataFrame, pd.DataFrame]:
    train = labeled[labeled["week"] < cut].copy()
    test = labeled[labeled["week"] >= cut].copy()
    if train.empty or test.empty:
        raise RuntimeError("The chronological split produced an empty train or test set.")
    if train["week"].max() >= test["week"].min():
        raise RuntimeError("Training weeks overlap the holdout.")
    return train, test


def metrics(actual: pd.Series, predicted: pd.Series) -> dict[str, float]:
    error = predicted.to_numpy(dtype=float) - actual.to_numpy(dtype=float)
    absolute = abs(error)
    return {
        "mae": float(absolute.mean()),
        "rmse": float((error ** 2).mean() ** 0.5),
        "within_5_points_percent": float((absolute <= 5).mean() * 100),
    }


def fresh_pipeline() -> Pipeline:
    """Same estimator shape as the saved model. Fit this only on training rows."""
    return Pipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        ("num", "passthrough", NUMERIC_FEATURES),
                        ("cat", OneHotEncoder(handle_unknown="ignore"), ["work_category"]),
                    ]
                ),
            ),
            ("rf", RandomForestRegressor(n_estimators=200, random_state=42)),
        ]
    )


def report_block(title: str, rows: dict[str, dict[str, float]]) -> None:
    print(title)
    for name, scores in rows.items():
        print(
            f"  {name}: MAE {scores['mae']:.4f}, "
            f"RMSE {scores['rmse']:.4f}, "
            f"within 5 points {scores['within_5_points_percent']:.2f}%"
        )


def evaluate_saved_and_refit(labeled: pd.DataFrame, cut: pd.Timestamp, bundle: dict) -> None:
    train, test = chronological_split(labeled, cut)
    print(f"labeled_rows={len(labeled)}")
    print(f"employees={labeled['employee_id'].nunique()}")
    print(f"train_rows={len(train)} train_weeks={train['week'].min().date()} to {train['week'].max().date()}")
    print(f"test_rows={len(test)} test_weeks={test['week'].min().date()} to {test['week'].max().date()}")
    print(f"split_cut={cut.date()}")

    features_test = test[FEATURE_COLUMNS]
    saved_prediction = pd.Series(bundle["model"].predict(features_test), index=test.index)
    baseline_prediction = test["kpi"]
    report_block(
        "saved_model_holdout",
        {
            "current_week_baseline": metrics(test["target"], baseline_prediction),
            "saved_model": metrics(test["target"], saved_prediction),
        },
    )

    refit = fresh_pipeline()
    refit.fit(train[FEATURE_COLUMNS], train["target"])
    refit_prediction = pd.Series(refit.predict(features_test), index=test.index)
    report_block(
        "refit_on_training_weeks_only",
        {
            "current_week_baseline": metrics(test["target"], baseline_prediction),
            "refit_model": metrics(test["target"], refit_prediction),
        },
    )
    print("refit_was_not_saved")


def evaluate_research_file(path: Path, bundle: dict) -> None:
    print(f"research_file={path}")
    daily = pd.read_excel(path)
    print(f"daily_rows={len(daily)} daily_employees={daily['Employee_ID'].nunique()}")
    print(f"daily_dates={pd.to_datetime(daily['Date']).min().date()} to {pd.to_datetime(daily['Date']).max().date()}")
    labeled = add_next_week_target(weekly_frame(daily))
    evaluate_saved_and_refit(labeled, STORED_CUT, bundle)


def evaluate_january_file(path: Path) -> None:
    """The 1500-name workbook ends in January, before the stored April cutoff."""
    print(f"january_workbook={path}")
    daily = pd.read_excel(path, sheet_name=0)
    dates = pd.to_datetime(daily["Date"])
    print(f"january_daily_rows={len(daily)} january_employees={daily['Employee_ID'].nunique()}")
    print(f"january_dates={dates.min().date()} to {dates.max().date()}")
    labeled = add_next_week_target(weekly_frame(daily))
    holdout = labeled[labeled["week"] >= STORED_CUT]
    print(f"january_labeled_rows={len(labeled)} january_rows_on_or_after_stored_cut={len(holdout)}")
    print("january_workbook_cannot_reproduce_the_stored_april_holdout")


def evaluate_synthetic(bundle: dict) -> None:
    print(f"synthetic_file={SYNTHETIC_PATH}")
    print("synthetic_results_do_not_describe_real_postal_work")
    frame = pd.read_csv(SYNTHETIC_PATH)
    frame["Next_Week_Actual_KPI"] = pd.to_numeric(frame["Next_Week_Actual_KPI"], errors="coerce")
    frame = frame[frame["Next_Week_Actual_KPI"].notna()].copy()
    frame["week"] = pd.to_datetime(frame["Week_Start"])
    labeled = pd.DataFrame(
        {
            "employee_id": frame["Employee_ID"],
            "week": frame["week"],
            "kpi": frame["Actual_Weekly_KPI"].astype(float),
            "completion": frame["Completion_Rate"].astype(float),
            "accuracy": frame["Accuracy_Rate"].astype(float),
            "timeliness": frame["Timeliness_Rate"].astype(float),
            "assigned": frame["Assigned_Work_Count"].astype(float),
            "uncompleted": frame["Uncompleted_Work_Count"].astype(float),
            "incorrect": frame["Incorrect_Work_Count"].astype(float),
            "late": frame["Late_Work_Count"].astype(float),
            "experience": frame["Years_of_Experience"].astype(float),
            "work_category": frame["Work_Category"],
            "target": frame["Next_Week_Actual_KPI"].astype(float),
        }
    )
    cut = pd.Timestamp("2024-10-07")
    train, test = chronological_split(labeled, cut)
    print(f"synthetic_labeled_rows={len(labeled)} synthetic_employees={labeled['employee_id'].nunique()}")
    print(f"synthetic_train_rows={len(train)} synthetic_test_rows={len(test)} synthetic_cut={cut.date()}")
    refit = fresh_pipeline()
    refit.fit(train[FEATURE_COLUMNS], train["target"])
    prediction = pd.Series(refit.predict(test[FEATURE_COLUMNS]), index=test.index)
    saved_prediction = pd.Series(bundle["model"].predict(test[FEATURE_COLUMNS]), index=test.index)
    report_block(
        "synthetic_experiment",
        {
            "current_week_baseline": metrics(test["target"], test["kpi"]),
            "saved_model_on_synthetic_holdout": metrics(test["target"], saved_prediction),
            "pipeline_refit_on_synthetic_train": metrics(test["target"], prediction),
        },
    )


def main() -> None:
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    print(f"model_path={MODEL_PATH}")
    print(f"bundle_keys={list(bundle)}")
    print(f"stored_feature_cols={bundle.get('feature_cols')}")
    print(f"stored_cut={bundle.get('cut')}")
    print(f"pipeline_feature_names={list(model.feature_names_in_)}")
    print("stored_target=not_present_in_joblib")
    print(
        "target_used_here=next Monday weekly KPI; "
        "weekly KPI is the mean of daily averages of completion, accuracy, and timeliness"
    )

    extended = DOWNLOADS / EXTENDED_NAME
    january = DOWNLOADS / JANUARY_NAME
    if extended.is_file():
        evaluate_research_file(extended, bundle)
    else:
        print(f"extended_research_file_missing={extended}")
    if january.is_file():
        evaluate_january_file(january)
    else:
        print(f"january_workbook_missing={january}")
    if SYNTHETIC_PATH.is_file():
        evaluate_synthetic(bundle)
    else:
        print(f"synthetic_file_missing={SYNTHETIC_PATH}")


if __name__ == "__main__":
    main()
