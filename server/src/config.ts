import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    SPOTIFY_CLIENT_ID: z.string().min(1, 'SPOTIFY_CLIENT_ID is required'),
    SPOTIFY_SETUP_PORT: z.coerce.number().default(3001),
    VINYL_PAUSE_TO_OFF_MS: z.coerce.number().default(10_000),
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
      tokensPath:
        env.VINYL_TOKENS_PATH || path.join(os.homedir(), '.config', 'vinyl', 'tokens.json'),
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
