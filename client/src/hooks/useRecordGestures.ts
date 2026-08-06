import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { Display } from './useDisplay';

/** One full turn of the record. */
const SPIN_MS = 4000;

/** Release before this without turning the record and it stays paused. */
const HOLD_MS = 400;

/** Ignore the wobble of a finger that meant to tap. */
const TURN_DEADZONE_DEG = 4;

/** How long to trust the optimistic state before falling back to the server's. */
const OVERRIDE_TIMEOUT_MS = 5000;

type Command = 'play' | 'pause';

interface Point {
  x: number;
  y: number;
}

interface Press {
  startedAt: number;
  didPause: boolean;
  center: Point;
  lastAngle: number;
  turned: number;
  baseTime: number;
}

interface RecordGestures {
  recordRef: (element: HTMLDivElement | null) => void;
  isPressed: boolean;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onContextMenu: (event: { preventDefault: () => void }) => void;
  };
}

function angleFrom(center: Point, event: { clientX: number; clientY: number }): number {
  return (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI;
}

/** Rotation is periodic, so any angle maps back into a single turn. */
function wrapTime(time: number): number {
  return ((time % SPIN_MS) + SPIN_MS) % SPIN_MS;
}

export function useRecordGestures(display: Display): RecordGestures {
  const isPlayingOnServer = display.kind === 'playing';
  const [override, setOverride] = useState<boolean | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [recordElement, setRecordElement] = useState<HTMLDivElement | null>(null);
  const [spin, setSpin] = useState<Animation | null>(null);
  const press = useRef<Press | null>(null);

  // The record is animated imperatively rather than in CSS: dragging scrubs the
  // rotation to follow the finger, and playback has to pick up from that angle
  // instead of snapping back to where a CSS keyframe would be.
  useEffect(() => {
    if (!recordElement) return;
    const animation = recordElement.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: SPIN_MS, iterations: Number.POSITIVE_INFINITY, easing: 'linear' },
    );
    setSpin(animation);
    return () => {
      animation.cancel();
      setSpin(null);
    };
  }, [recordElement]);

  const isPlaying = override ?? isPlayingOnServer;

  // A finger on the record holds it still, whatever Spotify is doing.
  useEffect(() => {
    if (!spin) return;
    if (isPlaying && !isPressed) spin.play();
    else spin.pause();
  }, [spin, isPlaying, isPressed]);

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

  const hasTrack = display.kind === 'playing' || display.kind === 'paused';

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!hasTrack || !event.isPrimary || !recordElement) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    // Stop it here rather than in an effect, so the record catches under the
    // finger on the same frame as the touch.
    spin?.pause();

    const rect = recordElement.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    press.current = {
      startedAt: performance.now(),
      didPause: isPlaying,
      center,
      lastAngle: angleFrom(center, event),
      turned: 0,
      baseTime: Number(spin?.currentTime ?? 0),
    };

    setIsPressed(true);
    if (isPlaying) send('pause');
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const active = press.current;
    if (!active || !event.isPrimary || !spin) return;

    const angle = angleFrom(active.center, event);
    let step = angle - active.lastAngle;
    if (step > 180) step -= 360;
    else if (step < -180) step += 360;

    active.lastAngle = angle;
    active.turned += step;
    spin.currentTime = wrapTime(active.baseTime + (active.turned / 360) * SPIN_MS);
  };

  const endPress = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.isPrimary) return;
    const active = press.current;
    press.current = null;
    if (!active) return;

    setIsPressed(false);

    // Letting go of a record you were holding or turning spins it back up. Only
    // a tap on a playing record leaves it stopped.
    const held = performance.now() - active.startedAt;
    const turned = Math.abs(active.turned) >= TURN_DEADZONE_DEG;
    if (!active.didPause || held >= HOLD_MS || turned) send('play');
  };

  return {
    recordRef: setRecordElement,
    isPressed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPress,
      onPointerCancel: endPress,
      onContextMenu: (event) => event.preventDefault(),
    },
  };
}
