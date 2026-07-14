// Replay CLI — the only file that touches node builtins (fs/process); the
// importable core lives in ./replay (engine-pure, checked under the client
// tsconfig via tests). This file is checked under tsconfig.scripts.json.
//
// Usage: npx vite-node scripts/replay-cli.ts -- <artifact.json>

import { replayMatch, type ReplayActionEntry, type ReplaySnapshot } from './replay';

/** The replay artifact (see scripts/replay.ts header): gameId/seats are
 *  optional — absent means 'guandan' / game.maxSeats (M1 back-compat). */
interface ArtifactFile {
  gameId?: string;
  seed: string;
  config: unknown;
  seats?: number;
  actions: ReplayActionEntry[];
  snapshots?: ReplaySnapshot[];
}

async function runCli(filePath: string): Promise<number> {
  const fs = await import('node:fs');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const artifact = JSON.parse(raw) as ArtifactFile;

  const result = replayMatch(
    {
      ...(artifact.gameId !== undefined ? { gameId: artifact.gameId } : {}),
      seed: artifact.seed,
      config: artifact.config,
      ...(artifact.seats !== undefined ? { seats: artifact.seats } : {}),
      actions: artifact.actions,
    },
    artifact.snapshots ? { snapshots: artifact.snapshots } : undefined,
  );

  // Flatten to exactly the spec'd verdict shape; a rejection (no snapshot
  // mismatch involved) is reported through the same `divergence` key so the
  // CLI's one-line contract stays fixed, while the richer `rejection` detail
  // remains available to library callers via ReplayResult directly.
  const divergence =
    result.divergence ??
    (result.rejection
      ? { seq: result.rejection.seq, expected: 'a legal, accepted action', actual: result.rejection.error }
      : undefined);

  const verdict: { ok: boolean; seqs: number; divergence?: unknown } = {
    ok: result.ok,
    seqs: artifact.actions.length,
    ...(divergence ? { divergence } : {}),
  };

  console.log(JSON.stringify(verdict));
  return result.ok ? 0 : 1;
}

// Only run the CLI when this file is the entry point (not when imported by
// tests) — vite-node invocation: `npx vite-node scripts/replay-cli.ts -- <file>`.
// Under vite-node, process.argv[1] is vite-node's own bin (the script path
// isn't reflected there), so entry-point detection can't compare against
// this file's own path; instead detect "running under the vite-node CLI at
// all" — accurate here because tests import this module under vitest, a
// different bin, never vite-node.
const isMainModule = typeof process !== 'undefined' && /vite-node(\/|$)/.test(process.argv[1] ?? '');

if (isMainModule) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx vite-node scripts/replay-cli.ts -- <artifact.json>');
    process.exit(1);
  } else {
    runCli(filePath).then(
      (code) => process.exit(code),
      (e) => {
        console.error(`replay.ts: unexpected failure: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      },
    );
  }
}
