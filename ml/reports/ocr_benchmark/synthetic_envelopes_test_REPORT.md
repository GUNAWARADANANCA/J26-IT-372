# OCR benchmark - synthetic_envelopes (test, 67 images, Tesseract 5.5.3.20260724)

| Config | CER (median) | Required-field exact match | Unsupported digit changes | Median time (ms) |
|---|---|---|---|---|
| B1 | 0.956 | 0.166 | 160 | 522 |
| P1 | 1.000 | 0.169 | 269 | 485 |
| P1+HW | 1.000 | 0.166 | 265 | 758 |

| Group | B1 field EM | P1 field EM | P1+HW field EM | B1 CER | P1 CER | P1+HW CER | read by handwriting model |
|---|---|---|---|---|---|---|---|
| en/handwriting | 0.062 | 0.094 | 0.094 | 1.000 | 1.028 | 1.028 | 0% |
| en/printed | 0.244 | 0.415 | 0.415 | 0.729 | 0.743 | 0.743 | 0% |
| mixed/handwriting | 0.147 | 0.176 | 0.176 | 1.000 | 1.078 | 1.078 | 0% |
| mixed/printed | 0.281 | 0.250 | 0.250 | 0.750 | 0.819 | 0.819 | 0% |
| si/handwriting | 0.143 | 0.000 | 0.000 | 0.784 | 1.064 | 1.064 | 12% |
| si/printed | 0.119 | 0.024 | 0.000 | 1.127 | 1.423 | 1.410 | 11% |
| ta/handwriting | 0.192 | 0.192 | 0.192 | 0.431 | 0.733 | 0.733 | 0% |
| ta/printed | 0.133 | 0.178 | 0.178 | 1.061 | 1.115 | 1.159 | 10% |

Field accuracy is measured *before* officer correction. Report synthetic results as pipeline validation only.
