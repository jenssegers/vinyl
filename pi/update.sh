#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Discard package-lock.json drift from any manual `npm install` run on this box, so the pull stays fast-forwardable.
git restore package-lock.json
git pull --ff-only

# `npm ci` over `npm install`: it wipes node_modules first, which avoids the ENOTEMPTY rename
# failures Debian's npm 9 hits when a dependency tree reshuffles, and it never rewrites the lockfile.
npm ci
npm run build
sudo systemctl restart vinyl
pkill chromium || true
WAYLAND_SOCK=$(ls /run/user/1000/wayland-* 2>/dev/null | grep -v '\.lock' | head -1)
WAYLAND_DISPLAY=$(basename "$WAYLAND_SOCK") XDG_RUNTIME_DIR=/run/user/1000 \
  setsid bash "$(dirname "$0")/launch-browser.sh" </dev/null >/dev/null 2>&1 &
