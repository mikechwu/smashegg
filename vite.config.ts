import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The client app lives at src/client and builds into dist/client, which
// is exactly the directory wrangler.jsonc's `assets.directory` serves
// (PLAN.md §1.1/§2). Build output is resolved to an absolute path via
// import.meta.url so `vite build` works the same regardless of cwd.
export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  // Dev-only: proxy the API + WebSocket to a local `wrangler dev` (port 8787)
  // so `npm run dev:client` gives HMR-fast UI iteration against the real DO
  // backend. Never affects `vite build`/deploy — the built Worker serves both
  // the assets and /api from one origin in production.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787', ws: true, changeOrigin: true },
    },
  },
  // Build identity for the version-skew signal (M4): the deploy workflow
  // injects the git SHA; a bare local build gets the 'dev' sentinel —
  // deliberately NO git fallback here, so local `vite build` + `wrangler
  // dev` agree on 'dev' and the client suppresses the skew check.
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION ?? 'dev'),
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    emptyOutDir: true,
  },
});
