# PostAssist LK – mobile app (Flutter)

Android/iOS app for the **Smart Registered Mail Intake and Tracking** component (IT23324138). It talks to the
same FastAPI backend as the web app (`backend/`) and covers every staff role:

| Role | What the app does |
|---|---|
| Counter officer | Registers a letter in 5 steps (envelope photo → address reading → confirm → IoT scale weight → charge & accept), shows the label/receipt with Code 128 + QR, verifies the printed label by scanning it, sender messages, scale & camera |
| Hub officer | Scans labels to record *dispatched / in transit / at destination office* |
| Postman | Scans labels to record *out for delivery / delivery attempted / delivered* with signature, name or delivery-sheet acknowledgement – works **offline** |
| Postmaster | Everything above plus the review queue (approve/reject held scans), summary, audit log, offices & reference zones (set from the phone's GPS) |
| Sender (no sign-in) | Tracks a letter by scanning the receipt QR or typing the tracking ID + access code |

Full step-by-step instructions (installing Flutter, connecting the phone, demo accounts, building an APK):
**[Documents/Flutter_Mobile_App_Guide.md](../../Documents/Flutter_Mobile_App_Guide.md)**.

## Quick start

```bash
cd mobile_app/flutter_app
flutter pub get
flutter run                     # phone connected by USB, or an emulator running
```

Sign in with server `http://<laptop-IP>:8000` (emulator: `http://10.0.2.2:8000`), user `counter2`, `hubdemo`,
`postman2` or `pm2`, password = `DEMO_PASSWORD` from `backend/.env`.

## Checks

```bash
flutter analyze
flutter test
flutter build apk --release     # build/app/outputs/flutter-apk/app-release.apk
```

## Layout

```
lib/
├── main.dart, app.dart        start-up, MaterialApp, theme, languages
├── core/                      API client, app state (session, sync), models, tracking-ID check, labels, formats
├── data/                      offline scan queue (SQLite), upload service, location capture
├── theme/gov_theme.dart       colours, type scale, component styles (SLDDS principles, WCAG 2.2 AA)
├── widgets/                   official header strip, cards, notices, fields, status progress, timeline, signature pad
├── l10n/                      app_en.arb, app_si.arb, app_ta.arb (Sinhala, Tamil, English)
└── features/
    ├── auth/                  sign-in
    ├── home/                  role-based dashboard
    ├── scan/                  camera scanner, record status, my scans (offline queue)
    ├── intake/                drafts, 5-step registration wizard, label & receipt
    ├── items/                 search, item detail with full event history
    ├── review/                postmaster review queue
    ├── notifications/         sender message outbox
    ├── devices/               IoT scale + camera (tare, calibrate, test photo)
    ├── offices/               reference points and zones
    ├── summary/, audit/       postmaster overview and audit log
    ├── tracking/              public tracking (no sign-in)
    └── settings/              language, account, offline data, about/privacy/accessibility
```

## Design decisions

* **Offline first for field scans.** A scan is written to SQLite with a client-generated `event_id` *before* any
  upload and re-sent with the same id until the server gives a durable answer (accepted, duplicate, held,
  rejected) – the server can never store it twice. Each queued scan remembers who captured it and is only uploaded
  with that person's sign-in, because the server takes the worker's identity from the token.
* **Location is evidence, not proof.** Read once when *Save* is pressed, with accuracy, fix age, permission state
  and Android's mock-location flag; a missing fix is sent as missing, never invented.
* **Government-style UI.** Follows the principles of the Sri Lanka Digital Design System (SLDDS, Ministry of Digital
  Economy, 2026 consultation draft): navy/grey palette with a separate status set, labels above fields, error
  summaries, plain language, 48 dp touch targets, status shown with words + icons (never colour alone), text scaling
  to 200 %, Sinhala/Tamil/English. It is **not** formally approved by any government body; no national emblem or
  Sri Lanka Post logo is used.
* **Translations** were written for this prototype and should be checked by a native Sinhala and Tamil speaker
  before a field trial.
