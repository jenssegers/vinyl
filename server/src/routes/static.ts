import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';

export async function staticRoute(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: config.clientDist,
    prefix: '/',
  });

  // SPA fallback: unknown routes serve index.html for client-side navigation
  app.setNotFoundHandler((_req, reply) => {
    void reply.sendFile('index.html');
  });
}
