#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
npm install
npm run build
sudo systemctl restart vinyl
pkill chromium || true
WAYLAND_SOCK=$(ls /run/user/1000/wayland-* 2>/dev/null | grep -v '\.lock' | head -1)
WAYLAND_DISPLAY=$(basename "$WAYLAND_SOCK") XDG_RUNTIME_DIR=/run/user/1000 \
  setsid bash "$(dirname "$0")/launch-browser.sh" </dev/null >/dev/null 2>&1 &
