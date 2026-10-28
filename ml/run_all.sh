#!/usr/bin/env bash
# Rebuild every dataset and model from the public sources, in order.
# Usage (Git Bash, from the repository root):  bash ml/run_all.sh
set -euo pipefail
PY=ml/.venv/Scripts/python
export PYTHONIOENCODING=utf-8
$PY ml/datasets/fetch_public_datasets.py          # download raw public data (skips existing files)
$PY ml/datasets/build_reference_data.py           # gazetteer / post offices / streets / names -> CSV
$PY ml/address_parser/build_corpus.py             # labelled address corpus (grouped splits)
$PY ml/address_parser/train_crf.py                # address-field CRF  -> backend/models/address_crf.*
$PY ml/script_id/render_dataset.py                # rendered text lines
$PY ml/script_id/train.py                         # script-ID CNN      -> backend/models/script_id.*
$PY ml/synthetic_envelopes/generate.py            # 360 synthetic envelopes for the OCR benchmark
$PY ml/evaluation/location_policy_simulation.py   # L0/L1/L2 simulation
echo "All done. Reports are in ml/reports/."
