# Software & Hardware Requirements Specification
## Smart Registered Mail Intake and Tracking – PostAssist LK

| | |
|---|---|
| Project | PostAssist LK – Intelligent Backbone for Local Postal Services (J26-IT-372) |
| Component | Smart Registered Mail Intake and Tracking (individual component) |
| Author | Senarathna W.L.S.K – IT23324138 |
| Programme | B.Sc. (Hons) in Information Technology, SLIIT |
| Version / date | 1.0 – 1 October 2026 |
| Status | Draft for supervisor review. Requirements are derived from the approved proposal and the implemented prototype; they must be confirmed with stakeholders (proposal §3.2) before the held-out evaluation. |
| Technology stack | Python (FastAPI) · React · MongoDB · React Native (Expo) field app · ESP32-CAM firmware |

---

### Contents
1. [Introduction](#1-introduction)
2. [Overall description](#2-overall-description)
3. [Hardware requirements](#3-hardware-requirements)
4. [Functional requirements](#4-functional-requirements)
5. [Non-functional requirements](#5-non-functional-requirements)
6. [Business rules](#6-business-rules)
7. [Data requirements](#7-data-requirements)
8. [Machine-learning requirements](#8-machine-learning-requirements)
9. [External interface requirements](#9-external-interface-requirements)
10. [Research evaluation requirements](#10-research-evaluation-requirements)
11. [Traceability matrix](#11-traceability-matrix)
12. [Constraints, assumptions and out-of-scope items](#12-constraints-assumptions-and-out-of-scope-items)
13. [Appendix A – Acceptance test catalogue and status](#appendix-a--acceptance-test-catalogue-and-status)

---

## 1. Introduction

### 1.1 Purpose
This document states **what the Smart Registered Mail Intake and Tracking component must do** (functional
requirements), **how well** it must do it (non-functional requirements), the **hardware** it needs, the
**rules** it enforces and **how each requirement is verified**. It is the reference for implementation,
testing, the viva and the final report.

### 1.2 Problem addressed
Dependable information is lost between counter acceptance of a domestic registered letter and a credible
delivery update. The component investigates four opportunities (proposal §1.1):
1. avoidable **retyping** of envelope details;
2. **weight or tariff transcription errors**;
3. status updates **without sufficient contextual evidence**;
4. **inconsistent communication** when connectivity or a messaging service fails.

### 1.3 Scope
**In scope:** domestic **registered letters** of **5–500 g** (prototype weighing range) at one pilot counter,
a small set of approved handling locations and one destination delivery team, using **synthetic mail** unless
operational approval is obtained.

The component covers: assisted capture of trilingual (Sinhala/Tamil/English) envelope addresses with
officer confirmation; IoT weighing; versioned tariff quotes; registration with barcode/QR label and receipt;
authenticated, location-aware handover and delivery scans; offline capture and idempotent synchronisation;
delivery acknowledgement; reliable sender notifications; a redacted sender tracking page; supervision
(review queue, audit, reports).

**Out of scope:** international mail, parcels and volumetric charging, customs, cash-on-delivery, cash
reconciliation (another member's component), route optimisation, nationwide deployment, legal-for-trade
certification of the DIY scale, use of official Sri Lanka Post numbering ranges.

### 1.4 Definitions
| Term | Meaning |
|---|---|
| Draft | An intake in progress at the counter; can be saved and resumed. |
| Item | A committed registered letter with a tracking ID. |
| Placement | One stable load on the scale between two "empty" states; numbered by the device. |
| Event | A scan recording a requested status, capture time, location evidence and decision. |
| Decision | accepted · held_for_review · rejected · duplicate (· accepted/rejected after review). |
| Location result | consistent · uncertain · mismatch · unlocated · not_assessed. |
| Outbox | Notification records written atomically with the event that caused them. |
| B0 / B1 / P1 | Manual entry / basic OCR + rules / proposed assisted capture (proposal §3.7). |
| L0 / L1 / L2 | Status-only / fixed-radius / uncertainty-aware location policy (proposal §3.10). |
| CER | Character error rate. |
| ECE | Expected calibration error (gap between model confidence and accuracy). |

### 1.5 References
1. Senarathna W.L.S.K., *PostAssist LK – Smart Registered Mail Intake and Tracking System*, project proposal, SLIIT, Sept 2026.
2. Department of Posts Sri Lanka, *Domestic postage revision effective 9 February 2026* (local copy `Datasets/raw/slpost/`).
3. OIML R 76-1, *Non-automatic weighing instruments*.
4. Android `Location` API reference (horizontal accuracy = 68 % radius); W3C Geolocation API.
5. AWS Prescriptive Guidance, *Transactional outbox pattern*.
6. OWASP API Security Top 10 (2023) – API1 Broken Object Level Authorization.
7. Personal Data Protection Act No. 9 of 2022 (Sri Lanka) and amendment No. 22 of 2025.
8. WCAG 2.2.
9. Guo et al., *On Calibration of Modern Neural Networks*, ICML 2017.

---

## 2. Overall description

### 2.1 Product perspective
The component is **independently deployable**: one FastAPI backend with its own MongoDB database, a React
web application, a React Native field application and one IoT device. Other PostAssist LK components may
consume its versioned REST API, but none is required to demonstrate it (FR18).

```
 ┌───────────── Counter PC ─────────────┐        ┌──── Postman / hub phone ────┐
 │ React web app (Vite)                  │        │ Expo field app               │
 │  intake · label · review · IoT · rpt  │        │  scan · GPS · signature      │
 └───────────────┬───────────────────────┘        │  SQLite offline queue        │
                 │ HTTPS/JSON (JWT)               └──────────────┬──────────────┘
                 ▼                                               │
 ┌──────────────────────────── FastAPI backend ─────────────────────────────────┐
 │ auth/roles · intake · OCR pipeline (quality→deskew→script-ID CNN→Tesseract→  │
 │ CRF parser→guard) · tariff engine · labels · scan-event decision pipeline ·  │
 │ location policy · outbox worker · public tracking · audit · reports          │
 └──────────┬───────────────────────────────┬────────────────────┬─────────────┘
            │                               │                    │ e-mail adapter
            ▼                               ▼                    ▼ (file / SMTP / Resend)
       MongoDB 8 (items embed           ESP32-CAM scale+camera   sender
       events + outbox → atomic)        (HTTP push every 0.5 s)
```

### 2.2 User classes
| User | Characteristics | Main goals | Interface |
|---|---|---|---|
| **Counter officer** | Processes a queue; limited time to correct OCR; desktop PC | Accept letters fast and correctly; print label and receipt | Web app |
| **Postman** | Modest Android phone; intermittent network; outdoors | Record out-for-delivery, attempts and deliveries with acknowledgement, also offline | Field app |
| **Hub officer** | Sorting/mail-exchange staff | Record dispatch, in-transit, arrival handovers | Field app or web (USB barcode reader) |
| **Postmaster** | Supervisor and operational decision-maker | Review held events, approve exceptions, monitor failures, manage zones | Web app |
| **Sender** | Member of the public; may not install an app | Receipt and understandable status updates | Printed receipt, e-mail, tracking page |
| **Recipient** | Participates only in acknowledgement | Sign or confirm delivery | Postman's phone |
| **Administrator** | Technical staff | Users, devices, tariff approval, policy switches | Web app / API |
| **IoT device** (system actor) | ESP32-CAM scale + camera | Report weight, execute tare/calibrate/capture | Device API |

### 2.3 Operating environment
* Server: Windows 11 / Linux laptop or small server, Python ≥ 3.11 (tested 3.14), MongoDB ≥ 7 (tested 8.2), optional Tesseract 5 with `sin`, `tam`, `eng`.
* Clients: Chrome/Edge (latest) on the counter PC; Android ≥ 10 with camera and GPS (Expo SDK 57).
* Network: local Wi-Fi (2.4 GHz for the ESP32); the system must keep working at the counter without internet (NFR10).

### 2.4 Design constraints
* Mandated stack: **Python, React, MongoDB** (React Native for the phone, C++/Arduino for the ESP32).
* No mandatory paid service (cloud, SMS, map tiles, geocoder) – NFR10.
* Single backend process plus an in-process background worker; no microservices/Kafka/Kubernetes.
* Personal data handled according to PDPA; real mail only after approvals.

---

## 3. Hardware requirements

### 3.1 IoT scale + envelope camera (purchased)
| ID | Requirement | Implementation |
|---|---|---|
| HW-01 | A Wi-Fi microcontroller with a camera of ≥ 2 MP shall photograph the envelope lying on the platform. | ESP32-CAM (AI-Thinker) with **OV3660 3 MP**; JPEG 2048×1536 (QXGA) with PSRAM. |
| HW-02 | A strain-gauge load cell with capacity ≥ 2× the 500 g working range shall weigh letters. | **1 kg** bar load cell on a wooden bracket (fixed end / loaded end). |
| HW-03 | A 24-bit ADC shall digitise the bridge signal at ≥ 10 samples/s. | **HX711**, channel A, gain 128, 10 SPS. |
| HW-04 | 5 V ↔ 3.3 V logic shall be translated so that no 5 V signal reaches an ESP32 pin. | **4-ch bi-directional level shifter** (HX711 at 5 V for higher excitation). Option B: HX711 at 3.3 V without shifter. |
| HW-05 | The device shall run from a 5 V ≥ 2 A supply. | USB charger + USB breakout + breadboard rails. |
| HW-06 | Only free, non-strapping GPIOs shall be used. | DT → GPIO13, SCK → GPIO14 (SD card unused); GPIO12/16 forbidden. |
| HW-07 | The camera shall be mounted 28–32 cm above the platform, lens down, with diffuse light. | Stand + desk lamp (IoT guide, Step 10). |
| HW-08 | Calibration (offset, factor, calibration id) shall persist across power cycles. | ESP32 NVS (`Preferences`). |
| HW-09 | The device shall report readings at ≥ 1 Hz and execute server commands within 1 s. | 2 Hz push; commands piggy-backed on the response. |
| HW-10 | The device shall expose a local diagnostics page for installation. | `http://<device-IP>/` (live weight, tare, calibrate, test photo). |

Bill of materials (purchased): ESP32-CAM OV3660 Rs 2,750 · load cell 1 kg Rs 450 · HX711 Rs 160 · wooden bracket Rs 600 · level shifter Rs 100 · F–F jumpers Rs 160 · shipping Rs 580 → **Rs 4,800**. Additional items (breadboard, M–F jumpers, USB breakout, reference masses, stand) are listed in the IoT guide §2.

### 3.2 Other hardware
| ID | Requirement |
|---|---|
| HW-11 | Counter PC with a browser; existing printer able to print the label (≥ 60 mm wide) and an A5/A4 receipt. |
| HW-12 | Optional USB barcode reader (keyboard wedge) for label verification and desk scans. |
| HW-13 | Android phone (Android 10+) with rear camera and GPS for each field user in the pilot (2–3 phones for location trials). |
| HW-14 | Reference masses or access to an approved scale for calibration and the 10×10 trials. |

---

## 4. Functional requirements

Priority uses MoSCoW (**M**ust, **S**hould, **C**ould). *Verification* lists automated tests
(`backend/tests/…`) and acceptance scenarios (T-numbers, Appendix A). *Implementation* points to the code.

### 4.1 Access control and security (FR01)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR01.1 | Staff shall authenticate with username and password; passwords stored as salted PBKDF2-SHA256 hashes. | M | Wrong password → 401 and a security audit entry; no password in logs. | `tokens` fixture, manual | `app/security.py`, `routers/auth.py` |
| FR01.2 | Sessions shall use signed, expiring JWTs; the user is re-read on every request so deactivation takes effect immediately. | M | Expired/invalid token → 401. | test suite | `security.get_current_user` |
| FR01.3 | Every endpoint shall enforce **role** rules (admin, postmaster, counter_officer, hub_officer, postman). | M | e.g. counter officer → reports = 403. | `test_reports_export` | `require_roles` |
| FR01.4 | Every item-level operation shall enforce **object-level** rules (office, assignment) – OWASP API1. | M | Unassigned/other-office worker cannot update or view an item (T07). | `test_full_journey…` (T07) | `scan_events.authorize`, `items._visible` |
| FR01.5 | Worker identity for an event shall come from the token, never from the request body. | M | Body has no worker field. | code review | `ScanIn` schema |
| FR01.6 | IoT devices shall authenticate with a per-device key (only its SHA-256 stored); failures audited. | M | Wrong key → 401. | `test_device_auth_rejects_wrong_key` | `security.get_device` |

### 4.2 Counter intake and address capture (FR02–FR05)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR02.1 | The officer shall create an intake draft; it is saved automatically and can be **resumed** after a restart. | M | Draft list shows unfinished drafts with progress. | manual / UI | `POST/GET/PATCH /api/intake/drafts` |
| FR02.2 | A draft shall be cancellable; cancelling releases its scale reading. | S | Placement can be paired again after cancel. | manual | `/drafts/{id}/cancel` |
| FR03.1 | The envelope image shall be captured from the **IoT camera**, a **webcam** or a **file upload**. | M | Image stored, linked to the draft, shown to the officer. | manual, IoT test | `/capture`, `/image`, `ImagePanel` |
| FR03.2 | Each image shall pass an **image-quality check** (resolution, sharpness, brightness, contrast, glare) with recapture advice. | M | Issues listed with codes. | manual | `ocr/quality.py` |
| FR03.3 | The officer shall be able to **crop** the address block and **rotate** the image before OCR. | M | OCR uses the same crop/rotation. | manual | `CropBox`, `apply_crop_rotation` |
| FR03.4 | The system shall produce **script-aware OCR suggestions** for Sinhala, Tamil, English and mixed text (P1): deskew → line segmentation → trained script classifier → Tesseract language pack. | M | Script detected per block; low-confidence words listed. | `ocr_benchmark.py` (T01, T02) | `ocr/pipeline.py`, `ocr/script_id.py` |
| FR03.5 | The system shall offer the **B1 baseline** (all language packs, rule-based field split) for the comparison experiment. | M | Mode selectable per draft. | benchmark | `run_ocr(mode="B1")` |
| FR03.6 | OCR or typed/pasted text shall be split into **structured fields** (name, house no., street, locality, town, district, postcode, country) by the trained CRF tagger, with **per-field confidence**. | M | Low-confidence fields highlighted. | `train_crf.py` report | `address/parser.py` |
| FR03.7 | Town and postcode shall be **checked against the gazetteer** (consistent / mismatch / unknown) and Colombo zone postcodes **suggested, never inserted**. | S | Mismatch warning; derived postcode needs a click. | unit tests | `lexicon.check_city_postcode` |
| FR03.8 | Optional **LLM normalisation** (Gemma 3 4B IT via Ollama) shall be offered; its output passes the **unsupported-change guard** (no new digits, names or script changes). | C | Guard rejects invented house numbers/postcodes. | `test_guard_flags_invented_digits…` | `address/normalizer.py` |
| FR03.9 | If OCR is unavailable or fails, **manual entry** shall always be possible (no blocking). | M | 503 message points to typing; workflow continues (T02, T18). | manual | `OcrUnavailable` |
| FR04.1 | Suggestions shall be shown **separately** from officer-confirmed values; the original suggestion stays visible after edits. | M | "Suggested: …" with *use* button. | UI | `AddressBlock` |
| FR04.2 | The officer shall **confirm** sender, recipient and notification blocks before acceptance; editing after confirmation requires reconfirmation. | M | Accept with unconfirmed fields → 422. | `test_unconfirmed_fields_block_acceptance_FR04` | `/confirm-fields` |
| FR04.3 | Required fields: sender name + town + an address line; recipient name + town + an address line; destination office. | M | Missing → list of problems. | same | `required_problems` |
| FR04.4 | On confirmation the system shall record **corrections** (suggested vs. final per field) and counts for evaluation. | M | `review_stats` present on the draft/item. | report export | `review_stats` |
| FR05.1 | The sender's notification **channel** (e-mail / SMS / none), **contact**, **language** (EN/SI/TA) and **update preference** (key / all) shall be recorded. | M | Invalid e-mail or non-LK mobile number rejected. | unit/API | `contact_problems` |

### 4.3 Weighing and tariff (FR06–FR07)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR06.1 | The counter screen shall show the **live** scale reading (grams, stability, placement, calibration) updated ≤ 1 s. | M | Display follows the device. | manual | `WeightPanel`, `/weight/live` |
| FR06.2 | A reading may be paired only if it is **fresh (≤ 3 s), stable (spread ≤ 1 g over 1 s), loaded, non-negative, from a calibrated, healthy scale** of the officer's office. | M | Each failure returns a coded reason. | `test_weight_pairing_rules_T03` | `weighing.reading_problems` |
| FR06.3 | A placement shall be paired to **one** draft/item only; the previous letter's weight can never be reused. | M | Second draft → `PLACEMENT_ALREADY_USED` (T03). | same | unique index `weight.placement_key` |
| FR06.4 | An **audited manual weight** from an approved instrument (grams, instrument, reason) shall be possible. | M | Audit entry with severity *warning*. | API | `/weight/manual` |
| FR06.5 | Device commands **tare**, **calibrate (known mass)** and **test capture** shall be available to staff. | M | Calibration creates a new calibration id. | IoT page | `routers/devices.py`, firmware |
| FR07.1 | The charge shall be computed from the **versioned tariff in force** on the acceptance date: letter postage band + registration fee + optional services. | M | 20 g → Rs 70 + 60 = **Rs 130.00**. | `test_band_edges`, `test_accept…` | `services/tariff.py` |
| FR07.2 | If *weight ± expanded uncertainty* crosses a band boundary the quote shall be **reweigh_required**; the engine never silently chooses a band. | M | 29 g ± 2 g → reweigh (T04). | `test_boundary_uncertainty_requires_reweigh`, `test_quote_boundary_T04` | `compute_quote` |
| FR07.3 | Missing, overlapping or invalid tariffs shall **block quoting** with a coded error. | M | `TARIFF_AMBIGUOUS`, `TARIFF_NONE_IN_FORCE`, `TARIFF_BANDS_NOT_CONTIGUOUS`. | `test_tariff_selection`, `test_tariff_validation_errors` | `select_tariff`, `validate_tariff` |
| FR07.4 | The quote shall be **itemised** with the tariff version and approval status shown; quotes expire after 10 min. | M | Accept with expired/different quote → 422. | API | `/quote` |
| FR07.5 | Optional services: **advice of delivery** (Rs 100) and **insurance** (Rs 100 per Rs 1,000 or part, ≤ Rs 25,000). | S | Rs 2,500 declared → Rs 300. | `test_optional_services` | tariff JSON |

### 4.4 Registration, label and receipt (FR08–FR09)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR08.1 | Acceptance shall commit **exactly one** item per draft; a repeated request returns the same item. | M | Retry after timeout → same tracking ID (T05). | `test_accept_is_idempotent…` | unique index `draft_id` |
| FR08.2 | Payment shall equal the quoted total; method and reference recorded (no cash reconciliation). | M | Mismatch → 422. | API | `/accept` |
| FR08.3 | Tracking IDs shall be **opaque** (`PA-DEMO-` + 10 random base-32 chars + check char) and contain no personal data. | M | Check char detects all single substitutions and adjacent swaps. | `test_tracking_ids_validate_and_catch_typos` | `tracking_id.py` |
| FR08.4 | A **label** (Code 128 + QR + human-readable ID) and a **receipt** (itemised charge, tracking link + QR) shall be printable. | M | Codes encode only the ID / link. | `test_accept…` (no PII in SVG) | `labels.py`, `LabelPrint.jsx` |
| FR08.5 | Reprints shall reuse the same ID, require a reason and be audited; no second item or payment. | M | T06. | `test_accept_is_idempotent_and_label_reprint_T05_T06` | `/label/printed` |
| FR09.1 | Both printed codes shall resolve to the **same authorised record**; the officer verifies the printed label by scanning it before dispatch. | M | Wrong value → `LABEL_MISMATCH`. | same | `/label/verify`, field-app scanner |

### 4.5 Field scanning, location evidence and delivery (FR10–FR12)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR10.1 | Authorised staff shall record **dispatch, in transit, arrival, out for delivery, attempted, delivered, return started, returned** with **valid transitions only**. | M | Invalid → 409 `INVALID_TRANSITION`. | `test_transitions`, journey test | `state_machine.py` |
| FR10.2 | A late offline scan of an earlier stage shall be kept in **history only**, never regressing the current state. | M | T13. | journey test | `is_late_history` |
| FR10.3 | Returns shall follow an explicit return workflow, keeping earlier attempts. | M | T17. | `test_return_path_T17` | `direction = return` |
| FR10.4 | The scan screen shall show only the statuses the user may record now, plus minimal item data (address only for the delivering postman). | M | Lookup returns `allowed_statuses`. | API | `/api/scans/lookup` |
| FR11.1 | Each scan shall capture **foreground location**: coordinates, reported accuracy, fix age, permission state and the Android **mock-location flag**. | M | Missing fix stored as permission/unavailable, never invented. | field app | `mobile_app/src/location.js` |
| FR11.2 | Location shall be assessed against the event-specific **approved reference area** (origin/destination office facility zone, delivery service area, or a confirmed recipient pin with provenance). | M | A town centroid is never used as a house location. | code, unit tests | `scan_events.reference_zone` |
| FR11.3 | Policies **L0/L1/L2** shall be selectable; each event stores its policy version. L2 classifies by P(inside zone) from the Gaussian error model. | M | inside/outside/stale/imprecise/missing cases (T08, T09). | `test_l2_policy`, simulation | `services/location.py` |
| FR11.4 | Mismatch, unlocated arrival, mock location, future clock and delivery exceptions shall **hold** the event for review; uncertain evidence shall **flag** it. | M | Held events do not change status or notify. | `test_unlocated_arrival…`, journey (T08) | `action_for` |
| FR12.1 | *Delivered* shall require a permitted **acknowledgement** (signature, recipient name or paper-sheet reference) or a documented exception (which is held). | M | No ack → 422 (T10). | journey test | `ingest_scan` |
| FR12.2 | *Attempted* and *return started* shall require a reason. | M | 422 without reason. | `test_return_path_T17` | same |

### 4.6 Offline operation and synchronisation (FR13)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR13.1 | The field app shall write each scan to a **durable local queue** with a once-generated event id **before** uploading. | M | Survives app restart (T11). | manual (airplane mode) | `mobile_app/src/db.js` |
| FR13.2 | Upload shall reuse the same id; the server shall be **idempotent** (duplicate → same answer). | M | 1,000 replays → 1 event, 1 message (T12). | `test_replay_1000_times_T12` | `ingest_scan` |
| FR13.3 | Pending, accepted, held and rejected counts shall be **visible** on the phone; an event leaves *pending* only after a durable server answer. | M | Network error keeps it pending. | manual | `HomeScreen`, `sync.js` |
| FR13.4 | Upload shall start automatically when connectivity returns, in capture order. | M | NetInfo trigger; batch sorted by `captured_at`. | manual | `/api/scans/batch` |

### 4.7 Sender notifications (FR14)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR14.1 | Messages shall be created **only for committed eligible events**, atomically with the event (transactional outbox). | M | Held/rejected/pending → no message (T10, T14). | `test_unlocated_arrival…_T14` | `outbox.build_entries`, single-document update |
| FR14.2 | De-duplication key = event + recipient + channel + template version. | M | T12. | replay test | `dedupe_key` |
| FR14.3 | Delivery shall use **bounded exponential back-off**; permanent failures and **ambiguous** outcomes (timeout after possible acceptance) appear on the dashboard; ambiguous ones are retried only with an idempotent provider. | M | T15. | `test_provider_failures_T15` | `OutboxWorker` |
| FR14.4 | Messages shall be available in **English, Sinhala and Tamil**, without precise addresses or worker coordinates; *delivered* wording does not claim GPS proof; delayed sync is disclosed. | M | Template review. | template preview | `notifications/templates.py` |
| FR14.5 | Adapters: e-mail to file (default), SMTP, Resend; SMS stub (optional gateway). | S | Configurable by env. | config | `adapters.py` |

### 4.8 Sender tracking page (FR15)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR15.1 | The sender shall see a **redacted timeline** (status, time, coarse office place, delayed-sync note) via the receipt link, without an app. | M | No coordinates, worker names or recipient name. | journey test (T16) | `/api/public/track`, `Track.jsx` |
| FR15.2 | The link token shall be in the URL **fragment** and required; wrong token and unknown ID look identical (404). | M | T16. | journey test | `routers/public.py` |

### 4.9 Supervision (FR16)
| ID | Requirement | Pri. | Acceptance criteria | Verification | Implementation |
|---|---|---|---|---|---|
| FR16.1 | Postmasters shall review held events and **approve or reject with a mandatory reason**; approval applies the status and queues messages only if the transition is still valid. | M | Approved arrival changes status. | journey test | `review_event` |
| FR16.2 | A list of **accepted-but-flagged** events shall be available. | S | – | UI | `/api/review/flagged` |
| FR16.3 | An **audit log** shall record logins, security denials, acceptance, scans, reviews, reprints, manual weights, policy/tariff changes – searchable by action, target, severity. | M | Entries contain identifiers and reasons, not personal data. | UI | `audit.py`, `/api/review/audit` |
| FR16.4 | Failed/ambiguous notifications shall be **retryable** or **resolvable** with a reason. | M | – | UI | `/api/notifications/...` |
| FR16.5 | **CSV exports** (intake tasks, scan events, notifications) shall support the evaluation without names or addresses. | M | 403 for non-postmasters. | `test_reports_export` | `routers/reports.py` |
| FR16.6 | Postmasters shall maintain **office reference zones** with mandatory provenance ("use my location" helper). | M | Provenance required. | UI | `PATCH /api/admin/offices/{id}` |
| FR16.7 | Postmasters may assign items to postmen and set a confirmed recipient pin (with provenance). | S | – | API | `/assign`, `/recipient-pin` |

### 4.10 Optional features (FR17)
| ID | Requirement | Pri. | Status |
|---|---|---|---|
| FR17.1 | Recipient OTP acknowledgement | C | Schema supports `type=otp`; delivery of OTP not implemented (excluded from the minimum gate). |
| FR17.2 | Push notifications (FCM) for app users | C | Not implemented. |
| FR17.3 | Map view of scans | C | Not implemented; OSM link on the Offices page only. |

### 4.11 Integration (FR18)
| ID | Requirement | Pri. | Acceptance criteria | Implementation |
|---|---|---|---|---|
| FR18.1 | The component shall run **stand-alone** in a clean environment (seeded demo data, no peer services). | M | Fresh DB → working demo after `uvicorn` start. | `seed.py` |
| FR18.2 | A versioned, documented REST API (OpenAPI at `/docs`) shall be exposed for peer components. | M | `/openapi.json`, version 1.0.0. | `main.py` |

---

## 5. Non-functional requirements

| ID | Quality | Requirement / acceptance criterion | How verified | Current evidence |
|---|---|---|---|---|
| NFR01 | Responsiveness | 95th-percentile non-OCR API response < 2 s at 10 concurrent pilot users | load test on the pilot laptop (to do) | 43 API/unit tests incl. 1,000 sequential scan replays complete in ≈ 9 s total |
| NFR02 | OCR usability | Progress shown, manual fallback always available; target < 8 s per image on the counter PC | `timings` in every OCR result; benchmark | script-ID inference 2 ms/line on CPU; OCR timing to be measured with Tesseract |
| NFR03 | Data integrity | No duplicate accepted item or committed event in idempotency tests; every revision retained | automated tests | T05, T12 pass; event history append-only, revision counter |
| NFR04 | Offline durability | Every locally saved scan recovered after restart; pending visibly flagged | manual airplane-mode test (T11) | SQLite WAL queue, saved before upload |
| NFR05 | Notification timeliness | Eligible event queued at commit; first provider attempt ≤ 60 s when online | `notifications.csv` (commit→provider seconds) | worker polls every 2 s |
| NFR06 | Privacy & security | Deny every planned unauthorised-object test; no PII in codes, URLs or ordinary logs | tests T07, T16; code review | codes hold only the ID; token in URL fragment; audit stores ids/reasons; images and mail git-ignored |
| NFR07 | Usability | ≥ 90 % core-task completion; SUS ≥ 70 | usability sessions (template provided) | to be measured |
| NFR08 | Accessibility | Keyboard-operable counter flow, labelled fields, visible focus, no colour-only cues; selected WCAG 2.2 checks | manual audit | skip link, focus ring, text + colour badges, `aria-live` weight display |
| NFR09 | Maintainability | Versioned API/schema, reproducible setup, automated critical-path tests, documented backup/restore | repo review | `requirements.txt` pinned, `run_all.sh`, 43 tests, model metadata with feature version; backup: `mongodump`/`mongorestore` |
| NFR10 | Portability & cost | Runs locally with one Android phone, no mandatory paid cloud/SMS/peer component | clean-machine demo | file e-mail adapter, local MongoDB, Expo Go, no paid APIs |
| NFR11 | Explainability | Every quote shows its lines and tariff version; every scan decision lists reasons and the policy version | UI/API | `reasons`, `policy_version`, `assessment.reasons` |
| NFR12 | Localisation | Sinhala and Tamil text accepted, stored (NFC) and displayed; messages in three languages | UI test with sample addresses | Noto Sinhala/Tamil font stack, `lang` attributes |

---

## 6. Business rules

### 6.1 Tariff (version `SLP-DOM-2026-02-09`, transcribed, pending approval)
`charge = letter postage(band) + registration fee (Rs 60) + advice of delivery (Rs 100, optional) + insurance (Rs 100 per Rs 1,000 or part, optional)`

| Weight band (g) | ≤30 | ≤40 | ≤50 | ≤60 | ≤70 | ≤80 | ≤90 | ≤100 | ≤200 | ≤300 | ≤400 | ≤500 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Postage (Rs) | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 160 | 180 | 200 | 220 |
| **Registered total (Rs)** | **130** | 140 | 150 | 160 | 170 | 180 | 190 | 200 | 220 | 240 | 260 | 280 |

Bands are `lower < W ≤ upper`. Boundary rule: if `[W − U, W + U]` crosses a band limit → reweigh / approved exception.
Prototype range 5–500 g; above it only an audited manual weight from an approved scale (up to the tariff maximum 2 kg).

### 6.2 State model and permissions
| From \ to | dispatched | in_transit | at_destination_office | out_for_delivery | delivery_attempted | delivered | return_started | returned_to_sender |
|---|---|---|---|---|---|---|---|---|
| accepted | ✓ | | | | | | | |
| dispatched | | ✓ | ✓ | | | | | |
| in_transit | | ✓ | ✓ | | | | | ✓ (return only) |
| at_destination_office | | | | ✓ | | | ✓ | |
| out_for_delivery | | | | | ✓ | ✓ | | |
| delivery_attempted | | | ✓ | ✓ | | | ✓ | |
| return_started | | ✓ | | | | | | ✓ |

| Role | May record | Object rule |
|---|---|---|
| Counter officer | dispatched | item accepted at own office |
| Hub officer | dispatched, in_transit, at_destination_office | dispatch only at origin; arrival only at destination office |
| Postman | out_for_delivery, delivery_attempted, delivered | destination office = own office; postcode in beat or assigned; attempt/delivery only if assigned to self |
| Postmaster | all scan statuses incl. returns; review | own office is origin or destination |

### 6.3 Location policy L2 (default `LOC-2026.10-L2`)
| Condition | Result |
|---|---|
| no fix / permission denied / timeout | unlocated |
| no approved reference area | uncertain |
| fix older than 120 s, or reported accuracy > 250 m | uncertain |
| P(inside zone) ≥ 0.80 (σ from accuracy as 68 % radius) | consistent |
| P(inside zone) ≤ 0.05 | mismatch |
| otherwise | uncertain |

Actions: mismatch → **hold**; unlocated arrival → **hold**; uncertain → **accept & flag**; mock location → **hold**.

### 6.4 Notifications
Key updates (default): accepted, out for delivery, attempted, delivered, return started, returned. "All updates" adds dispatched, in transit, arrival. Max 6 attempts, back-off 10 s × 2ⁿ (≤ 1 h).

---

## 7. Data requirements

| Collection | Content | Personal data | Retention (pilot) |
|---|---|---|---|
| `users` | username, role, office, beat, PBKDF2 hash | staff names | project duration |
| `offices` | reference point, zone radii, provenance | none | – |
| `drafts` | intake fields, suggestions, corrections, timings, weight, quote | sender/recipient | delete with the dataset after evaluation |
| `items` | confirmed fields, weight, quote, payment, **embedded events and outbox**, label, public token | sender/recipient, contact, signature | per approved protocol |
| `images` (+ files in `backend/storage/images`) | envelope photos | yes | per approved protocol; git-ignored |
| `devices`, `device_readings` (TTL 3 days), `device_commands`, `captures`, `weighing_trials` | IoT data | none | readings auto-expire |
| `tariffs`, `location_policies` | versioned rules | none | permanent (versions never edited) |
| `audit_log` | actor, action, target id, reason | staff usernames | project duration |

Data-quality rules: Unicode NFC normalisation; original OCR text kept next to confirmed values; gazetteer
corrections documented (Datasets/README §7); coordinates always stored with accuracy, age and provenance.

Research datasets required (proposal Table 6): 360 consented/synthetic envelope images (120 per script,
60 printed/60 handwritten), 10×10 weighing trials, ~120 location scans at 6 areas, 1,000 replay requests,
12–16 usability participants – templates in `Datasets/templates/`.

---

## 8. Machine-learning requirements

| ID | Requirement | Achieved (held-out test) | Artefact |
|---|---|---|---|
| ML-01 | A **script-identification** model shall choose Sinhala/Tamil/Latin per text line with ≥ 97 % accuracy on fonts not seen in training, ≤ 20 ms/line on CPU. | Shipped model **98.6 %** on 6 held-out fonts and unseen text (3 seeds: 97.5 % ± 1.4 %); printed fonts 99.5 %; handwriting-style Latin 94.1 % (seeds: 87.5 % ± 7.9 % – the weak spot); 2–7 ms/line (ONNX Runtime, CPU); ECE 0.067 → 0.012 after temperature scaling | `backend/models/script_id.onnx`, `ml/reports/script_id/REPORT.md` |
| ML-02 | An **address-field tagger** shall reach ≥ 95 % required-field exact match on addresses from towns unseen in training and beat the rule baseline. | **99.4 %** overall (real OSM-derived addresses **97.6 %**, synthetic 99.7 %, with OCR noise 98.7 %) vs. rule baseline 57.5 % | `backend/models/address_crf.crfsuite`, `ml/reports/address_parser/REPORT.md` |
| ML-03 | Field confidence shall be **calibrated** and a review threshold chosen on validation, frozen before testing. | ECE 0.002; threshold 0.974 flags 1.7 % of fields and catches 55 % of errors; un-flagged accuracy 99.7 % | model metadata |
| ML-04 | Models shall never invent address content; generative output passes the unsupported-change guard. | guard unit tests pass | `normalizer.guard` |
| ML-05 | Training shall be reproducible from public data with fixed seeds and grouped splits (no town/font leakage). | `run_all.sh`; group overlap = 0 | `ml/` |
| ML-06 | Models shall load with a fallback: missing model → rules / manual entry, never a blocked counter. | `engine: rules` fallback | `parser._load_model` |

Limitations that must be reported: Sinhala/Tamil training text is largely synthetic; no public Sinhala
handwriting font; handwriting-style script identification varies between training runs (87.5 % ± 7.9 %), so P1 always
adds the English pack for non-English blocks and the officer can set the script manually; OCR noise simulated; final claims need the consented envelope set.

---

## 9. External interface requirements

### 9.1 User interfaces
* **Counter web app:** login; counter home (open drafts, capability badges); intake wizard (image & crop, OCR, fields with suggestions/confidence, destination & updates, confirmation, live weight, quote, payment); label/receipt print with verification; items; desk scan; review queue; messages; IoT scale; offices & zones; reports; audit.
* **Field app:** login with server address; home (online/offline, pending/held/rejected counts, recent scans, upload now); scanner (Code 128 + QR, manual entry); event screen (allowed statuses, reasons, acknowledgement with signature pad).
* **Public tracking page:** `/track/<ID>#t=<token>`.

### 9.2 Hardware interface (device API)
`X-Device-Id` / `X-Device-Key` headers; `POST /api/iot/readings` (≈2 Hz, response carries commands),
`POST /api/iot/captures/{id}` (JPEG), `POST /api/iot/commands/{id}/result`. Details: IoT guide §18.

### 9.3 Software interfaces (REST, JSON, OpenAPI at `/docs`)
| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Intake | `/api/intake/drafts` (CRUD), `/drafts/{id}/image`, `/capture`, `/ocr`, `/parse/{target}`, `/confirm-fields`, `/weight/pair`, `/weight/manual`, `/weight/live`, `/quote`, `/accept`, `/api/intake/parse`, `/normalize`, `/address-check`, `/capabilities` |
| Items | `/api/items`, `/{id}`, `/{id}/label`, `/label/printed`, `/label/verify`, `/assign`, `/recipient-pin`, `/rotate-link` |
| Scans | `POST /api/scans`, `POST /api/scans/batch`, `GET /api/scans/lookup/{id}`, `GET /api/scans/statuses` |
| Review & audit | `/api/review/held`, `/flagged`, `POST /api/review/{id}/{event}`, `/api/review/audit` |
| Notifications | `/api/notifications`, `/{id}/{key}/preview`, `/retry`, `/resolve` |
| Devices | `/api/devices`, `/{id}/live`, `/readings`, `/commands`, `/trials`, `/trials.csv`, `/uncertainty`, `/rotate-key` |
| Public | `GET /api/public/track/{id}` (header `X-Tracking-Token`) |
| Admin & reports | `/api/admin/offices`, `/tariffs`, `/policy`, `/policy/mode`, `/users`; `/api/reports/intake.csv`, `/events.csv`, `/notifications.csv`, `/summary` |

### 9.4 Communications
HTTPS recommended for every client (HTTP only on a closed lab network); ESP32 supports HTTPS with a pinned
root CA; e-mail through SMTP/Resend; MongoDB on localhost or TLS-protected Atlas.

---

## 10. Research evaluation requirements

| Objective | Metric and target (proposal) | Tool in this repository |
|---|---|---|
| **SO1** assisted capture | ≥ 20 % lower median intake time than manual; ≥ 98 % confirmed required-field exact match; report handwriting failures | intake configuration B0/B1/P1 + `intake_tasks.csv`; `ocr_benchmark.py`; usability template |
| **SO2** IoT weighing & tariff | MAE ≤ 1 g over 5–500 g; 100 % tariff agreement incl. boundaries; boundary uncertainty never silently rounded | IoT trials → `weighing_analysis.py`; tariff tests (item-05 cross-check, band edges, boundary rule) |
| **SO3** location-aware scans | compare L0/L1/L2; ≤ 5 % false acceptance of clearly-outside valid-location trials; report rejection/uncertainty rates | policy switch, `scan_events.csv`, `location_trials_template.csv`; simulation (20,000 scans per scenario): false acceptance L0 100 %, L1 0 %, **L2 0 %**; L1 turns 6.9 % of valid scans into hard mismatches and accepts 90 % of stale fixes, L2 only 1.7 % mismatches and 0 % stale acceptance, at the cost of flagging 18.7 % of valid scans as uncertain |
| **SO4** offline sync & messaging | zero duplicate events in 1,000 replays; zero messages from rolled-back/pending events; all durable local events recovered | `test_replay_1000_times_T12` (pass), outbox tests (pass), airplane-mode protocol |

---

## 11. Traceability matrix

| Objective | Requirements | Main modules | Tests / evidence |
|---|---|---|---|
| SO1 | FR02, FR03, FR04, FR05, NFR02, NFR07, NFR12, ML-01…06 | `routers/intake.py`, `services/ocr/*`, `services/address/*`, `ImagePanel`, `AddressBlock` | `test_units.py` (address), ML reports, `ocr_benchmark.py`, T01, T02, T18 |
| SO2 | FR06, FR07, FR08, FR09, HW-01…10 | `services/weighing.py`, `services/tariff.py`, `routers/devices.py`, `routers/iot.py`, firmware | tariff unit tests, T03–T06, weighing analysis |
| SO3 | FR01, FR10, FR11, FR12, FR16, NFR06, NFR11 | `services/scan_events.py`, `services/location.py`, `state_machine.py`, field app | journey test (T07, T08, T10, T13), `test_l2_policy`, simulation, T09, T17 |
| SO4 | FR13, FR14, FR15, NFR03–NFR05 | `notifications/*`, `mobile_app/src/{db,sync}.js`, `routers/public.py` | T11, T12, T14, T15, T16 |
| Cross-cutting | FR18, NFR08–NFR10 | `seed.py`, `main.py`, docs | clean-environment demo |

---

## 12. Constraints, assumptions and out-of-scope items
* **Approvals:** no real customer mail, staff evaluation or electronic delivery acknowledgement before institutional ethics and Department of Posts approval; until then synthetic mail and role-based participants are used and findings are labelled as simulation.
* **Metrology:** the DIY scale is a research demonstrator; official charging uses an approved instrument.
* **Tariff:** transcribed from the official notice; must be approved by an authorised officer.
* **Location:** GPS is uncertain supporting evidence, never proof of delivery or recipient presence.
* **Identifiers:** `PA-DEMO` prefix until an official numbering range is allocated.
* **Assumptions:** 2.4 GHz Wi-Fi at the counter; Android phones with GPS; Tesseract language packs installed for OCR experiments.

---

## Appendix A – Acceptance test catalogue and status

| Test | Scenario (proposal Table 15) | Expected outcome | Automated test / evidence | Status |
|---|---|---|---|---|
| T01 | Clear printed envelope, correct OCR suggestion | Officer confirms; original and reviewed fields distinguishable | UI (suggestion vs. confirmed), `review_stats` | implemented – run with Tesseract |
| T02 | Blurred handwritten Sinhala/Tamil address | Recapture or manual entry; no invented completion | quality gate, manual entry, guard tests | implemented |
| T03 | Previous item's reading offered to a new draft | Rejected; fresh reading required | `test_weight_pairing_rules_T03` | **pass** |
| T04 | Weight uncertainty overlaps a boundary | Reweigh / approved exception | `test_quote_boundary_T04`, `test_boundary_uncertainty_requires_reweigh` | **pass** |
| T05 | Acceptance repeated after a timeout | Same item and receipt | `test_accept_is_idempotent_and_label_reprint_T05_T06` | **pass** |
| T06 | Printer fails after acceptance | Reprint same ID, audited | same | **pass** |
| T07 | Unassigned worker scans a valid code | Denied, security audit | `test_full_journey_with_location_review_and_messages` | **pass** |
| T08 | Fix clearly outside the facility zone | Held; no misleading arrival | same | **pass** |
| T09 | Location denied or fix stale | Unlocated/uncertain per policy | `test_unlocated_arrival_is_held_T09…`, `test_l2_policy` | **pass** |
| T10 | Delivered without acknowledgement | Rejected/held; no delivered message | journey test | **pass** |
| T11 | Offline save then app restart | Pending survives, same id | field-app manual test | to run on device |
| T12 | Same scan uploaded 1,000 times | One event, one message | `test_replay_1000_times_T12` | **pass** |
| T13 | Late transit scan after delivered | History only | journey test | **pass** |
| T14 | Rollback / held event | No message | `test_unlocated_arrival…_T14` (held), single-document atomic commit | **pass** |
| T15 | Provider timeout after possible acceptance | Ambiguous outcome handled, no false exactly-once claim | `test_provider_failures_T15` | **pass** |
| T16 | Sender changes URL to another ID | No disclosure | journey test | **pass** |
| T17 | Approved return after failed attempts | Explicit return states, attempts kept | `test_return_path_T17` | **pass** |
| T18 | Map/geocoder unavailable | Counter and timeline continue | no runtime map/geocoder dependency | **pass by design** |
