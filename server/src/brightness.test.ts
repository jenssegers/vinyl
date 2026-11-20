import { describe, expect, it } from 'vitest';
import type { Display } from '../../shared/display.ts';
import { brightnessAt, brightnessFor } from './brightness.ts';

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

// The test environment leaves the clock level unset, so it falls back to the night level.
describe('brightnessFor', () => {
  const noon = new Date('2026-12-21T12:00:00Z');
  const track = { id: 'track-1', name: 'So What', artist: 'Miles Davis', albumArt: '' };

  it.each<{ name: string; display: Display; brightness: number }>([
    { name: 'the clock, at the night level', display: { kind: 'clock' }, brightness: 25 },
    { name: 'a playing track, by the sun', display: { kind: 'playing', track }, brightness: 75 },
    { name: 'an error, by the sun', display: { kind: 'error', message: 'x' }, brightness: 75 },
  ])('$name: $brightness% at noon', ({ display, brightness }) => {
    expect(brightnessFor(display, noon)).toBe(brightness);
  });
});
