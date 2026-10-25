"""Unicode-aware text helpers for trilingual (Sinhala / Tamil / English) addresses.

These functions are shared by the API and by the training scripts in ``ml/``
so that a model is always trained on exactly the tokenisation it sees at
inference time.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

SINHALA = (0x0D80, 0x0DFF)
TAMIL = (0x0B80, 0x0BFF)
ZWJ, ZWNJ = chr(0x200D), chr(0x200C)  # zero-width joiner / non-joiner

# Characters removed during normalisation. ZWJ/ZWNJ are kept because Sinhala
# uses them for yansaya, rakaransaya and touching-letter forms.
_INVISIBLE = dict.fromkeys([0x200B, 0x2060, 0xFEFF, 0x00AD], None)  # ZWSP, word joiner, BOM, soft hyphen
_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "，": ",", "、": ","})


def char_script(ch: str) -> str:
    cp = ord(ch)
    if SINHALA[0] <= cp <= SINHALA[1]:
        return "si"
    if TAMIL[0] <= cp <= TAMIL[1]:
        return "ta"
    if ch.isdigit() and cp < 128:
        return "digit"
    if ch.isalpha() and cp < 0x0250:
        return "en"
    if ch.isspace():
        return "space"
    if ch in (ZWJ, ZWNJ):
        return "joiner"
    if unicodedata.category(ch).startswith("P") or ch in "/#-":
        return "punct"
    return "other"


def script_counts(text: str) -> Counter:
    return Counter(s for s in map(char_script, text) if s in ("si", "ta", "en"))


def dominant_script(text: str, mixed_share: float = 0.2) -> str:
    """Return 'si', 'ta', 'en', 'mixed' or 'none' for a piece of text.

    'mixed' means at least two scripts each contribute ``mixed_share`` of the
    letters (digits and punctuation are ignored).
    """
    counts = script_counts(text)
    total = sum(counts.values())
    if total == 0:
        return "none"
    major = [s for s, n in counts.items() if n / total >= mixed_share]
    if len(major) > 1:
        return "mixed"
    return counts.most_common(1)[0][0]


def primary_script(text: str) -> str:
    """Most frequent letter script, ignoring the 'mixed' distinction."""
    counts = script_counts(text)
    return counts.most_common(1)[0][0] if counts else "none"


def token_script(token: str) -> str:
    kinds = {char_script(c) for c in token} - {"joiner", "punct", "space"}
    if not kinds:
        return "punct"
    if kinds == {"digit"}:
        return "digit"
    letters = kinds - {"digit", "other"}
    if len(letters) == 1:
        script = letters.pop()
        return script + ("+d" if "digit" in kinds else "")
    if not letters:
        return "other"
    return "mixed"


def normalize_text(text: str) -> str:
    """Safe normalisation: Unicode NFC, invisible characters, quotes, spacing.

    It never changes letters or digits, so it cannot introduce an unsupported
    address change.
    """
    text = unicodedata.normalize("NFC", text or "")
    text = text.translate(_INVISIBLE).translate(_QUOTES)
    lines = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = re.sub(r"[ \t ]+", " ", line).strip()
        line = re.sub(r"\s+([,;])", r"\1", line)
        if line:
            lines.append(line)
    return "\n".join(lines)


@dataclass(frozen=True)
class Token:
    text: str
    line: int
    start: int  # character offset in the normalised text
    end: int
    trailing_comma: bool = False


_TOKEN_RE = re.compile(r"[^\s,;]+")
_STRIP = "()[]{}\"'"
# "No.25", "No:25", "අංක25", "இல.25" -> marker + number
_GLUED_MARKER = re.compile(r"^(No\.?|No:|NO\.?|no\.?|අංක[.:]?|இல[.:]?)(\d.*)$")


def tokenize(text: str) -> list[Token]:
    """Split an address into tokens, remembering line numbers and commas."""
    text = normalize_text(text)
    tokens: list[Token] = []
    offset = 0
    for line_no, line in enumerate(text.split("\n")):
        for m in _TOKEN_RE.finditer(line):
            raw = m.group(0)
            start, end = m.start(), m.end()
            lead = len(raw) - len(raw.lstrip(_STRIP))
            raw = raw.strip(_STRIP)
            if not raw:
                continue
            start += lead
            end = start + len(raw)
            comma = end < len(line) and line[end:end + 2].lstrip(_STRIP)[:1] in (",", ";")
            glued = _GLUED_MARKER.match(raw)
            if glued:
                marker = glued.group(1)
                tokens.append(Token(marker, line_no, offset + start, offset + start + len(marker)))
                tokens.append(Token(glued.group(2), line_no, offset + start + len(marker), offset + end, comma))
            else:
                tokens.append(Token(raw, line_no, offset + start, offset + end, comma))
        offset += len(line) + 1
    return tokens


def digits_in(text: str) -> list[str]:
    """All digit runs, e.g. 'No. 25/3, Colombo 03' -> ['25', '3', '03']."""
    return re.findall(r"\d+", text or "")
