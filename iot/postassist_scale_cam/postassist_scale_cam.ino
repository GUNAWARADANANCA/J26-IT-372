/*
  PostAssist LK - IoT scale + envelope camera (ESP32-CAM OV3660 + HX711 + 1 kg load cell)
  J26-IT-372 / IT23324138 - Smart Registered Mail Intake and Tracking

  What it does
    * Reads the HX711 continuously (10 samples/s), keeps a 1-second window and
      reports net grams, window spread, "stable" and "loaded" flags.
    * Numbers every placement: the platform must return to empty before the next
      stable load gets a new number, so the server can refuse to reuse the previous
      letter's weight (proposal 3.9, test T03).
    * Pushes a reading to the backend every 500 ms (POST /api/iot/readings, device-key
      authenticated). The response carries queued commands: tare, calibrate, capture.
    * On "capture" it photographs the envelope lying on the platform and uploads the
      JPEG (POST /api/iot/captures/<id>).
    * Calibration (offset, factor, calibration id) is stored in flash (NVS).
    * Its own page on http://<device-ip>/ shows the live weight, tares, calibrates,
      takes a test photo, helps to focus the lens and changes Wi-Fi / backend address.

  1.1.0 - sharper photos and steadier weights
    * Camera: lens/pixel correction, edge enhancement, exposure settles before the photo,
      and of a short burst the frame with the most detail (largest JPEG) is sent.
    * Focus helper on the device page: turn the lens until the detail score peaks.
    * HX711 read with slower clock pulses, sampled at the end of each pulse, so slow edges
      through the level shifter no longer flip bits; isolated spikes are ignored.
    * Wi-Fi and backend address can be changed on the device page (no re-flashing); without
      Wi-Fi the board opens the set-up network "PostAssist-Scale" on http://192.168.4.1/.
    * /weight, /tare, /calibrate, /capture answer like the earlier pull sketch, so
      backend/tools/device_bridge.py --check still works as a diagnostic.
      Do not run the bridge while this firmware reports to the backend itself.

  1.1.1 - a bad calibration can no longer lock the scale
    * A stored factor below MIN_CAL_FACTOR counts/g is discarded at start-up (back to
      DEFAULT_CAL_FACTOR), and calibrate refuses to store one. Too small a factor makes
      normal noise look like tens of grams, so the scale never became stable and tare /
      calibrate (which need stable) could not repair it.
    * POST /calibrate/reset and serial "r" return to the default factor without a stable
      reading; POST /tare?force=1 and serial "tf" zero the scale while it is not stable.

  Board: "AI Thinker ESP32-CAM" (esp32 by Espressif, core 3.x), PSRAM enabled,
  Partition scheme "Huge APP (3MB No OTA/1MB SPIFFS)".
  Library: "ArduinoJson" by Benoit Blanchon (v7). No HX711 library is needed.
  Wiring and step-by-step setup: Documents/IoT_Hardware_Setup_Guide.md
*/

#if __has_include("config.h")
#include "config.h"
#else
#error "Copy config.example.h to config.h and fill in Wi-Fi, API_BASE_URL, DEVICE_ID and DEVICE_KEY"
#endif

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_camera.h>
#include <time.h>

#include "camera_pins.h"
#include "device_page.h"

static const char *FW_VERSION = "pa-scalecam-1.1.1";
static const float MIN_CAL_FACTOR = 100.0f;      // counts per gram; real load cells on an HX711 are far above this
static const size_t MAX_JPEG_BYTES = 1500000;   // backend accepts up to 2 MB

// ------------------------------------------------------------------ state
Preferences prefs;
WebServer web(80);

struct Settings {          // compile-time defaults, overridable on the device page (NVS)
  String ssid = WIFI_SSID;
  String password = WIFI_PASSWORD;
  String api = API_BASE_URL;
} settings;

struct Calibration {
  long offset = 0;
  float factor = DEFAULT_CAL_FACTOR;
  String id = "";            // empty = not calibrated yet
} cal;

long window[WINDOW_SAMPLES];
int windowCount = 0, windowPos = 0;
unsigned long lastSampleMs = 0, lastReportMs = 0, lastWifiTryMs = 0, spikes = 0;
bool sensorOk = false, cameraOk = false, wasEmpty = true, setupAp = false, backendOk = false;
long placementId = 0, lastAccepted = 0, pending = 0;
bool havePending = false;
int rejectRun = 0;          // readings ignored in a row
unsigned long seq = 0;
char bootId[9];

struct Reading {
  float netG = 0, spreadG = 0;
  long rawMean = 0;
  bool stable = false, loaded = false;
} cur;

uint8_t *jpegBuf = nullptr;   // best frame of a burst, copied out of the camera driver (PSRAM)
size_t jpegLen = 0;
int jpegW = 0, jpegH = 0;

// ------------------------------------------------------------------ helpers
void statusLed(bool on) { digitalWrite(STATUS_LED_PIN, on ? LOW : HIGH); }  // active LOW

String isoNow() {
  struct tm t;
  if (!getLocalTime(&t, 10) || t.tm_year < 124) return "";  // clock not synced yet
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

void loadSettings() {
  prefs.begin("net", true);
  settings.ssid = prefs.getString("ssid", WIFI_SSID);
  settings.password = prefs.getString("pass", WIFI_PASSWORD);
  settings.api = prefs.getString("api", API_BASE_URL);
  prefs.end();
}

void loadCalibration() {
  prefs.begin("scale", true);
  cal.offset = prefs.getLong("offset", 0);
  cal.factor = prefs.getFloat("factor", DEFAULT_CAL_FACTOR);
  cal.id = prefs.getString("cal_id", "");
  if (!(fabsf(cal.factor) >= MIN_CAL_FACTOR)) {   // also catches NaN
    Serial.printf("[scale] stored factor %.3f is not usable - back to the default\n", cal.factor);
    cal.factor = DEFAULT_CAL_FACTOR;
    cal.id = "";
  }
  placementId = prefs.getLong("placement", 0);
  prefs.end();
}

void saveCalibration() {
  prefs.begin("scale", false);
  prefs.putLong("offset", cal.offset);
  prefs.putFloat("factor", cal.factor);
  prefs.putString("cal_id", cal.id);
  prefs.end();
}

void savePlacement() {  // placement numbers keep increasing across restarts
  prefs.begin("scale", false);
  prefs.putLong("placement", placementId);
  prefs.end();
}

// ------------------------------------------------------------------ HX711
portMUX_TYPE hxMux = portMUX_INITIALIZER_UNLOCKED;

bool hxReady() { return digitalRead(HX711_DOUT_PIN) == LOW; }

// 24 data bits + 1 pulse selecting channel A / gain 128 for the next conversion. Each bit is
// read at the END of the clock-high phase, after DT has settled through the level shifter.
long hxRead() {
  uint32_t value = 0;
  portENTER_CRITICAL(&hxMux);
  for (int i = 0; i < 25; i++) {
    digitalWrite(HX711_SCK_PIN, HIGH);
    delayMicroseconds(HX711_HALF_PERIOD_US);
    if (i < 24) value = (value << 1) | (digitalRead(HX711_DOUT_PIN) ? 1 : 0);
    digitalWrite(HX711_SCK_PIN, LOW);
    delayMicroseconds(HX711_HALF_PERIOD_US);
  }
  portEXIT_CRITICAL(&hxMux);
  if (value & 0x800000) value |= 0xFF000000;   // sign-extend the 24-bit two's complement value
  return (long)(int32_t)value;
}

// ------------------------------------------------------------------ weighing
void pushSample(long raw) {
  window[windowPos] = raw;
  windowPos = (windowPos + 1) % WINDOW_SAMPLES;
  if (windowCount < WINDOW_SAMPLES) windowCount++;
  lastAccepted = raw;
}

void sampleScale() {
  if (hxReady()) {
    long raw = hxRead();
    lastSampleMs = millis();
    sensorOk = true;
    float jump = fabsf((raw - lastAccepted) / cal.factor);
    if (windowCount >= 3 && jump > SPIKE_REJECT_G) {
      if (havePending && fabsf((raw - pending) / cal.factor) <= SPIKE_REJECT_G) {
        pushSample(pending);       // two readings agree: the load really changed
        pushSample(raw);
        havePending = false;
      } else {
        pending = raw;             // wait for the next reading before believing it
        havePending = true;
        spikes++;
        if (++rejectRun >= 5) windowCount = 0;   // readings keep jumping: report "not stable", never an old value
      }
    } else {
      havePending = false;
      pushSample(raw);
    }
    if (!havePending) rejectRun = 0;
  } else if (millis() - lastSampleMs > 1000) {
    sensorOk = false;  // HX711 stopped answering: wiring or power problem
    windowCount = 0;
  }
  if (windowCount == 0) return;

  long long sum = 0;
  long mn = window[0], mx = window[0];
  for (int i = 0; i < windowCount; i++) {
    sum += window[i];
    mn = min(mn, window[i]);
    mx = max(mx, window[i]);
  }
  if (windowCount >= 5) {          // trimmed mean: drop the highest and lowest reading
    sum -= (long long)mn + mx;
    cur.rawMean = (long)(sum / (windowCount - 2));
  } else {
    cur.rawMean = (long)(sum / windowCount);
  }
  cur.netG = (cur.rawMean - cal.offset) / cal.factor;
  cur.spreadG = fabsf((mx - mn) / cal.factor);
  cur.stable = windowCount == WINDOW_SAMPLES && cur.spreadG <= STABLE_SPREAD_G;
  cur.loaded = cur.netG >= LOAD_THRESHOLD_G;

  if (cur.stable && cur.loaded && wasEmpty) {  // a new letter has settled on the platform
    placementId++;
    wasEmpty = false;
    savePlacement();
  }
  if (cur.stable && cur.netG < EMPTY_THRESHOLD_G) {
    wasEmpty = true;
    // Zero tracking: follow slow drift only while empty and very close to zero.
    if (fabsf(cur.netG) < ZERO_TRACK_LIMIT_G) cal.offset += (cur.rawMean - cal.offset) / 20;
  }
}

bool tare(String &msg, bool force = false) {
  if (!sensorOk) { msg = "scale not answering - check the HX711 wiring"; return false; }
  if (windowCount == 0) { msg = "no readings yet - try again in a second"; return false; }
  if (!cur.stable && !force) { msg = "not stable - wait until the platform is still"; return false; }
  cal.offset = cur.rawMean;
  saveCalibration();
  msg = "empty scale set to zero";
  return true;
}

bool calibrate(float knownG, String &msg) {
  if (knownG < 5 || knownG > 1000) { msg = "reference mass must be 5-1000 g"; return false; }
  if (!cur.stable) { msg = "place the reference mass and wait until stable"; return false; }
  float factor = (cur.rawMean - cal.offset) / knownG;
  if (fabsf(factor) < MIN_CAL_FACTOR) { msg = "no usable change detected: tare the empty platform, then place the mass"; return false; }
  cal.factor = factor;
  char id[24];
  snprintf(id, sizeof(id), "CAL-%04X-%lu", (unsigned)(esp_random() & 0xFFFF), (unsigned long)(time(nullptr) % 100000000UL));
  cal.id = id;
  saveCalibration();
  windowCount = 0;   // the window was in the old units
  msg = "calibrated";
  return true;
}

void resetCalibration(String &msg) {
  cal.factor = DEFAULT_CAL_FACTOR;
  cal.id = "";
  saveCalibration();
  windowCount = 0;   // the window was in the old units
  msg = "calibration cleared - tare the empty platform, then calibrate";
}

// ------------------------------------------------------------------ camera
template <typename F, typename... A>
void tune(F fn, sensor_t *s, A... args) { if (fn) fn(s, args...); }   // not every sensor implements every control

bool initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;
  c.pin_d1 = Y3_GPIO_NUM;
  c.pin_d2 = Y4_GPIO_NUM;
  c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM;
  c.pin_d5 = Y7_GPIO_NUM;
  c.pin_d6 = Y8_GPIO_NUM;
  c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM;
  c.pin_pclk = PCLK_GPIO_NUM;
  c.pin_vsync = VSYNC_GPIO_NUM;
  c.pin_href = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM;
  c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM;
  c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.grab_mode = CAMERA_GRAB_LATEST;
  if (psramFound()) {
    c.frame_size = CAMERA_FRAME_SIZE;
    c.jpeg_quality = CAMERA_JPEG_QUALITY;
    c.fb_count = 2;
    c.fb_location = CAMERA_FB_IN_PSRAM;
    jpegBuf = (uint8_t *)ps_malloc(MAX_JPEG_BYTES);
  } else {
    Serial.println("[cam] no PSRAM - falling back to SVGA");
    c.frame_size = FRAMESIZE_SVGA;
    c.jpeg_quality = 12;
    c.fb_count = 1;
    c.fb_location = CAMERA_FB_IN_DRAM;
  }
  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("[cam] init failed 0x%x - check the ribbon cable\n", err);
    return false;
  }
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    Serial.printf("[cam] sensor PID 0x%x\n", s->id.PID);
    tune(s->set_vflip, s, CAMERA_VFLIP);
    tune(s->set_hmirror, s, CAMERA_HMIRROR);
    tune(s->set_whitebal, s, 1);       // automatic white balance
    tune(s->set_awb_gain, s, 1);
    tune(s->set_exposure_ctrl, s, 1);  // automatic exposure ...
    tune(s->set_aec2, s, 1);           // ... computed by the sensor's DSP
    tune(s->set_gain_ctrl, s, 1);
    tune(s->set_gainceiling, s, GAINCEILING_4X);   // limit gain: less grain on dark paper
    tune(s->set_bpc, s, 1);            // black / white pixel correction
    tune(s->set_wpc, s, 1);
    tune(s->set_raw_gma, s, 1);
    tune(s->set_lenc, s, 1);           // lens shading correction (dark corners)
    tune(s->set_sharpness, s, CAMERA_SHARPNESS);
    tune(s->set_denoise, s, 0);        // denoising blurs thin pen strokes
    tune(s->set_contrast, s, 1);
    if (s->id.PID == OV3660_PID) {
      tune(s->set_brightness, s, 1);
      tune(s->set_saturation, s, -2);
    }
  }
  for (int i = 0; i < CAMERA_WARMUP_FRAMES + 2; i++) {   // let exposure settle after power-up
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
  }
  return true;
}

// Takes a short burst and keeps the frame with the most detail. JPEG size at a fixed quality
// grows with fine detail, so the largest frame is the sharpest (no hand shake, settled exposure).
bool captureBest(bool flash) {
  jpegLen = 0;
  if (!cameraOk || !jpegBuf) return false;
  if (flash) digitalWrite(FLASH_LED_PIN, HIGH);
  for (int i = 0; i < CAMERA_WARMUP_FRAMES; i++) {   // discard stale and not yet exposed frames
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
  }
  for (int i = 0; i < CAMERA_BURST; i++) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) continue;
    if (fb->len > jpegLen && fb->len <= MAX_JPEG_BYTES) {
      memcpy(jpegBuf, fb->buf, fb->len);
      jpegLen = fb->len;
      jpegW = fb->width;
      jpegH = fb->height;
    }
    esp_camera_fb_return(fb);
  }
  if (flash) digitalWrite(FLASH_LED_PIN, LOW);
  return jpegLen > 0;
}

// ------------------------------------------------------------------ HTTP to backend
WiFiClient plainClient;
WiFiClientSecure tlsClient;

bool beginRequest(HTTPClient &http, const String &path) {
  String url = settings.api + path;
  bool ok = url.startsWith("https") ? http.begin(tlsClient, url) : http.begin(plainClient, url);
  if (!ok) return false;
  http.setTimeout(5000);
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  return true;
}

void postCommandResult(const char *cmdId, bool ok, JsonDocument &result) {
  HTTPClient http;
  if (!beginRequest(http, String("/api/iot/commands/") + cmdId + "/result")) return;
  http.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["status"] = ok ? "done" : "failed";
  doc["result"].set(result.as<JsonVariantConst>());
  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  Serial.printf("[cmd] %s result -> HTTP %d\n", cmdId, code);
  http.end();
}

void uploadCapture(const char *captureId, bool flash, JsonDocument &result, bool &ok) {
  if (!captureBest(flash)) {
    ok = false;
    result["error"] = cameraOk ? "frame capture failed" : "camera not initialised";
    return;
  }
  HTTPClient http;
  if (beginRequest(http, String("/api/iot/captures/") + captureId)) {
    http.addHeader("Content-Type", "image/jpeg");
    http.setTimeout(20000);
    int code = http.POST(jpegBuf, jpegLen);
    ok = code == 200;
    result["bytes"] = jpegLen;
    result["width"] = jpegW;
    result["height"] = jpegH;
    result["http"] = code;
    Serial.printf("[cam] uploaded %u bytes (%dx%d) -> HTTP %d\n", (unsigned)jpegLen, jpegW, jpegH, code);
    http.end();
  } else {
    ok = false;
    result["error"] = "could not open connection";
  }
}

void handleCommands(JsonArray commands) {
  for (JsonObject cmd : commands) {
    const char *id = cmd["id"] | "";
    String type = cmd["type"] | "";
    JsonObject params = cmd["params"];
    JsonDocument result;
    String msg;
    bool ok = true;
    Serial.printf("[cmd] %s %s\n", id, type.c_str());
    if (type == "tare") {
      ok = tare(msg);
      result["message"] = msg;
      result["offset"] = cal.offset;
    } else if (type == "calibrate") {
      ok = calibrate(params["known_g"] | 0.0f, msg);
      result["message"] = msg;
      result["calibration_id"] = cal.id;
      result["factor"] = cal.factor;
    } else if (type == "capture") {
      uploadCapture(params["capture_id"] | "", params["flash"] | false, result, ok);
    } else if (type == "identify") {
      for (int i = 0; i < 6; i++) { statusLed(i % 2 == 0); delay(200); }
    } else if (type == "reboot") {
      postCommandResult(id, true, result);
      delay(200);
      ESP.restart();
    } else {
      ok = false;
      result["error"] = "unknown command";
    }
    postCommandResult(id, ok, result);
  }
}

void reportReading() {
  JsonDocument doc;
  doc["seq"] = ++seq;
  doc["boot_id"] = bootId;
  doc["uptime_ms"] = millis();
  String now = isoNow();
  if (now.length()) doc["captured_at"] = now;
  if (sensorOk && windowCount > 0) {
    doc["net_g"] = roundf(cur.netG * 100) / 100.0f;
    doc["raw"] = cur.rawMean;
    doc["spread_g"] = roundf(cur.spreadG * 100) / 100.0f;
  }
  doc["stable"] = sensorOk && cur.stable;
  doc["loaded"] = sensorOk && cur.loaded;
  doc["placement_id"] = placementId;
  doc["calibration_id"] = cal.id;
  doc["sensor_ok"] = sensorOk;
  doc["sample_count"] = windowCount;
  doc["rssi"] = WiFi.RSSI();
  doc["fw"] = FW_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  doc["camera_ok"] = cameraOk;
  String body;
  serializeJson(doc, body);

  HTTPClient http;
  if (!beginRequest(http, "/api/iot/readings")) return;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  backendOk = code == 200;
  if (code == 200) {
    statusLed(true);
    JsonDocument resp;
    if (!deserializeJson(resp, http.getString())) {
      JsonArray cmds = resp["commands"].as<JsonArray>();
      http.end();
      if (!cmds.isNull() && cmds.size() > 0) handleCommands(cmds);
      return;
    }
  } else {
    statusLed(false);
    Serial.printf("[http] readings -> %d %s\n", code, code < 0 ? http.errorToString(code).c_str() : http.getString().c_str());
  }
  http.end();
}

// ------------------------------------------------------------------ device page
// Page markup: device_page.h



void sendJson(int code, JsonDocument &doc) {
  String out;
  serializeJson(doc, out);
  web.send(code, "application/json", out);
}

void sendJpeg() {
  if (!captureBest(false)) { web.send(503, "text/plain", "camera not available"); return; }
  web.sendHeader("Cache-Control", "no-store");
  web.setContentLength(jpegLen);
  web.send(200, "image/jpeg", "");
  web.client().write(jpegBuf, jpegLen);
}

void setupWeb() {
  web.on("/", HTTP_GET, [] { web.send(200, "text/html", INDEX_HTML); });
  web.on("/status", HTTP_GET, [] {
    JsonDocument d;
    d["net_g"] = roundf(cur.netG * 10) / 10.0f;
    d["spread_g"] = cur.spreadG;
    d["raw"] = cur.rawMean;
    d["stable"] = cur.stable;
    d["loaded"] = cur.loaded;
    d["placement_id"] = placementId;
    d["sensor_ok"] = sensorOk;
    d["spikes_ignored"] = spikes;
    d["calibration_id"] = cal.id;
    d["factor"] = cal.factor;
    d["offset"] = cal.offset;
    d["camera_ok"] = cameraOk;
    d["wifi"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() + " (" + String(WiFi.RSSI()) + " dBm)" : String("not connected");
    d["ssid"] = settings.ssid;
    d["api"] = settings.api;
    d["backend_ok"] = backendOk;
    d["fw"] = FW_VERSION;
    sendJson(200, d);
  });
  // The same answers as the earlier pull sketch (used by backend/tools/device_bridge.py --check).
  web.on("/weight", HTTP_GET, [] {
    JsonDocument d;
    if (!sensorOk) { d["error"] = "scale not answering"; sendJson(503, d); return; }
    d["grams"] = roundf(cur.netG * 100) / 100.0f;
    d["unit"] = "g";
    d["stable"] = cur.stable;
    sendJson(200, d);
  });
  web.on("/tare", HTTP_POST, [] {
    JsonDocument d;
    String m;
    d["ok"] = tare(m, web.arg("force") == "1");
    d["message"] = m;
    sendJson(200, d);
  });
  web.on("/calibrate", HTTP_POST, [] {
    JsonDocument d;
    String m;
    d["ok"] = calibrate(web.arg("g").toFloat(), m);
    d["message"] = m;
    d["calibration_id"] = cal.id;
    d["factor"] = cal.factor;
    sendJson(200, d);
  });
  web.on("/calibrate/reset", HTTP_POST, [] {
    JsonDocument d;
    String m;
    resetCalibration(m);
    d["ok"] = true;
    d["message"] = m;
    d["factor"] = cal.factor;
    sendJson(200, d);
  });
  web.on("/capture", HTTP_GET, sendJpeg);
  web.on("/capture.jpg", HTTP_GET, sendJpeg);
  web.on("/focus", HTTP_GET, [] {   // one frame, no warm-up: fast enough to follow the lens
    JsonDocument d;
    camera_fb_t *fb = cameraOk ? esp_camera_fb_get() : nullptr;
    if (!fb) { d["error"] = "camera not available"; sendJson(503, d); return; }
    d["bytes"] = fb->len;
    d["width"] = fb->width;
    d["height"] = fb->height;
    esp_camera_fb_return(fb);
    sendJson(200, d);
  });
  web.on("/settings", HTTP_POST, [] {
    String ssid = web.arg("ssid"), pass = web.arg("pass"), api = web.arg("api");
    api.trim();
    while (api.endsWith("/")) api.remove(api.length() - 1);
    if (!api.startsWith("http://") && !api.startsWith("https://")) {
      web.send(400, "text/plain", "The backend address must start with http:// or https://");
      return;
    }
    prefs.begin("net", false);
    if (ssid.length()) prefs.putString("ssid", ssid);
    if (pass.length()) prefs.putString("pass", pass);
    prefs.putString("api", api);
    prefs.end();
    web.send(200, "text/html", "<meta http-equiv=refresh content='12;url=/'>Saved. Restarting - reconnect to your Wi-Fi and open this page again.");
    delay(500);
    ESP.restart();
  });
  web.begin();
}

// ------------------------------------------------------------------ serial console
void handleSerial() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  String msg;
  if (line == "t") { tare(msg); Serial.println(msg); }
  else if (line == "tf") { tare(msg, true); Serial.println(msg); }
  else if (line == "r") { resetCalibration(msg); Serial.println(msg); }
  else if (line.startsWith("c ")) { calibrate(line.substring(2).toFloat(), msg); Serial.println(msg); }
  else if (line == "i") {
    Serial.printf("net %.2f g spread %.2f stable %d loaded %d placement %ld raw %ld offset %ld factor %.3f cal %s spikes %lu ip %s api %s\n",
                  cur.netG, cur.spreadG, cur.stable, cur.loaded, placementId, cur.rawMean, cal.offset, cal.factor,
                  cal.id.c_str(), spikes, WiFi.localIP().toString().c_str(), settings.api.c_str());
  } else Serial.println("commands: t = tare, tf = tare now (not stable), r = reset calibration, c <grams> = calibrate, i = info");
}

// ------------------------------------------------------------------ Wi-Fi
void connectWifi(bool blocking) {
  if (WiFi.status() == WL_CONNECTED) {
    if (setupAp) {   // the set-up network is no longer needed
      WiFi.softAPdisconnect(true);
      setupAp = false;
      Serial.printf("[wifi] connected, IP %s - set-up network closed\n", WiFi.localIP().toString().c_str());
    }
    return;
  }
  if (!blocking && millis() - lastWifiTryMs < 15000) return;
  lastWifiTryMs = millis();
  Serial.printf("[wifi] connecting to %s\n", settings.ssid.c_str());
  WiFi.begin(settings.ssid.c_str(), settings.password.c_str());
  if (!blocking) return;
  for (int i = 0; i < 80 && WiFi.status() != WL_CONNECTED; i++) { delay(250); sampleScale(); }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
  } else {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("PostAssist-Scale", SETUP_AP_PASSWORD);
    setupAp = true;
    Serial.printf("[wifi] could not join %s - set-up network 'PostAssist-Scale' on http://%s/\n",
                  settings.ssid.c_str(), WiFi.softAPIP().toString().c_str());
  }
}

// ------------------------------------------------------------------ setup / loop
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\nPostAssist scale+camera %s (%s)\n", FW_VERSION, DEVICE_ID);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  pinMode(STATUS_LED_PIN, OUTPUT);
  statusLed(false);
  pinMode(HX711_SCK_PIN, OUTPUT);
  digitalWrite(HX711_SCK_PIN, LOW);   // a long HIGH would power the HX711 down
  pinMode(HX711_DOUT_PIN, INPUT);
  snprintf(bootId, sizeof(bootId), "%08lx", (unsigned long)esp_random());

  loadSettings();
  loadCalibration();
  cameraOk = initCamera();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // steadier latency for readings and uploads
  connectWifi(true);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  if (settings.api.startsWith("https")) {
    if (strlen(ROOT_CA_PEM) > 0) tlsClient.setCACert(ROOT_CA_PEM);
    else { tlsClient.setInsecure(); Serial.println("[tls] WARNING: server certificate not verified"); }
  }
  setupWeb();
  Serial.printf("[scale] calibration %s, factor %.3f, offset %ld\n", cal.id.length() ? cal.id.c_str() : "NONE",
                cal.factor, cal.offset);
  Serial.printf("[api] %s\n", settings.api.c_str());
  Serial.println("Type 'i' for info, 't' to tare, 'c 100' to calibrate with a 100 g mass");
}

void loop() {
  sampleScale();
  web.handleClient();
  handleSerial();
  connectWifi(false);
  if (WiFi.status() == WL_CONNECTED && millis() - lastReportMs >= REPORT_INTERVAL_MS) {
    lastReportMs = millis();
    reportReading();
  }
  delay(5);
}
