"""Turn the raw public downloads into clean reference tables.

Run after ``fetch_public_datasets.py``:

    ml/.venv/Scripts/python ml/datasets/build_reference_data.py

Outputs (Datasets/processed/reference/):
    lk_localities.csv      postal towns in English/Sinhala/Tamil + postcode, district, province, lat/lon
    lk_post_offices_osm.csv  OpenStreetMap post-office points (candidate facility reference points)
    lk_streets_osm.csv     street names that have Sinhala and/or Tamil names in OpenStreetMap
    person_names.csv       given/family names (Wikidata CC0 + curated seed list)

The files the API needs at runtime are also copied into backend/app/reference/.
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_REFERENCE, CURATED, RAW, REFERENCE, ensure  # noqa: E402

TARIFF_FILE = "tariff_slpost_domestic_2026-02-09.json"

# Known character errors in the public gazetteer, corrected here so the fix is
# documented and reproducible (see Datasets/README.md, "Known data issues").
# U+09A6 BENGALI LETTER DA appears inside a Tamil name instead of U+0BA4 TAMIL LETTER TA
# ("பராக்ரமஸமுத்ராய", Parakrama Samudra).
CHARACTER_FIXES = {"ta": {chr(0x09A6): chr(0x0BA4)}}


def fix_chars(text: str, script: str) -> str:
    for bad, good in CHARACTER_FIXES.get(script, {}).items():
        text = text.replace(bad, good)
    return text


def nfc(text: str | None) -> str:
    return unicodedata.normalize("NFC", text.strip()) if text else ""


# ---------------------------------------------------------------------------
# Minimal parser for the MySQL INSERT statements in the gazetteer dumps.
# ---------------------------------------------------------------------------
def parse_sql_values(sql: str, table: str) -> list[dict]:
    rows: list[dict] = []
    pattern = re.compile(rf"INSERT INTO `{table}` \(([^)]*)\) VALUES\s*(.*?);\s*$", re.S | re.M)
    for match in pattern.finditer(sql):
        columns = [c.strip().strip("`") for c in match.group(1).split(",")]
        for values in _split_tuples(match.group(2)):
            rows.append(dict(zip(columns, values)))
    return rows


def _split_tuples(body: str) -> list[list]:
    tuples, current, field, i = [], [], None, 0
    in_str, depth = False, 0
    buf = []
    while i < len(body):
        ch = body[i]
        if in_str:
            if ch == "\\" and i + 1 < len(body):
                buf.append(body[i + 1])
                i += 2
                continue
            if ch == "'":
                if i + 1 < len(body) and body[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_str = False
                field = "".join(buf)
                i += 1
                continue
            buf.append(ch)
        elif ch == "'":
            in_str, buf = True, []
        elif ch == "(" and depth == 0:
            depth, current, field, buf = 1, [], None, []
        elif ch == "," and depth == 1:
            current.append(_coerce(field, buf))
            field, buf = None, []
        elif ch == ")" and depth == 1:
            current.append(_coerce(field, buf))
            tuples.append(current)
            depth, field, buf = 0, None, []
        elif depth == 1 and not ch.isspace():
            buf.append(ch)
        i += 1
    return tuples


def _coerce(quoted: str | None, buf: list[str]):
    if quoted is not None:
        return quoted
    token = "".join(buf).strip()
    return None if token.upper() == "NULL" else token


# ---------------------------------------------------------------------------
def build_localities() -> list[dict]:
    base = RAW / "gazetteer_madurapa"
    provinces = {r["id"]: r for r in parse_sql_values((base / "provinces.sql").read_text(encoding="utf-8"), "provinces")}
    districts = {r["id"]: r for r in parse_sql_values((base / "districts.sql").read_text(encoding="utf-8"), "districts")}
    cities = parse_sql_values((base / "cities.sql").read_text(encoding="utf-8"), "cities")

    out = []
    for c in cities:
        d = districts.get(c["district_id"], {})
        p = provinces.get(d.get("province_id"), {})
        out.append({
            "locality_id": c["id"],
            "name_en": nfc(c["name_en"]),
            "name_si": nfc(c["name_si"]),
            "name_ta": fix_chars(nfc(c["name_ta"]), "ta"),
            "sub_name_en": nfc(c["sub_name_en"]),
            "sub_name_si": nfc(c["sub_name_si"]),
            "sub_name_ta": fix_chars(nfc(c["sub_name_ta"]), "ta"),
            "postcode": (c["postcode"] or "").strip(),
            "district_en": nfc(d.get("name_en")),
            "district_si": nfc(d.get("name_si")),
            "district_ta": nfc(d.get("name_ta")),
            "province_en": nfc(p.get("name_en")),
            "province_si": nfc(p.get("name_si")),
            "province_ta": nfc(p.get("name_ta")),
            "latitude": c["latitude"] or "",
            "longitude": c["longitude"] or "",
            "coordinate_provenance": "gazetteer town centroid (not a building location)",
        })
    return out


def build_post_offices() -> list[dict]:
    data = json.loads((RAW / "osm" / "post_offices.json").read_text(encoding="utf-8"))
    out = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        out.append({
            "osm_ref": f"{el['type']}/{el['id']}",
            "name": nfc(tags.get("name")),
            "name_en": nfc(tags.get("name:en")),
            "name_si": nfc(tags.get("name:si")),
            "name_ta": nfc(tags.get("name:ta")),
            "postcode": nfc(tags.get("addr:postcode")),
            "city": nfc(tags.get("addr:city")),
            "latitude": f"{lat:.7f}",
            "longitude": f"{lon:.7f}",
        })
    return out


def build_streets() -> list[dict]:
    data = json.loads((RAW / "osm" / "streets_si_ta.json").read_text(encoding="utf-8"))
    seen, out = set(), []
    for el in data["elements"]:
        tags = el.get("tags", {})
        row = {
            "name_en": nfc(tags.get("name:en") or (tags.get("name") if _is_latin(tags.get("name", "")) else "")),
            "name_si": nfc(tags.get("name:si")),
            "name_ta": nfc(tags.get("name:ta")),
            "highway": tags.get("highway", ""),
        }
        key = (row["name_en"], row["name_si"], row["name_ta"])
        if key in seen or not any(key):
            continue
        seen.add(key)
        out.append(row)
    return out


def _is_latin(text: str) -> bool:
    return bool(text) and all(ord(ch) < 0x0250 for ch in text)


def build_names() -> list[dict]:
    rows: dict[tuple, dict] = {}
    wd = RAW / "wikidata" / "sri_lankan_person_names.csv"
    if wd.exists():
        for r in csv.DictReader(wd.open(encoding="utf-8")):
            name = nfc(r["name"])
            # Wikidata labels sometimes contain only an initial or a Latin label under si/ta.
            if len(name.replace(".", "")) < 2:
                continue
            if r["lang"] in ("si", "ta") and _is_latin(name):
                continue
            rows[(r["lang"], r["kind"], name)] = {"lang": r["lang"], "kind": r["kind"], "name": name, "source": "wikidata-cc0"}
    for r in csv.DictReader((CURATED / "name_seed_list.csv").open(encoding="utf-8")):
        for lang in ("en", "si", "ta"):
            name = nfc(r[lang])
            if name:
                rows.setdefault((lang, r["kind"], name), {"lang": lang, "kind": r["kind"], "name": name, "source": "curated-seed"})
    return sorted(rows.values(), key=lambda x: (x["lang"], x["kind"], x["name"]))


def write_csv(path: Path, rows: list[dict]) -> None:
    ensure(path.parent)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  wrote {path.relative_to(REFERENCE.parents[2])}  ({len(rows)} rows)")


def main() -> None:
    ensure(REFERENCE, BACKEND_REFERENCE)
    localities = build_localities()
    write_csv(REFERENCE / "lk_localities.csv", localities)
    write_csv(REFERENCE / "lk_post_offices_osm.csv", build_post_offices())
    write_csv(REFERENCE / "lk_streets_osm.csv", build_streets())
    write_csv(REFERENCE / "person_names.csv", build_names())

    shutil.copy(CURATED / TARIFF_FILE, REFERENCE / TARIFF_FILE)
    # Files the backend loads at runtime.
    for name in ("lk_localities.csv", "lk_post_offices_osm.csv", TARIFF_FILE):
        shutil.copy(REFERENCE / name, BACKEND_REFERENCE / name)
    shutil.copy(CURATED / "address_vocabulary.json", BACKEND_REFERENCE / "address_vocabulary.json")
    print(f"  copied runtime reference files to {BACKEND_REFERENCE}")

    with_postcode = sum(1 for r in localities if r["postcode"])
    print(f"\nLocalities with postcode: {with_postcode}/{len(localities)}")


if __name__ == "__main__":
    main()
