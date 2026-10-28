# Datasets – Smart Registered Mail Intake and Tracking (J26-IT-372 · IT23324138)

This folder holds every dataset used to **train** and **evaluate** the component's models, the
**reference data** the running system needs, and the **templates** for the data you will collect
yourself during the research. Everything here comes from public, openly licensed sources or is
generated from them – no real customer mail or personal data is included.

> **One command rebuilds everything** (downloads → processing → training → reports):
> ```bash
> bash ml/run_all.sh
> ```
> Individual steps are listed in [§6 How to rebuild](#6-how-to-rebuild-step-by-step).

---

## 1. Folder map

```
Datasets/
├── README.md                     ← this file
├── raw/                          ← exact downloads, never edited (provenance in raw/MANIFEST.json)
│   ├── MANIFEST.json             ← URL, licence, citation, SHA-256 and date of every raw file
│   ├── gazetteer_madurapa/       ← Sri Lanka provinces / districts / cities (EN·SI·TA) + postcodes
│   ├── deepparse_worldwide/      ← lk.parquet – labelled Sri Lankan addresses (Deepparse)
│   ├── osm/                      ← post_offices.json, streets_si_ta.json (OpenStreetMap)
│   ├── wikidata/                 ← sri_lankan_person_names.csv
│   ├── fonts/                    ← 27 Google Fonts (Sinhala, Tamil, Latin, handwriting-style)
│   └── slpost/                   ← official domestic postage notice (9 Feb 2026, PDF)
├── curated/                      ← small hand-made resources (review before final use)
│   ├── address_vocabulary.json   ← honorifics, house markers, street types… in EN/SI/TA
│   ├── name_seed_list.csv        ← common Sri Lankan given/family names in EN/SI/TA
│   └── tariff_slpost_domestic_2026-02-09.json  ← tariff transcribed from the official PDF
├── processed/
│   ├── reference/                ← clean tables (also copied to backend/app/reference/)
│   ├── address_tagging/          ← train/val/test.jsonl for the address-field CRF + stats.json
│   ├── script_id/                ← rendered text-line images for the script classifier (*.npz, not in git)
│   └── synthetic_envelopes/      ← 360 synthetic envelope photos + annotations.jsonl (images not in git)
└── templates/                    ← CSV sheets for YOUR data collection (envelopes, weighing, location, usability)
```

## 2. Public sources and licences

| Dataset | What it contains | Size | Licence | Used for |
|---|---|---|---|---|
| **Sri Lanka provinces-districts-cities** (M. Madurapperuma, GitHub `madurapa/sri-lanka-provinces-districts-cities`) | 2,155 postal towns with **English, Sinhala and Tamil** names, 5-digit postcodes, district, province, lat/lon | 0.3 MB | MIT | gazetteer features, town↔postcode checks, synthetic addresses, script-ID text, office suggestions |
| **Deepparse worldwide-addresses – `lk` split** (Yassine & Beauchemin, Hugging Face `deepparse/worldwide-addresses`) | 19,292 OpenStreetMap/libpostal-derived Sri Lankan addresses with per-token tags (StreetNumber, StreetName, Municipality, PostalCode …) | 0.23 MB | CC BY 4.0 | the **real-address** part of the address-tagger corpus |
| **OpenStreetMap** via Overpass API | 797 post-office points; 358 streets with Sinhala and/or Tamil names | 0.8 MB | ODbL 1.0 | facility reference points (with provenance), street vocabulary, script-ID text |
| **Wikidata** SPARQL | given/family-name labels of Sri Lankan citizens in EN/SI/TA | 47 KB | CC0 1.0 | recipient-name vocabulary (split into separate given and family names) |
| **Google Fonts** (Noto Sans/Serif Sinhala & Tamil, Abhaya Libre, Yaldevi, Gemunu Libre, Hind Madurai, Mukta Malar, Catamaran, Kavivanar, Caveat, Kalam, Indie Flower, …) | 27 TrueType fonts | 17 MB | SIL OFL 1.1 | rendering training lines and synthetic envelopes |
| **Department of Posts Sri Lanka** – *Domestic postage revision effective 9 Feb 2026* | official Sinhala tariff notice | 1.2 MB | public government notice | versioned tariff (items 01, 02, 25, 29) |

### 2b. Handwriting datasets (stored outside the repository)

They are too large for a cloud-synced repository and are not redistributed here. `ml/htr/build_cache.py` reads
them from `%USERPROFILE%\PostAssist\datasets` (override with the `HTR_DATA_DIR` environment variable).

| Dataset | File expected | What it contains | Size | Terms | Used for |
|---|---|---|---|---|---|
| **SinOCR – handwritten subset** (IEEE DataPort, *SinOCR*) | `sinocr_handwritten.zip` | 1,135 Sinhala handwritten lines cut from filled-in forms, with `data.csv` (908 train / 227 test) | 5 MB | as stated on the dataset's IEEE DataPort page – **confirm and cite before publishing** | the only real Sinhala handwriting: training, validation (10 % of train) and the held-out test |
| **Sinhala handwritten characters, 454 classes** (`Dataset454`, supplied by the project owner) | `sinhala_chars_454.zip` | 108,933 isolated characters, 80×80 px, folders `train/valid/test/<1…454>`, **no label file** | 216 MB | source and licence **to be confirmed by the project owner** | synthetic Sinhala lines: address text spelled with real handwritten characters. Labels of 270 classes were assigned by reading sample sheets (`ml/htr/sinhala_glyphs.py`) |
| **IAM handwriting database – lines** (Marti & Bunke, 2002; Hugging Face `Teklia/IAM-line`) | `iam_line/{train,validation,test}.parquet` | 10,373 English handwritten lines (6,482 / 976 / 2,915) | 266 MB | free for non-commercial research; cite U. Marti and H. Bunke, *The IAM-database: an English sentence database for offline handwriting recognition*, IJDAR 5, 2002 | real English handwriting: training, validation, test |

There is **no Tamil handwriting dataset** in this set. A candidate is IIIT-INDIC-HW-WORDS (Gongidi & Jawahar,
ICDAR 2021; `ta.zip`, 5.1 GB, about 103,000 Tamil word images from 16 writers, cvit.iiit.ac.in).

Attribution text for reports and the thesis is in `raw/MANIFEST.json` (`citation` field). ODbL requires
attribution "© OpenStreetMap contributors"; CC BY 4.0 requires citing Yassine & Beauchemin (see the
dataset card).

**Not used / not redistributed:** Windows' *Nirmala UI* font is used only on the training machine as an
extra held-out test font and is never copied into the repository.

## 3. What each dataset is used for

### 3.1 Address-field tagger (CRF) – `processed/address_tagging/`
Turns OCR or typed text into fields: **NAME, HOUSE, STREET, LOCALITY, CITY, REGION, POSTCODE, COUNTRY, O**.

| Split | Examples | Postal-town groups | Real (Deepparse) | Synthetic | With OCR-style noise |
|---|---:|---:|---:|---:|---:|
| see `stats.json` (rebuilt by `build_corpus.py`) | ~24k / 5k / 5k | ~2,750 / 620 / 600 | ~7.4k / 1.1k / 1.5k | ~16.9k / 3.8k / 3.8k | ~25 % |

* **Grouped split by postal town** (70/15/15): every address mentioning a town is in one split only, so the
  test set measures performance on towns the model has never seen (`stats.json → group_overlap` = 0).
* **Real part:** Deepparse `lk` rows in English/Sinhala; rows that only name the country, duplicates, and rows
  with foreign-script country names (Russian, Japanese, Chinese) are dropped; broken Sinhala conjuncts
  (`ශ් රී` → `ශ්‍රී`) are repaired.
* **Synthetic part:** multi-line envelope-style addresses in **Sinhala, Tamil, English and mixed script**,
  assembled from the gazetteer (town + correct postcode, district), OSM street names, Wikidata/curated names and
  the curated vocabulary (e.g. `ඒ. බී. පෙරේරා මහතා / අංක 25/3, ගාලු පාර / මොරටුව 10400`). Given names, family
  names, house numbers and streets are sampled **independently**, so no real person is linked to a real address.
* **OCR noise:** 25 % of examples are copied with character substitutions/deletions within the same script
  (e.g. `0↔O`, `5↔S`, random Sinhala/Tamil consonant swaps) at 3–10 % rates.

Line format (`*.jsonl`):
```json
{"text": "ඒ. බී. පෙරේරා මහතා,\nඅංක 12, ගාලු පාර,\nමොරටුව 10400",
 "labels": ["NAME","NAME","NAME","NAME","HOUSE","HOUSE","STREET","STREET","CITY","POSTCODE"],
 "source": "synthetic", "script": "si", "group": "town:moratuwa", "noisy": false}
```
`labels` align one-to-one with `backend/app/services/address/text.py::tokenize(text)`.

### 3.2 Script identification (CNN) – `processed/script_id/`
Classifies a text-line image as **Sinhala / Tamil / Latin** so P1 can choose the Tesseract language pack.

* Lines are rendered with **HarfBuzz shaping** (correct Sinhala conjuncts and Tamil vowel signs – Pillow alone
  cannot do this on Windows) and then degraded: rotation/shear, pen thickness, paper/ink colour, uneven light,
  blur, noise, JPEG artefacts, partial crops.
* **Train** uses 18 fonts, **validation** 4 other fonts (Gemunu Libre, Mukta Malar, Source Sans 3, Patrick Hand) and
  **test** 6 further **held-out fonts** (Yaldevi, Tiro Tamil, Pavanam, Merriweather, Indie Flower, Nirmala UI) **and**
  text from the held-out address split - so model selection and testing both measure unseen typefaces.
* 45,000 / 4,500 / 4,500 lines, 32×256 px, stored as `train.npz`, `val.npz`, `test.npz` (not committed –
  regenerate with `ml/script_id/render_dataset.py`; ~3 minutes). `samples.png` shows a preview.

### 3.3 Synthetic envelopes – `processed/synthetic_envelopes/`
360 photo-like images of an envelope lying on the wooden scale platform (as the ESP32-CAM sees it):
120 per script × (60 printed + 60 handwriting-style), with sender block, stamp, postmark, perspective, blur,
uneven light and JPEG compression. `annotations.jsonl` holds the exact recipient text and fields plus a
dev/val/test split grouped by font ("writer") and base address.

> **Use only for pipeline validation** (`ml/evaluation/ocr_benchmark.py`). It mirrors the design of the
> proposal's 360-envelope evaluation set (§3.3) but is **not** a substitute for consented real envelopes,
> and results on it must be labelled *synthetic*. No public Sinhala handwriting font exists, so Sinhala
> "handwriting" is a printed font with simulated slant and stroke changes.

### 3.4 Reference data used by the running system – `processed/reference/`
| File | Rows | Used by |
|---|---:|---|
| `lk_localities.csv` | 2,155 | address features, town↔postcode check, derived Colombo-zone postcodes, office suggestions |
| `lk_post_offices_osm.csv` | 797 | candidate facility reference points (seed offices cite their OSM id) |
| `lk_streets_osm.csv` | 358 | street vocabulary for synthetic data |
| `person_names.csv` | 1,323 | name vocabulary for synthetic data |
| `tariff_slpost_domestic_2026-02-09.json` | 21 bands | tariff engine (loaded into MongoDB at first start) |

`build_reference_data.py` copies the runtime files into `backend/app/reference/`.

### 3.5 The 2026 tariff (curated from the official notice)
| Item in notice | Meaning | Value used |
|---|---|---|
| 01 | Ordinary/business letter postage by weight band (`a < W ≤ b`) | Rs 70 (≤ 30 g), 80 (≤ 40 g), 90, 100, 110, 120, 130, 140 (≤ 100 g), 160 (≤ 200 g), 180, 200, 220 (≤ 500 g) … 440 (≤ 2 kg) |
| 02 | Registration fee | Rs 60 |
| 29 | Advice of delivery | Rs 100 |
| 25 | Insurance | Rs 100 per Rs 1,000 (or part) of declared value, max Rs 25,000 |

**Built-in cross-check:** item 05 of the same notice lists *postage + registration* for government mail; for
all 21 bands it equals item 01 + Rs 60, which independently confirms the transcription
(`backend/tests/test_units.py::test_transcription_matches_item05_cross_check`). The file is marked
`approval_status: "transcribed"` until a postal officer confirms it against the counter price chart.

## 4. Curated resources (please review)
`curated/address_vocabulary.json` and `curated/name_seed_list.csv` were written by the student from general
knowledge of Sri Lankan address conventions (e.g. Sinhala `මහතා` after the name, Tamil `திரு.` before it,
`අංක`/`இல.` for house numbers, `පාර/මාවත/වීදිය`, `வீதி/ஒழுங்கை`). **Ask a native Sinhala and a native Tamil
speaker to check the spellings** before the final evaluation and record the review in the decision log.

## 5. Templates for your own data collection – `templates/`
| Template | Protocol in the proposal | Fill it with |
|---|---|---|
| `envelope_annotation_template.csv` | §3.3 – 360 consented/synthetic envelopes, 120 per script, 60 printed + 60 handwritten, ~30 writers, double transcription + adjudication, 60/20/20 split grouped by writer/base address | one row per image; keep the original characters; record consent reference; never photograph real customer mail without approval |
| `weighing_trials_template.csv` | §3.9 – 10 reference masses × 10 repeats + boundary cases | already lists 5, 10, 20, 30, 50, 100, 200, 300, 400, 500 g; or use *Download trials CSV* on the IoT page, then run `ml/evaluation/weighing_analysis.py` |
| `location_trials_template.csv` | §3.10 – ~120 scans at 6 approved areas with 2–3 phones | one row per scan; link to `event_id` from `GET /api/reports/events.csv` |
| `usability_task_log_template.csv` | §3.5 / NFR07 – 12–16 participants, counterbalanced B0/B1/P1 | task timings, errors, help requests, SUS score |

To evaluate on your **real** envelopes, save them as `Datasets/processed/real_envelopes/images/*.jpg` with an
`annotations.jsonl` in the same format as the synthetic set, then run
`ml/evaluation/ocr_benchmark.py --set Datasets/processed/real_envelopes --split test`.
Real images contain personal data: keep them out of git (add the folder to `.gitignore`), store them only on
approved storage and delete them according to the approved protocol (PDPA No. 9 of 2022).

## 6. How to rebuild (step by step)
Run from the repository root in Git Bash with the ML environment (`ml/.venv`, see `ml/README.md`):

| Step | Command | Output | Time |
|---|---|---|---|
| 1 | `ml/.venv/Scripts/python ml/datasets/fetch_public_datasets.py` | `raw/` + `MANIFEST.json` | 1–3 min (Overpass/Wikidata may need a retry) |
| 2 | `ml/.venv/Scripts/python ml/datasets/build_reference_data.py` | `processed/reference/`, `backend/app/reference/` | seconds |
| 3 | `ml/.venv/Scripts/python ml/address_parser/build_corpus.py` | `processed/address_tagging/` | seconds |
| 4 | `ml/.venv/Scripts/python ml/address_parser/train_crf.py` | `backend/models/address_crf.*`, `ml/reports/address_parser/` | ~5 min (CPU) |
| 5 | `ml/.venv/Scripts/python ml/script_id/render_dataset.py` | `processed/script_id/*.npz` | ~3 min |
| 6 | `ml/.venv/Scripts/python ml/script_id/train.py` | `backend/models/script_id.*`, `ml/reports/script_id/` | ~10 min (RTX 2050) / longer on CPU |
| 7 | `ml/.venv/Scripts/python ml/synthetic_envelopes/generate.py` | `processed/synthetic_envelopes/` | ~3 min |
| 8 | `ml/.venv/Scripts/python ml/evaluation/ocr_benchmark.py` | `ml/reports/ocr_benchmark/` | needs Tesseract |

All steps use fixed random seeds, so a rebuild reproduces the same splits.

## 7. Known data issues and how they are handled
| Issue | Handling |
|---|---|
| One gazetteer Tamil name contains a Bengali letter (U+09A6 দ instead of U+0BA4 த, "Parakrama Samudra") | corrected in `build_reference_data.py` (`CHARACTER_FIXES`), documented here |
| Deepparse "sin" rows are mostly English addresses whose *country* is written in Sinhala with a lost zero-width joiner (`ශ් රී ලංකාව`) | joiner restored by `repair_sinhala()`; real Sinhala/Tamil address structure therefore comes mainly from the synthetic part |
| ~70 Deepparse rows contain Russian/Japanese/Chinese country names | dropped (`foreign_script` count in `stats.json`) |
| Gazetteer coordinates are **town centroids**, not post-office buildings | never used as delivery locations; office zones use OSM points and must be confirmed on site (Offices page, provenance required) |
| Wikidata has few Sinhala/Tamil name labels (31/108) | supplemented by the curated seed list (review required) |
| Synthetic data is easier than real mail | reports always show real-vs-synthetic results separately; final claims need the consented envelope set |
