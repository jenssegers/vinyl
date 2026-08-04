import { consola } from 'consola';
import { config } from './config';
import { loadTokens, saveTokens, type Tokens } from './tokens';

export interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt: string;
}

export interface Device {
  id: string | null;
  name: string;
  type: string;
}

const log = consola.withTag('spotify');

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com/api/token';
const FETCH_TIMEOUT_MS = 5000;

interface RawCurrentlyPlaying {
  is_playing: boolean;
  currently_playing_type: string;
  device?: { id: string | null; name: string; type: string };
  item: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
  };
}

async function refreshTokens(tokens: Tokens): Promise<Tokens> {
  log.debug('refreshing access token');
  const response = await fetch(ACCOUNTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: config.spotifyClientId,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`token refresh failed: ${response.status}`);

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  const refreshed: Tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  saveTokens(refreshed);
  return refreshed;
}

async function getAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error('no spotify tokens — run npm run setup:spotify');

  if (Date.now() > tokens.expires_at - 60_000) {
    tokens = await refreshTokens(tokens);
  }

  return tokens.access_token;
}

export async function getCurrentlyPlaying(): Promise<{
  isPlaying: boolean;
  track: Track;
  device: Device | null;
} | null> {
  const token = await getAccessToken();
  const response = await fetch(`${API}/me/player`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 204) return null; // nothing active
  if (response.status === 429) throw new Error('rate limited by spotify');
  if (!response.ok) throw new Error(`spotify API error: ${response.status}`);

  const data = (await response.json()) as RawCurrentlyPlaying;
  if (data.currently_playing_type !== 'track' || !data.item) return null;

  return {
    isPlaying: data.is_playing,
    track: {
      id: data.item.id,
      name: data.item.name,
      artist: data.item.artists.map((artist) => artist.name).join(', '),
      albumArt: data.item.album.images[0]?.url ?? '',
    },
    device: data.device ?? null,
  };
}

async function sendPlayerCommand(path: string): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${API}/me/player/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  // Success is 204, but Spotify also answers 202 while the command reaches the
  // device. 403 means the player is already in the requested state.
  if (response.ok || response.status === 403) return;
  if (response.status === 404) throw new Error('no active spotify device');
  if (response.status === 429) throw new Error('rate limited by spotify');
  throw new Error(`spotify API error: ${response.status}`);
}

export function pausePlayback(): Promise<void> {
  return sendPlayerCommand('pause');
}

export function resumePlayback(): Promise<void> {
  return sendPlayerCommand('play');
}
