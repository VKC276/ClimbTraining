#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPLAY_SH="$SCRIPT_DIR/gym-display.sh"
LINE="$DISPLAY_SH &"

chmod +x "$DISPLAY_SH" "$SCRIPT_DIR/gym-helper.py" "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/install-autostart.sh" "$SCRIPT_DIR/chromium-fullscreen.py"

rm -f "$HOME/.config/autostart/gym-display.desktop"

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
python3 - "$HOME/.config/labwc/autostart" "$LINE" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
line = sys.argv[2]
text = path.read_text(encoding="utf-8")
kept = [
    row
    for row in text.splitlines()
    if "gym-display.sh" not in row and row.strip() != "# VVK gymskärm"
]
kept.append("# VVK gymskärm")
kept.append(line)
path.write_text("\n".join(kept).rstrip() + "\n", encoding="utf-8")
PY

python3 - <<'PY'
from pathlib import Path
import shutil

home = Path.home() / ".config/labwc/rc.xml"
sys_rc = Path("/etc/xdg/labwc/rc.xml")
if not home.exists() and sys_rc.exists():
    shutil.copy(sys_rc, home)
if not home.exists():
    home.write_text(
        '<?xml version="1.0"?>\n<labwc_config>\n  <keyboard>\n  </keyboard>\n</labwc_config>\n',
        encoding="utf-8",
    )
text = home.read_text(encoding="utf-8")
if "HideCursor" in text:
    raise SystemExit(0)
bind = """    <keybind key="A-W-h">
      <action name="HideCursor" />
      <action name="WarpCursor" x="-1" y="-1" />
    </keybind>
"""
if "<keyboard>" in text:
    text = text.replace("<keyboard>", "<keyboard>\n" + bind, 1)
elif "<keyboard " in text:
    import re
    text = re.sub(r"(<keyboard\b[^>]*>)", r"\1\n" + bind, text, count=1)
else:
    text = text.replace("</labwc_config>", f"  <keyboard>\n{bind}  </keyboard>\n</labwc_config>")
    if "</openbox_config>" in text and "<keyboard>" not in text:
        text = text.replace("</openbox_config>", f"  <keyboard>\n{bind}  </keyboard>\n</openbox_config>")
home.write_text(text, encoding="utf-8")
PY

echo "Autostart är installerad för $(whoami)."
echo "  En startväg: $HOME/.config/labwc/autostart"
echo "  XDG- och Wayfire-dubbletter tas bort."
echo
echo "Starta om: sudo reboot"
echo "Logg: $HOME/.vvk-gym-display.log"
