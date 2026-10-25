"""tools/device_bridge.py against a stand-in for the ESP32-CAM "pull" sketch.

The stand-in behaves like the real board: it converts raw counts with its own zero and factor,
loses the zero when it restarts and answers 409 until it is tared again.
"""
from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np
import pytest

from conftest import DEVICE_HEADERS, requires_mongo
from test_workflow import confirm, new_draft
from tools import device_bridge as bridge

DEVICE = "SCALECAM-T1"


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class FakeBoard:
    url, host = "http://fake-board", "192.0.2.10"

    def __init__(self):
        self.load_g = 0.0          # what lies on the platform
        self.counts_per_g = 400.0  # true sensitivity of the load cell
        self.factor = 2000.0       # the sketch's factor: wrong until calibrated
        self.offset = None         # None = restarted and not tared yet
        self.broken_calibrate = False

    def raw(self) -> float:
        return 84000.0 + self.load_g * self.counts_per_g

    def restart(self) -> None:
        self.offset = None

    def weight(self) -> float:
        if self.offset is None:
            raise bridge.HttpError(409, "remove everything and press Tare after each reboot")
        return round((self.raw() - self.offset) / self.factor, 2)

    def tare(self) -> str:
        self.offset = self.raw()
        return "empty scale set to zero"

    def calibrate(self, known_g: float) -> dict:
        if not self.broken_calibrate:
            self.factor = (self.raw() - self.offset) / known_g
        return {"ok": True, "message": "calibrated"}

    def capture(self) -> bytes:
        image = np.full((600, 800, 3), 235, np.uint8)
        cv2.putText(image, "K. Sivarajah, 7 Kasthuriyar Road", (40, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (20, 20, 20), 3)
        return cv2.imencode(".jpg", image)[1].tobytes()


class ClientBackend:
    """bridge.Backend on top of the FastAPI test client."""
    api = "testclient"

    def __init__(self, client):
        self.client = client

    def post(self, path: str, body: bytes, content_type: str = "application/json", timeout: float = 10) -> dict:
        r = self.client.post(path, content=body, headers={**DEVICE_HEADERS, "Content-Type": content_type})
        if r.status_code >= 400:
            raise bridge.HttpError(r.status_code, r.text[:200])
        return r.json()


class Rig:
    def __init__(self, backend, state_file, **options):
        self.clock, self.board = Clock(), FakeBoard()
        self.scale = bridge.Scale(state_file, clock=self.clock)
        self.bridge = bridge.Bridge(self.board, backend, self.scale, **options)

    def poll(self, times: int = 6) -> dict:
        for _ in range(times):  # the real board answers about three times per second
            self.clock.now += 0.3
            self.bridge.read_board()
            body = self.bridge.report()
        return body

    def place(self, grams: float) -> dict:
        self.board.load_g = grams
        return self.poll()


class NoBackend:
    def post(self, *args, **kwargs) -> dict:
        return {}


# ------------------------------------------------------------------ window, stability and placement numbers
def test_each_placement_gets_one_number(tmp_path):
    rig = Rig(NoBackend(), tmp_path / "state.json")
    rig.board.tare()
    assert rig.poll()["placement_id"] == 0
    first = rig.place(23.4 * 5)  # the uncalibrated factor is 5x too large -> 23.4 g
    assert (first["net_g"], first["stable"], first["loaded"], first["placement_id"]) == (23.4, True, True, 1)
    assert rig.poll()["placement_id"] == 1                 # still the same letter
    assert rig.place(0)["loaded"] is False
    assert rig.place(23.4 * 5)["placement_id"] == 2        # lifted off and placed again


def test_not_stable_while_the_load_settles(tmp_path):
    rig = Rig(NoBackend(), tmp_path / "state.json")
    rig.board.tare()
    rig.poll()
    for grams in (5, 18, 23, 23.4):
        rig.board.load_g = grams * 5
        body = rig.poll(1)
    assert body["stable"] is False and body["net_g"] == 23.4 and body["placement_id"] == 0
    assert rig.poll()["stable"] is True


def test_zero_jitter_of_the_real_board_still_counts_as_empty(tmp_path):
    rig = Rig(NoBackend(), tmp_path / "state.json")
    rig.board.tare()
    assert rig.place(100)["placement_id"] == 1
    for i in range(8):  # the sketch's dead band flips an empty platform between 0.00 and about -1.36 g
        rig.board.load_g = 0 if i % 2 else -1.36 * 5
        body = rig.poll(1)
    assert body["stable"] is False and body["loaded"] is False
    assert rig.place(100)["placement_id"] == 2


def test_placement_numbers_continue_after_the_bridge_restarts(tmp_path):
    rig = Rig(NoBackend(), tmp_path / "state.json")
    rig.board.tare()
    assert rig.place(100)["placement_id"] == 1
    again = Rig(NoBackend(), tmp_path / "state.json")
    again.board.tare()
    assert again.place(100)["placement_id"] == 2


# ------------------------------------------------------------------ the board's HTTP pages
class SketchPages(BaseHTTPRequestHandler):
    """Answers like the pull sketch on the bench (status codes and JSON copied from the real board)."""
    state = {"tared": False, "calibrated_with": None, "captures": 0}

    def reply(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/weight" and not self.state["tared"]:
            self.reply(409, b'{"error":"remove everything and press Tare after each reboot"}')
        elif url.path == "/weight":
            self.reply(200, b'{"grams":23.41,"unit":"g"}')
        elif url.path == "/capture":
            self.state["captures"] += 1
            self.reply(200, b"\xff\xd8 frame %d" % self.state["captures"], "image/jpeg")
        else:
            self.reply(404, b"Not found: " + url.path.encode(), "text/html")

    def do_POST(self):
        url = urlparse(self.path)
        if url.path == "/tare":
            self.state["tared"] = True
            self.reply(200, b'{"ok":true,"message":"empty scale set to zero"}')
        elif url.path == "/calibrate":
            self.state["calibrated_with"] = parse_qs(url.query)["g"][0]
            self.reply(200, b'{"ok":true,"message":"calibrated"}')
        else:
            self.reply(404, b"Not found: " + url.path.encode(), "text/html")

    def log_message(self, *args) -> None:
        pass


def test_board_pages_are_understood():
    server = ThreadingHTTPServer(("127.0.0.1", 0), SketchPages)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        board = bridge.Board(f"http://127.0.0.1:{server.server_port}/")
        with pytest.raises(bridge.HttpError) as refused:
            board.weight()
        assert (refused.value.status, refused.value.message) == (409, "remove everything and press Tare after each reboot")
        assert board.tare() == "empty scale set to zero"
        assert board.weight() == 23.41
        assert board.calibrate(100.0)["ok"] is True and SketchPages.state["calibrated_with"] == "100"
        assert board.capture() == b"\xff\xd8 frame 2"  # the first frame may be an old one
        assert board.host == "127.0.0.1"
    finally:
        server.shutdown()


# ------------------------------------------------------------------ through the backend
@pytest.fixture
def rig(client, tmp_path, monkeypatch):
    monkeypatch.setattr(bridge, "CALIBRATION_SETTLE_S", 0)
    return Rig(ClientBackend(client), tmp_path / "state.json")


def staff_command(client, h, kind: str, params: dict | None = None) -> str:
    r = client.post(f"/api/devices/{DEVICE}/commands", headers=h, json={"type": kind, "params": params or {}})
    assert r.status_code == 200, r.text
    return r.json()["_id"]


def last_command(client, h, cmd_id: str) -> dict:
    recent = client.get(f"/api/devices/{DEVICE}/live", headers=h).json()["recent_commands"]
    return next(c for c in recent if c["_id"] == cmd_id)


def live(client, h) -> dict:
    return client.get(f"/api/devices/{DEVICE}/live", headers=h).json()


def calibrated(client, h, rig) -> str:
    staff_command(client, h, "tare")
    rig.poll(1)
    rig.board.load_g = 100
    cmd = staff_command(client, h, "calibrate", {"known_g": 100})
    rig.poll(1)
    done = last_command(client, h, cmd)
    assert done["status"] == "done", done
    rig.place(0)
    return done["result"]["calibration_id"]


@requires_mongo
def test_restarted_board_must_be_tared_before_it_can_weigh(client, tokens, rig):
    h = tokens["counter2"]
    rig.poll(2)
    view = live(client, h)
    assert view["online"] and view["ip"] == "192.0.2.10" and view["firmware"] == bridge.FW
    assert [p["code"] for p in view["pairing_problems"]] == ["NEEDS_TARE", "UNCALIBRATED"]
    draft = new_draft(client, h)
    r = client.post(f"/api/intake/drafts/{draft}/weight/pair", headers=h, json={"device_id": DEVICE})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "WEIGHT_NOT_READY"

    cmd = staff_command(client, h, "tare")
    rig.poll(1)
    assert last_command(client, h, cmd)["status"] == "done"
    rig.poll(1)  # the next reading comes from the zeroed scale
    assert "NEEDS_TARE" not in [p["code"] for p in live(client, h)["pairing_problems"]]


@requires_mongo
def test_calibrate_then_pair_one_placement_to_one_letter(client, tokens, rig):  # T03 with the real protocol
    h = tokens["counter2"]
    rig.poll(1)
    calibration_id = calibrated(client, h, rig)
    assert live(client, h)["calibration"]["calibration_id"] == calibration_id

    reading = rig.place(23.4)
    assert (reading["net_g"], reading["stable"], reading["calibration_id"]) == (23.4, True, calibration_id)
    first, second = new_draft(client, h), new_draft(client, h)
    confirm(client, h, first)
    confirm(client, h, second)
    r = client.post(f"/api/intake/drafts/{first}/weight/pair", headers=h, json={"device_id": DEVICE})
    assert r.status_code == 200, r.text
    assert r.json()["grams"] == 23.4 and r.json()["calibration_id"] == calibration_id

    rig.poll(1)  # the first letter is still on the platform
    r = client.post(f"/api/intake/drafts/{second}/weight/pair", headers=h, json={"device_id": DEVICE})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PLACEMENT_ALREADY_USED"
    rig.place(0)
    rig.place(41.0)
    r = client.post(f"/api/intake/drafts/{second}/weight/pair", headers=h, json={"device_id": DEVICE})
    assert r.status_code == 200 and r.json()["grams"] == 41.0


@requires_mongo
def test_calibration_that_does_not_take_is_refused(client, tokens, rig):
    h = tokens["counter2"]
    rig.poll(1)
    calibrated(client, h, rig)
    rig.board.broken_calibrate, rig.board.load_g = True, 200
    cmd = staff_command(client, h, "calibrate", {"known_g": 50})
    rig.poll(1)
    failed = last_command(client, h, cmd)
    assert failed["status"] == "failed" and "200.0 g with the 50 g reference" in failed["result"]["error"]
    rig.poll(1)
    view = live(client, h)
    assert view["calibration"]["status"] == "uncalibrated"
    assert "UNCALIBRATED" in [p["code"] for p in view["pairing_problems"]]


@requires_mongo
@pytest.mark.parametrize("survives,expected", [(False, ""), (True, "kept")])
def test_calibration_after_the_board_restarts(client, tokens, tmp_path, monkeypatch, survives, expected):
    monkeypatch.setattr(bridge, "CALIBRATION_SETTLE_S", 0)
    h = tokens["counter2"]
    rig = Rig(ClientBackend(client), tmp_path / "state.json", keep_calibration=survives)
    rig.poll(1)
    calibration_id = calibrated(client, h, rig)
    rig.board.restart()
    body = rig.poll(1)
    assert body["needs_tare"] is True
    assert body["calibration_id"] == (calibration_id if expected else "")


@requires_mongo
def test_capture_command_stores_the_board_photo(client, tokens, rig):
    h = tokens["counter2"]
    rig.board.tare()
    cmd = staff_command(client, h, "capture", {"flash": True})
    rig.poll(1)
    done = last_command(client, h, cmd)
    assert done["status"] == "done" and done["result"]["note"] == "this firmware has no flash control"
    capture = client.get(f"/api/intake/captures/{done['params']['capture_id']}", headers=h).json()
    assert (capture["status"], capture["width"], capture["height"]) == ("received", 800, 600)
    rig.poll(1)  # the next reading reports the camera state
    assert live(client, h)["camera_ok"] is True


@requires_mongo
def test_commands_the_pull_sketch_cannot_do_fail_with_a_reason(client, tokens, rig):
    h = tokens["counter2"]
    rig.board.tare()
    cmd = staff_command(client, h, "identify")
    rig.poll(1)
    failed = last_command(client, h, cmd)
    assert failed["status"] == "failed" and "not supported" in failed["result"]["error"]
