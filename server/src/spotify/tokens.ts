import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.ts';

// The file keeps Spotify's snake_case names, so existing token files on the Pi stay readable.
const tokensFileSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    /** Unix time in ms. */
    expires_at: z.number(),
  })
  .transform((file) => ({
    accessToken: file.access_token,
    refreshToken: file.refresh_token,
    expiresAt: file.expires_at,
  }));

export type Tokens = z.output<typeof tokensFileSchema>;

/** Returns null when Spotify was never connected, or the file is unreadable. */
export function loadTokens(): Tokens | null {
  try {
    const file = JSON.parse(fs.readFileSync(config.tokensPath, 'utf8'));
    return tokensFileSchema.parse(file);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens): void {
  const file: z.input<typeof tokensFileSchema> = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt,
  };
  fs.mkdirSync(path.dirname(config.tokensPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(config.tokensPath, JSON.stringify(file, null, 2), { mode: 0o600 });
}
