import { describe, expect, it } from 'vitest';
import { brightnessAt } from './brightness.ts';

// The test environment is in London, at 75% by day and 25% by night.
// London's sun times in UTC, rounded: 21 Dec rises 08:04, sets 15:53; 21 Jun rises 03:43, sets 20:21.
describe('brightnessAt', () => {
  it.each([
    { name: 'winter noon', date: '2026-12-21T12:00:00Z', brightness: 75 },
    { name: 'winter, 10 minutes after sunset', date: '2026-12-21T16:03:00Z', brightness: 25 },
    { name: 'winter midnight', date: '2026-12-21T00:00:00Z', brightness: 25 },
    { name: 'summer, 10 minutes before sunset', date: '2026-06-21T20:11:00Z', brightness: 75 },
    { name: 'summer, 10 minutes after sunset', date: '2026-06-21T20:31:00Z', brightness: 25 },
    { name: 'summer, 10 minutes after sunrise', date: '2026-06-21T03:53:00Z', brightness: 75 },
  ])('$name: $brightness%', ({ date, brightness }) => {
    expect(brightnessAt(new Date(date))).toBe(brightness);
  });
});
