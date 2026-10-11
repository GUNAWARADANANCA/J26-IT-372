# IoT – ESP32-CAM scale + envelope camera firmware

`postassist_scale_cam/` – Arduino sketch for an **AI-Thinker ESP32-CAM (OV3660)** reading an **HX711 + 1 kg load
cell** through a **3.3 V ↔ 5 V level shifter**.

1. Copy `config.example.h` → `config.h` and fill in Wi-Fi, `API_BASE_URL`, `DEVICE_ID`, `DEVICE_KEY`.
2. Board **AI Thinker ESP32-CAM**, partition **Huge APP**, libraries **HX711 Arduino Library** (Bogdan Necula) and
   **ArduinoJson 7**.
3. Upload with the ESP32-CAM-MB USB board, then wire as shown in the guide.

Step-by-step assembly, wiring table, calibration, camera mounting and troubleshooting:
**[../Documents/IoT_Hardware_Setup_Guide.md](../Documents/IoT_Hardware_Setup_Guide.md)**.

A board that runs a different, pull-only sketch (it serves `/weight`, `/tare`, `/calibrate`, `/capture` and does not
push readings) works with the same backend through `backend/tools/device_bridge.py` – see
[../Documents/IoT_Integration_Test_Flow.md](../Documents/IoT_Integration_Test_Flow.md).

Verified build: `arduino-cli compile -b "esp32:esp32:esp32cam:PartitionScheme=huge_app"` with ESP32 core 3.3.12 →
1,196,557 bytes (38 %).
