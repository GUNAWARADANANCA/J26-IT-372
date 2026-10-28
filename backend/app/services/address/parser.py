"""Address-field tagging: free text (OCR output or typed) -> structured fields.

The trained CRF (``backend/models/address_crf.crfsuite``) is produced by
``ml/address_parser/train_crf.py``. Per-field confidence is the minimum
marginal probability of the predicted label over the field's tokens; fields
below the review threshold (chosen on the validation split, stored in the
model metadata) are highlighted for the counter officer. Nothing is accepted
automatically: officer confirmation is always required.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .features import FEATURE_VERSION, sent2features
from .lexicon import check_city_postcode, colombo_zone_postcode
from .text import dominant_script, normalize_text, tokenize

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[3] / "models"
MODEL_PATH = MODELS_DIR / "address_crf.crfsuite"
META_PATH = MODELS_DIR / "address_crf.meta.json"

FIELD_OF_LABEL = {
    "NAME": "name", "HOUSE": "house_number", "STREET": "street", "LOCALITY": "locality",
    "CITY": "city", "REGION": "region", "POSTCODE": "postcode", "COUNTRY": "country",
}
FIELDS = list(FIELD_OF_LABEL.values())


@dataclass
class _Model:
    tagger: object
    meta: dict


@lru_cache(maxsize=1)
def _load_model() -> _Model | None:
    if not MODEL_PATH.exists():
        log.warning("address CRF model not found at %s; using rule-based fallback", MODEL_PATH)
        return None
    try:
        import pycrfsuite
    except ImportError:  # pragma: no cover - dependency listed in requirements.txt
        log.warning("python-crfsuite not installed; using rule-based fallback")
        return None
    meta = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}
    if meta.get("feature_version") not in (None, FEATURE_VERSION):
        log.warning("address CRF was trained with feature version %s but code is %s; retrain the model",
                    meta.get("feature_version"), FEATURE_VERSION)
    tagger = pycrfsuite.Tagger()
    tagger.open(str(MODEL_PATH))
    return _Model(tagger=tagger, meta=meta)


def model_info() -> dict:
    model = _load_model()
    if model is None:
        return {"available": False, "engine": "rules"}
    return {"available": True, "engine": "crf", **{k: model.meta.get(k) for k in
            ("model_version", "trained_at", "review_threshold", "test_metrics")}}


def review_threshold() -> float:
    model = _load_model()
    return float(model.meta.get("review_threshold", 0.85)) if model else 1.0


def _rule_labels(tokens) -> list[str]:
    """Transparent fallback when the CRF is unavailable: line-position heuristics."""
    from .lexicon import get_lexicon, _key
    lex = get_lexicon()
    n_lines = max(t.line for t in tokens) + 1
    labels = []
    for t in tokens:
        k = _key(t.text)
        if k.isdigit() and len(k) == 5:
            labels.append("POSTCODE")
        elif k in lex.sets.get("country", ()):
            labels.append("COUNTRY")
        elif t.line == 0 and n_lines > 2:
            labels.append("NAME")
        elif k in lex.sets.get("house_marker", ()) or (any(c.isdigit() for c in k) and t.line <= 1):
            labels.append("HOUSE")
        elif k in lex.sets.get("street_type", ()):
            labels.append("STREET")
        elif t.line == n_lines - 1 or k in lex.sets.get("city", ()):
            labels.append("CITY")
        else:
            labels.append("STREET")
    return labels


def fields_from_labels(norm: str, tokens, labels: list[str], probs: list[float] | None = None
                       ) -> tuple[dict, dict]:
    """Group contiguous tokens with the same label into field strings.

    Shared with the evaluation script so that offline metrics score exactly
    what the API returns. Field confidence = minimum token marginal.
    """
    spans: dict[str, list[list[int]]] = {}
    for i, lbl in enumerate(labels):
        if lbl == "O":
            continue
        groups = spans.setdefault(lbl, [])
        if groups and groups[-1][-1] == i - 1:
            groups[-1].append(i)
        else:
            groups.append([i])
    fields = {f: "" for f in FIELDS}
    confidence: dict[str, float] = {}
    for lbl, groups in spans.items():
        field = FIELD_OF_LABEL[lbl]
        parts = [norm[tokens[g[0]].start:tokens[g[-1]].end].strip(" ,;") for g in groups]
        fields[field] = ", ".join(p for p in parts if p)
        if probs is not None:
            confidence[field] = round(min(probs[i] for g in groups for i in g), 4)
    return fields, confidence


def parse_address(text: str) -> dict:
    """Tag ``text`` and return fields, per-field confidence and token detail."""
    norm = normalize_text(text)
    tokens = tokenize(norm)
    if not tokens:
        return {"fields": {f: "" for f in FIELDS}, "confidence": {}, "tokens": [], "engine": "none",
                "script": "none", "needs_review": [], "checks": {}, "derived": {}}

    model = _load_model()
    if model is not None:
        feats = sent2features(tokens)
        labels = model.tagger.tag(feats)
        probs = [model.tagger.marginal(lbl, i) for i, lbl in enumerate(labels)]
        engine = "crf"
    else:
        labels = _rule_labels(tokens)
        probs = [0.0] * len(tokens)
        engine = "rules"

    fields, confidence = fields_from_labels(norm, tokens, labels, probs)
    threshold = review_threshold()
    needs_review = sorted(f for f, c in confidence.items() if c < threshold)

    derived = {}
    if not fields["postcode"] and fields["city"]:
        zone = colombo_zone_postcode(fields["city"])
        if zone:
            derived["postcode"] = {"value": zone, "reason": "derived from Colombo zone number; confirm before use"}
    checks = {"city_postcode": check_city_postcode(fields["city"], fields["postcode"])}

    return {
        "fields": fields,
        "confidence": confidence,
        "needs_review": needs_review,
        "review_threshold": threshold,
        "derived": derived,
        "checks": checks,
        "script": dominant_script(norm),
        "engine": engine,
        "tokens": [{"text": t.text, "line": t.line, "start": t.start, "end": t.end, "label": l,
                    "p": round(p, 4)} for t, l, p in zip(tokens, labels, probs)],
        "normalized_text": norm,
    }
