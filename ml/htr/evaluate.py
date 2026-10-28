"""Test the exported handwriting model the way the API runs it, next to Tesseract, and write the report.

    ml/.venv/Scripts/python ml/htr/evaluate.py [--iam-lines 400]

* Handwriting model: backend/models/htr.onnx through ``HandwritingRecognizer`` (ONNX Runtime, CPU).
* Baseline: Tesseract on the same lines, one line per call (``--psm 7``), Sinhala lines with
  ``sin+eng`` and English lines with ``eng`` - the language packs the P1 pipeline would choose.
  It is run twice: on the line image as scanned, and on the cleaned ink image the model gets, so the
  comparison shows what the recogniser adds beyond the photo clean-up.
* Both are scored on the published test splits (SinOCR handwritten test, IAM test); the labels are
  normalised the same way for both readers (see ``build_cache.clean_text``).

Output: ml/reports/htr/REPORT.md and evaluation.json
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import time
import zipfile
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_ROOT, HTR_DATA, REPORTS  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.ocr.htr import HandwritingRecognizer, ink_map, text_box, to_target  # noqa: E402
from app.services.ocr.pipeline import tesseract_info  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_cache import clean_text  # noqa: E402
from data import FixedLines  # noqa: E402
from train import edit_distance  # noqa: E402

OUT = REPORTS / "htr"


def test_lines(sinocr_zip: Path, iam_dir: Path, iam_lines: int) -> dict[str, list[tuple[np.ndarray, str]]]:
    """Original grayscale line images of the two real test sets."""
    import pyarrow.parquet as pq

    out = {"sinocr": [], "iam": []}
    with zipfile.ZipFile(sinocr_zip) as z:
        for row in csv.DictReader(io.TextIOWrapper(z.open("handwritten-data/test/data.csv"), encoding="utf-8")):
            data = z.read(f"handwritten-data/test/images/{row['file_name']}.png")
            out["sinocr"].append((cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE), clean_text(row["text"])))
    rows = pq.read_table(iam_dir / "test.parquet").to_pylist()
    step = max(1, len(rows) // iam_lines)   # an even sample of the whole test split
    for row in rows[::step][:iam_lines]:
        out["iam"].append((cv2.imdecode(np.frombuffer(row["image"]["bytes"], np.uint8), cv2.IMREAD_GRAYSCALE), clean_text(row["text"])))
    return out


def score(pairs: list[tuple[str, str]]) -> dict:
    """pairs = (truth, read). Characters are compared without zero-width joiners."""
    chars = sum(edit_distance(to_target(t), to_target(r)) for t, r in pairs)
    words = sum(edit_distance(to_target(t).split(), to_target(r).split()) for t, r in pairs)
    exact = sum(to_target(t) == to_target(r) for t, r in pairs)
    return {"cer": round(chars / max(sum(len(to_target(t)) for t, _ in pairs), 1), 4),
            "wer": round(words / max(sum(len(to_target(t).split()) for t, _ in pairs), 1), 4),
            "exact_lines": round(exact / max(len(pairs), 1), 4), "lines": len(pairs)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--iam-lines", type=int, default=400, help="IAM test lines to read (Tesseract needs ~0.3 s per line)")
    ap.add_argument("--sinocr", type=Path, default=HTR_DATA / "sinocr_handwritten.zip")
    ap.add_argument("--iam", type=Path, default=HTR_DATA / "iam_line")
    args = ap.parse_args()

    reader = HandwritingRecognizer()
    info = tesseract_info()
    sets = test_lines(args.sinocr, args.iam, args.iam_lines)
    results, examples = {}, {}
    for name, lines in sets.items():
        t0 = time.time()
        read = [r["text"] for r in reader.read_lines([ink_map(gray) for gray, _ in lines])]
        ms = (time.time() - t0) * 1000 / len(lines)
        results[name] = {"handwriting_model": {**score([(t, r) for (_, t), r in zip(lines, read)]), "ms_per_line": round(ms, 1)}}
        examples[name] = [{"truth": t, "handwriting_model": r} for (_, t), r in zip(lines[:8], read)]
        if info.get("available"):
            import pytesseract
            lang = "sin+eng" if name == "sinocr" else "eng"
            def tesseract(image: np.ndarray) -> str:
                return " ".join(pytesseract.image_to_string(image, lang=lang, config="--oem 1 --psm 7").split())

            def cleaned(gray: np.ndarray) -> np.ndarray:   # the model's input: ink only, cropped to the writing
                ink = ink_map(gray)
                x0, y0, x1, y1 = text_box(ink) or (0, 0, ink.shape[1], ink.shape[0])
                return cv2.copyMakeBorder(255 - (ink[y0:y1, x0:x1] * 255).astype(np.uint8), 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=255)

            t0 = time.time()
            tess = [tesseract(gray) for gray, _ in lines]
            results[name]["tesseract"] = {**score([(t, r) for (_, t), r in zip(lines, tess)]), "lang": lang,
                                          "ms_per_line": round((time.time() - t0) * 1000 / len(lines), 1)}
            clean = [tesseract(cleaned(gray)) for gray, _ in lines]
            results[name]["tesseract_cleaned"] = score([(t, r) for (_, t), r in zip(lines, clean)])
            for ex, r, c in zip(examples[name], tess, clean):
                ex["tesseract"], ex["tesseract_cleaned"] = r, c
        print(name, json.dumps(results[name]), flush=True)

    # Lines no reader has real data for: fonts the model never saw (drawn here, same seed every run).
    charset = reader.charset
    for name, script in (("ta_font", "ta"), ("en_font", "en")):
        ds = FixedLines.font(charset, "test", script, 300)
        read = [r["text"] for r in reader.read_lines([ink for ink, _, _ in ds.samples])]
        results[name] = {"handwriting_model": score([(t, r) for (_, t, _), r in zip(ds.samples, read)])}
        examples[name] = [{"truth": to_target(t), "handwriting_model": r} for (_, t, _), r in zip(ds.samples[:6], read)]
        print(name, json.dumps(results[name]), flush=True)

    meta = reader.meta
    (OUT / "evaluation.json").write_text(json.dumps({"results": results, "examples": examples, "tesseract": info.get("version"),
                                                     "model_trained_at": meta.get("trained_at")}, ensure_ascii=False, indent=1),
                                         encoding="utf-8")
    training = json.loads((OUT / "metrics.json").read_text(encoding="utf-8")) if (OUT / "metrics.json").exists() else {}

    def row(label: str, key: str) -> str:
        h, t, c = results[key]["handwriting_model"], results[key].get("tesseract"), results[key].get("tesseract_cleaned")
        base = f"{t['cer']:.1%} | {c['cer']:.1%} | {c['wer']:.1%} | {c['exact_lines']:.1%}" if t and c else "– | – | – | –"
        return f"| {label} | {h['lines']} | **{h['cer']:.1%}** | {h['wer']:.1%} | {h['exact_lines']:.1%} | {base} |"

    def sample_block(key: str) -> list[str]:
        out = []
        for ex in examples[key][:6]:
            out += [f"* truth: `{ex['truth']}`", f"  * model: `{ex['handwriting_model']}`"]
            if "tesseract_cleaned" in ex:
                out.append(f"  * Tesseract (cleaned line): `{ex['tesseract_cleaned']}`")
        return out

    lines = [
        "# Handwriting recogniser – evaluation report", "",
        f"Model trained {meta.get('trained_at')} · {meta.get('architecture')} · {meta.get('parameters', 0) / 1e6:.1f} M parameters · "
        f"best epoch {meta.get('best_epoch')} of {meta.get('epochs')} · {len(charset) - 1} characters · "
        f"ONNX, {results['sinocr']['handwriting_model']['ms_per_line']} ms per Sinhala line on CPU.",
        f"Baseline: Tesseract {info.get('version', 'not installed')}, one line per call, on the line as scanned (*raw*) and on the "
        "cleaned ink image the model receives (*cleaned*).", "",
        "## Training data", "",
        "| Script | Real handwriting | Synthetic |", "|---|---|---|",
        "| Sinhala | SinOCR handwritten: 820 training lines (88 validation, 227 test) | address text spelled with "
        "handwritten characters of the 454-class set (51,849 characters of 270 classes); printed fonts |",
        "| English | IAM lines: 6,482 training lines (976 validation, 2,915 test) | address text in handwriting-style fonts |",
        "| Tamil | **none** | fonts only |", "",
        "## Results on held-out test lines", "",
        "CER = character error rate, WER = word error rate, exact = lines read without any error.", "",
        "| Test set | Lines | Model CER | Model WER | Model exact | Tesseract CER (raw) | Tesseract CER (cleaned) | Tesseract WER (cleaned) | Tesseract exact (cleaned) |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        row("Sinhala handwriting (SinOCR test, real)", "sinocr"),
        row("English handwriting (IAM test sample, real)", "iam"),
        row("Tamil, fonts never seen in training (synthetic)", "ta_font"),
        row("English address text, handwriting-style font never seen (synthetic)", "en_font"), "",
        "## How to read these numbers", "",
        "* The two real rows are the evidence. Both test sets come from the same collections and scanning conditions as the training lines"
        "; a phone or ESP32 photo of a new writer is harder, so "
        "expect higher error at the counter. Measure it on your own consented envelope set with "
        "`ml/evaluation/ocr_benchmark.py` before quoting a figure in the thesis.",
        "* **Tamil handwriting is untested.** No real Tamil handwriting was used for training or testing; the Tamil row "
        "only shows that the network reads Tamil in unseen *fonts*.",
        "* Handwritten digits come only from fonts and the few digits in the real lines; house numbers and postcodes "
        "must always be checked by the officer. Inside a token that is clearly a number the decoder prefers a digit "
        "the network also considered (l -> 1, O -> 0) and keeps the word flagged as low confidence.",
        "* A word error rate near one half means about every second handwritten word still contains a mistake: the "
        "model saves typing, it does not replace reading the envelope.",
        "* The labels of the 454-class character set were assigned by reading sample sheets (the archive has no label "
        "file). 270 classes are used; a wrong label would add noise to the synthetic Sinhala lines only, never to a test set.",
        "* Every OCR result remains a suggestion that the counter officer confirms field by field.", "",
        "## Examples (first test lines, not selected)", "", "### Sinhala (SinOCR test)", *sample_block("sinocr"), "",
        "### English (IAM test)", *sample_block("iam"), "", "### Tamil (unseen fonts)", *sample_block("ta_font"), "",
        "## Reproduce", "", "```bash", "ml/.venv/Scripts/python ml/htr/build_cache.py",
        "ml/.venv/Scripts/python ml/htr/train.py", "ml/.venv/Scripts/python ml/htr/evaluate.py", "```",
        f"Training took {training.get('train_minutes', '?')} minutes on {training.get('device', '?')} "
        f"(PyTorch {training.get('torch', '?')}, seed {training.get('seed', '?')}).", "",
    ]
    (OUT / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print("report:", OUT / "REPORT.md")


if __name__ == "__main__":
    main()
