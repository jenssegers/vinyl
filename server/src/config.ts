import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Verify env-provided value before trusting it — systemd may inject a stale hardcoded socket name.
function resolveWaylandDisplay(envValue: string | undefined, xdgRuntimeDir: string): string {
  if (envValue) {
    try {
      fs.statSync(path.join(xdgRuntimeDir, envValue));
      return envValue;
    } catch { /* socket does not exist at that path */ }
  }
  try {
    const socket = fs.readdirSync(xdgRuntimeDir).find((e) => /^wayland-\d+$/.test(e));
    if (socket) return socket;
  } catch { /* runtime dir inaccessible */ }
  return 'wayland-1';
}

const number = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => parseInt(value || String(defaultValue), 10));

const envSchema = z
  .object({
    PORT: number(3000),
    SPOTIFY_CLIENT_ID: z.string().min(1, 'SPOTIFY_CLIENT_ID is required'),
    SPOTIFY_SETUP_PORT: number(3001),
    VINYL_PAUSE_TO_OFF_MS: number(60000),
    VINYL_FAKE_SCREEN: z.string().optional(),
    VINYL_TOKENS_PATH: z.string().optional(),
    VINYL_ALLOWED_DEVICES: z.string().optional(),
  })
  .transform((env) => {
    const fakeScreen = env.VINYL_FAKE_SCREEN === '1' || process.platform !== 'linux';
    const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR ?? '/run/user/1000';
    return {
      port: env.PORT,
      spotifyClientId: env.SPOTIFY_CLIENT_ID,
      setupPort: env.SPOTIFY_SETUP_PORT,
      pauseToOffMs: env.VINYL_PAUSE_TO_OFF_MS,
      fakeScreen,
      xdgRuntimeDir,
      waylandDisplay: fakeScreen ? 'wayland-1' : resolveWaylandDisplay(process.env.WAYLAND_DISPLAY, xdgRuntimeDir),
      tokensPath: env.VINYL_TOKENS_PATH || path.join(os.homedir(), '.config', 'vinyl', 'tokens.json'),
      clientDist: path.resolve(__dirname, '../../client/dist'),
      allowedDevices: env.VINYL_ALLOWED_DEVICES
        ? env.VINYL_ALLOWED_DEVICES.split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : [],
    };
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = result.data;
