"""Envelope OCR pipelines compared in the address-capture experiment (proposal 3.7).

B0  manual entry from the image (no OCR - handled entirely by the UI)
B1  current Tesseract, all three language packs, grayscale only, simple
    rule-based field splitting, mandatory officer review
P1  image-quality gate -> crop / rotation -> deskew -> line segmentation ->
    script identification (trained CNN) -> Tesseract with the selected
    language pack -> trained CRF field tagger with per-field confidence and
    gazetteer checks -> mandatory officer review

Tesseract is a printed-text engine. In P1 a handwritten block is read by the
trained handwriting recogniser instead (htr.py): writing="handwritten" forces
it, "printed" keeps Tesseract, and "auto" lets the more confident of the two
readers win, unless Tesseract is already sure of the block.

All configurations return the same structure so the counter UI and the
evaluation scripts can treat them identically. OCR text is a *suggestion*:
it is stored separately from officer-confirmed fields.
"""
from __future__ import annotations

import os
import shutil
import time
from functools import lru_cache

import cv2
import numpy as np

from ...config import get_settings
from ..address.parser import _rule_labels, fields_from_labels, parse_address
from ..address.text import dominant_script, normalize_text, tokenize
from .htr import find_lines, get_recognizer, ink_map, straighten
from .quality import assess_quality
from .script_id import TESSERACT_LANG, get_script_identifier


class OcrUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def tesseract_info() -> dict:
    try:
        import pytesseract
    except ImportError:
        return {"available": False, "reason": "pytesseract not installed"}
    cmd = get_settings().tesseract_cmd or shutil.which("tesseract") or ""
    if not cmd:
        default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        cmd = default if os.path.exists(default) else ""
    if not cmd:
        return {"available": False, "reason": "Tesseract executable not found; install it and set TESSERACT_CMD"}
    pytesseract.pytesseract.tesseract_cmd = cmd
    try:
        version = str(pytesseract.get_tesseract_version())
        langs = sorted(pytesseract.get_languages(config=""))
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "reason": f"Tesseract could not be started: {exc}"}
    missing = [l for l in ("sin", "tam", "eng") if l not in langs]
    return {"available": True, "cmd": cmd, "version": version, "languages": langs, "missing_languages": missing}


def decode_image(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("not a readable image (JPEG/PNG expected)")
    return img


def apply_crop_rotation(img: np.ndarray, crop: dict | None, rotate: int = 0) -> np.ndarray:
    """``crop`` uses fractions of width/height: {x, y, w, h} in 0..1."""
    if rotate % 360:
        img = np.ascontiguousarray(np.rot90(img, k=-(rotate // 90) % 4))
    if crop:
        h, w = img.shape[:2]
        x0, y0 = int(max(0, crop["x"]) * w), int(max(0, crop["y"]) * h)
        x1, y1 = int(min(1, crop["x"] + crop["w"]) * w), int(min(1, crop["y"] + crop["h"]) * h)
        if x1 - x0 > 10 and y1 - y0 > 10:
            img = img[y0:y1, x0:x1]
    return img


def deskew(gray: np.ndarray) -> tuple[np.ndarray, float]:
    _, ink = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    lines = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3)))
    contours, _ = cv2.findContours(lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    angles, weights = [], []
    for c in contours:
        (cx, cy), (rw, rh), a = cv2.minAreaRect(c)
        if rw < rh:
            rw, rh, a = rh, rw, a - 90
        if rw > 3 * rh and rw > gray.shape[1] * 0.1:
            angles.append(a)
            weights.append(rw)
    if not angles:
        return gray, 0.0
    angle = float(np.average(angles, weights=weights))
    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray, 0.0
    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE), round(angle, 2)


def segment_lines(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Text-line boxes (x0, y0, x1, y1) from a horizontal projection profile."""
    _, ink = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    profile = (ink > 0).sum(axis=1)
    active = profile > max(2, 0.01 * gray.shape[1])
    boxes, start = [], None
    for y, on in enumerate(list(active) + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start >= 6:
                cols = np.where(ink[start:y].max(axis=0) > 0)[0]
                if cols.size:
                    pad = max(2, (y - start) // 4)
                    boxes.append((max(cols[0] - pad, 0), max(start - pad, 0),
                                  min(cols[-1] + pad, gray.shape[1]), min(y + pad, gray.shape[0])))
            start = None
    return boxes


def _tesseract_words(gray: np.ndarray, lang: str) -> tuple[str, list[dict]]:
    import pytesseract
    data = pytesseract.image_to_data(gray, lang=lang, config="--oem 1 --psm 6",
                                     output_type=pytesseract.Output.DICT)
    words, lines = [], {}
    for i, text in enumerate(data["text"]):
        if not text.strip():
            continue
        conf = float(data["conf"][i])
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        word = {"text": text, "conf": round(conf, 1), "line_key": key,
                "box": [data["left"][i], data["top"][i], data["width"][i], data["height"][i]]}
        words.append(word)
        lines.setdefault(key, []).append(text)
    return "\n".join(" ".join(ws) for ws in lines.values()), words


TESSERACT_SURE = 80.0   # mean word confidence above which a block counts as cleanly printed


def _mean_conf(words: list[dict]) -> float:
    conf = [w["conf"] for w in words if w["conf"] >= 0]
    return round(float(np.mean(conf)), 1) if conf else 0.0


def flag_uncertain_fields(parse: dict, words: list[dict], low_conf: float) -> None:
    """A field built from a word the reader was unsure of must be checked, however sure the parser is of its role."""
    strip = ",.;:"
    seen: dict[str, float] = {}
    for w in words:
        key = w["text"].strip(strip)
        if key and w["conf"] >= 0:
            seen[key] = min(seen.get(key, 100.0), w["conf"])
    for field, value in parse["fields"].items():
        conf = [seen[t.strip(strip)] for t in value.split() if t.strip(strip) in seen]
        if conf and min(conf) < low_conf:
            parse["confidence"][field] = round(min(parse["confidence"].get(field, 1.0), min(conf) / 100), 4)
            if field not in parse["needs_review"]:
                parse["needs_review"].append(field)


def read_handwriting(gray: np.ndarray) -> dict | None:
    """Read a handwritten block line by line; None when the model is not installed."""
    recognizer = get_recognizer()
    if recognizer is None:
        return None
    ink, angle = straighten(ink_map(gray))
    boxes = find_lines(ink)
    lines = recognizer.read_lines([ink[y0:y1, x0:x1] for x0, y0, x1, y1 in boxes])
    words = [{"text": w["text"], "conf": w["conf"], "box": [x0, y0, x1 - x0, y1 - y0]}   # box of the word's line
             for (x0, y0, x1, y1), line in zip(boxes, lines) for w in line["words"]]
    return {"text": "\n".join(line["text"] for line in lines if line["text"]), "words": words, "line_boxes": boxes,
            "deskew_angle": angle, "mean_conf": _mean_conf(words), "trained_at": recognizer.meta.get("trained_at")}


def _read_printed(gray: np.ndarray, script_hint: str, info: dict, timings: dict, t0: float) -> dict:
    """The printed-text path of P1: deskew, line boxes, script identification, Tesseract."""
    gray, angle = deskew(gray)
    boxes = segment_lines(gray)
    line_imgs = [gray[y0:y1, x0:x1] for x0, y0, x1, y1 in boxes]
    timings["preprocess_ms"] = round((time.perf_counter() - t0) * 1000)
    if script_hint in TESSERACT_LANG:
        script = {"script": script_hint, "primary": script_hint, "confidence": 1.0, "source": "officer",
                  "tesseract_lang": TESSERACT_LANG[script_hint] + ("" if script_hint == "en" else "+eng")}
    else:
        ident = get_script_identifier()
        if ident is None or not line_imgs:
            script = {"script": "unknown", "source": "fallback", "tesseract_lang": "eng+sin+tam"}
        else:
            script = {**ident.predict_block(line_imgs), "source": "model"}
    timings["script_id_ms"] = round((time.perf_counter() - t0) * 1000) - timings["preprocess_ms"]
    lang = "+".join(l for l in script["tesseract_lang"].split("+") if l in info["languages"]) or "eng"
    t1 = time.perf_counter()
    text, words = _tesseract_words(gray, lang)
    timings["ocr_ms"] = round((time.perf_counter() - t1) * 1000)
    return {"text": text, "words": words, "line_boxes": boxes, "deskew_angle": angle, "script": script, "lang": lang,
            "mean_conf": _mean_conf(words)}


def run_ocr(data: bytes, *, mode: str = "P1", crop: dict | None = None, rotate: int = 0,
            script_hint: str = "auto", writing: str = "auto", low_conf: float = 60.0) -> dict:
    info = tesseract_info()
    handwriting_only = mode == "P1" and writing != "printed" and not info.get("available") and get_recognizer() is not None
    if not info.get("available") and not handwriting_only:
        raise OcrUnavailable(info.get("reason", "Tesseract unavailable"))
    timings, t0 = {}, time.perf_counter()
    img = apply_crop_rotation(decode_image(data), crop, rotate)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    result: dict = {"mode": mode, "engine": {"tesseract": info.get("version")}}

    if mode == "B1":
        lang = "+".join(l for l in ("eng", "sin", "tam") if l in info["languages"])
        text, words = _tesseract_words(gray, lang)
        timings["ocr_ms"] = round((time.perf_counter() - t0) * 1000)
        norm = normalize_text(text)
        tokens = tokenize(norm)
        labels = _rule_labels(tokens) if tokens else []
        fields, _ = fields_from_labels(norm, tokens, labels)
        result.update(engine={**result["engine"], "lang": lang, "parser": "rules"}, text=norm, words=words,
                      parse={"fields": fields, "confidence": {}, "needs_review": list(fields), "engine": "rules"})
    else:
        quality = assess_quality(img)
        result.update(quality=quality, writing=writing, readers={})
        printed = None
        if writing != "handwritten" and not handwriting_only:
            printed = _read_printed(gray, script_hint, info, timings, t0)
            result["readers"]["tesseract"] = {"mean_conf": printed["mean_conf"], "lang": printed["lang"]}
        hand = None
        if printed is None or (writing == "auto" and printed["mean_conf"] < TESSERACT_SURE):
            t1 = time.perf_counter()
            hand = read_handwriting(gray)
            timings["handwriting_ms"] = round((time.perf_counter() - t1) * 1000)
            if hand is not None:
                result["readers"]["handwriting"] = {"mean_conf": hand["mean_conf"]}
        if hand is not None and (printed is None or hand["mean_conf"] >= printed["mean_conf"]):
            script = dominant_script(hand["text"])
            read = {**hand, "script": {"script": script, "primary": script, "confidence": round(hand["mean_conf"] / 100, 4),
                                       "source": "handwriting model"}}
            result.update(reader="handwriting", engine={**result["engine"], "handwriting": hand["trained_at"]})
        elif printed is not None:
            read = printed
            result.update(reader="tesseract", engine={**result["engine"], "lang": printed["lang"]})
        else:
            raise OcrUnavailable("the handwriting model is not installed (backend/models/htr.onnx): "
                                 "train it with ml/htr/train.py, or choose Printed")
        parse = parse_address(read["text"])
        if result["reader"] == "handwriting":
            flag_uncertain_fields(parse, read["words"], low_conf)
        result.update(engine={**result["engine"], "parser": parse["engine"]}, text=parse.get("normalized_text", read["text"]),
                      words=read["words"], deskew_angle=read["deskew_angle"], line_boxes=read["line_boxes"],
                      script=read["script"], parse={k: parse[k] for k in ("fields", "confidence", "needs_review", "engine",
                                                                         "checks", "derived", "tokens", "review_threshold")})
    result["low_confidence_words"] = [w["text"] for w in result.get("words", []) if 0 <= w["conf"] < low_conf]
    timings["total_ms"] = round((time.perf_counter() - t0) * 1000)
    result["timings"] = timings
    for w in result.get("words", []):
        w.pop("line_key", None)
    return result
