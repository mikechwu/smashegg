import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts: that file sets `root:
// "src/client"` for the app build, which would otherwise silently scope
// (or break) test discovery if reused here. Vitest gets its own config
// with the repo root as its root, so tests/unit is found regardless of
// the client app's Vite root.
export default defineConfig({
  // Automatic JSX runtime, matching the app build (@vitejs/plugin-react):
  // the DeckTheme conformance suite renders real components via
  // react-dom/server (still DOM-free), which needs jsx transforms here.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
