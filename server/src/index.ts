import { consola } from 'consola';
import Fastify from 'fastify';
import { config } from './config';

import { poller } from './poller';
import { eventsRoute } from './routes/events';
import { staticRoute } from './routes/static';
import { loadTokens } from './tokens';

const log = consola.withTag('vinyl');
const app = Fastify({ logger: { level: 'warn' } });

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
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
