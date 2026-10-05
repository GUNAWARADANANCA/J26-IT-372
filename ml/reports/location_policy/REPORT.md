# Location policy simulation (L0 / L1 / L2)

20,000 simulated scans per scenario; zone radius 150 m; reported accuracy off by 0.5-2x; 8 % multipath outliers.

| Policy | False acceptance, clearly outside (target <= 5 %) | Valid inside scans flagged/held | Valid inside held as mismatch | Boundary -> uncertain | Stale fix reported consistent |
|---|---|---|---|---|---|
| L0 | 100.00% | 0.00% | 0.00% | 0.00% | 100.00% |
| L1 | 0.00% | 6.88% | 6.88% | 0.00% | 90.36% |
| L2 | 0.00% | 18.65% | 1.67% | 41.45% | 0.00% |

Interpretation:
* L0 never questions a scan, so every clearly-outside scan is accepted (the status-only baseline).
* L1 ignores accuracy and fix age: it accepts stale fixes and turns noisy valid scans into hard mismatches.
* L2 moves noisy or stale evidence into 'uncertain' instead of a false accusation or a false confirmation.

This is a simulation; confirm with the controlled field trials before freezing thresholds.
