import { consola } from 'consola';
import type { FastifyInstance } from 'fastify';
import { playbackCommandSchema } from '../../shared/display.ts';
import { poller } from './poller.ts';
import { sendPlaybackCommand } from './spotify/client.ts';

const log = consola.withTag('playback');

export async function playbackRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { command: string } }>('/api/playback/:command', async (request, reply) => {
    const command = playbackCommandSchema.safeParse(request.params.command);
    if (!command.success) {
      return reply.code(400).send({ error: `unknown command: ${request.params.command}` });
    }

    try {
      await sendPlaybackCommand(command.data);
    } catch (error) {
      log.error(error);
      return reply.code(502).send({ error: String(error) });
    }

    log.info(command.data);
    poller.refreshSoon();
    return reply.code(204).send();
  });
}
