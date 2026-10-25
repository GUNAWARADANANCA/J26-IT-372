"""Monte-Carlo comparison of the L0 / L1 / L2 location policies (proposal 3.10, SO3).

    ml/.venv/Scripts/python ml/evaluation/location_policy_simulation.py [--n 20000]

Uses the backend's own policy code (backend/app/services/location.py), so the
numbers describe exactly what the system does. Scenarios:

    inside      true position inside the office zone              -> should be accepted
    outside     true position 400-3000 m away ("clearly outside") -> should NOT be accepted as consistent
    boundary    true position 0.8-1.3 x zone radius               -> genuinely ambiguous
    stale       fix 3-30 min old                                   -> should not be "consistent"

Phone error model: true horizontal error ~ circular Gaussian whose 68 % radius
is the *true* accuracy; the phone *reports* an accuracy that is off by a random
factor (0.5-2x), reflecting that reported accuracy is itself an estimate. A
share of fixes are "urban multipath" outliers with 3-6x larger error.

This is a simulation that motivates threshold choices before field trials; the
proposal's controlled trials (~120 scans, 6 areas, 2-3 phones) remain the
evidence for SO3. Results: ml/reports/location_policy/
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import BACKEND_ROOT, REPORTS, ensure  # noqa: E402

sys.path.insert(0, str(BACKEND_ROOT))
from app.services.location import DEFAULT_POLICY, assess, sigma_from_accuracy  # noqa: E402

OUT = REPORTS / "location_policy"
ZONE = {"type": "office_facility", "id": "SIM", "label": "simulated office", "latitude": 6.9147, "longitude": 79.9729,
        "radius_m": 150}
M_PER_DEG_LAT = 111_195.0


def offset(lat, lon, dx_m, dy_m):
    return lat + dy_m / M_PER_DEG_LAT, lon + dx_m / (M_PER_DEG_LAT * math.cos(math.radians(lat)))


def simulate_fix(rng: random.Random, true_dist: float, stale: bool) -> dict:
    theta = rng.uniform(0, 2 * math.pi)
    tx, ty = true_dist * math.cos(theta), true_dist * math.sin(theta)
    true_acc = rng.choice([4, 6, 8, 12, 16, 25, 40, 65])          # typical phone 68 % radii (m)
    multipath = rng.random() < 0.08
    sigma = sigma_from_accuracy(true_acc, 0.68) * (rng.uniform(3, 6) if multipath else 1)
    ex, ey = rng.gauss(0, sigma), rng.gauss(0, sigma)
    reported_acc = true_acc * rng.uniform(0.5, 2.0)
    lat, lon = offset(ZONE["latitude"], ZONE["longitude"], tx + ex, ty + ey)
    return {"latitude": lat, "longitude": lon, "accuracy_m": round(reported_acc, 1),
            "fix_age_s": rng.uniform(180, 1800) if stale else rng.uniform(0, 20), "permission": "granted", "mock": False}


def scenario(rng: random.Random, name: str) -> tuple[float, bool]:
    r = ZONE["radius_m"]
    if name == "inside":
        return r * math.sqrt(rng.random()) * 0.95, False
    if name == "outside":
        return rng.uniform(400, 3000), False
    if name == "boundary":
        return r * rng.uniform(0.8, 1.3), False
    return r * math.sqrt(rng.random()), True  # stale


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=20000, help="scans per scenario")
    ap.add_argument("--seed", type=int, default=3)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    ensure(OUT)

    policies = {"L0": {**DEFAULT_POLICY, "mode": "L0"}, "L1": {**DEFAULT_POLICY, "mode": "L1"},
                "L2": {**DEFAULT_POLICY, "mode": "L2"}}
    results = {p: defaultdict(Counter) for p in policies}
    for name in ("inside", "outside", "boundary", "stale"):
        for _ in range(args.n):
            dist, stale = scenario(rng, name)
            fix = simulate_fix(rng, dist, stale)
            for pname, policy in policies.items():
                results[pname][name][assess(fix, ZONE, policy)["result"]] += 1

    summary = {}
    for pname, per in results.items():
        def share(scn, *outcomes):
            total = sum(per[scn].values())
            return round(sum(per[scn][o] for o in outcomes) / total, 4)
        summary[pname] = {
            # Arrival scans: 'consistent'/'not_assessed' are accepted silently, others are held/flagged.
            "false_acceptance_clearly_outside": share("outside", "consistent", "not_assessed"),
            "valid_inside_flagged_or_held": share("inside", "uncertain", "mismatch", "unlocated"),
            "valid_inside_held_as_mismatch": share("inside", "mismatch"),
            "boundary_uncertain": share("boundary", "uncertain"),
            "stale_reported_consistent": share("stale", "consistent", "not_assessed"),
            "raw": {k: dict(v) for k, v in per.items()},
        }
    (OUT / "results.json").write_text(json.dumps({"n_per_scenario": args.n, "zone_radius_m": ZONE["radius_m"],
                                                   "policy": {k: v for k, v in DEFAULT_POLICY.items() if k != "actions"},
                                                   "summary": summary}, indent=2), encoding="utf-8")
    lines = ["# Location policy simulation (L0 / L1 / L2)", "",
             f"{args.n:,} simulated scans per scenario; zone radius {ZONE['radius_m']} m; reported accuracy off by 0.5-2x; "
             "8 % multipath outliers.", "",
             "| Policy | False acceptance, clearly outside (target <= 5 %) | Valid inside scans flagged/held | "
             "Valid inside held as mismatch | Boundary -> uncertain | Stale fix reported consistent |",
             "|---|---|---|---|---|---|"]
    for p, s in summary.items():
        lines.append(f"| {p} | {s['false_acceptance_clearly_outside']:.2%} | {s['valid_inside_flagged_or_held']:.2%} | "
                     f"{s['valid_inside_held_as_mismatch']:.2%} | {s['boundary_uncertain']:.2%} | {s['stale_reported_consistent']:.2%} |")
    lines += ["", "Interpretation:",
              "* L0 never questions a scan, so every clearly-outside scan is accepted (the status-only baseline).",
              "* L1 ignores accuracy and fix age: it accepts stale fixes and turns noisy valid scans into hard mismatches.",
              "* L2 moves noisy or stale evidence into 'uncertain' instead of a false accusation or a false confirmation.",
              "", "This is a simulation; confirm with the controlled field trials before freezing thresholds."]
    (OUT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[4:4 + 2 + len(summary)]))


if __name__ == "__main__":
    main()
