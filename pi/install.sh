#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${VVK_REPO_URL:-https://github.com/VKC276/ClimbTraining.git}"
DEST="${VVK_REPO_DIR:-$HOME/ClimbTraining}"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Kör installern som den vanliga Pi-användaren, inte som root."
  exit 1
fi

sudo_run() {
  if sudo -n true 2>/dev/null; then
    sudo "$@"
    return
  fi
  sudo "$@"
}

echo "Installerar gymskärmen..."
export DEBIAN_FRONTEND=noninteractive
sudo_run apt-get update -y
sudo_run apt-get \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  full-upgrade -y
sudo_run apt-get install -y git cec-utils python3 espeak-ng espeak-ng-data wlr-randr alsa-utils pulseaudio-utils locales
sudo_run apt-get install -y chromium || sudo_run apt-get install -y chromium-browser

if [[ -d "$DEST/.git" ]]; then
  git -C "$DEST" remote set-url origin "$REPO_URL"
  git -C "$DEST" fetch origin
  branch="$(git -C "$DEST" rev-parse --abbrev-ref origin/HEAD 2>/dev/null || true)"
  branch="${branch#origin/}"
  branch="${branch:-main}"
  git -C "$DEST" reset --hard "origin/$branch"
else
  git clone "$REPO_URL" "$DEST"
fi

chmod +x \
  "$DEST/pi/install.sh" \
  "$DEST/pi/install-autostart.sh" \
  "$DEST/pi/gym-display.sh" \
  "$DEST/pi/gym-helper.py" \
  "$DEST/pi/set-display-1080.sh" \
  "$DEST/pi/set-hdmi-audio.sh" \
  "$DEST/pi/chromium-fullscreen.py"

"$DEST/pi/install-autostart.sh"
"$DEST/pi/set-display-1080.sh" boot || true
"$DEST/pi/set-hdmi-audio.sh" || true

pkill -f gym-helper.py >/dev/null 2>&1 || true

if command -v timedatectl >/dev/null; then
  sudo_run timedatectl set-timezone Europe/Stockholm || true
fi
if command -v raspi-config >/dev/null; then
  sudo_run raspi-config nonint do_boot_behaviour B4 || true
  sudo_run raspi-config nonint do_blanking 1 || true
  sudo_run raspi-config nonint do_change_timezone Europe/Stockholm || true
  sudo_run raspi-config nonint do_change_locale sv_SE.UTF-8 || true
  sudo_run raspi-config nonint do_configure_keyboard se || true
  sudo_run raspi-config nonint do_wifi_country SE || true
fi
if [[ -f /etc/locale.gen ]] && ! grep -qE '^sv_SE\.UTF-8' /etc/locale.gen; then
  echo "sv_SE.UTF-8 UTF-8" | sudo_run tee -a /etc/locale.gen >/dev/null || true
fi
sudo_run locale-gen sv_SE.UTF-8 >/dev/null 2>&1 || sudo_run locale-gen || true
sudo_run update-locale LANG=sv_SE.UTF-8 LC_TIME=sv_SE.UTF-8 LANGUAGE=sv_SE:sv || true

echo
echo "Klart. Starta om skrivbordssessionen eller: sudo reboot"
echo "Gammal gym-helper stoppas; den nya startar med gymskärmen."
echo "Logg: $HOME/.vvk-gym-display.log"
