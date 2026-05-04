import { consola } from 'consola';
import type { FastifyInstance } from 'fastify';
import { type Display, poller } from '../poller';

const log = consola.withTag('sse');

export async function eventsRoute(app: FastifyInstance): Promise<void> {
  app.get('/events', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (display: Display): void => {
      log.info(
        display.kind === 'off'
          ? 'off'
          : `${display.kind}: "${display.track.name}" — ${display.track.artist}`,
      );
      reply.raw.write(`data: ${JSON.stringify(display)}\n\n`);
    };

    // Send current state immediately so the client renders without waiting
    send(poller.getState());

    // Fan out subsequent changes
    poller.on('change', send);

    // Keep connection alive across idle periods
    const heartbeat = setInterval(() => {
      reply.raw.write(': keepalive\n\n');
    }, 25_000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      poller.off('change', send);
    });
  });
}
