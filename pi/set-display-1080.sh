#!/usr/bin/env bash
# Gym-TV: 1920x1080 så gränssnittet inte blir pyttelitet på 4K.
set -euo pipefail

MODE="${1:-session}"

sudo_run() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return
  fi
  sudo "$@"
}

set_boot_mode() {
  local file=""
  if [[ -f /boot/firmware/cmdline.txt ]]; then
    file=/boot/firmware/cmdline.txt
  elif [[ -f /boot/cmdline.txt ]]; then
    file=/boot/cmdline.txt
  else
    echo "Ingen cmdline.txt — hoppar över kernel-läge."
    return 0
  fi
  local text
  text="$(sudo_run cat "$file")"
  text="${text%"${text##*[![:space:]]}"}"
  text="$(printf '%s' "$text" | sed -E 's/[[:space:]]*video=HDMI-A-[12]:[^[:space:]]*//g')"
  text="${text} video=HDMI-A-1:1920x1080@60"
  printf '%s\n' "$text" | sudo_run tee "$file" >/dev/null
  echo "Kernel HDMI-A-1 satt till 1920x1080 (gäller efter reboot)."
}

set_output_mode() {
  local out="$1"
  wlr-randr --output "$out" --on --mode 1920x1080 >/dev/null 2>&1 \
    || wlr-randr --output "$out" --on --mode 1920x1080@60.000000 >/dev/null 2>&1 \
    || wlr-randr --output "$out" --on --mode 1920x1080@50.000000 >/dev/null 2>&1 \
    || return 1
}

connected_hdmi() {
  local path name
  for path in /sys/class/drm/card*-HDMI-A-*/status; do
    [[ -e "$path" ]] || continue
    if [[ "$(cat "$path" 2>/dev/null || true)" == "connected" ]]; then
      name="$(basename "$(dirname "$path")")"
      echo "${name#card*-}" | sed 's/^card[0-9]*-//'
      return 0
    fi
  done
  return 1
}

set_session_mode() {
  if ! command -v wlr-randr >/dev/null; then
    echo "wlr-randr saknas"
    return 0
  fi
  local primary="" out
  primary="$(connected_hdmi || true)"
  if [[ -z "$primary" ]]; then
    primary="$(wlr-randr 2>/dev/null | awk '/^HDMI/ { print $1; exit }')"
  fi
  if [[ -z "$primary" ]]; then
    echo "ingen HDMI-utgång"
    return 0
  fi
  if set_output_mode "$primary"; then
    echo "skärm $primary → 1920x1080"
  elif command -v xrandr >/dev/null && xrandr --output "$primary" --mode 1920x1080 >/dev/null 2>&1; then
    echo "skärm $primary → 1920x1080 (xrandr)"
  else
    echo "kunde inte sätta 1920x1080 på $primary"
    return 0
  fi
  while read -r out; do
    [[ -z "$out" || "$out" == "$primary" ]] && continue
    wlr-randr --output "$out" --off >/dev/null 2>&1 || true
    echo "skärm $out av"
  done < <(wlr-randr 2>/dev/null | awk '/^[^[:space:]]/ { print $1 }')
}

if [[ "$MODE" == "boot" ]]; then
  set_boot_mode
  exit 0
fi

set_session_mode
