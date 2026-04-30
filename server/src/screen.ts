import { execa } from 'execa';
import { config } from './config';

let lastState: 'on' | 'off' | null = null;

export function setScreen(state: 'on' | 'off'): void {
  if (state === lastState) return;
  lastState = state;

  if (config.fakeScreen) { console.log(`[screen] ${state}`); return; }

  const { waylandDisplay, xdgRuntimeDir } = config;
  console.log(`[screen] -> ${state} (WAYLAND_DISPLAY=${waylandDisplay}, XDG_RUNTIME_DIR=${xdgRuntimeDir})`);

  const env = { ...process.env, WAYLAND_DISPLAY: waylandDisplay, XDG_RUNTIME_DIR: xdgRuntimeDir };
  execa('wlr-randr', ['--output', 'HDMI-A-1', state === 'on' ? '--on' : '--off'], { env })
    .then(() => console.log(`[screen] ${state} ok`))
    .catch((err: Error) => console.error(`[screen] ${state} failed:`, err.message));
}
