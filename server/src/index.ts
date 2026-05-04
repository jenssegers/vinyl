import { consola } from 'consola';
import Fastify from 'fastify';
import { config } from './config';

import { poller } from './poller';
import { eventsRoute } from './routes/events';
import { staticRoute } from './routes/static';
import { loadTokens } from './tokens';

process.on('uncaughtException', (err) => {
  consola.error(err, 'uncaught exception');
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

if (config.fakeScreen) log.warn('fake screen mode — wlr-randr disabled');

await app.register(eventsRoute);

if (process.env.NODE_ENV === 'production') {
  await app.register(staticRoute);
}

await app.listen({ port: config.port, host: '0.0.0.0' });
log.info(`server listening on :${config.port}`);

if (loadTokens()) {
  poller.start();
  log.info('spotify poller started');
} else {
  log.warn('no spotify tokens found — run npm run setup:spotify to connect');
}

const shutdown = async () => {
  poller.stop();
  await app.close().catch((err: Error) => log.error(err, 'error during shutdown'));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
