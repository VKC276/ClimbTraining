#!/usr/bin/env python3
"""Lokal hjälpare på Pi: HDMI-CEC (på/av + volym). Lyssnar bara på 127.0.0.1.

Enstaka korta CEC-anrop. Ingen persistent cec-client, inget Active Source —
det brukar fälla HDMI-stacken på Pi 4.
"""

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
CEC_DEV = "/dev/cec0"
LOCK = threading.Lock()
CEC_LOCK = threading.Lock()
STATE = {
    "volume": 80,
    "hdmiOn": True,
    "scheduleEnabled": False,
    "onTime": "07:00",
    "offTime": "22:00",
    "cecVolume": None,
    "cecHdmi": None,
}


def log(message: str) -> None:
    print(message, flush=True)


def run_quiet(command: list[str], stdin: bytes | None = None) -> bool:
    try:
        subprocess.run(
            command,
            input=stdin,
            check=False,
            capture_output=True,
            timeout=6,
        )
        return True
    except (OSError, subprocess.TimeoutExpired):
        return False


def has_cec_ctl() -> bool:
    return bool(shutil.which("cec-ctl") and os.path.exists(CEC_DEV))


def cec_ctl(*extra: str) -> bool:
    command = [
        shutil.which("cec-ctl") or "cec-ctl",
        "--device",
        CEC_DEV,
        "--skip-info",
        "--to",
        "0",
        *extra,
    ]
    return run_quiet(command)


def cec_client_line(line: str) -> bool:
    cec = shutil.which("cec-client")
    if not cec:
        return False
    return run_quiet([cec, "-s", "-d", "1"], stdin=f"{line}\n".encode("ascii"))


def send_power(on: bool) -> bool:
    with CEC_LOCK:
        if has_cec_ctl():
            if on:
                ok = cec_ctl("--user-control-pressed", "ui-cmd=power")
            else:
                ok = cec_ctl("--standby")
        else:
            ok = cec_client_line("on 0" if on else "standby 0")
        log(("CEC skärm på" if on else "CEC skärm av") + ("" if ok else " misslyckades"))
        return ok


def send_volume_step(up: bool) -> bool:
    with CEC_LOCK:
        if has_cec_ctl():
            cmd = "volume-up" if up else "volume-down"
            ok = cec_ctl("--user-control-pressed", f"ui-cmd={cmd}")
        else:
            ok = cec_client_line("volup" if up else "voldown")
        return ok


def apply_volume(target: int, previous: int) -> None:
    target = max(0, min(100, int(target)))
    delta = target - int(previous)
    if delta == 0:
        return
    steps = min(3, max(1, abs(delta) // 15))
    up = delta > 0
    ok = True
    for index in range(steps):
        if index:
            time.sleep(0.35)
        if not send_volume_step(up):
            ok = False
            break
    log(
        f"CEC volym {previous} → {target} ({steps} tryck)"
        if ok
        else "CEC volym misslyckades"
    )


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
        STATE["cecVolume"] = STATE.get("volume")
        STATE["cecHdmi"] = STATE.get("hdmiOn")


def worker() -> None:
    while True:
        time.sleep(0.6)
        with LOCK:
            volume = int(STATE.get("volume", 80))
            hdmi = bool(STATE.get("hdmiOn", True))
            last_volume = STATE.get("cecVolume")
            last_hdmi = STATE.get("cecHdmi")
        if last_hdmi is not None and hdmi != last_hdmi:
            send_power(hdmi)
            with LOCK:
                STATE["cecHdmi"] = hdmi
                save_state()
        if last_volume is not None and int(last_volume) != volume:
            apply_volume(volume, int(last_volume))
            with LOCK:
                STATE["cecVolume"] = volume
                save_state()


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
            save_state()
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


def main() -> None:
    load_state()
    if not shutil.which("cec-client") and not has_cec_ctl():
        log("Ingen CEC-binär. sudo apt install cec-utils v4l-utils")
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=scheduler, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT} (CEC, skonsam)")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
