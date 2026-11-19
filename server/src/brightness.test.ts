import { describe, expect, it } from 'vitest';
import { brightnessAt } from './brightness.ts';

const MINUTE_MS = 60_000;

// The test environment is in London, at 75% by day and 25% by night.
// London's sun times in UTC, rounded: 21 Dec rises 08:04, sets 15:53; 21 Jun rises 03:43, sets 20:21.
// Civil twilight ends about 40 minutes after sunset in December, 45 minutes in June.
describe('brightnessAt', () => {
  it.each([
    { name: 'winter noon', date: '2026-12-21T12:00:00Z', brightness: 75 },
    { name: 'winter, an hour after sunset', date: '2026-12-21T16:53:00Z', brightness: 25 },
    { name: 'winter midnight', date: '2026-12-21T00:00:00Z', brightness: 25 },
    { name: 'summer, 10 minutes before sunset', date: '2026-06-21T20:11:00Z', brightness: 75 },
    { name: 'summer, an hour after sunset', date: '2026-06-21T21:21:00Z', brightness: 25 },
    { name: 'summer, 10 minutes after sunrise', date: '2026-06-21T03:53:00Z', brightness: 75 },
  ])('$name: $brightness%', ({ date, brightness }) => {
    expect(brightnessAt(new Date(date))).toBe(brightness);
  });

  it('fades from day to night through twilight, never brightening', () => {
    const sunset = new Date('2026-12-21T15:50:00Z').getTime();
    const minutes = Array.from({ length: 60 }, (_, minute) => sunset + minute * MINUTE_MS);
    const levels = minutes.map((time) => brightnessAt(new Date(time)));

    expect(levels[0]).toBe(75);
    expect(levels.at(-1)).toBe(25);
    expect(levels.every((level, i) => i === 0 || level <= levels[i - 1])).toBe(true);
    // A real fade passes through many levels rather than jumping.
    expect(new Set(levels).size).toBeGreaterThan(30);
  });
});
