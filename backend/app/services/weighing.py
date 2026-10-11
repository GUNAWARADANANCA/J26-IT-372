"""Rules for pairing an IoT scale reading with an intake draft (proposal 3.9, FR06).

The ESP32 firmware numbers every *placement*: the platform has to return to
empty before the next stable load gets a new placement number. A placement can
be paired to one draft only (unique index on ``weight.placement_key``), so the
previous letter's weight can never be reused for a new letter (test T03).
"""
from __future__ import annotations

from datetime import datetime

from ..config import Settings


def placement_key(device_id: str, boot_id: str, placement_id: int) -> str:
    return f"{device_id}:{boot_id}:{placement_id}"


def reading_problems(device: dict, reading: dict | None, now: datetime, s: Settings) -> list[dict]:
    """Why a reading may not be paired. Empty list = acceptable."""
    if reading is None:
        return [{"code": "NO_READING", "message": "the scale has not reported a reading yet"}]
    problems = []
    age = (now - reading["received_at"]).total_seconds()
    if age > s.reading_max_age_s:
        problems.append({"code": "STALE_READING",
                         "message": f"last reading is {age:.1f} s old (limit {s.reading_max_age_s:.0f} s); check the scale's Wi-Fi"})
    if not reading.get("sensor_ok", True):
        problems.append({"code": "SENSOR_FAULT", "message": "load-cell amplifier not responding; check HX711 wiring"})
    if reading.get("needs_tare"):
        problems.append({"code": "NEEDS_TARE",
                         "message": "the scale was restarted; empty the platform and press Tare on the IoT scale page"})
    if not reading.get("calibration_id"):
        problems.append({"code": "UNCALIBRATED", "message": "scale is not calibrated; calibrate with a reference mass"})
    if reading.get("needs_tare"):
        return problems  # no weight is reported until the scale is zeroed
    if not reading.get("loaded"):
        problems.append({"code": "PLATFORM_EMPTY", "message": "nothing on the platform"})
    elif not reading.get("stable"):
        problems.append({"code": "UNSTABLE",
                         "message": f"reading not stable yet (spread {reading.get('spread_g')} g); wait for the item to settle"})
    net = reading.get("net_g")
    if net is not None and net < 0:
        problems.append({"code": "NEGATIVE", "message": "negative weight; empty the platform and tare the scale"})
    return problems


def uncertainty_for(device: dict, reading: dict, s: Settings) -> float:
    """Expanded uncertainty used for the band-boundary rule.

    Uses the calibration's expanded uncertainty (from reference-mass trials,
    see ml/evaluation/weighing_analysis.py) or the configured default, and
    never less than half of the observed spread of the stable window.
    """
    cal = device.get("calibration") or {}
    base = cal.get("expanded_uncertainty_g") or s.default_uncertainty_g
    return round(max(float(base), float(reading.get("spread_g") or 0) / 2), 2)
