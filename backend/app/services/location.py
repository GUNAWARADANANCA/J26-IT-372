"""Location-consistency assessment for scan events (proposal sections 3.10, SO3).

Three policies are implemented so they can be compared experimentally:

* **L0 status-only**  - location is recorded but not assessed (baseline).
* **L1 fixed radius** - consistent if the reported point is inside the zone
  circle, otherwise mismatch. Ignores the reported accuracy.
* **L2 uncertainty-aware** - treats the fix as a 2-D Gaussian whose spread comes
  from the reported horizontal accuracy and computes the probability that the
  true position lies inside the zone. High probability -> consistent, very low
  -> mismatch, anything else -> uncertain. Stale or very imprecise fixes are
  uncertain; a missing fix is unlocated.

Android reports accuracy as the radius of 68 % confidence; the W3C
Geolocation API specifies 95 %. ``accuracy_confidence`` in the policy says
which interpretation to use. A location result never proves that the letter,
the worker and the recipient were together (proposal section 4.5); it only
says whether the scan is consistent with an approved reference area.
"""
from __future__ import annotations

import math

import numpy as np

EARTH_RADIUS_M = 6_371_008.8

DEFAULT_POLICY = {
    "policy_version": "LOC-2026.10-L2",
    "mode": "L2",
    "accuracy_confidence": 0.68,
    "max_fix_age_s": 120,
    "max_accuracy_m": 250,
    "p_consistent": 0.80,
    "p_mismatch": 0.05,
    "future_tolerance_s": 300,
    "mock_location_action": "hold",
    # What happens to an event for each location result. accept_flagged = the
    # status changes but the event is marked for attention in the audit view.
    "actions": {
        "default": {"consistent": "accept", "not_assessed": "accept", "uncertain": "accept_flagged",
                    "unlocated": "accept_flagged", "mismatch": "hold"},
        "at_destination_office": {"consistent": "accept", "not_assessed": "accept", "uncertain": "accept_flagged",
                                  "unlocated": "hold", "mismatch": "hold"},
        "delivered": {"consistent": "accept", "not_assessed": "accept", "uncertain": "accept_flagged",
                      "unlocated": "accept_flagged", "mismatch": "hold"},
    },
    "delivered_requires_acknowledgement": True,
}


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def sigma_from_accuracy(accuracy_m: float, confidence: float) -> float:
    """Per-axis standard deviation of a circular Gaussian whose ``confidence``
    radius equals ``accuracy_m`` (Rayleigh quantile)."""
    return accuracy_m / math.sqrt(-2.0 * math.log(1.0 - confidence))


def _i0e(z: np.ndarray) -> np.ndarray:
    """Exponentially scaled modified Bessel function I0(z)*exp(-z), stable for large z."""
    z = np.asarray(z, dtype=np.float64)
    out = np.empty_like(z)
    small = z < 20
    out[small] = np.i0(z[small]) * np.exp(-z[small])
    big = ~small
    zb = z[big]
    out[big] = (1 + 1 / (8 * zb) + 9 / (128 * zb ** 2) + 225 / (3072 * zb ** 3)) / np.sqrt(2 * np.pi * zb)
    return out


def p_inside_circle(distance_m: float, radius_m: float, sigma_m: float) -> float:
    """P(|T - c| <= R) for T ~ N(fix, sigma^2 I) and a zone of radius R at c,
    where ``distance_m`` = |fix - c|. Integrates the Rice density numerically."""
    if sigma_m <= 0:
        return 1.0 if distance_m <= radius_m else 0.0
    d, s = distance_m, sigma_m
    if d < 1e-6:  # centred fix: Rayleigh CDF in closed form
        return 1.0 - math.exp(-(radius_m ** 2) / (2 * s ** 2))
    lo, hi = max(0.0, d - 9 * s), min(radius_m, d + 9 * s)
    if hi <= lo:
        return 0.0 if d > radius_m else 1.0
    r = np.linspace(lo, hi, 1601)
    # Rice pdf: r/s^2 * exp(-(r^2+d^2)/(2 s^2)) * I0(r d / s^2), written in a scaled, overflow-free form
    pdf = (r / s ** 2) * np.exp(-((r - d) ** 2) / (2 * s ** 2)) * _i0e(r * d / s ** 2)
    p = float(np.trapezoid(pdf, r))
    return min(max(p, 0.0), 1.0)


def assess(fix: dict | None, zone: dict | None, policy: dict) -> dict:
    """Classify one scan's location against a reference zone.

    ``fix``: {latitude, longitude, accuracy_m, fix_age_s, permission, mock}
    ``zone``: {id, label, latitude, longitude, radius_m, provenance, type}
    Returns {result, reasons, distance_m, p_inside, ...}.
    """
    mode = policy.get("mode", "L2")
    out = {"mode": mode, "policy_version": policy.get("policy_version"), "reasons": [],
           "reference": {k: zone.get(k) for k in ("type", "id", "label", "radius_m", "provenance")} if zone else None}
    if fix and fix.get("mock"):
        out["mock_location"] = True
        out["reasons"].append("device reported a mock (simulated) location")
    if mode == "L0":
        out["result"] = "not_assessed"
        return out

    has_fix = fix is not None and fix.get("latitude") is not None and fix.get("longitude") is not None
    if not has_fix:
        out["result"] = "unlocated"
        perm = (fix or {}).get("permission")
        out["reasons"].append(f"no location fix (permission: {perm})" if perm else "no location fix")
        return out
    if zone is None or zone.get("latitude") is None:
        out["result"] = "uncertain"
        out["reasons"].append("no approved reference area for this event; location recorded but not verified")
        return out

    distance = haversine_m(fix["latitude"], fix["longitude"], zone["latitude"], zone["longitude"])
    radius = float(zone.get("radius_m") or 0)
    accuracy = fix.get("accuracy_m")
    age = fix.get("fix_age_s")
    out.update(distance_m=round(distance, 1), accuracy_m=accuracy, fix_age_s=age)

    if mode == "L1":
        out["result"] = "consistent" if distance <= radius else "mismatch"
        out["reasons"].append(f"point is {distance:.0f} m from the reference centre (zone radius {radius:.0f} m)")
        return out

    # L2
    if age is not None and age > policy["max_fix_age_s"]:
        out["result"] = "uncertain"
        out["reasons"].append(f"location fix is {age:.0f} s old (limit {policy['max_fix_age_s']} s)")
        return out
    if accuracy is None or accuracy > policy["max_accuracy_m"]:
        out["result"] = "uncertain"
        out["reasons"].append(f"reported accuracy {accuracy} m is too broad (limit {policy['max_accuracy_m']} m)")
        return out
    sigma = sigma_from_accuracy(max(float(accuracy), 1.0), policy["accuracy_confidence"])
    p = p_inside_circle(distance, radius, sigma)
    out["p_inside"] = round(p, 4)
    out["sigma_m"] = round(sigma, 1)
    if p >= policy["p_consistent"]:
        out["result"] = "consistent"
    elif p <= policy["p_mismatch"]:
        out["result"] = "mismatch"
    else:
        out["result"] = "uncertain"
    out["reasons"].append(f"probability inside {zone.get('label', 'reference area')} = {p:.2f} "
                          f"(distance {distance:.0f} m, accuracy {accuracy} m, zone radius {radius:.0f} m)")
    return out


def action_for(status: str, result: str, policy: dict) -> str:
    table = policy["actions"].get(status) or policy["actions"]["default"]
    return table.get(result, "hold")
