import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { consola } from 'consola';
import { config } from './config.ts';

/** The Waveshare panel's output name in `wlr-randr`. */
const OUTPUT_NAME = 'HDMI-A-1';

/**
 * The panel is mounted upside down, so the output is rotated 180°. A disabled output reports no
 * transform over wlr-output-management, so `wlr-randr --on` would bring it back unrotated: set it
 * with every `--on`. Touch is flipped to match in labwc's `rc.xml`.
 */
const OUTPUT_TRANSFORM = '180';

/** labwc's usual socket, for when no socket can be found yet. */
const DEFAULT_WAYLAND_DISPLAY = 'wayland-1';

export type ScreenState = 'on' | 'off';

const exec = promisify(execFile);
const log = consola.withTag('screen');

let lastState: ScreenState | null = null;

// Detect at call time so a compositor that starts after vinyl is still found.
// Verify the env-provided value first: systemd may have a stale hardcoded name.
function resolveWaylandDisplay(): string {
  const { waylandDisplay, xdgRuntimeDir } = config;
  if (waylandDisplay && fs.existsSync(path.join(xdgRuntimeDir, waylandDisplay))) {
    return waylandDisplay;
  }

  try {
    const socket = fs.readdirSync(xdgRuntimeDir).find((entry) => /^wayland-\d+$/.test(entry));
    if (socket) return socket;
  } catch {
    // Runtime dir not readable: fall back to the default.
  }
  return DEFAULT_WAYLAND_DISPLAY;
}

export function setScreen(state: ScreenState): void {
  if (state === lastState) return;

  // Off the Pi there is no panel to switch.
  if (config.fakeScreen) {
    lastState = state;
    return;
  }

  const waylandDisplay = resolveWaylandDisplay();
  log.info(`turning ${state} (${waylandDisplay})`);

  const env = {
    ...process.env,
    WAYLAND_DISPLAY: waylandDisplay,
    XDG_RUNTIME_DIR: config.xdgRuntimeDir,
  };
  const args = state === 'on' ? ['--on', '--transform', OUTPUT_TRANSFORM] : ['--off'];
  exec('wlr-randr', ['--output', OUTPUT_NAME, ...args], { env })
    .then(() => {
      lastState = state;
      log.success(`${state} ok`);
    })
    .catch((error: unknown) => log.error(error, `screen ${state} failed`));
}
