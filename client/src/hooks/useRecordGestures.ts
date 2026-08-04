import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { Display } from './useDisplay';

/** Release before this and the record stays paused; hold longer and it spins up again. */
const HOLD_MS = 400;

/** How long to trust the optimistic state before falling back to the server's. */
const OVERRIDE_TIMEOUT_MS = 5000;

type Command = 'play' | 'pause';

interface RecordGestures {
  isPlaying: boolean;
  isPressed: boolean;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onContextMenu: (event: { preventDefault: () => void }) => void;
  };
}

export function useRecordGestures(display: Display): RecordGestures {
  const isPlayingOnServer = display.kind === 'playing';
  const [override, setOverride] = useState<boolean | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const press = useRef<{ startedAt: number; didPause: boolean } | null>(null);

  // The poller needs a moment to see the command land, so the touch drives the
  // record locally until the server reports the same thing.
  useEffect(() => {
    if (override === null) return;
    if (override === isPlayingOnServer) {
      setOverride(null);
      return;
    }
    const timer = setTimeout(() => setOverride(null), OVERRIDE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [override, isPlayingOnServer]);

  const send = useCallback((command: Command) => {
    setOverride(command === 'play');
    fetch(`/api/playback/${command}`, { method: 'POST' })
      .then((response) => {
        if (!response.ok) setOverride(null);
      })
      .catch(() => setOverride(null));
  }, []);

  const isPlaying = override ?? isPlayingOnServer;
  const hasTrack = display.kind === 'playing' || display.kind === 'paused';

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!hasTrack || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { startedAt: performance.now(), didPause: isPlaying };
    setIsPressed(true);
    send(isPlaying ? 'pause' : 'play');
  };

  const endPress = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.isPrimary) return;
    const active = press.current;
    press.current = null;
    if (!active) return;

    setIsPressed(false);
    if (active.didPause && performance.now() - active.startedAt >= HOLD_MS) {
      send('play');
    }
  };

  return {
    isPlaying,
    isPressed,
    handlers: {
      onPointerDown,
      onPointerUp: endPress,
      onPointerCancel: endPress,
      onContextMenu: (event) => event.preventDefault(),
    },
  };
}
