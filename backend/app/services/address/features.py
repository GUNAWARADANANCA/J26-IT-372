"""Feature extraction for the CRF address-field tagger.

Labels predicted per token:
    NAME      recipient / sender name, including honorifics and initials
    HOUSE     house or unit number ("No. 25/3", "අංක 12", "இல. 7")
    STREET    street, road, lane, mawatha
    LOCALITY  village / suburb / area inside a postal town
    CITY      postal town (including Colombo zone numbers, "Colombo 03")
    REGION    district / province
    POSTCODE  five-digit postal code
    COUNTRY   "Sri Lanka", "ශ්‍රී ලංකාව", "இலங்கை"
    O         anything else ("To", "C/O", stray punctuation)

The same function is imported by ml/address_parser/train_crf.py, so changing a
feature requires retraining the model (the model metadata stores a feature
version that is checked when the model is loaded).
"""
from __future__ import annotations

import re

from .lexicon import Lexicon, _key, get_lexicon
from .text import Token, token_script

FEATURE_VERSION = "2026.10-v1"
LABELS = ["NAME", "HOUSE", "STREET", "LOCALITY", "CITY", "REGION", "POSTCODE", "COUNTRY", "O"]

_LEX_CATEGORIES = ("honorific_prefix", "honorific_suffix", "house_marker", "street_type", "region_word",
                   "country", "addressee_marker", "care_of", "initials")


def _shape(text: str) -> str:
    out = []
    for ch in text:
        if ch.isdigit():
            c = "d"
        elif 0x0D80 <= ord(ch) <= 0x0DFF:  # Sinhala block
            c = "S"
        elif 0x0B80 <= ord(ch) <= 0x0BFF:  # Tamil block
            c = "T"
        elif ch.isalpha():
            c = "X" if ch.isupper() else "x"
        else:
            c = ch
        if not out or out[-1] != c:
            out.append(c)
    return "".join(out)[:8]


def _gazetteer_spans(keys: list[str], lex: Lexicon) -> dict[int, set]:
    """Mark tokens covered by a multi-word town / district / province name."""
    marks: dict[int, set] = {}
    for category, names in lex.multiword.items():
        for i in range(len(keys)):
            for span in range(min(lex.max_span, len(keys) - i), 1, -1):
                if tuple(keys[i:i + span]) in names:
                    for j in range(i, i + span):
                        marks.setdefault(j, set()).add(f"{category}_multi")
                    break
    return marks


def _base_features(tok: Token, key: str, lex: Lexicon) -> dict:
    text = tok.text
    script = token_script(text)
    f = {
        "w": key,
        "p2": key[:2], "p3": key[:3], "s2": key[-2:], "s3": key[-3:],
        "script": script,
        "shape": _shape(text),
        "isdigit": key.isdigit(),
        "hasdigit": any(c.isdigit() for c in key),
        "ndigits": str(min(sum(c.isdigit() for c in key), 6)) if key.isdigit() else "-",
        "slash": "/" in text,
        "hyphen": "-" in text,
        "period": text.endswith("."),
        "comma": tok.trailing_comma,
        "short": len(key) <= 2,
        "upper": text.isupper() and script.startswith("en"),
        "title": text[:1].isupper() and script.startswith("en"),
    }
    for cat in _LEX_CATEGORIES:
        if key in lex.sets.get(cat, ()) or text.lower() in lex.sets.get(cat, ()):
            f[f"lex_{cat}"] = True
    for cat in ("city", "district", "province", "sub"):
        if key in lex.sets.get(cat, ()):
            f[f"gaz_{cat}"] = True
    if key in lex.sets.get("colombo", ()):
        f["colombo"] = True
    if key.isdigit() and len(key) == 5:
        f["postcode_shape"] = True
        if key in lex.sets["postcode"]:
            f["postcode_known"] = True
    return f


_CONTEXT_KEYS = ("w", "script", "shape", "isdigit", "comma", "period", "lex_house_marker", "lex_street_type",
                 "lex_honorific_prefix", "lex_honorific_suffix", "lex_initials", "gaz_city", "gaz_district",
                 "colombo", "postcode_shape", "first_in_line", "last_in_line")


def sent2features(tokens: list[Token], lex: Lexicon | None = None) -> list[dict]:
    lex = lex or get_lexicon()
    keys = [_key(t.text) for t in tokens]
    n_lines = (max(t.line for t in tokens) + 1) if tokens else 1
    multi = _gazetteer_spans(keys, lex)

    per_token = []
    for i, tok in enumerate(tokens):
        f = _base_features(tok, keys[i], lex)
        same_line = [t for t in tokens if t.line == tok.line]
        f["first_in_line"] = same_line[0] is tok
        f["last_in_line"] = same_line[-1] is tok
        f["line"] = str(min(tok.line, 6))
        f["line_from_end"] = str(min(n_lines - 1 - tok.line, 6))
        f["single_line"] = n_lines == 1
        f["pos"] = str(min(int(5 * i / max(len(tokens), 1)), 4))
        for m in multi.get(i, ()):
            f[m] = True
        per_token.append(f)

    # Colombo zone: "Colombo 03" -> the number belongs to the city, not a house.
    for i in range(1, len(tokens)):
        if per_token[i - 1].get("colombo") and keys[i].isdigit() and len(keys[i]) <= 2:
            per_token[i]["colombo_zone"] = True

    feats = []
    for i, f in enumerate(per_token):
        out = {"bias": 1.0}
        out.update({k: v for k, v in f.items() if v not in (False, None, "")})
        for off in (-2, -1, 1, 2):
            j = i + off
            if 0 <= j < len(per_token):
                for k in _CONTEXT_KEYS:
                    v = per_token[j].get(k)
                    if v not in (None, False, ""):
                        out[f"{off:+d}:{k}"] = v
                if off in (-1, 1) and tokens[j].line != tokens[i].line:
                    out[f"{off:+d}:newline"] = True
            else:
                out[f"{off:+d}:pad"] = True
        if i == 0:
            out["BOS"] = True
        if i == len(per_token) - 1:
            out["EOS"] = True
        feats.append(_crfsuite_safe(out))
    return feats


def _crfsuite_safe(features: dict) -> dict:
    """pycrfsuite accepts str->float or str->str; booleans become 1.0."""
    clean = {}
    for k, v in features.items():
        if isinstance(v, bool):
            clean[k] = 1.0
        elif isinstance(v, (int, float)):
            clean[k] = float(v)
        else:
            clean[k] = re.sub(r"[\s:]", "_", str(v)) or "_"
    return clean
