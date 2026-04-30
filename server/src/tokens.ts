import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}

export function loadTokens(): Tokens | null {
  try {
    const raw = fs.readFileSync(config.tokensPath, 'utf8');
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens): void {
  fs.mkdirSync(path.dirname(config.tokensPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(config.tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}
