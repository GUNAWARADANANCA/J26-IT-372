"""Prepare the handwriting training data once (read straight from the archives, nothing is unpacked).

    ml/.venv/Scripts/python ml/htr/build_cache.py

Inputs, in HTR_DATA (default ~/PostAssist/datasets, see ml/common/paths.py):
    sinocr_handwritten.zip      SinOCR handwritten subset: 1,135 Sinhala lines + data.csv   (IEEE DataPort)
    sinhala_chars_454.zip       454-class Sinhala handwritten characters, 80x80 px          (no label file)
    iam_line/*.parquet          IAM handwriting lines, English                              (Hugging Face Teklia/IAM-line)

Output, in HTR_DATA/cache (not in the repository):
    real_{train,val,test}.*     ink lines at 64 px height + texts + source
    glyphs_{train,valid}.*      cropped handwritten characters of the classes labelled in sinhala_glyphs.py
    text_{train,val}.json       address text per script for the synthetic lines
    charset.json                characters the network can write (index 0 = CTC blank)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_ROOT, HTR_DATA, PROCESSED, REFERENCE, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.text import primary_script  # noqa: E402
from app.services.ocr.htr import ink_map, text_box, to_target  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data import CACHE, STORE_H, Packed  # noqa: E402
from sinhala_glyphs import CLASS_OF  # noqa: E402

MAX_W = 2400


def clean_text(text: str) -> str:
    """Labels as people write: no space before punctuation ('88 , පාර' and IAM's 'part . The')."""
    text = re.sub(r"\s+([,.;:!?)])", r"\1", to_target(text))
    return re.sub(r"\(\s+", "(", text)


def store_line(gray: np.ndarray) -> np.ndarray | None:
    """Line image -> tight ink crop at STORE_H (uint8, ink bright), or None when it is empty."""
    ink = ink_map(gray)
    box = text_box(ink)
    if box is None:
        return None
    ink = ink[box[1]:box[3], box[0]:box[2]]
    width = int(np.clip(round(ink.shape[1] * STORE_H / ink.shape[0]), 8, MAX_W))
    return (cv2.resize(ink, (width, STORE_H), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8)


def in_val(key: str, percent: int = 10) -> bool:
    return int(hashlib.sha1(key.encode()).hexdigest(), 16) % 100 < percent


def sinocr(path: Path) -> dict[str, list]:
    out = {"train": [], "val": [], "test": []}
    with zipfile.ZipFile(path) as z:
        for part in ("train", "test"):
            rows = csv.DictReader(io.TextIOWrapper(z.open(f"handwritten-data/{part}/data.csv"), encoding="utf-8"))
            for row in rows:
                data = z.read(f"handwritten-data/{part}/images/{row['file_name']}.png")
                line = store_line(cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE))
                if line is None:
                    continue
                split = "test" if part == "test" else "val" if in_val(row["file_name"]) else "train"
                out[split].append((line, clean_text(row["text"]), "sinocr"))
    return out


def iam(folder: Path) -> dict[str, list]:
    import pyarrow.parquet as pq

    out = {}
    for split, name in (("train", "train"), ("val", "validation"), ("test", "test")):
        out[split] = []
        for row in pq.read_table(folder / f"{name}.parquet").to_pylist():
            line = store_line(cv2.imdecode(np.frombuffer(row["image"]["bytes"], np.uint8), cv2.IMREAD_GRAYSCALE))
            if line is not None:
                out[split].append((line, clean_text(row["text"]), "iam"))
    return out


def glyphs(path: Path) -> None:
    wanted = set(CLASS_OF.values())
    with zipfile.ZipFile(path) as z:
        for split in ("train", "valid"):
            images, classes = [], []
            for name in z.namelist():
                parts = name.split("/")
                if len(parts) != 4 or parts[1] != split or not name.endswith(".jpg") or int(parts[2]) not in wanted:
                    continue
                img = cv2.imdecode(np.frombuffer(z.read(name), np.uint8), cv2.IMREAD_GRAYSCALE)
                mask = (img > 110).astype(np.uint8)
                n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
                for k in range(1, n):   # drop specks that are not part of the character
                    if stats[k, cv2.CC_STAT_AREA] < 6:
                        mask[labels == k] = 0
                rows, cols = np.where(mask.max(axis=1))[0], np.where(mask.max(axis=0))[0]
                if rows.size < 6 or cols.size < 4:
                    continue
                images.append(img[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1] * mask[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1])
                classes.append(int(parts[2]))
            Packed.write(CACHE / f"glyphs_{split}", images)
            np.save(CACHE / f"glyphs_{split}.cls.npy", np.array(classes, dtype=np.int32))
            print(f"glyphs {split}: {len(images)} characters of {len(set(classes))} classes")


def text_pool(split: str, extra_si: list[str]) -> dict[str, list[str]]:
    pool = {"si": list(extra_si), "en": [], "ta": []}
    with (PROCESSED / "address_tagging" / f"{split}.jsonl").open(encoding="utf-8") as f:
        for row in f:
            sample = json.loads(row)
            if sample["noisy"]:   # simulated OCR / typing errors: right for the parser, wrong as handwriting labels
                continue
            for line in sample["text"].split("\n"):
                script = primary_script(line)
                if script in pool and len(line) >= 3:
                    pool[script].append(line)
    with (REFERENCE / "lk_localities.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):   # every postal town, with and without its postcode
            if in_val(row["name_en"]) == (split == "val"):
                for script, key in (("en", "name_en"), ("si", "name_si"), ("ta", "name_ta")):
                    if row[key]:
                        pool[script] += [row[key], f"{row[key]} {row['postcode']}", f"{row[key]}, {row[f'district_{script}']}"]
    return pool


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sinocr", type=Path, default=HTR_DATA / "sinocr_handwritten.zip")
    ap.add_argument("--chars", type=Path, default=HTR_DATA / "sinhala_chars_454.zip")
    ap.add_argument("--iam", type=Path, default=HTR_DATA / "iam_line")
    args = ap.parse_args()
    ensure(CACHE)

    real = sinocr(args.sinocr)
    for split, rows in iam(args.iam).items():
        real[split] += rows
    for split, rows in real.items():
        Packed.write(CACHE / f"real_{split}", [r[0] for r in rows])
        (CACHE / f"real_{split}.json").write_text(json.dumps(
            {"texts": [r[1] for r in rows], "sources": [r[2] for r in rows]}, ensure_ascii=False), encoding="utf-8")
        print(f"real {split}: {dict(Counter(r[2] for r in rows))}")

    glyphs(args.chars)

    pools = {"train": text_pool("train", [r[1] for r in real["train"] if r[2] == "sinocr"]), "val": text_pool("val", [])}
    for split, pool in pools.items():
        (CACHE / f"text_{split}.json").write_text(json.dumps(pool, ensure_ascii=False), encoding="utf-8")
        print(f"text {split}: " + ", ".join(f"{k} {len(v)}" for k, v in pool.items()))

    counts = Counter()
    for _, text, _ in real["train"]:
        counts.update(text)
    for lines in pools["train"].values():
        for line in lines:
            counts.update(to_target(line))
    charset = [""] + sorted(c for c, n in counts.items() if n >= 5 and (c == " " or not c.isspace()))
    (CACHE / "charset.json").write_text(json.dumps(charset, ensure_ascii=False), encoding="utf-8")
    dropped = sorted(c for c, n in counts.items() if n < 5)
    print(f"charset: {len(charset) - 1} characters; dropped as too rare (<5): {''.join(dropped)!r}")


if __name__ == "__main__":
    main()
