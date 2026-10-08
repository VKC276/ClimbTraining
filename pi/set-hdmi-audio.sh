#!/usr/bin/env bash
# Gym-TV: ljud via HDMI, inte 3,5 mm, volym 100 %.
set -euo pipefail

hdmi_pactl_sink() {
  command -v pactl >/dev/null || return 1
  pactl list short sinks 2>/dev/null | awk '
    BEGIN { IGNORECASE = 1 }
    $2 ~ /hdmi|vc4/ && $2 !~ /headphone|headphones|analog/ { print $2; found = 1; exit }
    END { exit found ? 0 : 1 }
  '
}

hdmi_wpctl_id() {
  command -v wpctl >/dev/null || return 1
  wpctl status 2>/dev/null | awk '
    BEGIN { IGNORECASE = 1 }
    /Sinks:/{ s = 1; next }
    s && /Sources:/{ exit }
    s && /HDMI/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^[0-9]+\.?$/) {
          gsub(/\./, "", $i)
          print $i
          exit
        }
      }
    }
  '
}

if command -v amixer >/dev/null; then
  amixer -q cset numid=3 2 >/dev/null 2>&1 || true
  for control in HDMI PCM Master Digital; do
    amixer -q sset "$control" 100% unmute >/dev/null 2>&1 || true
  done
fi

SINK="$(hdmi_pactl_sink || true)"
if command -v pactl >/dev/null; then
  if [[ -n "${SINK:-}" ]]; then
    pactl set-default-sink "$SINK" >/dev/null 2>&1 || true
    pactl set-sink-mute "$SINK" 0 >/dev/null 2>&1 || true
    pactl set-sink-volume "$SINK" 100% >/dev/null 2>&1 || true
    pactl list short sink-inputs 2>/dev/null | awk '{ print $1 }' | while read -r id; do
      [[ -z "$id" ]] && continue
      pactl move-sink-input "$id" "$SINK" >/dev/null 2>&1 || true
      pactl set-sink-input-mute "$id" 0 >/dev/null 2>&1 || true
      pactl set-sink-input-volume "$id" 100% >/dev/null 2>&1 || true
    done
    echo "ljud HDMI $SINK 100%"
  else
    echo "ingen HDMI-sink än"
  fi
fi

WP_ID="$(hdmi_wpctl_id || true)"
if command -v wpctl >/dev/null; then
  if [[ -n "${WP_ID:-}" ]]; then
    wpctl set-default "$WP_ID" >/dev/null 2>&1 || true
  fi
  wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 >/dev/null 2>&1 || true
  wpctl set-volume @DEFAULT_AUDIO_SINK@ 1.0 >/dev/null 2>&1 || true
fi
