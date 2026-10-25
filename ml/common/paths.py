"""Central path definitions shared by every ML / dataset script.

All scripts resolve paths relative to the repository root so they can be run
from any working directory, e.g. ``python ml/address_parser/train_crf.py``.
"""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DATASETS = REPO_ROOT / "Datasets"
RAW = DATASETS / "raw"
CURATED = DATASETS / "curated"
PROCESSED = DATASETS / "processed"
REFERENCE = PROCESSED / "reference"
TEMPLATES = DATASETS / "templates"

FONTS = RAW / "fonts"

# Handwriting datasets are large (hundreds of MB) and the repository lives in a cloud-synced
# folder, so they are kept outside it. Override with the HTR_DATA_DIR environment variable.
HTR_DATA = Path(os.environ.get("HTR_DATA_DIR", Path.home() / "PostAssist" / "datasets"))

ML_ROOT = REPO_ROOT / "ml"
REPORTS = ML_ROOT / "reports"

BACKEND_ROOT = REPO_ROOT / "backend"
# Trained artefacts are written straight into the backend so the API can load
# them without a separate copy step.
BACKEND_MODELS = BACKEND_ROOT / "models"
BACKEND_REFERENCE = BACKEND_ROOT / "app" / "reference"


def ensure(*dirs: Path) -> None:
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
