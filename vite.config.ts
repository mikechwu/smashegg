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
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    emptyOutDir: true,
  },
});
