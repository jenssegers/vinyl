import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    index: path.join(root, 'src/index.ts'),
    'setup-spotify': path.join(root, 'src/setup-spotify.ts'),
  },
  format: ['esm'],
  target: 'node24',
  outDir: path.join(root, 'dist'),
  clean: true,
  sourcemap: true,
});
