import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { eventsRoute } from './events-route.ts';

it('ends open event streams on shutdown, so the server stops right away', async () => {
  const app = Fastify();
  await app.register(eventsRoute);
  const address = await app.listen({ port: 0, host: '127.0.0.1' });

  const response = await fetch(`${address}/events`, { headers: { accept: 'text/event-stream' } });
  const stream = response.body?.getReader();
  const first = await stream?.read();
  expect(new TextDecoder().decode(first?.value)).toContain('"kind":"off"');

  // Without closing the streams, this waits for the client forever and the test times out.
  await app.close();
  expect((await stream?.read())?.done).toBe(true);
});
