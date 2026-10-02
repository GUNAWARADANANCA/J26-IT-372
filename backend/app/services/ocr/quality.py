"""Image-quality gate for envelope photos (P1 configuration, proposal 3.7).

The metrics are cheap and explainable; thresholds are starting values that
must be re-tuned on the development split of the envelope dataset and then
frozen before the held-out evaluation.
"""
from __future__ import annotations

import cv2
import numpy as np

THRESHOLDS = {
    "min_side_px": 600,        # below this, small handwriting cannot be read
    "min_sharpness": 60.0,     # variance of the Laplacian at 1000 px width
    "min_brightness": 60.0,
    "max_brightness": 225.0,
    "min_contrast": 25.0,
    "max_glare_fraction": 0.06,
}


def assess_quality(img: np.ndarray) -> dict:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    h, w = gray.shape[:2]
    scale = 1000.0 / max(w, 1)
    norm = cv2.resize(gray, (1000, max(1, int(h * scale))), interpolation=cv2.INTER_AREA) if w > 1000 else gray
    metrics = {
        "width": int(w), "height": int(h),
        "sharpness": round(float(cv2.Laplacian(norm, cv2.CV_64F).var()), 1),
        "brightness": round(float(norm.mean()), 1),
        "contrast": round(float(norm.std()), 1),
        "glare_fraction": round(float((norm >= 250).mean()), 4),
    }
    t = THRESHOLDS
    issues = []
    if min(w, h) < t["min_side_px"]:
        issues.append({"code": "LOW_RESOLUTION", "message": f"image is {w}x{h}px; move the camera closer or use a higher resolution"})
    if metrics["sharpness"] < t["min_sharpness"]:
        issues.append({"code": "BLURRY", "message": "image looks blurred; hold still or refocus and recapture"})
    if metrics["brightness"] < t["min_brightness"]:
        issues.append({"code": "TOO_DARK", "message": "image is too dark; add light"})
    if metrics["brightness"] > t["max_brightness"]:
        issues.append({"code": "TOO_BRIGHT", "message": "image is over-exposed"})
    if metrics["contrast"] < t["min_contrast"]:
        issues.append({"code": "LOW_CONTRAST", "message": "text contrast is low"})
    if metrics["glare_fraction"] > t["max_glare_fraction"]:
        issues.append({"code": "GLARE", "message": "glare on the envelope; tilt the envelope or switch off the flash"})
    return {"ok": not issues, "metrics": metrics, "issues": issues, "thresholds": t}
