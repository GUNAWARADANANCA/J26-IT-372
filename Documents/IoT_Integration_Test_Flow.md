# IoT Scale + Camera – Integration Test Flow

**Component:** Smart Registered Mail Intake and Tracking (PostAssist LK, J26-IT-372, IT23324138)
**Use it to:** prove, step by step, that the ESP32-CAM scale, the backend and the web app work together.

```
 ESP32-CAM (scale + camera)          laptop                                   browser
 http://<device-IP>/        ◄──── tools/device_bridge.py ────► FastAPI :8000 ◄──── React :5173
   /weight /tare                  polls ~3×/s, adds stable /      MongoDB          IoT scale page,
   /calibrate /capture            loaded / placement number                        counter intake
```

The board on the bench runs a **pull sketch**: it only answers requests on its own address and reports grams,
nothing else. `backend/tools/device_bridge.py` polls it and speaks the normal device protocol to the backend, so
the web app behaves exactly as with the push firmware in `iot/postassist_scale_cam/`. Only the laptop opens
connections, so the Windows firewall and the network profile do not matter for the scale.

Run the steps in order; each one names what you must see. Steps marked **(bench)** need your hands on the hardware.

## 0. Start everything

```powershell
powershell -ExecutionPolicy Bypass -File backend\tools\start_all.ps1
```
Four windows open (MongoDB, API, scale bridge, web app); parts that already run are skipped.
The board's address is `BRIDGE_DEVICE_URL` in `backend/.env`. The hotspot/router may give the board a new address
after it restarts: open the address printed in the board's serial log, then update that line and restart the bridge.

## 1. Links

```powershell
cd backend
.venv\Scripts\python tools\device_bridge.py --check
```
| Expected | If not |
|---|---|
| `PASS board answers` | laptop and board on the same Wi-Fi? address still right? board powered? |
| `PASS scale reading: … g` (or `WARN … press Tare` after a restart) | `FAIL` = HX711 wiring / power |
| `PASS camera: JPEG, … kB` | re-seat the camera ribbon, power-cycle |
| `PASS backend answers` | API window shows an error – usually MongoDB not running |
| `PASS backend accepts the device id and key` | `SEED_DEVICE_ID` / `SEED_DEVICE_KEY` in `.env` differ from the seeded device |

## 2. Device is online in the web app

Sign in at <http://localhost:5173> as `counter2` → **IoT scale**.
Expected: **online**, the board's IP, `fw pull-bridge-1.0`, **HX711 ok**, **camera ok**, a live number.
The bridge window prints `platform empty`.

## 3. Tare and signal check **(bench)**

Empty the platform → **Tare (platform empty)**.
Expected: green note `tare done: empty scale set to zero`, the number settles at 0.0 g.

Then, with nothing touching the platform or the table:
```powershell
.venv\Scripts\python tools\device_bridge.py --watch 15
```
| Expected | If not |
|---|---|
| `… spread 0.xx g -> steady` | `NOT steady`, readings hopping between a few fixed values (e.g. 0 / −1.4, or 2 100 / 42 400 / 82 700): a load does not move in fixed jumps, so the HX711 data is most likely being misread. Treat it as a wiring fault – see below. |

Press on the platform: the number must go **up** smoothly and return to 0 when released.

**A scale that is not steady cannot be calibrated.** Fix it before step 4, cheapest check first:
1. Load-cell wires firmly on `E+ E− A− A+` (soldered, not twisted); `B+ B−` empty.
2. DT and SCK jumpers short and firmly seated; ESP32, level shifter and HX711 share one GND.
3. Take the level shifter out (guide Step 6, Option B: HX711 `VCC → 3V3`, `DT → IO13`, `SCK → IO14` directly).
   Slow edges through the shifter or long jumpers are a common cause of readings that jump by a fixed amount.
4. 5 V / 2 A supply and the 1000 µF capacitor next to the ESP32-CAM; HX711 wires away from the antenna.

## 4. Calibrate **(bench)**

Put a known mass (100 g or 200 g) in the centre → type its mass → **Calibrate**.
Expected: green note `calibrated: CAL-… – reads 100.0 g with the reference mass on it` and the card shows
`calibration CAL-…`. Until this step succeeds every weight is refused with `UNCALIBRATED`.

| Red note | Meaning |
|---|---|
| `calibrate failed: no usable change detected: check wiring and load placement` | The board saw no difference between the empty and the loaded platform: no mass on it, the load cell cannot bend (touching the base, arrow not pointing down), or the signal problem of step 3. |
| `calibrate failed: scale reads … g with the 100 g reference on it` | The board accepted the calibration but does not read the mass back within 3 % (at least 2 g), so the bridge refused it. Tare the empty platform and repeat; if it keeps happening, the scale is not steady (step 3). |
| `calibrate failed: tare the empty platform first` | The board was restarted – do step 3 first. |

## 5. Accuracy spot check **(bench)**

Place two or three other known masses (e.g. 20 g, 50 g, 500 g), lifting each off before the next.
Expected: reading within about ±1 g, badge **stable**, the placement number increases by one per mass.

## 6. Camera **(bench)**

Mount the camera 28–32 cm above the platform, lens straight down, envelope address-side up → **Take test photo**.
Expected: `photo received (2048×1536), quality OK` and a readable envelope in the picture.
`quality issues: BLURRY` → wrong distance, or turn the lens a little (it is a screw-in lens; a dot of glue may hold it).
`TOO_DARK` / `GLARE` → move the lamp.

## 7. One real letter through the counter **(bench)**

**Counter intake → + New registered letter**
1. **Capture from scale camera** → the photo appears → drag a box round the address → **Read address**
   (without Tesseract: *Type or paste the address text* → **Split into fields**).
2. Fill sender, destination office, notification → **confirm fields**.
3. Put the letter on the platform → panel *4 · Weight* shows **stable – ready** → **Use this weight**.
4. **Calculate charge** → check postage band + Rs 60 registration → payment → **accept & print label**.

Expected: after **Use this weight** the panel shows `Paired: … g (scale SCALECAM-01)` with the calibration id,
and the item page shows `Weight: … g (device)`.

## 8. One placement, one letter (proposal test T03) **(bench)**

Leave the letter from step 7 on the platform, start a second letter and press **Use this weight**.
Expected: refused with `PLACEMENT_ALREADY_USED`. Lift the letter off, wait for 0 g, place the new one: accepted.

## 9. Restart **(bench)**

Unplug the board for five seconds and plug it in again.
Expected: within 10 s **offline**, then **online** with a red **needs tare** badge and `calibration none`.
Empty the platform → **Tare** → place the reference mass:
* the reading is right → the sketch keeps its factor. Set `BRIDGE_CALIBRATION_SURVIVES_RESTART=true` in
  `backend/.env`, restart the bridge, calibrate once more; from then on a restart needs a tare only.
* the reading is wrong → leave the setting `false`: after every restart the system demands a new calibration
  (step 4) before it accepts a weight.

## 10. Lost connection

Stop the bridge (Ctrl+C in its window) with a letter on the platform.
Expected: after 3 s the weight panel shows `stale reading` and **Use this weight** is disabled; after 10 s the IoT
page shows **offline**. Start the bridge again: online within a second, placement numbers continue.

## 11. Weighing trials (SO2)

IoT guide, Step 11: ten reference masses × ten repeats → **Download trials CSV** →
`ml/evaluation/weighing_analysis.py` → enter the expanded uncertainty U as `pm2`.

## 12. Automated tests

```powershell
cd backend
.venv\Scripts\python -m pytest -q
```
Expected: `69 passed`. `tests/test_device_bridge.py` runs the bridge against a stand-in board: tare after a
restart, calibration accepted / refused, placement numbering, photo upload, unsupported commands.

## Results sheet

| # | Step | Pass / fail | Notes (reading, error message) |
|---|---|---|---|
| 1 | Links | | |
| 2 | Online in web app | | |
| 3 | Tare, signal steady | | spread over 15 s: |
| 4 | Calibrate | | reference mass: |
| 5 | Spot check | | masses and readings: |
| 6 | Camera | | quality: |
| 7 | Letter through the counter | | item id: |
| 8 | Placement rule | | |
| 9 | Restart | | calibration survives: yes / no |
| 10 | Lost connection | | |
| 12 | Automated tests | | |

## What the pull sketch cannot do

* **identify**, **reboot**, **flash** – answered with `failed: not supported by the pull firmware`.
* Wi-Fi signal (RSSI) – shown as `n/a`.
* It reports grams only. Stability, loaded/empty and the placement number are computed on the laptop from
  about three readings per second (window 1.6 s, spread ≤ 1 g), not on the board at 10 samples per second.
  Flashing `iot/postassist_scale_cam/` moves that logic back onto the board and removes the bridge.
