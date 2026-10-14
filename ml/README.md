# ML – datasets, training and evaluation

Everything that turns public data into the two trained models used by the backend, plus the evaluation
scripts for the research objectives. Dataset details and licences: [../Datasets/README.md](../Datasets/README.md).

## Environment
```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cu128   # NVIDIA GPU
#   CPU only: ... --index-url https://download.pytorch.org/whl/cpu
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
```
Tested: Python 3.14, PyTorch 2.11 + CUDA 12.8 on an RTX 2050 (4 GB). The CRF trains on CPU.

## Rebuild everything
```bash
bash ml/run_all.sh        # downloads → reference data → corpus → CRF → script-ID → envelopes → simulation
```

## Models

### 1. Address-field tagger (linear-chain CRF) – `address_parser/`
* **Task:** label each token of OCR or typed text as NAME, HOUSE, STREET, LOCALITY, CITY, REGION, POSTCODE, COUNTRY or O.
* **Why a CRF:** small data, explainable features, calibrated per-token marginals (used as field confidence),
  milliseconds per address on a counter PC, no GPU needed.
* **Features** (`backend/app/services/address/features.py`, shared with the API): token text/affixes, Unicode
  script, shape, digits, gazetteer membership (towns, districts, provinces, multi-word names, known postcodes),
  trilingual vocabulary (honorifics, house markers, street types), line position (envelope layout), ±2 context.
* **Protocol:** grid search (L1/L2) on validation → final model on train → review threshold chosen on validation
  → frozen → held-out test of **unseen postal towns**.
* `build_corpus.py` → `train_crf.py` → `backend/models/address_crf.crfsuite` + `.meta.json`, report in
  `reports/address_parser/REPORT.md`.

### 2. Script identification (CNN) – `script_id/`
* **Task:** Sinhala / Tamil / Latin per text-line image, to choose the Tesseract language pack in the P1 pipeline.
* **Model:** 5 conv blocks + global average pooling (≈ 0.46 M parameters), exported to ONNX and run by ONNX
  Runtime in the backend (≈ 2 ms/line on CPU). Temperature scaling (Guo et al., 2017) fitted on validation.
* **Data:** HarfBuzz-shaped renders of public text with 18 training fonts, 4 validation fonts and **6 held-out
  test fonts**, plus held-out address text.
* **Seeds:** three models are trained; the one with the best *validation* accuracy is shipped and the report gives
  test accuracy as mean ± SD across seeds (handwriting-style lines vary most between runs).
* `render_dataset.py` → `train.py` → `backend/models/script_id.onnx` + `.meta.json`, report in `reports/script_id/`.

### 3. Handwriting recogniser (CRNN + CTC) – `htr/`
* **Task:** read one handwritten text line (Sinhala, English or Tamil, also mixed) into characters. Tesseract is a
  printed-text engine and misreads handwriting; in the P1 pipeline this model reads handwritten address blocks.
* **Model:** 7 conv layers → 2 × bidirectional LSTM → linear, 4.5 M parameters, CTC decoding. Input: the line at
  48 px height, as wide as the writing. One network for all three scripts, exported to ONNX (18 MB).
* **Before the network** (`backend/app/services/ocr/htr.py`, shared with training): the photo is flat-fielded into
  an ink image (shadows and faint ruled lines disappear), the block is straightened, text lines are found, and
  each line is cropped by its writing, not by form lines.
* **Data** (kept outside the repository, see `Datasets/README.md` §2b):
  real Sinhala lines (SinOCR handwritten), real English lines (IAM), and synthetic lines drawn fresh for every
  sample – address text spelled with real handwritten Sinhala characters (454-class set), and font lines for
  English, Tamil and the Sinhala letters that set lacks. **No real Tamil handwriting**: Tamil is learnt from fonts.
* **Protocol:** model selection on validation lines only (real Sinhala, real English, Tamil in a validation font);
  the published test splits are read once, after training, and compared with Tesseract on the same lines.
* `build_cache.py` → `train.py` → `evaluate.py` → `backend/models/htr.onnx` + `.meta.json`, report in
  `reports/htr/REPORT.md`.

## Evaluation scripts – `evaluation/`
| Script | Objective | Input |
|---|---|---|
| `ocr_benchmark.py` | SO1 – B1 vs P1 vs P1+HW (handwriting model allowed to answer): CER, required-field exact match before correction, unsupported digit changes, time; by script × style | any folder with `annotations.jsonl` (synthetic or your real envelopes); needs Tesseract |
| `weighing_analysis.py` | SO2 – MAE, bias, repeatability, linear fit, expanded uncertainty U (k=2) | trials CSV from the IoT page |
| `location_policy_simulation.py` | SO3 – false acceptance / unnecessary review of L0, L1, L2 | none (Monte Carlo on the backend's policy code) |

Offline-sync and messaging reliability (SO4) are tested in `backend/tests/test_workflow.py`.

## Results (held-out test sets)
See the generated reports – they are rewritten on every run:
* [reports/address_parser/REPORT.md](reports/address_parser/REPORT.md)
* [reports/script_id/REPORT.md](reports/script_id/REPORT.md) and `confusion_matrix.png`
* [reports/location_policy/REPORT.md](reports/location_policy/REPORT.md)
* [reports/htr/REPORT.md](reports/htr/REPORT.md) – handwriting model vs Tesseract on held-out handwriting

**Honest reading of the numbers:** most Sinhala/Tamil training and test text is synthetic (built from public
reference data), which is easier than real mail. Always quote the *real-address* row of the CRF report and
validate on the consented envelope set before making claims in the thesis.

## Folder map
```
ml/
├── common/            paths, Unicode-correct text renderer (HarfBuzz + FreeType), font registry
├── datasets/          fetch_public_datasets.py, build_reference_data.py
├── address_parser/    build_corpus.py, train_crf.py
├── script_id/         render_dataset.py, train.py
├── htr/               build_cache.py, data.py, sinhala_glyphs.py, train.py, evaluate.py
├── synthetic_envelopes/ generate.py
├── evaluation/        ocr_benchmark.py, weighing_analysis.py, location_policy_simulation.py
├── reports/           generated metrics and reports
├── requirements.txt
└── run_all.sh
```
