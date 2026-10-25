"""Handwritten text recognition for address lines (Sinhala / English / Tamil).

Tesseract is trained on printed text and misreads handwriting, so handwritten
address blocks are read by a small CRNN (convolutions -> bidirectional LSTM ->
CTC) trained by ``ml/htr/train.py`` and exported to ONNX
(``backend/models/htr.onnx``, character set in ``htr.meta.json``).

Everything a photo needs before recognition also lives here and is shared with
training, so both see identical input:

* ``ink_map``       flat-fields a photo (uneven light, shadows, faint ruled lines)
                    into an "ink" image: 0 = paper, 1 = pen stroke
* ``find_lines``    text-line boxes from the ink image (ruled lines removed first)
* ``prepare_line``  one line crop -> fixed-height tensor for the network
"""
from __future__ import annotations

import json
import logging
import unicodedata
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[3] / "models"
MODEL_PATH = MODELS_DIR / "htr.onnx"
META_PATH = MODELS_DIR / "htr.meta.json"

LINE_H = 48            # network input height
MAX_LINE_W = 1280      # longest line the network is given (about 70 characters)
WIDTH_STEP = 4         # horizontal down-sampling of the network: one output frame per 4 px
ZWJ = "‍"
HAL = "්"         # Sinhala hal kirima (virama)


# --------------------------------------------------------------------------- photo -> ink
def ink_map(gray: np.ndarray) -> np.ndarray:
    """Grayscale photo or scan (paper light, ink dark) -> float32 ink image in 0..1.

    The paper brightness is estimated locally (grey-scale closing removes the
    strokes), so shadows and uneven lamp light disappear. Marks much fainter
    than the pen strokes - ruled notebook lines, show-through - are dropped.
    """
    if gray.ndim == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    scale = min(1.0, 1000.0 / max(h, w))
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else gray
    k = max(9, int(round(min(small.shape[:2]) * 0.05)) | 1)
    k = min(k, 41)
    paper = cv2.morphologyEx(small, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    paper = cv2.GaussianBlur(paper, (0, 0), k / 2)
    if scale < 1:
        paper = cv2.resize(paper, (w, h), interpolation=cv2.INTER_LINEAR)
    paper = np.maximum(paper.astype(np.float32), 1.0)
    ink = np.clip((paper - gray.astype(np.float32)) / paper, 0.0, 1.0)
    strong = ink[ink > 0.08]
    if strong.size < 20:
        return np.zeros_like(ink)
    stroke = float(np.percentile(strong, 90))          # darkness of a typical pen stroke
    return np.clip((ink / max(stroke, 0.05) - 0.3) / 0.45, 0.0, 1.0)


def remove_rules(ink: np.ndarray) -> np.ndarray:
    """Erase long horizontal rules (form lines, notebook lines that survived ``ink_map``)."""
    h, w = ink.shape
    mask = (ink > 0.35).astype(np.uint8)
    length = max(40, w // 6)
    rules = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (length, 1)))
    if not rules.any():
        return ink
    rules = cv2.dilate(rules, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3)))
    out = ink.copy()
    out[rules > 0] = 0.0
    return out


def straighten(ink: np.ndarray, max_angle: float = 12.0) -> tuple[np.ndarray, float]:
    """Rotate the block so its text lines are horizontal; returns (ink, angle in degrees).

    Handwritten lines usually climb or fall across the page. The angle is the
    rotation that makes the row profile sharpest (text rows vs. gaps).
    """
    h, w = ink.shape
    scale = min(1.0, 500.0 / max(h, w))
    small = cv2.resize(ink, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else ink
    small = (remove_rules(small) > 0.3).astype(np.float32)
    if small.sum() < 30:
        return ink, 0.0
    sh, sw = small.shape

    def sharpness(angle: float) -> float:
        m = cv2.getRotationMatrix2D((sw / 2, sh / 2), angle, 1.0)
        rows = cv2.warpAffine(small, m, (sw, sh), flags=cv2.INTER_LINEAR).sum(axis=1)
        return float(np.square(np.diff(rows)).sum())

    coarse = max(np.arange(-max_angle, max_angle + 0.01, 1.0), key=sharpness)
    angle = float(max(np.arange(coarse - 0.75, coarse + 0.76, 0.25), key=sharpness))
    if abs(angle) < 0.4:
        return ink, 0.0
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(ink, m, (w, h), flags=cv2.INTER_LINEAR), round(angle, 2)


def _runs(active: np.ndarray) -> list[tuple[int, int]]:
    runs, start = [], None
    for y, on in enumerate(list(active) + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            runs.append((start, y))
            start = None
    return runs


def find_lines(ink: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Text-line boxes (x0, y0, x1, y1), top to bottom, from a straightened ink image."""
    h, w = ink.shape
    mask = (remove_rules(ink) > 0.35).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    profile = mask.sum(axis=1).astype(np.float32)
    if profile.max() <= 0:
        return []
    smooth = cv2.GaussianBlur(profile[:, None], (1, 0), sigmaX=0.1, sigmaY=max(1.5, h / 250))[:, 0]
    peak = float(np.percentile(smooth[smooth > 0], 90))
    # Line height from the dense cores of the lines (ascenders and descenders excluded).
    cores = [b - a for a, b in _runs(smooth > 0.4 * peak) if b - a >= 4]
    typical = 2.0 * float(np.median(cores)) if cores else h
    lines = []
    pending = [r for r in _runs(smooth > max(1.0, 0.08 * peak)) if r[1] - r[0] >= max(5, 0.25 * typical)]
    while pending:  # lines whose ascenders/descenders touch: cut at the weakest row between them
        a, b = pending.pop()
        lo, hi = a + int(0.5 * typical), b - int(0.5 * typical)
        if b - a > 1.7 * typical and hi > lo:
            cut = lo + int(np.argmin(smooth[lo:hi]))
            if smooth[cut] < 0.45 * smooth[a:b].max():
                pending += [(a, cut), (cut, b)]
                continue
        lines.append((a, b))
    boxes = []
    for a, b in sorted(lines):
        pad = max(2, (b - a) // 6)
        cols = np.where(mask[a:b].sum(axis=0) > 0)[0]
        if cols.size < 3:
            continue
        boxes.append((max(int(cols[0]) - pad, 0), max(a - pad, 0), min(int(cols[-1]) + pad + 1, w), min(b + pad, h)))
    return boxes


def text_box(ink: np.ndarray) -> tuple[int, int, int, int] | None:
    """Box (x0, y0, x1, y1) around the writing of a line crop.

    Form lines, box edges and dotted rules must not decide how large the text is
    drawn, so the box is taken from stroke-like connected components only; small
    marks next to it (full stops, commas) are kept by widening the box a little.
    """
    full = (ink > 0.35).astype(np.uint8)
    h, w = full.shape
    # Straight rules first (they may cross and form one large component): no pen stroke of a letter
    # runs level for half the crop, or upright over the whole height of a wide crop.
    mask = full.copy()
    sizes = [(max(48, int(min(2.5 * h, 0.6 * w))), 1)] + ([(1, max(12, int(0.9 * h)))] if w > 2 * h else [])
    for size in sizes:
        rule = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, size))
        mask[cv2.dilate(rule, np.ones((3, 3), np.uint8)) > 0] = 0

    def strokes(m: np.ndarray) -> list[tuple[int, int, int, int]]:
        stats = cv2.connectedComponentsWithStats(m, connectivity=8)[2]
        out = []
        for x, y, cw, ch, area in stats[1:]:
            thin = max(4, h // 12)
            if area >= max(10, h * h // 400) and not (cw > 12 * ch and ch <= thin) and not (ch > 12 * cw and cw <= thin):
                out.append((x, y, x + cw, y + ch))
        return out

    keep = strokes(mask) or strokes(full)   # a lone "1" or dash is all rule: keep it rather than nothing
    if not keep:
        return None
    x0, y0 = min(k[0] for k in keep), min(k[1] for k in keep)
    x1, y1 = max(k[2] for k in keep), max(k[3] for k in keep)
    grow = int(0.35 * (y1 - y0))
    return max(x0 - grow, 0), max(y0 - 1, 0), min(x1 + grow, w), min(y1 + 1, h)


def prepare_line(ink: np.ndarray, height: int = LINE_H) -> np.ndarray:
    """Ink crop of one text line (0..1 or 0..255, ink bright) -> float32 (1, height, W), W a multiple of 4."""
    ink = ink.astype(np.float32)
    if ink.max() > 1.5:
        ink /= 255.0
    box = text_box(ink)
    if box is None:
        return np.zeros((1, height, WIDTH_STEP * 8), np.float32)
    ink = ink[box[1]:box[3], box[0]:box[2]]
    h, w = ink.shape
    body = height - 8                                   # 4 px of paper above and below the writing
    new_w = int(np.clip(round(w * body / h), 8, MAX_LINE_W - 16))
    img = cv2.resize(ink, (new_w, body), interpolation=cv2.INTER_AREA if h > body else cv2.INTER_LINEAR)
    full_w = int(np.ceil((new_w + 16) / WIDTH_STEP) * WIDTH_STEP)
    out = np.zeros((height, full_w), np.float32)
    out[4:4 + body, 8:8 + new_w] = np.clip(img, 0.0, 1.0)
    return out[None]


# --------------------------------------------------------------------------- text <-> labels
def to_target(text: str) -> str:
    """Text as the network learns it: NFC, single spaces, no zero-width joiners."""
    text = unicodedata.normalize("NFC", text).replace(ZWJ, "").replace("‌", "")
    return " ".join(text.split())


def restore_joiners(text: str) -> str:
    """Put back the joiner of Sinhala conjuncts (ක්‍ර, ව්‍ය): hal + ZWJ before ර / ය, except after ර (කාර්ය)."""
    out = []
    for i, ch in enumerate(text):
        out.append(ch)
        if ch == HAL and i + 1 < len(text) and text[i + 1] in "රය" and i > 0 and text[i - 1] != "ර":
            out.append(ZWJ)
    return "".join(out)


# --------------------------------------------------------------------------- recogniser
class HandwritingRecognizer:
    def __init__(self, model_path: Path = MODEL_PATH, meta_path: Path = META_PATH):
        import onnxruntime as ort

        self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        self.meta = json.loads(meta_path.read_text(encoding="utf-8"))
        self.charset: list[str] = self.meta["charset"]   # index 0 is the CTC blank
        self.input_name = self.session.get_inputs()[0].name

    def read_lines(self, lines: list[np.ndarray]) -> list[dict]:
        """Ink crops -> [{"text", "confidence", "words": [{"text", "conf"}]}] (confidence 0..100 like Tesseract)."""
        out = []
        for ink in lines:  # one by one: no padding, so a short line is not read through blank paper
            logits = self.session.run(None, {self.input_name: prepare_line(ink)[None]})[0][0]
            out.append(decode(logits, self.charset))
        return out


NUMBER_MIN_DIGITS = 3     # "10118", "230/5": a token with this many digits ...
NUMBER_DIGIT_SHARE = 0.6  # ... that is mostly digits is read as a number
DIGIT_PLAUSIBLE = 0.15    # a letter inside it gives way to a digit the network also considered


def decode(logits: np.ndarray, charset: list[str]) -> dict:
    """Greedy CTC decoding of one line (frames x classes) into words with a confidence each.

    A handwritten 1 and l, or 0 and O, are the same stroke. Inside a token that is clearly a
    number, a letter is therefore replaced by the best digit when the network gave that digit
    real weight for the same strokes; the word keeps that (low) probability as its confidence,
    so the officer is asked to check it.
    """
    logits = logits - logits.max(axis=1, keepdims=True)
    probs = np.exp(logits)
    probs /= probs.sum(axis=1, keepdims=True)
    best = probs.argmax(axis=1)
    digit_ids = [i for i, c in enumerate(charset) if c in "0123456789"]
    marks, prev = [], 0            # [character, probability, first frame, frame after the last]
    for t, idx in enumerate(best):
        if idx != 0 and idx != prev:
            marks.append([charset[idx], float(probs[t, idx]), t, t + 1])
        elif idx != 0:
            marks[-1][1], marks[-1][3] = max(marks[-1][1], float(probs[t, idx])), t + 1
        prev = idx
    words, cur = [], []
    for mark in marks + [[" ", 1.0, 0, 0]]:
        if mark[0] != " ":
            cur.append(mark)
            continue
        if cur:
            digits = sum(m[0].isdigit() for m in cur)
            letters = [m for m in cur if m[0].isalpha()]
            if digit_ids and letters and digits >= NUMBER_MIN_DIGITS and digits >= NUMBER_DIGIT_SHARE * (digits + len(letters)):
                for m in letters:
                    span = probs[m[2]:m[3]][:, digit_ids].max(axis=0)
                    if span.max() >= DIGIT_PLAUSIBLE:
                        m[0], m[1] = charset[digit_ids[int(span.argmax())]], float(span.max())
            words.append({"text": restore_joiners("".join(m[0] for m in cur)), "conf": round(100 * min(m[1] for m in cur), 1)})
        cur = []
    confidence = round(float(np.mean([w["conf"] for w in words])), 1) if words else 0.0
    return {"text": " ".join(w["text"] for w in words), "confidence": confidence, "words": words}


@lru_cache(maxsize=1)
def get_recognizer() -> HandwritingRecognizer | None:
    if not MODEL_PATH.exists() or not META_PATH.exists():
        log.warning("handwriting model not found at %s", MODEL_PATH)
        return None
    try:
        return HandwritingRecognizer()
    except Exception as exc:  # noqa: BLE001
        log.warning("could not load handwriting model: %s", exc)
        return None
