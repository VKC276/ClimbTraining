#!/usr/bin/env python3
"""HDMI-CEC via cec-client, samma anrop som det fungerande styrscriptet."""

from __future__ import annotations

import glob
import json
import os
import select
import shutil
import subprocess
import sys
import termios
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SENSOR_PI = Path(__file__).resolve().parent.parent / "csi-presence-sensor" / "pi"
if str(SENSOR_PI) not in sys.path:
    sys.path.insert(0, str(SENSOR_PI))

try:
    from presence_monitor import PresenceDetector, parse_csi_line
except ImportError:
    PresenceDetector = None
    parse_csi_line = None

HOST = "127.0.0.1"
PORT = 8743
STATE_PATH = Path.home() / ".vvk-gym-pi.json"
LOCK = threading.Lock()
CEC_LOCK = threading.Lock()
SPEAK_LOCK = threading.Lock()
SOUND_DIR = Path(__file__).resolve().parent / "sounds" / "catch-hold"
SOUND_EXTS = (".wav", ".mp3", ".ogg", ".m4a", ".flac")
TV_ADDRESS = "0"
STATE = {
    "hdmiOn": True,
    "hdmiCommand": None,
    "hdmiCommandId": 0,
    "scheduleEnabled": False,
    "onTime": "07:00",
    "offTime": "22:00",
    "csiThreshold": 3.0,
    "csiHoldSeconds": 600,
}
PRESENCE = {
    "live_until": 0.0,
    "present": False,
    "motion": False,
    "stdev": 0.0,
    "ignore_on_until": 0.0,
    "port": "",
    "lastLine": "",
    "lines": 0,
    "csiLines": 0,
}
CSI_ON_HOLD = 8.0
MANUAL_OFF_HOLD = 180.0


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
        unmute_pi_hdmi()
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
                [binary, "-v", "sv", "-s", "125", "-a", "200", "-g", "8", cleaned],
                check=False,
                capture_output=True,
                timeout=8,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            log(f"espeak: {error}")
            return
        log(f"tal `{cleaned}`")


def send_power(on: bool) -> None:
    if on:
        send_cec_command(f"on {TV_ADDRESS}")
        send_cec_command("as")
        unmute_pi_hdmi()
        return
    send_cec_command(f"standby {TV_ADDRESS}")


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
    if pactl:
        sink = hdmi_sink()
        run([pactl, "set-default-sink", sink])
        _, sinks = run([pactl, "list", "short", "sinks"])
        names = []
        for line in sinks.splitlines():
            parts = line.split()
            if len(parts) >= 2:
                names.append(parts[1])
        for name in [*names, "@DEFAULT_SINK@"]:
            run([pactl, "set-sink-mute", name, "0"])
            run([pactl, "set-sink-volume", name, "100%"])
        _, inputs = run([pactl, "list", "short", "sink-inputs"])
        for line in inputs.splitlines():
            index = line.split()[0]
            if index.isdigit():
                run([pactl, "set-sink-input-mute", index, "0"])
                run([pactl, "set-sink-input-volume", index, "100%"])
    wpctl = shutil.which("wpctl")
    if wpctl:
        run([wpctl, "set-mute", "@DEFAULT_AUDIO_SINK@", "0"])
        run([wpctl, "set-volume", "@DEFAULT_AUDIO_SINK@", "1.0"])
    amixer = shutil.which("amixer")
    if amixer:
        for control in ("HDMI", "PCM", "Master", "Digital"):
            run([amixer, "-q", "sset", control, "100%", "unmute"])


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
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        with LOCK:
            body = json.dumps(
                {
                    "ok": True,
                    **STATE,
                    "csiPort": PRESENCE["port"],
                    "csiPresent": PRESENCE["present"],
                    "csiLive": presence_live(),
                    "csiMotion": PRESENCE["motion"],
                    "csiStdev": round(float(PRESENCE["stdev"]), 1),
                    "csiLastLine": PRESENCE["lastLine"],
                    "csiLines": PRESENCE["lines"],
                    "csiOkLines": PRESENCE["csiLines"],
                    "csiHelper": "csi-5",
                }
            )
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
                "hdmiOn",
                "hdmiCommand",
                "hdmiCommandId",
                "scheduleEnabled",
                "onTime",
                "offTime",
            ):
                if key in payload:
                    STATE[key] = payload[key]
            if payload.get("source") == "csi-tune":
                if "csiThreshold" in payload:
                    STATE["csiThreshold"] = max(
                        0.5, min(12.0, round(float(payload["csiThreshold"]) * 2) / 2)
                    )
                if "csiHoldSeconds" in payload:
                    STATE["csiHoldSeconds"] = max(
                        60, min(1800, int(float(payload["csiHoldSeconds"])))
                    )
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
                want = scheduled_on(current["onTime"], current["offTime"])
                if presence_live() and want and not PRESENCE["present"]:
                    want = False
                STATE["hdmiOn"] = want
                current = dict(STATE)
            elif (
                presence_live()
                and not manual
                and bool(current.get("hdmiOn"))
                and not PRESENCE["present"]
            ):
                STATE["hdmiOn"] = bool(previous.get("hdmiOn"))
                current = dict(STATE)
            if manual and current.get("hdmiCommand") == "off":
                PRESENCE["ignore_on_until"] = time.time() + MANUAL_OFF_HOLD
            if manual and current.get("hdmiCommand") == "on":
                PRESENCE["ignore_on_until"] = 0.0
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
        if presence_live() and want and not PRESENCE["present"]:
            want = False
        with LOCK:
            previous = dict(STATE)
            STATE["hdmiOn"] = want
            current = dict(STATE)
            save_state()
        apply_change(previous, current)


def presence_live() -> bool:
    return time.time() < float(PRESENCE["live_until"])


def serial_candidates() -> list[str]:
    forced = os.environ.get("VVK_CSI_PORT", "").strip()
    if forced:
        return [forced]
    found: list[str] = []
    for pattern in ("/dev/serial/by-id/*", "/dev/ttyUSB*", "/dev/ttyACM*"):
        found.extend(glob.glob(pattern))
    unique: list[str] = []
    seen: set[str] = set()
    for path in sorted(found, key=lambda item: (0 if "by-id" in item else 1, item)):
        real = os.path.realpath(path)
        if real in seen or "ttyAMA" in real or "ttyS" in os.path.basename(real):
            continue
        seen.add(real)
        unique.append(path)
    return unique


def csi_plugged() -> bool:
    return bool(serial_candidates())


def open_csi_serial(port: str) -> int:
    """Samma öppning som csi-sniff.sh: stty + cat (bara läsa)."""
    real = os.path.realpath(port)
    subprocess.run(
        [
            "stty",
            "-F",
            real,
            "115200",
            "cs8",
            "-cstopb",
            "-parenb",
            "raw",
            "-echo",
            "-crtscts",
            "-hupcl",
            "clocal",
        ],
        check=False,
        capture_output=True,
    )
    return os.open(real, os.O_RDONLY | os.O_NOCTTY)


def request_hdmi(on: bool, reason: str) -> None:
    with LOCK:
        state = dict(STATE)
        if on:
            if time.time() < float(PRESENCE["ignore_on_until"]):
                return
            if state.get("scheduleEnabled") and not scheduled_on(
                str(state["onTime"]), str(state["offTime"])
            ):
                return
        if bool(state.get("hdmiOn")) == on:
            return
        previous = dict(STATE)
        STATE["hdmiOn"] = on
        current = dict(STATE)
        save_state()
    log(f"närvaro {reason} -> skärm {'på' if on else 'av'}")
    apply_change(previous, current)


def presence_loop() -> None:
    if parse_csi_line is None or PresenceDetector is None:
        log("CSI-sensor hoppas över (presence_monitor saknas)")
        return
    last_logged = None
    seen_since = 0.0
    while True:
        ports = serial_candidates()
        if not ports:
            time.sleep(3)
            continue
        port = ports[0]
        fd = None
        try:
            fd = open_csi_serial(port)
        except OSError as error:
            log(f"CSI-port {port}: {error}")
            time.sleep(3)
            continue
        PRESENCE["port"] = port
        PRESENCE["lastLine"] = ""
        PRESENCE["lines"] = 0
        PRESENCE["csiLines"] = 0
        detector = PresenceDetector(
            window_size=20,
            motion_threshold=float(STATE.get("csiThreshold") or 3.0),
            hold_seconds=float(STATE.get("csiHoldSeconds") or 600),
        )
        log(f"CSI-sensor på {port}")
        pending = ""
        silent_since = time.time()
        try:
            while True:
                with LOCK:
                    detector.motion_threshold = float(STATE.get("csiThreshold") or 3.0)
                    detector.hold_seconds = float(STATE.get("csiHoldSeconds") or 600)
                ready, _, _ = select.select([fd], [], [], 0.5)
                if not ready:
                    if int(PRESENCE["lines"]) == 0 and time.time() - silent_since > 8:
                        log("CSI-usb tyst efter 8 s")
                        silent_since = time.time()
                    continue
                try:
                    chunk = os.read(fd, 4096)
                except BlockingIOError:
                    continue
                if not chunk:
                    if int(PRESENCE["lines"]) == 0 and time.time() - silent_since > 8:
                        log("CSI-usb tyst efter 8 s")
                        silent_since = time.time()
                    continue
                silent_since = time.time()
                pending += chunk.decode("utf-8", errors="ignore")
                pending = pending.replace("\r\n", "\n").replace("\r", "\n")
                while "\n" in pending:
                    line, pending = pending.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    PRESENCE["lines"] = int(PRESENCE["lines"]) + 1
                    PRESENCE["lastLine"] = line[:180]
                    if int(PRESENCE["lines"]) <= 8 or line.startswith("CSI_"):
                        log(f"CSI-usb {line[:120]}")
                    amplitudes = parse_csi_line(line)
                    if amplitudes is None:
                        continue
                    PRESENCE["csiLines"] = int(PRESENCE["csiLines"]) + 1
                    PRESENCE["live_until"] = time.time() + 8
                    motion_now = detector.feed(amplitudes)
                    present = bool(detector.presence)
                    PRESENCE["present"] = present
                    PRESENCE["motion"] = bool(motion_now)
                    PRESENCE["stdev"] = float(getattr(detector, "last_stdev", 0.0))
                    now = time.time()
                    if present:
                        if seen_since == 0.0:
                            seen_since = now
                    else:
                        seen_since = 0.0
                    if present != last_logged:
                        log(f"CSI {'närvaro' if present else 'tomt'}")
                        last_logged = present
                    if present and now - seen_since >= CSI_ON_HOLD:
                        request_hdmi(True, "csi")
                    elif not present:
                        request_hdmi(False, "csi")
        except OSError as error:
            log(f"CSI-port tappad: {error}")
        finally:
            if fd is not None:
                try:
                    os.close(fd)
                except OSError:
                    pass
            PRESENCE["live_until"] = 0.0
            PRESENCE["present"] = False
            PRESENCE["motion"] = False
            PRESENCE["stdev"] = 0.0
            PRESENCE["port"] = ""
            PRESENCE["lastLine"] = ""
            last_logged = None
            seen_since = 0.0
            time.sleep(2)


def main() -> None:
    load_state()
    unmute_pi_hdmi()
    threading.Thread(target=presence_loop, daemon=True).start()
    threading.Thread(target=scheduler, daemon=True).start()
    plugged = csi_plugged()
    if STATE.get("scheduleEnabled") and not plugged:
        with LOCK:
            previous = dict(STATE)
            STATE["hdmiOn"] = scheduled_on(STATE["onTime"], STATE["offTime"])
            current = dict(STATE)
            save_state()
        threading.Thread(target=apply_change, args=(previous, current), daemon=True).start()
    elif plugged:
        log("CSI-sensor inkopplad, TV väntar på rörelse")
        if STATE.get("scheduleEnabled") and not scheduled_on(STATE["onTime"], STATE["offTime"]):
            with LOCK:
                previous = dict(STATE)
                STATE["hdmiOn"] = False
                current = dict(STATE)
                save_state()
            threading.Thread(target=apply_change, args=(previous, current), daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
