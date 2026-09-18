#!/usr/bin/env bash
set -euo pipefail

DISPLAY_URL="${VVK_DISPLAY_URL:-https://trainer.vastervikclimbing.se/display}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/gym-helper.py"
LOG="${HOME}/.vvk-gym-display.log"
PROFILE="${HOME}/.config/vvk-gym-chromium"

log() {
  echo "$(date '+%F %T') $*" | tee -a "$LOG"
}

wait_wayland() {
  local i socket
  for i in $(seq 1 120); do
    if [[ -n "${WAYLAND_DISPLAY:-}" && -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]]; then
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
  log "ingen Wayland-socket, Chromium kan hamna fel"
}

max_pi_audio() {
  "$SCRIPT_DIR/set-hdmi-audio.sh" >/dev/null 2>&1 || true
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

ensure_helper() {
  if pgrep -f "$HELPER" >/dev/null 2>&1; then
    return 0
  fi
  python3 "$HELPER" >>"$LOG" 2>&1 &
  sleep 0.4
  log "gym-helper startad"
}

chrome_running() {
  pgrep -f "user-data-dir=${PROFILE}" >/dev/null 2>&1
}

start_chromium() {
  clear_chromium_crash
  log "öppnar $DISPLAY_URL"
  "$CHROMIUM" \
    --kiosk \
    --ozone-platform=wayland \
    --start-maximized \
    --user-data-dir="$PROFILE" \
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
}

LOCK="${HOME}/.vvk-gym-display.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  log "gymskärm körs redan, avbryter"
  exit 0
fi

export DISPLAY="${DISPLAY:-:0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

log "startar gymskärm"
wait_wayland
"$SCRIPT_DIR/set-display-1080.sh" session >>"$LOG" 2>&1 || true
max_pi_audio
ensure_helper

CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM" ]]; then
  log "Chromium saknas"
  exit 1
fi

while true; do
  "$SCRIPT_DIR/set-display-1080.sh" session >>"$LOG" 2>&1 || true
  max_pi_audio
  ensure_helper
  if ! chrome_running; then
    start_chromium
    sleep 4
    (sleep 3; max_pi_audio) &
  fi
  while chrome_running; do
    max_pi_audio
    sleep 8
  done
  log "Chromium slutade, startar om"
  sleep 2
done
