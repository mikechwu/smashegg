// E2E harness helpers (M2 gate, PLAN.md §9): spawn a real `wrangler dev`
// process (workerd local mode) and drive it with real WebSocket clients
// speaking the PLAN §5 wire protocol from src/shared/protocol.ts.
//
// These tests rely ONLY on the wire protocol, the Worker HTTP routes, and
// documented behavior (dump route per PLAN §6) — never on GameRoom
// internals — so they stay valid while that file evolves.
//
// SECURITY NOTE (PLAN §8): raw seat tokens live only in test memory. They
// are never logged — timeout diagnostics redact the `seatClaimed.token`
// field — and never persisted (the server persists hashes only).

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Seat } from '../../src/engine/core/game';
import type { GNView } from '../../src/engine/guess-number';
import type { ClientMessage, RoomInfo, ServerMessage } from '../../src/shared/protocol';
import type { RoomTiming } from '../../src/shared/timing';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WRANGLER_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'wrangler');

// Handy narrowed message aliases for assertions.
export type EventMsg = Extract<ServerMessage, { type: 'event' }>;
export type ResyncMsg = Extract<ServerMessage, { type: 'resync' }>;
export type WelcomeMsg = Extract<ServerMessage, { type: 'welcome' }>;
export type RejectedMsg = Extract<ServerMessage, { type: 'rejected' }>;
export type SeatClaimedMsg = Extract<ServerMessage, { type: 'seatClaimed' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// wrangler dev lifecycle
// ---------------------------------------------------------------------------

export interface DevServer {
  port: number;
  url: string;
  /** The --persist-to directory. Reusing it across a stop()/startServer()
   *  pair is what preserves Durable Object state for the restart test. */
  persistDir: string;
  stop(): Promise<void>;
}

/** Every server ever started, so afterAll can reap survivors even when a
 *  test fails between its own start() and stop(). */
const liveServers = new Set<DevServer>();

/** Ask the OS for a free port by binding port 0 and reading what we got. */
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (address === null || typeof address === 'string') {
        srv.close();
        reject(new Error('could not allocate a free port'));
        return;
      }
      const { port } = address;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/** A fresh scratch --persist-to directory, unique per call — CRITICAL: two
 *  concurrently-running wrangler instances must never share one, and every
 *  test run starts from clean DO state unless it deliberately reuses the
 *  dir across a restart. */
export function makePersistDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'smashegg-e2e-'));
}

async function killProcessTree(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  // wrangler spawns workerd as a child; the process was started detached so
  // kill(-pid) reaps the whole group, not just the wrapper.
  const signal = (sig: NodeJS.Signals): void => {
    try {
      if (child.pid !== undefined && process.platform !== 'win32') process.kill(-child.pid, sig);
      else child.kill(sig);
    } catch {
      // Already gone — fine.
    }
  };
  signal('SIGTERM');
  const graceful = await Promise.race([exited.then(() => true), sleep(8_000).then(() => false)]);
  if (!graceful) {
    signal('SIGKILL');
    await exited;
  }
}

/**
 * Spawn `wrangler dev` on a free port with the given (or a fresh) persist
 * dir, wait until GET /api/health answers, and hand back a stop() that
 * reaps the whole process tree. ENVIRONMENT=dev is forced via --var so the
 * dump route (PLAN §6) is open both locally and in CI (which has no
 * .dev.vars file).
 */
export async function startServer(
  opts: { persistDir?: string; buildVersion?: string } = {},
): Promise<DevServer> {
  const persistDir = opts.persistDir ?? makePersistDir();
  const port = await getFreePort();
  // Each instance needs its own inspector port too, or a second concurrent
  // `wrangler dev` (the restart test overlaps the shared one) fails to boot.
  const inspectorPort = await getFreePort();

  const child = spawn(
    WRANGLER_BIN,
    [
      'dev',
      '--port', String(port),
      '--ip', '127.0.0.1',
      '--inspector-port', String(inspectorPort),
      '--persist-to', persistDir,
      '--var', 'ENVIRONMENT:dev',
      // Same --var pattern as ENVIRONMENT: version-skew tests pin an exact
      // server build string; omitted = the 'dev' sentinel (skew-silent).
      ...(opts.buildVersion !== undefined ? ['--var', `BUILD_VERSION:${opts.buildVersion}`] : []),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        // Task-note belt and braces: some wrangler subprocess resolution
        // paths want node_modules/.bin on PATH.
        PATH: `${path.join(REPO_ROOT, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        WRANGLER_SEND_METRICS: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      // Own process group so stop() can signal wrangler AND workerd together.
      detached: process.platform !== 'win32',
    },
  );

  // Keep a bounded tail of output for startup-failure diagnostics.
  let output = '';
  const collect = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-8_000);
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);

  let exitedEarly = false;
  child.once('exit', () => {
    exitedEarly = true;
  });

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (exitedEarly) {
      throw new Error(`wrangler dev exited during startup.\n--- output tail ---\n${output}`);
    }
    if (Date.now() > deadline) {
      await killProcessTree(child);
      throw new Error(`wrangler dev did not become healthy in 90s.\n--- output tail ---\n${output}`);
    }
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok === true) break;
      }
    } catch {
      // Not listening yet — keep polling.
    }
    await sleep(250);
  }

  const server: DevServer = {
    port,
    url,
    persistDir,
    async stop() {
      liveServers.delete(server);
      await killProcessTree(child);
    },
  };
  liveServers.add(server);
  return server;
}

/** Reap every still-running server — call from afterAll so a failing test
 *  can never leak wrangler/workerd processes. */
export async function stopAllServers(): Promise<void> {
  await Promise.all([...liveServers].map((s) => s.stop()));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Create a room for any registered game — the same POST /api/rooms call
 *  HomePage.handleCreate makes (body: { gameId, config, timing? }). Omitted
 *  timing = the server-side default (the 'standard' preset, M4). */
export async function createRoomFor(
  server: DevServer,
  gameId: string,
  config: unknown,
  timing?: unknown,
): Promise<string> {
  const res = await fetch(`${server.url}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(timing === undefined ? { gameId, config } : { gameId, config, timing }),
  });
  if (res.status !== 201) throw new Error(`createRoomFor failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

export async function createRoom(server: DevServer, config: unknown): Promise<string> {
  return createRoomFor(server, 'guess-number', config);
}

export async function getRoomInfo(server: DevServer, code: string): Promise<RoomInfo> {
  const res = await fetch(`${server.url}/api/rooms/${code}`);
  if (!res.ok) throw new Error(`getRoomInfo failed: ${res.status}`);
  return (await res.json()) as RoomInfo;
}

/** Room dump (PLAN §6, dev-gated — always open here because startServer
 *  forces ENVIRONMENT=dev). Contains token HASHES only, never raw tokens. */
export async function getDump(server: DevServer, code: string): Promise<{
  room: { gameId: string; config: unknown; status: string; code: string };
  snapshot: { seq: number; state: Record<string, unknown> | null };
  events: { seq: number; events: unknown[] }[];
}> {
  const res = await fetch(`${server.url}/api/rooms/${code}/dump`);
  if (!res.ok) throw new Error(`dump failed: ${res.status}`);
  return (await res.json()) as Awaited<ReturnType<typeof getDump>>;
}

// ---------------------------------------------------------------------------
// WebSocket client wrapper (Node 22+ built-in WebSocket)
// ---------------------------------------------------------------------------

/** Redact raw seat tokens before a message can appear in an error string
 *  (PLAN §8: never log raw tokens — timeout diagnostics included). */
function redactForDiagnostics(msg: ServerMessage): ServerMessage {
  if (msg.type === 'seatClaimed' && msg.token !== undefined) {
    return { ...msg, token: '[redacted]' };
  }
  return msg;
}

interface Waiter {
  predicate: (msg: ServerMessage) => boolean;
  resolve: (msg: ServerMessage) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class WsClient {
  /** Every ServerMessage received, in arrival order — the inspectable log. */
  readonly log: ServerMessage[] = [];
  private readonly waiters = new Set<Waiter>();

  private constructor(private readonly ws: WebSocket, readonly label: string) {}

  static async connect(server: DevServer, code: string, label = 'client'): Promise<WsClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/api/rooms/${code}/ws`);
    const client = new WsClient(ws, label);
    ws.addEventListener('message', (ev) => {
      // The protocol is JSON envelopes only (the bare 'pong' auto-response
      // would be the one exception; these tests never send bare pings).
      const msg = JSON.parse(String(ev.data)) as ServerMessage;
      client.log.push(msg);
      for (const waiter of client.waiters) {
        if (waiter.predicate(msg)) {
          client.waiters.delete(waiter);
          clearTimeout(waiter.timer);
          waiter.resolve(msg);
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error(`${label}: websocket failed to connect`)), {
        once: true,
      });
    });
    return client;
  }

  /** Current log length — pass as waitFor's `from` to only match messages
   *  that arrive after this point (race-safe: capture BEFORE sending). */
  mark(): number {
    return this.log.length;
  }

  /**
   * Resolve with the first message matching `predicate`, scanning already-
   * received messages from index `from` (default 0: whole log) before
   * waiting for new ones.
   */
  waitFor<T extends ServerMessage = ServerMessage>(
    predicate: (msg: ServerMessage) => boolean,
    opts: { from?: number; timeoutMs?: number } = {},
  ): Promise<T> {
    const { from = 0, timeoutMs = 20_000 } = opts;
    for (let i = from; i < this.log.length; i++) {
      const msg = this.log[i];
      if (msg !== undefined && predicate(msg)) return Promise.resolve(msg as T);
    }
    return new Promise<T>((resolve, reject) => {
      const waiter: Waiter = {
        predicate,
        resolve: resolve as (msg: ServerMessage) => void,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          const tail = this.log.slice(-6).map(redactForDiagnostics);
          reject(
            new Error(
              `${this.label}: timed out after ${timeoutMs}ms waiting for a message; ` +
                `log has ${this.log.length} messages, tail: ${JSON.stringify(tail)}`,
            ),
          );
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  private sendMsg(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  hello(tokens: string[], lastSeenSeq = 0): void {
    this.sendMsg({ v: 1, type: 'hello', tokens, lastSeenSeq });
  }

  claimSeat(name: string): void {
    this.sendMsg({ v: 1, type: 'claimSeat', name });
  }

  setConfig(config: unknown): void {
    this.sendMsg({ v: 1, type: 'setConfig', config });
  }

  setTiming(timing: RoomTiming): void {
    this.sendMsg({ v: 1, type: 'setTiming', timing });
  }

  start(): void {
    this.sendMsg({ v: 1, type: 'start' });
  }

  /** Send a game action; returns the generated actionId so callers can
   *  match the corresponding `rejected` (or dedup) response. */
  action(seat: Seat, action: unknown, opts: { expectedSeq?: number; actionId?: string } = {}): string {
    const actionId = opts.actionId ?? randomUUID();
    this.sendMsg({ v: 1, type: 'action', seat, actionId, expectedSeq: opts.expectedSeq ?? 0, action });
    return actionId;
  }

  close(): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`${this.label}: closed while waiting`));
    }
    this.waiters.clear();
    try {
      this.ws.close();
    } catch {
      // Already closed — fine.
    }
  }
}

/** Connect + hello + await the welcome — the standard session opener. */
export async function connectAndWelcome(
  server: DevServer,
  code: string,
  opts: { tokens?: string[]; lastSeenSeq?: number; label?: string } = {},
): Promise<{ client: WsClient; welcome: WelcomeMsg }> {
  const client = await WsClient.connect(server, code, opts.label ?? 'client');
  const mark = client.mark();
  client.hello(opts.tokens ?? [], opts.lastSeenSeq ?? 0);
  const welcome = await client.waitFor<WelcomeMsg>((m) => m.type === 'welcome', { from: mark });
  return { client, welcome };
}

/** Claim the next free seat and return {seat, token}. The claimer's own
 *  copy of seatClaimed is the one carrying the minted token. */
export async function claimSeat(client: WsClient, name: string): Promise<{ seat: Seat; token: string }> {
  const mark = client.mark();
  client.claimSeat(name);
  const claimed = await client.waitFor<SeatClaimedMsg>(
    (m) => m.type === 'seatClaimed' && m.token !== undefined,
    { from: mark },
  );
  return { seat: claimed.seat, token: claimed.token as string };
}

// ---------------------------------------------------------------------------
// guess-number game driver
// ---------------------------------------------------------------------------

export interface SeatHolder {
  client: WsClient;
  seats: Seat[];
}

/** The binary-search guess for the acting view's current round, recomputed
 *  statelessly from the public guess history (so it stays correct even if a
 *  server-side timeout auto-played a guess we didn't send). */
export function nextGuess(view: GNView): number {
  let lo = 1;
  let hi: number = view.config.rangeMax;
  for (const g of view.guesses) {
    if (g.round !== view.round) continue;
    if (g.verdict === 'higher') lo = Math.max(lo, g.value + 1);
    else if (g.verdict === 'lower') hi = Math.min(hi, g.value - 1);
  }
  return Math.floor((lo + hi) / 2);
}

/** Wait for the first fan-out event at/after `fromSeq` on this client and
 *  return its authoritative view — the driver's starting point. */
export async function awaitInitialView(
  client: WsClient,
  fromSeq: number,
): Promise<{ view: GNView; seq: number }> {
  const msg = await client.waitFor<EventMsg>((m) => m.type === 'event' && m.seq >= fromSeq);
  return { view: msg.view as GNView, seq: msg.seq };
}

/**
 * Play guess-number to matchEnd: each turn, the holder of the acting seat
 * submits the binary-search midpoint and waits for its own event copy.
 * Views are authoritative (view-carrying events, PLAN §5) so the driver is
 * a pure function of the last received view. Also asserts the hints
 * contract along the way: the chosen guess must be among the acting seat's
 * server-provided legal-action hints.
 */
export async function driveToMatchEnd(
  holders: SeatHolder[],
  start: { view: GNView; seq: number },
): Promise<{ view: GNView; seq: number }> {
  let { view, seq } = start;
  // 4 seats × best-of-3 × log2(1000) leaves huge headroom below 300 steps.
  for (let step = 0; step < 300; step++) {
    if (view.phase === 'matchEnd') return { view, seq };
    const toAct = view.toAct;
    const holder = holders.find((h) => h.seats.includes(toAct));
    if (!holder) throw new Error(`no test client holds the acting seat ${toAct}`);
    const value = nextGuess(view);
    const guess = { type: 'guess', value };

    // hints contract (PLAN §5): the acting seat's latest event/resync copy
    // carries its legal actions, and the midpoint guess is always one of
    // them (guess-number's legalActions includes the midpoint).
    const hintMsg = [...holder.client.log]
      .reverse()
      .find(
        (m): m is EventMsg | ResyncMsg =>
          (m.type === 'event' || m.type === 'resync') && m.seat === toAct && m.seq === seq,
      );
    if (hintMsg?.hints !== undefined) {
      const hinted = hintMsg.hints.some((h) => JSON.stringify(h) === JSON.stringify(guess));
      if (!hinted) {
        throw new Error(`driver guess ${value} not among hints ${JSON.stringify(hintMsg.hints)}`);
      }
    }

    const mark = holder.client.mark();
    const actionId = holder.client.action(toAct, guess, { expectedSeq: seq });
    const reply = await holder.client.waitFor(
      (m) =>
        (m.type === 'event' && m.seat === toAct && m.seq > seq) ||
        (m.type === 'rejected' && m.actionId === actionId),
      { from: mark },
    );
    if (reply.type === 'rejected') {
      throw new Error(`guess by seat ${toAct} rejected: ${reply.error.code}`);
    }
    view = (reply as EventMsg).view as GNView;
    seq = reply.seq;
  }
  throw new Error('game did not reach matchEnd within 300 steps');
}
