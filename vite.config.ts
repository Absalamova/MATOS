import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Store (matos.uz). The admin app has its own config in admin/vite.config.ts. */
export default defineConfig({
  // Relative base: the same build works on matos.uz and on username.github.io/MATOS/
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
