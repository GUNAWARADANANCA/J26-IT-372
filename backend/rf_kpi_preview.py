"""Read-only preview of the Colab Random Forest pipeline.

This module does not read or write kpi_model_forecast and does not call
generate_forecasts. The live Gradient Boosting model stays in kpi_forecast.py.
"""

from pathlib import Path

import joblib
import pandas as pd
from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

MODEL_PATH = Path(__file__).resolve().parent / "models" / "kpi_forecast_model.joblib"
FEATURE_COLUMNS = (
    "KPI_Score",
    "KPI_Lag_1",
    "KPI_Lag_2",
    "KPI_Mean_Previous_4",
    "Years_of_Experience",
    "Post_Office",
    "Designation",
    "Work_Category",
    "Employment_Type",
)

_pipeline = None


class RandomForestPreview(BaseModel):
    KPI_Score: float
    KPI_Lag_1: float
    KPI_Lag_2: float
    KPI_Mean_Previous_4: float
    Years_of_Experience: float = Field(..., ge=0)
    Post_Office: str
    Designation: str
    Work_Category: str
    Employment_Type: str

    @field_validator("Post_Office", "Designation", "Work_Category", "Employment_Type")
    @classmethod
    def required_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("This feature is required.")
        return text


def load_random_forest():
    global _pipeline
    if _pipeline is None:
        if not MODEL_PATH.is_file():
            raise HTTPException(status_code=503, detail="The Random Forest KPI model file is missing.")
        _pipeline = joblib.load(MODEL_PATH)
        names = tuple(getattr(_pipeline, "feature_names_in_", ()))
        if names != FEATURE_COLUMNS:
            _pipeline = None
            raise HTTPException(status_code=503, detail="The Random Forest KPI model features do not match the preview.")
    return _pipeline


def preview_next_week_kpi(body: RandomForestPreview) -> dict:
    pipeline = load_random_forest()
    frame = pd.DataFrame([{column: getattr(body, column) for column in FEATURE_COLUMNS}])
    predicted = float(pipeline.predict(frame)[0])
    return {
        "predicted_kpi": round(predicted, 2),
        "model": MODEL_PATH.name,
        "target": "Target_KPI",
    }
