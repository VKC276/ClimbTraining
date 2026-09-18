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
sudo_run apt-get update -y
sudo_run apt-get install -y git cec-utils python3 espeak-ng espeak-ng-data
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  sudo_run apt-get install -y chromium || sudo_run apt-get install -y chromium-browser
fi

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
  "$DEST/pi/chromium-fullscreen.py"

"$DEST/pi/install-autostart.sh"

pkill -f gym-helper.py >/dev/null 2>&1 || true

if command -v timedatectl >/dev/null; then
  sudo_run timedatectl set-timezone Europe/Stockholm || true
fi
if command -v raspi-config >/dev/null; then
  sudo_run raspi-config nonint do_boot_behaviour B4 || true
fi

echo
echo "Klart. Starta om skrivbordssessionen eller: sudo reboot"
echo "Gammal gym-helper stoppas; den nya startar med gymskärmen."
echo "Logg: $HOME/.vvk-gym-display.log"
