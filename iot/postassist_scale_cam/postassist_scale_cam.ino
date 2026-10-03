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
    * A small diagnostics page is served on http://<device-ip>/ for setup.

  Board: "AI Thinker ESP32-CAM" (esp32 by Espressif, core 3.x), PSRAM enabled,
  Partition scheme "Huge APP (3MB No OTA/1MB SPIFFS)".
  Libraries: "HX711" by Bogdan Necula, "ArduinoJson" by Benoit Blanchon (v7).
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
#include <HX711.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_camera.h>
#include <time.h>

#include "camera_pins.h"

static const char *FW_VERSION = "pa-scalecam-1.0.0";

// ------------------------------------------------------------------ state
HX711 hx;
Preferences prefs;
WebServer web(80);

struct Calibration {
  long offset = 0;
  float factor = DEFAULT_CAL_FACTOR;
  String id = "";            // empty = not calibrated yet
} cal;

long window[WINDOW_SAMPLES];
int windowCount = 0, windowPos = 0;
unsigned long lastSampleMs = 0, lastReportMs = 0, lastWifiTryMs = 0;
bool sensorOk = false, cameraOk = false, wasEmpty = true;
long placementId = 0;
unsigned long seq = 0;
char bootId[9];

struct Reading {
  float netG = 0, spreadG = 0;
  long rawMean = 0;
  bool stable = false, loaded = false;
} cur;

// ------------------------------------------------------------------ helpers
void statusLed(bool on) { digitalWrite(STATUS_LED_PIN, on ? LOW : HIGH); }  // active LOW

String isoNow() {
  struct tm t;
  if (!getLocalTime(&t, 10) || t.tm_year < 124) return "";  // clock not synced yet
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

void loadCalibration() {
  prefs.begin("scale", true);
  cal.offset = prefs.getLong("offset", 0);
  cal.factor = prefs.getFloat("factor", DEFAULT_CAL_FACTOR);
  cal.id = prefs.getString("cal_id", "");
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

// ------------------------------------------------------------------ weighing
void sampleScale() {
  if (hx.is_ready()) {
    long raw = hx.read();
    window[windowPos] = raw;
    windowPos = (windowPos + 1) % WINDOW_SAMPLES;
    if (windowCount < WINDOW_SAMPLES) windowCount++;
    lastSampleMs = millis();
    sensorOk = true;
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
  cur.rawMean = (long)(sum / windowCount);
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

bool tare(String &msg) {
  if (!cur.stable) { msg = "not stable - wait until the platform is still"; return false; }
  cal.offset = cur.rawMean;
  saveCalibration();
  msg = "tared";
  return true;
}

bool calibrate(float knownG, String &msg) {
  if (!cur.stable || !cur.loaded) { msg = "place the reference mass and wait until stable"; return false; }
  float factor = (cur.rawMean - cal.offset) / knownG;
  if (fabsf(factor) < 10) { msg = "signal too small - check load-cell wiring (E+/E-/A+/A-)"; return false; }
  cal.factor = factor;
  char id[24];
  snprintf(id, sizeof(id), "CAL-%04X-%lu", (unsigned)(esp_random() & 0xFFFF), (unsigned long)(time(nullptr) % 100000000UL));
  cal.id = id;
  saveCalibration();
  msg = "calibrated";
  return true;
}

// ------------------------------------------------------------------ camera
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
    s->set_vflip(s, CAMERA_VFLIP);
    s->set_hmirror(s, CAMERA_HMIRROR);
    if (s->id.PID == OV3660_PID) {
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    }
  }
  return true;
}

camera_fb_t *grabFrame(bool flash) {
  camera_fb_t *fb = esp_camera_fb_get();  // discard a possibly stale frame
  if (fb) esp_camera_fb_return(fb);
  if (flash) { digitalWrite(FLASH_LED_PIN, HIGH); delay(150); }
  fb = esp_camera_fb_get();
  if (flash) digitalWrite(FLASH_LED_PIN, LOW);
  return fb;
}

// ------------------------------------------------------------------ HTTP to backend
WiFiClient plainClient;
WiFiClientSecure tlsClient;

bool beginRequest(HTTPClient &http, const String &path) {
  String url = String(API_BASE_URL) + path;
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
  camera_fb_t *fb = cameraOk ? grabFrame(flash) : nullptr;
  if (!fb) { ok = false; result["error"] = cameraOk ? "frame capture failed" : "camera not initialised"; return; }
  HTTPClient http;
  if (beginRequest(http, String("/api/iot/captures/") + captureId)) {
    http.addHeader("Content-Type", "image/jpeg");
    http.setTimeout(15000);
    int code = http.POST(fb->buf, fb->len);
    ok = code == 200;
    result["bytes"] = fb->len;
    result["width"] = fb->width;
    result["height"] = fb->height;
    result["http"] = code;
    Serial.printf("[cam] uploaded %u bytes (%dx%d) -> HTTP %d\n", fb->len, fb->width, fb->height, code);
    http.end();
  } else {
    ok = false;
    result["error"] = "could not open connection";
  }
  esp_camera_fb_return(fb);
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

// ------------------------------------------------------------------ local diagnostics page
const char INDEX_HTML[] PROGMEM = R"HTML(<!doctype html><html><head><meta name=viewport content="width=device-width">
<title>PostAssist scale</title><style>body{font-family:sans-serif;margin:16px}#g{font-size:56px;font-weight:bold}
button{font-size:16px;margin:4px;padding:8px 12px}</style></head><body><h2>PostAssist scale + camera</h2>
<div id=g>-</div><pre id=s></pre><button onclick="post('/tare')">Tare</button>
<input id=k size=5 value=100> g <button onclick="post('/calibrate?g='+k.value)">Calibrate</button>
<a href="/capture.jpg" target=_blank><button>Test photo</button></a>
<script>async function post(u){const r=await fetch(u,{method:'POST'});alert(await r.text())}
async function tick(){try{const j=await (await fetch('/status')).json();g.textContent=(j.net_g??'-')+' g';
s.textContent=JSON.stringify(j,null,1)}catch(e){}setTimeout(tick,500)}tick()</script></body></html>)HTML";

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
    d["calibration_id"] = cal.id;
    d["factor"] = cal.factor;
    d["offset"] = cal.offset;
    d["camera_ok"] = cameraOk;
    d["wifi_rssi"] = WiFi.RSSI();
    d["api"] = API_BASE_URL;
    d["fw"] = FW_VERSION;
    String out;
    serializeJson(d, out);
    web.send(200, "application/json", out);
  });
  web.on("/tare", HTTP_POST, [] { String m; tare(m); web.send(200, "text/plain", m); });
  web.on("/calibrate", HTTP_POST, [] {
    String m;
    calibrate(web.arg("g").toFloat(), m);
    web.send(200, "text/plain", m + " (factor " + String(cal.factor, 3) + ")");
  });
  web.on("/capture.jpg", HTTP_GET, [] {
    camera_fb_t *fb = cameraOk ? grabFrame(false) : nullptr;
    if (!fb) { web.send(503, "text/plain", "camera not available"); return; }
    web.setContentLength(fb->len);
    web.send(200, "image/jpeg", "");
    web.client().write(fb->buf, fb->len);
    esp_camera_fb_return(fb);
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
  else if (line.startsWith("c ")) { calibrate(line.substring(2).toFloat(), msg); Serial.println(msg); }
  else if (line == "i") {
    Serial.printf("net %.2f g spread %.2f stable %d loaded %d placement %ld raw %ld offset %ld factor %.3f cal %s ip %s\n",
                  cur.netG, cur.spreadG, cur.stable, cur.loaded, placementId, cur.rawMean, cal.offset, cal.factor,
                  cal.id.c_str(), WiFi.localIP().toString().c_str());
  } else Serial.println("commands: t = tare, c <grams> = calibrate, i = info");
}

// ------------------------------------------------------------------ Wi-Fi
void connectWifi(bool blocking) {
  if (WiFi.status() == WL_CONNECTED) return;
  if (!blocking && millis() - lastWifiTryMs < 5000) return;
  lastWifiTryMs = millis();
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  if (!blocking) return;
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(250); sampleScale(); }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
  else Serial.println("[wifi] not connected yet - will keep trying (weighing continues)");
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
  snprintf(bootId, sizeof(bootId), "%08lx", (unsigned long)esp_random());

  loadCalibration();
  hx.begin(HX711_DOUT_PIN, HX711_SCK_PIN, 128);  // channel A, gain 128
  cameraOk = initCamera();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // steadier latency for readings and uploads
  connectWifi(true);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  if (String(API_BASE_URL).startsWith("https")) {
    if (strlen(ROOT_CA_PEM) > 0) tlsClient.setCACert(ROOT_CA_PEM);
    else { tlsClient.setInsecure(); Serial.println("[tls] WARNING: server certificate not verified"); }
  }
  setupWeb();
  Serial.printf("[scale] calibration %s, factor %.3f, offset %ld\n", cal.id.length() ? cal.id.c_str() : "NONE",
                cal.factor, cal.offset);
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
