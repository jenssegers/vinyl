# vinyl

Spinning vinyl record display that mirrors whatever is playing on Spotify. Runs on a Raspberry Pi connected to a [Waveshare 7" 1080x1080 round HDMI display](https://www.waveshare.com/7inch-1080x1080-lcd.htm). Screen turns off automatically when nothing is playing.

## Stack

- **Client** — Vite + React + TypeScript, served from `client/`
- **Server** — Fastify (Node.js), served from `server/`; polls Spotify every 2s and pushes state to the client over SSE
- **Screen control** — `wlr-randr` toggles the HDMI display on play/pause transitions

## Setup

```sh
cp .env.example .env
# fill in SPOTIFY_CLIENT_ID in .env

npm install
npm run build
npm run setup:spotify   # one-time: opens browser to authorize Spotify
npm start
```

The server listens on port 3000. In production on the Pi, Chromium kiosk opens `http://127.0.0.1:3000`.

## Development

```sh
npm run dev             # Vite on :5173 + Fastify on :3000, with HMR
```

Set `VINYL_FAKE_SCREEN=1` in `.env` to stub out `wlr-randr` (logs instead of shelling out — useful on non-Pi machines).

## Pi deployment

Tested on Pi OS Trixie Lite (64-bit, headless). Run on the Pi itself — no dev machine required.

### Install

```sh
git clone <this-repo> ~/vinyl
cd ~/vinyl
cp .env.example .env       # edit SPOTIFY_CLIENT_ID
./pi/install.sh
```

The script installs apt dependencies, builds the app, configures auto-login + labwc + Chromium kiosk autostart, and enables the systemd service.

### Authorize Spotify (one-time)

From your laptop, reconnect via SSH with port forwarding so the OAuth callback can reach the Pi:

```sh
ssh -L 3001:127.0.0.1:3001 pi@<host>
```

Then on the Pi:

```sh
cd ~/vinyl && npm run setup:spotify
```

The script prints an authorization URL. Open it in your laptop browser, authorize, and the callback flows back through the SSH tunnel to the Pi where tokens are written to `~/.config/vinyl/tokens.json`.

```sh
sudo reboot
```

After reboot, labwc launches on tty1, the Fastify server starts via systemd, and Chromium opens fullscreen showing the now-playing display.

### Update

```sh
./pi/update.sh
```

Runs `git pull && npm install && npm run build && sudo systemctl restart vinyl`.

### Logs

```sh
journalctl -u vinyl -f
```
