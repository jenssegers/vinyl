import fs from 'node:fs/promises';
import path from 'node:path';
import { consola } from 'consola';
import { config } from './config.ts';

/** The Waveshare panel's `HID_ID` in sysfs: USB bus 0003, vendor 0712, product 000A. */
const PANEL_HID_ID = '0003:00000712:0000000A';

const HIDRAW_CLASS_DIR = '/sys/class/hidraw';

/** Report header for "set backlight", from Waveshare's HID_brightness.py. */
const SET_BACKLIGHT_PREFIX = [0x09, 0x08, 0xf7];

const MAX_LEVEL = 255;

const log = consola.withTag('backlight');

let lastPercent: number | null = null;
let isFailing = false;

/**
 * Sets the panel's backlight over USB HID. Writing to hidraw leaves the touch driver attached,
 * unlike Waveshare's script, which detaches it to talk to the endpoint directly.
 * Protocol: https://files.waveshare.com/wiki/common/HID_brightness.py
 */
export function setBacklight(percent: number): void {
  if (percent !== lastPercent) log.info(`brightness ${percent}%`);
  lastPercent = percent;

  // Off the Pi there is no panel to dim.
  if (config.fakeScreen) return;

  // The report is the level and its one's complement as a checksum.
  const level = Math.round((percent / 100) * MAX_LEVEL);
  const report = Buffer.from([...SET_BACKLIGHT_PREFIX, level, ~level & 0xff]);

  findPanel()
    .then((device) => {
      if (!device) throw new Error(`no hidraw device with HID_ID ${PANEL_HID_ID}`);
      return fs.writeFile(device, report);
    })
    .then(() => {
      if (isFailing) log.success('panel reachable again');
      isFailing = false;
    })
    .catch((error: unknown) => {
      // Callers retry every minute, so only log the first failure in a row.
      if (!isFailing) log.error(error, 'setting brightness failed');
      isFailing = true;
    });
}

// Look the device up on each call: its hidraw number can change when the USB cable is replugged.
async function findPanel(): Promise<string | null> {
  for (const entry of await fs.readdir(HIDRAW_CLASS_DIR)) {
    const uevent = await fs.readFile(path.join(HIDRAW_CLASS_DIR, entry, 'device/uevent'), 'utf8');
    if (uevent.toUpperCase().includes(`HID_ID=${PANEL_HID_ID}`)) return path.join('/dev', entry);
  }

  return null;
}
