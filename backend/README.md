# Backend – FastAPI + MongoDB

Smart Registered Mail Intake and Tracking API (PostAssist LK, IT23324138).

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env                       # set JWT_SECRET, SEED_DEVICE_KEY, DEMO_PASSWORD
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
.venv/Scripts/python -m pytest -q          # 69 tests (needs MongoDB on localhost:27017)
```
OpenAPI docs: <http://localhost:8000/docs>. Full instructions: [../Documents/Setup_and_Run_Guide.md](../Documents/Setup_and_Run_Guide.md).

## Layout
```
app/
├── main.py              app, CORS, start-up (indexes, demo seed, outbox worker)
├── config.py            settings from environment / .env
├── db.py                MongoDB client and indexes (integrity rules live here)
├── security.py          PBKDF2 passwords, JWT, role guards, device-key auth
├── audit.py             append-only audit log
├── schemas.py           request models (Pydantic)
├── seed.py              demo offices (OSM provenance), users, tariff, policy, device
├── reference/           gazetteer, post offices, vocabulary, 2026 tariff (from Datasets/)
├── routers/             auth, intake, items, scans, review, notifications, devices, iot, public, admin, reports
└── services/
    ├── address/         tokenizer, lexicon, CRF features/parser, normaliser + unsupported-change guard
    ├── ocr/             quality gate, script-ID (ONNX), B1/P1 Tesseract pipelines, handwriting reader (htr.py, ONNX)
    ├── notifications/   templates (EN/SI/TA), adapters (file/SMTP/Resend/SMS stub), outbox worker
    ├── tariff.py        versioned tariff engine with boundary-uncertainty rule
    ├── weighing.py      pairing rules for IoT readings
    ├── state_machine.py mail states, transitions, role permissions
    ├── location.py      L0/L1/L2 location policies (Rice-distribution probability)
    ├── scan_events.py   scan decision pipeline + review
    ├── labels.py        Code 128 / QR SVG
    └── item_views.py    staff view vs. redacted public timeline
models/                  trained address CRF, script-ID and handwriting ONNX models (+ metadata)
tests/                   unit tests and end-to-end acceptance tests (T03–T17)
tools/device_simulator.py  software stand-in for the ESP32 scale + camera
tools/device_bridge.py     connects a board running a pull sketch (/weight, /tare, /calibrate, /capture)
tools/start_all.ps1        starts MongoDB, the API, the bridge and the web app in separate windows
```

## Key design decisions
* **Atomic event + status + notification** without multi-document transactions: an item document embeds
  its events and outbox, and every change is one `update_one` guarded by `revision` (optimistic concurrency).
* **Idempotency everywhere:** unique `draft_id` (repeated acceptance), unique `weight.placement_key`
  (no reused scale reading), client-generated `event_id` (offline replays), notification de-dup key.
* **Decisions are explainable:** quotes list their lines and tariff version; scan decisions list reasons and the
  location-policy version.
