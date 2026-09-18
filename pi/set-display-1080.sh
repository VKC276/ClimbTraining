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
  text="${text} video=HDMI-A-1:1920x1080@60D video=HDMI-A-2:1920x1080@60D"
  printf '%s\n' "$text" | sudo_run tee "$file" >/dev/null
  echo "Kernel HDMI satt till 1920x1080 (gäller efter reboot)."
}

set_output_mode() {
  local out="$1"
  wlr-randr --output "$out" --on --mode 1920x1080 >/dev/null 2>&1 \
    || wlr-randr --output "$out" --on --mode 1920x1080@60.000000 >/dev/null 2>&1 \
    || wlr-randr --output "$out" --on --mode 1920x1080@50.000000 >/dev/null 2>&1 \
    || return 1
}

set_session_mode() {
  if ! command -v wlr-randr >/dev/null; then
    echo "wlr-randr saknas"
    return 0
  fi
  local out ok=0
  while read -r out; do
    [[ -z "$out" ]] && continue
    if set_output_mode "$out"; then
      echo "skärm $out → 1920x1080"
      ok=1
    fi
  done < <(wlr-randr 2>/dev/null | awk '/^[^[:space:]]/ { print $1 }')
  if [[ "$ok" -eq 0 ]] && command -v xrandr >/dev/null; then
    for out in HDMI-1 HDMI-2 HDMI-A-1 HDMI-A-2 HDMI-0; do
      if xrandr --output "$out" --mode 1920x1080 >/dev/null 2>&1; then
        echo "skärm $out → 1920x1080 (xrandr)"
        ok=1
        break
      fi
    done
  fi
  if [[ "$ok" -eq 0 ]]; then
    echo "kunde inte sätta 1920x1080 just nu"
  fi
}

if [[ "$MODE" == "boot" ]]; then
  set_boot_mode
  exit 0
fi

set_session_mode
