#!/usr/bin/env bash
# Justera CSI-närvaro från Pi Connect. Gymskärmen måste vara igång.
exec python3 - "$@" <<'PY'
"""Justera CSI-närvaro från Pi Connect-shell. Pratar bara med lokal gym-helper."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

HELPER = "http://127.0.0.1:8743"
THRESHOLD_MIN = 0.5
THRESHOLD_MAX = 12.0


def request(method: str, path: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        HELPER + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.URLError as error:
        raise SystemExit(
            f"Når inte gym-helper på {HELPER} ({error}). "
            "Är gymskärmen igång?"
        ) from error


def health() -> dict:
    return request("GET", "/health")


def set_csi(**fields: float) -> dict:
    payload = {"source": "csi-tune", **fields}
    request("POST", "/command", payload)
    return health()


def clamp_threshold(value: float) -> float:
    rounded = round(value * 2) / 2
    return max(THRESHOLD_MIN, min(THRESHOLD_MAX, rounded))


def bar(stdev: float, threshold: float, width: int = 28) -> str:
    scale = max(threshold * 2, 6.0)
    filled = int(round(min(width, max(0, stdev / scale * width))))
    mark = int(round(min(width, max(0, threshold / scale * width))))
    chars = ["#"] * filled + ["-"] * (width - filled)
    if 0 <= mark < width:
        chars[mark] = "|"
    return "".join(chars)


def status_line(state: dict) -> str:
    live = bool(state.get("csiLive"))
    present = bool(state.get("csiPresent"))
    motion = bool(state.get("csiMotion"))
    stdev = float(state.get("csiStdev") or 0)
    threshold = float(state.get("csiThreshold") or 3)
    hold = int(float(state.get("csiHoldSeconds") or 600))
    gap = threshold - stdev
    if not live:
        room = "ingen sensor"
    elif motion:
        room = "RÖRELSE"
    elif present:
        room = "närvaro (håll)"
    else:
        room = "tomt"
    if not live:
        relative = "—"
    elif gap > 0:
        relative = f"{gap:.1f} under tröskel ({stdev / threshold * 100:.0f} %)"
    elif gap == 0:
        relative = "på tröskeln"
    else:
        relative = f"{abs(gap):.1f} över tröskel ({stdev / threshold * 100:.0f} %)"
    port = state.get("csiPort") or "—"
    return (
        f"sensor {room:16}  port {port}\n"
        f"signal {stdev:5.1f}  [{bar(stdev, threshold)}]  tröskel {threshold:.1f}\n"
        f"läge   {relative}\n"
        f"håll   {hold} s efter senaste rörelse  "
        f"TV {'på' if state.get('hdmiOn') else 'av'}"
    )


def watch() -> None:
    print("Ctrl+C avslutar. Lägre tröskel = känsligare.\n")
    try:
        while True:
            text = status_line(health())
            sys.stdout.write("\033[H\033[J" if sys.stdout.isatty() else "")
            print(text)
            print()
            print("Exempel:  csi-tune.sh 2.5     eller  csi-tune.sh hold 5")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Läs och justera CSI-känslighet på gym-Pi:n.",
    )
    parser.add_argument(
        "value",
        nargs="?",
        help="Ny tröskel (0.5–12, lägre = känsligare) eller 'watch'",
    )
    parser.add_argument(
        "hold_minutes",
        nargs="?",
        help="Med 'hold': minuter TV:n stannar på efter stillhet",
    )
    args = parser.parse_args()

    if args.value is None:
        print(status_line(health()))
        return
    if args.value in ("watch", "w", "-w"):
        watch()
        return
    if args.value in ("hold", "håll"):
        if args.hold_minutes is None:
            raise SystemExit("Ange minuter, t.ex. csi-tune.sh hold 10")
        minutes = float(str(args.hold_minutes).rstrip("mM"))
        seconds = max(60, min(1800, int(minutes * 60)))
        state = set_csi(csiHoldSeconds=seconds)
        print(f"Håll satt till {seconds} s.\n")
        print(status_line(state))
        return
    threshold = clamp_threshold(float(args.value.replace(",", ".")))
    state = set_csi(csiThreshold=threshold)
    print(f"Tröskel satt till {threshold:.1f} (lägre = känsligare).\n")
    print(status_line(state))


if __name__ == "__main__":
    main()
PY
