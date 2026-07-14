// Room-dump CLI (PLAN.md §6 — "a scripts/dump-room.ts wrapper invokes the
// dump route for local/live diagnosis"). Fetches a room's debug dump over
// HTTP, prints it, derives the deterministic replay artifact from it, and
// (with --replay) proves the dump→replay roundtrip: the state replayed from
// (gameId, seed, config, action log) must DEEP-EQUAL the dump's
// authoritative snapshot.state.
//
// Node builtins (fetch/fs/process) live ONLY here — the replay core it
// drives (scripts/replay.ts) stays engine-pure. Checked under
// tsconfig.scripts.json.
//
// Usage:
//   npx vite-node scripts/dump-room.ts -- <baseUrl> <roomCode> [--token <dumpToken>] [--replay]
//
//   <baseUrl>   e.g. http://127.0.0.1:8801 (wrangler dev) or the deployed origin
//   --token     sent as the x-debug-dump-token header (needed outside dev,
//               where the route is gated on DEBUG_DUMP_TOKEN — PLAN §6)
//   --replay    replay the artifact and print a one-line JSON verdict
//
// Output: the full dump JSON, then a `<roomCode>.replay.json` artifact in
// the current directory, then (with --replay) one line of verdict JSON.

import { deepEqual, replayMatch, type ReplayInput } from './replay';

/** The dump payload shape served by GameRoom.handleDump — only the fields
 *  this CLI reads; the full payload is printed verbatim regardless. */
interface RoomDump {
  gameId: string;
  /** null until the room leaves the lobby (no match to replay yet). */
  seed: string | null;
  room: { gameId: string; config: unknown; status: string; code: string };
  seats: { seat: number; name: string | null; tokenHash: string }[];
  snapshot: { seq: number; state: unknown };
  actions: { seq: number; seat: number; actionId: string; action: unknown }[];
}

/** Derive the replay artifact from a dump. The dump's action rows carry
 *  room seqs (which also count lobby mutations); the artifact drops them
 *  and keeps only the order — replayMatch renumbers from init = seq 0. */
export function artifactFromDump(dump: RoomDump): ReplayInput {
  if (typeof dump.seed !== 'string' || dump.seed.length === 0) {
    // Locale-free code; the caller turns this into an exit status.
    throw new Error('dump.noSeed');
  }
  return {
    gameId: dump.gameId,
    seed: dump.seed,
    config: dump.room.config,
    // game.init's seats arg was the claimed-seat count at start; seats can
    // only be claimed in the lobby, so the dump's seat rows reproduce it.
    seats: dump.seats.length,
    actions: dump.actions.map((row) => ({ seat: row.seat, action: row.action })),
  };
}

async function runCli(args: string[]): Promise<number> {
  const positional: string[] = [];
  let token: string | undefined;
  let doReplay = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--replay') doReplay = true;
    else if (arg === '--token') token = args[++i];
    else positional.push(arg);
  }
  const [baseUrl, roomCode] = positional;
  if (!baseUrl || !roomCode) {
    console.error('Usage: npx vite-node scripts/dump-room.ts -- <baseUrl> <roomCode> [--token <dumpToken>] [--replay]');
    return 1;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/rooms/${roomCode}/dump`;
  const headers: Record<string, string> = {};
  if (token !== undefined) headers['x-debug-dump-token'] = token;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(JSON.stringify({ ok: false, error: 'dump.fetchFailed', status: res.status, url }));
    return 1;
  }
  const dump = (await res.json()) as RoomDump;

  // 1) The dump itself, pretty-printed — the primary diagnosis affordance.
  console.log(JSON.stringify(dump, null, 2));

  // 2) The derived replay artifact, written next to the caller.
  let artifact: ReplayInput;
  try {
    artifact = artifactFromDump(dump);
  } catch (e) {
    console.error(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), roomCode }),
    );
    return 1;
  }
  const fs = await import('node:fs');
  const artifactPath = `${roomCode}.replay.json`;
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.error(`wrote ${artifactPath}`);

  if (!doReplay) return 0;

  // 3) The roundtrip proof: replaying (gameId, seed, config, actions) must
  // land exactly on the dump's authoritative snapshot state.
  const result = replayMatch(artifact);
  const finalMatches = result.ok && deepEqual(result.finalState, dump.snapshot.state);
  const verdict: Record<string, unknown> = {
    ok: finalMatches,
    roomCode,
    gameId: artifact.gameId,
    actions: artifact.actions.length,
    snapshotSeq: dump.snapshot.seq,
  };
  if (!result.ok) {
    // Structured replay failure (rejection or snapshot divergence).
    verdict['replay'] = { rejection: result.rejection ?? null, divergence: result.divergence ?? null };
  } else if (!finalMatches) {
    verdict['error'] = 'replay.finalStateMismatch';
  }
  console.log(JSON.stringify(verdict));
  return finalMatches ? 0 : 1;
}

// Entry-point detection, same rationale as scripts/replay-cli.ts: under
// vite-node, process.argv[1] is vite-node's own bin, so detect "running
// under the vite-node CLI at all" — tests import this module under vitest,
// a different bin, never vite-node.
const isMainModule = typeof process !== 'undefined' && /vite-node(\/|$)/.test(process.argv[1] ?? '');

if (isMainModule) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`dump-room.ts: unexpected failure: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
