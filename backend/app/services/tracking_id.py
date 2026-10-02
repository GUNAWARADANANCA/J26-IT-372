"""Opaque registered-item identifiers, e.g. ``PA-DEMO-7K3M9Q2XRH4``.

* 10 random Crockford base-32 characters (50 bits): not sequential, so an
  identifier cannot be guessed from a neighbour's receipt.
* 1 check character (value mod 37, Crockford scheme) that catches every
  single-character substitution and adjacent transposition when an ID is
  typed by hand.
* The ``PA-DEMO`` prefix marks prototype identifiers; using an official postal
  numbering range requires an allocation from the Department of Posts.
* The ID contains no personal data; barcode and QR encode only this string.
"""
from __future__ import annotations

import re
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"   # Crockford base 32 (no I, L, O, U)
CHECK_ALPHABET = ALPHABET + "*~$=U"


def _check_char(body: str) -> str:
    value = 0
    for ch in body:
        value = value * 32 + ALPHABET.index(ch)
    return CHECK_ALPHABET[value % 37]


def new_tracking_id(prefix: str) -> str:
    while True:
        body = "".join(secrets.choice(ALPHABET) for _ in range(10))
        check = _check_char(body)
        if check in ALPHABET:  # keep IDs purely alphanumeric (rejects 5/37 of draws)
            return f"{prefix}-{body}{check}"


def normalize_tracking_id(raw: str) -> str:
    """Uppercase, strip spaces, map look-alike characters (O->0, I/L->1)."""
    text = re.sub(r"\s+", "", raw or "").upper()
    if "-" not in text:
        return text
    prefix, _, tail = text.rpartition("-")
    tail = tail.replace("O", "0").replace("I", "1").replace("L", "1")
    return f"{prefix}-{tail}"


def is_valid_tracking_id(tracking_id: str, prefix: str | None = None) -> bool:
    text = normalize_tracking_id(tracking_id)
    head, _, tail = text.rpartition("-")
    if prefix is not None and head != prefix.upper():
        return False
    if len(tail) != 11 or any(c not in ALPHABET for c in tail[:10]):
        return False
    return _check_char(tail[:10]) == tail[10]
