#!/usr/bin/env python3
"""HDMI-CEC via cec-client, samma anrop som det fungerande styrscriptet."""

from __future__ import annotations

import json
import os
import re
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
SPEAK_LOCK = threading.Lock()
VOLUME_GATE = threading.Lock()
SOUND_DIR = Path(__file__).resolve().parent / "sounds" / "catch-hold"
SOUND_EXTS = (".wav", ".mp3", ".ogg", ".m4a", ".flac")
TV_ADDRESS = "0"
LAST_TV_VOLUME_AT = 0.0
STATE = {
    "volume": 80,
    "volumeCommand": None,
    "volumeCommandId": 0,
    "hdmiOn": True,
    "hdmiCommand": None,
    "hdmiCommandId": 0,
    "scheduleEnabled": False,
    "onTime": "07:00",
    "offTime": "22:00",
}


def log(message: str) -> None:
    print(message, flush=True)


def run(command: list[str]) -> tuple[int, str]:
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return 1, str(error)
    text = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    return result.returncode, text


def send_cec_command(cec_command: str, timeout: int = 8) -> str:
    try:
        with CEC_LOCK:
            process = subprocess.run(
                ["cec-client", "-s", "-d", "1"],
                input=cec_command + "\n",
                capture_output=True,
                text=True,
                timeout=timeout,
            )
    except FileNotFoundError:
        log("cec-client saknas")
        return ""
    except subprocess.TimeoutExpired:
        log(f"CEC timeout `{cec_command}`")
        return ""
    log(f"CEC `{cec_command}`")
    return (process.stdout or "") + (process.stderr or "")


def play_audio_file(path: Path) -> bool:
    players = (
        ["paplay", str(path)],
        ["pw-play", str(path)],
        ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(path)],
        ["mpv", "--no-video", "--really-quiet", str(path)],
        ["aplay", str(path)],
    )
    for command in players:
        if not shutil.which(command[0]):
            continue
        code, _ = run(command)
        if code == 0:
            log(f"ljudfil `{path.name}`")
            return True
    return False


def play_color_file(color_id: str) -> bool:
    safe = "".join(ch for ch in color_id.lower() if ch.isalnum())[:20]
    if not safe:
        return False
    SOUND_DIR.mkdir(parents=True, exist_ok=True)
    for ext in SOUND_EXTS:
        path = SOUND_DIR / f"{safe}{ext}"
        if path.is_file() and play_audio_file(path):
            return True
    return False


def speak_text(text: str, color_id: str = "") -> None:
    with SPEAK_LOCK:
        if color_id and play_color_file(color_id):
            return
        cleaned = "".join(ch for ch in str(text) if ch.isalnum() or ch in " !-åäöÅÄÖ")
        cleaned = cleaned.strip()[:40]
        if not cleaned:
            return
        binary = shutil.which("espeak-ng") or shutil.which("espeak")
        if not binary:
            log("espeak-ng saknas")
            return
        try:
            subprocess.run(
                [binary, "-v", "sv", "-s", "125", "-a", "180", "-g", "8", cleaned],
                check=False,
                capture_output=True,
                timeout=8,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            log(f"espeak: {error}")
            return
        log(f"tal `{cleaned}`")


def parse_audio_status(text: str) -> int | None:
    match = re.search(
        r"(?:audio status|volume up|volume down):\s*([0-9a-f]{1,2})",
        text,
        re.I,
    )
    if not match:
        match = re.search(r"\b7a:([0-9a-f]{2})\b", text, re.I)
    if not match:
        return None
    raw = int(match.group(1), 16)
    if raw == 0x7F:
        return None
    if raw & 0x80:
        return 0
    return max(0, min(100, raw & 0x7F))


def read_tv_volume() -> int | None:
    text = send_cec_command("gas")
    value = parse_audio_status(text)
    if value is not None:
        return value
    text = send_cec_command("tx 40:71")
    return parse_audio_status(text)


def refresh_tv_volume(force: bool = False) -> None:
    global LAST_TV_VOLUME_AT
    now = time.time()
    if not force and now - LAST_TV_VOLUME_AT < 5:
        return
    if VOLUME_GATE.locked():
        return
    LAST_TV_VOLUME_AT = now
    value = read_tv_volume()
    if value is None:
        return
    with LOCK:
        STATE["volume"] = value
        save_state()
    log(f"TV-volym {value}")


def send_power(on: bool) -> None:
    if on:
        send_cec_command(f"on {TV_ADDRESS}")
        send_cec_command("as")
        return
    send_cec_command(f"standby {TV_ADDRESS}")


def send_volume_step(up: bool) -> None:
    send_cec_command("volup" if up else "voldown")


def send_volume_burst(up: bool, steps: int = 5) -> None:
    if not VOLUME_GATE.acquire(blocking=False):
        log("volym hoppas över")
        return
    try:
        command = "volup" if up else "voldown"
        send_cec_command("\n".join([command] * max(1, steps)), timeout=6)
    finally:
        VOLUME_GATE.release()


def apply_volume(target: int, previous: int) -> None:
    target = max(0, min(100, int(target)))
    actual = read_tv_volume()
    if actual is not None:
        previous = actual
    previous = int(previous)
    if target == 0:
        send_cec_command("mute")
        synced = read_tv_volume()
        if synced is not None:
            with LOCK:
                STATE["volume"] = synced
                save_state()
        return
    delta = target - previous
    if delta == 0:
        if actual is not None:
            with LOCK:
                STATE["volume"] = actual
                save_state()
        return
    steps = min(25, max(1, abs(delta)))
    command = "volup" if delta > 0 else "voldown"
    send_cec_command("\n".join([command] * steps), timeout=min(18, 5 + steps * 0.25))
    time.sleep(0.25)
    synced = read_tv_volume()
    if synced is not None:
        with LOCK:
            STATE["volume"] = synced
            save_state()


def hdmi_sink() -> str:
    pactl = shutil.which("pactl")
    if not pactl:
        return "@DEFAULT_SINK@"
    _, text = run([pactl, "list", "short", "sinks"])
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 2 and "hdmi" in parts[1].lower():
            return parts[1]
    return "@DEFAULT_SINK@"


def unmute_pi_hdmi() -> None:
    pactl = shutil.which("pactl")
    if not pactl:
        return
    sink = hdmi_sink()
    run([pactl, "set-default-sink", sink])
    run([pactl, "set-sink-mute", sink, "0"])
    run([pactl, "set-sink-volume", sink, "100%"])


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
        for key in STATE:
            if key in loaded:
                STATE[key] = loaded[key]


def apply_change(previous: dict, current: dict) -> None:
    command_id = int(current.get("hdmiCommandId") or 0)
    previous_id = int(previous.get("hdmiCommandId") or 0)
    command = current.get("hdmiCommand")
    if command_id != previous_id and command in ("on", "off"):
        send_power(command == "on")
    elif bool(previous.get("hdmiOn")) != bool(current.get("hdmiOn")):
        send_power(bool(current.get("hdmiOn")))
    volume_id = int(current.get("volumeCommandId") or 0)
    previous_volume_id = int(previous.get("volumeCommandId") or 0)
    volume_command = current.get("volumeCommand")
    if volume_id != previous_volume_id and volume_command in ("up", "down"):
        send_volume_burst(volume_command == "up")
    elif int(previous.get("volume", 0)) != int(current.get("volume", 0)):
        if not VOLUME_GATE.acquire(blocking=False):
            log("volym hoppas över")
            return
        try:
            apply_volume(int(current["volume"]), int(previous["volume"]))
        finally:
            VOLUME_GATE.release()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
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
        refresh_tv_volume()
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
            previous = dict(STATE)
            for key in (
                "volume",
                "volumeCommand",
                "volumeCommandId",
                "hdmiOn",
                "hdmiCommand",
                "hdmiCommandId",
                "scheduleEnabled",
                "onTime",
                "offTime",
            ):
                if key in payload:
                    STATE[key] = payload[key]
            current = dict(STATE)
            schedule_changed = (
                previous.get("scheduleEnabled") != current.get("scheduleEnabled")
                or previous.get("onTime") != current.get("onTime")
                or previous.get("offTime") != current.get("offTime")
            )
            manual = int(current.get("hdmiCommandId") or 0) != int(
                previous.get("hdmiCommandId") or 0
            )
            if schedule_changed and not manual and current.get("scheduleEnabled"):
                STATE["hdmiOn"] = scheduled_on(current["onTime"], current["offTime"])
                current = dict(STATE)
            save_state()
        log(f"kommando {payload}")
        speak = payload.get("speak")
        sound_id = payload.get("soundId") if isinstance(payload.get("soundId"), str) else ""
        if (isinstance(speak, str) and speak.strip()) or sound_id:
            threading.Thread(
                target=speak_text,
                args=(speak if isinstance(speak, str) else "", sound_id),
                daemon=True,
            ).start()
        threading.Thread(target=apply_change, args=(previous, current), daemon=True).start()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


def scheduled_on(on_time: str, off_time: str) -> bool:
    now = time.localtime()
    current = now.tm_hour * 60 + now.tm_min

    def minutes(value: str) -> int:
        parts = str(value).split(":")
        return int(parts[0]) * 60 + int(parts[1])

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
            previous = dict(STATE)
            STATE["hdmiOn"] = want
            current = dict(STATE)
            save_state()
        apply_change(previous, current)


def main() -> None:
    load_state()
    unmute_pi_hdmi()
    threading.Thread(target=scheduler, daemon=True).start()
    if STATE.get("scheduleEnabled"):
        with LOCK:
            previous = dict(STATE)
            STATE["hdmiOn"] = scheduled_on(STATE["onTime"], STATE["offTime"])
            current = dict(STATE)
            save_state()
        threading.Thread(target=apply_change, args=(previous, current), daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
