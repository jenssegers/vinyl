import { z } from 'zod';

// The contract between server and client: the server pushes a `Display` over SSE and the client
// parses it with this schema, so both sides share one source of truth.

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  /** Empty when the track has no artwork, e.g. a local file. */
  albumArt: z.string(),
});

export type Track = z.infer<typeof trackSchema>;

export const displaySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('playing'), track: trackSchema }),
  z.object({ kind: z.literal('paused'), track: trackSchema }),
  z.object({ kind: z.literal('off') }),
  z.object({ kind: z.literal('error'), message: z.string() }),
]);

export type Display = z.infer<typeof displaySchema>;

export const playbackCommandSchema = z.enum(['play', 'pause']);

export type PlaybackCommand = z.infer<typeof playbackCommandSchema>;
