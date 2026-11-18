import { fastifySSE } from '@fastify/sse';
import { consola } from 'consola';
import type { FastifyInstance } from 'fastify';
import type { Display } from '../../shared/display.ts';
import { poller } from './poller.ts';

const log = consola.withTag('sse');

function describe(display: Display): string {
  switch (display.kind) {
    case 'off':
      return 'off';
    case 'error':
      return `error: ${display.message}`;
    default:
      return `${display.kind}: "${display.track.name}" by ${display.track.artist}`;
  }
}

/** Pushes every `Display` change to the client over SSE: https://github.com/fastify/sse */
export async function eventsRoute(app: FastifyInstance): Promise<void> {
  await app.register(fastifySSE);

  app.get('/events', { sse: 'only' }, async (_request, reply) => {
    // The stream outlives this handler, until the client disconnects.
    reply.sse.keepAlive();

    const send = (display: Display): void => {
      log.info(describe(display));
      reply.sse.send({ data: display }).catch((error: unknown) => log.warn(error, 'send failed'));
    };

    // Send the current state right away, so the client renders without waiting for a change.
    send(poller.getState());
    poller.on('change', send);
    reply.sse.onClose(() => poller.off('change', send));
  });
}
