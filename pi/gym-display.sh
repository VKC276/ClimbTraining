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

hdmi_connected() {
  local status
  for status in /sys/class/drm/card*-HDMI-A-*/status /sys/class/drm/card*-HDMI-*/status; do
    [[ -e "$status" ]] || continue
    if [[ "$(cat "$status" 2>/dev/null || true)" == "connected" ]]; then
      return 0
    fi
  done
  return 1
}

wait_hdmi() {
  local i
  if hdmi_connected; then
    return 0
  fi
  log "väntar på HDMI"
  for i in $(seq 1 90); do
    if hdmi_connected; then
      log "HDMI inne"
      sleep 2
      return 0
    fi
    sleep 1
  done
  log "ingen HDMI än, försöker ändå"
}

wait_wayland() {
  local i socket
  for i in $(seq 1 30); do
    if [[ -n "${WAYLAND_DISPLAY:-}" && -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]]; then
      return 0
    fi
    for socket in "$XDG_RUNTIME_DIR"/wayland-*; do
      if [[ -S "$socket" ]]; then
        export WAYLAND_DISPLAY="$(basename "$socket")"
        return 0
      fi
    done
    sleep 1
  done
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

clear_chromium_crash() {
  mkdir -p "$PROFILE/Default"
  local pref="$PROFILE/Default/Preferences"
  if [[ -f "$pref" ]]; then
    python3 - "$pref" <<'PY'
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
}

stop_chromium() {
  pkill -f "user-data-dir=${PROFILE}" >/dev/null 2>&1 || true
  pkill -f "vvk-gym-chromium" >/dev/null 2>&1 || true
  sleep 0.4
}

ensure_helper() {
  if pgrep -f "$HELPER" >/dev/null 2>&1; then
    return 0
  fi
  python3 "$HELPER" >>"$LOG" 2>&1 &
  sleep 0.4
  log "gym-helper startad"
}

start_chromium() {
  clear_chromium_crash
  log "öppnar $DISPLAY_URL"
  "$CHROMIUM" \
    --user-data-dir="$PROFILE" \
    --class=vvk-gym \
    --ozone-platform=wayland \
    --ozone-platform-hint=wayland \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$CDP_PORT" \
    --window-size=1920,1080 \
    --window-position=0,0 \
    --no-first-run \
    --no-default-browser-check \
    --disable-session-crashed-bubble \
    --hide-crash-restore-bubble \
    --disable-infobars \
    --noerrdialogs \
    --password-store=basic \
    --autoplay-policy=no-user-gesture-required \
    --disable-background-networking \
    --disable-sync \
    --disable-component-update \
    --disable-features=PushMessaging,Translation,MediaRouter \
    "$DISPLAY_URL" \
    >>"$LOG" 2>&1 &
  echo $!
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

log "startar gymskärm"
wait_wayland
wait_hdmi
"$SCRIPT_DIR/set-display-1080.sh" session >>"$LOG" 2>&1 || true
max_pi_audio
ensure_helper

CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM" ]]; then
  log "Chromium saknas"
  exit 1
fi

while true; do
  wait_hdmi
  "$SCRIPT_DIR/set-display-1080.sh" session >>"$LOG" 2>&1 || true
  max_pi_audio
  ensure_helper
  stop_chromium
  CHROME_PID="$(start_chromium)"
  sleep 3
  python3 "$FULLSCREEN" >>"$LOG" 2>&1 || true
  (sleep 8; python3 "$FULLSCREEN" >>"$LOG" 2>&1) &
  (sleep 3; max_pi_audio) &

  while kill -0 "$CHROME_PID" >/dev/null 2>&1; do
    if ! hdmi_connected; then
      log "HDMI ur, väntar och startar om"
      stop_chromium
      break
    fi
    sleep 2
  done
  wait "$CHROME_PID" >/dev/null 2>&1 || true
  log "Chromium slutade, ny start när HDMI finns"
  sleep 1
done
