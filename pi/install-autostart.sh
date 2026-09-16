#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPLAY_SH="$SCRIPT_DIR/gym-display.sh"

chmod +x "$DISPLAY_SH" "$SCRIPT_DIR/gym-helper.py" "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/install-autostart.sh" "$SCRIPT_DIR/chromium-fullscreen.py"

rm -f "$HOME/.config/autostart/gym-display.desktop"
pkill -f vvk-hide-cursor >/dev/null 2>&1 || true

if [[ -f "$HOME/.config/wayfire.ini" ]]; then
  python3 - "$HOME/.config/wayfire.ini" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
cleaned = re.sub(r"(?m)^gym\s*=\s*.*gym-display\.sh.*\n?", "", text)
if cleaned != text:
    path.write_text(cleaned, encoding="utf-8")
PY
fi

mkdir -p "$HOME/.config/labwc"
if [[ ! -f "$HOME/.config/labwc/autostart" && -f /etc/xdg/labwc/autostart ]]; then
  cp /etc/xdg/labwc/autostart "$HOME/.config/labwc/autostart"
fi
touch "$HOME/.config/labwc/autostart"
python3 - "$HOME/.config/labwc/autostart" "$DISPLAY_SH" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
display = sys.argv[2] + " &"
text = path.read_text(encoding="utf-8")
kept = [
    row
    for row in text.splitlines()
    if "gym-display.sh" not in row
    and "hide-cursor.sh" not in row
    and row.strip() != "# VVK gymskärm"
]
kept.append("# VVK gymskärm")
kept.append(display)
path.write_text("\n".join(kept).rstrip() + "\n", encoding="utf-8")
PY

python3 - <<'PY'
from pathlib import Path
import re

home = Path.home() / ".config/labwc/rc.xml"
if not home.exists():
    raise SystemExit(0)
text = home.read_text(encoding="utf-8")
new = re.sub(r'\s*<keybind key="A-W-h">[\s\S]*?</keybind>', "", text)
if new != text:
    home.write_text(new, encoding="utf-8")
PY

echo "Autostart är installerad för $(whoami)."
echo "  En startväg: $HOME/.config/labwc/autostart"
echo "  XDG- och Wayfire-dubbletter tas bort."
echo
echo "Starta om: sudo reboot"
echo "Logg: $HOME/.vvk-gym-display.log"
