import { formatTime, type HandAngles, timeAngles } from './digits.ts';
import { MOTION_FIELDS, type MotionField } from './fields.ts';
import { type ClockPosition, COLUMNS } from './layout.ts';

/** How long each motion field plays before it morphs into the next. */
const FIELD_MS = 7000;
/** How long a hand takes to morph from where it was into a new field. */
const BLEND_MS = 2500;
/** How long a hand takes to slow from the field into its digit. */
const LAND_MS = 3200;
/** The time lands column by column, left to right. */
const LAND_COLUMN_DELAY_MS = 120;
const LAND_TOTAL_MS = LAND_MS + (COLUMNS - 1) * LAND_COLUMN_DELAY_MS; // 4280 ms

/** The hands flow for this long before each minute change, then land on the new time. */
const FLOW_MS = 16_000;
const MIN_FLOW_MS = 3000;
/** The flow that opens the clock when it appears, before it lands on the current time. */
const INTRO_FLOW_MS = 4000;

/**
 * Landing aims at the minute it finishes in. Look this much further ahead, so frame timing
 * can't make it land on the minute that is just ending.
 */
const LAND_LOOKAHEAD_MS = 500;
const MINUTE_MS = 60_000;
const SCHEDULE_INTERVAL_MS = 250;

/** How far ahead to look to tell which way a hand is turning. */
const DIRECTION_PROBE_S = 0.05;

export interface Hand {
  readonly element: HTMLElement;
  angle: number;
  /** The hand's distance from the field when the field started, faded out over `BLEND_MS`. */
  offset: number;
  offsetStart: number;
  /** Where the hand lands, unwrapped so it keeps turning the way it was going. */
  target: number;
}

export interface ClockHands {
  readonly position: ClockPosition;
  readonly hands: readonly [Hand, Hand];
}

/** `time`: still on the digits. `flow`: following a motion field. `land`: settling into the digits. */
type Phase = 'time' | 'flow' | 'land';

const mod = (n: number, m: number) => ((n % m) + m) % m;
const wrap180 = (degrees: number) => mod(degrees + 180, 360) - 180;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

/**
 * Drives the clock hands: they flow through the motion fields before each minute change, then
 * land on the new time and rest until the next one. Writes transforms straight to the DOM every
 * frame, outside React, and only animates while something moves.
 */
export class ClockMotion {
  private readonly clocks: readonly ClockHands[];
  private phase: Phase = 'time';
  private field: MotionField = MOTION_FIELDS[0];
  private fieldIndex = -1;
  private fieldStart = 0;
  private flowStart = 0;
  private flowEnd = 0;
  private landStart = 0;
  private frameRequest = 0;
  private scheduleTimer: ReturnType<typeof setInterval> | undefined;

  constructor(clocks: readonly ClockHands[]) {
    this.clocks = clocks;
  }

  start(): void {
    this.startFlow(performance.now(), INTRO_FLOW_MS);
    this.scheduleTimer = setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.scheduleTimer);
    cancelAnimationFrame(this.frameRequest);
  }

  /** Starts the flow in time to land on the next minute as it turns. */
  private schedule(): void {
    if (this.phase !== 'time') return;

    const untilMinuteMs = MINUTE_MS - (Date.now() % MINUTE_MS);
    if (untilMinuteMs > FLOW_MS + LAND_TOTAL_MS) return;

    this.startFlow(performance.now(), Math.max(MIN_FLOW_MS, untilMinuteMs - LAND_TOTAL_MS));
  }

  private startFlow(now: number, durationMs: number): void {
    this.phase = 'flow';
    this.flowStart = now;
    this.flowEnd = now + durationMs;
    this.nextField(now);
    this.frameRequest = requestAnimationFrame((time) => this.frame(time));
  }

  /**
   * Switches to the next field. Each hand keeps its current angle as an offset from the new field
   * that fades out, so the morph has no jumps.
   */
  private nextField(now: number): void {
    this.fieldIndex = (this.fieldIndex + 1) % MOTION_FIELDS.length;
    this.field = MOTION_FIELDS[this.fieldIndex];
    this.fieldStart = now;

    const seconds = this.flowSeconds(now);
    for (const { position, hands } of this.clocks) {
      const angles = this.field(position, seconds);
      hands.forEach((hand, i) => {
        hand.offset = wrap180(hand.angle - angles[i]);
        hand.offsetStart = now;
      });
    }
  }

  /** Aims each hand at its digit, ahead in the direction it is already turning, so it never reverses. */
  private startLanding(now: number): void {
    this.phase = 'land';
    this.landStart = now;

    const time = formatTime(new Date(Date.now() + LAND_TOTAL_MS + LAND_LOOKAHEAD_MS));
    const seconds = this.flowSeconds(now);
    for (const { position, hands } of this.clocks) {
      const current = this.field(position, seconds);
      const soon = this.field(position, seconds + DIRECTION_PROBE_S);
      const targets = timeAngles(position, time);
      hands.forEach((hand, i) => {
        let delta = mod(targets[i] - hand.angle, 360);
        if (soon[i] < current[i] && delta > 0) delta -= 360;
        hand.target = hand.angle + delta;
      });
    }
  }

  private frame(now: number): void {
    if (this.phase === 'flow' && now >= this.flowEnd) this.startLanding(now);
    else if (this.phase === 'flow' && now - this.fieldStart >= FIELD_MS) this.nextField(now);

    const seconds = this.flowSeconds(now);
    let isSettling = false;
    for (const { position, hands } of this.clocks) {
      const angles = this.field(position, seconds);
      const landing =
        this.phase === 'land'
          ? easeInOutCubic(
              clamp01((now - this.landStart - position.column * LAND_COLUMN_DELAY_MS) / LAND_MS),
            )
          : 0;
      if (this.phase === 'land' && landing < 1) isSettling = true;

      hands.forEach((hand, i) => {
        const free = this.followField(hand, angles, now, i);
        hand.angle = free + (hand.target - free) * landing;
        render(hand);
      });
    }

    // Every clock has landed: bring the angles back within one turn and rest until the next flow.
    if (this.phase === 'land' && !isSettling) {
      for (const { hands } of this.clocks) {
        for (const hand of hands) {
          hand.angle = mod(hand.target, 360);
          render(hand);
        }
      }
      this.phase = 'time';
      return;
    }

    this.frameRequest = requestAnimationFrame((time) => this.frame(time));
  }

  private followField(hand: Hand, angles: HandAngles, now: number, index: number): number {
    const fade = 1 - easeInOutCubic(clamp01((now - hand.offsetStart) / BLEND_MS));
    return angles[index] + hand.offset * fade;
  }

  private flowSeconds(now: number): number {
    return (now - this.flowStart) / 1000;
  }
}

export function render(hand: Hand): void {
  hand.element.style.transform = `rotate(${hand.angle}deg)`;
}
