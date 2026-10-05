"""Analyse IoT-scale reference-mass trials (proposal 3.9, SO2: MAE <= 1 g over 5-500 g).

    ml/.venv/Scripts/python ml/evaluation/weighing_analysis.py path/to/SCALECAM-01_trials.csv

Input: the CSV downloaded from the "IoT scale" page (or filled by hand from
Datasets/templates/weighing_trials_template.csv) with at least
``reference_g`` and ``reading_g`` (optional ``condition``).

Output (ml/reports/weighing/):
  * per reference mass: n, mean error (bias), standard deviation (repeatability), max |error|
  * overall MAE, worst error, linear fit (reading = a * reference + b)
  * expanded uncertainty U (k = 2) = 2 * sqrt(max|bias|^2 + max(sd)^2)  - a simple,
    conservative GUM-style combination of systematic and random components.
    Enter U on the IoT page ("Expanded uncertainty"); the tariff engine then asks
    for a reweigh whenever [w - U, w + U] crosses a postage-band boundary.
  * pass/fail against the 1 g MAE target, and a reminder that the reference
    masses' own uncertainty limits what can be claimed.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import REPORTS, ensure  # noqa: E402

OUT = REPORTS / "weighing"


def analyse(rows: list[dict]) -> dict:
    by_ref = defaultdict(list)
    for r in rows:
        by_ref[float(r["reference_g"])].append(float(r["reading_g"]))
    per = []
    for ref, readings in sorted(by_ref.items()):
        errors = [x - ref for x in readings]
        per.append({"reference_g": ref, "n": len(readings), "bias_g": round(statistics.fmean(errors), 3),
                    "sd_g": round(statistics.stdev(readings), 3) if len(readings) > 1 else 0.0,
                    "max_abs_error_g": round(max(abs(e) for e in errors), 3)})
    all_err = [float(r["reading_g"]) - float(r["reference_g"]) for r in rows]
    xs = [float(r["reference_g"]) for r in rows]
    ys = [float(r["reading_g"]) for r in rows]
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx if sxx else float("nan")
    intercept = my - slope * mx
    max_bias = max(abs(p["bias_g"]) for p in per)
    max_sd = max(p["sd_g"] for p in per)
    u = 2 * math.sqrt(max_bias ** 2 + max_sd ** 2)
    by_condition = defaultdict(list)
    for r in rows:
        by_condition[r.get("condition") or "unspecified"].append(abs(float(r["reading_g"]) - float(r["reference_g"])))
    mae = statistics.fmean(abs(e) for e in all_err)
    return {
        "n_trials": len(rows), "reference_points": len(per), "per_reference": per,
        "mae_g": round(mae, 3), "worst_abs_error_g": round(max(abs(e) for e in all_err), 3),
        "linear_fit": {"slope": round(slope, 6), "intercept_g": round(intercept, 3)},
        "mae_by_condition": {k: round(statistics.fmean(v), 3) for k, v in by_condition.items()},
        "expanded_uncertainty_g_k2": round(max(u, 0.1), 2),
        "target_mae_g": 1.0, "meets_target": mae <= 1.0,
        "protocol_complete": len(per) >= 10 and min(p["n"] for p in per) >= 10,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path)
    args = ap.parse_args()
    rows = list(csv.DictReader(args.csv.open(encoding="utf-8")))
    if len(rows) < 3:
        sys.exit("need at least 3 trials")
    res = analyse(rows)
    ensure(OUT)
    stem = args.csv.stem
    (OUT / f"{stem}_analysis.json").write_text(json.dumps(res, indent=2), encoding="utf-8")
    lines = [f"# Weighing trial analysis - {args.csv.name}", "",
             f"* Trials: {res['n_trials']} at {res['reference_points']} reference masses "
             f"(protocol 10 x 10 {'complete' if res['protocol_complete'] else 'NOT complete'})",
             f"* Mean absolute error: **{res['mae_g']} g** (target <= 1 g: {'met' if res['meets_target'] else 'NOT met'})",
             f"* Worst error: {res['worst_abs_error_g']} g; linear fit reading = {res['linear_fit']['slope']} x reference "
             f"+ {res['linear_fit']['intercept_g']} g",
             f"* Expanded uncertainty U (k=2): **{res['expanded_uncertainty_g_k2']} g** -> enter on the IoT scale page",
             "", "| Reference (g) | n | Bias (g) | SD (g) | Max abs error (g) |", "|---|---|---|---|---|"]
    lines += [f"| {p['reference_g']} | {p['n']} | {p['bias_g']} | {p['sd_g']} | {p['max_abs_error_g']} |" for p in res["per_reference"]]
    lines += ["", "MAE by condition: " + ", ".join(f"{k} {v} g" for k, v in res["mae_by_condition"].items()), "",
              "The claim is only as good as the reference: state the reference masses' class/tolerance (or the approved",
              "scale used as reference) next to these numbers. A DIY scale is a research demonstrator, not a legal-for-trade",
              "instrument (OIML R 76-1)."]
    (OUT / f"{stem}_REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
