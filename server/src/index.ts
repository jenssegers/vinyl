import Fastify from 'fastify';
import { config } from './config';
import { poller } from './poller';
import { eventsRoute } from './routes/events';
import { staticRoute } from './routes/static';
import { loadTokens } from './tokens';

const app = Fastify({ logger: { level: 'warn' } });

await app.register(eventsRoute);

if (process.env.NODE_ENV === 'production') {
  await app.register(staticRoute);
}

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`vinyl server listening on :${config.port}`);

// Start polling eagerly if tokens are available
if (loadTokens()) {
  poller.start();
  console.log('Spotify poller started');
} else {
  console.log('No Spotify tokens found — run npm run setup:spotify to connect');
}
