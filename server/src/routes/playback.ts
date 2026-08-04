import { consola } from 'consola';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { poller } from '../poller';
import { pausePlayback, resumePlayback } from '../spotify';

const log = consola.withTag('playback');

const commandSchema = z.enum(['play', 'pause']);

const commands = {
  play: resumePlayback,
  pause: pausePlayback,
};

export async function playbackRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { command: string } }>('/api/playback/:command', async (request, reply) => {
    const command = commandSchema.safeParse(request.params.command);
    if (!command.success) {
      return reply.code(400).send({ error: `unknown command: ${request.params.command}` });
    }

    try {
      await commands[command.data]();
    } catch (err) {
      log.error(err as Error);
      return reply.code(502).send({ error: (err as Error).message });
    }

    log.info(command.data);
    poller.refreshSoon();
    return reply.code(204).send();
  });
}
