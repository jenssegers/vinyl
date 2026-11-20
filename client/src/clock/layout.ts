// The clock is a ClockClock-style grid of small analog clocks, cut to the round panel. Positions
// are in percent of the dial, so the layout scales with the screen without measuring it.

export const COLUMNS = 10;
const ROWS = 9;

/** Dial diameter in cells: a little over the column count, so the widest row clears the edge. */
const CELL_PER_DIAMETER = 10.4;
const CELL_PERCENT = 100 / CELL_PER_DIAMETER; // 9.6% of the dial

/** Face diameter in percent of the dial: 92% of a cell, leaving a gap between faces. */
export const FACE_PERCENT = 0.92 * CELL_PERCENT; // 8.8% of the dial

/** Margin between the outermost faces and the panel edge. */
const EDGE_MARGIN_PERCENT = 0.06 * CELL_PERCENT; // 0.6% of the dial

const MAX_DISTANCE_PERCENT = 50 - FACE_PERCENT / 2 - EDGE_MARGIN_PERCENT;

export interface ClockPosition {
  readonly column: number;
  readonly row: number;
  /** The face's centre, in percent of the dial. */
  readonly x: number;
  readonly y: number;
  /** Direction from the dial's centre, in degrees: 0 is up, clockwise. */
  readonly bearing: number;
  /** Distance from the dial's centre: 0 at the centre, 1 at the outermost faces. */
  readonly reach: number;
}

/** Every clock that fits inside the circle, row by row. */
export const CLOCKS: readonly ClockPosition[] = Array.from({ length: ROWS * COLUMNS }, (_, i) => {
  const column = i % COLUMNS;
  const row = Math.floor(i / COLUMNS);
  const dx = (column - (COLUMNS - 1) / 2) * CELL_PERCENT;
  const dy = (row - (ROWS - 1) / 2) * CELL_PERCENT;
  return {
    column,
    row,
    x: 50 + dx,
    y: 50 + dy,
    bearing: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360,
    reach: Math.hypot(dx, dy) / MAX_DISTANCE_PERCENT,
  };
}).filter((clock) => clock.reach <= 1);
