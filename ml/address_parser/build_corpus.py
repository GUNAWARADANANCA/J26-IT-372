"""Build the labelled corpus for the address-field tagger.

    ml/.venv/Scripts/python ml/address_parser/build_corpus.py [--seed 13]

Two sources are combined (see Datasets/README.md):

1. **Real addresses** - the Sri Lanka split of the Deepparse *worldwide-addresses*
   dataset (CC BY 4.0, derived from OpenStreetMap via libpostal). Tags are
   mapped to this project's label set. Mostly English, single-line.
2. **Synthetic envelope addresses** - multi-line addresses written the way they
   appear on Sri Lankan envelopes, in Sinhala, Tamil, English and mixed script,
   assembled from public reference data only (gazetteer towns and postcodes,
   OpenStreetMap street names, Wikidata names, curated vocabulary). No real
   person's name is paired with a real house address: given names, family
   names, house numbers and streets are sampled independently.

The split is *grouped by postal town*: every example that mentions a town goes
to the same partition, so the test set measures generalisation to towns the
model has never seen (proposal section 3.3).

Output: Datasets/processed/address_tagging/{train,val,test}.jsonl and stats.json
Each line: {"text": "...", "labels": [...], "source": ..., "script": ..., "group": ..., "noisy": bool}
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_ROOT, CURATED, PROCESSED, RAW, REFERENCE, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.text import dominant_script, tokenize  # noqa: E402

OUT = PROCESSED / "address_tagging"

DEEPPARSE_MAP = {
    "StreetNumber": "HOUSE", "Unit": "HOUSE", "StreetName": "STREET", "Orientation": "STREET",
    "Suburb": "LOCALITY", "Municipality": "CITY", "County": "REGION", "Province": "REGION",
    "PostalCode": "POSTCODE", "Country": "COUNTRY", "GeneralDelivery": "O", "EOS": "O",
}
SCRIPTS = ("en", "si", "ta")


# ---------------------------------------------------------------------------
# Loading reference resources
# ---------------------------------------------------------------------------
def load_resources() -> dict:
    vocab = json.loads((CURATED / "address_vocabulary.json").read_text(encoding="utf-8"))
    localities = list(csv.DictReader((REFERENCE / "lk_localities.csv").open(encoding="utf-8")))
    streets_osm = list(csv.DictReader((REFERENCE / "lk_streets_osm.csv").open(encoding="utf-8")))
    names = defaultdict(list)
    for r in csv.DictReader((REFERENCE / "person_names.csv").open(encoding="utf-8")):
        names[(r["lang"], r["kind"])].append(r["name"])
    return {"vocab": vocab, "localities": localities, "streets_osm": streets_osm, "names": names}


_VIRAMA = chr(0x0DCA)  # Sinhala al-lakuna
_BROKEN_CONJUNCT = _VIRAMA + " ([" + chr(0x0DBB) + chr(0x0DBA) + "])"  # virama, space, ra/ya


def repair_sinhala(text: str) -> str:
    """Deepparse rows contain 'ශ් රී' where the zero-width joiner was lost."""
    return re.sub(_BROKEN_CONJUNCT, lambda m: _VIRAMA + chr(0x200D) + m.group(1), text)


# ---------------------------------------------------------------------------
# Real addresses (Deepparse Sri Lanka split)
# ---------------------------------------------------------------------------
def load_deepparse() -> tuple[list[dict], Counter]:
    import pyarrow.parquet as pq

    rows = pq.read_table(RAW / "deepparse_worldwide" / "lk.parquet").to_pylist()
    seen, out, skipped = set(), [], Counter()
    for r in rows:
        if r["Language"] not in ("eng", "sin", "tam"):
            skipped["other_language"] += 1
            continue
        if has_foreign_letters(r["Address"]):
            skipped["foreign_script"] += 1  # e.g. "Шри-Ланка" or "スリランカ" in an English row
            continue
        words = r["Address"].split()
        tags = r["Tags"]
        if len(words) != len(tags):
            skipped["misaligned"] += 1
            continue
        labels = [DEEPPARSE_MAP.get(t, "O") for t in tags]
        if set(labels) <= {"COUNTRY", "O"}:
            skipped["country_only"] += 1
            continue
        text = repair_sinhala(" ".join(words))
        if text in seen:
            skipped["duplicate"] += 1
            continue
        seen.add(text)
        aligned = align(words, labels, text)
        if aligned is None:
            skipped["tokenizer_mismatch"] += 1
            continue
        city = " ".join(w for w, l in zip(words, labels) if l == "CITY").lower()
        postcode = next((w for w, l in zip(words, labels) if l == "POSTCODE"), "")
        group = f"town:{city}" if city else (f"pc:{postcode}" if postcode else "dp:" + hashlib.md5(text.encode()).hexdigest()[:6])
        out.append({"text": text, "labels": aligned, "source": "deepparse_lk", "script": dominant_script(text),
                    "group": group, "noisy": False})
    return out, skipped


def has_foreign_letters(text: str) -> bool:
    """Letters outside Sinhala, Tamil and Latin (incl. Latin Extended) scripts."""
    return any(ch.isalpha() and not (0x0D80 <= ord(ch) <= 0x0DFF or 0x0B80 <= ord(ch) <= 0x0BFF or ord(ch) < 0x0250
                                     or 0x1E00 <= ord(ch) <= 0x1EFF) for ch in text)


def align(words: list[str], labels: list[str], text: str) -> list[str] | None:
    """Project word-level labels onto this project's tokenizer output."""
    projected = []
    for w, l in zip(words, labels):
        sub = tokenize(repair_sinhala(w))
        projected.extend([l] * len(sub))
    if len(projected) != len(tokenize(text)):
        return None
    return projected


# ---------------------------------------------------------------------------
# Synthetic envelope addresses
# ---------------------------------------------------------------------------
class Generator:
    def __init__(self, res: dict, rng: random.Random):
        self.rng = rng
        self.v = res["vocab"]
        self.loc = [l for l in res["localities"] if l["postcode"]]
        self.names = res["names"]
        self.streets = {s: [] for s in SCRIPTS}
        for row in res["streets_osm"]:
            for s in SCRIPTS:
                if row[f"name_{s}"]:
                    self.streets[s].append(row[f"name_{s}"])
        self.dp_streets: list[str] = []

    # --- small helpers ------------------------------------------------------
    def pick(self, seq):
        return self.rng.choice(seq)

    def chance(self, p: float) -> bool:
        return self.rng.random() < p

    def name_line(self, s: str) -> list[tuple[str, str]]:
        v, r = self.v, self.rng
        words: list[tuple[str, str]] = []
        family = self.pick(self.names[(s, "family")] or self.names[("en", "family")])
        given = self.pick(self.names[(s, "given")] or self.names[("en", "given")])
        if s == "en" and self.chance(0.08):
            words.append((self.pick(["To", "To,", "To:"]), "O"))
        if s in ("en", "ta") and self.chance(0.7):
            words.append((self.pick(v["honorific_prefix"][s]), "NAME"))
        elif s == "si" and self.chance(0.1):
            words.append((self.pick(v["honorific_prefix"]["si"]), "NAME"))
        n_init = r.choice([0, 1, 1, 2, 2, 3])
        initials = r.sample(v["initials"][s], k=n_init)
        if s == "en" and n_init > 1 and self.chance(0.3):
            words.append(("".join(initials), "NAME"))  # "A.B.C."
        else:
            words.extend((i, "NAME") for i in initials)
        if n_init == 0 or self.chance(0.3):
            words.append((given, "NAME"))
        words.extend((w, "NAME") for w in family.split())
        if s == "si" and self.chance(0.75):
            words.append((self.pick(v["honorific_suffix"]["si"]), "NAME"))
            if self.chance(0.1):
                words.append(("වෙත", "O"))
        if s == "ta" and self.chance(0.08):
            words.append(("அவர்கள்", "NAME"))
        return words

    def house_tokens(self, s: str, marker_script: str) -> list[tuple[str, str]]:
        r = self.rng
        n = r.randint(1, 450)
        fmt = r.random()
        if fmt < 0.45:
            number = str(n)
        elif fmt < 0.75:
            number = f"{n}/{r.randint(1, 30)}"
        elif fmt < 0.88:
            number = f"{n}/{r.choice('ABCDE')}"
        else:
            number = f"{n}{r.choice('ABC')}"
        out = []
        if self.chance(0.8):
            marker = self.pick(self.v["house_marker"][marker_script])
            if marker_script == "en" and self.chance(0.12):
                return [(f"{marker.rstrip('.:')}.{number}", "HOUSE")]  # glued "No.25"
            out.append((marker, "HOUSE"))
        out.append((number, "HOUSE"))
        return out

    def street_words(self, s: str) -> list[tuple[str, str]]:
        r = self.rng
        pool = self.streets[s] + (self.dp_streets if s == "en" else [])
        if pool and self.chance(0.55):
            street = self.pick(pool)
        else:
            base = self.pick(self.loc)[f"name_{s}"]
            stype = self.pick(self.v["street_type"][s][:9] if s != "en" else self.v["street_type"]["en"][:16])
            street = f"{base} {stype}"
            if self.chance(0.12):
                street = f"{r.choice(['1st', '2nd', '3rd', '4th'])} {street}" if s == "en" else street
        return [(w, "STREET") for w in street.split()]

    def make(self, s: str, mixed: bool = False, envelope: bool = False) -> dict:
        r, v = self.rng, self.v
        loc = self.pick(self.loc)
        city_script = s
        marker_script = s
        name_script = s
        if mixed:
            # Common real-world mixes: English numbers/markers with local text, or an English name line.
            choice = r.random()
            if choice < 0.4:
                marker_script = "en"
            elif choice < 0.7:
                name_script = "en"
            else:
                city_script = "en"

        lines: list[list[tuple[str, str]]] = [self.name_line(name_script)]

        house = self.house_tokens(s, marker_script)
        street = self.street_words(s)
        if self.chance(0.55):
            lines.append(house + street)
        else:
            lines.append(house)
            lines.append(street)
        if self.chance(0.35):
            other = self.pick(self.loc)
            sub = loc[f"sub_name_{city_script}"] or other[f"name_{city_script}"]
            lines.append([(w, "LOCALITY") for w in sub.split()])

        is_colombo = loc["name_en"].startswith("Colombo") and self.chance(0.5)
        if is_colombo:
            zone = r.randint(1, 15)
            city_words = [(v["colombo_name"][city_script], "CITY"), (f"{zone:02d}" if self.chance(0.7) else str(zone), "CITY")]
            postcode = v["colombo_zones"][str(zone)]
        else:
            city_words = [(w, "CITY") for w in loc[f"name_{city_script}"].split()]
            postcode = loc["postcode"]
        city_line = list(city_words)
        if self.chance(0.55):
            pc = [(postcode, "POSTCODE")]
            if self.chance(0.75):
                city_line += pc
            else:
                lines.append(city_line)
                city_line = pc
        lines.append(city_line)
        if self.chance(0.1):
            region_word = self.pick(v["region_word"][city_script][:1] or ["District"])
            lines.append([(w, "REGION") for w in loc[f"district_{city_script}"].split()] + [(region_word, "REGION")])
        if self.chance(0.12):
            lines.append([(w, "COUNTRY") for w in v["country_phrase"][s][0].split()])

        if not envelope and self.chance(0.2):  # typed on one line by an officer
            lines = [[tok for line in lines for tok in line]]

        if s == "en" and not envelope:
            style = r.random()
            if style < 0.1:
                lines = [[(w.upper(), l) for w, l in line] for line in lines]
            elif style < 0.15:
                lines = [[(w.lower(), l) for w, l in line] for line in lines]

        text, labels = render(lines, r)
        return {"text": text, "labels": labels, "source": "synthetic", "script": "mixed" if mixed else s,
                "group": f"town:{loc['name_en'].lower()}", "noisy": False}


def render(lines: list[list[tuple[str, str]]], rng: random.Random) -> tuple[str, list[str]]:
    out_lines, labels = [], []
    for li, line in enumerate(lines):
        parts = []
        for wi, (word, label) in enumerate(line):
            nxt = line[wi + 1][1] if wi + 1 < len(line) else None
            sep = ""
            # A comma often separates fields on the same line ("No. 25, Galle Road").
            if nxt is not None and nxt != label and rng.random() < 0.6:
                sep = ","
            parts.append(word + sep)
            labels.extend([label] * len(tokenize(word)))
        end = "," if li < len(lines) - 1 and rng.random() < 0.6 else ("." if rng.random() < 0.1 else "")
        out_lines.append(" ".join(parts) + end)
    text = "\n".join(out_lines)
    assert len(tokenize(text)) == len(labels), (text, labels)
    return text, labels


# ---------------------------------------------------------------------------
# OCR-style noise
# ---------------------------------------------------------------------------
_SINHALA_CONSONANTS = [*range(0x0D9A, 0x0DB2), *range(0x0DB3, 0x0DBC), 0x0DBD, *range(0x0DC0, 0x0DC7)]
_LATIN_CONFUSIONS = {"0": "O", "O": "0", "1": "l", "l": "1", "5": "S", "S": "5", "8": "B", "B": "8", "rn": "m", "m": "rn"}


def add_ocr_noise(sample: dict, rng: random.Random, rate: float) -> dict | None:
    """Character-level substitutions / deletions within a token's own script."""
    tokens = tokenize(sample["text"])
    text = sample["text"]
    pieces, cursor = [], 0
    for t in tokens:
        pieces.append(text[cursor:t.start])
        word = t.text
        if rng.random() < rate * 3:
            chars = list(word)
            i = rng.randrange(len(chars))
            ch = chars[i]
            op = rng.random()
            if ch in _LATIN_CONFUSIONS and op < 0.5:
                chars[i] = _LATIN_CONFUSIONS[ch]
            elif 0x0D80 <= ord(ch) <= 0x0DFF and op < 0.6:
                chars[i] = chr(rng.choice(_SINHALA_CONSONANTS))
            elif 0x0B80 <= ord(ch) <= 0x0BFF and op < 0.6:
                chars[i] = chr(rng.choice([0x0B95, 0x0B99, 0x0B9A, 0x0B9E, 0x0B9F, 0x0BA3, 0x0BA4, 0x0BA8, 0x0BAA, 0x0BAE, 0x0BAF, 0x0BB0, 0x0BB2, 0x0BB5]))
            elif len(chars) > 2 and op < 0.8:
                del chars[i]
            word = "".join(chars)
        pieces.append(word)
        cursor = t.end
    pieces.append(text[cursor:])
    noisy = "".join(pieces)
    if len(tokenize(noisy)) != len(sample["labels"]):
        return None
    return {**sample, "text": noisy, "noisy": True}


# ---------------------------------------------------------------------------
def assign_split(group: str, seed: int) -> str:
    h = int(hashlib.sha256(f"{seed}:{group}".encode()).hexdigest(), 16) % 100
    return "train" if h < 70 else ("val" if h < 85 else "test")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=13)
    parser.add_argument("--per-script", type=int, default=6000, help="synthetic addresses per script")
    parser.add_argument("--mixed", type=int, default=1500, help="synthetic mixed-script addresses")
    parser.add_argument("--noise-share", type=float, default=0.25)
    args = parser.parse_args()
    rng = random.Random(args.seed)

    res = load_resources()
    real, skipped = load_deepparse()
    gen = Generator(res, rng)
    gen.dp_streets = sorted({" ".join(w for w, l in zip(tokenize_words(s["text"]), s["labels"]) if l == "STREET")
                             for s in real if s["script"] == "en"} - {""})

    synthetic = [gen.make(s) for s in SCRIPTS for _ in range(args.per_script)]
    synthetic += [gen.make(rng.choice(("si", "ta")), mixed=True) for _ in range(args.mixed)]

    samples = real + synthetic
    noisy = []
    for s in samples:
        if rng.random() < args.noise_share:
            n = add_ocr_noise(s, rng, rate=rng.choice([0.03, 0.06, 0.1]))
            if n:
                noisy.append(n)
    samples += noisy

    ensure(OUT)
    splits = defaultdict(list)
    for s in samples:
        splits[assign_split(s["group"], args.seed)].append(s)
    stats = {"seed": args.seed, "deepparse_skipped": dict(skipped), "splits": {}}
    for name, rows in splits.items():
        rng.shuffle(rows)
        with (OUT / f"{name}.jsonl").open("w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        stats["splits"][name] = {
            "examples": len(rows),
            "groups": len({r["group"] for r in rows}),
            "by_source": dict(Counter(r["source"] for r in rows)),
            "by_script": dict(Counter(r["script"] for r in rows)),
            "noisy": sum(r["noisy"] for r in rows),
            "labels": dict(Counter(l for r in rows for l in r["labels"])),
        }
    # Leakage check: no postal town appears in two partitions.
    groups = {name: {r["group"] for r in rows} for name, rows in splits.items()}
    stats["group_overlap"] = {f"{a}-{b}": len(groups[a] & groups[b])
                              for a in groups for b in groups if a < b}
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "labels"} for k, v in stats["splits"].items()}, indent=2))
    print("group overlap:", stats["group_overlap"])


def tokenize_words(text: str) -> list[str]:
    return [t.text for t in tokenize(text)]


if __name__ == "__main__":
    main()
