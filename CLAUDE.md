# Project context

Vinyl is a Spotify "now playing" display that runs as a kiosk on a Raspberry Pi.

## Hardware

- **Pi OS Trixie** (Wayland, labwc compositor)
- **Display**: [Waveshare 7" 1080x1080 round HDMI](https://docs.waveshare.com/7inch_1080x1080_LCD): `HDMI-A-1` in wlr-randr
- **Screen control**: `wlr-randr --output HDMI-A-1 --on/--off`
  - Must set `WAYLAND_DISPLAY=wayland-1` and `XDG_RUNTIME_DIR=/run/user/1000` when invoking from systemd (outside the desktop session)
  - On non-Linux or with `VINYL_FAKE_SCREEN=1`, `screen.ts` logs instead of shelling out
- **Backlight**: no DDC/CI. The panel takes a USB HID report (USB `0712:000a`, the touch cable) that the server writes to its `/dev/hidrawN`. Waveshare's own script detaches the kernel driver instead, which would cut off touch. A udev rule from `install.sh` lets the `pi` user write it without root. Dimmed after sunset, from `VINYL_LATITUDE`/`VINYL_LONGITUDE`.
- **Kiosk**: Chromium opens `http://127.0.0.1:3000` full-screen via labwc autostart

## Architecture

Single Node process in production: Fastify serves the built React SPA (`client/dist/`) and the API on port 3000.

```
client/   Vite + React SPA
server/   Fastify backend, run by Node's built-in type stripping (no server build step)
shared/   The Display contract: zod schemas both sides parse with
```

State flows one way: Fastify polls Spotify every 2s → pushes `Display` state over SSE (`/events`) → React renders. The one exception is touch: the client `POST`s to `/api/playback/:command`, and the server re-polls early (`poller.refreshSoon()`) so the pushed state catches up.

## Touch

Zoom is disabled in three places: the viewport meta tag, `touch-action: none` in `index.css`, and `--disable-pinch` in the Chromium kiosk args. The flag is the load-bearing one: desktop Chromium treats pinch as browser page zoom, which the meta tag does not govern.

`useRecordGestures`: press pauses, dragging turns the record under the finger, and release resumes unless it was a tap on a playing record (under 400ms and under 4° of turn). A Spotify round trip takes ~300ms, so the hook renders an optimistic playing state until the poller reports the same thing (or 5s pass, or the command fails).

The rotation is a Web Animations API animation rather than a CSS keyframe, because dragging scrubs `currentTime` to follow the finger and playback has to resume from that angle. `SPIN_MS` is therefore both the duration of one turn and the scale factor between angle and time.

## Display state machine

Four states that mirror the Spotify response directly:

- `playing`: screen on, record spins
- `paused`: screen on, record frozen with the current track. Transitions to `off` after `VINYL_PAUSE_TO_OFF_MS` (default 10s), checked on each poll, so up to one poll interval late
- `off`: screen blanked via wlr-randr (Spotify 204, non-allowed device, or pause timeout)
- `error`: screen on, empty Beogram-style platter with the error message (3+ consecutive Spotify failures). Polling backs off exponentially up to 60s while in this state.

## Spotify auth

PKCE flow, one-time setup. Refresh token persisted to `~/.config/vinyl/tokens.json`. Re-run `pnpm setup:spotify` only if tokens are deleted.

Scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-modify-playback-state`. A refresh grant cannot widen scopes, so adding one means deleting `tokens.json` and re-running setup on the Pi. Control endpoints need Spotify Premium.

## Key env vars

| Var                      | Default                               | Purpose                                                                                                                |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`      | none                                  | Required                                                                                                               |
| `PORT`                   | `3000`                                | Server port                                                                                                            |
| `SPOTIFY_SETUP_PORT`     | `3001`                                | Port for the one-time OAuth callback server (must not equal `PORT`)                                                    |
| `SPOTIFY_REDIRECT_URI`   | `http://127.0.0.1:3001/auth/callback` | Must match Spotify app dashboard                                                                                       |
| `VINYL_PAUSE_TO_OFF_MS`  | `10000`                               | Pause-to-screen-off delay (ms)                                                                                         |
| `VINYL_FAKE_SCREEN`      | auto                                  | Set `1` to stub wlr-randr and the backlight                                                                            |
| `VINYL_LATITUDE`         | `50.94` (Bavegem, Belgium)            | Location for sunset and sunrise, with `VINYL_LONGITUDE`                                                                |
| `VINYL_LONGITUDE`        | `3.87` (Bavegem, Belgium)             | See `VINYL_LATITUDE`                                                                                                   |
| `VINYL_DAY_BRIGHTNESS`   | `25`                                  | Backlight percent while the sun is up                                                                                  |
| `VINYL_NIGHT_BRIGHTNESS` | `10`                                  | Backlight percent after sunset                                                                                         |
| `VINYL_TOKENS_PATH`      | `~/.config/vinyl/tokens.json`         | Token storage                                                                                                          |
| `VINYL_ALLOWED_DEVICES`  | (unset = allow all)                   | Comma-separated case-insensitive substrings matched against Spotify device names or IDs. e.g. `arc` matches `Arc + 1`. |
