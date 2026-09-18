#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPLAY_SH="$SCRIPT_DIR/gym-display.sh"

chmod +x "$DISPLAY_SH" "$SCRIPT_DIR/gym-helper.py" "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/install-autostart.sh" "$SCRIPT_DIR/set-display-1080.sh" "$SCRIPT_DIR/set-hdmi-audio.sh" "$SCRIPT_DIR/chromium-fullscreen.py"

pkill -f vvk-hide-cursor >/dev/null 2>&1 || true

mkdir -p "$HOME/.config/autostart"
python3 - "$HOME/.config/autostart/gym-display.desktop" "$DISPLAY_SH" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
script = sys.argv[2]
path.write_text(
    "\n".join(
        [
            "[Desktop Entry]",
            "Type=Application",
            "Name=VVK gymskärm",
            f"Exec={script}",
            "X-GNOME-Autostart-enabled=true",
            "",
        ]
    ),
    encoding="utf-8",
)
PY

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
src = Path("/etc/xdg/labwc/rc.xml")
home.parent.mkdir(parents=True, exist_ok=True)
if not home.exists() and src.exists():
    home.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
if not home.exists():
    home.write_text('<?xml version="1.0"?>\n<labwc_config>\n</labwc_config>\n', encoding="utf-8")
text = home.read_text(encoding="utf-8")
text = re.sub(r'\s*<keybind key="A-W-h">[\s\S]*?</keybind>', "", text)
start = "<!-- VVK gymskärm -->"
end = "<!-- /VVK gymskärm -->"
if start in text and end in text:
    text = text[: text.find(start)] + text[text.find(end) + len(end) :]
if '<keybind key="F11">' not in text:
    f11 = """    <keybind key="F11">
      <action name="ToggleFullscreen"/>
    </keybind>
"""
    if "<keyboard>" in text:
        text = text.replace("<keyboard>", "<keyboard>\n" + f11, 1)
    elif "</labwc_config>" in text:
        text = text.replace(
            "</labwc_config>",
            "  <keyboard>\n" + f11 + "  </keyboard>\n</labwc_config>",
            1,
        )
block = f"""{start}
    <windowRule identifier="chromium*" matchOnce="true" serverDecoration="no">
      <action name="Maximize"/>
      <action name="ToggleFullscreen"/>
    </windowRule>
    <windowRule identifier="Chromium*" matchOnce="true" serverDecoration="no">
      <action name="Maximize"/>
      <action name="ToggleFullscreen"/>
    </windowRule>
    <windowRule identifier="org.chromium.Chromium*" matchOnce="true" serverDecoration="no">
      <action name="Maximize"/>
      <action name="ToggleFullscreen"/>
    </windowRule>
    {end}"""
if "<windowRules>" in text:
    text = text.replace("<windowRules>", "<windowRules>\n    " + block, 1)
elif "</labwc_config>" in text:
    text = text.replace(
        "</labwc_config>",
        "  <windowRules>\n    " + block + "\n  </windowRules>\n</labwc_config>",
        1,
    )
else:
    text += "\n<windowRules>\n    " + block + "\n</windowRules>\n"
home.write_text(text, encoding="utf-8")
PY

echo "Autostart är installerad för $(whoami)."
echo "  En startväg: $HOME/.config/labwc/autostart"
echo "  Autostart: labwc och ~/.config/autostart"
echo
echo "Starta om: sudo reboot"
echo "Logg: $HOME/.vvk-gym-display.log"
