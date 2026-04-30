import EventEmitter from 'node:events';
import { config } from './config';
import { setScreen } from './screen';
import { getCurrentlyPlaying, type Track } from './spotify';

export type Display =
  | { kind: 'playing'; track: Track }
  | { kind: 'paused'; track: Track }
  | { kind: 'off' };

class Poller extends EventEmitter {
  private display: Display = { kind: 'off' };
  private pauseTimer: NodeJS.Timeout | null = null;

  start(): void {
    void this.tick();
    setInterval(() => void this.tick(), 2000);
  }

  getState(): Display {
    return this.display;
  }

  private async tick(): Promise<void> {
    let nowPlaying: { isPlaying: boolean; track: Track } | null;
    try {
      nowPlaying = await getCurrentlyPlaying();
    } catch (err) {
      console.error('[poller]', (err as Error).message);
      return; // hold last state on any error
    }

    if (nowPlaying?.isPlaying) {
      this.onPlaying(nowPlaying.track);
    } else if (nowPlaying) {
      // 200 response, paused
      this.onPaused(nowPlaying.track);
    } else {
      // 204: no active session — preserve last track if we have one
      const current = this.display;
      const lastTrack = current.kind !== 'off' ? current.track : null;
      if (lastTrack) {
        this.onPaused(lastTrack);
      }
      // already off: do nothing
    }
  }

  private onPlaying(track: Track): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const display = this.display;
    if (display.kind === 'playing' && display.track.id === track.id) return;

    setScreen('on');
    this.update({ kind: 'playing', track });
  }

  private onPaused(track: Track): void {
    const display = this.display;
    if (display.kind === 'playing') {
      // just transitioned playing → paused
      this.update({ kind: 'paused', track });
      this.pauseTimer = setTimeout(() => this.onOff(), config.pauseToOffMs);
    } else if (display.kind === 'paused' && display.track.id !== track.id) {
      // track changed while paused (e.g. user skipped on another device)
      this.update({ kind: 'paused', track });
    }
    // if 'off': ignore — screen stays off until someone hits play
  }

  private onOff(): void {
    this.pauseTimer = null;
    setScreen('off');
    this.update({ kind: 'off' });
  }

  private update(next: Display): void {
    this.display = next;
    this.emit('change', next);
  }
}

export const poller = new Poller();
