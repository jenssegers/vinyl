#!/usr/bin/env bash
# Installs dependencies, builds the client and restarts the server. Run by install.sh and update.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

# pnpm's standalone installer needs no global npm install, and adds these PATH lines to ~/.bashrc
# for interactive shells: https://pnpm.io/installation#using-a-standalone-script
# Any pnpm will do: it switches itself to the exact version in package.json's `packageManager`.
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME/bin:$PATH"
if ! command -v pnpm >/dev/null; then
  curl -fsSL https://get.pnpm.io/install.sh | sh -
fi

# `--frozen-lockfile` fails rather than rewrite the lockfile, so `git pull --ff-only` stays clean.
pnpm install --frozen-lockfile
pnpm build

# Reinstall the unit every time, so changes to it apply on the next update.
# The open kiosk page reloads by itself once the restarted server is back.
sudo install -m 0644 pi/vinyl.service /etc/systemd/system/vinyl.service
sudo systemctl daemon-reload
sudo systemctl enable vinyl.service
sudo systemctl restart vinyl.service
