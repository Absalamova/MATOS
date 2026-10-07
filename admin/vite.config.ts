import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Seller panel (admin.matos.uz): `npm run dev:admin`, `npm run build:admin` → admin/dist */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5174,
    // shared/ and src/lib live outside admin/
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  preview: { port: 4174 },
});
