import EventEmitter from 'node:events';
import { consola } from 'consola';
import { config } from './config';
import { setScreen } from './screen';
import { type Device, getCurrentlyPlaying, type Track } from './spotify';

export type Display =
  | { kind: 'playing'; track: Track }
  | { kind: 'paused'; track: Track }
  | { kind: 'off' };

const log = consola.withTag('poller');

class Poller extends EventEmitter {
  private display: Display = { kind: 'off' };
  private pauseTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastDeviceKey: string | null | undefined = undefined;

  start(): void {
    void this.tick().then(() => {
      if (this.display.kind === 'off') setScreen('off');
    });
    this.pollTimer = setInterval(() => void this.tick(), 2000);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  getState(): Display {
    return this.display;
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
      log.error(err as Error);
      return; // hold last state on any error
    }

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
      // 200 response, paused
      this.onPaused(nowPlaying.track);
    } else {
      // 204 or non-allowed device — preserve last track if we have one
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
