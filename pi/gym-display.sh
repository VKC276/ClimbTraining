#!/usr/bin/env bash
set -euo pipefail

DISPLAY_URL="${VVK_DISPLAY_URL:-https://trainer.vastervikclimbing.se/display}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/gym-helper.py"
FULLSCREEN="$SCRIPT_DIR/chromium-fullscreen.py"
LOG="${HOME}/.vvk-gym-display.log"
PROFILE="${HOME}/.config/vvk-gym-chromium"
CDP_PORT="${VVK_CDP_PORT:-9222}"

log() {
  echo "$(date '+%F %T') $*" | tee -a "$LOG"
}

max_pi_audio() {
  if command -v pactl >/dev/null; then
    SINK="$(pactl list short sinks 2>/dev/null | awk 'tolower($0) ~ /hdmi/ { print $2; exit }')"
    SINK="${SINK:-@DEFAULT_SINK@}"
    pactl set-default-sink "$SINK" >/dev/null 2>&1 || true
    pactl list short sinks 2>/dev/null | awk '{ print $2 }' | while read -r name; do
      [[ -z "$name" ]] && continue
      pactl set-sink-mute "$name" 0 >/dev/null 2>&1 || true
      pactl set-sink-volume "$name" 100% >/dev/null 2>&1 || true
    done
    pactl set-sink-mute "$SINK" 0 >/dev/null 2>&1 || true
    pactl set-sink-volume "$SINK" 100% >/dev/null 2>&1 || true
    pactl list short sink-inputs 2>/dev/null | awk '{ print $1 }' | while read -r id; do
      [[ -z "$id" ]] && continue
      pactl set-sink-input-mute "$id" 0 >/dev/null 2>&1 || true
      pactl set-sink-input-volume "$id" 100% >/dev/null 2>&1 || true
    done
  fi
  if command -v wpctl >/dev/null; then
    wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 >/dev/null 2>&1 || true
    wpctl set-volume @DEFAULT_AUDIO_SINK@ 1.0 >/dev/null 2>&1 || true
  fi
  if command -v amixer >/dev/null; then
    for control in HDMI PCM Master Digital; do
      amixer -q sset "$control" 100% unmute >/dev/null 2>&1 || true
    done
  fi
}

LOCK="${HOME}/.vvk-gym-display.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  log "gymskärm körs redan, avbryter"
  exit 0
fi

export DISPLAY="${DISPLAY:-:0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export VVK_CDP_PORT="$CDP_PORT"

if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  for socket in "$XDG_RUNTIME_DIR"/wayland-*; do
    if [[ -S "$socket" ]]; then
      export WAYLAND_DISPLAY="$(basename "$socket")"
      break
    fi
  done
fi

log "startar gymskärm"
sleep 4
max_pi_audio

if ! pgrep -f "gym-helper.py" >/dev/null; then
  python3 "$HELPER" >>"$LOG" 2>&1 &
  sleep 0.4
fi

CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM" ]]; then
  log "Chromium saknas"
  exit 1
fi

pkill -f "vvk-gym-chromium" >/dev/null 2>&1 || true
sleep 0.3
mkdir -p "$PROFILE/Default"
PREF="$PROFILE/Default/Preferences"
if [[ -f "$PREF" ]]; then
  python3 - "$PREF" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.loads(open(path, encoding="utf-8").read())
except Exception:
    raise SystemExit(0)
profile = data.setdefault("profile", {})
profile["exited_cleanly"] = True
profile["exit_type"] = "Normal"
open(path, "w", encoding="utf-8").write(json.dumps(data))
PY
fi

log "öppnar $DISPLAY_URL"
"$CHROMIUM" \
  --user-data-dir="$PROFILE" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$CDP_PORT" \
  --start-maximized \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --disable-background-networking \
  --disable-sync \
  --disable-component-update \
  --disable-features=PushMessaging,Translation,MediaRouter \
  "$DISPLAY_URL" \
  >/dev/null 2>&1 &
CHROME_PID=$!

sleep 2
python3 "$FULLSCREEN" >>"$LOG" 2>&1 || true
(sleep 6; python3 "$FULLSCREEN" >>"$LOG" 2>&1) &
(sleep 3; max_pi_audio) &

wait "$CHROME_PID"
