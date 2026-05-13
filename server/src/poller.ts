import EventEmitter from 'node:events';
import { consola } from 'consola';
import { config } from './config';
import { setScreen } from './screen';
import { type Device, getCurrentlyPlaying, type Track } from './spotify';

export type Display =
  | { kind: 'playing'; track: Track }
  | { kind: 'paused'; track: Track }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

const POLL_BASE_MS = 2000;
const POLL_MAX_MS = 60_000;
const ERROR_THRESHOLD = 3; // surface error after this many consecutive failures

const log = consola.withTag('poller');

class Poller extends EventEmitter {
  private display: Display = { kind: 'off' };
  private consecutiveFailures = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private lastDeviceKey: string | null | undefined = undefined;

  start(): void {
    void this.tick().then(() => {
      if (this.display.kind === 'off') setScreen('off');
    });
  }

  stop(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.clearPauseTimer();
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  getState(): Display {
    return this.display;
  }

  private scheduleNextTick(delayMs: number): void {
    this.pollTimer = setTimeout(() => void this.tick(), delayMs);
  }

  private isAllowed(device: Device | null): boolean {
    if (config.allowedDevices.length === 0) return true;
    if (!device) return false;
    const name = device.name.toLowerCase();
    const id = device.id?.toLowerCase() ?? '';
    return config.allowedDevices.some((d) => d === name || d === id);
  }

  private async tick(): Promise<void> {
    let nowPlaying: Awaited<ReturnType<typeof getCurrentlyPlaying>>;
    try {
      nowPlaying = await getCurrentlyPlaying();
    } catch (err) {
      this.handleFailure(err);
      return;
    }
    this.consecutiveFailures = 0;

    const deviceKey = nowPlaying?.device
      ? `${nowPlaying.device.name} (${nowPlaying.device.type}, id=${nowPlaying.device.id})`
      : null;
    if (deviceKey !== this.lastDeviceKey) {
      log.info('active device:', deviceKey ?? '<none>');
      this.lastDeviceKey = deviceKey;
    }

    if (nowPlaying && !this.isAllowed(nowPlaying.device)) {
      nowPlaying = null;
    }

    if (nowPlaying?.isPlaying) {
      this.onPlaying(nowPlaying.track);
    } else if (nowPlaying) {
      this.onPaused(nowPlaying.track);
    } else {
      this.onOff();
    }

    this.scheduleNextTick(POLL_BASE_MS);
  }

  private handleFailure(err: unknown): void {
    log.error(err as Error);
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= ERROR_THRESHOLD) {
      this.enterError(friendlyError(err));
    }

    const delay = Math.min(POLL_BASE_MS * 2 ** this.consecutiveFailures, POLL_MAX_MS);
    if (this.consecutiveFailures >= ERROR_THRESHOLD) {
      log.warn(
        `spotify polling failed ${this.consecutiveFailures}x, retrying in ${Math.round(delay / 1000)}s`,
      );
    }
    this.scheduleNextTick(delay);
  }

  private enterError(message: string): void {
    if (this.display.kind === 'error') {
      if (this.display.message !== message) {
        this.update({ kind: 'error', message });
      }
      return;
    }

    log.warn(`surfacing error to display: ${message}`);
    this.clearPauseTimer();
    if (this.display.kind === 'off') {
      setScreen('on');
    }
    this.update({ kind: 'error', message });
  }

  private onPlaying(track: Track): void {
    this.clearPauseTimer();
    const display = this.display;
    if (display.kind === 'playing' && display.track.id === track.id) return;

    setScreen('on');
    this.update({ kind: 'playing', track });
  }

  private onPaused(track: Track): void {
    const display = this.display;
    // From 'off', ignore — don't wake the screen just because a paused track
    // is sitting in Spotify's player. We'd just blank again after the timer.
    if (display.kind === 'off') return;
    if (display.kind === 'paused' && display.track.id === track.id) return;

    setScreen('on');
    this.update({ kind: 'paused', track });
    if (!this.pauseTimer) {
      this.pauseTimer = setTimeout(() => this.onOff(), config.pauseToOffMs);
    }
  }

  private onOff(): void {
    this.clearPauseTimer();
    if (this.display.kind === 'off') return;
    setScreen('off');
    this.update({ kind: 'off' });
  }

  private update(next: Display): void {
    this.display = next;
    this.emit('change', next);
  }
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/token refresh failed/i.test(message)) return 'Spotify login expired';
  if (/rate limited/i.test(message)) return 'Spotify rate limit';
  if (/no spotify tokens/i.test(message)) return 'Spotify not connected';
  if (/timeout|abort/i.test(message)) return 'Connection timeout';
  if (/spotify api error/i.test(message)) return 'Spotify service error';
  if (/fetch failed|enotfound|econnrefused|enetunreach/i.test(message)) return 'Network error';
  return 'Spotify unreachable';
}

export const poller = new Poller();
