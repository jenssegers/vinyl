#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# deploy.sh is a separate file, so it runs as freshly pulled.
git pull --ff-only
exec bash pi/deploy.sh
