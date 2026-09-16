#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPLAY_SH="$SCRIPT_DIR/gym-display.sh"
LINE="$DISPLAY_SH &"

chmod +x "$DISPLAY_SH" "$SCRIPT_DIR/gym-helper.py" "$SCRIPT_DIR/install-autostart.sh"

mkdir -p "$HOME/.config/labwc"
if [[ ! -f "$HOME/.config/labwc/autostart" && -f /etc/xdg/labwc/autostart ]]; then
  cp /etc/xdg/labwc/autostart "$HOME/.config/labwc/autostart"
fi
touch "$HOME/.config/labwc/autostart"
if ! grep -Fqs "gym-display.sh" "$HOME/.config/labwc/autostart"; then
  printf '\n# VVK gymskärm\n%s\n' "$LINE" >> "$HOME/.config/labwc/autostart"
fi

mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/gym-display.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Gymskärm
Exec=$DISPLAY_SH
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

if [[ -f "$HOME/.config/wayfire.ini" ]] && ! grep -Fqs "gym-display.sh" "$HOME/.config/wayfire.ini"; then
  if ! grep -qs '^\[autostart\]' "$HOME/.config/wayfire.ini"; then
    printf '\n[autostart]\n' >> "$HOME/.config/wayfire.ini"
  fi
  printf 'gym = %s\n' "$DISPLAY_SH" >> "$HOME/.config/wayfire.ini"
fi

echo "Autostart är installerad för $(whoami)."
echo "  labwc:  $HOME/.config/labwc/autostart"
echo "  XDG:    $HOME/.config/autostart/gym-display.desktop"
echo
echo "Kräver automatisk inloggning till skrivbordet:"
echo "  sudo raspi-config"
echo "  System Options → Boot / Auto Login → Desktop autologin"
echo
echo "Starta om: sudo reboot"
echo "Logg: $HOME/.vvk-gym-display.log"
