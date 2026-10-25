# J26-IT-372

PostAssist LK – Intelligent Backbone for Local Postal Services.

## Component: Smart Registered Mail Intake and Tracking (IT23324138)

Counter acceptance of domestic registered letters with trilingual assisted OCR and an IoT scale/camera,
versioned tariff quotes, barcode/QR labels, authenticated location-aware scans with offline sync, and
reliable sender notifications. Stack: Python (FastAPI) · React · MongoDB · Flutter (staff mobile app; an earlier
Expo React Native field app is kept in `mobile_app/`) · ESP32-CAM.

| Document | |
|---|---|
| [Requirements specification](Documents/Requirements_Specification.md) | functional, non-functional, hardware, business rules, traceability |
| [Setup and run guide](Documents/Setup_and_Run_Guide.md) | install, run, demo script, experiments |
| [IoT hardware setup guide](Documents/IoT_Hardware_Setup_Guide.md) | step-by-step wiring of ESP32-CAM, level shifter, HX711, load cell |
| [Mobile app guide (Flutter)](Documents/Flutter_Mobile_App_Guide.md) | install Flutter, run the staff app on a phone/emulator, demo accounts, APK, troubleshooting |
| [Datasets](Datasets/README.md) | public datasets, licences, how they are used and rebuilt |
| [ML training and evaluation](ml/README.md) | address-field CRF, script-ID CNN, evaluation scripts |

Code: `backend/` · `frontend/` · `mobile_app/flutter_app/` (Flutter) · `mobile_app/` (Expo, earlier field app) · `iot/` · `ml/`

