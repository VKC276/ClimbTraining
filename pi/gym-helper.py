#!/usr/bin/env python3
"""HDMI-CEC via cec-client, schema/radar-läge och USB-radar (ESP32-C3)."""

from __future__ import annotations

import glob
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8743
STATE_PATH = Path.home() / ".vvk-gym-pi.json"
LOCK = threading.Lock()
CEC_LOCK = threading.Lock()
SPEAK_LOCK = threading.Lock()
INTERNET_OK = True
SOUND_DIR = Path(__file__).resolve().parent / "sounds" / "catch-hold"
SOUND_EXTS = (".wav", ".mp3", ".ogg", ".m4a", ".flac")
TV_ADDRESS = "0"

STATE = {
    "hdmiOn": True,
    "hdmiCommand": None,
    "hdmiCommandId": 0,
    "mode": "off",  # off | schedule | radar
    "onTime": "07:00",
    "offTime": "22:00",
    "radarIdleMinutes": 120,
}

# Radar-runtime (inte persistat)
RADAR = {
    "connected": False,
    "state": "unknown",
    "dist": None,
    "lastMotionAt": 0.0,
    "lastSeq": None,
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


def restore_hdmi_output() -> None:
    script = Path(__file__).resolve().parent / "set-display-1080.sh"
    if not script.is_file():
        return
    for attempt in range(8):
        time.sleep(2 if attempt == 0 else 1)
        code, text = run(["bash", str(script), "wake"])
        summary = " ".join(text.split()) or str(code)
        log(f"hdmi restore {attempt + 1}/8: {summary}")
        if "1920x1080" in text:
            return
    log("hdmi restore misslyckades")


def cec_allowed() -> bool:
    with LOCK:
        return STATE.get("mode") != "off"


def send_power(on: bool) -> None:
    if not cec_allowed():
        log("CEC blockerat (läge Av)")
        return
    if on:
        send_cec_command(f"on {TV_ADDRESS}")
        # Active Source byter TV:ns ingång till Pi. På Pi 4 kan `as` fälla
        # vc4-HDMI, så bilden återställs direkt efteråt.
        send_cec_command("as")
        restore_hdmi_output()
        unmute_pi_hdmi()
        return
    send_cec_command(f"standby {TV_ADDRESS}")


def set_hdmi_on(want: bool, reason: str) -> None:
    with LOCK:
        if STATE.get("mode") == "off":
            return
        already = bool(STATE.get("hdmiOn")) == want
        STATE["hdmiOn"] = want
        STATE["hdmiCommand"] = "on" if want else "off"
        STATE["hdmiCommandId"] = int(time.time() * 1000)
        save_state()
    if already:
        log(f"hdmi redan {'på' if want else 'av'} ({reason})")
        return
    log(f"hdmi {'på' if want else 'av'} ({reason})")
    send_power(want)


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
    script = Path(__file__).resolve().parent / "set-hdmi-audio.sh"
    if script.is_file():
        run(["bash", str(script)])
        return
    pactl = shutil.which("pactl")
    if pactl:
        sink = hdmi_sink()
        run([pactl, "set-default-sink", sink])
        run([pactl, "set-sink-mute", sink, "0"])
        run([pactl, "set-sink-volume", sink, "100%"])
        _, inputs = run([pactl, "list", "short", "sink-inputs"])
        for line in inputs.splitlines():
            index = line.split()[0]
            if index.isdigit():
                run([pactl, "move-sink-input", index, sink])
                run([pactl, "set-sink-input-mute", index, "0"])
                run([pactl, "set-sink-input-volume", index, "100%"])
    wpctl = shutil.which("wpctl")
    if wpctl:
        run([wpctl, "set-mute", "@DEFAULT_AUDIO_SINK@", "0"])
        run([wpctl, "set-volume", "@DEFAULT_AUDIO_SINK@", "1.0"])
    amixer = shutil.which("amixer")
    if amixer:
        run([amixer, "-q", "cset", "numid=3", "2"])
        for control in ("HDMI", "PCM", "Master", "Digital"):
            run([amixer, "-q", "sset", control, "100%", "unmute"])


def save_state() -> None:
    STATE_PATH.write_text(json.dumps(STATE), encoding="utf-8")


def migrate_loaded(loaded: dict) -> None:
    if "mode" not in loaded and "scheduleEnabled" in loaded:
        loaded["mode"] = "schedule" if loaded.get("scheduleEnabled") else "off"
    loaded.pop("scheduleEnabled", None)


def load_state() -> None:
    if not STATE_PATH.exists():
        return
    try:
        loaded = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    if not isinstance(loaded, dict):
        return
    migrate_loaded(loaded)
    with LOCK:
        for key in STATE:
            if key in loaded:
                STATE[key] = loaded[key]
        if STATE.get("mode") not in ("off", "schedule", "radar"):
            STATE["mode"] = "off"
        try:
            STATE["radarIdleMinutes"] = max(1, int(STATE.get("radarIdleMinutes") or 120))
        except (TypeError, ValueError):
            STATE["radarIdleMinutes"] = 120


def apply_change(previous: dict, current: dict) -> None:
    mode = current.get("mode")
    if mode == "off":
        log("läge Av — CEC tyst")
        return

    command_id = int(current.get("hdmiCommandId") or 0)
    previous_id = int(previous.get("hdmiCommandId") or 0)
    command = current.get("hdmiCommand")
    if command_id != previous_id and command in ("on", "off"):
        send_power(command == "on")
        return

    if previous.get("mode") != mode:
        if mode == "schedule":
            want = scheduled_on(current["onTime"], current["offTime"])
            with LOCK:
                STATE["hdmiOn"] = want
                save_state()
            send_power(want)
            return
        if mode == "radar":
            log("läge Radar — väntar på rörelse")
            return

    if mode == "schedule" and bool(previous.get("hdmiOn")) != bool(current.get("hdmiOn")):
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
                    "internet": INTERNET_OK,
                    **STATE,
                    "radar": {
                        "connected": RADAR["connected"],
                        "state": RADAR["state"],
                        "dist": RADAR["dist"],
                        "lastMotionAt": RADAR["lastMotionAt"],
                    },
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
            # Migrera ev. gammal scheduleEnabled från klienten
            if "mode" not in payload and "scheduleEnabled" in payload:
                payload = dict(payload)
                payload["mode"] = "schedule" if payload.get("scheduleEnabled") else "off"
            for key in (
                "hdmiOn",
                "hdmiCommand",
                "hdmiCommandId",
                "mode",
                "onTime",
                "offTime",
                "radarIdleMinutes",
            ):
                if key in payload:
                    STATE[key] = payload[key]
            if STATE.get("mode") not in ("off", "schedule", "radar"):
                STATE["mode"] = "off"
            try:
                STATE["radarIdleMinutes"] = max(1, int(STATE.get("radarIdleMinutes") or 120))
            except (TypeError, ValueError):
                STATE["radarIdleMinutes"] = 120
            manual = int(STATE.get("hdmiCommandId") or 0) != int(
                previous.get("hdmiCommandId") or 0
            )
            # I radarläge äger Pi strömstatusen; klienten får bara ändra via manuellt CEC.
            if STATE.get("mode") == "radar" and not manual:
                STATE["hdmiOn"] = previous.get("hdmiOn")
                STATE["hdmiCommand"] = previous.get("hdmiCommand")
                STATE["hdmiCommandId"] = previous.get("hdmiCommandId")
            # I Av skickas aldrig CEC — behåll senaste status utan nya kommandon.
            if STATE.get("mode") == "off":
                STATE["hdmiCommand"] = None
            current = dict(STATE)
            schedule_changed = (
                previous.get("mode") != current.get("mode")
                or previous.get("onTime") != current.get("onTime")
                or previous.get("offTime") != current.get("offTime")
            )
            if (
                schedule_changed
                and not manual
                and current.get("mode") == "schedule"
            ):
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
        if state.get("mode") != "schedule":
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


def internet_ok() -> bool:
    for url in (
        "https://1.1.1.1",
        "https://cloudflare.com/cdn-cgi/trace",
    ):
        try:
            urllib.request.urlopen(url, timeout=4)
            return True
        except urllib.error.HTTPError:
            return True
        except (urllib.error.URLError, OSError, TimeoutError):
            continue
    return False


def watch_internet() -> None:
    global INTERNET_OK
    while True:
        ok = internet_ok()
        with LOCK:
            previous = INTERNET_OK
            INTERNET_OK = ok
        if ok != previous:
            log("internet ja" if ok else "internet nej")
        time.sleep(8 if ok else 4)


# ---------------- Radar (USB CDC från ESP32-C3) ----------------


def find_radar_port() -> str | None:
    """Endast ESP32-C3-radarn — aldrig generiska ttyACM/USB-serial."""
    if os.path.exists("/dev/radar"):
        return "/dev/radar"
    for path in sorted(glob.glob("/dev/serial/by-id/*Espressif*")):
        if os.path.exists(path):
            return path
    return None


def open_radar_port(path: str):
    import serial  # type: ignore

    ser = serial.Serial()
    ser.port = path
    ser.baudrate = 115200
    ser.timeout = 0.5
    ser.write_timeout = 2
    ser.exclusive = True
    ser.dtr = False
    ser.rts = False
    ser.open()
    return ser


def radar_send(ser, cmd: str) -> None:
    ser.write((cmd + "\n").encode("ascii"))


def on_radar_motion(dist) -> None:
    now = time.monotonic()
    with LOCK:
        RADAR["lastMotionAt"] = now
        RADAR["state"] = "motion"
        if isinstance(dist, int) and dist >= 0:
            RADAR["dist"] = dist
        mode = STATE.get("mode")
        was_on = bool(STATE.get("hdmiOn"))
    if mode != "radar":
        return
    log(f"radar rörelse {dist} cm — timeout nollställd")
    if not was_on:
        set_hdmi_on(True, "radar-motion")


def handle_radar_msg(msg: dict) -> None:
    event = msg.get("event")
    seq = msg.get("seq")

    with LOCK:
        if isinstance(seq, int):
            if event == "boot":
                RADAR["lastSeq"] = None
            last = RADAR["lastSeq"]
            if last is not None and seq != last + 1:
                log(f"radar tappade {seq - last - 1} meddelande(n) (seq {last} -> {seq})")
            RADAR["lastSeq"] = seq

    if event == "motion":
        on_radar_motion(msg.get("dist"))
        return

    if event == "still":
        with LOCK:
            RADAR["state"] = "still"
            dist = msg.get("dist")
            if isinstance(dist, int) and dist >= 0:
                RADAR["dist"] = dist
        return

    if event == "clear":
        with LOCK:
            RADAR["state"] = "clear"
            RADAR["dist"] = None
        return

    if event == "status":
        state = msg.get("state")
        with LOCK:
            previous_state = RADAR["state"]
            if state in ("motion", "still", "clear"):
                RADAR["state"] = state
            dist = msg.get("dist")
            if isinstance(dist, int) and dist >= 0:
                RADAR["dist"] = dist
        # Missat motion-event: synka en gång via status, men nollställ
        # inte timeouten på varje heartbeat medan state redan är motion.
        if state == "motion" and previous_state != "motion":
            on_radar_motion(msg.get("dist"))
        return

    if event == "boot":
        log(f"radar ESP startade (fw {msg.get('fw')}, orsak {msg.get('reason')})")


def handle_radar_line(raw: bytes) -> None:
    text = raw.decode("utf-8", errors="replace").strip()
    if not text or not text.startswith("{"):
        return
    try:
        msg = json.loads(text)
    except json.JSONDecodeError:
        return
    if isinstance(msg, dict):
        handle_radar_msg(msg)


def radar_idle_watch() -> None:
    """Släck skärmen när radarIdleMinutes gått sedan senaste rörelse."""
    while True:
        time.sleep(5)
        with LOCK:
            mode = STATE.get("mode")
            idle_min = int(STATE.get("radarIdleMinutes") or 120)
            last_motion = float(RADAR.get("lastMotionAt") or 0)
            hdmi_on = bool(STATE.get("hdmiOn"))
        if mode != "radar" or not hdmi_on or last_motion <= 0:
            continue
        elapsed = time.monotonic() - last_motion
        if elapsed >= idle_min * 60:
            set_hdmi_on(False, f"radar-idle {idle_min} min")


def radar_read_loop(ser) -> None:
    buf = b""
    last_rx = time.monotonic()
    last_ping = 0.0
    ping_after = 8.0
    dead_after = 15.0
    while True:
        chunk = ser.readline()
        now = time.monotonic()
        if chunk:
            last_rx = now
            buf += chunk
            if buf.endswith(b"\n"):
                handle_radar_line(buf)
                buf = b""
            elif len(buf) > 1024:
                buf = b""
        silent = now - last_rx
        if silent > ping_after and now - last_ping > ping_after:
            try:
                radar_send(ser, "ping")
            except OSError as error:
                raise TimeoutError(str(error)) from error
            last_ping = now
        if silent > dead_after:
            raise TimeoutError(f"radar tyst {silent:.0f} s")


def radar_worker() -> None:
    try:
        import serial  # noqa: F401
    except ImportError:
        log("python3-serial saknas — radar inaktiv (apt install python3-serial)")
        return

    while True:
        path = find_radar_port()
        if not path:
            with LOCK:
                RADAR["connected"] = False
                RADAR["state"] = "unknown"
            time.sleep(3)
            continue
        try:
            with open_radar_port(path) as ser:
                with LOCK:
                    RADAR["connected"] = True
                    RADAR["lastSeq"] = None
                log(f"radar ansluten {path}")
                ser.reset_input_buffer()
                radar_send(ser, "status")
                radar_read_loop(ser)
        except Exception as error:  # serial/OS/timeout
            log(f"radar frånkopplad: {error}")
        with LOCK:
            RADAR["connected"] = False
            RADAR["state"] = "unknown"
        time.sleep(2)


def main() -> None:
    load_state()
    unmute_pi_hdmi()
    threading.Thread(target=scheduler, daemon=True).start()
    threading.Thread(target=watch_internet, daemon=True).start()
    threading.Thread(target=radar_worker, daemon=True).start()
    threading.Thread(target=radar_idle_watch, daemon=True).start()
    if STATE.get("mode") == "schedule":
        with LOCK:
            previous = dict(STATE)
            STATE["hdmiOn"] = scheduled_on(STATE["onTime"], STATE["offTime"])
            current = dict(STATE)
            save_state()
        threading.Thread(target=apply_change, args=(previous, current), daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"vvk gym helper on http://{HOST}:{PORT} mode={STATE.get('mode')}")
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
