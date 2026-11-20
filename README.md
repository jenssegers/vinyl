# vinyl

Spinning vinyl record display that mirrors whatever is playing on Spotify. Runs on a Raspberry Pi connected to a [Waveshare 7" 1080x1080 round HDMI display](https://www.waveshare.com/7inch-1080x1080-lcd.htm). Screen turns off automatically when nothing is playing. Touching the dark screen shows a kinetic clock in the style of ClockClock for 5 minutes.

## Touch

The panel is a touchscreen, and the record behaves like one you can put a hand on:

- **Tap** — pauses; tap again to resume.
- **Press and hold** — stopped for as long as your finger is down, spinning again the moment you lift off.
- **Turn** — drag around the record while holding it and it follows your finger; let go and it picks up from that angle.

Zoom is disabled entirely: there is no keyboard to undo an accidental pinch. Playback control needs a Spotify Premium account.

## Stack

- **Client**: Vite + React + TypeScript, in `client/`
- **Server**: Fastify on Node 24, in `server/`, which runs the TypeScript directly; polls Spotify every 2s and pushes state to the client over SSE
- **Shared**: the display state contract between both, in `shared/`
- **Screen control**: `wlr-randr` toggles the HDMI display on play/pause transitions

## Setup

```sh
cp .env.example .env
# fill in SPOTIFY_CLIENT_ID in .env

pnpm install
pnpm build              # builds the client; the server needs no build
pnpm setup:spotify      # one-time: opens browser to authorize Spotify
pnpm start
```

The server listens on port 3000. In production on the Pi, Chromium kiosk opens `http://127.0.0.1:3000`.

## Development

```sh
pnpm dev                # Vite on :5173 + Fastify on :3000, with HMR
pnpm test               # Vitest
pnpm typecheck          # tsc; Node strips types without checking them
pnpm lint               # Biome
```

Set `VINYL_FAKE_SCREEN=1` in `.env` to stub out `wlr-randr`, the backlight and the touch reader (useful on non-Pi machines; it is on by default off Linux).

## Pi deployment

Tested on Pi OS Trixie Lite (64-bit, headless). Run on the Pi itself, as user `pi` with the repo in `~/vinyl`: the scripts and systemd unit assume both.

### Install

```sh
git clone <this-repo> ~/vinyl
cd ~/vinyl
cp .env.example .env       # edit SPOTIFY_CLIENT_ID
./pi/install.sh
```

The script installs apt dependencies and Node 24, configures auto-login + labwc + Chromium kiosk autostart, then runs `pi/deploy.sh`, which installs pnpm and the dependencies, builds the client, and (re)starts the systemd service.

### Authorize Spotify (one-time)

From your laptop, reconnect via SSH with port forwarding so the OAuth callback can reach the Pi:

```sh
ssh -L 3001:127.0.0.1:3001 pi@<host>
```

Then on the Pi:

```sh
cd ~/vinyl && pnpm setup:spotify
```

The script prints an authorization URL. Open it in your laptop browser, authorize, and the callback flows back through the SSH tunnel to the Pi where tokens are written to `~/.config/vinyl/tokens.json`.

Refreshing a token cannot widen its scopes, so whenever the app asks for a new one you have to `rm ~/.config/vinyl/tokens.json` and repeat this step.

```sh
sudo reboot
```

After reboot, labwc launches on tty1, the Fastify server starts via systemd, and Chromium opens fullscreen showing the now-playing display.

### Update

```sh
./pi/update.sh
```

Pulls, then runs `pi/deploy.sh`. The kiosk page reloads by itself once the restarted server is back.

### Logs

```sh
journalctl -u vinyl -f
```
