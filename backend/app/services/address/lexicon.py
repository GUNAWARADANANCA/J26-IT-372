"""Gazetteer and vocabulary lookups used by the address tagger and validators."""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from .text import normalize_text, tokenize

REFERENCE_DIR = Path(__file__).resolve().parents[2] / "reference"


def _key(token: str) -> str:
    return normalize_text(token).lower().strip(".:")


@dataclass
class Locality:
    locality_id: str
    names: dict  # {"en": ..., "si": ..., "ta": ...}
    sub_names: dict
    postcode: str
    district: dict
    province: dict
    latitude: float | None
    longitude: float | None


@dataclass
class Lexicon:
    vocab: dict
    sets: dict = field(default_factory=dict)          # category -> set of token keys
    localities: list = field(default_factory=list)
    by_name: dict = field(default_factory=lambda: defaultdict(list))   # full-name key -> [Locality]
    by_postcode: dict = field(default_factory=lambda: defaultdict(list))
    multiword: dict = field(default_factory=dict)     # category -> {tuple(token keys)}
    max_span: int = 1

    def has(self, category: str, token: str) -> bool:
        return _key(token) in self.sets.get(category, ())


def _load_localities(lex: Lexicon) -> None:
    path = REFERENCE_DIR / "lk_localities.csv"
    city_tokens, district_tokens, province_tokens, sub_tokens = set(), set(), set(), set()
    multi = {"city": set(), "district": set(), "province": set()}
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            loc = Locality(
                locality_id=row["locality_id"],
                names={s: row[f"name_{s}"] for s in ("en", "si", "ta")},
                sub_names={s: row[f"sub_name_{s}"] for s in ("en", "si", "ta")},
                postcode=row["postcode"],
                district={s: row[f"district_{s}"] for s in ("en", "si", "ta")},
                province={s: row[f"province_{s}"] for s in ("en", "si", "ta")},
                latitude=float(row["latitude"]) if row["latitude"] else None,
                longitude=float(row["longitude"]) if row["longitude"] else None,
            )
            lex.localities.append(loc)
            if loc.postcode:
                lex.by_postcode[loc.postcode].append(loc)
            for script in ("en", "si", "ta"):
                for name, token_set, cat in (
                    (loc.names[script], city_tokens, "city"),
                    (loc.sub_names[script], sub_tokens, None),
                    (loc.district[script], district_tokens, "district"),
                    (loc.province[script], province_tokens, "province"),
                ):
                    if not name:
                        continue
                    keys = tuple(_key(t.text) for t in tokenize(name))
                    token_set.update(keys)
                    if cat == "city":
                        lex.by_name[" ".join(keys)].append(loc)
                    if cat and len(keys) > 1:
                        multi[cat].add(keys)
                        lex.max_span = max(lex.max_span, len(keys))
    lex.sets.update(city=city_tokens, district=district_tokens, province=province_tokens, sub=sub_tokens,
                    postcode=set(lex.by_postcode))
    lex.multiword = multi


def _load_vocab(lex: Lexicon) -> None:
    for category, per_script in lex.vocab.items():
        if category.startswith("_") or not isinstance(per_script, dict):
            continue
        values = [v for vals in per_script.values() if isinstance(vals, list) for v in vals]
        lex.sets[category] = {_key(v) for v in values} | {normalize_text(v).lower() for v in values}
    colombo = lex.vocab["colombo_name"]
    lex.sets["colombo"] = {_key(v) for v in colombo.values()}


@lru_cache(maxsize=1)
def get_lexicon() -> Lexicon:
    vocab = json.loads((REFERENCE_DIR / "address_vocabulary.json").read_text(encoding="utf-8"))
    lex = Lexicon(vocab=vocab)
    _load_vocab(lex)
    _load_localities(lex)
    return lex


def find_localities(name: str) -> list[Locality]:
    """Localities whose English/Sinhala/Tamil name matches ``name`` exactly."""
    lex = get_lexicon()
    keys = " ".join(_key(t.text) for t in tokenize(name))
    return list(lex.by_name.get(keys, []))


def colombo_zone_postcode(city: str) -> str | None:
    """'Colombo 03' / 'කොළඹ 3' / 'கொழும்பு 03' -> '00300'."""
    tokens = [t.text for t in tokenize(city)]
    lex = get_lexicon()
    if len(tokens) == 2 and _key(tokens[0]) in lex.sets["colombo"] and tokens[1].isdigit():
        return lex.vocab["colombo_zones"].get(str(int(tokens[1])))
    return None


def check_city_postcode(city: str, postcode: str) -> dict:
    """Consistency of a (city, postcode) pair against the reference gazetteer.

    Returns ``{"status": ..., "detail": ..., "candidates": [...]}`` where status is
    one of consistent, mismatch, unknown_city, unknown_postcode or incomplete.
    The check never edits either value; it only explains.
    """
    city, postcode = (city or "").strip(), (postcode or "").strip()
    if not city or not postcode:
        candidates = []
        if city:
            zone = colombo_zone_postcode(city)
            candidates = [zone] if zone else sorted({l.postcode for l in find_localities(city) if l.postcode})
        return {"status": "incomplete", "detail": "city or postcode missing", "candidates": candidates}
    zone = colombo_zone_postcode(city)
    if zone:
        ok = zone == postcode
        return {"status": "consistent" if ok else "mismatch",
                "detail": f"Colombo zone implies postcode {zone}", "candidates": [zone]}
    matches = find_localities(city)
    lex = get_lexicon()
    if not matches:
        known = postcode in lex.by_postcode
        return {"status": "unknown_city", "detail": "town not found in the reference gazetteer",
                "candidates": [l.names["en"] for l in lex.by_postcode.get(postcode, [])][:5] if known else []}
    codes = sorted({l.postcode for l in matches if l.postcode})
    if postcode in codes:
        return {"status": "consistent", "detail": "town and postcode agree with the gazetteer", "candidates": codes}
    if postcode not in lex.by_postcode:
        return {"status": "unknown_postcode", "detail": "postcode not in the reference gazetteer", "candidates": codes}
    return {"status": "mismatch", "detail": "postcode belongs to a different town", "candidates": codes}
