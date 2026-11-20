import type { HandAngles } from './digits.ts';
import type { ClockPosition } from './layout.ts';

/**
 * Between time displays every hand follows one shared motion field: its angles as a function of
 * the clock's position and the seconds since the flow started. The whole dial then moves as one
 * continuous pattern, as on ClockClock, instead of stepping between poses. A field must be
 * continuous in time, because the hands follow it frame by frame.
 */
export type MotionField = (clock: ClockPosition, seconds: number) => HandAngles;

const TURN_DEG_PER_S = 40;

/** Both hands spread evenly around a direction. */
const chevron = (direction: number, spread: number): HandAngles => [
  direction + spread / 2,
  direction - spread / 2,
];

/** Both hands opposite each other: one straight bar through the centre. */
const bar = (direction: number): HandAngles => [direction, direction + 180];

export const MOTION_FIELDS: readonly MotionField[] = [
  // Chevrons that roll between concentric rings and arrows pointing in and out, opening and
  // closing in a wave from the centre.
  (clock, seconds) =>
    chevron(
      clock.bearing + TURN_DEG_PER_S * seconds,
      100 + 70 * Math.sin(0.9 * seconds - 2.5 * clock.reach),
    ),
  // Bars turning a little later in each column: a wave rolling across the dial.
  (clock, seconds) => bar(2 * TURN_DEG_PER_S * seconds - 30 * clock.column),
  // Bars turning later the further out they are: rings rippling out from the centre.
  (clock, seconds) => bar(2 * TURN_DEG_PER_S * seconds - 360 * clock.reach),
  // Scissors opening and closing around the line to the centre, inner clocks first.
  (clock, seconds) =>
    chevron(clock.bearing + 180, 180 + 150 * Math.sin(1.1 * seconds - 3 * clock.reach)),
  // A spiral of bars that slowly turns.
  (clock, seconds) => bar(clock.bearing + 90 - 140 * clock.reach + TURN_DEG_PER_S * seconds),
];
