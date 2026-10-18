# Setup and Run Guide – Smart Registered Mail Intake and Tracking

**PostAssist LK · J26-IT-372 · Senarathna W.L.S.K (IT23324138)**
Stack: **Python (FastAPI) · React (Vite + Tailwind) · MongoDB** · React Native (Expo) field app · ESP32-CAM firmware.

```
J26-IT-372/
├── backend/      FastAPI API, MongoDB access, OCR/ML inference, outbox worker, tests
├── frontend/     React web app: counter intake, items, review, IoT scale, reports, public tracking page
├── mobile_app/   Expo (React Native) app for postmen/hub officers: scan, location, offline queue, signature
├── iot/          ESP32-CAM firmware (scale + envelope camera)
├── ml/           dataset builders, model training, evaluation scripts, reports
├── Datasets/     public datasets, processed corpora, templates  (see Datasets/README.md)
└── Documents/    requirements, IoT hardware guide, this guide
```

---

## 1. Install the prerequisites (once)

| Tool | Version tested | Notes |
|---|---|---|
| **Python** | 3.14 (3.11+ works) | <https://www.python.org/downloads/> – tick "Add python.exe to PATH". |
| **Node.js** | 22 LTS | <https://nodejs.org/> – needed for the web and mobile apps. |
| **MongoDB Community Server** | 8.2 | <https://www.mongodb.com/try/download/community> – the MSI installs a Windows service on `mongodb://127.0.0.1:27017`. *Alternative:* a free MongoDB Atlas cluster – put its connection string in `MONGODB_URI`. |
| **Tesseract OCR** + Sinhala/Tamil data | 5.x | Windows: install the UB Mannheim build (<https://github.com/UB-Mannheim/tesseract/wiki>). In the installer open **Additional language data** and tick **Sinhala** and **Tamil** (English is default). If you missed them, copy `sin.traineddata` and `tam.traineddata` from <https://github.com/tesseract-ocr/tessdata_best> into `C:\Program Files\Tesseract-OCR\tessdata`. *Optional:* without Tesseract the system still works – officers type/paste the address and the trained parser splits it. |
| **Git Bash** | – | All commands below are for Git Bash from the repository root (PowerShell equivalents in brackets where they differ). |
| Android phone | Android 10+ | Install **Expo Go** from the Play Store for the field app. |
| *Optional* **Ollama** + `gemma3:4b` | – | Only for the LLM-normalisation experiment (proposal §3.8): `ollama pull gemma3:4b`, then set `LLM_PROVIDER=ollama`. |
| *Optional* Arduino IDE 2 | – | For the IoT device – see [IoT_Hardware_Setup_Guide.md](IoT_Hardware_Setup_Guide.md). |

Find your laptop's LAN IP (needed by the phone and the ESP32): run `ipconfig` and read *IPv4 Address* of the Wi-Fi adapter, e.g. `192.168.1.10`.

## 2. Backend (FastAPI + MongoDB)

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env          # then edit .env (PowerShell: copy .env.example .env)
```

Edit `backend/.env` at least:
* `JWT_SECRET` – a long random string (`python -c "import secrets; print(secrets.token_urlsafe(48))"`)
* `SEED_DEVICE_KEY` – a random string; the **same** value goes into the ESP32 `config.h`
* `DEMO_PASSWORD` – password for all demo accounts (default `PostAssist#2026`)
* `PUBLIC_BASE_URL` – where the web app runs, e.g. `http://192.168.1.10:5173` so tracking links work on phones

Run it (listening on all interfaces so the phone and the ESP32 can reach it):
```bash
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* API docs: <http://localhost:8000/docs> · health: <http://localhost:8000/api/health>
* On first start the API creates indexes and the **demo data**: offices (with OpenStreetMap provenance), the 2026 tariff, the L2 location policy, the IoT device and the accounts below.
* Allow Python through Windows Defender Firewall on **private** networks (port 8000) when Windows asks.

### Demo accounts (password = `DEMO_PASSWORD`)
| Username | Role | Office | Use it for |
|---|---|---|---|
| `counter2` | counter officer | SLIIT Malabe demo counter (owns `SCALECAM-01`) | counter intake with the IoT scale |
| `hubdemo` | hub officer | SLIIT demo | dispatch / arrival scans in campus trials |
| `postman2` | postman | SLIIT demo | mobile app: out for delivery, delivered |
| `pm2` | postmaster | SLIIT demo | review queue, messages, reports, offices |
| `counter1`, `hub1`, `hubjaf`, `postman1`, `pm1` | – | Kaduwela, Central Mail Exchange, Jaffna | the Kaduwela → Colombo → Jaffna journey (proposal §4.5) |
| `admin` | administrator | – | devices, users, tariff approval, location-policy switch |

### Tests
```bash
cd backend
.venv/Scripts/python -m pytest -q
```
69 tests: 32 unit tests (tariff incl. the official item-05 cross-check, location probability, state machine,
tracking-ID check characters, address guard), 11 end-to-end tests against MongoDB that reproduce the
proposal's acceptance scenarios (T03–T17), including 1,000 replays of one scan, and 12 tests of the scale bridge
against a stand-in board (5 of them without MongoDB) and 14 tests of the handwriting pipeline (photo clean-up, line finding, decoding, reader selection). Each run uses a temporary database that is dropped afterwards.

## 3. Web app (React)

```bash
cd frontend
npm install
npm run dev            # https://localhost:5173  (also https://<laptop-IP>:5173 on the LAN; accept the self-signed certificate once)
```
Vite forwards `/api` to the backend (`VITE_API_PROXY`, default `http://127.0.0.1:8000`). Production build: `npm run build`.

> Webcam capture in the browser only works on `http://localhost` or HTTPS. On other PCs use the ESP32 camera or *Upload photo*.

## 4. Field app (React Native / Expo) for postmen and hub officers

```bash
cd mobile_app
npm install
npx expo start         # shows a QR code
```
1. Phone and laptop on the **same Wi-Fi**. Open **Expo Go** and scan the QR code.
2. On the login screen set *Server address* to `http://<laptop-IP>:8000`, sign in as `postman2`.
3. *Scan registered letter* → point at the label's barcode or QR → choose the status → *Save*.
4. Switch on airplane mode and save a scan: it stays **pending** on the phone (SQLite) and uploads automatically when the network returns – the same event id is reused, so it is never duplicated.

For a stand-alone APK use EAS Build (`npx eas-cli@latest build -p android --profile preview`). Release builds block plain `http://`; use HTTPS for the backend or allow cleartext traffic for a lab build.

## 5. IoT scale + camera
Follow [IoT_Hardware_Setup_Guide.md](IoT_Hardware_Setup_Guide.md), then check the whole chain with
[IoT_Integration_Test_Flow.md](IoT_Integration_Test_Flow.md). A board that runs a pull sketch (it answers on
`http://<device-IP>/` but does not push readings) is connected by `backend/tools/device_bridge.py`; set
`BRIDGE_DEVICE_URL` in `backend/.env`.

One command starts MongoDB, the API, the bridge (when `BRIDGE_DEVICE_URL` is set) and the web app, each in its own window:
```powershell
powershell -ExecutionPolicy Bypass -File backend\tools\start_all.ps1
```
It uses the *MongoDB* Windows service, `mongod` on PATH, or a portable `mongod.exe` in
`%LOCALAPPDATA%\PostAssist\mongodb\bin` (data in `%LOCALAPPDATA%\PostAssist\mongo-data`).

Without hardware, simulate the device:
```bash
cd backend
.venv/Scripts/python tools/device_simulator.py --key "<SEED_DEVICE_KEY>" --image ../Datasets/processed/synthetic_envelopes/images/SYN-SI-001.jpg
```
Type `w 23.5` (place a 23.5 g letter) and `r` (remove).

### Handwritten addresses
*Read address* has a **Writing** selector next to *Script*:

| Writing | What reads the block |
|---|---|
| **Auto** (default) | Tesseract first; unless it is sure of the block (mean word confidence ≥ 80), the handwriting model also reads it and the more confident reader is used. A green *handwriting model* badge under the image shows which one answered. |
| **Handwritten** | the handwriting model only – choose it when Auto picked the wrong reader |
| **Printed** | Tesseract only (the P1 configuration as originally defined) |

For a good read: drag the box round the address block only, keep the lines roughly level, use a dark pen, and
avoid shadows of the hand or phone. The model handles ruled paper and uneven light. Its measured accuracy and
limits (Tamil handwriting is untested, digits need checking) are in
[ml/reports/htr/REPORT.md](../ml/reports/htr/REPORT.md). Every field still has to be confirmed by the officer.

## 6. ML environment (only to rebuild datasets / retrain models)
The trained models are already in `backend/models/`. To reproduce them:
```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cu128   # or .../whl/cpu
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
bash ml/run_all.sh
```
The handwriting model is trained separately because its datasets are large and kept outside the repository
(`%USERPROFILE%\PostAssist\datasets`, see Datasets/README.md §2b); about 70 minutes on an RTX 2050:
```bash
ml/.venv/Scripts/python ml/htr/build_cache.py
ml/.venv/Scripts/python ml/htr/train.py
ml/.venv/Scripts/python ml/htr/evaluate.py
```
Details: [ml/README.md](../ml/README.md) and [Datasets/README.md](../Datasets/README.md).

## 7. End-to-end demonstration script (about 10 minutes)

1. **Start** MongoDB (service), the backend, the web app, and either the ESP32 or the simulator.
2. **Counter (web, `counter2`)** → *Counter intake* → **+ New registered letter**.
   * Keep configuration **P1**.
   * *Capture from scale camera* (or *Upload photo* with a file from `Datasets/processed/synthetic_envelopes/images/`).
   * Drag a box around the recipient block → **Read address (P1)**. Without Tesseract: open *Type or paste the address text*, paste e.g.
     ```
     ඒ. බී. පෙරේරා මහතා,
     අංක 12, ගාලු පාර,
     මොරටුව 10400
     ```
     and press **Split into fields**. Fields fill in with confidence badges; the town/postcode check turns green.
   * Fill the sender (or parse it the same way), choose the **destination office** *SLIIT Malabe demo counter*, choose e-mail updates (any test address – messages are written to `backend/storage/outbox_mail/` as `.eml` files), **confirm fields**.
   * Place the letter on the scale (simulator: `w 20`) → **Use this weight** → **Calculate charge** → Rs 130.00 (70 + 60) → **accept & print label**.
   * On the label page: **Print**, then type/scan the ID into *Verify*.
3. **Dispatch (web, `hubdemo`)** → *Record scan* → paste the ID → *Dispatched* → allow location.
4. **Arrival with a bad location (field app or web, `hubdemo`)** → *At destination office* from somewhere far away → it is **held for review** (status does not change, no message).
5. **Review (web, `pm2`)** → *Review queue* → read the reason → approve with a reason.
6. **Delivery (field app, `postman2`)** → scan the label on the screen → *Out for delivery* → scan again → *Delivered* → recipient name + signature.
7. **Sender view** → open the tracking link printed on the receipt (`/track/<ID>#t=…`): office names and times only, no coordinates or staff names.
8. **Messages** (`pm2`) → see one message per accepted event; **Reports** → download `intake_tasks.csv`, `scan_events.csv`, `notifications.csv` for the evaluation chapter.

## 8. Experiments supported by the software

| Experiment (proposal) | How to run it |
|---|---|
| §3.7 address capture B0/B1/P1 | choose the configuration at the top of each intake; `intake_tasks.csv` records time, corrections and configuration; `ml/evaluation/ocr_benchmark.py` scores B1 vs P1 on an annotated image set |
| §3.8 LLM normalisation | set `LLM_PROVIDER=ollama`; `POST /api/intake/normalize` with `use_llm=true` returns rule vs LLM suggestions with the unsupported-change guard |
| §3.9 weighing and tariff | IoT page → record trials → `ml/evaluation/weighing_analysis.py`; tariff tests in `backend/tests/test_units.py` |
| §3.10 location policies | `admin` → *Reports* → switch **L0/L1/L2** (each switch is a new policy version stored on every event); `scan_events.csv`; simulation: `ml/evaluation/location_policy_simulation.py` |
| §3.11 offline sync and messaging | airplane-mode scans in the field app; `OUTBOX_FAULT_MODE=fail_first|timeout_once|permanent` for failure injection; `backend/tests/test_workflow.py` |

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Backend: `ServerSelectionTimeoutError` | MongoDB is not running – start the *MongoDB* Windows service or fix `MONGODB_URI`. |
| Web: "wrong username or password" | Password is `DEMO_PASSWORD` from `backend/.env` *at the time the database was first seeded*. To reset demo data, drop the database (`mongosh` → `use postassist_registered_mail` → `db.dropDatabase()`) and restart the backend. |
| Handwriting is read badly | Set **Writing** to *Handwritten*, crop to the address block only, retake the photo without shadows. Sinhala and English are trained on real handwriting; Tamil only on fonts. |
| *Read address* → "OCR unavailable" | Install Tesseract (and the Sinhala/Tamil packs) or set `TESSERACT_CMD`; restart the backend. Typing/pasting still works. |
| Phone: "Server did not answer" | Use the laptop's LAN IP (not localhost), same Wi-Fi, backend started with `--host 0.0.0.0`, firewall allows port 8000. |
| Phone camera does not scan | Hold the phone 15–25 cm from the label, enough light; or type the ID under *Damaged label?*. |
| IoT card stays offline | See the troubleshooting table in the IoT guide. |
| Every session logs out after restarting the backend | Set a fixed `JWT_SECRET` in `.env`. |
