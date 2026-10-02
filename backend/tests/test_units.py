"""Unit tests for the deterministic parts: tariff, location, identifiers, address guard."""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

import pytest

from app.services import state_machine as sm
from app.services.address.normalizer import guard, rule_normalize
from app.services.address.text import dominant_script, tokenize
from app.services.location import DEFAULT_POLICY, assess, p_inside_circle, sigma_from_accuracy
from app.services.tariff import TariffError, compute_quote, find_band, select_tariff, validate_tariff
from app.services.tracking_id import ALPHABET, is_valid_tracking_id, new_tracking_id

TARIFF_PATH = __import__("pathlib").Path(__file__).resolve().parents[1] / "app" / "reference" / \
    "tariff_slpost_domestic_2026-02-09.json"


@pytest.fixture(scope="module")
def tariff():
    return json.loads(TARIFF_PATH.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ tariff (SO2: 100 % agreement)
def test_transcription_matches_item05_cross_check(tariff):
    combined = tariff["consistency_check"]["item05_combined_lkr"]
    bands = tariff["letter_postage_bands"]
    assert len(combined) == len(bands)
    for band, total in zip(bands, combined):
        assert Decimal(str(band["postage_lkr"])) + Decimal(str(tariff["registration_fee_lkr"])) == Decimal(str(total))


@pytest.mark.parametrize("grams,postage", [(5, "70.00"), (30, "70.00"), (30.1, "80.00"), (100, "140.00"),
                                           (100.1, "160.00"), (200, "160.00"), (499.9, "220.00"), (500, "220.00")])
def test_band_edges(tariff, grams, postage):
    q = compute_quote(tariff, grams, 0)
    assert q["status"] == "ok"
    assert q["lines"][0]["amount_lkr"] == postage
    assert Decimal(q["total_lkr"]) == Decimal(postage) + Decimal("60.00")


def test_boundary_uncertainty_requires_reweigh(tariff):  # T04
    q = compute_quote(tariff, 29.0, 2.0)
    assert q["status"] == "reweigh_required"
    assert q["reasons"][0]["boundary_g"] == 30
    assert "total_lkr" not in q  # never silently picks a band


def test_clear_of_boundary_is_ok(tariff):
    assert compute_quote(tariff, 25.0, 2.0)["status"] == "ok"


def test_range_limits(tariff):
    assert compute_quote(tariff, 3, 0)["reasons"][0]["code"] == "BELOW_RANGE"
    assert compute_quote(tariff, 650, 0)["reasons"][0]["code"] == "ABOVE_PROTOTYPE_RANGE"
    assert compute_quote(tariff, 650, 0, max_g=2000)["status"] == "ok"
    assert compute_quote(tariff, 2100, 0, max_g=5000)["reasons"][0]["code"] == "ABOVE_TARIFF_MAXIMUM"


def test_optional_services(tariff):
    q = compute_quote(tariff, 20, 0, advice_of_delivery=True, insured_value_lkr=2500)
    codes = {l["code"]: l["amount_lkr"] for l in q["lines"]}
    assert codes == {"postage": "70.00", "registration": "60.00", "advice_of_delivery": "100.00", "insurance": "300.00"}
    assert q["total_lkr"] == "530.00"
    assert compute_quote(tariff, 20, 0, insured_value_lkr=30000)["status"] == "rejected"


def test_tariff_validation_errors(tariff):
    broken = json.loads(json.dumps(tariff))
    broken["letter_postage_bands"][2]["min_exclusive_g"] = 45  # gap
    with pytest.raises(TariffError) as e:
        validate_tariff(broken)
    assert e.value.code == "TARIFF_BANDS_NOT_CONTIGUOUS"
    no_date = {**tariff, "effective_from": None}
    with pytest.raises(TariffError):
        validate_tariff(no_date)


def test_tariff_selection(tariff):
    assert select_tariff([tariff], date(2026, 10, 1))["tariff_version"] == tariff["tariff_version"]
    with pytest.raises(TariffError) as e:
        select_tariff([tariff], date(2025, 1, 1))
    assert e.value.code == "TARIFF_NONE_IN_FORCE"
    overlap = {**tariff, "tariff_version": "OTHER"}
    with pytest.raises(TariffError) as e:
        select_tariff([tariff, overlap], date(2026, 10, 1))
    assert e.value.code == "TARIFF_AMBIGUOUS"


def test_find_band_exclusive_lower_edge(tariff):
    assert find_band(tariff, Decimal("0")) is None
    assert find_band(tariff, Decimal("30"))["max_inclusive_g"] == 30


# ------------------------------------------------------------------ location (SO3)
def test_rayleigh_quantile():
    sigma = sigma_from_accuracy(10, 0.68)
    assert p_inside_circle(0, 10, sigma) == pytest.approx(0.68, abs=0.005)
    assert p_inside_circle(0, 1e9, 5) == pytest.approx(1.0, abs=1e-6)
    assert p_inside_circle(5000, 100, 10) == pytest.approx(0.0, abs=1e-9)
    # Far away but inside a huge zone: must not underflow to 0.
    assert p_inside_circle(5000, 5100, 10) == pytest.approx(1.0, abs=1e-3)


ZONE = {"type": "office_facility", "id": "X", "label": "Test PO", "latitude": 6.9, "longitude": 79.9, "radius_m": 150}


def _fix(dlat_m=0.0, acc=10, age=5, **kw):
    return {"latitude": 6.9 + dlat_m / 111_195, "longitude": 79.9, "accuracy_m": acc, "fix_age_s": age, **kw}


@pytest.mark.parametrize("fix,expected", [
    (_fix(0, 10), "consistent"),
    (_fix(1000, 10), "mismatch"),
    (_fix(150, 40), "uncertain"),                  # on the edge with a broad fix
    (_fix(0, 10, age=600), "uncertain"),           # stale (T09)
    (_fix(0, 900), "uncertain"),                   # imprecise
    ({"permission": "denied"}, "unlocated"),       # T09
])
def test_l2_policy(fix, expected):
    assert assess(fix, ZONE, DEFAULT_POLICY)["result"] == expected


def test_l1_ignores_accuracy_and_l0_does_not_assess():
    l1 = {**DEFAULT_POLICY, "mode": "L1"}
    assert assess(_fix(140, 500), ZONE, l1)["result"] == "consistent"
    assert assess(_fix(1000, 10), ZONE, {**DEFAULT_POLICY, "mode": "L0"})["result"] == "not_assessed"


def test_no_reference_is_never_verified():
    assert assess(_fix(0, 5), None, DEFAULT_POLICY)["result"] == "uncertain"


def test_mock_location_is_reported():
    assert assess(_fix(0, 5, mock=True), ZONE, DEFAULT_POLICY)["mock_location"] is True


# ------------------------------------------------------------------ state machine
def test_transitions():
    assert sm.is_valid_transition("accepted", "dispatched")
    assert not sm.is_valid_transition("accepted", "delivered")
    assert sm.is_late_history("delivered", "in_transit")          # T13
    assert sm.is_valid_transition("in_transit", "returned_to_sender", "return")
    assert not sm.is_valid_transition("in_transit", "returned_to_sender", "forward")
    assert not sm.should_notify("in_transit", "key") and sm.should_notify("in_transit", "all")
    assert not sm.should_notify("delivered", "none")


# ------------------------------------------------------------------ identifiers
def test_tracking_ids_validate_and_catch_typos():
    for _ in range(200):
        tid = new_tracking_id("PA-DEMO")
        assert is_valid_tracking_id(tid, "PA-DEMO")
        body = tid.rsplit("-", 1)[1]
        for i in range(10):  # every single substitution is detected
            for ch in ALPHABET[:6]:
                if ch != body[i]:
                    typo = body[:i] + ch + body[i + 1:]
                    assert not is_valid_tracking_id(f"PA-DEMO-{typo}")
        swapped = body[1] + body[0] + body[2:]
        if swapped != body:
            assert not is_valid_tracking_id(f"PA-DEMO-{swapped}")


# ------------------------------------------------------------------ address text and guard
def test_tokenizer_splits_glued_house_marker_and_keeps_lines():
    toks = tokenize("Mr. A. Perera\nNo.25/3, Galle Rd")
    assert [t.text for t in toks] == ["Mr.", "A.", "Perera", "No.", "25/3", "Galle", "Rd"]
    assert [t.line for t in toks] == [0, 0, 0, 1, 1, 1, 1]
    assert toks[4].trailing_comma


def test_script_detection():
    assert dominant_script("ගාලු පාර") == "si"
    assert dominant_script("கஸ்தூரியார் வீதி") == "ta"
    assert dominant_script("No. 25 ගාලු පාර Galle Road") == "mixed"


def test_guard_flags_invented_digits_and_script_change():
    src = "A. Perera\nGalle Road\nColombo"
    issues = guard(src, {"house_number": "25", "postcode": "00300", "street": "Galle Road"})
    assert "house_number" in issues and "postcode" in issues and "street" not in issues
    si_src = "ගාලු පාර, මොරටුව"
    assert any("script changed" in p for p in guard(si_src, {"street": "Galle Road"})["street"])


def test_rule_normalize_is_formatting_only():
    fields, changes = rule_normalize({"name": "MRS K FERNANDO", "house_number": "No.45/2", "street": "TEMPLE RD",
                                      "city": "Colombo 3", "postcode": " 10250 "})
    assert fields["street"] == "Temple Road" and fields["house_number"] == "45/2" and fields["city"] == "Colombo 03"
    assert guard("MRS K FERNANDO No.45/2 TEMPLE RD Colombo 3 10250", fields) == {}
    assert {c["field"] for c in changes} >= {"street", "house_number", "city"}
