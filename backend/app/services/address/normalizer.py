"""Address normalisation with an explicit guard against unsupported changes.

Two normalisers are compared in the research (proposal section 3.8):

* ``rule``  - deterministic spacing / punctuation / approved-abbreviation rules
* ``llm``   - optional few-shot prompting of a local instruction-tuned model
              (Gemma 3 4B IT served by Ollama). Disabled unless LLM_PROVIDER=ollama.

Whatever produced a suggestion, ``guard`` compares it with the source text and
reports every *unsupported change*: digits that were not in the source (an
invented house number or postcode), name tokens that were not in the source,
or a change of script. A field that fails the guard is never proposed silently;
the officer sees the original value and the reason.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.request

from .lexicon import _key
from .parser import FIELDS, parse_address
from .text import digits_in, normalize_text, primary_script, tokenize

log = logging.getLogger(__name__)

# Approved English abbreviation expansions (applied only to the last token of a
# street field, so "St. Anthony's Road" is not turned into "Street Anthony's").
STREET_ABBREVIATIONS = {
    "rd": "Road", "mw": "Mawatha", "mawatte": "Mawatha", "st": "Street", "ln": "Lane",
    "ave": "Avenue", "gdns": "Gardens", "pl": "Place", "terr": "Terrace", "jn": "Junction", "jct": "Junction",
}
_HOUSE_MARKER = re.compile(r"^(No\.?|No:|Number|#|Nr\.?|අංක[.:]?|இல[.:]?|இலக்கம்)\s*", re.I)
_INITIALS = re.compile(r"\b([A-Z])\.(?=[A-Z]\.)")


def _title_if_shouting(value: str) -> str:
    if value.isupper() and primary_script(value) == "en":
        return " ".join(w if len(w) <= 2 and w.endswith(".") else w.capitalize() for w in value.split(" "))
    return value


def rule_normalize(fields: dict) -> tuple[dict, list[dict]]:
    """Formatting-only normalisation; returns (fields, list of recorded changes)."""
    out, changes = {}, []
    for field in FIELDS:
        before = normalize_text(fields.get(field, "")).replace("\n", ", ")
        value = re.sub(r"\s*,\s*", ", ", before).strip(" ,")
        kind = "format"
        if field == "name":
            value = _title_if_shouting(_INITIALS.sub(r"\1. ", value))
        elif field == "house_number":
            value = _HOUSE_MARKER.sub("", value).replace(" / ", "/").strip()
        elif field == "street":
            parts = _title_if_shouting(value).split(" ")
            last = parts[-1].strip(".").lower() if parts[-1] else ""
            if last in STREET_ABBREVIATIONS:
                parts[-1] = STREET_ABBREVIATIONS[last]
                kind = "abbreviation"
            value = " ".join(parts)
        elif field == "city":
            value = _title_if_shouting(value)
            m = re.match(r"^(\S+)\s+(\d)$", value)
            if m:  # "Colombo 3" -> "Colombo 03"
                value = f"{m.group(1)} 0{m.group(2)}"
        elif field == "postcode":
            value = re.sub(r"\s+", "", value)
        if before != value:
            changes.append({"field": field, "before": before, "after": value, "kind": kind})
        out[field] = value
    return out, changes


def _source_token_keys(source: str) -> set[str]:
    return {_key(t.text) for t in tokenize(source)}


def guard(source_text: str, fields: dict) -> dict[str, list[str]]:
    """Return {field: [issue, ...]} for every change the source does not support."""
    source_digits = {d.lstrip("0") or "0" for d in digits_in(source_text)}
    source_keys = _source_token_keys(source_text)
    expansions = {v.lower() for v in STREET_ABBREVIATIONS.values()}
    source_script = primary_script(source_text)
    issues: dict[str, list[str]] = {}
    for field, value in fields.items():
        if not value:
            continue
        problems = []
        for d in digits_in(value):
            if (d.lstrip("0") or "0") not in source_digits:
                problems.append(f"digit '{d}' does not appear in the source text")
        if field in ("name", "house_number", "postcode", "street", "city", "locality"):
            for t in tokenize(value):
                k = _key(t.text)
                if not k or k in source_keys or k.isdigit():
                    continue
                if field == "street" and k in expansions:
                    continue
                problems.append(f"'{t.text}' does not appear in the source text")
        if source_script in ("si", "ta") and primary_script(value) not in (source_script, "none"):
            problems.append(f"script changed from {source_script} to {primary_script(value)}")
        if problems:
            issues[field] = problems
    return issues


# ---------------------------------------------------------------------------
# Optional LLM normaliser (Gemma 3 4B IT through a local Ollama server)
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = (
    "You split Sri Lankan postal addresses into fields. Copy text exactly from the input. "
    "Do not translate, transliterate, guess or add anything that is not in the input. "
    "If a field is absent, return an empty string. Keep the original script (Sinhala, Tamil or English)."
)
_FEW_SHOT = [
    ("Mr. A.B. Perera\nNo. 25/3, Galle Rd\nColombo 03",
     {"name": "Mr. A. B. Perera", "house_number": "25/3", "street": "Galle Road", "locality": "",
      "city": "Colombo 03", "region": "", "postcode": "", "country": ""}),
    ("ඒ. බී. පෙරේරා මහතා\nඅංක 12, ගාලු පාර\nමොරටුව 10400",
     {"name": "ඒ. බී. පෙරේරා මහතා", "house_number": "12", "street": "ගාලු පාර", "locality": "",
      "city": "මොරටුව", "region": "", "postcode": "10400", "country": ""}),
    ("திரு. க. சிவராஜா\nஇல. 7, கஸ்தூரியார் வீதி\nயாழ்ப்பாணம்",
     {"name": "திரு. க. சிவராஜா", "house_number": "7", "street": "கஸ்தூரியார் வீதி", "locality": "",
      "city": "யாழ்ப்பாணம்", "region": "", "postcode": "", "country": ""}),
]
_SCHEMA = {"type": "object", "properties": {f: {"type": "string"} for f in FIELDS}, "required": FIELDS}


def llm_normalize(text: str, *, url: str, model: str, timeout: float = 60.0) -> dict | None:
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for example_in, example_out in _FEW_SHOT:
        messages.append({"role": "user", "content": example_in})
        messages.append({"role": "assistant", "content": json.dumps(example_out, ensure_ascii=False)})
    messages.append({"role": "user", "content": text})
    body = json.dumps({"model": model, "messages": messages, "stream": False, "format": _SCHEMA,
                       "options": {"temperature": 0}}).encode("utf-8")
    req = urllib.request.Request(url.rstrip("/") + "/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        result = json.loads(payload["message"]["content"])
        return {f: str(result.get(f, "") or "") for f in FIELDS}
    except Exception as exc:  # noqa: BLE001 - the LLM is optional; fall back to rules
        log.warning("LLM normalisation unavailable: %s", exc)
        return None


def normalize_address(text: str, *, use_llm: bool = False, llm_url: str = "", llm_model: str = "") -> dict:
    parsed = parse_address(text)
    rule_fields, rule_changes = rule_normalize(parsed["fields"])
    result = {
        "source_text": parsed.get("normalized_text", ""),
        "parser": {k: parsed[k] for k in ("fields", "confidence", "needs_review", "engine", "script")},
        "suggested": rule_fields,
        "changes": rule_changes,
        "guard": guard(text, rule_fields),
        "checks": parsed["checks"],
        "derived": parsed["derived"],
        "normalizer": "rule",
    }
    if use_llm:
        llm_fields = llm_normalize(text, url=llm_url, model=llm_model)
        if llm_fields is None:
            result["llm"] = {"status": "unavailable"}
        else:
            llm_issues = guard(text, llm_fields)
            merged = dict(rule_fields)
            for field, value in llm_fields.items():
                if field not in llm_issues:
                    merged[field] = value
            result.update(suggested=merged, normalizer="llm+guard",
                          llm={"status": "ok", "raw": llm_fields, "rejected_fields": llm_issues})
            result["guard"] = guard(text, merged)
    return result
