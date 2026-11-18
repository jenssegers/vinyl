import { z } from 'zod';
import type { PlaybackCommand, Track } from '../../../shared/display.ts';
import { getAccessToken, SPOTIFY_TIMEOUT_MS } from './auth.ts';
import { SpotifyError } from './errors.ts';

const API_URL = 'https://api.spotify.com/v1';

const deviceSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  type: z.string(),
});

export type Device = z.infer<typeof deviceSchema>;

// https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback
const playbackStateSchema = z.object({
  is_playing: z.boolean(),
  currently_playing_type: z.string(),
  device: deviceSchema.nullish(),
  // Shaped by `currently_playing_type`, and null during ads.
  item: z.unknown(),
});

const trackItemSchema = z.object({
  // Local files have no id, but every item has a uri.
  id: z.string().nullable(),
  uri: z.string(),
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ images: z.array(z.object({ url: z.string() })) }),
});

export interface Playback {
  isPlaying: boolean;
  track: Track;
  device: Device | null;
}

/** Returns null when nothing is playing, or what plays is not a track (an episode, an ad). */
export async function getPlayback(): Promise<Playback | null> {
  const response = await fetch(`${API_URL}/me/player`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    signal: AbortSignal.timeout(SPOTIFY_TIMEOUT_MS),
  });

  // No content: no active device.
  if (response.status === 204) return null;
  if (!response.ok) throw toSpotifyError(response);

  const playback = playbackStateSchema.parse(await response.json());
  if (playback.currently_playing_type !== 'track' || !playback.item) return null;

  const item = trackItemSchema.parse(playback.item);
  return {
    isPlaying: playback.is_playing,
    track: {
      id: item.id ?? item.uri,
      name: item.name,
      artist: item.artists.map((artist) => artist.name).join(', '),
      albumArt: item.album.images[0]?.url ?? '',
    },
    device: playback.device ?? null,
  };
}

/** Needs Spotify Premium. */
export async function sendPlaybackCommand(command: PlaybackCommand): Promise<void> {
  const response = await fetch(`${API_URL}/me/player/${command}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    signal: AbortSignal.timeout(SPOTIFY_TIMEOUT_MS),
  });

  // Success is 204, but Spotify also answers 202 while the command reaches the
  // device. 403 means the player is already in the requested state.
  if (response.ok || response.status === 403) return;
  throw toSpotifyError(response);
}

function toSpotifyError(response: Response): SpotifyError {
  const message = `spotify API error: ${response.status}`;
  switch (response.status) {
    case 404:
      return new SpotifyError('no-active-device', message);
    case 429:
      return new SpotifyError('rate-limited', message);
    default:
      return new SpotifyError('service-error', message);
  }
}
