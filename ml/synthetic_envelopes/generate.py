"""Generate a synthetic envelope image set with exact ground truth.

    ml/.venv/Scripts/python ml/synthetic_envelopes/generate.py [--per-script 120]

Mirrors the design of the proposal's evaluation set (section 3.3): 120 envelopes
per script (Sinhala, Tamil, English), half printed and half handwriting-style,
grouped dev/val/test splits (60/20/20) by base address and font ("writer").
Each image shows an envelope lying on the wooden scale platform as the
ESP32-CAM sees it: sender block, stamp, recipient block, slight perspective,
blur, uneven light and JPEG compression.

IMPORTANT: this is a *pipeline-validation* set. It lets you run the OCR
benchmark (B1 vs P1) before real envelopes are collected; it does not replace
the consented envelope dataset and must be reported as synthetic. No Sinhala
handwriting font exists in the public sources, so Sinhala "handwriting" is a
printed font with simulated slant/jitter.

Output: Datasets/processed/synthetic_envelopes/images/*.jpg (git-ignored)
        Datasets/processed/synthetic_envelopes/annotations.jsonl (committed)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

import cv2
import numpy as np

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
sys.path.insert(0, str(ML / "address_parser"))
from build_corpus import Generator, load_resources  # noqa: E402
from common.fonts import fonts, latin_fallback  # noqa: E402
from common.paths import BACKEND_ROOT, PROCESSED, ensure  # noqa: E402
from common.textrender import render_line  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.address.parser import fields_from_labels  # noqa: E402
from app.services.address.text import normalize_text, tokenize  # noqa: E402

OUT = PROCESSED / "synthetic_envelopes"
W, H = 1800, 1000  # envelope canvas (C5-like proportions)


def paper(rng: random.Random) -> np.ndarray:
    kraft = rng.random() < 0.25
    base = np.array([150, 190, 215] if kraft else [rng.randint(225, 250)] * 3, np.float32)  # BGR
    img = np.ones((H, W, 3), np.float32) * base
    noise = np.random.default_rng(rng.randint(0, 2**31)).normal(0, 4, (H // 8, W // 8)).astype(np.float32)
    img += cv2.resize(noise, (W, H))[..., None]  # soft paper texture
    return img


def draw_text_block(img, lines, x, y, font_list, fallback, px, ink, rng, handwriting):
    for line in lines:
        mask, _ = render_line(line, font_list + fallback, px)
        if handwriting:  # simulated pen: slant + baseline wobble
            h, w = mask.shape
            m = np.float32([[1, rng.uniform(-0.25, 0.05), 0], [0, 1, 0]])
            mask = cv2.warpAffine(mask, m, (w + h // 3, h))
            mask = cv2.dilate(mask, np.ones((2, 2), np.uint8)) if rng.random() < 0.5 else mask
        h, w = mask.shape
        if x + w >= W or y + h >= H:
            mask = mask[: max(0, H - y - 1), : max(0, W - x - 1)]
            h, w = mask.shape
        a = (mask.astype(np.float32) / 255.0)[..., None]
        img[y:y + h, x:x + w] = img[y:y + h, x:x + w] * (1 - a) + np.array(ink, np.float32) * a
        y += int(px * (1.45 + rng.uniform(-0.1, 0.25)))
    return y


def _renderable(text, font_list) -> bool:
    try:
        render_line(text, font_list, 20)
        return True
    except ValueError:
        return False


def stamp(img, rng):
    x0, y0 = W - 260, 40
    color = np.array([rng.randint(40, 200), rng.randint(40, 200), rng.randint(40, 200)], np.float32)
    cv2.rectangle(img, (x0, y0), (x0 + 190, y0 + 230), color.tolist(), -1)
    for i in range(0, 190, 14):  # perforation
        for yy in (y0, y0 + 230):
            cv2.circle(img, (x0 + i, yy), 5, (245, 245, 245), -1)
    if rng.random() < 0.6:  # postmark ring
        c = (rng.randint(x0 - 120, x0 - 40), y0 + 120)
        cv2.circle(img, c, 85, (60, 60, 60), 3)
        cv2.circle(img, c, 60, (60, 60, 60), 2)


def photograph(env: np.ndarray, rng: random.Random) -> np.ndarray:
    """Place the envelope on a wooden platform and simulate the ESP32-CAM view."""
    bg_h, bg_w = 1536, 2048
    wood = np.ones((bg_h, bg_w, 3), np.float32) * np.array([70, 110, 150], np.float32)
    grain = np.random.default_rng(rng.randint(0, 2**31)).normal(0, 12, (bg_h, 1)).astype(np.float32)
    wood += cv2.GaussianBlur(np.repeat(grain, bg_w, 1), (0, 0), 3)[..., None]
    scale = rng.uniform(0.95, 1.05)
    ew, eh = int(W * scale), int(H * scale)
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    cx, cy = bg_w / 2 + rng.uniform(-60, 60), bg_h / 2 + rng.uniform(-60, 60)
    ang = np.deg2rad(rng.uniform(-5, 5))
    corners = []
    for px, py in [(-ew / 2, -eh / 2), (ew / 2, -eh / 2), (ew / 2, eh / 2), (-ew / 2, eh / 2)]:
        jitter = rng.uniform(-18, 18)
        corners.append([cx + px * np.cos(ang) - py * np.sin(ang) + jitter, cy + px * np.sin(ang) + py * np.cos(ang) + jitter])
    m = cv2.getPerspectiveTransform(src, np.float32(corners))
    warped = cv2.warpPerspective(env, m, (bg_w, bg_h), borderValue=0)
    mask = cv2.warpPerspective(np.ones((H, W), np.float32), m, (bg_w, bg_h))[..., None]
    img = wood * (1 - mask) + warped * mask
    grad = np.linspace(rng.uniform(-35, 5), rng.uniform(-5, 30), bg_w, dtype=np.float32)[None, :, None]
    img = img + grad
    if rng.random() < 0.7:
        img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.4, 1.6))
    img += np.random.default_rng(rng.randint(0, 2**31)).normal(0, rng.uniform(2, 7), img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-script", type=int, default=120)
    ap.add_argument("--seed", type=int, default=41)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    gen = Generator(load_resources(), rng)
    ensure(OUT / "images")
    records = []
    for script in ("si", "ta", "en"):
        i = 0
        while i < args.per_script:
            handwriting = i % 2 == 1
            style = "handwriting" if handwriting else "printed"
            pool = fonts(script, None, "handwriting") if handwriting and script != "si" else fonts(script, "train", "printed")
            pool = [f for f in pool if f.path.suffix == ".ttf"] or fonts(script)
            font = rng.choice(pool)
            fallback = latin_fallback("train")
            while True:
                rec = gen.make(script, mixed=rng.random() < 0.15, envelope=True)
                if "\n" in rec["text"]:
                    break
            sender = gen.make(script, envelope=True)
            norm = normalize_text(rec["text"])
            toks = tokenize(norm)
            truth, _ = fields_from_labels(norm, toks, rec["labels"])
            all_lines = rec["text"].splitlines() + sender["text"].splitlines()
            if not all(_renderable(line, [font] + fallback) for line in all_lines):
                continue
            env = paper(rng)
            stamp(env, rng)
            ink = [rng.randint(20, 90), rng.randint(10, 40), rng.randint(0, 30)] if rng.random() < 0.5 else [30, 30, 30]
            if rng.random() < 0.8:
                draw_text_block(env, ["From:"] + sender["text"].split("\n")[:4], 60, 50, [font], fallback,
                                rng.randint(24, 30), ink, rng, handwriting)
            lines = norm.split("\n")
            draw_text_block(env, lines, int(W * rng.uniform(0.36, 0.45)), int(H * rng.uniform(0.42, 0.5)), [font],
                            fallback, rng.randint(40, 52), ink, rng, handwriting)
            img = photograph(env, rng)
            image_id = f"SYN-{script.upper()}-{i + 1:03d}"
            cv2.imwrite(str(OUT / "images" / f"{image_id}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(70, 92)])
            group = hashlib.sha256(f"{font.name}:{rec['group']}".encode()).hexdigest()
            split = ["dev"] * 6 + ["val"] * 2 + ["test"] * 2
            records.append({"image_id": image_id, "file": f"images/{image_id}.jpg", "script": rec["script"],
                            "style": style, "font": font.name, "writer_code": font.name, "base_address_id": rec["group"],
                            "split": split[int(group, 16) % 10], "recipient_text": norm, "recipient": truth,
                            "synthetic": True})
            i += 1
        print(f"{script}: {args.per_script} envelopes")
    with (OUT / "annotations.jsonl").open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(records)} envelopes to {OUT}")


if __name__ == "__main__":
    main()
