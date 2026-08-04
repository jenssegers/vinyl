#!/usr/bin/env bash
# Wait for Fastify to be up, then open Chromium in kiosk mode.
while ! curl -fs http://127.0.0.1:3000 >/dev/null; do sleep 0.5; done
exec chromium \
  --kiosk \
  --ozone-platform=wayland \
  --no-first-run \
  --noerrdialogs \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-pinch \
  --force-device-scale-factor=1 \
  --password-store=basic \
  --disable-background-networking \
  --disable-sync \
  --disable-breakpad \
  --disable-client-side-phishing-detection \
  --disable-default-apps \
  --disable-extensions \
  --no-pings \
  --renderer-process-limit=1 \
  --user-data-dir=/tmp/vinyl-chromium-profile \
  --disk-cache-dir=/tmp/vinyl-chromium-cache \
  --window-size=1080,1080 \
  --window-position=0,0 \
  http://127.0.0.1:3000
