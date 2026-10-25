"""Font registry for rendering training / evaluation images.

Fonts are split into *train*, *validation* and *held-out test* sets per script
so that model selection and the final test both measure generalisation to
typefaces never seen in training (stricter than a random split of lines).

Windows' Nirmala UI (covers Sinhala and Tamil) is used as an extra held-out
font when present. It is read from C:/Windows/Fonts and is never copied into
the repository because its licence does not allow redistribution.
"""
from __future__ import annotations

from pathlib import Path

from .paths import FONTS
from .textrender import FontSpec

# (file, script, style, split)
_REGISTRY = [
    # Sinhala
    ("NotoSansSinhala.ttf", "si", "printed", "train"),
    ("NotoSerifSinhala.ttf", "si", "printed", "train"),
    ("AbhayaLibre-Regular.ttf", "si", "printed", "train"),
    ("AbhayaLibre-Bold.ttf", "si", "printed", "train"),
    ("GemunuLibre.ttf", "si", "printed", "val"),
    ("StickNoBills.ttf", "si", "display", "train"),
    ("Yaldevi.ttf", "si", "printed", "test"),
    # Tamil
    ("NotoSansTamil.ttf", "ta", "printed", "train"),
    ("NotoSerifTamil.ttf", "ta", "printed", "train"),
    ("HindMadurai-Regular.ttf", "ta", "printed", "train"),
    ("MuktaMalar-Regular.ttf", "ta", "printed", "val"),
    ("Catamaran.ttf", "ta", "printed", "train"),
    ("MeeraInimai-Regular.ttf", "ta", "printed", "train"),
    ("BalooThambi2.ttf", "ta", "printed", "train"),
    ("Kavivanar-Regular.ttf", "ta", "handwriting", "train"),
    ("TiroTamil-Regular.ttf", "ta", "printed", "test"),
    ("Pavanam-Regular.ttf", "ta", "printed", "test"),
    # Latin
    ("NotoSans.ttf", "en", "printed", "train"),
    ("NotoSerif.ttf", "en", "printed", "train"),
    ("SourceSans3.ttf", "en", "printed", "val"),
    ("CourierPrime-Regular.ttf", "en", "printed", "train"),
    ("Caveat.ttf", "en", "handwriting", "train"),
    ("Kalam-Regular.ttf", "en", "handwriting", "train"),
    ("PatrickHand-Regular.ttf", "en", "handwriting", "val"),
    ("ShadowsIntoLight.ttf", "en", "handwriting", "train"),
    ("Merriweather.ttf", "en", "printed", "test"),
    ("IndieFlower-Regular.ttf", "en", "handwriting", "test"),
]

SYSTEM_NIRMALA = Path("C:/Windows/Fonts/Nirmala.ttc")


def fonts(script: str | None = None, split: str | None = None, style: str | None = None) -> list[FontSpec]:
    out = []
    for file, sc, st, sp in _REGISTRY:
        if (script and sc != script) or (split and sp != split) or (style and st != style):
            continue
        path = FONTS / file
        if path.exists():
            out.append(FontSpec(path, sc, st))
    if split in (None, "test") and SYSTEM_NIRMALA.exists() and script in (None, "si", "ta") and style in (None, "printed"):
        for sc in ("si", "ta"):
            if script in (None, sc):
                out.append(FontSpec(SYSTEM_NIRMALA, sc, "printed", 0))
    return out


def latin_fallback(split: str = "train") -> list[FontSpec]:
    """Latin fonts used for digits/Latin runs inside Sinhala or Tamil lines."""
    return fonts("en", split, "printed")
