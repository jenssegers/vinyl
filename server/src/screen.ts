import { spawn } from 'node:child_process';
import { config } from './config';

let lastState: 'on' | 'off' | null = null;

export function setScreen(state: 'on' | 'off'): void {
  if (state === lastState) return;
  lastState = state;

  if (config.fakeScreen) {
    console.log(`[screen] ${state}`);
    return;
  }

  const args = ['--output', 'HDMI-A-1', state === 'on' ? '--on' : '--off'];

  const env = {
    ...process.env,
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? 'wayland-1',
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? `/run/user/1000`,
  };

  const child = spawn('wlr-randr', args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (d: Buffer) => console.error('[screen]', d.toString().trim()));
}
