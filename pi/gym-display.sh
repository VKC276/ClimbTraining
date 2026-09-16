#!/usr/bin/env bash
set -euo pipefail

DISPLAY_URL="${VVK_DISPLAY_URL:-https://trainer.vastervikclimbing.se/display}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/gym-helper.py"

if ! command -v cec-client >/dev/null; then
  echo "Tips: sudo apt install cec-utils  (HDMI på/av till TV:n)"
fi

if ! pgrep -f "gym-helper.py" >/dev/null; then
  python3 "$HELPER" &
  sleep 0.4
fi

CHROMIUM="$(command -v chromium-browser || command -v chromium || true)"
if [[ -z "$CHROMIUM" ]]; then
  echo "Chromium saknas. Installera Raspberry Pi OS med skrivbord." >&2
  exit 1
fi

exec "$CHROMIUM" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --allow-running-insecure-content \
  "$DISPLAY_URL"
