# Project context

Vinyl is a Spotify "now playing" display that runs as a kiosk on a Raspberry Pi.

## Hardware

- **Pi OS Trixie** (Wayland, labwc compositor)
- **Display**: [Waveshare 7" 1080x1080 round HDMI](https://docs.waveshare.com/7inch_1080x1080_LCD) — `HDMI-A-1` in wlr-randr; brightness controlled via `brightnessctl set <value>%` (exposes `/sys/class/backlight/`)
- **Screen control**: `wlr-randr --output HDMI-A-1 --on/--off`
  - Must set `WAYLAND_DISPLAY=wayland-1` and `XDG_RUNTIME_DIR=/run/user/1000` when invoking from systemd (outside the desktop session)
  - On non-Linux or with `VINYL_FAKE_SCREEN=1`, `screen.ts` logs instead of shelling out
- **Kiosk**: Chromium opens `http://127.0.0.1:3000` full-screen via labwc autostart

## Architecture

Single Node process in production: Fastify serves the built React SPA (`client/dist/`) and the API on port 3000.

```
client/   Vite + React SPA
server/   Fastify backend
```

State flows one way: Fastify polls Spotify every 2s → pushes `Display` state over SSE (`/events`) → React renders.

## Display state machine

```
playing → paused → [VINYL_PAUSE_TO_OFF_MS, default 60s] → off
```

- `playing`: screen on, record spins
- `paused`: screen stays on, record stops, pause timer starts
- `off`: screen blanked via wlr-randr
- Resuming from `paused` cancels the timer (no screen toggle)
- Resuming from `off` turns the screen back on

## Spotify auth

PKCE flow, one-time setup. Refresh token persisted to `~/.config/vinyl/tokens.json`. Re-run `npm run setup:spotify` only if tokens are deleted.

## Key env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `SPOTIFY_CLIENT_ID` | — | Required |
| `PORT` | `3000` | Server port |
| `SPOTIFY_SETUP_PORT` | `3001` | Port for the one-time OAuth callback server (must not equal `PORT`) |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:3001/auth/callback` | Must match Spotify app dashboard |
| `VINYL_PAUSE_TO_OFF_MS` | `60000` | Pause-to-screen-off delay |
| `VINYL_FAKE_SCREEN` | auto | Set `1` to stub wlr-randr |
| `VINYL_TOKENS_PATH` | `~/.config/vinyl/tokens.json` | Token storage |
| `VINYL_ALLOWED_DEVICES` | (unset = allow all) | Comma-separated Spotify device names or IDs. Only playback on these devices toggles the screen. |
