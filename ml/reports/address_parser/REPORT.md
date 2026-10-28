# Address-field tagger (CRF) - evaluation report

Trained 2026-10-01T16:58:28+00:00 | feature version `2026.10-v1` | c1=0.1 c2=0.01

Splits are grouped by postal town, so every test address is in a town the model never saw in training.

## Held-out test set

| Metric | CRF | Rule baseline |
|---|---|---|
| Token accuracy | 0.9968 | 0.7457 |
| Macro F1 (address labels) | 0.9948 | 0.6268 |
| Required-field exact match | 0.9943 | 0.5754 |
| Whole-address exact match | 0.9833 | 0.1964 |

## By script (test)

| Script | n | Token acc. | Macro F1 | Required-field EM | Address EM | Rule baseline required-field EM |
|---|---|---|---|---|---|---|
| en | 2691 | 0.9945 | 0.9917 | 0.9890 | 0.9766 | 0.5170 |
| mixed | 301 | 0.9987 | 0.9972 | 0.9993 | 0.9967 | 0.6091 |
| si | 1195 | 0.9979 | 0.9946 | 0.9971 | 0.9866 | 0.6143 |
| ta | 1150 | 0.9990 | 0.9967 | 0.9983 | 0.9922 | 0.6154 |

## By source and noise (test)

| Group | n | Required-field EM | Address EM |
|---|---|---|---|
| deepparse_lk | 1547 | 0.9756 | 0.9703 |
| synthetic | 3790 | 0.9973 | 0.9887 |
| clean | 4231 | 0.9962 | 0.9891 |
| ocr_noise | 1106 | 0.9869 | 0.9611 |

## Field exact match (test)

| Field | Exact match | Support |
|---|---|---|
| name | 0.9992 | 3791 |
| house_number | 0.9960 | 3955 |
| street | 0.9913 | 4505 |
| city | 0.9863 | 5027 |
| region | 0.9893 | 845 |
| postcode | 0.9971 | 2789 |
| country | 0.9963 | 1605 |
| locality | 0.9648 | 1450 |

## Confidence and the review threshold

Threshold chosen on validation for >= 100% accuracy of un-flagged fields: **0.974**.

| Split | Share not flagged | Accuracy not flagged | Flagged fields | Accuracy of flagged | Errors caught by flag |
|---|---|---|---|---|---|
| validation | 0.9828 | 0.9970 | 382 | 0.7958 | 0.5455 |
| test | 0.9817 | 0.9981 | 437 | 0.7872 | 0.6788 |

Operating curve on validation (pick a different threshold if review effort must be lower/higher):

| Threshold | Share not flagged | Accuracy not flagged | Errors caught by flag |
|---|---|---|---|
| 0.5 | 0.9996 | 0.9937 | 0.0280 |
| 0.6 | 0.9986 | 0.9943 | 0.1119 |
| 0.7 | 0.9970 | 0.9949 | 0.2098 |
| 0.8 | 0.9960 | 0.9952 | 0.2517 |
| 0.9 | 0.9919 | 0.9961 | 0.3986 |
| 0.95 | 0.9881 | 0.9966 | 0.4825 |
| 0.98 | 0.9808 | 0.9972 | 0.5734 |
| 0.99 | 0.9742 | 0.9975 | 0.6294 |

Expected calibration error on test: 0.0024

## Limitations

* **Read the real-address row first.** Template-generated synthetic addresses are easier than real mail: on the real OpenStreetMap-derived Sri Lankan addresses the required-field exact match is 0.9756 versus 0.9973 on synthetic ones.
* Most Sinhala and Tamil examples are synthetic (built from public gazetteer/OSM/Wikidata resources); the
  Deepparse Sri Lanka split is mostly English. Real envelope transcriptions (proposal section 3.3) must be
  used for the final evaluation; this report validates the pipeline, not field performance on real mail.
* OCR noise is simulated with character substitutions/deletions, not produced by a real OCR engine.
* The threshold only prioritises officer attention; every field is still confirmed by the officer.
