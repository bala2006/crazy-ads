import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The whole app (SPA + API + renderer) is served by one Express process on 3001.
 * Vite runs in middleware mode inside that process, so this config is only used
 * for transforms/HMR here and for `vite build` in production.
 *
 * Dev preview hostnames are allow-listed explicitly (never a blanket wildcard).
 */
const previewHost = process.env.PREVIEW_HOST ?? 'pv-f2b76f614197-677e7bc6-934c-449b-be14-69fb50122f19.style.dev';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', previewHost],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
