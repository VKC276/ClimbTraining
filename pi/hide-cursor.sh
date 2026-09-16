#!/usr/bin/env bash
set -euo pipefail

# Dölj muspekaren. WarpCursor används inte: den cementerar pekaren i ett hörn.
IDLE="${VVK_CURSOR_IDLE:-2}"
LOG="${HOME}/.vvk-gym-display.log"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  for socket in "$XDG_RUNTIME_DIR"/wayland-*; do
    if [[ -S "$socket" ]]; then
      export WAYLAND_DISPLAY="$(basename "$socket")"
      break
    fi
  done
fi

if pgrep -f "vvk-hide-cursor" >/dev/null; then
  exit 0
fi

hide() {
  command -v wtype >/dev/null || return 0
  wtype -M alt -M logo -P h -s 40 -m logo -m alt >/dev/null 2>&1 || \
    wtype -M alt -M logo h -m logo -m alt >/dev/null 2>&1 || true
}

hide
if ! command -v swayidle >/dev/null; then
  echo "$(date '+%F %T') hide-cursor: swayidle saknas" >>"$LOG"
  exit 0
fi
if ! command -v wtype >/dev/null; then
  echo "$(date '+%F %T') hide-cursor: wtype saknas" >>"$LOG"
  exit 0
fi

exec -a vvk-hide-cursor swayidle -w \
  timeout "$IDLE" "wtype -M alt -M logo -P h -s 40 -m logo -m alt"
