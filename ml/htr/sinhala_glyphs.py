"""Class labels of the 454-class Sinhala handwritten character set, and how to spell a word with them.

The archive (folders ``Dataset454/{train,valid,test}/<1..454>``) ships without a label file.
The labels below were read from sample sheets of every class by the author of this script, not
taken from the dataset's publisher. Classes follow the syllabary order: 11 independent vowels,
then one block per consonant (bare, ා ැ ෑ ි ී ු ූ, hal, the tail of ෝ, rakaransaya forms).
Only classes that could be read with confidence are listed (270 of 454); aspirated and
prenasalised consonants, whose handwritten shapes are too close to tell apart, are left out and
come from fonts instead.
"""
from __future__ import annotations

import re

HAL, ZWJ = "්", "‍"
O_TAIL = "ෝt"          # what is written after the kombuva of ෝ: the consonant with ා and a hal mark
RA = HAL + ZWJ + "ර"   # rakaransaya
KOMBUVA, AELA = 452, 405

_FULL = ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ි", RA + "ී"]
_BLOCKS: list[tuple[str, int, list[str | None]]] = [
    ("ක", 12, _FULL), ("ග", 25, _FULL), ("ච", 38, _FULL), ("ජ", 51, _FULL), ("ට", 64, _FULL), ("ඩ", 77, _FULL),
    ("ණ", 90, ["", "ා", "ි"]),
    ("ත", 93, ["", "ා", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී"]),
    ("ද", 105, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, None, RA + "ා", RA + "ි", RA + "ී"]),
    ("න", 120, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී"]),
    ("ප", 134, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, None, O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී"]),
    ("බ", 149, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී"]),
    ("ම", 164, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී"]),
    ("ය", 179, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", None, HAL, O_TAIL]),
    ("ර", 190, ["", "ා", "ැ", "ෑ", "ු", "ූ", "ි", "ී"]),
    ("ල", 198, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL]),
    ("ව", 208, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා"]),
    ("ශ", 223, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL, RA, RA + "ා", None, None, RA + "ි", RA + "ී"]),
    ("ෂ", 240, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL]),
    ("ස", 250, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", O_TAIL, RA, RA + "ා", RA + "ි", RA + "ී", HAL]),
    ("හ", 264, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ", HAL, O_TAIL]),
    ("ළ", 274, ["", "ා", "ැ", "ෑ", "ි", "ී", "ු", "ූ"]),
]

# (consonant or vowel, form) -> class id
CLASS_OF: dict[tuple[str, str], int] = {(v, ""): i + 1 for i, v in enumerate("අආඇඈඉඊඋඑඒඔඕ")}
for _base, _first, _forms in _BLOCKS:
    for _k, _form in enumerate(_forms):
        if _form is not None:
            CLASS_OF[(_base, _form)] = _first + _k

# How tall a form is next to a bare letter, and whether the extra part hangs below the baseline.
ABOVE = {"ි", "ී", HAL, O_TAIL}
BELOW = {"ු", "ූ", RA, RA + "ා"}
BOTH = {RA + "ි", RA + "ී"}

_CONSONANT = "[ක-ෆ]"
_SIGN = "[ා-ෟෲෳ]"
CLUSTER = re.compile(f"{_CONSONANT}(?:{HAL}{ZWJ}[රය])?(?:{_SIGN}|{HAL})?[ංඃ]?|[අ-ඖ][ංඃ]?")


def spell(cluster: str) -> list[int] | None:
    """Class ids that draw one Sinhala syllable, left to right, or None when a part is missing.

    A trailing ං / ඃ is not part of the result (the caller draws it).
    """
    cluster = cluster.rstrip("ංඃ")
    base, rest = cluster[0], cluster[1:]
    if (base, "") in CLASS_OF and not rest:
        return [CLASS_OF[(base, "")]]
    conjunct = ""
    if rest.startswith(RA):
        conjunct, rest = RA, rest[len(RA):]
    elif rest.startswith(HAL + ZWJ):
        return None  # yansaya: no class
    before, form = [], conjunct + rest
    if rest in ("ෙ", "ේ", "ො", "ෝ", "ෛ"):
        before = [KOMBUVA, KOMBUVA] if rest == "ෛ" else [KOMBUVA]
        form = conjunct + {"ෙ": "", "ේ": HAL, "ො": "ා", "ෝ": O_TAIL, "ෛ": ""}[rest]
    cid = CLASS_OF.get((base, form))
    return None if cid is None else before + [cid]


def form_of(cid: int) -> str:
    return next((form for (_, form), c in CLASS_OF.items() if c == cid), "")
