#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env: copy .env.example and set SPOTIFY_CLIENT_ID first."
  exit 1
fi

# Minimal Wayland kiosk stack.
sudo apt-get update
sudo apt-get install --no-install-recommends -y \
  labwc seatd wlr-randr \
  chromium \
  swayidle wtype \
  fonts-dejavu-core libgl1-mesa-dri xdg-user-dirs \
  curl ca-certificates gnupg git

# Node 24 from NodeSource, not apt.
# The server runs its TypeScript through Node's type stripping, which needs Node 22.18+, and
# Trixie ships nodejs 20.19 (EOL Apr 30 2026). Node 24 is supported until Apr 2028.
# NodeSource's nodejs bundles npm and conflicts with Debian's separate npm package.
if ! node --version 2>/dev/null | grep -q '^v24\.'; then
  sudo apt-get remove -y npm || true
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# HDMI timings for the Waveshare 7" 1080x1080 round display: hdmi_mode=87 + hdmi_timings define
# the custom 1080x1080@60Hz signal.
# Known limitation: the Raspberry Pi docs list these as legacy options that Bookworm and later
# ignore (https://www.raspberrypi.com/documentation/computers/legacy_config_txt.html), so the
# panel likely runs on its EDID. Untested without them; under KMS the supported way to force the
# mode is `video=HDMI-A-1:1080x1080M@60` in cmdline.txt.
CONFIG=/boot/firmware/config.txt
if ! grep -q 'hdmi_mode=87' "$CONFIG"; then
  sudo tee -a "$CONFIG" >/dev/null <<'EOF'

# Waveshare 7" 1080x1080 round HDMI display
hdmi_force_hotplug=1
hdmi_group=2
hdmi_mode=87
hdmi_pixel_freq_limit=200000000
hdmi_timings=1080 0 80 20 80 1080 0 10 10 14 0 0 0 60 0 84210000 0
EOF
  echo "HDMI timings added to $CONFIG"
else
  echo "HDMI timings already present in $CONFIG, skipping"
fi

# Console autologin on tty1, through Raspberry Pi's own config tool.
sudo raspi-config nonint do_boot_behaviour B2

# Launch labwc on tty1 login (appended once).
LAUNCH_LINE='if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then exec labwc; fi'
grep -qxF "$LAUNCH_LINE" ~/.bash_profile 2>/dev/null || echo "$LAUNCH_LINE" >> ~/.bash_profile

# Kiosk autostart and keybinds.
mkdir -p ~/.config/labwc
install -m 0644 pi/autostart ~/.config/labwc/autostart
install -m 0644 pi/rc.xml ~/.config/labwc/rc.xml

# Build and start the server. Until Spotify is connected it serves the page and waits.
bash pi/deploy.sh

cat <<'MSG'

Install complete. Final steps:

  1. Authorize Spotify (one-time):
       From your laptop, reconnect via SSH with port forwarding:
         ssh -L 3001:127.0.0.1:3001 pi@<this-host>
       Then on the Pi:
         cd ~/vinyl && pnpm setup:spotify
       Open the printed URL in your laptop browser, authorize, done.

  2. sudo reboot

MSG
