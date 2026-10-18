# PostAssist Field – mobile app (React Native / Expo SDK 57)

For postmen and hub officers: scan the registered-letter label (Code 128 or QR), record the status with the
phone's location evidence, capture the delivery acknowledgement (signature / name / delivery-sheet number), and
keep working **offline**.

```bash
npm install
npx expo start            # scan the QR code with Expo Go (same Wi-Fi as the laptop)
```
Login: server `http://<laptop-IP>:8000`, user `postman2` or `hubdemo` (password = `DEMO_PASSWORD`).

## How offline works
1. *Save scan* reads the location **once**, builds the event with a new `event_id`, and writes it to SQLite
   (`src/db.js`) **before** any upload.
2. `src/sync.js` uploads pending events in capture order to `POST /api/scans/batch`. The same `event_id` is
   used on every retry, so the server can never store it twice.
3. An event leaves *pending* only when the server returns a durable answer (accepted, duplicate, held, rejected).
   Network errors keep it pending; uploads restart automatically when connectivity returns (NetInfo).

Location data sent with each scan: latitude/longitude, reported accuracy (Android 68 % radius), fix age,
permission state and Android's `mocked` flag. A missing fix is sent as such – never invented.

Checks run: `npx expo-doctor` (21/21 passed) and `npx expo export --platform android` (bundles successfully).
For an installable APK use EAS Build; release builds need HTTPS (or a cleartext exception for lab use).
