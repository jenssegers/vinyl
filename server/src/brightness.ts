import { getPosition } from 'suncalc';
import { setBacklight } from './backlight.ts';
import { config } from './config.ts';

/**
 * Re-send the brightness this often, so the twilight fade takes each 1% step as soon as it's due
 * (from 25% to 10% over 40 minutes, a step every 2 to 3 minutes). Resending also restores the
 * level if the panel resets it (a USB replug or power cycle).
 */
const BRIGHTNESS_INTERVAL_MS = 15_000;

/**
 * The fade runs while the sun sinks from the horizon (sunset) to 6° below it (end of civil
 * twilight, when it gets dark indoors), and back again at sunrise. In Belgium that takes 35 to
 * 50 minutes, depending on the season. https://en.wikipedia.org/wiki/Twilight#Civil_twilight
 */
const FADE_START_ALTITUDE_DEGREES = 0;
const FADE_END_ALTITUDE_DEGREES = -6;

/** Day brightness while the sun is up, night brightness once it's dark, a fade in between. */
export function brightnessAt(date: Date): number {
  const { latitude, longitude } = config.location;
  const { altitude } = getPosition(date, latitude, longitude);

  // How far the sun is through twilight: 0 at sunset, 1 once it's dark.
  const fadeProgress =
    (FADE_START_ALTITUDE_DEGREES - altitude) /
    (FADE_START_ALTITUDE_DEGREES - FADE_END_ALTITUDE_DEGREES);
  const darkness = Math.min(Math.max(fadeProgress, 0), 1);

  return Math.round(
    config.dayBrightness + (config.nightBrightness - config.dayBrightness) * darkness,
  );
}

/** Keeps the panel at the brightness for the time of day. Returns a function that stops it. */
export function startBrightnessSchedule(): () => void {
  const apply = () => setBacklight(brightnessAt(new Date()));

  apply();
  const timer = setInterval(apply, BRIGHTNESS_INTERVAL_MS);
  return () => clearInterval(timer);
}
