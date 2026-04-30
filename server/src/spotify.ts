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

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com/api/token';

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
  const response = await fetch(ACCOUNTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: config.spotifyClientId,
    }),
  });

  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);

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
  if (!tokens) throw new Error('No Spotify tokens — run npm run setup:spotify');

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
  });

  if (response.status === 204) return null; // nothing active
  if (response.status === 429) throw new Error('Rate limited');
  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);

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
