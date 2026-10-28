"""Train and evaluate the CRF address-field tagger.

    ml/.venv/Scripts/python ml/address_parser/train_crf.py

Protocol (mirrors proposal sections 3.3, 3.5 and 3.7):
  1. Hyper-parameters (L1/L2 regularisation) are selected on the *validation*
     split using a subsample of the training data.
  2. The final model is trained on the full training split.
  3. The review threshold for field confidence is chosen on *validation*
     (smallest threshold whose accepted fields reach the target accuracy) and
     frozen before the held-out *test* split is scored.
  4. Test results are reported overall and by script, source and noise level,
     next to a transparent rule-based baseline.

Artefacts:
  backend/models/address_crf.crfsuite      model loaded by the API
  backend/models/address_crf.meta.json     labels, feature version, threshold, test metrics
  ml/reports/address_parser/metrics.json   full results
  ml/reports/address_parser/REPORT.md      human-readable summary
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pycrfsuite

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_MODELS, BACKEND_ROOT, PROCESSED, REPORTS, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.features import FEATURE_VERSION, LABELS, sent2features  # noqa: E402
from app.services.address.lexicon import get_lexicon  # noqa: E402
from app.services.address.parser import FIELDS, _rule_labels, fields_from_labels  # noqa: E402
from app.services.address.text import normalize_text, tokenize  # noqa: E402

DATA = PROCESSED / "address_tagging"
OUT_REPORT = REPORTS / "address_parser"
REQUIRED_FIELDS = ["name", "house_number", "street", "city", "postcode"]


def load(split: str) -> list[dict]:
    with (DATA / f"{split}.jsonl").open(encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def featurize(samples: list[dict]) -> list[tuple]:
    lex = get_lexicon()
    out = []
    for s in samples:
        norm = normalize_text(s["text"])
        toks = tokenize(norm)
        if len(toks) != len(s["labels"]):
            continue
        out.append((s, norm, toks, sent2features(toks, lex)))
    return out


def train(items: list[tuple], c1: float, c2: float, path: Path, max_iter: int) -> None:
    trainer = pycrfsuite.Trainer(verbose=False)
    for s, _, _, feats in items:
        trainer.append(feats, s["labels"])
    trainer.set_params({"c1": c1, "c2": c2, "max_iterations": max_iter,
                        "feature.possible_transitions": True, "feature.minfreq": 1})
    trainer.train(str(path))


def predict(tagger: pycrfsuite.Tagger, items: list[tuple]) -> list[tuple[list[str], list[float]]]:
    preds = []
    for _, _, _, feats in items:
        labels = tagger.tag(feats)
        probs = [tagger.marginal(l, i) for i, l in enumerate(labels)]
        preds.append((labels, probs))
    return preds


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
def prf(gold: list[list[str]], pred: list[list[str]]) -> dict:
    tp, fp, fn = Counter(), Counter(), Counter()
    correct = total = 0
    for g_seq, p_seq in zip(gold, pred):
        for g, p in zip(g_seq, p_seq):
            total += 1
            correct += g == p
            if g == p:
                tp[g] += 1
            else:
                fp[p] += 1
                fn[g] += 1
    per = {}
    for lbl in LABELS:
        p = tp[lbl] / (tp[lbl] + fp[lbl]) if tp[lbl] + fp[lbl] else 0.0
        r = tp[lbl] / (tp[lbl] + fn[lbl]) if tp[lbl] + fn[lbl] else 0.0
        f = 2 * p * r / (p + r) if p + r else 0.0
        per[lbl] = {"precision": round(p, 4), "recall": round(r, 4), "f1": round(f, 4), "support": tp[lbl] + fn[lbl]}
    macro = sum(per[l]["f1"] for l in LABELS if l != "O" and per[l]["support"]) / max(
        1, sum(1 for l in LABELS if l != "O" and per[l]["support"]))
    return {"token_accuracy": round(correct / max(total, 1), 4), "macro_f1": round(macro, 4), "per_label": per}


def _canon(value: str) -> str:
    return " ".join(value.replace(",", " ").split()).lower()


def field_metrics(items: list[tuple], preds: list[tuple]) -> dict:
    """Exact match of each field string, as the officer would see it."""
    per_field = defaultdict(lambda: [0, 0])
    required_ok = required_total = all_ok = 0
    confidence_pairs = []
    for (s, norm, toks, _), (labels, probs) in zip(items, preds):
        gold, _ = fields_from_labels(norm, toks, s["labels"])
        pred, conf = fields_from_labels(norm, toks, labels, probs)
        sample_ok = True
        for f in FIELDS:
            if not gold[f] and not pred[f]:
                continue
            ok = _canon(gold[f]) == _canon(pred[f])
            per_field[f][0] += ok
            per_field[f][1] += 1
            sample_ok &= ok
            if pred[f]:
                confidence_pairs.append((conf.get(f, 0.0), ok))
            if f in REQUIRED_FIELDS and gold[f]:
                required_ok += ok
                required_total += 1
        all_ok += sample_ok
    return {
        "field_exact_match": {f: round(a / b, 4) for f, (a, b) in per_field.items() if b},
        "field_support": {f: b for f, (a, b) in per_field.items()},
        "required_field_exact_match": round(required_ok / max(required_total, 1), 4),
        "address_exact_match": round(all_ok / max(len(items), 1), 4),
        "_confidence_pairs": confidence_pairs,
    }


def calibration(pairs: list[tuple[float, bool]], bins: int = 10) -> dict:
    buckets = defaultdict(list)
    for c, ok in pairs:
        buckets[min(int(c * bins), bins - 1)].append((c, ok))
    ece, table = 0.0, []
    for b in range(bins):
        rows = buckets.get(b, [])
        if not rows:
            continue
        conf = sum(c for c, _ in rows) / len(rows)
        acc = sum(ok for _, ok in rows) / len(rows)
        ece += len(rows) / len(pairs) * abs(conf - acc)
        table.append({"bin": f"{b / bins:.1f}-{(b + 1) / bins:.1f}", "n": len(rows),
                      "mean_confidence": round(conf, 4), "accuracy": round(acc, 4)})
    return {"ece": round(ece, 4), "bins": table}


def choose_threshold(pairs: list[tuple[float, bool]], target: float) -> dict:
    """Smallest threshold t such that fields with confidence >= t are >= target accurate."""
    candidates = sorted({round(c, 3) for c, _ in pairs})
    best = None
    for t in candidates:
        accepted = [ok for c, ok in pairs if c >= t]
        if accepted and sum(accepted) / len(accepted) >= target:
            best = t
            break
    t = best if best is not None else 1.0
    return threshold_stats(pairs, t) | {"target_accuracy": target}


def threshold_stats(pairs: list[tuple[float, bool]], t: float) -> dict:
    accepted = [ok for c, ok in pairs if c >= t]
    flagged = [ok for c, ok in pairs if c < t]
    return {
        "threshold": t,
        "share_not_flagged": round(len(accepted) / max(len(pairs), 1), 4),
        "accuracy_not_flagged": round(sum(accepted) / max(len(accepted), 1), 4),
        "flagged": len(flagged),
        "accuracy_flagged": round(sum(flagged) / len(flagged), 4) if flagged else None,
        "errors_caught_by_flag": round(sum(1 for ok in flagged if not ok) /
                                       max(sum(1 for _, ok in pairs if not ok), 1), 4),
    }


def evaluate(items, preds) -> dict:
    gold = [s["labels"] for s, *_ in items]
    out = prf(gold, [p[0] for p in preds])
    out.update(field_metrics(items, preds))
    return out


def breakdown(items, preds, key) -> dict:
    groups = defaultdict(list)
    for it, pr in zip(items, preds):
        groups[key(it[0])].append((it, pr))
    result = {}
    for k, rows in sorted(groups.items()):
        ev = evaluate([r[0] for r in rows], [r[1] for r in rows])
        result[k] = {"n": len(rows), "token_accuracy": ev["token_accuracy"], "macro_f1": ev["macro_f1"],
                     "required_field_exact_match": ev["required_field_exact_match"],
                     "address_exact_match": ev["address_exact_match"]}
    return result


def strip_private(d: dict) -> dict:
    return {k: v for k, v in d.items() if not k.startswith("_")}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--grid-subsample", type=int, default=8000)
    ap.add_argument("--max-iter", type=int, default=200)
    ap.add_argument("--target-accuracy", type=float, default=0.997)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    ensure(BACKEND_MODELS, OUT_REPORT)

    t0 = time.time()
    train_items, val_items, test_items = (featurize(load(s)) for s in ("train", "val", "test"))
    print(f"featurised train={len(train_items)} val={len(val_items)} test={len(test_items)} in {time.time() - t0:.0f}s")

    # 1. hyper-parameter search on validation
    grid = [(0.05, 0.01), (0.1, 0.01), (0.1, 0.05), (0.3, 0.01), (0.5, 0.05)]
    sub = rng.sample(train_items, min(args.grid_subsample, len(train_items)))
    tmp = OUT_REPORT / "grid.crfsuite"
    grid_results = []
    for c1, c2 in grid:
        train(sub, c1, c2, tmp, args.max_iter)
        tagger = pycrfsuite.Tagger()
        tagger.open(str(tmp))
        ev = evaluate(val_items, predict(tagger, val_items))
        tagger.close()
        grid_results.append({"c1": c1, "c2": c2, "val_macro_f1": ev["macro_f1"],
                             "val_required_field_exact_match": ev["required_field_exact_match"]})
        print(f"  grid c1={c1} c2={c2}: val macro-F1={ev['macro_f1']:.4f} "
              f"required-field EM={ev['required_field_exact_match']:.4f}")
    tmp.unlink(missing_ok=True)
    best = max(grid_results, key=lambda r: (r["val_required_field_exact_match"], r["val_macro_f1"]))
    print(f"selected c1={best['c1']} c2={best['c2']}")

    # 2. final model on the full training split
    model_path = BACKEND_MODELS / "address_crf.crfsuite"
    t1 = time.time()
    train(train_items, best["c1"], best["c2"], model_path, args.max_iter)
    print(f"trained final model in {time.time() - t1:.0f}s -> {model_path}")
    tagger = pycrfsuite.Tagger()
    tagger.open(str(model_path))

    # 3. review threshold frozen on validation
    val_eval = evaluate(val_items, predict(tagger, val_items))
    thr = choose_threshold(val_eval["_confidence_pairs"], args.target_accuracy)
    print(f"review threshold (val) = {thr['threshold']} -> {thr}")

    # 4. held-out test
    test_preds = predict(tagger, test_items)
    test_eval = evaluate(test_items, test_preds)
    test_thr = threshold_stats(test_eval["_confidence_pairs"], thr["threshold"])
    curve = [{"threshold": t, **{k: v for k, v in threshold_stats(val_eval["_confidence_pairs"], t).items() if k != "threshold"}}
             for t in (0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99)]
    test_cal = calibration(test_eval["_confidence_pairs"])

    baseline_preds = [(_rule_labels(toks), [0.0] * len(toks)) for _, _, toks, _ in test_items]
    baseline_eval = evaluate(test_items, baseline_preds)

    results = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "feature_version": FEATURE_VERSION,
        "data": json.loads((DATA / "stats.json").read_text(encoding="utf-8")),
        "grid": grid_results,
        "selected": {"c1": best["c1"], "c2": best["c2"], "max_iterations": args.max_iter},
        "validation": strip_private(val_eval),
        "review_threshold": thr,
        "validation_operating_curve": curve,
        "test": strip_private(test_eval),
        "test_threshold": test_thr,
        "test_calibration": test_cal,
        "test_by_script": breakdown(test_items, test_preds, lambda s: s["script"]),
        "test_by_source": breakdown(test_items, test_preds, lambda s: s["source"]),
        "test_by_noise": breakdown(test_items, test_preds, lambda s: "ocr_noise" if s["noisy"] else "clean"),
        "baseline_rules_test": strip_private(baseline_eval),
        "baseline_rules_by_script": breakdown(test_items, baseline_preds, lambda s: s["script"]),
    }
    (OUT_REPORT / "metrics.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    meta = {
        "model_version": "address-crf-" + datetime.now(timezone.utc).strftime("%Y%m%d"),
        "trained_at": results["trained_at"],
        "feature_version": FEATURE_VERSION,
        "labels": LABELS,
        "c1": best["c1"], "c2": best["c2"],
        "review_threshold": thr["threshold"],
        "test_metrics": {
            "token_accuracy": test_eval["token_accuracy"],
            "macro_f1": test_eval["macro_f1"],
            "required_field_exact_match": test_eval["required_field_exact_match"],
            "address_exact_match": test_eval["address_exact_match"],
            "ece": test_cal["ece"],
        },
        "training_data": "Datasets/processed/address_tagging (see Datasets/README.md)",
    }
    (BACKEND_MODELS / "address_crf.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    write_report(results)
    print(json.dumps(meta["test_metrics"], indent=2))


def write_report(r: dict) -> None:
    t, b = r["test"], r["baseline_rules_test"]
    lines = [
        "# Address-field tagger (CRF) - evaluation report",
        "",
        f"Trained {r['trained_at']} | feature version `{r['feature_version']}` | "
        f"c1={r['selected']['c1']} c2={r['selected']['c2']}",
        "",
        "Splits are grouped by postal town, so every test address is in a town the model never saw in training.",
        "",
        "## Held-out test set",
        "",
        "| Metric | CRF | Rule baseline |",
        "|---|---|---|",
        f"| Token accuracy | {t['token_accuracy']:.4f} | {b['token_accuracy']:.4f} |",
        f"| Macro F1 (address labels) | {t['macro_f1']:.4f} | {b['macro_f1']:.4f} |",
        f"| Required-field exact match | {t['required_field_exact_match']:.4f} | {b['required_field_exact_match']:.4f} |",
        f"| Whole-address exact match | {t['address_exact_match']:.4f} | {b['address_exact_match']:.4f} |",
        "",
        "## By script (test)",
        "",
        "| Script | n | Token acc. | Macro F1 | Required-field EM | Address EM | Rule baseline required-field EM |",
        "|---|---|---|---|---|---|---|",
    ]
    for k, v in r["test_by_script"].items():
        bl = r["baseline_rules_by_script"].get(k, {})
        lines.append(f"| {k} | {v['n']} | {v['token_accuracy']:.4f} | {v['macro_f1']:.4f} | "
                     f"{v['required_field_exact_match']:.4f} | {v['address_exact_match']:.4f} | "
                     f"{bl.get('required_field_exact_match', 0):.4f} |")
    lines += ["", "## By source and noise (test)", "", "| Group | n | Required-field EM | Address EM |", "|---|---|---|---|"]
    for name in ("test_by_source", "test_by_noise"):
        for k, v in r[name].items():
            lines.append(f"| {k} | {v['n']} | {v['required_field_exact_match']:.4f} | {v['address_exact_match']:.4f} |")
    lines += ["", "## Field exact match (test)", "", "| Field | Exact match | Support |", "|---|---|---|"]
    for f, v in t["field_exact_match"].items():
        lines.append(f"| {f} | {v:.4f} | {t['field_support'][f]} |")
    rt, tt = r["review_threshold"], r["test_threshold"]
    lines += [
        "", "## Confidence and the review threshold", "",
        f"Threshold chosen on validation for >= {rt['target_accuracy']:.0%} accuracy of un-flagged fields: "
        f"**{rt['threshold']}**.", "",
        "| Split | Share not flagged | Accuracy not flagged | Flagged fields | Accuracy of flagged | Errors caught by flag |",
        "|---|---|---|---|---|---|",
        f"| validation | {rt['share_not_flagged']:.4f} | {rt['accuracy_not_flagged']:.4f} | {rt['flagged']} | {rt['accuracy_flagged']} | {rt['errors_caught_by_flag']:.4f} |",
        f"| test | {tt['share_not_flagged']:.4f} | {tt['accuracy_not_flagged']:.4f} | {tt['flagged']} | {tt['accuracy_flagged']} | {tt['errors_caught_by_flag']:.4f} |",
        "", "Operating curve on validation (pick a different threshold if review effort must be lower/higher):", "",
        "| Threshold | Share not flagged | Accuracy not flagged | Errors caught by flag |", "|---|---|---|---|",
        *[f"| {c['threshold']} | {c['share_not_flagged']:.4f} | {c['accuracy_not_flagged']:.4f} | {c['errors_caught_by_flag']:.4f} |"
          for c in r["validation_operating_curve"]],
        "", f"Expected calibration error on test: {r['test_calibration']['ece']:.4f}", "",
        "## Limitations", "",
        f"* **Read the real-address row first.** Template-generated synthetic addresses are easier than real mail: on the "
        f"real OpenStreetMap-derived Sri Lankan addresses the required-field exact match is "
        f"{r['test_by_source'].get('deepparse_lk', {}).get('required_field_exact_match', float('nan')):.4f} versus "
        f"{r['test_by_source'].get('synthetic', {}).get('required_field_exact_match', float('nan')):.4f} on synthetic ones.",
        "* Most Sinhala and Tamil examples are synthetic (built from public gazetteer/OSM/Wikidata resources); the",
        "  Deepparse Sri Lanka split is mostly English. Real envelope transcriptions (proposal section 3.3) must be",
        "  used for the final evaluation; this report validates the pipeline, not field performance on real mail.",
        "* OCR noise is simulated with character substitutions/deletions, not produced by a real OCR engine.",
        "* The threshold only prioritises officer attention; every field is still confirmed by the officer.",
    ]
    (OUT_REPORT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
