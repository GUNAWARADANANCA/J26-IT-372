"""Address-capture benchmark: B1 (basic Tesseract + rules) vs P1 (assisted pipeline) vs P1+HW.

P1 is run with Tesseract only (``writing="printed"``), as the configuration was defined.
P1+HW is the same pipeline with the handwriting recogniser allowed to answer (``writing="auto"``).

    ml/.venv/Scripts/python ml/evaluation/ocr_benchmark.py [--set Datasets/processed/synthetic_envelopes] [--split test]

Requires Tesseract with the sin, tam and eng language packs (see
Documents/Setup_and_Run_Guide.md). Works on any folder that has an
``annotations.jsonl`` in the format written by ml/synthetic_envelopes/generate.py
- use the same format for the real, consented envelope set.

Metrics (proposal 3.5 / 3.7), reported overall and by script x style:
  * CER  = (substitutions + deletions + insertions) / reference characters, on the
           recipient text (whitespace-normalised, Unicode NFC)
  * required-field exact match (name, house number, street, city, postcode)
    *before* officer correction
  * unsupported changes: digits in a suggested field that are absent from the reference
  * median processing time per image

Output: ml/reports/ocr_benchmark/<set>_<split>.json and REPORT.md
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_ROOT, PROCESSED, REPORTS, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.text import digits_in  # noqa: E402
from app.services.ocr.pipeline import run_ocr, tesseract_info  # noqa: E402

REQUIRED = ["name", "house_number", "street", "city", "postcode"]
CONFIGS = {"B1": {"mode": "B1"}, "P1": {"mode": "P1", "writing": "printed"}, "P1+HW": {"mode": "P1", "writing": "auto"}}


def canon(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text or "").replace(",", " ").split())


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def evaluate(record: dict, result: dict) -> dict:
    ref, hyp = canon(record["recipient_text"]), canon(result.get("text", ""))
    fields = result["parse"]["fields"]
    truth = record["recipient"]
    present = [f for f in REQUIRED if truth.get(f)]
    exact = sum(canon(fields.get(f, "")).lower() == canon(truth[f]).lower() for f in present)
    ref_digits = set(digits_in(record["recipient_text"]))
    unsupported = sum(1 for f in fields.values() for d in digits_in(f) if d not in ref_digits)
    return {"cer": levenshtein(ref, hyp) / max(len(ref), 1), "fields_exact": exact, "fields_total": len(present),
            "unsupported_digits": unsupported, "ms": result["timings"]["total_ms"],
            "script_detected": (result.get("script") or {}).get("script"), "reader": result.get("reader", "tesseract")}


def summarise(rows: list[dict]) -> dict:
    return {
        "n": len(rows),
        "cer_median": round(statistics.median(r["cer"] for r in rows), 4),
        "cer_mean": round(statistics.fmean(r["cer"] for r in rows), 4),
        "required_field_exact_match": round(sum(r["fields_exact"] for r in rows) / max(1, sum(r["fields_total"] for r in rows)), 4),
        "unsupported_digit_changes": sum(r["unsupported_digits"] for r in rows),
        "median_ms": statistics.median(r["ms"] for r in rows),
        "read_by_handwriting_model": round(sum(r["reader"] == "handwriting" for r in rows) / max(len(rows), 1), 4),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--set", type=Path, default=PROCESSED / "synthetic_envelopes")
    ap.add_argument("--split", default="test", help="dev | val | test | all (freeze settings before using test)")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    info = tesseract_info()
    if not info.get("available"):
        sys.exit(f"Tesseract is not available: {info.get('reason')}. Install it first (see Documents/Setup_and_Run_Guide.md).")
    if info.get("missing_languages"):
        print(f"WARNING: missing Tesseract language packs {info['missing_languages']} - results for those scripts are invalid")

    records = [json.loads(l) for l in (args.set / "annotations.jsonl").open(encoding="utf-8")]
    if args.split != "all":
        records = [r for r in records if r["split"] == args.split]
    if args.limit:
        records = records[: args.limit]
    per_config = {name: [] for name in CONFIGS}
    for i, rec in enumerate(records, 1):
        data = (args.set / rec["file"]).read_bytes()
        for mode, options in CONFIGS.items():
            t0 = time.perf_counter()
            result = run_ocr(data, **options)
            result["timings"]["total_ms"] = round((time.perf_counter() - t0) * 1000)
            per_config[mode].append({**evaluate(rec, result), "script": rec["script"], "style": rec["style"]})
        if i % 20 == 0:
            print(f"  {i}/{len(records)} images")

    report = {"set": str(args.set), "split": args.split, "tesseract": info.get("version"), "configs": {}}
    for mode, rows in per_config.items():
        groups = defaultdict(list)
        for r in rows:
            groups[f"{r['script']}/{r['style']}"].append(r)
        report["configs"][mode] = {"overall": summarise(rows), "by_group": {k: summarise(v) for k, v in sorted(groups.items())}}
        if mode == "P1":
            ok = [r for r in rows if r["script_detected"] in ("si", "ta", "en", "mixed")]
            report["configs"][mode]["script_id_agreement"] = round(
                sum(r["script_detected"] == r["script"] for r in ok) / max(len(ok), 1), 4)

    out = REPORTS / "ocr_benchmark"
    ensure(out)
    name = f"{args.set.name}_{args.split}"
    (out / f"{name}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    lines = [f"# OCR benchmark - {args.set.name} ({args.split}, {len(records)} images, Tesseract {info.get('version')})", "",
             "| Config | CER (median) | Required-field exact match | Unsupported digit changes | Median time (ms) |",
             "|---|---|---|---|---|"]
    for mode, res in report["configs"].items():
        o = res["overall"]
        lines.append(f"| {mode} | {o['cer_median']:.3f} | {o['required_field_exact_match']:.3f} | {o['unsupported_digit_changes']} | {o['median_ms']} |")
    lines += ["", "| Group | B1 field EM | P1 field EM | P1+HW field EM | B1 CER | P1 CER | P1+HW CER | read by handwriting model |",
              "|---|---|---|---|---|---|---|---|"]
    for g in report["configs"]["P1"]["by_group"]:
        b, p, h = (report["configs"][c]["by_group"][g] for c in ("B1", "P1", "P1+HW"))
        lines.append(f"| {g} | {b['required_field_exact_match']:.3f} | {p['required_field_exact_match']:.3f} | "
                     f"{h['required_field_exact_match']:.3f} | {b['cer_median']:.3f} | {p['cer_median']:.3f} | {h['cer_median']:.3f} | "
                     f"{h['read_by_handwriting_model']:.0%} |")
    lines += ["", "Field accuracy is measured *before* officer correction. Report synthetic results as pipeline validation only."]
    (out / f"{name}_REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
