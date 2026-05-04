import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { consola } from 'consola';
import { config } from './config';

const exec = promisify(execFile);
const log = consola.withTag('screen');

let lastState: 'on' | 'off' | null = null;

// Detect at call time so a compositor that starts after vinyl is still found.
// Verify the env-provided value first — systemd may have a stale hardcoded name.
function resolveWaylandDisplay(): string {
  const { xdgRuntimeDir } = config;
  const envValue = process.env.WAYLAND_DISPLAY;
  if (envValue) {
    try {
      fs.statSync(path.join(xdgRuntimeDir, envValue));
      return envValue;
    } catch {
      /* doesn't exist */
    }
  }
  try {
    const socket = fs.readdirSync(xdgRuntimeDir).find((e) => /^wayland-\d+$/.test(e));
    if (socket) return socket;
  } catch {
    /* runtime dir inaccessible */
  }
  return 'wayland-1';
}

export function setScreen(state: 'on' | 'off'): void {
  if (state === lastState) return;

  if (config.fakeScreen) {
    lastState = state;
    log.info(state);
    return;
  }

  const { xdgRuntimeDir } = config;
  const waylandDisplay = resolveWaylandDisplay();
  log.info(`turning ${state} (${waylandDisplay})`);

  const env = { ...process.env, WAYLAND_DISPLAY: waylandDisplay, XDG_RUNTIME_DIR: xdgRuntimeDir };
  exec('wlr-randr', ['--output', 'HDMI-A-1', state === 'on' ? '--on' : '--off'], { env })
    .then(() => {
      lastState = state;
      log.success(`${state} ok`);
    })
    .catch((err: Error) => log.error(`${state} failed: ${err.message}`));
}
