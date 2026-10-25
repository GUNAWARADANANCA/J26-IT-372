"""Deterministic, versioned tariff engine (proposal section 3.9, SO2).

charge = letter postage for the weight band + registration fee + selected optional-service fees

Rules that make every quote reproducible and explainable:
* Bands are read from a versioned tariff record; the version is stored with
  every quote and every accepted item.
* The tariff is validated on load (contiguous, non-overlapping bands, an
  effective date, exactly one tariff in force). Any ambiguity blocks quoting.
* Measurement uncertainty: if [w - u, w + u] crosses a band boundary the quote
  is ``reweigh_required``. The engine never silently picks the cheaper or the
  more expensive band.
* Money uses Decimal and is serialised as strings with two decimals.
"""
from __future__ import annotations

import math
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")


class TariffError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def money(value) -> str:
    return str(Decimal(str(value)).quantize(TWO, rounding=ROUND_HALF_UP))


def validate_tariff(tariff: dict) -> None:
    if not tariff.get("effective_from"):
        raise TariffError("TARIFF_NO_EFFECTIVE_DATE", "tariff has no effective date")
    bands = tariff.get("letter_postage_bands") or []
    if not bands:
        raise TariffError("TARIFF_NO_BANDS", "tariff has no weight bands")
    previous_max = Decimal(0)
    for band in bands:
        lo, hi = Decimal(str(band["min_exclusive_g"])), Decimal(str(band["max_inclusive_g"]))
        if lo != previous_max:
            raise TariffError("TARIFF_BANDS_NOT_CONTIGUOUS",
                              f"band starting at {lo} g does not continue from {previous_max} g")
        if hi <= lo:
            raise TariffError("TARIFF_BAND_EMPTY", f"band {lo}-{hi} g is empty")
        previous_max = hi
    if Decimal(str(tariff.get("max_weight_g", previous_max))) != previous_max:
        raise TariffError("TARIFF_MAX_WEIGHT_MISMATCH", "max_weight_g differs from the last band")
    if tariff.get("registration_fee_lkr") is None:
        raise TariffError("TARIFF_NO_REGISTRATION_FEE", "registration fee missing")


def select_tariff(tariffs: list[dict], on: date) -> dict:
    """Exactly one tariff must be in force on ``on``."""
    def as_date(v):
        if v is None:
            return None
        return v.date() if isinstance(v, datetime) else date.fromisoformat(str(v)[:10])

    active = [t for t in tariffs
              if t.get("approval_status") != "withdrawn"
              and as_date(t["effective_from"]) <= on
              and (t.get("effective_to") is None or on < as_date(t["effective_to"]))]
    if not active:
        raise TariffError("TARIFF_NONE_IN_FORCE", f"no tariff is in force on {on.isoformat()}")
    if len(active) > 1:
        versions = ", ".join(t["tariff_version"] for t in active)
        raise TariffError("TARIFF_AMBIGUOUS", f"more than one tariff is in force on {on.isoformat()}: {versions}")
    validate_tariff(active[0])
    return active[0]


def find_band(tariff: dict, grams: Decimal) -> dict | None:
    for band in tariff["letter_postage_bands"]:
        if Decimal(str(band["min_exclusive_g"])) < grams <= Decimal(str(band["max_inclusive_g"])):
            return band
    return None


def compute_quote(tariff: dict, weight_g, uncertainty_g, *, advice_of_delivery: bool = False,
                  insured_value_lkr=None, min_g=5, max_g=500) -> dict:
    """Return an itemised quote or a structured refusal.

    ``status`` is one of ``ok``, ``reweigh_required`` or ``rejected``.
    """
    validate_tariff(tariff)
    w = Decimal(str(weight_g)).quantize(Decimal("0.1"))
    u = abs(Decimal(str(uncertainty_g))).quantize(Decimal("0.1"))
    base = {"tariff_version": tariff["tariff_version"], "approval_status": tariff.get("approval_status"),
            "weight_g": str(w), "uncertainty_g": str(u), "currency": tariff.get("currency", "LKR")}

    if w < Decimal(str(min_g)):
        return {**base, "status": "rejected", "reasons": [
            {"code": "BELOW_RANGE", "message": f"{w} g is below the prototype range ({min_g}-{max_g} g); check the scale is tared and the item is on the platform"}]}
    if w > Decimal(str(max_g)):
        return {**base, "status": "rejected", "reasons": [
            {"code": "ABOVE_PROTOTYPE_RANGE", "message": f"{w} g is above the prototype range ({min_g}-{max_g} g); weigh on the approved counter scale and enter it as a manual weight"}]}
    band = find_band(tariff, w)
    if band is None:
        return {**base, "status": "rejected", "reasons": [
            {"code": "ABOVE_TARIFF_MAXIMUM", "message": f"{w} g exceeds the maximum letter weight in tariff {tariff['tariff_version']}"}]}

    low_band = find_band(tariff, max(w - u, Decimal("0.1")))
    high_band = find_band(tariff, w + u)
    if low_band is not band or high_band is not band:
        boundary = band["min_exclusive_g"] if low_band is not band else band["max_inclusive_g"]
        return {**base, "status": "reweigh_required", "band": _band_view(band), "reasons": [
            {"code": "BOUNDARY_UNCERTAIN",
             "message": f"{w} g +/- {u} g overlaps the {boundary} g band boundary; reweigh on the approved scale "
                        f"or follow the approved exception procedure",
             "boundary_g": boundary,
             "candidate_bands": [_band_view(b) for b in (low_band, high_band) if b is not None]}]}

    lines = [{"code": "postage", "label": f"Letter postage ({_band_label(band)})",
              "amount_lkr": money(band["postage_lkr"]), "source": "item 01"},
             {"code": "registration", "label": "Registration fee",
              "amount_lkr": money(tariff["registration_fee_lkr"]), "source": "item 02"}]
    services = tariff.get("optional_services", {})
    if advice_of_delivery:
        aod = services["advice_of_delivery"]
        lines.append({"code": "advice_of_delivery", "label": aod["label"], "amount_lkr": money(aod["fee_lkr"]),
                      "source": f"item {aod.get('source_item', '')}"})
    if insured_value_lkr not in (None, "", 0, "0"):
        ins = services["insurance"]
        value = Decimal(str(insured_value_lkr))
        if value <= 0 or value > Decimal(str(ins["max_insured_value_lkr"])):
            return {**base, "status": "rejected", "reasons": [
                {"code": "INSURED_VALUE_OUT_OF_RANGE",
                 "message": f"declared value must be between 1 and {ins['max_insured_value_lkr']} LKR"}]}
        blocks = math.ceil(value / Decimal(str(ins["block_value_lkr"])))
        lines.append({"code": "insurance", "label": f"{ins['label']} - {blocks} x Rs {money(ins['fee_per_block_lkr'])} "
                      f"per Rs {ins['block_value_lkr']:,} or part", "amount_lkr": money(Decimal(str(ins["fee_per_block_lkr"])) * blocks),
                      "source": f"item {ins.get('source_item', '')}", "declared_value_lkr": money(value)})

    total = sum(Decimal(l["amount_lkr"]) for l in lines)
    return {**base, "status": "ok", "band": _band_view(band), "lines": lines, "total_lkr": money(total), "reasons": []}


def _band_label(band: dict) -> str:
    return f"{band['min_exclusive_g']} g < W <= {band['max_inclusive_g']} g"


def _band_view(band: dict) -> dict:
    return {"min_exclusive_g": band["min_exclusive_g"], "max_inclusive_g": band["max_inclusive_g"],
            "postage_lkr": money(band["postage_lkr"]), "label": _band_label(band)}
