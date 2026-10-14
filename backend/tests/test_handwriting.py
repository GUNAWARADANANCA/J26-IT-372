"""Photo clean-up, line finding and reader selection for handwritten address blocks.

The recogniser itself is evaluated by ml/htr/evaluate.py on held-out handwriting; these tests
cover the deterministic steps around it and need neither the model nor Tesseract.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.services.ocr import pipeline
from app.services.ocr.htr import ZWJ, decode, find_lines, ink_map, prepare_line, restore_joiners, straighten, to_target

LINES = ["M. Imal Ayodya", "No. 230,", "Sinhapura, Hokandara,", "South. 10118"]


def notebook_photo(angle: float = 0.0) -> np.ndarray:
    """Four written lines on ruled paper under uneven light, optionally climbing across the page."""
    page = np.full((520, 900), 255, np.uint8)
    for k, text in enumerate(LINES):
        cv2.putText(page, text, (90, 110 + 95 * k), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.9, 40, 4, cv2.LINE_AA)
    m = cv2.getRotationMatrix2D((450, 260), angle, 1.0)
    page = cv2.warpAffine(page, m, (900, 520), borderValue=255)
    for y in range(40, 520, 48):                      # faint ruled lines
        page[y:y + 2] = np.minimum(page[y:y + 2], 215)
    light = np.linspace(1.0, 0.55, 900)[None, :] * np.linspace(1.0, 0.8, 520)[:, None]   # lamp on the left
    return (page * light).astype(np.uint8)


def test_ink_map_keeps_strokes_and_drops_shadow_and_ruled_lines():
    ink = ink_map(notebook_photo())
    stroke = ink[60:130, 90:500]
    assert stroke.max() > 0.9                          # pen strokes survive, also on the dark side of the page
    assert ink[70:130, 600:880].max() > 0.9 or ink[150:230, 90:400].max() > 0.9
    assert ink[40:42, 700:880].mean() < 0.05           # ruled line
    assert ink[440:500, 100:800].mean() < 0.01         # empty, shadowed paper


@pytest.mark.parametrize("angle", [0.0, -4.0, 5.0])
def test_lines_are_found_even_when_the_writing_climbs(angle):
    ink, measured = straighten(ink_map(notebook_photo(angle)))
    assert abs(measured + angle) <= 1.0                # rotated back by the opposite angle
    boxes = find_lines(ink)
    assert len(boxes) == len(LINES)
    assert all(y1 - y0 < 95 for _, y0, _, y1 in boxes)                    # one written line each (pitch 95 px)
    assert all(b[1] - a[1] > 60 for a, b in zip(boxes, boxes[1:]))       # top to bottom


def test_line_crop_is_sized_by_the_writing_not_by_form_lines():
    ink = np.zeros((120, 600), np.uint8)
    cv2.putText(ink, "Colombo 03", (150, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.2, 255, 3)
    ink[112:114, :] = 255                              # form rule far below the text
    ink[:, 590:592] = 255                              # edge of a box
    plain = prepare_line(ink)
    assert plain.shape[:2] == (1, 48) and plain.shape[2] % 4 == 0
    rows = np.where(plain[0].max(axis=1) > 0.5)[0]
    assert rows[0] <= 8 and rows[-1] >= 38             # the text fills the height
    assert plain.shape[2] < 400                        # and the crop stops near the text, not at the box edge


def test_blank_crop_gives_an_empty_line():
    assert prepare_line(np.zeros((40, 200), np.float32)).max() == 0


def test_sinhala_conjunct_joiners_are_restored():
    assert to_target("ශ්" + ZWJ + "රී  ලංකා") == "ශ්රී ලංකා"
    assert restore_joiners("ශ්රී") == "ශ්" + ZWJ + "රී"
    assert restore_joiners("අයෝධ්ය") == "අයෝධ්" + ZWJ + "ය"
    assert restore_joiners("කාර්යාලය") == "කාර්යාලය"      # hal on ර: no conjunct
    assert restore_joiners("No. 230") == "No. 230"


# --------------------------------------------------------------------------- decoding
CHARSET = [""] + list(" ,/0123456789ABlNo")


def frames(*steps: dict) -> np.ndarray:
    """Logits for a line: each step gives {character: probability}; the rest of the mass is spread thinly."""
    out = np.full((len(steps), len(CHARSET)), 1e-4)
    for t, step in enumerate(steps):
        for ch, prob in step.items():
            out[t, CHARSET.index(ch)] = prob
    return np.log(out / out.sum(axis=1, keepdims=True))


def test_a_letter_inside_a_number_gives_way_to_a_plausible_digit():
    line = decode(frames({"1": .9}, {"": .9}, {"0": .9}, {"": .9}, {"1": .9}, {"": .9}, {"l": .5, "1": .4}, {"": .9}, {"8": .9}), CHARSET)
    assert line["text"] == "10118"
    assert line["words"][0]["conf"] < 60          # stays flagged for the officer


def test_confident_letters_and_short_tokens_are_left_alone():
    unit = decode(frames({"2": .9}, {"3": .9}, {"0": .9}, {"/": .9}, {"5": .9}, {"A": .97, "4": .01}), CHARSET)
    assert unit["text"] == "230/5A"               # the network is sure of the letter
    short = decode(frames({"1": .9}, {"2": .9}, {"B": .5, "8": .4}), CHARSET)
    assert short["text"] == "12B"                 # two digits are not enough to call it a number
    word = decode(frames({"N": .9}, {"o": .9}, {" ": .9}, {"2": .9}, {"": .9}, {"2": .9}), CHARSET)
    assert [w["text"] for w in word["words"]] == ["No", "22"]


# --------------------------------------------------------------------------- which reader answers
def _reading(text: str, conf: float) -> dict:
    words = [{"text": w, "conf": conf, "box": [0, 0, 10, 10]} for w in text.split()]
    return {"text": text, "words": words, "line_boxes": [(0, 0, 10, 10)], "deskew_angle": 0.0, "mean_conf": conf,
            "script": {"script": "en", "tesseract_lang": "eng"}, "lang": "eng", "trained_at": "2026-10-11"}


@pytest.fixture
def readers(monkeypatch):
    calls = []
    state = {"printed": 50.0, "hand": 85.0}

    def printed(*args, **kwargs):
        calls.append("tesseract")
        return _reading("N0 23O Sinhapwa", state["printed"])

    def hand(gray):
        calls.append("handwriting")
        return None if state["hand"] is None else _reading("No. 230, Sinhapura", state["hand"])

    monkeypatch.setattr(pipeline, "tesseract_info", lambda: {"available": True, "version": "test", "languages": ["eng"]})
    monkeypatch.setattr(pipeline, "_read_printed", printed)
    monkeypatch.setattr(pipeline, "read_handwriting", hand)
    return state, calls


PHOTO = cv2.imencode(".jpg", np.full((200, 400, 3), 255, np.uint8))[1].tobytes()


def test_auto_takes_the_more_confident_reader(readers):
    state, calls = readers
    result = pipeline.run_ocr(PHOTO, writing="auto")
    assert result["reader"] == "handwriting" and result["text"] == "No. 230, Sinhapura"
    assert result["readers"] == {"tesseract": {"mean_conf": 50.0, "lang": "eng"}, "handwriting": {"mean_conf": 85.0}}
    assert result["script"]["source"] == "handwriting model"

    state["hand"] = 30.0
    assert pipeline.run_ocr(PHOTO, writing="auto")["reader"] == "tesseract"


def test_a_field_with_an_uncertain_word_is_flagged_for_the_officer(monkeypatch, readers):
    words = [("Nimal", 97.0), ("Perera", 96.0), ("No.", 95.0), ("230,", 96.0), ("Galle", 95.0), ("Road", 94.0), ("Hokandara", 93.0), ("10118", 40.0)]
    reading = {**_reading("", 88.0), "text": "Nimal Perera\nNo. 230, Galle Road\nHokandara\n10118",
               "words": [{"text": t, "conf": c, "box": [0, 0, 1, 1]} for t, c in words]}
    monkeypatch.setattr(pipeline, "read_handwriting", lambda gray: reading)
    parse = pipeline.run_ocr(PHOTO, writing="handwritten")["parse"]
    assert parse["fields"]["postcode"] == "10118"
    assert "postcode" in parse["needs_review"] and parse["confidence"]["postcode"] <= 0.4
    assert "name" not in parse["needs_review"] or parse["confidence"]["name"] > 0.9   # sure words are not dragged down


def test_auto_leaves_clean_print_to_tesseract(readers):
    state, calls = readers
    state["printed"] = 91.0
    result = pipeline.run_ocr(PHOTO, writing="auto")
    assert result["reader"] == "tesseract" and calls == ["tesseract"]


def test_officer_choice_overrides_auto(readers):
    state, calls = readers
    assert pipeline.run_ocr(PHOTO, writing="handwritten")["reader"] == "handwriting"
    assert calls == ["handwriting"]
    calls.clear()
    assert pipeline.run_ocr(PHOTO, writing="printed")["reader"] == "tesseract"
    assert calls == ["tesseract"]


def test_handwritten_without_the_model_is_reported(readers):
    state, calls = readers
    state["hand"] = None
    with pytest.raises(pipeline.OcrUnavailable, match="handwriting model is not installed"):
        pipeline.run_ocr(PHOTO, writing="handwritten")
    assert pipeline.run_ocr(PHOTO, writing="auto")["reader"] == "tesseract"   # auto falls back to print
