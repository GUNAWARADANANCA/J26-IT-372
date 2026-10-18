// PostAssist LK scale + camera - device configuration.
//
// 1. Copy this file to "config.h" in the same folder (config.h is git-ignored).
// 2. Fill in your Wi-Fi, the backend address and the device key.
// 3. The DEVICE_ID / DEVICE_KEY must match backend/.env (SEED_DEVICE_ID / SEED_DEVICE_KEY)
//    or a device created on the "IoT scale" page.
// Wi-Fi and the backend address can be changed later on the device's own page
// (http://<device-IP>/, or http://192.168.4.1/ on its set-up network) without re-flashing.
#pragma once

// ---------------------------------------------------------------- Wi-Fi (2.4 GHz only)
#define WIFI_SSID      "Senomie" "\xE2\x80\x99" "s iPhone "
#define WIFI_PASSWORD  "20021218"
// When the Wi-Fi above cannot be joined within 20 s, the board opens its own set-up network
// "PostAssist-Scale" with this password; browse to http://192.168.4.1/ to enter new settings.
#define SETUP_AP_PASSWORD "postassist"

// ---------------------------------------------------------------- Backend
// The laptop running FastAPI, reachable from the ESP32: http://<laptop-LAN-IP>:8000
// (no trailing slash). Find the IP with `ipconfig` (Windows) -> "IPv4 Address".
#define API_BASE_URL   "http://192.168.1.10:8000"
#define DEVICE_ID      "SCALECAM-01"
#define DEVICE_KEY     "paste-the-device-key-here"

// For an https:// API_BASE_URL paste the server's root CA certificate (PEM) here.
// Leaving it empty with https makes the connection encrypted but NOT verified
// (acceptable only on a lab network - never with real customer data).
#define ROOT_CA_PEM    ""

// ---------------------------------------------------------------- Pins (AI-Thinker ESP32-CAM)
// See Documents/IoT_Hardware_Setup_Guide.md. GPIO 13/14 are free because the
// SD-card slot is not used. Do NOT use GPIO 12 (boot strapping) or 16 (PSRAM).
#define HX711_DOUT_PIN  13   // HX711 DT  (through the level shifter if HX711 runs at 5 V)
#define HX711_SCK_PIN   14   // HX711 SCK (through the level shifter if HX711 runs at 5 V)
#define FLASH_LED_PIN    4   // on-board white flash LED (active HIGH)
#define STATUS_LED_PIN  33   // on-board small red LED (active LOW)

// ---------------------------------------------------------------- Weighing
#define DEFAULT_CAL_FACTOR  2000.0f  // raw counts per gram until you calibrate (1 kg cell, 5 V)
#define WINDOW_SAMPLES      10       // HX711 green module = 10 samples/s -> 1 s stability window
#define STABLE_SPREAD_G     1.0f     // max - min within the window to call it stable (proposal 3.9)
#define LOAD_THRESHOLD_G    2.0f     // above this the platform is "loaded"
#define EMPTY_THRESHOLD_G   1.0f     // below this (stable) the platform is "empty" -> next placement
#define ZERO_TRACK_LIMIT_G  0.5f     // slowly re-zero drift while empty and within this band
#define REPORT_INTERVAL_MS  500      // how often readings are pushed to the backend
// Each HX711 bit is clocked with this half-period. Slow edges through a level shifter or long
// jumpers make a fast read pick up wrong bits (readings that jump by a fixed amount); 4 us is
// still far below the 50 us after which the HX711 powers down.
#define HX711_HALF_PERIOD_US 4
// A single reading this far from the previous ones is ignored unless the next one confirms it
// (a real letter placed on the platform is confirmed at once; an electrical glitch is not).
#define SPIKE_REJECT_G      25.0f

// ---------------------------------------------------------------- Camera (OV3660, 3 MP)
// FRAMESIZE_QXGA = 2048x1536 (needs PSRAM). Use FRAMESIZE_UXGA (1600x1200) if uploads are slow.
#define CAMERA_FRAME_SIZE    FRAMESIZE_QXGA
// 0-63, lower = more detail / bigger file. Below 10 a detailed QXGA frame can outgrow the
// driver's buffer and be dropped; try 8 only if photos still look soft after focusing.
#define CAMERA_JPEG_QUALITY  10
#define CAMERA_SHARPNESS     2       // -2 .. 2 (edge enhancement, helps thin pen strokes)
#define CAMERA_WARMUP_FRAMES 3       // frames thrown away so exposure and white balance settle
#define CAMERA_BURST         3       // frames taken per photo; the one with the most detail is sent
#define CAMERA_VFLIP         1       // OV3660 modules are usually mounted upside down
#define CAMERA_HMIRROR       0
