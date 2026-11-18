import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.ts';
import { SpotifyError } from './errors.ts';
import { loadTokens, saveTokens, type Tokens } from './tokens.ts';

// Authorization code flow with PKCE, for a client without a secret:
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// A refresh grant cannot widen these, so adding one means connecting Spotify again.
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
];

/** Refresh this long before expiry, so a token never runs out mid-request. */
const EXPIRY_MARGIN_MS = 60_000;

export const SPOTIFY_TIMEOUT_MS = 5000;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  // Spotify may leave this out of a refresh response, and then the old one stays valid.
  refresh_token: z.string().optional(),
});

export interface Authorization {
  url: string;
  verifier: string;
  state: string;
}

export function createAuthorization(): Authorization {
  const verifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  const state = crypto.randomBytes(16).toString('hex');
  const url = `${AUTHORIZE_URL}?${new URLSearchParams({
    client_id: config.spotifyClientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    scope: SCOPES.join(' '),
    state,
  })}`;
  return { url, verifier, state };
}

export async function exchangeAuthorizationCode(code: string, verifier: string): Promise<void> {
  const response = await requestTokens({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  if (!response.refresh_token) {
    throw new SpotifyError('authorization-failed', 'token response has no refresh token');
  }

  saveTokens(toTokens(response, response.refresh_token));
}

export async function getAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) {
    throw new SpotifyError('not-connected', 'no spotify tokens, run pnpm setup:spotify');
  }

  // Still valid: use it as is.
  if (Date.now() < tokens.expiresAt - EXPIRY_MARGIN_MS) return tokens.accessToken;

  const response = await requestTokens({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const refreshed = toTokens(response, response.refresh_token ?? tokens.refreshToken);
  saveTokens(refreshed);
  return refreshed.accessToken;
}

async function requestTokens(
  params: Record<string, string>,
): Promise<z.infer<typeof tokenResponseSchema>> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: config.spotifyClientId }),
    signal: AbortSignal.timeout(SPOTIFY_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SpotifyError(
      'authorization-failed',
      `token request failed: ${response.status} ${body}`,
    );
  }

  return tokenResponseSchema.parse(await response.json());
}

function toTokens(response: z.infer<typeof tokenResponseSchema>, refreshToken: string): Tokens {
  return {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
}
