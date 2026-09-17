#!/usr/bin/env bash
# Dump raw USB from the ESP32. Stoppar gym-helper så porten blir ledig.
set -euo pipefail

pkill -f gym-helper.py >/dev/null 2>&1 || true
sleep 0.6

PORT="$(ls /dev/serial/by-id/*CP2102* /dev/serial/by-id/*Silicon* /dev/ttyUSB0 2>/dev/null | head -n 1 || true)"
if [[ -z "${PORT}" ]]; then
  echo "Ingen USB-serial hittad."
  exit 1
fi

echo "Port: $PORT"
echo "Processer på porten:"
fuser -v "$PORT" 2>&1 || true
echo
echo "Dump 8 sekunder @ 115200. Du ska se CSI_BOOT / CSI_HEART / WIFI,..."
echo "-----"
stty -F "$PORT" 115200 cs8 -cstopb -parenb raw -echo -crtscts || true
timeout 8 cat "$PORT" || true
echo
echo "-----"
echo "Klar. Starta om gymskärmen så gym-helper tar porten igen."
