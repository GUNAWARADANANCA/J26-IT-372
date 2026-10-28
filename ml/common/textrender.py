"""Render text lines with correct Sinhala / Tamil shaping.

Pillow's Windows wheels have no complex-text layout (no libraqm), which breaks
Sinhala conjuncts (e.g. 'ශ්‍රී') and Tamil vowel signs. This module shapes text
with HarfBuzz (``uharfbuzz``) and rasterises glyphs with FreeType
(``freetype-py``), so rendered training images match how the scripts really
look on envelopes.

Mixed-script lines ("No. 25, ගාලු පාර") are split into runs and each run is
drawn with the first font in the fallback list that covers it.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import freetype
import numpy as np
import uharfbuzz as hb


@dataclass(frozen=True)
class FontSpec:
    path: Path
    script: str            # primary script: si / ta / en
    style: str             # "printed" or "handwriting"
    index: int = 0         # face index for .ttc collections

    @property
    def name(self) -> str:
        return self.path.stem + (f"#{self.index}" if self.index else "")


class ShapedFont:
    def __init__(self, spec: FontSpec):
        self.spec = spec
        blob = hb.Blob.from_file_path(str(spec.path))
        self.face = hb.Face(blob, spec.index)
        self.hb_font = hb.Font(self.face)
        self.ft = freetype.Face(str(spec.path), index=spec.index)
        self._glyph_cache: dict[tuple[int, int], tuple] = {}
        self.size = 0

    def covers(self, text: str) -> bool:
        return all(ch.isspace() or ord(ch) in (0x200C, 0x200D) or self.ft.get_char_index(ord(ch)) for ch in text)

    def set_size(self, px: int) -> None:
        if px != self.size:
            self.ft.set_pixel_sizes(0, px)
            self.hb_font.scale = (px * 64, px * 64)
            self.size = px

    def _glyph(self, gid: int) -> tuple:
        key = (self.size, gid)
        if key not in self._glyph_cache:
            self.ft.load_glyph(gid, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_NORMAL)
            g = self.ft.glyph
            bm = g.bitmap
            arr = np.array(bm.buffer, dtype=np.uint8).reshape(bm.rows, bm.pitch)[:, :bm.width] if bm.rows else \
                np.zeros((0, 0), np.uint8)
            self._glyph_cache[key] = (arr, g.bitmap_left, g.bitmap_top)
        return self._glyph_cache[key]

    def shape(self, text: str):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf, {"kern": True, "liga": True})
        return buf.glyph_infos, buf.glyph_positions

    def metrics(self) -> tuple[float, float]:
        m = self.ft.size
        return m.ascender / 64.0, -m.descender / 64.0


@lru_cache(maxsize=64)
def load_font(spec: FontSpec) -> ShapedFont:
    return ShapedFont(spec)


def _runs(text: str) -> list[tuple[str, str]]:
    """Split text into (script, run) pieces; neutral characters join the current run."""
    from_script = []
    for ch in text:
        cp = ord(ch)
        if 0x0D80 <= cp <= 0x0DFF:
            s = "si"
        elif 0x0B80 <= cp <= 0x0BFF:
            s = "ta"
        elif ch.isalpha():
            s = "en"
        else:
            s = None
        from_script.append(s)
    runs, cur, cur_s = [], [], None
    for ch, s in zip(text, from_script):
        if s is not None and cur_s is not None and s != cur_s:
            runs.append((cur_s, "".join(cur)))
            cur = []
        if s is not None:
            cur_s = s
        cur.append(ch)
    if cur:
        runs.append((cur_s or "en", "".join(cur)))
    return runs


def render_line(text: str, fonts: list[FontSpec], px: int, pad: int = 4) -> tuple[np.ndarray, list[str]]:
    """Render ``text`` as a grayscale ink image (0 = background, 255 = ink).

    ``fonts`` is an ordered fallback list. Returns the image and the names of
    the fonts actually used. Raises ValueError if no font covers a run.
    """
    pieces = []
    used = []
    for _script, run in _runs(text):
        font = next((load_font(f) for f in fonts if load_font(f).covers(run)), None)
        if font is None:
            raise ValueError(f"no font covers {run!r}")
        font.set_size(px)
        pieces.append((font, run))
        used.append(font.spec.name)

    ascent = max(f.metrics()[0] for f, _ in pieces)
    descent = max(f.metrics()[1] for f, _ in pieces)
    height = int(np.ceil(ascent + descent)) + 2 * pad
    shaped = [(f, *f.shape(run)) for f, run in pieces]
    width = int(sum(sum(p.x_advance for p in pos) / 64.0 for _, _, pos in shaped)) + 2 * pad + px
    canvas = np.zeros((height, width), dtype=np.uint8)
    baseline = pad + ascent
    pen = float(pad)
    for font, infos, positions in shaped:
        for info, pos in zip(infos, positions):
            bmp, left, top = font._glyph(info.codepoint)
            if bmp.size:
                x = int(round(pen + pos.x_offset / 64.0 + left))
                y = int(round(baseline - pos.y_offset / 64.0 - top))
                h, w = bmp.shape
                x0, y0 = max(x, 0), max(y, 0)
                x1, y1 = min(x + w, width), min(y + h, height)
                if x1 > x0 and y1 > y0:
                    region = canvas[y0:y1, x0:x1]
                    np.maximum(region, bmp[y0 - y:y1 - y, x0 - x:x1 - x], out=region)
            pen += pos.x_advance / 64.0
    cols = np.where(canvas.max(axis=0) > 0)[0]
    if cols.size:
        canvas = canvas[:, max(cols[0] - pad, 0):cols[-1] + pad + 1]
    return canvas, used
