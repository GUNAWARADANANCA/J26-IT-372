"""Bridge between the backend and an ESP32-CAM scale that only *answers* HTTP requests.

The firmware in iot/postassist_scale_cam pushes its readings to the backend by itself. A board
flashed with a simpler "pull" sketch offers only these pages on its own address:

    GET  /weight            {"grams": 23.41, "unit": "g"}     (HTTP 409 until tared after a restart)
    POST /tare              {"ok": true, "message": "..."}     platform must be empty
    POST /calibrate?g=100   known mass on the platform
    GET  /capture           JPEG of the envelope

This program runs on the laptop next to the backend, polls such a board and speaks the normal
device protocol for it (POST /api/iot/readings, /api/iot/captures/<id>, /api/iot/commands/<id>/result),
so the web app works exactly as with the push firmware. Because the board reports grams only,
the bridge derives what the firmware would have reported: the spread of a short window, the
"stable" and "loaded" flags and the placement number (the platform must return to empty before
the next stable load gets a new number - proposal 3.9, test T03).

    .venv/Scripts/python tools/device_bridge.py                 # settings from backend/.env
    .venv/Scripts/python tools/device_bridge.py --check         # test board + backend once, then exit
    .venv/Scripts/python tools/device_bridge.py --watch 15      # print 15 s of readings: is the scale steady?
    .venv/Scripts/python tools/device_bridge.py --device-url http://192.168.1.37 --key <device key>

backend/.env:  BRIDGE_DEVICE_URL, SEED_DEVICE_ID, SEED_DEVICE_KEY, BRIDGE_CALIBRATION_SURVIVES_RESTART
Only the laptop opens connections (to the board and to the backend), so no firewall rule is needed.
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import secrets
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

FW = "pull-bridge-1.0"
BACKEND_ROOT = Path(__file__).resolve().parents[1]

# Same meaning as the constants in iot/postassist_scale_cam/config.example.h
STABLE_SPREAD_G = 1.0     # max - min within the window to call it stable
LOAD_THRESHOLD_G = 2.0    # above this the platform is "loaded"
EMPTY_THRESHOLD_G = 1.0   # every sample below this -> the platform is "empty" -> next placement
WINDOW_S = 1.6            # the board answers ~3 times per second -> about 5 samples
MIN_WINDOW_SAMPLES = 4
MIN_WINDOW_SPAN_S = 1.0
POLL_INTERVAL_S = 0.25
CALIBRATION_TOLERANCE = 0.03  # read-back after calibrating must be within 3 % (at least 2 g) of the reference
CALIBRATION_SETTLE_S = 0.6

NETWORK_ERRORS = (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError)


class HttpError(Exception):
    """The other side answered, but with an error (status code and its own message)."""

    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status, self.message = status, message


def load_dotenv(path: Path) -> dict:
    values = {}
    if path.exists():
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(method: str, url: str, *, body: bytes | None = None, headers: dict | None = None, timeout: float = 5) -> bytes:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", "replace")
        try:  # the board answers {"error": ...}, the backend {"detail": {"code": ..., "message": ...}}
            parsed = json.loads(text)
            detail = parsed.get("detail")
            text = detail.get("message") if isinstance(detail, dict) else parsed.get("error") or detail or text
        except (ValueError, AttributeError):
            pass
        raise HttpError(exc.code, str(text)[:200]) from None


class Board:
    """The ESP32-CAM's own HTTP pages."""

    def __init__(self, url: str):
        self.url = url.rstrip("/")
        self.host = urllib.parse.urlparse(self.url).hostname or ""

    def weight(self) -> float:
        return float(json.loads(request("GET", self.url + "/weight", timeout=4))["grams"])

    def tare(self) -> str:
        return str(self._reply(request("POST", self.url + "/tare", body=b"", timeout=8)).get("message", "ok"))

    def calibrate(self, known_g: float) -> dict:
        return self._reply(request("POST", f"{self.url}/calibrate?g={known_g:g}", body=b"", timeout=10))

    def capture(self) -> bytes:
        # The camera driver can hand out a frame it buffered earlier; ask twice and keep the second
        # so the photo always shows the envelope that is on the platform now.
        for _ in range(2):
            jpeg = request("GET", f"{self.url}/capture?t={int(time.time() * 1000)}", timeout=15)
        if jpeg[:2] != b"\xff\xd8":
            raise HttpError(200, "the board did not return a JPEG")
        return jpeg

    @staticmethod
    def _reply(raw: bytes) -> dict:
        try:
            reply = json.loads(raw)
        except ValueError:
            return {"message": raw.decode("utf-8", "replace")[:200]}
        if reply.get("ok") is False:
            raise HttpError(200, str(reply.get("message") or reply.get("error") or "refused by the board"))
        return reply


class Backend:
    def __init__(self, api: str, device_id: str, key: str):
        self.api = api.rstrip("/")
        self.headers = {"X-Device-Id": device_id, "X-Device-Key": key}

    def post(self, path: str, body: bytes, content_type: str = "application/json", timeout: float = 10) -> dict:
        raw = request("POST", self.api + path, body=body, headers={**self.headers, "Content-Type": content_type},
                      timeout=timeout)
        return json.loads(raw or b"{}")




class Scale:
    """Turns the board's grams into the reading the firmware would have pushed."""

    def __init__(self, state_file: Path, clock=time.monotonic):
        self.state_file, self.clock = state_file, clock
        saved = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
        self.placement = int(saved.get("placement_id", 0))  # keeps increasing across restarts
        self.calibration_id = str(saved.get("calibration_id", ""))
        self.window: list[tuple[float, float]] = []
        self.was_empty = True
        self.needs_tare = False
        self.sensor_ok = True

    def save(self) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps({"placement_id": self.placement, "calibration_id": self.calibration_id}),
                                   encoding="utf-8")

    def set_calibration(self, calibration_id: str) -> None:
        self.calibration_id = calibration_id
        self.save()

    def add(self, grams: float) -> None:
        now = self.clock()
        self.window = [(t, g) for t, g in self.window if now - t <= WINDOW_S] + [(now, grams)]

    def reading(self) -> dict:
        if self.needs_tare or not self.sensor_ok or not self.window:
            return {"stable": False, "loaded": False, "placement_id": self.placement, "sample_count": 0}
        values = [g for _, g in self.window]
        full = len(values) >= MIN_WINDOW_SAMPLES and self.window[-1][0] - self.window[0][0] >= MIN_WINDOW_SPAN_S
        spread = max(values) - min(values)
        stable = full and spread <= STABLE_SPREAD_G
        net = statistics.fmean(values) if stable else values[-1]  # follow the load while it settles
        loaded = net >= LOAD_THRESHOLD_G
        if stable and loaded and self.was_empty:  # a new letter has settled on the platform
            self.placement += 1
            self.was_empty = False
            self.save()
        if full and max(values) < EMPTY_THRESHOLD_G:
            self.was_empty = True
        return {"net_g": round(net, 2), "spread_g": round(spread, 2), "stable": stable, "loaded": loaded,
                "placement_id": self.placement, "sample_count": len(values)}


def say(text: str) -> None:
    print(f"{datetime.now():%H:%M:%S} {text}", flush=True)


class Bridge:
    def __init__(self, board, backend, scale: Scale, *, keep_calibration: bool = False):
        self.board, self.backend, self.scale = board, backend, scale
        self.keep_calibration = keep_calibration  # does the board keep its factor over a restart?
        self.boot_id = secrets.token_hex(4)
        self.started = time.monotonic()
        self.seq = 0
        self.camera_ok: bool | None = None
        self.fault = ""

    def read_board(self) -> None:
        """One weight request. Network errors propagate: the caller treats the board as offline."""
        scale = self.scale
        try:
            grams = self.board.weight()
        except HttpError as exc:
            if exc.status == 409:  # the board lost its zero: it was restarted
                if not scale.needs_tare and scale.calibration_id and not self.keep_calibration:
                    scale.set_calibration("")
                scale.needs_tare = True
            else:
                scale.sensor_ok = False
            scale.window, self.fault = [], exc.message
        else:
            scale.needs_tare, scale.sensor_ok = False, True
            scale.add(grams)

    def report(self) -> dict:
        """Push the current reading, run the commands the backend had queued; returns the reading."""
        self.seq += 1
        body = {"seq": self.seq, "boot_id": self.boot_id, "uptime_ms": int((time.monotonic() - self.started) * 1000),
                "captured_at": datetime.now(timezone.utc).isoformat(), "calibration_id": self.scale.calibration_id,
                "sensor_ok": self.scale.sensor_ok, "needs_tare": self.scale.needs_tare, "fw": FW,
                "ip": self.board.host, "camera_ok": self.camera_ok, **self.scale.reading()}
        reply = self.backend.post("/api/iot/readings", json.dumps(body).encode())
        for cmd in reply.get("commands", []):
            self.run_command(cmd)
        return body

    def run_command(self, cmd: dict) -> None:
        kind, params = cmd["type"], cmd.get("params") or {}
        try:
            if kind == "tare":
                status, result = "done", self.tare()
            elif kind == "calibrate":
                status, result = "done", self.calibrate(float(params.get("known_g") or 0))
            elif kind == "capture":
                status, result = "done", self.capture(params["capture_id"], bool(params.get("flash")))
            else:
                status, result = "failed", {"error": f"'{kind}' is not supported by the pull firmware"}
        except HttpError as exc:
            status, result = "failed", {"error": exc.message, "message": exc.message}
        except (*NETWORK_ERRORS, ValueError, KeyError) as exc:
            status, result = "failed", {"error": f"no usable answer: {exc}"}
        say(f"command {kind} -> {status} {json.dumps(result)}")
        self.backend.post(f"/api/iot/commands/{cmd['id']}/result",
                          json.dumps({"status": status, "result": result}).encode())

    def tare(self) -> dict:
        result = {"message": self.board.tare()}
        self.scale.needs_tare, self.scale.was_empty, self.scale.window = False, True, []
        if not self.scale.calibration_id:
            result["note"] = "not calibrated yet - place a reference mass and press Calibrate"
        return result

    def calibrate(self, known_g: float) -> dict:
        if self.scale.needs_tare:
            raise HttpError(409, "tare the empty platform first, then place the reference mass")
        reply = self.board.calibrate(known_g)
        self.scale.window = []
        time.sleep(CALIBRATION_SETTLE_S)
        readback = statistics.fmean(self.board.weight() for _ in range(3))
        if abs(readback - known_g) > max(2.0, CALIBRATION_TOLERANCE * known_g):
            self.scale.set_calibration("")  # the board changed its factor, so the old calibration is gone too
            raise HttpError(200, f"scale reads {readback:.1f} g with the {known_g:g} g reference on it - tare the "
                                 "empty platform, put the reference mass in the centre and calibrate again")
        self.scale.set_calibration(f"CAL-{secrets.token_hex(2).upper()}-{int(time.time()) % 100000000}")
        return {"message": str(reply.get("message", "calibrated")), "readback_g": round(readback, 2),
                "calibration_id": self.scale.calibration_id,
                "factor": next((reply[k] for k in ("factor", "scale", "calibration_factor") if k in reply), None)}

    def capture(self, capture_id: str, flash: bool = False) -> dict:
        try:
            jpeg = self.board.capture()
        except Exception:
            self.camera_ok = False
            raise
        self.camera_ok = True
        reply = self.backend.post(f"/api/iot/captures/{capture_id}", jpeg, "image/jpeg", timeout=20)
        result = {"bytes": len(jpeg), "image_id": reply.get("image_id")}
        if flash:
            result["note"] = "this firmware has no flash control"
        return result


def check(board: Board, backend: Backend) -> int:
    """One pass over every link; prints PASS/WARN/FAIL lines and returns the number of failures."""
    failures = 0

    def step(name: str, fn) -> None:
        nonlocal failures
        try:
            print(f"PASS  {name}: {fn()}")
        except HttpError as exc:
            if exc.status == 409:  # the board is fine, it only wants to be zeroed
                print(f"WARN  {name}: {exc.message}")
                return
            failures += 1
            print(f"FAIL  {name}: {exc}")
        except Exception as exc:  # noqa: BLE001 - a diagnostic must report every kind of failure
            failures += 1
            print(f"FAIL  {name}: {exc}")

    def device_key_accepted() -> str:
        try:  # an unknown command id is answered with 404 only after the id and key were accepted
            backend.post("/api/iot/commands/CHECK/result", b'{"status": "done", "result": {}}')
        except HttpError as exc:
            if exc.status != 404:
                raise
        return "yes"

    step(f"board answers at {board.url}", lambda: f"{len(request('GET', board.url + '/', timeout=5))} bytes")
    step("scale reading", lambda: f"{board.weight():.2f} g")
    step("camera", lambda: f"JPEG, {len(board.capture()) / 1024:.0f} kB")
    step(f"backend answers at {backend.api}",
         lambda: json.loads(request("GET", backend.api + "/api/health", timeout=5))["status"])
    step("backend accepts the device id and key", device_key_accepted)
    print("all links work" if not failures else f"{failures} problem(s) - see the FAIL lines above")
    return failures


def watch(board: Board, seconds: float) -> int:
    """Print the board's own readings for a while. An untouched scale must hold still."""
    values, end = [], time.monotonic() + seconds
    try:
        while time.monotonic() < end:
            values.append(board.weight())
            print(f"{values[-1]:12.2f} g")
            time.sleep(POLL_INTERVAL_S)
    except HttpError as exc:
        print(f"the board refused: {exc.message}")
        return 1
    except (*NETWORK_ERRORS, ValueError, KeyError) as exc:
        print(f"board unreachable at {board.url}: {exc}")
        return 1
    spread = max(values) - min(values)
    steady = spread <= STABLE_SPREAD_G
    print(f"{len(values)} readings, min {min(values):.2f} g, max {max(values):.2f} g, spread {spread:.2f} g -> "
          + ("steady" if steady else "NOT steady. With nothing touching the platform this is a wiring, power or "
                                      "noise fault (load-cell wires, DT/SCK, supply), not weight."))
    return 0 if steady else 1


def main() -> None:
    env = {**load_dotenv(BACKEND_ROOT / ".env"), **os.environ}
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--device-url", default=env.get("BRIDGE_DEVICE_URL", ""),
                    help="address of the ESP32-CAM, e.g. http://192.168.1.37")
    ap.add_argument("--api", default=env.get("BRIDGE_API_URL", "http://127.0.0.1:8000"))
    ap.add_argument("--device", default=env.get("SEED_DEVICE_ID", "SCALECAM-01"))
    ap.add_argument("--key", default=env.get("SEED_DEVICE_KEY", ""),
                    help="device key (default: SEED_DEVICE_KEY in backend/.env)")
    ap.add_argument("--check", action="store_true", help="test the board and the backend once and exit")
    ap.add_argument("--watch", type=float, metavar="SECONDS", help="print the board's readings for this long and exit")
    args = ap.parse_args()

    storage = Path(env.get("STORAGE_DIR", BACKEND_ROOT / "storage"))
    key_file = storage / "seed_device_key.txt"
    if not args.key and key_file.exists():
        args.key = key_file.read_text(encoding="utf-8").split()[-1]
    if args.watch and args.device_url:
        sys.exit(watch(Board(args.device_url), args.watch))
    if not args.device_url or not args.key:
        ap.error("set BRIDGE_DEVICE_URL and SEED_DEVICE_KEY in backend/.env (or pass --device-url and --key)")
    keep = env.get("BRIDGE_CALIBRATION_SURVIVES_RESTART", "false").strip().lower() in ("1", "true", "yes", "on")

    board, backend = Board(args.device_url), Backend(args.api, args.device, args.key)
    if args.check:
        sys.exit(1 if check(board, backend) else 0)

    scale = Scale(storage / f"device_bridge_{args.device}.json")
    bridge = Bridge(board, backend, scale, keep_calibration=keep)
    board_up = backend_up = True
    announced = None
    say(f"bridging {args.device}: {board.url} -> {args.api}   (Ctrl+C to stop)")
    try:
        board.capture()
        bridge.camera_ok = True
    except (HttpError, *NETWORK_ERRORS) as exc:  # the scale still works without the camera
        bridge.camera_ok = False
        say(f"camera test failed: {exc}")

    while True:
        loop_started = time.monotonic()
        try:
            bridge.read_board()
        except (*NETWORK_ERRORS, ValueError, KeyError) as exc:
            # Not reachable: stop reporting, so the backend shows the device as offline.
            if board_up:
                say(f"board unreachable at {board.url}: {exc}")
            board_up, scale.window = False, []
            time.sleep(1)
            continue
        if not board_up:
            say("board is back")
            board_up = True

        try:
            body = bridge.report()
        except HttpError as exc:
            say(f"backend refused: {exc}" + ("  (check SEED_DEVICE_ID / SEED_DEVICE_KEY)" if exc.status == 401 else ""))
            time.sleep(3)
            continue
        except NETWORK_ERRORS as exc:
            if backend_up:
                say(f"backend unreachable at {args.api}: {exc}")
            backend_up = False
            time.sleep(2)
            continue
        if not backend_up:
            say("backend is back")
            backend_up = True

        if scale.needs_tare:
            state, text = "tare", f"board needs tare ({bridge.fault})"
        elif not scale.sensor_ok:
            state, text = "fault", f"scale fault reported by the board: {bridge.fault}"
        elif body["stable"] and body["loaded"]:
            state = body["placement_id"]
            text = f"placement #{state}: {body['net_g']:.1f} g, stable" + ("" if scale.calibration_id else "  (not calibrated)")
        elif scale.was_empty and not body["loaded"]:
            state, text = "empty", "platform empty"
        else:
            state = announced  # settling: nothing new to say
        if state != announced:
            announced = state
            say(text)
        time.sleep(max(0.0, POLL_INTERVAL_S - (time.monotonic() - loop_started)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped")
