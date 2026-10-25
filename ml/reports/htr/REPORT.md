# Handwriting recogniser – evaluation report

Model trained 2026-10-11T12:15:46+00:00 · CRNN: 7 conv -> 2 x BiLSTM(256) -> linear, CTC · 4.5 M parameters · best epoch 37 of 40 · 195 characters · ONNX, 13.1 ms per Sinhala line on CPU.
Baseline: Tesseract 5.5.3.20260724, one line per call, on the line as scanned (*raw*) and on the cleaned ink image the model receives (*cleaned*).

## Training data

| Script | Real handwriting | Synthetic |
|---|---|---|
| Sinhala | SinOCR handwritten: 820 training lines (88 validation, 227 test) | address text spelled with handwritten characters of the 454-class set (51,849 characters of 270 classes); printed fonts |
| English | IAM lines: 6,482 training lines (976 validation, 2,915 test) | address text in handwriting-style fonts |
| Tamil | **none** | fonts only |

## Results on held-out test lines

CER = character error rate, WER = word error rate, exact = lines read without any error.

| Test set | Lines | Model CER | Model WER | Model exact | Tesseract CER (raw) | Tesseract CER (cleaned) | Tesseract WER (cleaned) | Tesseract exact (cleaned) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sinhala handwriting (SinOCR test, real) | 227 | **18.1%** | 55.5% | 25.6% | 90.7% | 91.1% | 118.4% | 0.0% |
| English handwriting (IAM test sample, real) | 400 | **9.2%** | 31.1% | 14.8% | 56.2% | 55.4% | 94.7% | 0.0% |
| Tamil, fonts never seen in training (synthetic) | 300 | **0.4%** | 2.4% | 94.7% | – | – | – | – |
| English address text, handwriting-style font never seen (synthetic) | 300 | **2.0%** | 13.1% | 75.3% | – | – | – | – |

## How to read these numbers

* The two real rows are the evidence. Both test sets come from the same collections and scanning conditions as the training lines; a phone or ESP32 photo of a new writer is harder, so expect higher error at the counter. Measure it on your own consented envelope set with `ml/evaluation/ocr_benchmark.py` before quoting a figure in the thesis.
* **Tamil handwriting is untested.** No real Tamil handwriting was used for training or testing; the Tamil row only shows that the network reads Tamil in unseen *fonts*.
* Handwritten digits come only from fonts and the few digits in the real lines; house numbers and postcodes must always be checked by the officer. Inside a token that is clearly a number the decoder prefers a digit the network also considered (l -> 1, O -> 0) and keeps the word flagged as low confidence.
* A word error rate near one half means about every second handwritten word still contains a mistake: the model saves typing, it does not replace reading the envelope.
* The labels of the 454-class character set were assigned by reading sample sheets (the archive has no label file). 270 classes are used; a wrong label would add noise to the synthetic Sinhala lines only, never to a test set.
* Every OCR result remains a suggestion that the counter officer confirms field by field.

## Examples (first test lines, not selected)

### Sinhala (SinOCR test)
* truth: `හෘද සැත්කමක්`
  * model: `හෘද සැන්කම්ක්`
  * Tesseract (cleaned line): `හෘද සෑන්කමික්‌`
* truth: `රෙදි මැසීම`
  * model: `කරදි මැසීම`
  * Tesseract (cleaned line): `අවු... Ba`
* truth: `මානසික`
  * model: `මානසික`
  * Tesseract (cleaned line): `බා »Sem`
* truth: `සුරසිංහ ආරච්චිගේ නිපුන් තේජාන් ෆොන්සේකා`
  * model: `සුරසිංක ආරච්ටිගේ නිසක් තේෂාන් ෆොන්සේකා`
  * Tesseract (cleaned line): `තුර... ඇව න්‌... ගණන්‌... පය අත්තට`
* truth: `නො 304, ශ්රී වික්රම රාජ සිංහ පාර, 3 වන කුරණ, මීගමුව`
  * model: `නො ද07, පු විබුම රාජ සිංහ පාර, නවන කුරණ, මීකලුව`
  * Tesseract (cleaned line): `ණෲ... 32... 344%. ඈද... 47, 7207`
* truth: `විදුලි ඉංජිනේරු ii පංතිය`
  * model: `බිදුලි ඉජ්නේරු පී පංතිය`
  * Tesseract (cleaned line): `ඈ ලි go ණ්ගෝදව RF vedo`

### English (IAM test)
* truth: `assuredness " Bella Bella Marie " (Parlophone), a lively song that changes tempo mid-way.`
  * model: `assuredness " Bella Bella Marie " (larlophone), a lively song that chronges tempo mid-way.`
  * Tesseract (cleaned line): `xssuredness "Bella Bella Marie” ( farlophone }, 0 lively song that chonge tempo mid-way.`
* truth: `writer. He writes with Tolchard Evans, composer of " Lady of Spain " and other big hits.`
  * model: `writer. He writes with Tolchard Evans, composer of " Lady of Spain " and other big hits.`
  * Tesseract (cleaned line): `writer. He writes with Tolchard Evens, COMPOSE FOF N Lady of Spain" and olher big hits.`
* truth: `" McNamara's Band, " " Greensleeves " and " English Rose. "`
  * model: `' He Vamara's tand, " " breepsleves and " tnglish bose. "`
  * Tesseract (cleaned line): `"He Vawara’s bound,” ” Greeys Leeves” and » bagi bose. ”`
* truth: `I T V have postponed Malcolm Muggeridge's " Appointment with`
  * model: `I TV have portponed Malcolen Mnggeridge's " A ppointment with`
  * Tesseract (cleaned line): `T TV have pot poqed Malic tts Maageri dye’ s A py ovgtiacad with`
* truth: `first big T V part. The play was a brilliantly-written`
  * model: `Atrst big 7V part. TThe play was a builliontly-witther`
  * Tesseract (cleaned line): `Ayer bq TW yok We sony wos a ber teat hy-wily`
* truth: `what he was - Potter, a frightened boy who had a`
  * model: `what he was - ltter, a frightened bey who had a`
  * Tesseract (cleaned line): `wok he WOR - Uber o Ieigitened boy elre liad o`

### Tamil (unseen fonts)
* truth: `கோமிலமவரல 81072`
  * model: `கோமிலமவரல 81072`
* truth: `பொல்லட் (WP)`
  * model: `பொல்லட் (WP)`
* truth: `டாக்டர் ம. கே. ந. இரேஷா கமகே இல: 86/D மதஹபொல`
  * model: `டாக்டர் ம. கே. ந. இரேஷா கமகே இல: 86/D மதஹபொல`
* truth: `காளி கோவில் வீதி`
  * model: `காளி கோவில் வீதி`
* truth: `இலக்கம் 256/5.`
  * model: `இலக்கம் 256/5.`
* truth: `எம். எஸ். இசுரு ஹேரத் அவர்கள்`
  * model: `எம். எஸ். இசுரு ஹேரத் அவர்கள்`

## Reproduce

```bash
ml/.venv/Scripts/python ml/htr/build_cache.py
ml/.venv/Scripts/python ml/htr/train.py
ml/.venv/Scripts/python ml/htr/evaluate.py
```
Training took 71.5 minutes on cuda (PyTorch 2.11.0+cu128, seed 372).
