import { consola } from 'consola';
import Fastify from 'fastify';
import { startBrightnessSchedule } from './brightness.ts';
import { config } from './config.ts';
import { eventsRoute } from './events-route.ts';
import { playbackRoute } from './playback-route.ts';
import { poller } from './poller.ts';
import { loadTokens } from './spotify/tokens.ts';
import { staticRoute } from './static-route.ts';

process.on('uncaughtException', (error) => {
  consola.error(error, 'uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  consola.error(
    reason instanceof Error ? reason : new Error(String(reason)),
    'unhandled rejection',
  );
  process.exit(1);
});

const log = consola.withTag('vinyl');
const app = Fastify({ logger: { level: 'warn' } });

if (config.fakeScreen) log.warn('fake screen mode, wlr-randr and backlight disabled');

const stopBrightnessSchedule = startBrightnessSchedule();

await app.register(eventsRoute);
await app.register(playbackRoute);
if (config.serveClient) await app.register(staticRoute);

await app.listen({ port: config.port, host: '0.0.0.0' });
log.info(`server listening on :${config.port}`);

if (loadTokens()) {
  poller.start();
  log.info('spotify poller started');
} else {
  log.warn('no spotify tokens found, run pnpm setup:spotify to connect');
}

const shutdown = async () => {
  poller.stop();
  stopBrightnessSchedule();
  await app.close().catch((error: unknown) => log.error(error, 'error during shutdown'));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
