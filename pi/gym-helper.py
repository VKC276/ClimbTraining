#!/usr/bin/env python3
"""Lokal hjälpare på Pi: HDMI-CEC (på/av + volym). Lyssnar bara på 127.0.0.1."""

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
    "cecVolume": None,
}

CEC_LOCK = threading.Lock()
CEC_PROC: subprocess.Popen[bytes] | None = None


def log(message: str) -> None:
    print(message, flush=True)


def drain_cec(proc: subprocess.Popen[bytes]) -> None:
    assert proc.stdout is not None
    for raw in iter(proc.stdout.readline, b""):
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        lower = line.lower()
        if "error" in lower or "failed" in lower or "traffic" in lower:
            log(f"cec: {line}")


def start_cec() -> subprocess.Popen[bytes] | None:
    global CEC_PROC
    cec = shutil.which("cec-client")
    if not cec:
        log("cec-client saknas. sudo apt install cec-utils")
        return None
    proc = subprocess.Popen(
        [cec, "-t", "p", "-o", "Gymskarm", "-d", "1"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
    )
    threading.Thread(target=drain_cec, args=(proc,), daemon=True).start()
    time.sleep(1.2)
    CEC_PROC = proc
    log("cec-client startad som playback (SIMPLINK/CEC)")
    return proc


def cec_send(lines: list[str]) -> bool:
    global CEC_PROC
    with CEC_LOCK:
        proc = CEC_PROC
        if proc is None or proc.poll() is not None:
            proc = start_cec()
        if proc is None or proc.stdin is None:
            return False
        try:
            for line in lines:
                proc.stdin.write(f"{line}\n".encode("ascii"))
            proc.stdin.flush()
            return True
        except BrokenPipeError:
            CEC_PROC = None
            return False


def set_hdmi(on: bool) -> None:
    if on:
        ok = cec_send(["on 0", "as", "tx 40:04"])
        log("CEC skärm på" if ok else "CEC skärm på misslyckades")
        return
    ok = cec_send(["standby 0"])
    log("CEC skärm av" if ok else "CEC skärm av misslyckades")


def set_volume(percent: int, previous: int | None) -> None:
    percent = max(0, min(100, int(percent)))
    if previous is None:
        STATE["cecVolume"] = percent
        log(f"CEC volym {percent} % (ingen stegning första gången)")
        return
    delta = percent - int(previous)
    if delta == 0:
        return
    command = "volup" if delta > 0 else "voldown"
    remote = "tx 40:44:41" if delta > 0 else "tx 40:44:42"
    steps = min(abs(delta), 40)
    lines: list[str] = []
    for _ in range(steps):
        lines.extend([command, remote, "tx 40:45"])
    ok = cec_send(lines)
    STATE["cecVolume"] = percent
    log(f"CEC volym {previous} → {percent} ({steps} steg)" if ok else "CEC volym misslyckades")


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
        if STATE.get("cecVolume") is None:
            STATE["cecVolume"] = STATE.get("volume")


def apply(state: dict, *, volume_changed: bool, power_changed: bool) -> None:
    if volume_changed:
        previous = state.get("cecVolume")
        previous_int = int(previous) if isinstance(previous, (int, float)) else None
        set_volume(int(state.get("volume", 80)), previous_int)
    if power_changed:
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
            volume_changed = "volume" in payload and payload["volume"] != STATE.get("volume")
            power_changed = "hdmiOn" in payload and payload["hdmiOn"] != STATE.get("hdmiOn")
            for key in ("volume", "hdmiOn", "scheduleEnabled", "onTime", "offTime"):
                if key in payload:
                    STATE[key] = payload[key]
            snapshot = dict(STATE)
            save_state()
        apply(snapshot, volume_changed=volume_changed, power_changed=power_changed)
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
    start_cec()
    threading.Thread(target=scheduler, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT} (CEC)")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
