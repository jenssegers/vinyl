import EventEmitter from 'node:events';
import { consola } from 'consola';
import type { Display, Track } from '../../shared/display.ts';
import { config } from './config.ts';
import { setScreen } from './screen.ts';
import { type Device, getPlayback, type Playback } from './spotify/client.ts';
import { SpotifyError } from './spotify/errors.ts';

const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

/** Poll sooner after a playback command, so the display catches up with the touch. */
const POLL_AFTER_COMMAND_MS = 400;

/** Show the error on screen after this many failures in a row. */
const ERROR_THRESHOLD = 3;

const log = consola.withTag('poller');

/** Polls Spotify and turns what it reports into the `Display`, switching the screen to match. */
export class Poller extends EventEmitter<{ change: [Display] }> {
  private display: Display = { kind: 'off' };
  private isRunning = false;
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollRequested = false;
  private consecutiveFailures = 0;
  private pausedAt = 0;
  private lastLoggedDevice: string | null | undefined = undefined;

  start(): void {
    this.isRunning = true;
    void this.poll().then(() => {
      // The screen may still be on from before vinyl started.
      if (this.display.kind === 'off') setScreen('off');
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  getState(): Display {
    return this.display;
  }

  refreshSoon(): void {
    // A poll in flight may have read the state from before the command, so poll again after it.
    if (this.isPolling) {
      this.pollRequested = true;
      return;
    }

    this.scheduleNextPoll(POLL_AFTER_COMMAND_MS);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning) return;

    // Replace any pending poll, so only one chain of polls ever runs.
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    this.isPolling = true;
    this.pollRequested = false;

    // Only failures of the Spotify call count towards the error state, not bugs in `show`.
    const nextPollMs = await getPlayback().then(
      (playback) => {
        this.consecutiveFailures = 0;
        this.show(playback);
        return POLL_INTERVAL_MS;
      },
      (error: unknown) => this.recordFailure(error),
    );

    this.isPolling = false;
    this.scheduleNextPoll(this.pollRequested ? POLL_AFTER_COMMAND_MS : nextPollMs);
  }

  private show(playback: Playback | null): void {
    this.logDevice(playback?.device ?? null);

    if (!playback || !isAllowedDevice(playback.device)) this.showOff();
    else if (playback.isPlaying) this.showPlaying(playback.track);
    else this.showPaused(playback.track);
  }

  /** Returns how long to back off before the next poll. */
  private recordFailure(error: unknown): number {
    log.error(error);
    this.consecutiveFailures++;
    const backoffMs = Math.min(POLL_INTERVAL_MS * 2 ** this.consecutiveFailures, MAX_BACKOFF_MS);

    // A failure or two is usually a blip, so the display keeps what it shows.
    if (this.consecutiveFailures < ERROR_THRESHOLD) return backoffMs;

    log.warn(
      `spotify polling failed ${this.consecutiveFailures}x, retrying in ${Math.round(backoffMs / 1000)}s`,
    );
    this.showError(describeFailure(error));
    return backoffMs;
  }

  private showError(message: string): void {
    if (this.display.kind === 'error' && this.display.message === message) return;

    if (this.display.kind !== 'error') log.warn(`surfacing error to display: ${message}`);
    setScreen('on');
    this.update({ kind: 'error', message });
  }

  private showPlaying(track: Track): void {
    if (this.display.kind === 'playing' && this.display.track.id === track.id) return;

    setScreen('on');
    this.update({ kind: 'playing', track });
  }

  private showPaused(track: Track): void {
    // Don't wake a blank screen just because a paused track sits in Spotify's player.
    if (this.display.kind === 'off') return;

    // A pause keeps the screen on for a while, counted from when playback first paused.
    if (this.display.kind !== 'paused') {
      this.pausedAt = Date.now();
    } else if (Date.now() - this.pausedAt >= config.pauseToOffMs) {
      this.showOff();
      return;
    } else if (this.display.track.id === track.id) {
      return;
    }

    setScreen('on');
    this.update({ kind: 'paused', track });
  }

  private showOff(): void {
    if (this.display.kind === 'off') return;

    setScreen('off');
    this.update({ kind: 'off' });
  }

  private update(display: Display): void {
    this.display = display;
    this.emit('change', display);
  }

  private logDevice(device: Device | null): void {
    const description = device ? `${device.name} (${device.type}, id=${device.id})` : null;
    if (description === this.lastLoggedDevice) return;

    log.info('active device:', description ?? '<none>');
    this.lastLoggedDevice = description;
  }
}

/** Unset `VINYL_ALLOWED_DEVICES` allows every device; otherwise the name or id must match one. */
function isAllowedDevice(device: Device | null): boolean {
  if (config.allowedDevices.length === 0) return true;
  if (!device) return false;

  const name = device.name.toLowerCase();
  const id = device.id?.toLowerCase();
  return config.allowedDevices.some((allowed) => name.includes(allowed) || id?.includes(allowed));
}

/** The message on the error platter: short enough to fit the arc. */
function describeFailure(error: unknown): string {
  if (error instanceof SpotifyError) {
    switch (error.reason) {
      case 'not-connected':
        return 'Spotify not connected';
      case 'authorization-failed':
        return 'Spotify login expired';
      case 'rate-limited':
        return 'Spotify rate limit';
      case 'no-active-device':
      case 'service-error':
        return 'Spotify service error';
      default: {
        const unhandled: never = error.reason;
        return unhandled;
      }
    }
  }

  // `AbortSignal.timeout` rejects with a TimeoutError, and fetch rejects with a TypeError when
  // the network fails: https://developer.mozilla.org/docs/Web/API/Window/fetch#exceptions
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Connection timeout';
  if (error instanceof TypeError) return 'Network error';
  return 'Spotify unreachable';
}

export const poller = new Poller();
