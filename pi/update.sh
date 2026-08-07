#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir/.."

# Bash buffers this entire script before running it, so a pull that changes update.sh would
# otherwise not take effect until the next run. Pull, then re-exec the freshly pulled version.
if [[ -z "${VINYL_UPDATE_REEXECED:-}" ]]; then
  # Discard any package-lock.json drift on this box, so the pull stays fast-forwardable.
  git restore package-lock.json
  git pull --ff-only
  VINYL_UPDATE_REEXECED=1 exec bash "$script_dir/update.sh"
fi

npm install --no-save
npm run build
sudo systemctl restart vinyl
pkill chromium || true
WAYLAND_SOCK=$(ls /run/user/1000/wayland-* 2>/dev/null | grep -v '\.lock' | head -1)
WAYLAND_DISPLAY=$(basename "$WAYLAND_SOCK") XDG_RUNTIME_DIR=/run/user/1000 \
  setsid bash "$(dirname "$0")/launch-browser.sh" </dev/null >/dev/null 2>&1 &
