import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/events': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
