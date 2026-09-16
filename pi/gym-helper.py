#!/usr/bin/env python3
"""Lokal hjälpare på Pi: HDMI (CEC) och volym. Lyssnar bara på 127.0.0.1."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8743
STATE_PATH = Path.home() / ".vvk-gym-pi.json"
LOCK = threading.Lock()
STATE = {
    "volume": 80,
    "hdmiOn": True,
    "scheduleEnabled": False,
    "onTime": "07:00",
    "offTime": "22:00",
}


def run(command: list[str]) -> bool:
    try:
        subprocess.run(command, check=False, capture_output=True, timeout=8)
        return True
    except (OSError, subprocess.TimeoutExpired):
        return False


def set_volume(percent: int) -> None:
    percent = max(0, min(100, int(percent)))
    if shutil.which("pactl"):
        run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{percent}%"])
        return
    if shutil.which("wpctl"):
        run(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{percent / 100:.2f}"])
        return
    if shutil.which("amixer"):
        run(["amixer", "-q", "sset", "Master", f"{percent}%"])


def set_hdmi(on: bool) -> None:
    cec = shutil.which("cec-client")
    if cec:
        command = "on 0" if on else "standby 0"
        try:
            subprocess.run(
                [cec, "-s", "-d", "1"],
                input=f"{command}\n".encode(),
                check=False,
                capture_output=True,
                timeout=8,
            )
        except (OSError, subprocess.TimeoutExpired):
            pass
    vcgencmd = shutil.which("vcgencmd")
    if vcgencmd:
        run([vcgencmd, "display_power", "1" if on else "0"])
    wlr = shutil.which("wlr-randr")
    if wlr:
        run([wlr, "--output", "HDMI-A-1", "--on" if on else "--off"])


def save_state() -> None:
    STATE_PATH.write_text(json.dumps(STATE), encoding="utf-8")


def load_state() -> None:
    if not STATE_PATH.exists():
        return
    try:
        loaded = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    with LOCK:
        STATE.update(loaded)
    apply(STATE)


def apply(state: dict) -> None:
    if "volume" in state:
        set_volume(state["volume"])
    if "hdmiOn" in state:
        set_hdmi(bool(state["hdmiOn"]))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        with LOCK:
            body = json.dumps({"ok": True, **STATE})
        self.wfile.write(body.encode())

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/command":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return
        with LOCK:
            for key in ("volume", "hdmiOn", "scheduleEnabled", "onTime", "offTime"):
                if key in payload:
                    STATE[key] = payload[key]
            snapshot = dict(STATE)
            save_state()
        apply(snapshot)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


def scheduled_on(on_time: str, off_time: str) -> bool:
    now = time.localtime()
    current = now.tm_hour * 60 + now.tm_min

    def minutes(value: str) -> int:
        hours, mins = value.split(":")
        return int(hours) * 60 + int(mins)

    start = minutes(str(on_time))
    stop = minutes(str(off_time))
    if start == stop:
        return True
    if start < stop:
        return start <= current < stop
    return current >= start or current < stop


def scheduler() -> None:
    last_minute = ""
    while True:
        time.sleep(5)
        with LOCK:
            state = dict(STATE)
        if not state.get("scheduleEnabled"):
            continue
        now = time.localtime()
        minute = f"{now.tm_hour:02d}:{now.tm_min:02d}"
        if minute not in (state.get("onTime"), state.get("offTime")):
            continue
        if minute == last_minute:
            continue
        last_minute = minute
        want = scheduled_on(state["onTime"], state["offTime"])
        with LOCK:
            STATE["hdmiOn"] = want
            save_state()
        set_hdmi(want)


def main() -> None:
    load_state()
    threading.Thread(target=scheduler, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"vvk gym helper on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
