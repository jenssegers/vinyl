import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { config } from './config';

let lastState: 'on' | 'off' | null = null;

// Detect at call time so a compositor that starts after vinyl is still found.
// Verify the env-provided value first — systemd may have a stale hardcoded name.
function resolveWaylandDisplay(): string {
  const { xdgRuntimeDir } = config;
  const envValue = process.env.WAYLAND_DISPLAY;
  if (envValue) {
    try { fs.statSync(path.join(xdgRuntimeDir, envValue)); return envValue; } catch { /* doesn't exist */ }
  }
  try {
    const socket = fs.readdirSync(xdgRuntimeDir).find((e) => /^wayland-\d+$/.test(e));
    if (socket) return socket;
  } catch { /* runtime dir inaccessible */ }
  return 'wayland-1';
}

export function setScreen(state: 'on' | 'off'): void {
  if (state === lastState) return;
  lastState = state;

  if (config.fakeScreen) { console.log(`[screen] ${state}`); return; }

  const { xdgRuntimeDir } = config;
  const waylandDisplay = resolveWaylandDisplay();
  console.log(`[screen] -> ${state} (WAYLAND_DISPLAY=${waylandDisplay}, XDG_RUNTIME_DIR=${xdgRuntimeDir})`);

  const env = { ...process.env, WAYLAND_DISPLAY: waylandDisplay, XDG_RUNTIME_DIR: xdgRuntimeDir };
  execa('wlr-randr', ['--output', 'HDMI-A-1', state === 'on' ? '--on' : '--off'], { env })
    .then(() => console.log(`[screen] ${state} ok`))
    .catch((err: Error) => console.error(`[screen] ${state} failed:`, err.message));
}
