import type { ClockPosition } from './layout.ts';

/** The angles of a clock's two hands, in degrees: 0 is 12 o'clock, clockwise. */
export type HandAngles = readonly [number, number];

const UP = 0;
const RIGHT = 90;
const DOWN = 180;
const LEFT = 270;

/** ClockClock's idle pose, both hands at "7:35", for clocks that aren't part of a digit. */
export const REST: HandAngles = [225, 225];

/** The time sits in the middle band: columns 1 to 8, rows 3 to 5. */
const FIRST_DIGIT_COLUMN = 1;
const FIRST_DIGIT_ROW = 3;
const DIGIT_COUNT = 4;
const DIGIT_COLUMNS = 2;
const DIGIT_ROWS = 3;

/** One clock of a digit, drawn as the box-drawing character its hands make. */
const STROKES: Record<string, HandAngles> = {
  '┌': [RIGHT, DOWN],
  '┐': [LEFT, DOWN],
  '└': [UP, RIGHT],
  '┘': [UP, LEFT],
  '│': [UP, DOWN],
  '╶': [RIGHT, RIGHT],
  '╴': [LEFT, LEFT],
  '╷': [DOWN, DOWN],
  '╵': [UP, UP],
  ' ': REST,
};

/**
 * Each digit is drawn by 2x3 clocks. Two hands can't draw a T-junction, so the middles of 3, 4,
 * 6, 8 and 9 leave a small gap, as on the real ClockClock.
 */
const GLYPHS: Record<string, readonly [string, string, string]> = {
  '0': ['┌┐', '││', '└┘'],
  '1': [' ╷', ' │', ' ╵'],
  '2': ['╶┐', '┌┘', '└╴'],
  '3': ['╶┐', '╶│', '╶┘'],
  '4': ['╷╷', '└│', ' ╵'],
  '5': ['┌╴', '└┐', '╶┘'],
  '6': ['┌╴', '│┐', '└┘'],
  '7': ['╶┐', ' │', ' ╵'],
  '8': ['┌┐', '└┘', '└┘'],
  '9': ['┌┐', '└│', '╶┘'],
};

/** The time as four digits, `HHMM`, on a 24-hour clock. */
export function formatTime(date: Date): string {
  return [date.getHours(), date.getMinutes()].map((n) => String(n).padStart(2, '0')).join('');
}

/** Where a clock's hands point to draw its part of the time. */
export function timeAngles(clock: ClockPosition, time: string): HandAngles {
  const column = clock.column - FIRST_DIGIT_COLUMN;
  const row = clock.row - FIRST_DIGIT_ROW;
  const isInDigits =
    column >= 0 && column < DIGIT_COUNT * DIGIT_COLUMNS && row >= 0 && row < DIGIT_ROWS;
  if (!isInDigits) return REST;

  const glyph = GLYPHS[time[Math.floor(column / DIGIT_COLUMNS)]];
  return STROKES[glyph[row][column % DIGIT_COLUMNS]];
}
