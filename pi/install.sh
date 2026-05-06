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
  labwc seatd wlr-randr wlopm brightnessctl \
  chromium \
  swayidle wtype \
  fonts-dejavu-core libgl1-mesa-dri xdg-user-dirs \
  nodejs npm \
  curl ca-certificates git

# 2. Configure HDMI timings for the Waveshare 7" 1080x1080 round display.
#    /boot/firmware/config.txt controls the Pi firmware display output.
#    hdmi_mode=87 + hdmi_timings defines the custom 1080x1080@60Hz signal;
#    without this the Pi won't drive the non-standard square panel correctly.
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

# 3. Build the app.
npm install
npm run build

# 4. Auto-login `pi` on tty1 (systemd getty drop-in).
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
EOF

# 5. Auto-launch labwc on tty1 login (idempotent — appended once).
LAUNCH_LINE='if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then exec labwc; fi'
grep -qxF "$LAUNCH_LINE" ~/.bash_profile 2>/dev/null || echo "$LAUNCH_LINE" >> ~/.bash_profile

# 6. Install kiosk autostart + keybinds.
mkdir -p ~/.config/labwc
install -m 0644 ~/vinyl/pi/autostart ~/.config/labwc/autostart
install -m 0644 ~/vinyl/pi/rc.xml    ~/.config/labwc/rc.xml

# 7. Install + enable the systemd unit (don't start yet — no tokens until auth).
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
