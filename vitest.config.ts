import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts'],
    // The server config is parsed on import, so tests need a valid environment.
    env: {
      SPOTIFY_CLIENT_ID: 'test-client-id',
      VINYL_ALLOWED_DEVICES: 'kitchen',
      VINYL_PAUSE_TO_OFF_MS: '10000',
      VINYL_FAKE_SCREEN: '1',
      // Failures are part of what the tests exercise, so keep their logs out of the output.
      CONSOLA_LEVEL: '-999',
    },
  },
});
