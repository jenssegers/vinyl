#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
npm install
npm run build
sudo systemctl restart vinyl
pkill chromium || true
WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 bash "$(dirname "$0")/launch-browser.sh" &
