# PostAssist LK mobile app (Flutter) – setup and running guide

Component: **Smart Registered Mail Intake and Tracking** (IT23324138, J26-IT-372).
App folder: `mobile_app/flutter_app/` · Backend: `backend/` (FastAPI + MongoDB).

---

## 1. What the app does

One app, five roles. After sign-in, the home screen shows only the tasks that role is allowed to do (the server
enforces the same rules).

| Who | Screens |
|---|---|
| **Counter officer** (`counter2`) | *Register a letter* in 5 steps: ① envelope photo (phone camera, gallery or the IoT scale's ESP32-CAM) → server reads the address (OCR / handwriting model) or you type it ② check the suggested recipient/sender fields (confidence %, low-confidence fields in red, town/postcode check) ③ destination office + sender e-mail/SMS updates, then *confirm* ④ weight from the IoT scale (live, *Use this weight* when stable) or an audited manual weight ⑤ tariff quote → payment → accept. Then **Label & receipt** (Code 128 + QR, sender's tracking QR), *verify the printed label* by scanning it. Also: drafts in progress, sender messages, scale & camera. |
| **Hub officer** (`hub2`) | Scan label → *Dispatched / In transit / Arrived at destination office*. |
| **Postman** (`postman2`) | Scan label → *Out for delivery / Delivery attempted (reason) / Delivered* with signature, name only or delivery-sheet number. Works **offline**: scans wait on the phone and upload automatically. |
| **Postmaster** (`pm2`) | All of the above + **Review queue** (approve/reject held scans with a reason), **Summary**, **Audit log**, **Offices & zones** (set an office's reference point from the phone's GPS), assign a postman to an item. |
| **Sender** (no sign-in) | *Track a letter*: scan the receipt QR (or type tracking ID + access code). |

Every screen is available in **සිංහල, தமிழ் and English** (switch on the sign-in screen or in Settings).

---

## 2. What you need

| Item | On this laptop |
|---|---|
| Windows 10/11 | ✔ |
| **Flutter SDK 3.47.7** (Dart 3.13.5) | ✔ installed at `C:\src\flutter` |
| Android Studio + Android SDK (platform 36, build-tools 36) | ✔ (`%LOCALAPPDATA%\Android\Sdk`) |
| Java 17+ | ✔ uses Android Studio's bundled JBR |
| Android phone (Android 7.0 / API 24 or newer) **or** the Android emulator | your phone / AVD `Medium_Phone_API_36` |
| The PostAssist backend + MongoDB | `backend/tools/start_all.ps1` |
| iPhone build | needs a Mac with Xcode (the `ios/` project is ready) |

> ⚠️ **Never put the Flutter SDK in a folder with a space in its path** (e.g. `C:\Users\CYBORG 15\...`).
> Flutter's build hooks fail with *"'C:\Users\CYBORG' is not recognized"*. That is why it lives in `C:\src\flutter`.

---

## 3. One-time setup

### 3.1 Put Flutter on the PATH (once)
PowerShell:
```powershell
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';C:\src\flutter\bin', 'User')
```
Close and reopen the terminal (and VS Code / Android Studio), then check:
```powershell
flutter --version
flutter doctor
```

*Teammate on another PC:* download the Flutter **stable** zip from <https://docs.flutter.dev/get-started/install/windows>,
extract it so that `C:\src\flutter\bin\flutter.bat` exists, then do the PATH step above.

### 3.2 Android licences (once)
`flutter doctor` may say *"cmdline-tools component is missing"*. Fix it in Android Studio:
**More Actions → SDK Manager → SDK Tools → tick "Android SDK Command-line Tools (latest)" → Apply**. Then:
```powershell
flutter doctor --android-licenses     # answer y to each
```

### 3.3 (Optional) editor support
VS Code: install the **Flutter** extension. Android Studio: **Plugins → Flutter**. Open the folder
`mobile_app/flutter_app`.

---

## 4. Start the backend

```powershell
cd "C:\Users\CYBORG 15\OneDrive\Desktop\Research\J26-IT-372"
powershell -ExecutionPolicy Bypass -File backend\tools\start_all.ps1
```
(or only the API: `backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000`)

Check it in a browser on the laptop: <http://localhost:8000/api/health> → `{"status":"ok", ...}`.

**The phone must reach the laptop:**
1. Phone and laptop on the **same Wi-Fi / hotspot** (e.g. the iPhone hotspot).
2. Find the laptop's IP: `ipconfig` → *IPv4 Address* of the Wi-Fi adapter (on the iPhone hotspot it looks like `172.20.10.5`).
3. The API must listen on `0.0.0.0` (the commands above do).
4. Windows Firewall: allow Python on **private networks** when Windows asks. If you missed the prompt (run PowerShell *as Administrator*):
   ```powershell
   New-NetFirewallRule -DisplayName "PostAssist API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
   ```
5. Test from the phone's browser: `http://<laptop-IP>:8000/api/health`.

---

## 5. Run the app

```powershell
cd "C:\Users\CYBORG 15\OneDrive\Desktop\Research\J26-IT-372\mobile_app\flutter_app"
flutter pub get
```

### Option A – your Android phone (recommended for the demo: real camera + GPS)
1. Phone: **Settings → About phone → tap "Build number" 7 times** → Developer options appear.
2. **Developer options → USB debugging → On.** Connect by USB, accept the *"Allow USB debugging?"* prompt.
3. ```powershell
   flutter devices          # your phone must be listed
   flutter run              # debug build with hot reload (press r = reload, q = quit)
   ```

### Option B – Android emulator
```powershell
flutter emulators                               # lists Medium_Phone_API_36
flutter emulators --launch Medium_Phone_API_36
flutter run
```
In the emulator the laptop is **`http://10.0.2.2:8000`** (not localhost). The emulator camera shows a virtual scene,
so use *"Damaged label? Type the tracking ID"* to record scans, and *Choose a photo* for envelopes.

### Option C – install an APK (no cable needed during the demo)
```powershell
flutter build apk --release
```
The file is `build\app\outputs\flutter-apk\app-release.apk` (about 71 MB – one APK for every phone CPU type).
For a smaller file use `flutter build apk --release --split-per-abi` and copy `app-arm64-v8a-release.apk`
(almost every phone from the last 6 years). Copy it to the phone (USB, Google Drive, WhatsApp to yourself), open it
and allow *"Install unknown apps"* for that app. Or with the cable: `flutter install`.

The first build takes 10–15 minutes (it downloads Gradle, Android SDK Platform 36, CMake and NDK 28 once);
later builds take 1–2 minutes.

> The release APK is signed with the debug key – fine for testing on your own phones, **not** for Google Play.

---

## 6. Sign in

| Field | Value |
|---|---|
| Server address | `http://<laptop-IP>:8000` (emulator: `http://10.0.2.2:8000`). Press **Test connection** – it must say *Server reached*. |
| Username | see below |
| Password | the `DEMO_PASSWORD` value in `backend/.env` |

| Username | Role | Office |
|---|---|---|
| `counter2` | Counter officer | Malabe Post Office |
| `hub2` | Hub officer | Malabe Post Office |
| `postman2` | Postman | Malabe Post Office |
| `pm2` | Postmaster | Malabe Post Office |
| `admin` | Administrator | (all offices) |
| `counter1`, `hub1`, `hubjaf`, `postman1`, `pm1` | other offices (Kaduwela, Colombo CMX, Jaffna) | |

The yellow notice *"This connection is not encrypted (http)"* is expected on the lab network; a live service must use https.

---

## 7. Demo walk-through (about 5 minutes)

1. **Counter** – sign in as `counter2` → **Register a letter → Register a new letter**.
   1. *Photo*: **Take a photo** of an envelope (or choose one) → **Read address**. No OCR on the laptop? Type the
      address in *Type or paste the address* → **Fill fields from text**.
   2. *Addresses*: compare the fields with the envelope; red fields have low confidence; **Use** takes a suggestion.
   3. *Confirm*: pick the destination office (suggested from the postcode), optionally the sender's e-mail and
      language → **I have checked the envelope – confirm details**.
   4. *Weigh*: put the letter on the IoT scale → when it shows **Stable – ready** press **Use this weight**
      (scale offline? open *Enter weight by hand*).
   5. *Charge*: **Calculate charge** → choose Cash → **Received Rs. … – accept letter** → confirm.
   6. **Label & receipt** appears: show the barcode/QR, then **Verify the printed label** and scan the label.
2. **Hub** – sign out (Settings) and sign in as `hub2` → **Scan a registered letter** → scan the label →
   **Dispatched** → **Save scan** → *Accepted*. Scan again → **Arrived at destination office**.
3. **Postman** – `postman2` → scan → **Out for delivery** → save. Then switch on **airplane mode**, scan →
   **Delivered** → signature + name → **Save scan** → *"Saved on this phone"*. Switch airplane mode off → it uploads by
   itself (see **My scans**).
4. **Postmaster** – `pm2` → **Review queue** (scans held for location/mock/no acknowledgement → approve or reject with a
   reason) → **Summary** → **Registered items** → open the item to show the full timeline with location results.
5. **Sender** – on the sign-in screen tap **Track a letter → Scan the receipt QR code** (QR on the receipt screen).

---

## 8. Checks and tests

```powershell
cd mobile_app\flutter_app
flutter analyze          # static analysis – expected: "No issues found!"
flutter test             # 32 unit + widget tests (tracking-ID check characters, API errors,
                         # role dashboards, sign-in in si/ta/en, 200 % text size)
```

**Contract test against a real backend** (registers a letter, then hub/postman scans through the offline queue,
duplicate replay, wrong-role rejection, public tracking, postmaster endpoints). Use a separate database so your demo
data stays clean – the Claude launch configuration `backend-mobile-test` starts one on port 8001
(`MONGODB_DB=postassist_mobile_contract_test`). Then:
```powershell
flutter test test/backend_contract_test.dart --dart-define=PA_SERVER=http://127.0.0.1:8001 --dart-define=PA_PASSWORD=<DEMO_PASSWORD>
```

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| *"The server did not answer"* | Same Wi-Fi? Laptop IP changed (hotspots give new IPs)? `http://` not `https://`? Port 8000 allowed in Windows Firewall? Test `http://<IP>:8000/api/health` in the phone's browser. |
| *"Your session has ended"* | The sign-in token expired (`JWT_EXPIRE_MINUTES`) or the backend's `JWT_SECRET` changed. Sign in again – scans saved on the phone are kept and upload under the same user. |
| Can't sign out | Scans are still waiting to upload. Get network, open **My scans → Upload now**. |
| Scan **held for review** | Location far from the office zone, simulated (mock) location, or delivered without acknowledgement. The postmaster approves/rejects it. For lab trials set the office point with **Offices & zones → Use my location**. |
| Camera black / permission | Phone **Settings → Apps → PostAssist LK → Permissions → Camera / Location → Allow**. |
| *"Address reading is not available"* | Tesseract / handwriting model not installed on the server – type the address instead (see `Documents/Setup_and_Run_Guide.md`). |
| Scale shows *Needs tare* / *Stale* | Open **Scale and camera → Tare** with the platform empty; check the board is on the same network (`/status` on the board). |
| Build error *"'C:\Users\CYBORG' is not recognized"* | Flutter SDK or pub cache in a path with a space – keep Flutter in `C:\src\flutter`. |
| `flutter build apk` very slow the first time | Normal: Gradle, the Android Gradle plugin and the NDK are downloaded once (~1–2 GB). |
| Gradle *"Unable to establish loopback connection"* (`sun.nio.ch.PipeImpl`) | Java could not create its local socket in the temp folder. Give it a short folder and build again: `mkdir C:\src\tmp` then `$env:GRADLE_OPTS="-Djdk.net.unixdomain.tmpdir=C:\src\tmp -Djava.io.tmpdir=C:\src\tmp"` (same terminal) and `flutter build apk --release`. To make it permanent: `[Environment]::SetEnvironmentVariable('GRADLE_OPTS', '-Djdk.net.unixdomain.tmpdir=C:\src\tmp -Djava.io.tmpdir=C:\src\tmp', 'User')`. |

---

## 10. Design and "government" UI standards – what was done

The UI follows the principles published in the **Sri Lanka Digital Design System (SLDDS) Integrated Guidelines**
(Ministry of Digital Economy; public consultation 21 April – 22 May 2026): plain language, the three official
languages, mobile-first, consistent reusable components and **WCAG 2.2** accessibility. Concretely:

* **Official-use strip** above every screen (tap it for the explanation); public tracking has its own *public service* strip.
* **Navy/grey palette on a 50–900 scale** (same as the counter web app) with a separate **status set**
  (success/warning/error/info); text contrast ≥ 4.5 : 1.
* **Status never by colour alone** – every tag has words and/or an icon.
* **Labels above fields**, hints under labels, inline errors and a **"There is a problem" summary** that scrolls into view.
* **48 dp minimum touch targets**, 52 dp main buttons, one primary action per screen.
* **Text scales with the phone setting up to 200 %**; Sinhala/Tamil get extra line height; screen-reader labels on
  fields, steps, progress and readings.
* **Privacy notice, accessibility statement and "research prototype" notice** under *About, privacy and accessibility*.
* **No national emblem and no Sri Lanka Post logo** – using them requires permission; the app uses its own icon.

**Honest status:** this is a research prototype. It has **not** been assessed or approved by the Ministry of Digital
Economy, ICTA or the Department of Posts. Before a real field trial: (1) have the Sinhala and Tamil text reviewed by
native speakers (they were written for this prototype), (2) run an accessibility check with TalkBack and a contrast
tool, (3) switch the server to **https** and set `android:usesCleartextTraffic="false"`, (4) sign the APK with your own
release key, (5) get the Department of Posts' approval for using real customer mail.

---

## 11. Where to change things

| What | Where |
|---|---|
| Default server address on the sign-in screen | `lib/core/app_state.dart` → `defaultServer` |
| Colours, fonts, button sizes | `lib/theme/gov_theme.dart` |
| Any text (all three languages) | `lib/l10n/app_en.arb`, `app_si.arb`, `app_ta.arb` → then `flutter gen-l10n` |
| Which role sees which task | `lib/features/home/home_screen.dart` (the server still decides what is allowed) |
| App name / permissions | `android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist` |
| Launcher icon | `assets/icon/app_icon_1024.png` (source) → `android/app/src/main/res/mipmap-*/ic_launcher.png` |
| Version shown in the app / APK | `pubspec.yaml` `version:` and `AppState.appVersion` |
