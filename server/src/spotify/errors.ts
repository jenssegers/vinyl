/** Why a Spotify call failed, as far as the rest of the app needs to know. */
export type SpotifyFailure =
  | 'not-connected'
  | 'authorization-failed'
  | 'rate-limited'
  | 'no-active-device'
  | 'service-error';

export class SpotifyError extends Error {
  readonly reason: SpotifyFailure;

  constructor(reason: SpotifyFailure, message: string) {
    super(message);
    this.name = 'SpotifyError';
    this.reason = reason;
  }
}
