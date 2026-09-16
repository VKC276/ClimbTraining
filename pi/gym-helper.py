#!/usr/bin/env python3
"""Lokal hjälpare på Pi: CEC för skärm på/av och TV-volym."""

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
CEC_LOCK = threading.Lock()
STATE = {
    "volume": 80,
    "hdmiOn": True,
    "scheduleEnabled": False,
    "onTime": "07:00",
    "offTime": "22:00",
    "cecVolume": None,
    "cecHdmi": None,
    "lastCec": "",
}


def log(message: str) -> None:
    print(message, flush=True)


def run_logged(command: list[str], stdin: bytes | None = None) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            command,
            input=stdin,
            check=False,
            capture_output=True,
            timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        text = str(error)
        log(f"kommando fel: {command[0]} {text}")
        return False, text
    text = (result.stdout + result.stderr).decode("utf-8", errors="replace").strip()
    if result.returncode != 0:
        log(f"exit {result.returncode}: {' '.join(command)}\n{text[-500:]}")
        return False, text
    return True, text


def cec_devices() -> list[str]:
    return [path for path in ("/dev/cec0", "/dev/cec1") if os.path.exists(path)]


def cec_ctl(device: str, dest: str, *extra: str) -> tuple[bool, str]:
    ctl = shutil.which("cec-ctl")
    if not ctl:
        return False, ""
    return run_logged(
        [
            ctl,
            "--device",
            device,
            "--playback",
            "--skip-info",
            "--to",
            dest,
            *extra,
        ]
    )


def send_cec(extra: tuple[str, ...], client_line: str, dests: tuple[str, ...] = ("0",)) -> bool:
    ctl = shutil.which("cec-ctl")
    devices = cec_devices()
    if ctl and devices:
        for device in devices:
            for dest in dests:
                ok, text = cec_ctl(device, dest, *extra)
                if ok:
                    STATE["lastCec"] = f"{device} to={dest} {' '.join(extra)} ok"
                    return True
                STATE["lastCec"] = f"{device} to={dest} fail {text[-80:]}"
    cec = shutil.which("cec-client")
    if cec:
        ok, text = run_logged(
            [cec, "-s", "-d", "1"],
            stdin=f"{client_line}\n".encode("ascii"),
        )
        STATE["lastCec"] = f"cec-client {client_line} {'ok' if ok else text[-80:]}"
        return ok
    STATE["lastCec"] = "ingen CEC-enhet"
    return False


def send_power(on: bool) -> bool:
    with CEC_LOCK:
        ok = send_cec(
            ("--image-view-on",) if on else ("--standby",),
            "on 0" if on else "standby 0",
        )
        log(("CEC skärm på" if on else "CEC skärm av") + ("" if ok else " misslyckades"))
        return ok


def send_tv_volume_step(up: bool) -> bool:
    cmd = "volume-up" if up else "volume-down"
    line = "volup" if up else "voldown"
    return send_cec(
        ("--user-control-pressed", f"ui-cmd={cmd}"),
        line,
        dests=("0", "5"),
    )


def apply_tv_volume(target: int, previous: int) -> None:
    target = max(0, min(100, int(target)))
    delta = target - int(previous)
    if delta == 0:
        return
    if target == 0:
        with CEC_LOCK:
            ok = send_cec(
                ("--user-control-pressed", "ui-cmd=mute"),
                "mute",
                dests=("0", "5"),
            )
        log("CEC tyst" if ok else "CEC mute misslyckades")
        return
    steps = min(8, max(1, abs(delta) // 8))
    up = delta > 0
    ok = True
    with CEC_LOCK:
        for index in range(steps):
            if index:
                time.sleep(0.28)
            if not send_tv_volume_step(up):
                ok = False
                break
    log(
        f"CEC TV-volym {previous} → {target} ({steps} tryck)"
        if ok
        else "CEC TV-volym misslyckades"
    )


def hdmi_sink() -> str | None:
    pactl = shutil.which("pactl")
    if not pactl:
        return None
    ok, text = run_logged([pactl, "list", "short", "sinks"])
    if not ok:
        return "@DEFAULT_SINK@"
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        name = parts[1]
        if "hdmi" in name.lower():
            return name
    return "@DEFAULT_SINK@"


def unmute_pi_hdmi() -> None:
    """Håll Pi-ljudet öppet så pip når TV:n; nivån styrs på skärmen."""
    pactl = shutil.which("pactl")
    if pactl:
        sink = hdmi_sink() or "@DEFAULT_SINK@"
        run_logged([pactl, "set-default-sink", sink])
        run_logged([pactl, "set-sink-mute", sink, "0"])
        run_logged([pactl, "set-sink-volume", sink, "100%"])
        log(f"Pi HDMI öppen ({sink})")
        return
    wpctl = shutil.which("wpctl")
    if wpctl:
        run_logged([wpctl, "set-mute", "@DEFAULT_AUDIO_SINK@", "0"])
        run_logged([wpctl, "set-volume", "@DEFAULT_AUDIO_SINK@", "1.0"])


def save_state() -> None:
    STATE_PATH.write_text(
        json.dumps({key: value for key, value in STATE.items() if key != "lastCec"}),
        encoding="utf-8",
    )


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


def probe_cec() -> None:
    devices = cec_devices()
    log(f"CEC-enheter: {', '.join(devices) or 'inga /dev/cec*'}")
    ctl = shutil.which("cec-ctl")
    if ctl and devices:
        run_logged([ctl, "--device", devices[0], "--skip-info"])
    elif not shutil.which("cec-client") and not ctl:
        log("Ingen CEC-binär. sudo apt install cec-utils v4l-utils")


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
            apply_tv_volume(volume, int(last_volume))
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
            body = json.dumps({"ok": True, **STATE, "cecDevices": cec_devices()})
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
        log(f"kommando {payload}")
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
    probe_cec()
    unmute_pi_hdmi()
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=scheduler, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
