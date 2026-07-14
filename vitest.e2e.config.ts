import { defineConfig } from 'vitest/config';

// E2E harness config (M2 gate) — deliberately separate from vitest.config.ts
// so `npm test` stays fast/pure-unit and never spawns wrangler. Each e2e
// file boots real `wrangler dev` processes, so:
//   - long testTimeout/hookTimeout (wrangler cold start in CI can take tens
//     of seconds, and the kill/restart test boots it twice);
//   - fileParallelism off, so concurrent files never fight over ports or
//     spawn a pile of workerd processes;
//   - no coverage (the code under test runs inside workerd, not this
//     process — coverage numbers here would be meaningless noise).
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    coverage: { enabled: false },
  },
});
