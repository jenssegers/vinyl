import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { consola } from 'consola';
import { config } from './config.ts';

/** The panel's touch controller: USB vendor 0712, product 000a, the cable that also dims it. */
const PANEL_VENDOR_ID = '0712';
const PANEL_PRODUCT_ID = '000a';

const INPUT_CLASS_DIR = '/sys/class/input';

/**
 * A Linux `struct input_event` on 64-bit: a 16-byte timestamp, then type (u16), code (u16) and
 * value (s32), 24 bytes. https://www.kernel.org/doc/html/latest/input/input.html#event-interface
 */
const EVENT_BYTES = 24;
const TYPE_OFFSET = 16;
const CODE_OFFSET = 18;
const VALUE_OFFSET = 20;
const EV_KEY = 0x01;
const BTN_TOUCH = 0x14a;
const PRESSED = 1;

/** Look for the panel again after it disappears, e.g. when the USB cable is replugged. */
const RETRY_MS = 10_000;

const log = consola.withTag('touch');

/**
 * Calls `onTouch` each time a finger lands on the panel. Reads the input device directly, because
 * while the screen is off the compositor has no output to deliver touches to. Reading doesn't
 * grab the device, so labwc still gets every event. Returns a function that stops watching.
 *
 * Known limitation: a read stream on a character device blocks one of libuv's 4 threadpool
 * threads while it waits for input. The server does little other file I/O, so that's fine here.
 */
export function watchTouches(onTouch: () => void): () => void {
  // Off the Pi there is no panel to touch.
  if (config.fakeScreen) return () => {};

  let stream: fs.ReadStream | null = null;
  let retryTimer: NodeJS.Timeout | undefined;
  let isStopped = false;
  let isMissing = false;

  const retryLater = (): void => {
    if (!isStopped) retryTimer = setTimeout(() => void open(), RETRY_MS);
  };

  const open = async (): Promise<void> => {
    const device = await findPanel().catch(() => null);

    // Only log the first miss in a row: it retries every few seconds.
    if (!device) {
      if (!isMissing) log.warn('touch panel not found, retrying');
      isMissing = true;
      retryLater();
      return;
    }

    isMissing = false;
    log.info(`watching ${device}`);

    // A read can end mid-event, so keep the remainder for the next chunk.
    let pending = Buffer.alloc(0);
    stream = fs.createReadStream(device);
    stream.on('data', (chunk) => {
      if (typeof chunk === 'string') return;

      pending = Buffer.concat([pending, chunk]);
      for (; pending.length >= EVENT_BYTES; pending = pending.subarray(EVENT_BYTES)) {
        const isTouchDown =
          pending.readUInt16LE(TYPE_OFFSET) === EV_KEY &&
          pending.readUInt16LE(CODE_OFFSET) === BTN_TOUCH &&
          pending.readInt32LE(VALUE_OFFSET) === PRESSED;
        if (isTouchDown) onTouch();
      }
    });
    stream.on('error', (error) => log.warn(error, 'touch input lost'));
    stream.on('close', retryLater);
  };

  void open();
  return () => {
    isStopped = true;
    clearTimeout(retryTimer);
    stream?.destroy();
  };
}

async function findPanel(): Promise<string | null> {
  for (const entry of await fsp.readdir(INPUT_CLASS_DIR)) {
    if (!entry.startsWith('event')) continue;

    const id = path.join(INPUT_CLASS_DIR, entry, 'device/id');
    const [vendor, product] = await Promise.all([
      fsp.readFile(path.join(id, 'vendor'), 'utf8').catch(() => ''),
      fsp.readFile(path.join(id, 'product'), 'utf8').catch(() => ''),
    ]);
    if (vendor.trim() === PANEL_VENDOR_ID && product.trim() === PANEL_PRODUCT_ID) {
      return path.join('/dev/input', entry);
    }
  }

  return null;
}
