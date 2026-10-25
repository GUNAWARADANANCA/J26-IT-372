"""Software stand-in for the ESP32-CAM scale (same HTTP protocol as the firmware).

Use it to demonstrate or test the counter workflow before the hardware is
wired, or to check the server side when debugging the real device.

    .venv/Scripts/python tools/device_simulator.py --key <device key> [--image envelope.jpg]

Interactive commands (type and press Enter):
    w 23.5    place a 23.5 g letter on the platform (readings settle after ~1.5 s)
    r         remove the letter (platform empty -> next placement gets a new number)
    n 0.8     set reading noise in grams (default 0.2)
    q         quit
Commands sent by the server (tare / calibrate / capture) are executed and acknowledged.
"""
from __future__ import annotations

import argparse
import json
import random
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

FW = "simulator-1.0"


class Scale:
    def __init__(self):
        self.load_g = 0.0
        self.placed_at = 0.0
        self.noise = 0.2
        self.offset = 0.0
        self.calibration_id = "CAL-SIM-" + secrets.token_hex(2).upper()
        self.placement = 0
        self.was_empty = True
        self.window: list[float] = []

    def sample(self) -> float:
        settling = time.time() - self.placed_at < 1.5 and self.load_g > 0
        jitter = random.uniform(-15, 15) if settling else random.gauss(0, self.noise)
        return self.load_g + jitter - self.offset

    def reading(self) -> dict:
        self.window = (self.window + [self.sample()])[-10:]
        mean = sum(self.window) / len(self.window)
        spread = max(self.window) - min(self.window)
        loaded = mean > 2.0
        stable = len(self.window) >= 5 and spread <= 1.0
        if loaded and stable and self.was_empty:
            self.placement += 1
            self.was_empty = False
        if not loaded and stable:
            self.was_empty = True
        return {"net_g": round(mean, 2), "spread_g": round(spread, 2), "stable": stable, "loaded": loaded,
                "placement_id": self.placement}


def post(url: str, headers: dict, body: bytes, content_type: str = "application/json") -> dict:
    req = urllib.request.Request(url, data=body, method="POST", headers={**headers, "Content-Type": content_type})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read() or b"{}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--device", default="SCALECAM-01")
    ap.add_argument("--key", required=True, help="device key (backend/storage/seed_device_key.txt or .env SEED_DEVICE_KEY)")
    ap.add_argument("--image", help="JPEG returned for capture commands")
    ap.add_argument("--interval", type=float, default=0.5)
    ap.add_argument("--place", type=float, help="put a letter of this many grams on the platform at start-up")
    args = ap.parse_args()

    headers = {"X-Device-Id": args.device, "X-Device-Key": args.key}
    scale = Scale()
    boot_id = secrets.token_hex(4)
    image = Path(args.image).read_bytes() if args.image else None
    seq = 0
    stop = threading.Event()

    def console():
        for line in sys.stdin:
            parts = line.strip().split()
            if not parts:
                continue
            if parts[0] == "w" and len(parts) == 2:
                scale.load_g, scale.placed_at = float(parts[1]), time.time()
                print(f"  placed {scale.load_g} g")
            elif parts[0] == "r":
                scale.load_g, scale.placed_at = 0.0, time.time()
                print("  removed")
            elif parts[0] == "n" and len(parts) == 2:
                scale.noise = float(parts[1])
            elif parts[0] == "q":
                stop.set()
                return

    if args.place:
        scale.load_g, scale.placed_at = args.place, time.time()
    threading.Thread(target=console, daemon=True).start()
    print(f"simulating {args.device} -> {args.api}  (w <grams> | r | n <noise> | q)")
    while not stop.is_set():
        seq += 1
        r = scale.reading()
        body = {"seq": seq, "boot_id": boot_id, "uptime_ms": int(time.monotonic() * 1000),
                "captured_at": datetime.now(timezone.utc).isoformat(), "calibration_id": scale.calibration_id,
                "sensor_ok": True, "sample_count": len(scale.window), "rssi": -55, "fw": FW, "camera_ok": image is not None,
                **r}
        try:
            resp = post(f"{args.api}/api/iot/readings", headers, json.dumps(body).encode())
        except urllib.error.HTTPError as exc:
            print(f"server refused reading: HTTP {exc.code} {exc.read()[:200]!r}")
            time.sleep(3)
            continue
        except urllib.error.URLError as exc:
            print(f"server unreachable: {exc.reason}")
            time.sleep(3)
            continue
        for cmd in resp.get("commands", []):
            result, status = {}, "done"
            if cmd["type"] == "tare":
                scale.offset = scale.load_g
                result = {"offset": scale.offset}
            elif cmd["type"] == "calibrate":
                scale.calibration_id = "CAL-SIM-" + secrets.token_hex(2).upper()
                result = {"calibration_id": scale.calibration_id, "factor": 412.7}
            elif cmd["type"] == "capture":
                if image is None:
                    status, result = "failed", {"error": "simulator started without --image"}
                else:
                    post(f"{args.api}/api/iot/captures/{cmd['params']['capture_id']}", headers, image, "image/jpeg")
                    result = {"bytes": len(image)}
            print(f"  command {cmd['type']} -> {status}")
            post(f"{args.api}/api/iot/commands/{cmd['id']}/result", headers,
                 json.dumps({"status": status, "result": result}).encode())
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
