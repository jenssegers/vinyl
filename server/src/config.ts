import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

/** Bavegem, Belgium: where the record player stands, for sunset and sunrise. */
const DEFAULT_LOCATION = { latitude: 50.94, longitude: 3.87 };

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    SPOTIFY_CLIENT_ID: z.string('SPOTIFY_CLIENT_ID is required'),
    SPOTIFY_SETUP_PORT: z.coerce.number().int().positive().default(3001),
    SPOTIFY_REDIRECT_URI: z.url().optional(),
    VINYL_PAUSE_TO_OFF_MS: z.coerce.number().int().nonnegative().default(10_000),
    VINYL_IDLE_CLOCK: z.stringbool().default(false),
    VINYL_FAKE_SCREEN: z.stringbool().default(false),
    VINYL_TOKENS_PATH: z.string().optional(),
    VINYL_ALLOWED_DEVICES: z.string().optional(),
    VINYL_LATITUDE: z.coerce.number().min(-90).max(90).optional(),
    VINYL_LONGITUDE: z.coerce.number().min(-180).max(180).optional(),
    VINYL_DAY_BRIGHTNESS: z.coerce.number().int().min(0).max(100).default(25),
    VINYL_NIGHT_BRIGHTNESS: z.coerce.number().int().min(0).max(100).default(10),
    WAYLAND_DISPLAY: z.string().optional(),
    XDG_RUNTIME_DIR: z.string().default('/run/user/1000'),
  })
  .refine((env) => env.PORT !== env.SPOTIFY_SETUP_PORT, {
    message: 'must differ from PORT',
    path: ['SPOTIFY_SETUP_PORT'],
  })
  .refine((env) => (env.VINYL_LATITUDE === undefined) === (env.VINYL_LONGITUDE === undefined), {
    message: 'set both VINYL_LATITUDE and VINYL_LONGITUDE, or neither',
    path: ['VINYL_LONGITUDE'],
  })
  .transform((env) => ({
    port: env.PORT,
    // In development Vite serves the client, with hot reload.
    serveClient: env.NODE_ENV === 'production',
    clientDist: path.resolve(import.meta.dirname, '../../client/dist'),
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    setupPort: env.SPOTIFY_SETUP_PORT,
    redirectUri:
      env.SPOTIFY_REDIRECT_URI ?? `http://127.0.0.1:${env.SPOTIFY_SETUP_PORT}/auth/callback`,
    pauseToOffMs: env.VINYL_PAUSE_TO_OFF_MS,
    idleClock: env.VINYL_IDLE_CLOCK,
    fakeScreen: env.VINYL_FAKE_SCREEN || process.platform !== 'linux',
    tokensPath: env.VINYL_TOKENS_PATH ?? path.join(os.homedir(), '.config', 'vinyl', 'tokens.json'),
    allowedDevices: (env.VINYL_ALLOWED_DEVICES ?? '')
      .split(',')
      .map((device) => device.trim().toLowerCase())
      .filter(Boolean),
    location: {
      latitude: env.VINYL_LATITUDE ?? DEFAULT_LOCATION.latitude,
      longitude: env.VINYL_LONGITUDE ?? DEFAULT_LOCATION.longitude,
    },
    dayBrightness: env.VINYL_DAY_BRIGHTNESS,
    nightBrightness: env.VINYL_NIGHT_BRIGHTNESS,
    waylandDisplay: env.WAYLAND_DISPLAY,
    xdgRuntimeDir: env.XDG_RUNTIME_DIR,
  }));

// `.env.example` leaves optional settings empty, so an empty value means "use the default".
const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const result = envSchema.safeParse(env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = result.data;
