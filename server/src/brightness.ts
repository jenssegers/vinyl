import { getPosition } from 'suncalc';
import { setBacklight } from './backlight.ts';
import { config } from './config.ts';

/**
 * Re-send the brightness this often. It catches sunset and sunrise within a minute, and also
 * restores the level if the panel resets it (a USB replug or power cycle).
 */
const BRIGHTNESS_INTERVAL_MS = 60_000;

/** Night starts when the sun's center drops below the horizon, a few minutes before sunset. */
const HORIZON_ALTITUDE_DEGREES = 0;

/** Day brightness after sunrise, night brightness after sunset. */
export function brightnessAt(date: Date): number {
  const { latitude, longitude } = config.location;
  const { altitude } = getPosition(date, latitude, longitude);
  return altitude < HORIZON_ALTITUDE_DEGREES ? config.nightBrightness : config.dayBrightness;
}

/** Keeps the panel at the brightness for the time of day. Returns a function that stops it. */
export function startBrightnessSchedule(): () => void {
  const apply = () => setBacklight(brightnessAt(new Date()));

  apply();
  const timer = setInterval(apply, BRIGHTNESS_INTERVAL_MS);
  return () => clearInterval(timer);
}
