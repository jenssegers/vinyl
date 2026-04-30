import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))

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
      '/auth': 'http://localhost:3000',
    },
  },
})
