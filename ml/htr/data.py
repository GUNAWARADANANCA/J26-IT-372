"""Training data for the handwriting recogniser: cached real lines, synthetic lines, augmentation.

Real handwriting (prepared once by ``build_cache.py``)
    SinOCR handwritten   Sinhala lines from filled-in forms          (train / test as published)
    IAM lines            English lines                               (train / validation / test)
Synthetic lines (drawn fresh for every sample, train only)
    Sinhala composites   address text spelled with real handwritten characters of the 454-class set
    font lines           handwriting-style and printed fonts for English, Tamil and the Sinhala
                         letters the character set does not cover

There is no real Tamil handwriting in this training set: Tamil is learnt from fonts only.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.fonts import fonts  # noqa: E402
from common.paths import BACKEND_ROOT, HTR_DATA  # noqa: E402
from common.textrender import render_line  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.ocr.htr import prepare_line, to_target  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sinhala_glyphs import ABOVE, BELOW, BOTH, CLUSTER, form_of, spell  # noqa: E402

CACHE = HTR_DATA / "cache"
STORE_H = 64     # height of cached real lines and of the canvas synthetic lines are drawn on
XH = 24          # height of a bare Sinhala letter on that canvas
BASELINE = 46
FONT_SPLIT = {"train": "train", "val": "val", "test": "test"}


class Packed:
    """Many small grayscale images in one memory-mapped buffer (shared by the loader's worker processes)."""

    def __init__(self, stem: Path):
        self.index = np.load(f"{stem}.idx.npy")
        self.buf = np.load(f"{stem}.buf.npy", mmap_mode="r")

    def __len__(self) -> int:
        return len(self.index)

    def __getitem__(self, i: int) -> np.ndarray:
        off, h, w = self.index[i]
        return np.asarray(self.buf[off:off + h * w]).reshape(h, w)

    @staticmethod
    def write(stem: Path, images: list[np.ndarray]) -> None:
        index, off = [], 0
        for im in images:
            index.append((off, im.shape[0], im.shape[1]))
            off += im.size
        np.save(f"{stem}.idx.npy", np.array(index, dtype=np.int64).reshape(-1, 3))
        np.save(f"{stem}.buf.npy", np.concatenate([im.reshape(-1) for im in images]) if images else np.zeros(0, np.uint8))


def encode(text: str, index: dict[str, int]) -> list[int]:
    return [index[c] for c in to_target(text) if c in index]


# --------------------------------------------------------------------------- augmentation
def augment(ink: np.ndarray, rng: np.random.Generator, strength: float = 1.0) -> np.ndarray:
    """Vary slant, size, pen width, focus and paper of an ink line (float32 0..1, any size)."""
    h, w = ink.shape
    if rng.random() < 0.8 * strength:
        shear, slope, sx = rng.uniform(-0.3, 0.3), math.tan(math.radians(rng.uniform(-1.5, 1.5))), rng.uniform(0.85, 1.15)
        pad = int(abs(shear) * h + abs(slope) * w) + 4
        ink = cv2.copyMakeBorder(ink, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        hh, ww = ink.shape
        m = np.float32([[sx, shear, -shear * hh / 2], [slope, 1, -slope * ww / 2]])
        ink = cv2.warpAffine(ink, m, (int(ww * sx) + pad, hh), flags=cv2.INTER_LINEAR)
    pen = rng.random()
    if pen < 0.3 * strength:
        ink = cv2.dilate(ink, np.ones((2, 2) if rng.random() < 0.6 else (3, 3), np.uint8))
    elif pen < 0.45 * strength:
        ink = cv2.erode(ink, np.ones((2, 2), np.uint8))
    if rng.random() < 0.5 * strength:
        ink = cv2.GaussianBlur(ink, (0, 0), rng.uniform(0.4, 1.2))
    ink = np.clip(ink, 0, 1) ** rng.uniform(0.6, 1.6)
    hh, ww = ink.shape
    if rng.random() < 0.2 * strength:   # ruled or dotted form line under / through the writing
        y = int(rng.uniform(0.45, 0.95) * hh)
        level = rng.uniform(0.35, 1.0)
        if rng.random() < 0.5:
            thick = int(rng.integers(1, 3))
            ink[y:y + thick] = np.maximum(ink[y:y + thick], level)
        else:
            period = int(rng.integers(4, 9))
            ink[y:y + 2, ::period] = level
            ink[y:y + 2, 1::period] = level
    if rng.random() < 0.3 * strength:
        ink = ink + rng.normal(0, rng.uniform(0.01, 0.06), ink.shape).astype(np.float32)
    if rng.random() < 0.15 * strength:  # specks of dirt
        n = int(rng.integers(1, 6))
        ink[rng.integers(0, hh, n), rng.integers(0, ww, n)] = 1.0
    return np.clip(ink, 0, 1).astype(np.float32)


# --------------------------------------------------------------------------- synthetic lines
class Synth:
    def __init__(self, split: str):
        fsplit = FONT_SPLIT[split]
        self.pool = json.loads((CACHE / f"text_{'train' if split == 'train' else 'val'}.json").read_text(encoding="utf-8"))
        self.hand_en = fonts("en", fsplit, "handwriting") or fonts("en", "train", "handwriting")
        self.print_en = fonts("en", fsplit, "printed") or fonts("en", "train", "printed")
        self.fonts_ta = fonts("ta", fsplit)
        self.fonts_si = fonts("si", fsplit)
        gsplit = "train" if split == "train" else "valid"
        self.glyphs = Packed(CACHE / f"glyphs_{gsplit}")
        classes = np.load(CACHE / f"glyphs_{gsplit}.cls.npy")
        self.by_class = {int(c): np.where(classes == c)[0] for c in np.unique(classes)}

    # ---- fonts
    def font_line(self, text: str, script: str, rng: np.random.Generator) -> np.ndarray:
        latin = [self.hand_en[int(rng.integers(len(self.hand_en)))]] if rng.random() < 0.8 else \
            [self.print_en[int(rng.integers(len(self.print_en)))]]
        if script == "en":
            chain = latin + self.print_en
        else:
            own = self.fonts_ta if script == "ta" else self.fonts_si
            chain = [own[int(rng.integers(len(own)))]] + own + latin + self.print_en
        canvas, _ = render_line(text, chain, int(rng.integers(36, 56)))
        return canvas.astype(np.float32) / 255.0

    def _font_piece(self, text: str, rng: np.random.Generator, latin: bool) -> tuple[np.ndarray, int]:
        chain = [self.hand_en[int(rng.integers(len(self.hand_en)))]] + self.print_en if latin else \
            [self.fonts_si[int(rng.integers(len(self.fonts_si)))]] + self.fonts_si + self.print_en
        canvas, _ = render_line(text, chain, int(XH * 1.8), pad=1)
        rows = np.where(canvas.max(axis=1) > 40)[0]
        cols = np.where(canvas.max(axis=0) > 40)[0]
        if rows.size == 0:
            return np.zeros((2, XH // 2), np.float32), BASELINE - 2
        piece = canvas[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1].astype(np.float32) / 255.0
        drop = int(0.3 * XH) if text.strip() and all(c in ",;" for c in text.strip()) else 0
        return piece, BASELINE - piece.shape[0] + drop

    # ---- real handwritten characters
    def _glyph_piece(self, cid: int, rng: np.random.Generator, size: float) -> tuple[np.ndarray, int]:
        ids = self.by_class[cid]
        glyph = self.glyphs[int(ids[int(rng.integers(len(ids)))])]
        form = form_of(cid)
        ratio = 1.6 if form in BOTH else 1.3 if form in ABOVE or form in BELOW else 1.0
        target = max(6, int(round(XH * size * ratio * rng.uniform(0.9, 1.1))))
        scale = target / glyph.shape[0]
        width = int(np.clip(round(glyph.shape[1] * scale), 4, 2.4 * target))
        piece = cv2.resize(glyph, (width, target), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
        piece = piece.astype(np.float32) / 255.0
        xh = XH * size
        top = BASELINE - xh if form in BELOW else BASELINE - 1.3 * xh if form in BOTH else BASELINE - target
        return piece, int(round(top + rng.uniform(-1.5, 1.5)))

    def sinhala_line(self, text: str, rng: np.random.Generator) -> np.ndarray:
        """``text`` spelled with handwritten characters; anything the set lacks comes from a font."""
        size, gap, word_gap = rng.uniform(0.85, 1.15), rng.uniform(-1.0, 3.0), rng.uniform(0.5, 1.0) * XH
        pieces, x = [], 6.0
        for word in text.split(" "):
            i = 0
            while i < len(word):
                m = CLUSTER.match(word, i)
                if m:
                    cluster, i = m.group(0), m.end()
                    ids = spell(cluster)
                    if ids is None or any(c not in self.by_class for c in ids):
                        parts = [self._font_piece(cluster, rng, latin=False)]
                    else:
                        parts = [self._glyph_piece(c, rng, size) for c in ids]
                        if cluster[-1] in "ංඃ":
                            parts.append(self._font_piece(cluster[-1], rng, latin=False))
                else:
                    j = i + 1
                    while j < len(word) and not CLUSTER.match(word, j):
                        j += 1
                    parts, i = [self._font_piece(word[i:j], rng, latin=True)], j
                for piece, top in parts:
                    pieces.append((piece, int(x), top))
                    x += piece.shape[1] + gap + rng.uniform(-0.5, 1.5)
            x += word_gap
        canvas = np.zeros((STORE_H + 16, int(x) + 8), np.float32)
        for piece, px, top in pieces:
            top = int(np.clip(top + 8, 0, canvas.shape[0] - 1))
            ph, pw = min(piece.shape[0], canvas.shape[0] - top), min(piece.shape[1], canvas.shape[1] - px)
            if ph > 0 and pw > 0:
                region = canvas[top:top + ph, px:px + pw]
                np.maximum(region, piece[:ph, :pw], out=region)
        return canvas

    def text(self, script: str, rng: np.random.Generator, max_chars: int = 46) -> str:
        lines = self.pool[script]
        words = lines[int(rng.integers(len(lines)))].split()
        if rng.random() < 0.25 and len(words) > 1:   # short lines: a name, a house number, a town
            start = int(rng.integers(len(words)))
            words = words[start:start + int(rng.integers(1, 3))]
        out = ""
        for word in words:
            if out and len(out) + len(word) + 1 > max_chars:
                break
            out = f"{out} {word}".strip()
        return out[:max_chars]


# --------------------------------------------------------------------------- datasets
class TrainLines(torch.utils.data.Dataset):
    """One epoch = every real training line (Sinhala repeated) plus freshly drawn synthetic lines."""

    def __init__(self, charset: list[str], plan: dict[str, int]):
        self.index = {c: i for i, c in enumerate(charset)}
        meta = json.loads((CACHE / "real_train.json").read_text(encoding="utf-8"))
        self.texts, sources = meta["texts"], meta["sources"]
        iam = [i for i, s in enumerate(sources) if s == "iam"]
        sinocr = [i for i, s in enumerate(sources) if s == "sinocr"]
        self.items = [("real", i) for i in iam] + [("real", i) for i in sinocr] * plan["sinocr_repeat"]
        for kind in ("si_comp", "si_font", "en_font", "ta_font"):
            self.items += [(kind, 0)] * plan[kind]
        self.real = self.synth = self.rng = None

    def __len__(self) -> int:
        return len(self.items)

    def _open(self) -> None:  # per worker process
        info = torch.utils.data.get_worker_info()
        self.rng = np.random.default_rng((torch.initial_seed() + (info.id if info else 0)) % (2 ** 32))
        self.real, self.synth = Packed(CACHE / "real_train"), Synth("train")

    def __getitem__(self, i: int):
        if self.rng is None:
            self._open()
        kind, ref = self.items[i]
        rng = self.rng
        for _ in range(8):
            if kind == "real":
                ink, text = self.real[ref].astype(np.float32) / 255.0, self.texts[ref]
                ink = augment(ink, rng, 0.7)
            else:
                script = {"si_comp": "si", "si_font": "si", "en_font": "en", "ta_font": "ta"}[kind]
                text = self.synth.text(script, rng)
                try:
                    ink = self.synth.sinhala_line(text, rng) if kind == "si_comp" else self.synth.font_line(text, script, rng)
                except ValueError:   # no font covers a character of this line
                    continue
                ink = augment(ink, rng, 1.0)
            target = encode(text, self.index)
            image = prepare_line(ink)
            if target and image.shape[2] // 4 >= len(target) + 2:
                return torch.from_numpy(image), torch.tensor(target, dtype=torch.long), to_target(text), kind
            if kind == "real":   # unusable (empty label or far too narrow): take another real line
                ref = int(rng.integers(len(self.texts)))
        raise RuntimeError("could not build a training sample")


class FixedLines(torch.utils.data.Dataset):
    """Evaluation lines, identical on every pass: cached real lines, or synthetic lines with a fixed seed."""

    def __init__(self, charset: list[str], samples: list[tuple[np.ndarray, str, str]]):
        self.index = {c: i for i, c in enumerate(charset)}
        self.samples = samples

    @classmethod
    def real(cls, charset: list[str], split: str, source: str | None = None) -> "FixedLines":
        meta = json.loads((CACHE / f"real_{split}.json").read_text(encoding="utf-8"))
        packed = Packed(CACHE / f"real_{split}")
        keep = [i for i, s in enumerate(meta["sources"]) if source in (None, s)]
        return cls(charset, [(packed[i].astype(np.float32) / 255.0, meta["texts"][i], meta["sources"][i]) for i in keep])

    @classmethod
    def font(cls, charset: list[str], split: str, script: str, n: int, seed: int = 7) -> "FixedLines":
        synth, rng, samples = Synth(split), np.random.default_rng(seed), []
        while len(samples) < n:
            text = synth.text(script, rng)
            try:
                samples.append((synth.font_line(text, script, rng), text, f"{script}_font"))
            except ValueError:
                continue
        return cls(charset, samples)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        ink, text, source = self.samples[i]
        return torch.from_numpy(prepare_line(ink)), torch.tensor(encode(text, self.index), dtype=torch.long), to_target(text), source


class Chunker:
    """Collate function: sort a chunk of lines by width and cut it into mini-batches (little padding)."""

    def __init__(self, batch_size: int):
        self.batch_size = batch_size

    def __call__(self, batch):
        batch = sorted(batch, key=lambda item: item[0].shape[2])
        out = []
        for start in range(0, len(batch), self.batch_size):
            part = batch[start:start + self.batch_size]
            # A few fixed widths instead of one per batch: the GPU allocator can reuse its blocks.
            width = math.ceil(max(item[0].shape[2] for item in part) / 64) * 64
            images = torch.zeros(len(part), 1, part[0][0].shape[1], width)
            for k, item in enumerate(part):
                images[k, :, :, :item[0].shape[2]] = item[0]
            out.append((images, torch.tensor([item[0].shape[2] // 4 for item in part]),
                        torch.cat([item[1] for item in part]), torch.tensor([len(item[1]) for item in part]),
                        [item[2] for item in part], [item[3] for item in part]))
        return out
