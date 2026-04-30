#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example and set SPOTIFY_CLIENT_ID first."
  exit 1
fi

# 1. apt packages (minimal Wayland kiosk stack + Node).
#    Trixie's apt nodejs is 20.19. Node 20 hit upstream EOL Apr 30 2026, but
#    the project's tsup build targets node20 and runs fine on it. Acceptable
#    for a private kiosk; swap in NodeSource setup_22.x if you want newer.
sudo apt-get update
sudo apt-get install --no-install-recommends -y \
  labwc seatd wlr-randr wlopm \
  chromium \
  swayidle wtype \
  fonts-dejavu-core libgl1-mesa-dri xdg-user-dirs \
  nodejs npm \
  curl ca-certificates git

# 2. Build the app.
npm install
npm run build

# 3. Auto-login `pi` on tty1 (systemd getty drop-in).
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
EOF

# 4. Auto-launch labwc on tty1 login (idempotent — appended once).
LAUNCH_LINE='if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then exec labwc; fi'
grep -qxF "$LAUNCH_LINE" ~/.bash_profile 2>/dev/null || echo "$LAUNCH_LINE" >> ~/.bash_profile

# 5. Install kiosk autostart + keybinds.
mkdir -p ~/.config/labwc
install -m 0644 ~/vinyl/pi/autostart ~/.config/labwc/autostart
install -m 0644 ~/vinyl/pi/rc.xml    ~/.config/labwc/rc.xml

# 6. Install + enable the systemd unit (don't start yet — no tokens until auth).
sudo install -m 0644 ~/vinyl/pi/vinyl.service /etc/systemd/system/vinyl.service
sudo systemctl daemon-reload
sudo systemctl enable vinyl.service

cat <<'MSG'

Install complete. Final steps:

  1. Authorize Spotify (one-time):
       From your laptop, reconnect via SSH with port forwarding:
         ssh -L 3001:127.0.0.1:3001 pi@<this-host>
       Then on the Pi:
         cd ~/vinyl && npm run setup:spotify
       Open the printed URL in your laptop browser, authorize, done.

  2. sudo reboot

MSG
