"""Script identification (Sinhala / Tamil / Latin) for address text lines.

The classifier is a small CNN trained by ``ml/script_id/train.py`` on rendered
text lines and exported to ONNX (``backend/models/script_id.onnx``). It is
used by the P1 pipeline to pick the Tesseract language pack before OCR, which
is faster and more accurate than always running ``sin+tam+eng``.

Probabilities are temperature-scaled (Guo et al., 2017); the temperature is
fitted on the validation split and stored in ``script_id.meta.json``.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[3] / "models"
MODEL_PATH = MODELS_DIR / "script_id.onnx"
META_PATH = MODELS_DIR / "script_id.meta.json"

INPUT_H, INPUT_W = 32, 256
CLASSES = ["si", "ta", "en"]
TESSERACT_LANG = {"si": "sin", "ta": "tam", "en": "eng"}


def prepare_line(gray: np.ndarray) -> np.ndarray:
    """Grayscale line image (paper light, ink dark) -> float32 tensor (1, H, W).

    Shared with training so both see identical preprocessing: resize to a
    fixed height keeping aspect ratio, then crop / right-pad to a fixed width
    with the paper colour, and scale to [-1, 1].
    """
    if gray.ndim == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    if h == 0 or w == 0:
        return np.zeros((1, INPUT_H, INPUT_W), np.float32)
    new_w = max(1, int(round(w * INPUT_H / h)))
    img = cv2.resize(gray, (new_w, INPUT_H), interpolation=cv2.INTER_AREA if h > INPUT_H else cv2.INTER_LINEAR)
    paper = float(np.percentile(img, 90))
    if new_w >= INPUT_W:
        img = img[:, :INPUT_W]
    else:
        img = np.concatenate([img, np.full((INPUT_H, INPUT_W - new_w), paper, img.dtype)], axis=1)
    return ((img.astype(np.float32) / 255.0 - 0.5) / 0.5)[None]


class ScriptIdentifier:
    def __init__(self, model_path: Path = MODEL_PATH, meta_path: Path = META_PATH):
        import onnxruntime as ort

        self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        self.meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        self.temperature = float(self.meta.get("temperature", 1.0))
        self.classes = self.meta.get("classes", CLASSES)
        self.input_name = self.session.get_inputs()[0].name

    def predict_lines(self, lines: list[np.ndarray]) -> list[dict]:
        if not lines:
            return []
        batch = np.stack([prepare_line(l) for l in lines]).astype(np.float32)
        logits = self.session.run(None, {self.input_name: batch})[0] / self.temperature
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
        return [{"script": self.classes[int(p.argmax())], "confidence": float(p.max()),
                 "probs": {c: round(float(v), 4) for c, v in zip(self.classes, p)}} for p in probs]

    def predict_block(self, lines: list[np.ndarray], min_conf: float = 0.6) -> dict:
        """Width-weighted vote over the lines of an address block."""
        preds = self.predict_lines(lines)
        if not preds:
            return {"script": "none", "confidence": 0.0, "lines": [], "tesseract_lang": "eng"}
        weights = np.array([max(l.shape[1], 1) for l in lines], dtype=np.float64)
        agg = {c: float(sum(w * p["probs"][c] for w, p in zip(weights, preds)) / weights.sum()) for c in self.classes}
        top = max(agg, key=agg.get)
        confident = {p["script"] for p in preds if p["confidence"] >= min_conf}
        mixed = len(confident) > 1
        langs = [TESSERACT_LANG[top]]
        for c in sorted(confident - {top}):
            langs.append(TESSERACT_LANG[c])
        if top != "en" and "eng" not in langs:
            langs.append("eng")  # house numbers, 'No.' and English words are common in local-script addresses
        return {"script": "mixed" if mixed else top, "primary": top, "confidence": round(agg[top], 4),
                "block_probs": {c: round(v, 4) for c, v in agg.items()}, "lines": preds,
                "tesseract_lang": "+".join(langs)}


@lru_cache(maxsize=1)
def get_script_identifier() -> ScriptIdentifier | None:
    if not MODEL_PATH.exists():
        log.warning("script-identification model not found at %s", MODEL_PATH)
        return None
    try:
        return ScriptIdentifier()
    except Exception as exc:  # noqa: BLE001
        log.warning("could not load script-identification model: %s", exc)
        return None
