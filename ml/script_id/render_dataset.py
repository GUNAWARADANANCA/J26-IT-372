"""Render the script-identification dataset (Sinhala / Tamil / Latin text lines).

    ml/.venv/Scripts/python ml/script_id/render_dataset.py

Text comes only from public sources (gazetteer, OpenStreetMap streets,
Wikidata names, Deepparse Sri Lanka addresses and the synthetic address
corpus). Each split uses *different text* (from the matching address-corpus
split) and *different fonts* (train / validation / held-out test, see
ml/common/fonts.py), so validation and test both reflect unseen typefaces.

Output (not committed - regenerate with this script):
    Datasets/processed/script_id/{train,val,test}.npz   images (N, 32, 256) uint8 + labels + metadata
    Datasets/processed/script_id/samples.png            a preview grid
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.fonts import fonts, latin_fallback  # noqa: E402
from common.paths import BACKEND_ROOT, PROCESSED, REFERENCE, ensure  # noqa: E402
from common.textrender import render_line  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.text import dominant_script, primary_script  # noqa: E402
from app.services.ocr.script_id import CLASSES, INPUT_H, INPUT_W, prepare_line  # noqa: E402

OUT = PROCESSED / "script_id"


def text_pool(split: str) -> dict[str, list[str]]:
    pool = {c: [] for c in CLASSES}
    with (PROCESSED / "address_tagging" / f"{split}.jsonl").open(encoding="utf-8") as f:
        for line in f:
            sample = json.loads(line)
            for text_line in sample["text"].split("\n"):
                s = primary_script(text_line)
                if s in pool and len(text_line) >= 3:
                    pool[s].append(text_line)
    # Reference vocabularies are split by a hash so no string is shared across splits.
    def add(text: str, script: str):
        bucket = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % 10 if text else 0
        if text and (bucket < 7) == (split == "train") and primary_script(text) == script:
            pool[script].append(text)
    for row in csv.DictReader((REFERENCE / "lk_localities.csv").open(encoding="utf-8")):
        for c in CLASSES:
            add(row[f"name_{c}"], c)
    for row in csv.DictReader((REFERENCE / "lk_streets_osm.csv").open(encoding="utf-8")):
        for c in CLASSES:
            add(row[f"name_{c}"], c)
    return pool


def augment(ink: np.ndarray, rng: random.Random) -> np.ndarray:
    """Ink mask (0..255) -> realistic grayscale line on paper."""
    h, w = ink.shape
    if rng.random() < 0.3:
        k = np.ones((2, 2), np.uint8)
        ink = cv2.dilate(ink, k) if rng.random() < 0.6 else cv2.erode(ink, k)
    pad = int(h * 0.3)
    ink = cv2.copyMakeBorder(ink, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    if rng.random() < 0.35:  # elastic "pen wobble": smooth sinusoidal displacement, like handwriting
        hh, ww = ink.shape
        yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
        amp, period = rng.uniform(0.5, 2.0), rng.uniform(15, 45)
        phase = rng.uniform(0, 6.28)
        map_x = xx + amp * np.sin(yy / period * 6.28 + phase)
        map_y = yy + amp * np.sin(xx / (period * 1.7) * 6.28 + phase)
        ink = cv2.remap(ink, map_x, map_y, cv2.INTER_LINEAR, borderValue=0)
    angle = rng.uniform(-4, 4)
    shear = rng.uniform(-0.25, 0.25) if rng.random() < 0.5 else 0.0
    hh, ww = ink.shape
    m = cv2.getRotationMatrix2D((ww / 2, hh / 2), angle, 1.0)
    m[0, 1] += shear
    m[0, 2] -= shear * hh / 2
    ink = cv2.warpAffine(ink, m, (ww, hh), flags=cv2.INTER_LINEAR, borderValue=0)
    ys, xs = np.where(ink > 20)
    if ys.size:
        top, bot = max(ys.min() - rng.randint(1, pad), 0), min(ys.max() + rng.randint(1, pad), hh)
        left, right = max(xs.min() - rng.randint(1, pad), 0), min(xs.max() + rng.randint(1, pad), ww)
        ink = ink[top:bot, left:right]
    if rng.random() < 0.3 and ink.shape[1] > 60:  # partial line, as produced by a tight crop
        keep = int(ink.shape[1] * rng.uniform(0.55, 0.95))
        start = rng.randint(0, ink.shape[1] - keep)
        ink = ink[:, start:start + keep]
    paper = rng.uniform(170, 250)
    pen = rng.uniform(0, 90)
    alpha = ink.astype(np.float32) / 255.0
    img = paper * (1 - alpha) + pen * alpha
    if rng.random() < 0.3:  # uneven lighting
        grad = np.linspace(rng.uniform(-25, 0), rng.uniform(0, 25), img.shape[1], dtype=np.float32)
        img = img + grad[None, :]
    if rng.random() < 0.5:
        img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.3, 1.3))
    img = img + np.random.default_rng(rng.randint(0, 2**31)).normal(0, rng.uniform(0, 12), img.shape)
    img = np.clip(img, 0, 255).astype(np.uint8)
    if rng.random() < 0.4:
        ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(30, 90)])
        img = cv2.imdecode(enc, cv2.IMREAD_GRAYSCALE)
    return img


def render_split(split: str, per_class: int, font_split: str, seed: int) -> dict:
    rng = random.Random(seed)
    pool = text_pool(split)
    images, labels, meta = [], [], []
    for ci, script in enumerate(CLASSES):
        font_list = fonts(script, font_split)
        fallback = latin_fallback(font_split) or latin_fallback("train")
        texts = pool[script]
        made = 0
        while made < per_class:
            text = rng.choice(texts)
            if rng.random() < 0.25:  # short fragments, e.g. a single word on a tight crop
                words = text.split()
                text = " ".join(words[:rng.randint(1, max(1, min(3, len(words))))])
            font = rng.choice(font_list)
            try:
                ink, used = render_line(text, [font] + fallback, rng.randint(26, 56))
            except ValueError:
                continue
            if ink.shape[1] < 8:
                continue
            img = augment(ink, rng)
            tensor = prepare_line(img)
            images.append(((tensor[0] * 0.5 + 0.5) * 255).astype(np.uint8))
            labels.append(ci)
            meta.append({"text": text, "font": font.name, "style": font.style,
                         "mixed": dominant_script(text) == "mixed"})
            made += 1
    order = list(range(len(labels)))
    rng.shuffle(order)
    return {"x": np.stack([images[i] for i in order]), "y": np.array([labels[i] for i in order], np.int64),
            "meta": [meta[i] for i in order]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--train-per-class", type=int, default=15000)
    ap.add_argument("--eval-per-class", type=int, default=1500)
    ap.add_argument("--seed", type=int, default=21)
    args = ap.parse_args()
    ensure(OUT)
    for split, n, font_split, seed in (("train", args.train_per_class, "train", args.seed),
                                       ("val", args.eval_per_class, "val", args.seed + 1),
                                       ("test", args.eval_per_class, "test", args.seed + 2)):
        data = render_split(split, n, font_split, seed)
        np.savez_compressed(OUT / f"{split}.npz", x=data["x"], y=data["y"],
                            meta=np.array([json.dumps(m, ensure_ascii=False) for m in data["meta"]]))
        fonts_used = sorted({m["font"] for m in data["meta"]})
        print(f"{split}: {len(data['y'])} lines, fonts={fonts_used}")
        if split == "test":
            grid = np.vstack([np.hstack(list(data["x"][r * 4:(r + 1) * 4])) for r in range(12)])
            cv2.imwrite(str(OUT / "samples.png"), grid)
    print(f"input size {INPUT_H}x{INPUT_W}; written to {OUT}")


if __name__ == "__main__":
    main()
