// Room cleanup/inspection CLI (pause-and-retention.md §4). A companion to
// scripts/dump-room.ts for reclaiming ABANDONED rooms' storage on demand — the
// lazy-mode path for played-out/paused rooms (which never auto-purge, §3.1).
//
// Addressing: EXPLICIT room codes only. There is no way to enumerate rooms —
// idFromName is one-way, so the DO namespace-objects API can't recover codes
// (docs/research pass). The owner supplies the codes (STATUS.md records some).
//
// SAFETY:
//   - DRY-RUN by default: inspects each room and prints what WOULD be purged +
//     the estimated rows-written cost; deletes NOTHING without --delete.
//   - --delete: DUMP-FIRST (proves replay survives), verify the dump is
//     readable, THEN POST the token-gated purge route. deleteAll() is
//     irreversible — the confirmation is unmistakable in the output.
//   - Same gate as dump: dev servers are open; production needs --token
//     (DEBUG_DUMP_TOKEN, sent as x-debug-dump-token, constant-time compared).
//
// Node builtins (fetch/fs/process) live only here; checked under
// tsconfig.scripts.json.
//
// Usage:
//   npx vite-node scripts/cleanup-rooms.ts -- <baseUrl> <code...> [--token <t>] [--delete] [--force] [--dump-dir <dir>]
//
//   default        DRY RUN — inspect only, delete nothing
//   --delete       actually purge each room (dump-first, then POST /purge)
//   --force        override the DO's live-socket refusal (409) — the server
//                  refuses to purge a room with anyone attached otherwise
//   --dump-dir     where to write the pre-purge dumps (default: current dir)

interface RoomDump {
  gameId: string;
  seed: string | null;
  room: {
    status: string;
    code: string;
    pauseStartedAt: number | null;
    lastActiveAt: number | null;
  };
  seats: unknown[];
  snapshot: { seq: number };
  events: unknown[];
  actions: unknown[];
  actionsSeen: unknown[];
  deadlines: unknown[];
}

interface PurgeResult {
  ok: boolean;
  purged: {
    code: string;
    status: string;
    seq: number;
    rows: Record<string, number>;
    connectedSeats: number;
    liveSockets: number;
    pauseStartedAt: number | null;
    lastActiveAt: number | null;
  };
}

/** Rough rows-written cost of a deleteAll() if it is per-row billed (the
 *  conservative assumption until measured): every data row + the actions_seen
 *  auto-index (a TEXT PRIMARY KEY, +1/row) + the fixed singleton rows. Purely
 *  informational — the real per-purge delta is what the deleteAll() measurement
 *  would settle. */
function estimatedPurgeRows(d: RoomDump): number {
  return (
    d.events.length +
    d.actions.length +
    2 * d.actionsSeen.length + // b-tree row + auto-index row
    d.deadlines.length +
    d.seats.length +
    3 // snapshot + room + hello_state
  );
}

function fmtAge(ms: number | null): string {
  if (ms === null) return 'n/a';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

async function fetchDump(baseUrl: string, code: string, token?: string): Promise<RoomDump | null> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers['x-debug-dump-token'] = token;
  const res = await fetch(`${baseUrl}/api/rooms/${code}/dump`, { headers });
  if (res.status === 404) return null; // gone, or (indistinguishably) unauthorized
  if (!res.ok) throw new Error(`dump ${code}: ${res.status} ${await res.text()}`);
  return (await res.json()) as RoomDump;
}

/** 409 body when the DO refuses a purge because sockets are still attached
 *  (the server-side "last gate" — someone may be mid-game behind that code). */
interface PurgeRefusal {
  error: 'room.hasLiveSockets';
  liveSockets: number;
  connectedSeats: number;
}

async function purge(
  baseUrl: string,
  code: string,
  token?: string,
  force = false,
): Promise<PurgeResult | PurgeRefusal> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers['x-debug-dump-token'] = token;
  const url = `${baseUrl}/api/rooms/${code}/purge${force ? '?force=1' : ''}`;
  const res = await fetch(url, { method: 'POST', headers });
  if (res.status === 409) return (await res.json()) as PurgeRefusal;
  if (!res.ok) throw new Error(`purge ${code}: ${res.status} ${await res.text()}`);
  return (await res.json()) as PurgeResult;
}

async function runCli(args: string[]): Promise<number> {
  const positional: string[] = [];
  let token: string | undefined;
  let doDelete = false;
  let dumpDir = '.';
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--delete') doDelete = true;
    else if (arg === '--force') force = true;
    else if (arg === '--token') token = args[++i];
    else if (arg === '--dump-dir') dumpDir = args[++i] ?? '.';
    else positional.push(arg);
  }
  const [baseUrl, ...codes] = positional;
  if (!baseUrl || codes.length === 0) {
    console.error(
      'Usage: npx vite-node scripts/cleanup-rooms.ts -- <baseUrl> <code...> [--token <t>] [--delete] [--force] [--dump-dir <dir>]',
    );
    return 1;
  }
  const base = baseUrl.replace(/\/$/, '');

  console.log(doDelete ? '=== PURGE (dump-first, irreversible) ===' : '=== DRY RUN (inspect only — nothing deleted) ===');
  const fs = doDelete ? await import('node:fs') : null;
  let purgedCount = 0;
  let refusedCount = 0;

  for (const code of codes) {
    const dump = await fetchDump(base, code, token);
    if (dump === null) {
      console.log(`  ${code}: not found (already gone, or token rejected)`);
      continue;
    }
    const cost = estimatedPurgeRows(dump);
    const paused = dump.room.status === 'playing' && dump.room.pauseStartedAt !== null;
    console.log(
      `  ${code}: status=${dump.room.status}${paused ? ' (paused)' : ''} seq=${dump.snapshot.seq} ` +
        `rows≈{events:${dump.events.length},actions:${dump.actions.length},seen:${dump.actionsSeen.length},` +
        `deadlines:${dump.deadlines.length},seats:${dump.seats.length}} lastActive=${fmtAge(dump.room.lastActiveAt)} ` +
        `est.purge≈${cost} rows-written`,
    );

    if (!doDelete) {
      console.log(`    → would purge (dry run; re-run with --delete to reclaim)`);
      continue;
    }

    // DUMP-FIRST: persist the replay artifact, verify it's readable, THEN purge.
    const path = `${dumpDir.replace(/\/$/, '')}/${code}.dump.json`;
    fs!.writeFileSync(path, JSON.stringify(dump, null, 2));
    const readBack = JSON.parse(fs!.readFileSync(path, 'utf8')) as RoomDump;
    if (readBack.snapshot.seq !== dump.snapshot.seq) {
      console.error(`    ✗ dump verify failed for ${code} — NOT purging`);
      return 1;
    }
    console.log(`    ✓ dumped → ${path} (replay preserved)`);
    const result = await purge(base, code, token, force);
    if ('error' in result) {
      // The DO's own live-socket gate (the most defensive last gate): someone
      // is attached to that room RIGHT NOW — a typo'd code, most likely.
      console.error(
        `    ✗ REFUSED ${code}: ${result.liveSockets} live socket(s), ` +
          `${result.connectedSeats} connected seat(s) — is this the right room? ` +
          `(re-run with --force to override)`,
      );
      refusedCount++;
      continue;
    }
    console.log(`    ✓ PURGED ${code}: reclaimed ${JSON.stringify(result.purged.rows)}`);
    purgedCount++;
  }

  console.log(
    doDelete
      ? `\nDone: ${purgedCount}/${codes.length} purged` +
          `${refusedCount > 0 ? `, ${refusedCount} REFUSED (live sockets)` : ''} ` +
          `(dumps written; deleteAll() is irreversible).`
      : `\nDry run complete. Nothing was deleted.`,
  );
  // A refused purge is a failed run for automation (Grok audit): exit status
  // must not read "clean" when rooms were skipped behind a live-socket gate.
  return refusedCount > 0 ? 1 : 0;
}

// Entry-point detection (same rationale as scripts/dump-room.ts): under
// vite-node, process.argv[1] is vite-node's bin; tests import under vitest.
const isMainModule = typeof process !== 'undefined' && /vite-node(\/|$)/.test(process.argv[1] ?? '');

if (isMainModule) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`cleanup-rooms.ts: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}

export { estimatedPurgeRows, fmtAge };
