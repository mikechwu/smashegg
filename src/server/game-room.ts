// GameRoom Durable Object — M2 (PLAN.md §4 transport/session, §5 protocol,
// §6 debuggability). One DO instance per room code, SQLite-backed,
// WebSocket Hibernation API throughout (docs/research/reconnection-patterns
// §1 is the canonical shape this follows).
//
// GAME-AGNOSTICISM (the M2 proof, PLAN §9): this file imports ONLY from
// '../shared/protocol', '../shared/games', '../shared/timing',
// '../engine/core/*', './room-helpers' (pure extractions of this file's
// own logic), './index' (the Env type), and 'cloudflare:workers'. ZERO
// imports from engine/guandan or engine/guess-number — compile-proven at
// the gate. Timing follows the same discipline: the DO maps an OPAQUE
// class label through room config and never learns what a Guandan hand
// start is.
//
// HIBERNATION DISCIPLINE (PLAN §4): sockets are accepted with NO tags
// (seats are unknown at upgrade time — a connection only acquires seats via
// hello tokens / claimSeat afterwards); the durable per-socket identity is
// serializeAttachment({ seats }), updated whenever the held-seat set
// changes; the constructor rebuilds the socket→seats map from
// getWebSockets() + deserializeAttachment(); every in-memory structure here
// is a REBUILDABLE CACHE, never authoritative — SQLite is the truth.
//
// The M0 /hello + /status endpoints and the hello_state table are kept
// verbatim as the permanent live G-ALARM probe (PLAN §9 gates); its alarm
// now shares the single per-DO alarm slot with turn deadlines via
// scheduleAlarm().

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import type { Seat } from '../engine/core/game';
import { getGame, type AnyGameDefinition } from '../shared/games';
import type {
  ClientMessage,
  HelloStatus,
  RoomInfo,
  RoomStatus,
  SeatInfo,
  ServerMessage,
  WireError,
} from '../shared/protocol';
import {
  alarmCandidates,
  bytesToHex,
  deltaCoversGap,
  isPausedRoom,
  isStaleSocket,
  mayAutoPlay,
  nextDeadlines,
  redactEventsFor,
  resolveTimeoutMs,
  resolveTimingClass,
  resumeOffsetMs,
  sha256Hex,
  socketLastSeen,
  STALE_SOCKET_MS,
  timeoutActionId,
  timingSafeEqualStr,
  toWireDeadlines,
  type DeadlineEntry,
} from './room-helpers';
import { DEFAULT_ROOM_TIMING, validateRoomTiming, type RoomTiming } from '../shared/timing';
import {
  asLiveSocketCount,
  asSeatCount,
  isAutoPurgeEligible,
  type ConnectedSeatCount,
  type LiveSocketCount,
} from '../shared/retention';

// Bare literal "ping" -> "pong" answered while hibernated, at zero cost
// (PLAN.md §4). Matches exact literal strings only — clients ping OUTSIDE
// the JSON envelope.
const PING_PONG = new WebSocketRequestResponsePair('ping', 'pong');

/** M0 G-ALARM probe delay — unchanged. */
const ALARM_DELAY_MS = 15_000;

/** Input hardening (PLAN §8): cap inbound WS message size. */
const MAX_MESSAGE_BYTES = 65_536;
const MAX_NAME_LENGTH = 32;
const MAX_ACTION_ID_LENGTH = 128;
const MAX_TOKENS_PER_HELLO = 8;

/** Bound on default-actions applied per alarm() run — a stale-row guard so
 *  a buggy game can never spin the alarm handler forever. */
const MAX_ALARM_APPLIES = 32;

// ---------------------------------------------------------------------------
// SQLite row shapes. Each extends Record<string, SqlStorageValue> (index
// signature) so it satisfies SqlStorage.exec's generic constraint.
// ---------------------------------------------------------------------------

interface RoomRow {
  game_id: string;
  config_json: string;
  status: RoomStatus;
  code: string;
  created_at: number;
  /** The exact seed passed to game.init at start (PLAN §6 replay artifact);
   *  NULL until the room leaves the lobby. */
  seed: string | null;
  /** RoomTiming as JSON (M4); NULL = legacy room — the deadline path falls
   *  back to the game's actionTimeoutMs suggestion verbatim. */
  timing_json: string | null;
  /** Last HUMAN-interaction event (create / seat-claim / config / start /
   *  connect / disconnect — never a game action). The retention TTL anchor
   *  (pause-and-retention.md §3); backfilled from created_at for pre-retention
   *  rooms. */
  last_active_at: number | null;
  /** Wall-clock when this room's connected count hit 0 (Q3 pause); NULL while
   *  connected > 0. The offset origin for resume (§3.2); the constructor
   *  lazy-stamps it for a room already paused when this build deployed. */
  pause_started_at: number | null;
  [column: string]: SqlStorageValue;
}

interface SeatRow {
  seat: number;
  token_hash: string;
  name: string | null;
  [column: string]: SqlStorageValue;
}

interface SnapshotRow {
  seq: number;
  state_json: string | null;
  [column: string]: SqlStorageValue;
}

interface EventsRow {
  seq: number;
  events_json: string;
  [column: string]: SqlStorageValue;
}

interface ActionRow {
  seq: number;
  seat: number;
  action_id: string;
  action_json: string;
  [column: string]: SqlStorageValue;
}

interface ActionSeenRow {
  action_id: string;
  result_seq: number;
  at: number;
  [column: string]: SqlStorageValue;
}

interface DeadlineRow {
  seat: number;
  due_at: number;
  /** The decision-point budget deadline (room-timing.md §2); NULL ⇔ the row
   *  exists only as a disconnect grace for an untimed actor. */
  base_due_at: number | null;
  /** TimingClass the row was armed under; NULL on pre-M4 backfilled rows. */
  timing_class: string | null;
  [column: string]: SqlStorageValue;
}

interface HelloRow {
  id: number;
  count: number;
  alarm_set_at: number | null;
  alarm_fired_at: number | null;
  [column: string]: SqlStorageValue;
}

/** The per-socket durable identity (survives hibernation via
 *  serializeAttachment; ≤16KB limit — this is ~tens of bytes). */
interface SocketAttachment {
  seats: Seat[];
  /** Wall-clock ms when the socket was accepted — the staleness baseline for a
   *  socket that has never pinged (its auto-response timestamp is null until
   *  the first 'ping'; socket-liveness.md §5). Absent on attachments written
   *  before the liveness deploy: rehydration treats those as accepted NOW
   *  (fail-safe young — a live client re-pings within 25s; a dead one is
   *  reaped one deadline later). */
  acceptedAt?: number;
}

interface MutationLog {
  room: string;
  seq: number;
  actionId: string | null;
  seat: Seat | null;
  actionType: string;
  outcome: 'applied' | 'rejected' | 'duplicate';
  error?: string;
  /** Advisory expectedSeq staleness (PLAN §5): logged, never rejected on. */
  staleExpectedSeq?: number;
}

/** Exactly one JSON line per mutation attempt (PLAN §6) — greppable and
 *  correlatable by room + seq through `wrangler tail`. */
function logMutation(fields: MutationLog): void {
  console.log(JSON.stringify(fields));
}

function wireError(code: string, params?: Record<string, unknown>): WireError {
  return params === undefined ? { code } : { code, params };
}

export class GameRoom extends DurableObject<Env> {
  /** Rebuildable cache: which seats each live socket holds. Authoritative
   *  copy lives in each socket's attachment; rebuilt in the constructor. */
  private sessions = new Map<WebSocket, Set<Seat>>();
  /** Per-socket accept time (the staleness baseline before the first ping) —
   *  same lifecycle as sessions: seeded at accept, rehydrated from the
   *  attachment on every wake, deleted in handleSocketGone. */
  private acceptedAt = new Map<WebSocket, number>();

  /** Rebuildable cache of the room code for log correlation in callbacks
   *  that carry no request URL (webSocketMessage/alarm). Falls back to the
   *  persisted room.code column. */
  private roomCode: string | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ensureSchema();
    // Rehydrate the socket→seats index from the sockets the runtime kept
    // alive across hibernation (reconnection-patterns §1, the single choke
    // point guaranteed to run before any handler).
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as SocketAttachment | null;
      this.sessions.set(ws, new Set(attachment?.seats ?? []));
      // Pre-liveness attachments carry no acceptedAt → treat as accepted NOW
      // (fail-safe young; see SocketAttachment).
      this.acceptedAt.set(ws, attachment?.acceptedAt ?? Date.now());
    }
    this.ctx.setWebSocketAutoResponse(PING_PONG);
    this.stampPauseIfPreExisting();
  }

  /** §3.2 deploy-transition fix: a room already at connected==0 when this build
   *  shipped never hit the 1→0 pause stamp under the new code, so its
   *  `pause_started_at` is NULL and a later resume would compute
   *  `now - NULL` = garbage. The constructor is the single choke point that runs
   *  on every wake BEFORE any handler, and `getWebSockets()` does NOT yet include
   *  an incoming reconnect (that socket is accepted later in fetch()), so a
   *  resuming room is still seen as empty here. Stamp `now` as the pause origin —
   *  we cannot recover the true pause instant for a pre-Q3 room, so "first wake
   *  under this build" is the safe, bounded, non-exploitable proxy (it only
   *  applies to a FULLY empty room, where there is no present player to dodge). */
  private stampPauseIfPreExisting(): void {
    const room = this.readRoomRow();
    if (
      room !== null &&
      room.pause_started_at === null &&
      isPausedRoom(room.status, this.seatCount()) // SAME predicate as the 1→0 stamp
    ) {
      this.ctx.storage.sql.exec('UPDATE room SET pause_started_at = ? WHERE id = 1', Date.now());
    }
  }

  // -------------------------------------------------------------------------
  // Schema + row accessors
  // -------------------------------------------------------------------------

  private ensureSchema(): void {
    const sql = this.ctx.storage.sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS room (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         game_id TEXT NOT NULL,
         config_json TEXT NOT NULL,
         status TEXT NOT NULL CHECK (status IN ('lobby','playing','finished')),
         code TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         seed TEXT,  -- set at start: the exact seed passed to game.init (PLAN §6 replay)
         timing_json TEXT,  -- RoomTiming (M4); NULL = legacy actionTimeoutMs behavior
         last_active_at INTEGER,  -- last HUMAN event (pause-and-retention.md §3); TTL anchor, never bumped by a game action
         pause_started_at INTEGER  -- Q3: wall-clock when connected hit 0; NULL while connected>0 (§3.2)
       )`,
    );
    // Migrations for rooms created before newer columns existed: SQLite has
    // no ADD COLUMN IF NOT EXISTS, so probe the live schema first.
    const roomColumns = sql
      .exec<{ name: string; [c: string]: SqlStorageValue }>("SELECT name FROM pragma_table_info('room')")
      .toArray();
    if (!roomColumns.some((c) => c.name === 'seed')) {
      sql.exec('ALTER TABLE room ADD COLUMN seed TEXT');
    }
    if (!roomColumns.some((c) => c.name === 'timing_json')) {
      // NULL for every pre-M4 room — those keep the actionTimeoutMs path.
      sql.exec('ALTER TABLE room ADD COLUMN timing_json TEXT');
    }
    if (!roomColumns.some((c) => c.name === 'last_active_at')) {
      // Pre-retention rooms: seed the TTL anchor from created_at (the only
      // timestamp we have); real human events bump it forward from there.
      sql.exec('ALTER TABLE room ADD COLUMN last_active_at INTEGER');
      sql.exec('UPDATE room SET last_active_at = created_at WHERE last_active_at IS NULL');
    }
    if (!roomColumns.some((c) => c.name === 'pause_started_at')) {
      // NULL by default; the constructor lazy-stamps it for a room already at
      // connected==0 when this build deploys (§3.2 deploy-transition fix).
      sql.exec('ALTER TABLE room ADD COLUMN pause_started_at INTEGER');
    }
    sql.exec(
      `CREATE TABLE IF NOT EXISTS seats (
         seat INTEGER PRIMARY KEY,
         token_hash TEXT NOT NULL,
         name TEXT
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS snapshot (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         seq INTEGER NOT NULL,
         state_json TEXT
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS events (
         seq INTEGER PRIMARY KEY,
         events_json TEXT NOT NULL  -- JSON ARRAY of the engine events from that one applied action
       )`,
    );
    // The replay-artifact action log (PLAN §6): one row per APPLIED action —
    // player-submitted and alarm-applied timeouts alike — with seq matching
    // the mutation seq. The start mutation writes NO row here: replay
    // reproduces it via game.init(config, seats, seed).
    sql.exec(
      `CREATE TABLE IF NOT EXISTS actions (
         seq INTEGER PRIMARY KEY,
         seat INTEGER NOT NULL,
         action_id TEXT NOT NULL,
         action_json TEXT NOT NULL
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS actions_seen (
         action_id TEXT PRIMARY KEY,
         result_seq INTEGER NOT NULL,
         at INTEGER NOT NULL
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS deadlines (
         seat INTEGER PRIMARY KEY,
         due_at INTEGER NOT NULL,
         base_due_at INTEGER,  -- decision-point budget; NULL = grace-only row
         timing_class TEXT     -- TimingClass the row was armed under
       )`,
    );
    const deadlineColumns = sql
      .exec<{ name: string; [c: string]: SqlStorageValue }>(
        "SELECT name FROM pragma_table_info('deadlines')",
      )
      .toArray();
    if (!deadlineColumns.some((c) => c.name === 'base_due_at')) {
      sql.exec('ALTER TABLE deadlines ADD COLUMN base_due_at INTEGER');
      // One-time backfill: a live mid-deploy deadline restores at most to
      // its already-clamped due — conservative, never extends.
      sql.exec('UPDATE deadlines SET base_due_at = due_at WHERE base_due_at IS NULL');
    }
    if (!deadlineColumns.some((c) => c.name === 'timing_class')) {
      sql.exec('ALTER TABLE deadlines ADD COLUMN timing_class TEXT');
    }
    // M0 G-ALARM probe state — kept verbatim (PLAN §9).
    sql.exec(
      `CREATE TABLE IF NOT EXISTS hello_state (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         count INTEGER NOT NULL,
         alarm_set_at INTEGER,
         alarm_fired_at INTEGER
       )`,
    );
    sql.exec(
      `INSERT OR IGNORE INTO hello_state (id, count, alarm_set_at, alarm_fired_at)
       VALUES (1, 0, NULL, NULL)`,
    );
  }

  private readRoomRow(): RoomRow | null {
    const rows = this.ctx.storage.sql
      .exec<RoomRow>(
        'SELECT game_id, config_json, status, code, created_at, seed, timing_json, last_active_at, pause_started_at FROM room WHERE id = 1',
      )
      .toArray();
    const row = rows[0] ?? null;
    if (row) this.roomCode = row.code;
    return row;
  }

  private readSnapshotRow(): SnapshotRow {
    return this.ctx.storage.sql
      .exec<SnapshotRow>('SELECT seq, state_json FROM snapshot WHERE id = 1')
      .one();
  }

  private currentSeq(): number {
    return this.readSnapshotRow().seq;
  }

  /** One counter for every applied mutation (PLAN M2 design): lobby edits
   *  bump it too, but only game mutations also write an events row. */
  private bumpSeq(): number {
    this.ctx.storage.sql.exec('UPDATE snapshot SET seq = seq + 1 WHERE id = 1');
    return this.currentSeq();
  }

  private readSeatRows(): SeatRow[] {
    return this.ctx.storage.sql
      .exec<SeatRow>('SELECT seat, token_hash, name FROM seats ORDER BY seat')
      .toArray();
  }

  private readHelloRow(): HelloRow {
    return this.ctx.storage.sql
      .exec<HelloRow>('SELECT id, count, alarm_set_at, alarm_fired_at FROM hello_state WHERE id = 1')
      .one();
  }

  private code(): string {
    return this.roomCode ?? this.readRoomRow()?.code ?? 'unknown';
  }

  private gameFor(room: RoomRow): AnyGameDefinition {
    const game = getGame(room.game_id);
    if (!game) {
      // Impossible via the create path (the Worker validates gameId), so
      // this is a registry regression — fail loudly.
      throw new Error(`room ${room.code}: unknown gameId '${room.game_id}'`);
    }
    return game;
  }

  private parseConfig(room: RoomRow): unknown {
    return JSON.parse(room.config_json);
  }

  /** null = legacy room (or an unparseable column, which no write path can
   *  produce — both degrade to the pre-M4 actionTimeoutMs behavior). */
  private parseTiming(room: RoomRow): RoomTiming | null {
    if (room.timing_json === null) return null;
    try {
      return validateRoomTiming(JSON.parse(room.timing_json));
    } catch {
      return null;
    }
  }

  private readState(): unknown {
    const row = this.readSnapshotRow();
    return row.state_json === null ? null : JSON.parse(row.state_json);
  }

  // -------------------------------------------------------------------------
  // Presence / session helpers (in-memory caches over socket attachments)
  // -------------------------------------------------------------------------

  private heldSeats(ws: WebSocket): Set<Seat> {
    return this.sessions.get(ws) ?? new Set();
  }

  private connectedSeats(): Set<Seat> {
    const connected = new Set<Seat>();
    for (const seats of this.sessions.values()) for (const s of seats) connected.add(s);
    return connected;
  }

  // The two Q3/TTL counts, each constructed from its CORRECT source in ONE place.
  // Branding kills swapping two branded values at a call site; it does NOT stop
  // constructing the wrong brand from the wrong source — so that residual surface
  // is confined to exactly these two methods (the whole thing Codex's binding
  // audit has to read). Connected SEATS answer "is there an ACTOR?" (pause /
  // auto-play, M4); live SOCKETS answer "is ANYONE here?" (TTL / T3 — a seatless
  // idle lobby visitor still counts, and leaves no last_active_at trace under
  // Q1's edge auto-response, so time alone can't stand in).
  private seatCount(): ConnectedSeatCount {
    return asSeatCount(this.connectedSeats().size);
  }
  private socketCount(): LiveSocketCount {
    // sessions.size, NOT ctx.getWebSockets().length: during webSocketClose the
    // runtime's list STILL CONTAINS the closing socket (measured on workerd),
    // so a close-time TTL re-arm would see itself and refuse — the last human
    // leaving a lobby made it immortal (Grok audit + wire repro). sessions
    // tracks every accepted socket (upgrade seeds it, the constructor
    // rehydrates it from getWebSockets() on every wake) and handleSocketGone
    // deletes the closing one FIRST, so it is the same set with the correct
    // close-time edge.
    return asLiveSocketCount(this.sessions.size);
  }

  /** TEST-ONLY retention window shrink (RETENTION_TEST_WINDOW_MS env) so the e2e
   *  can drive a real self-purge without waiting 48h; undefined in production. */
  private retentionWindowOverride(): number | undefined {
    const raw = this.env.RETENTION_TEST_WINDOW_MS;
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  /** TEST-ONLY staleness shrink (STALE_SOCKET_TEST_MS env), same pattern. */
  private staleSocketOverride(): number | undefined {
    const raw = this.env.STALE_SOCKET_TEST_MS;
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  /** A socket's last proof of life (socket-liveness.md §5): the edge-answered
   *  ping timestamp (readable without waking/billing; null until the first
   *  ping) or its accept time. `now` is the fail-safe for a socket somehow
   *  missing from acceptedAt — young, never insta-reaped. */
  private socketLastSeenFor(ws: WebSocket, now: number): number {
    const autoResponseAt = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? null;
    return socketLastSeen(autoResponseAt, this.acceptedAt.get(ws) ?? now);
  }

  /** Close every attached socket whose ping-silence has reached the deadline —
   *  the platform never does this for us (socket-liveness.md §2: nothing at any
   *  layer closes a silent socket; §3: locked/frozen mobile pages stop pinging
   *  WITHOUT a close frame). From the close on, the ordinary disconnect
   *  machinery (presence → grace clamp → Q3 pause → TTL re-arm) runs unchanged:
   *  staleness only accelerates the close event the browser failed to send.
   *  Runs at the top of every wake (alarm, hello) — cheap: ≤ a handful of
   *  sockets, and the timestamp read never wakes anything. */
  private async sweepStaleSockets(now: number): Promise<void> {
    const staleMs = this.staleSocketOverride() ?? STALE_SOCKET_MS;
    // Copy: handleSocketGone mutates sessions mid-iteration.
    for (const ws of [...this.sessions.keys()]) {
      if (!isStaleSocket(this.socketLastSeenFor(ws, now), now, staleMs)) continue;
      try {
        ws.close(4002, 'stale'); // app-range code; the client just reconnects
      } catch {
        // already closing/closed — the bookkeeping below still applies
      }
      // Server-initiated closes are not guaranteed to invoke our own
      // webSocketClose handler, so do the bookkeeping explicitly; if the
      // runtime delivers a duplicate close event later, handleSocketGone's
      // seatless path is a harmless touch+re-arm.
      await this.handleSocketGone(ws);
    }
  }

  private setSeats(ws: WebSocket, seats: Set<Seat>): void {
    this.sessions.set(ws, seats);
    // Preserve the accept time across every seat rewrite — the attachment is
    // replaced wholesale, and losing it would reset the staleness baseline.
    // The ?? arm is unreachable today (every caller seeds the map first) but
    // must BACKFILL the map if ever hit (Grok audit): otherwise
    // socketLastSeenFor's own `?? now` would keep that socket forever young
    // while the instance stays warm.
    const acceptedAt = this.acceptedAt.get(ws) ?? Date.now();
    this.acceptedAt.set(ws, acceptedAt);
    const attachment: SocketAttachment = {
      seats: [...seats].sort((a, b) => a - b),
      acceptedAt,
    };
    ws.serializeAttachment(attachment);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket already closing/closed — presence cleanup happens in
      // webSocketClose/webSocketError; nothing to do here.
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const ws of this.sessions.keys()) this.send(ws, msg);
  }

  private sendRejected(ws: WebSocket, error: WireError, actionId?: string): void {
    const msg: Extract<ServerMessage, { type: 'rejected' }> = {
      v: 1,
      type: 'rejected',
      seq: this.currentSeq(),
      error,
    };
    if (actionId !== undefined) msg.actionId = actionId;
    this.send(ws, msg);
  }

  private readDeadlineRows(): DeadlineRow[] {
    return this.ctx.storage.sql
      .exec<DeadlineRow>('SELECT seat, due_at, base_due_at, timing_class FROM deadlines ORDER BY seat')
      .toArray();
  }

  /** The current per-seat deadlines in wire shape (PLAN §5), broadcast on
   *  'welcome' | 'resync' | 'event' — public info, unredacted, empty array
   *  when none are outstanding (lobby/terminal). */
  private currentWireDeadlines(): ReturnType<typeof toWireDeadlines> {
    return toWireDeadlines(this.readDeadlineRows());
  }

  private buildRoomInfo(room: RoomRow): RoomInfo {
    const game = this.gameFor(room);
    const seatRows = this.readSeatRows();
    const bySeat = new Map(seatRows.map((r) => [r.seat, r]));
    const connected = this.connectedSeats();
    const seats: SeatInfo[] = [];
    for (let i = 0; i < game.maxSeats; i++) {
      const row = bySeat.get(i);
      seats.push({
        seat: i,
        name: row?.name ?? null,
        claimed: row !== undefined,
        connected: connected.has(i),
      });
    }
    return {
      gameId: room.game_id,
      status: room.status,
      config: this.parseConfig(room),
      seats,
      timing: this.parseTiming(room),
      seq: this.currentSeq(),
    };
  }

  // -------------------------------------------------------------------------
  // HTTP surface (reached via the Worker's /api/rooms/:code/* pass-through)
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean); // ["api","rooms",code,leaf]
    const codeFromPath = segments[2] ?? 'unknown';
    const leaf = segments[3] ?? '';
    this.roomCode = codeFromPath;

    if (leaf === 'create' && request.method === 'POST') {
      return this.handleCreate(codeFromPath, request);
    }
    if ((leaf === '' || leaf === 'info') && request.method === 'GET') {
      return this.handleInfo();
    }
    if (leaf === 'ws' && request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade();
    }
    if (leaf === 'dump' && request.method === 'GET') {
      return this.handleDump(request);
    }
    if (leaf === 'purge' && request.method === 'POST') {
      return this.handlePurge(request);
    }
    // M0 G-ALARM probe endpoints — kept verbatim (PLAN §9).
    if (leaf === 'hello' && request.method === 'GET') {
      return this.handleHello(codeFromPath);
    }
    if (leaf === 'status' && request.method === 'GET') {
      const row = this.readHelloRow();
      return Response.json(this.toStatus(codeFromPath, row));
    }

    return Response.json({ error: 'notFound' }, { status: 404 });
  }

  /** Persist the room row (PLAN §4 lobby). The Worker already validated the
   *  gameId and minted the code; config is OPAQUE — stored as given, never
   *  interpreted here. 409 lets the Worker retry on a code collision. */
  private async handleCreate(code: string, request: Request): Promise<Response> {
    if (this.readRoomRow() !== null) {
      return Response.json({ error: 'room.exists' }, { status: 409 });
    }
    let body: { gameId?: unknown; config?: unknown; timing?: unknown };
    try {
      body = (await request.json()) as { gameId?: unknown; config?: unknown; timing?: unknown };
    } catch {
      return Response.json({ error: 'request.invalidJson' }, { status: 400 });
    }
    const gameId = body.gameId;
    if (typeof gameId !== 'string' || getGame(gameId) === null) {
      return Response.json({ error: 'game.unknown' }, { status: 400 });
    }
    // Timing is the room layer's OWN data (unlike the opaque game config),
    // so it is validated eagerly; absent = the standard preset, which keeps
    // old clients that never send the field on sensible defaults.
    let timing: RoomTiming;
    try {
      timing = body.timing == null ? DEFAULT_ROOM_TIMING : validateRoomTiming(body.timing);
    } catch {
      return Response.json({ error: 'timing.invalid' }, { status: 400 });
    }
    const createdAt = Date.now();
    this.ctx.storage.sql.exec(
      'INSERT INTO room (id, game_id, config_json, status, code, created_at, timing_json, last_active_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)',
      gameId,
      JSON.stringify(body.config ?? null),
      'lobby',
      code,
      createdAt,
      JSON.stringify(timing),
      createdAt, // last_active_at seeded at creation (a human just made the room)
    );
    this.ctx.storage.sql.exec(
      'INSERT INTO snapshot (id, seq, state_json) VALUES (1, 0, NULL)',
    );
    this.roomCode = code;
    logMutation({
      room: code,
      seq: 0,
      actionId: null,
      seat: null,
      actionType: 'create',
      outcome: 'applied',
    });
    // Arm the lobby retention TTL now, so a room nobody ever joins still
    // self-purges (an idle DO runs no code otherwise — it would orphan forever).
    await this.scheduleAlarm();
    return Response.json({ ok: true }, { status: 201 });
  }

  private handleInfo(): Response {
    const room = this.readRoomRow();
    if (!room) return Response.json({ error: 'notFound' }, { status: 404 });
    return Response.json(this.buildRoomInfo(room));
  }

  private async handleWebSocketUpgrade(): Promise<Response> {
    if (this.readRoomRow() === null) {
      return Response.json({ error: 'notFound' }, { status: 404 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // NO tags: seats are unknown at upgrade time — identity is acquired via
    // hello/claimSeat and lives in the attachment (PLAN §4).
    this.ctx.acceptWebSocket(server);
    this.acceptedAt.set(server, Date.now()); // BEFORE setSeats, which persists it
    this.setSeats(server, new Set());

    // Park the sweep wake THE MOMENT a socket attaches (Grok/Codex audit —
    // both lineages): without this, an idle lobby's next wake is its 48h TTL,
    // not acceptedAt + STALE_SOCKET_MS — a phone that froze right after
    // connecting held its phantom for up to 48h (delayed, not immortal: that
    // TTL wake's own sweep would eventually reap it). Every later wake
    // re-arms the candidate.
    await this.scheduleAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Room dump (PLAN §6): the SQLite content IS the audit trail; dumping it
   *  is a first-class documented affordance. Gated: always on when
   *  ENVIRONMENT === 'dev'; otherwise requires the DEBUG_DUMP_TOKEN secret
   *  to be configured AND presented — else an indistinguishable 404. Token
   *  HASHES only, never raw tokens. */
  /** The dump/purge debug gate (PLAN §6): open when ENVIRONMENT==='dev', else the
   *  request must present the DEBUG_DUMP_TOKEN secret in x-debug-dump-token
   *  (constant-time compared). An unauthorized request is INDISTINGUISHABLE from a
   *  missing route (404), never a 401 — no oracle about whether the token exists. */
  private debugAuthorized(request: Request): boolean {
    const configuredToken = this.env.DEBUG_DUMP_TOKEN;
    const presented = request.headers.get('x-debug-dump-token');
    return (
      this.env.ENVIRONMENT === 'dev' ||
      (configuredToken !== undefined &&
        configuredToken !== '' &&
        presented !== null &&
        timingSafeEqualStr(presented, configuredToken))
    );
  }

  private handleDump(request: Request): Response {
    if (!this.debugAuthorized(request)) return Response.json({ error: 'notFound' }, { status: 404 });

    const room = this.readRoomRow();
    if (!room) return Response.json({ error: 'notFound' }, { status: 404 });

    const snapshot = this.readSnapshotRow();
    const eventRows = this.ctx.storage.sql
      .exec<EventsRow>('SELECT seq, events_json FROM events ORDER BY seq')
      .toArray();
    const actionRows = this.ctx.storage.sql
      .exec<ActionRow>('SELECT seq, seat, action_id, action_json FROM actions ORDER BY seq')
      .toArray();
    const seen = this.ctx.storage.sql
      .exec<ActionSeenRow>('SELECT action_id, result_seq, at FROM actions_seen ORDER BY at')
      .toArray();
    const deadlineRows = this.readDeadlineRows();

    return Response.json({
      // Top-level gameId + seed: with room.config and the actions rows they
      // form the exact replay-artifact triple scripts/dump-room.ts converts
      // to (PLAN §6). seed is null until the room leaves the lobby.
      gameId: room.game_id,
      seed: room.seed,
      room: {
        gameId: room.game_id,
        config: this.parseConfig(room),
        status: room.status,
        code: room.code,
        timing: this.parseTiming(room),
        // Q3/retention diagnostics (pause-and-retention.md): the offset origin
        // (NULL while any seat is connected) and the TTL anchor.
        pauseStartedAt: room.pause_started_at,
        lastActiveAt: room.last_active_at,
      },
      seats: this.readSeatRows().map((r) => ({ seat: r.seat, name: r.name, tokenHash: r.token_hash })),
      snapshot: { seq: snapshot.seq, state: snapshot.state_json === null ? null : JSON.parse(snapshot.state_json) },
      events: eventRows.map((r) => ({ seq: r.seq, events: JSON.parse(r.events_json) as unknown[] })),
      actions: actionRows.map((r) => ({
        seq: r.seq,
        seat: r.seat,
        actionId: r.action_id,
        action: JSON.parse(r.action_json) as unknown,
      })),
      actionsSeen: seen.map((r) => ({ actionId: r.action_id, resultSeq: r.result_seq, at: r.at })),
      deadlines: deadlineRows.map((r) => ({
        seat: r.seat,
        dueAt: r.due_at,
        baseDueAt: r.base_due_at,
        timingClass: r.timing_class,
      })),
    });
  }

  /** Manual on-demand purge (scripts/cleanup-rooms.ts): the SAME token-gated debug
   *  affordance as dump, for reclaiming an abandoned room's storage (the lazy-mode
   *  §4 path for played-out/paused rooms). Returns the pre-purge summary — what is
   *  being destroyed — so the caller can log/confirm it, then deleteAll()s.
   *  IRREVERSIBLE: the script dumps first, defaults to dry-run, and only POSTs here
   *  on an explicit --delete. */
  private async handlePurge(request: Request): Promise<Response> {
    if (!this.debugAuthorized(request)) return Response.json({ error: 'notFound' }, { status: 404 });
    const room = this.readRoomRow();
    if (!room) return Response.json({ error: 'notFound' }, { status: 404 });

    // The last gate before an irreversible delete must be the MOST defensive
    // one (Codex audit): refuse while anyone is attached, so a typo'd code in
    // the cleanup script cannot deleteAll() a room out from under live
    // players. ?force=1 (the script's --force) is the deliberate override.
    const liveSockets: number = this.socketCount();
    if (liveSockets > 0 && new URL(request.url).searchParams.get('force') !== '1') {
      return Response.json(
        { error: 'room.hasLiveSockets', liveSockets, connectedSeats: this.connectedSeats().size },
        { status: 409 },
      );
    }

    const count = (table: 'events' | 'actions' | 'actions_seen' | 'deadlines' | 'seats'): number =>
      this.ctx.storage.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`).toArray()[0]?.n ?? 0;
    const summary = {
      code: room.code,
      status: room.status,
      seq: this.currentSeq(),
      rows: {
        events: count('events'),
        actions: count('actions'),
        actionsSeen: count('actions_seen'),
        deadlines: count('deadlines'),
        seats: count('seats'),
      },
      connectedSeats: this.connectedSeats().size,
      liveSockets,
      pauseStartedAt: room.pause_started_at,
      lastActiveAt: room.last_active_at,
    };

    logMutation({
      room: room.code,
      seq: summary.seq,
      actionId: null,
      seat: null,
      actionType: 'roomPurgedManual',
      outcome: 'applied',
    });
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
    this.ensureSchema(); // empty schema so a later GET reads no room (404), not 500
    return Response.json({ ok: true, purged: summary });
  }

  // -------------------------------------------------------------------------
  // WebSocket message dispatch
  // -------------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text.length > MAX_MESSAGE_BYTES) {
      this.sendRejected(ws, wireError('protocol.tooLarge'));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.sendRejected(ws, wireError('protocol.malformed'));
      return;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { v?: unknown }).v !== 1 ||
      typeof (parsed as { type?: unknown }).type !== 'string'
    ) {
      this.sendRejected(ws, wireError('protocol.malformed'));
      return;
    }
    const msg = parsed as ClientMessage;

    const room = this.readRoomRow();
    if (!room) {
      this.sendRejected(ws, wireError('room.notFound'));
      return;
    }

    switch (msg.type) {
      case 'hello':
        return this.handleHelloMsg(ws, room, msg);
      case 'claimSeat':
        return this.handleClaimSeat(ws, room, msg);
      case 'setConfig':
        return this.handleSetConfig(ws, room, msg);
      case 'setTiming':
        return this.handleSetTiming(ws, room, msg);
      case 'start':
        return this.handleStart(ws, room);
      case 'action':
        return this.handleActionMsg(ws, room, msg);
      default:
        this.sendRejected(ws, wireError('protocol.unknownType'));
        return;
    }
  }

  // -------------------------------------------------------------------------
  // hello — token→seat resolution, takeover, welcome + per-seat resync
  // (PLAN §4 seat-token authority, §5 reconnection flow)
  // -------------------------------------------------------------------------

  private async handleHelloMsg(
    ws: WebSocket,
    room: RoomRow,
    msg: Extract<ClientMessage, { type: 'hello' }>,
  ): Promise<void> {
    // Reap stale sockets FIRST: a reconnecting client (fresh socket) is often
    // the proof its old zombie socket is dead — the presence delta below must
    // be computed against post-sweep truth, or a phantom could mask a pause /
    // takeover edge (socket-liveness.md §5). The fresh socket itself was
    // accepted moments ago and is never stale.
    await this.sweepStaleSockets(Date.now());

    const tokens = Array.isArray(msg.tokens) ? msg.tokens.slice(0, MAX_TOKENS_PER_HELLO) : [];
    const lastSeenSeq =
      typeof msg.lastSeenSeq === 'number' && Number.isInteger(msg.lastSeenSeq) && msg.lastSeenSeq >= 0
        ? msg.lastSeenSeq
        : 0;

    // Resolve each presented token by SHA-256 hash to a seat; unknown tokens
    // simply don't resolve (no oracle about which tokens exist).
    const seats = new Set<Seat>();
    for (const token of tokens) {
      if (typeof token !== 'string' || token.length === 0 || token.length > 256) continue;
      const hash = await sha256Hex(token);
      const rows = this.ctx.storage.sql
        .exec<SeatRow>('SELECT seat, token_hash, name FROM seats WHERE token_hash = ?', hash)
        .toArray();
      if (rows[0]) seats.add(rows[0].seat);
    }

    const connectedBefore = this.connectedSeats();

    // TAKEOVER (PLAN §4 multi-tab rule): the newer socket presenting a
    // seat's token takes over delivery for that seat; the older socket
    // keeps its other seats.
    for (const [other, otherSeats] of this.sessions) {
      if (other === ws) continue;
      let changed = false;
      for (const s of seats) {
        if (otherSeats.delete(s)) changed = true;
      }
      if (changed) this.setSeats(other, otherSeats);
    }
    this.setSeats(ws, seats);

    const seq = this.currentSeq();
    const sortedSeats = [...seats].sort((a, b) => a - b);

    // Connectivity delta for this hello, in BOTH directions. Grok M2 audit
    // (F1): a hello can also DROP seats (fewer/empty tokens, or takeover
    // moving them here from another socket) — those must broadcast
    // disconnected-presence and re-enter the disconnect-grace clamp, or a
    // client could "soft-disconnect" past the timers.
    const connectedAfter = this.connectedSeats();
    const newlyConnected = sortedSeats.filter((s) => !connectedBefore.has(s));
    const newlyDisconnected = [...connectedBefore].filter((s) => !connectedAfter.has(s));

    // A hello is a human-interaction event → bump the retention TTL anchor.
    const now = Date.now();
    this.touchActivity(now);

    // Q3 pause/resume (pause-and-retention.md §2). A hello can flip connectivity
    // EITHER way (reconnect, or a token-less/takeover hello that drops seats):
    if (room.status === 'playing') {
      if (connectedBefore.size === 0 && connectedAfter.size > 0) {
        // TRUE 0→1 resume edge ONLY — not any hello with seats connected. Gating
        // on the actual transition (not on "resumeFromPause no-ops when
        // pause_started_at is NULL") makes the shift self-evidently safe: an
        // ordinary mid-game hello (seats already connected) can never shift
        // deadlines even if the pause_started_at invariant were ever violated
        // (Codex audit). Shift the frozen deadlines by the paused duration
        // (preserving each actor's REMAINING budget — no fresh clock) BEFORE the
        // reconcile below restores the reconnecting actor to its shifted base.
        this.resumeFromPause(now);
      } else if (isPausedRoom(room.status, this.seatCount())) {
        // This hello emptied the room → pause (record the offset origin so a
        // future resume can shift; the alarm won't auto-play while connected==0).
        // The SAME named predicate as the socket-gone and constructor stamps —
        // previously this site re-derived it as connectedAfter.size === 0
        // (equivalent, but stamp≡pause should be structural, not coincidental).
        this.stampPauseStart(now);
      }
      // else (connectedBefore>0 && connectedAfter>0): an ordinary mid-game hello
      // — neither a pause nor a resume; deadlines are untouched here.
    }

    // Reconcile deadlines BEFORE the welcome/resync sends, so they carry
    // the restored (base) deadlines rather than stale disconnect-clamped
    // ones. Presence may only clamp/restore — never re-arm (room-timing.md
    // §2); the synchronous SQL lands before currentWireDeadlines() below.
    if ((newlyConnected.length > 0 || newlyDisconnected.length > 0) && room.status === 'playing') {
      await this.reconcileDeadlines(new Set([...newlyConnected, ...newlyDisconnected]));
    } else if (newlyConnected.length > 0 || newlyDisconnected.length > 0) {
      // Lobby/finished: no seat deadlines, but re-schedule so a reconnect to an
      // abandoned lobby clears its pending TTL self-purge (connected>0 now).
      await this.scheduleAlarm();
    } else {
      // No presence delta — the COMMON tokenless first hello. The attach must
      // still park the sweep wake (Grok/Codex audit): the upgrade path arms it
      // too, but this keeps "socket attached ⇒ sweep wake armed" true at every
      // exit of every attach-adjacent handler, not by call-graph coincidence.
      await this.scheduleAlarm();
    }

    const currentDeadlines = this.currentWireDeadlines();
    this.send(ws, {
      v: 1,
      type: 'welcome',
      seq,
      seats: sortedSeats,
      room: this.buildRoomInfo(room),
      deadlines: currentDeadlines,
      // Version-skew signal (M4): game-agnostic deploy config, same
      // pattern as the ENVIRONMENT read — never game data.
      build: this.env.BUILD_VERSION ?? 'dev',
    });

    // Per-held-seat resync once a game exists ('playing', and 'finished' so
    // late reconnects still see the end state).
    if (room.status !== 'lobby' && seats.size > 0) {
      const game = this.gameFor(room);
      const config = this.parseConfig(room);
      const state = this.readState();
      const actors = new Set<Seat>(game.expectedActors(state));

      // Delta only when the retained log contiguously covers
      // lastSeenSeq+1..seq (PLAN §5 step 3); otherwise snapshot-only — the
      // view alone is sufficient to resume.
      let eventRows: EventsRow[] = [];
      if (lastSeenSeq < seq) {
        eventRows = this.ctx.storage.sql
          .exec<EventsRow>('SELECT seq, events_json FROM events WHERE seq > ? ORDER BY seq', lastSeenSeq)
          .toArray();
      }
      const sendDelta = deltaCoversGap(lastSeenSeq, seq, eventRows.map((r) => r.seq));

      for (const seat of sortedSeats) {
        const resync: Extract<ServerMessage, { type: 'resync' }> = {
          v: 1,
          type: 'resync',
          seq,
          seat,
          view: game.playerView(state, seat),
          deadlines: currentDeadlines,
        };
        if (sendDelta) {
          resync.events = eventRows.map((r) => ({
            seq: r.seq,
            // Same shape as the live 'event' message: the seq's redacted
            // event ARRAY for this seat, nulls dropped.
            event: redactEventsFor(game, JSON.parse(r.events_json) as unknown[], seat, config),
          }));
        }
        if (actors.has(seat)) resync.hints = game.legalActions(state, seat) as unknown[];
        this.send(ws, resync);
      }
    }

    // Presence broadcasts for the connectivity delta computed above (the
    // deadline reconcile already ran, before the welcome).
    for (const s of newlyConnected) {
      this.broadcast({ v: 1, type: 'presence', seq, seat: s, connected: true });
    }
    for (const s of newlyDisconnected) {
      this.broadcast({ v: 1, type: 'presence', seq, seat: s, connected: false });
    }
  }

  // -------------------------------------------------------------------------
  // Lobby (PLAN §4): claimSeat / setConfig / start
  // -------------------------------------------------------------------------

  private async handleClaimSeat(
    ws: WebSocket,
    room: RoomRow,
    msg: Extract<ClientMessage, { type: 'claimSeat' }>,
  ): Promise<void> {
    const reject = (error: WireError): void => {
      this.sendRejected(ws, error);
      logMutation({
        room: room.code,
        seq: this.currentSeq(),
        actionId: null,
        seat: null,
        actionType: 'claimSeat',
        outcome: 'rejected',
        error: error.code,
      });
    };

    if (room.status !== 'lobby') return reject(wireError('room.notLobby'));
    const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    if (name.length === 0) return reject(wireError('lobby.invalidName'));

    const game = this.gameFor(room);
    const claimed = new Set(this.readSeatRows().map((r) => r.seat));
    let seat: Seat | null = null;
    for (let i = 0; i < game.maxSeats; i++) {
      if (!claimed.has(i)) {
        seat = i;
        break;
      }
    }
    if (seat === null) return reject(wireError('room.full'));

    // Mint the seat token: 32 random bytes → hex; only its SHA-256 hash is
    // ever persisted, and the raw token is NEVER logged (PLAN §8).
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const token = bytesToHex(raw);
    const tokenHash = await sha256Hex(token);
    this.ctx.storage.sql.exec(
      'INSERT INTO seats (seat, token_hash, name) VALUES (?, ?, ?)',
      seat,
      tokenHash,
      name,
    );

    const seq = this.bumpSeq();
    this.touchActivity(Date.now());

    // The claiming connection now holds the seat.
    const held = this.heldSeats(ws);
    held.add(seat);
    this.setSeats(ws, held);

    // Claimer gets the token; everyone else sees the claim WITHOUT it.
    this.send(ws, { v: 1, type: 'seatClaimed', seq, seat, name, token });
    for (const other of this.sessions.keys()) {
      if (other === ws) continue;
      this.send(other, { v: 1, type: 'seatClaimed', seq, seat, name });
    }
    const info = this.buildRoomInfo(room);
    this.broadcast({ v: 1, type: 'roomChanged', seq, room: info });

    logMutation({
      room: room.code,
      seq,
      actionId: null,
      seat,
      actionType: 'claimSeat',
      outcome: 'applied',
    });
  }

  private handleSetConfig(
    ws: WebSocket,
    room: RoomRow,
    msg: Extract<ClientMessage, { type: 'setConfig' }>,
  ): void {
    const held = this.heldSeats(ws);
    const reject = (error: WireError): void => {
      this.sendRejected(ws, error);
      logMutation({
        room: room.code,
        seq: this.currentSeq(),
        actionId: null,
        seat: held.size > 0 ? Math.min(...held) : null,
        actionType: 'setConfig',
        outcome: 'rejected',
        error: error.code,
      });
    };

    if (room.status !== 'lobby') return reject(wireError('room.notLobby'));
    if (held.size === 0) return reject(wireError('room.notSeated'));

    // Config is OPAQUE game-defined data — persisted as given, never
    // interpreted; a bad config fails at start via Game.init (PLAN §4).
    this.ctx.storage.sql.exec(
      'UPDATE room SET config_json = ? WHERE id = 1',
      JSON.stringify(msg.config ?? null),
    );
    const seq = this.bumpSeq();
    this.touchActivity(Date.now());
    const bySeat = Math.min(...held);
    this.broadcast({ v: 1, type: 'configChanged', seq, config: msg.config ?? null, bySeat });

    logMutation({
      room: room.code,
      seq,
      actionId: null,
      seat: bySeat,
      actionType: 'setConfig',
      outcome: 'applied',
    });
  }

  /** Same authority rule as setConfig (lobby only, any seated player), but
   *  timing is the room layer's OWN data — validated eagerly, and the new
   *  value rides the existing roomChanged broadcast (RoomInfo.timing). */
  private handleSetTiming(
    ws: WebSocket,
    room: RoomRow,
    msg: Extract<ClientMessage, { type: 'setTiming' }>,
  ): void {
    const held = this.heldSeats(ws);
    const reject = (error: WireError): void => {
      this.sendRejected(ws, error);
      logMutation({
        room: room.code,
        seq: this.currentSeq(),
        actionId: null,
        seat: held.size > 0 ? Math.min(...held) : null,
        actionType: 'setTiming',
        outcome: 'rejected',
        error: error.code,
      });
    };

    if (room.status !== 'lobby') return reject(wireError('room.notLobby'));
    if (held.size === 0) return reject(wireError('room.notSeated'));

    let timing: RoomTiming;
    try {
      timing = validateRoomTiming(msg.timing);
    } catch {
      return reject(wireError('timing.invalid'));
    }

    this.ctx.storage.sql.exec('UPDATE room SET timing_json = ? WHERE id = 1', JSON.stringify(timing));
    const seq = this.bumpSeq();
    this.touchActivity(Date.now());
    const bySeat = Math.min(...held);
    // Re-read so the broadcast RoomInfo carries the just-written timing (the
    // in-memory `room` row predates the UPDATE).
    const updated = this.readRoomRow();
    if (updated) this.broadcast({ v: 1, type: 'roomChanged', seq, room: this.buildRoomInfo(updated) });

    logMutation({
      room: room.code,
      seq,
      actionId: null,
      seat: bySeat,
      actionType: 'setTiming',
      outcome: 'applied',
    });
  }

  private async handleStart(ws: WebSocket, room: RoomRow): Promise<void> {
    const held = this.heldSeats(ws);
    const bySeat = held.size > 0 ? Math.min(...held) : null;
    const reject = (error: WireError): void => {
      this.sendRejected(ws, error);
      logMutation({
        room: room.code,
        seq: this.currentSeq(),
        actionId: null,
        seat: bySeat,
        actionType: 'start',
        outcome: 'rejected',
        error: error.code,
      });
    };

    if (room.status !== 'lobby') return reject(wireError('room.notLobby'));
    if (held.size === 0) return reject(wireError('room.notSeated'));

    const game = this.gameFor(room);
    const claimedCount = this.readSeatRows().length;
    if (claimedCount < game.minSeats) {
      return reject(wireError('room.notEnoughSeats', { claimed: claimedCount, minSeats: game.minSeats }));
    }

    // Seed: room code + crypto random hex — the only randomness for the
    // whole match (PLAN §3 randomness idiom).
    const raw = new Uint8Array(16);
    crypto.getRandomValues(raw);
    const seed = `${room.code}:${bytesToHex(raw)}`;
    const config = this.parseConfig(room);

    // Guarded configs: a throwing init is a rejected start, and the room
    // STAYS lobby (PLAN §4 lobby phase).
    let init: { state: unknown; events: unknown[] };
    try {
      init = game.init(config, claimedCount, seed);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reject(wireError('room.startFailed', { message }));
    }

    // Persist the seed alongside the status flip — it is the first leg of
    // the (seed, config, action log) replay triple (PLAN §6).
    this.ctx.storage.sql.exec("UPDATE room SET status = 'playing', seed = ? WHERE id = 1", seed);
    const seq = this.bumpSeq();
    this.touchActivity(Date.now());
    this.ctx.storage.sql.exec(
      'UPDATE snapshot SET state_json = ? WHERE id = 1',
      JSON.stringify(init.state),
    );
    this.ctx.storage.sql.exec(
      'INSERT INTO events (seq, events_json) VALUES (?, ?)',
      seq,
      JSON.stringify(init.events),
    );

    this.broadcast({ v: 1, type: 'started', seq });
    // Recompute deadlines BEFORE fanning out events (PLAN §5 deadlines
    // field): the event broadcast must reflect the just-started match's
    // fresh deadlines, not the pre-start (empty) table.
    await this.recomputeDeadlines('decision');
    this.fanOutEvents(game, config, seq, init.events, init.state, this.currentWireDeadlines());

    logMutation({
      room: room.code,
      seq,
      actionId: null,
      seat: bySeat,
      actionType: 'start',
      outcome: 'applied',
    });
  }

  // -------------------------------------------------------------------------
  // Game actions (PLAN §5): seat-held check, idempotency, advisory
  // expectedSeq, engine validation, persist + fan out
  // -------------------------------------------------------------------------

  private handleActionMsg(
    ws: WebSocket,
    room: RoomRow,
    msg: Extract<ClientMessage, { type: 'action' }>,
  ): void {
    const actionId = typeof msg.actionId === 'string' ? msg.actionId.slice(0, MAX_ACTION_ID_LENGTH) : '';
    const seat = msg.seat;
    const actionType = this.actionTypeOf(msg.action);

    const reject = (error: WireError): void => {
      this.sendRejected(ws, error, actionId || undefined);
      logMutation({
        room: room.code,
        seq: this.currentSeq(),
        actionId: actionId || null,
        seat: typeof seat === 'number' ? seat : null,
        actionType,
        outcome: 'rejected',
        error: error.code,
      });
    };

    if (actionId.length === 0) return reject(wireError('protocol.missingActionId'));
    // Codex M2 audit: 'timeout:' is the RESERVED synthetic-id namespace for
    // alarm-applied default actions ('timeout:seat:seq'). A client-forged id
    // there would poison actions_seen and swallow a future genuine timeout
    // (liveness). Reject it outright.
    if (actionId.startsWith('timeout:')) return reject(wireError('action.reservedActionId'));
    if (typeof seat !== 'number' || !Number.isInteger(seat)) {
      return reject(wireError('protocol.malformed'));
    }
    // Seat-token authority (PLAN §4): the connection must actually hold the
    // acting seat — redaction and authority are keyed on held tokens.
    if (!this.heldSeats(ws).has(seat)) return reject(wireError('seat.notHeld'));
    if (room.status !== 'playing') return reject(wireError('room.notPlaying'));

    const expectedSeq =
      typeof msg.expectedSeq === 'number' && Number.isInteger(msg.expectedSeq) ? msg.expectedSeq : null;

    this.applyGameAction({
      ws,
      room,
      seat,
      actionId,
      expectedSeq,
      action: msg.action,
      actionType,
    });
  }

  private actionTypeOf(action: unknown): string {
    if (typeof action === 'object' && action !== null) {
      const t = (action as { type?: unknown }).type;
      if (typeof t === 'string' && t.length > 0) return t.slice(0, 64);
    }
    return 'action';
  }

  /** The single mutation path for game actions — used by both client
   *  submissions and alarm-applied default actions, so idempotency,
   *  persistence, deadline recompute, fan-out, and logging are identical. */
  private applyGameAction(opts: {
    ws: WebSocket | null; // null on the alarm path
    room: RoomRow;
    seat: Seat;
    actionId: string;
    expectedSeq: number | null;
    action: unknown;
    actionType: string;
  }): 'applied' | 'rejected' | 'duplicate' {
    const { room, seat, actionId } = opts;
    const game = this.gameFor(room);
    const config = this.parseConfig(room);
    const seq = this.currentSeq();

    // Advisory expectedSeq (PLAN §5): staleness is logged on the mutation
    // line, NEVER rejected on — the engine's own validation is the real
    // guard (double-tribute concurrency depends on this).
    const stale = opts.expectedSeq !== null && opts.expectedSeq !== seq ? opts.expectedSeq : undefined;

    // Idempotency (PLAN §5): a duplicate actionId is an idempotent success —
    // send that seat a fresh resync, never re-apply.
    const seen = this.ctx.storage.sql
      .exec<ActionSeenRow>('SELECT action_id, result_seq, at FROM actions_seen WHERE action_id = ?', actionId)
      .toArray();
    if (seen.length > 0) {
      if (opts.ws) {
        const state = this.readState();
        const resync: Extract<ServerMessage, { type: 'resync' }> = {
          v: 1,
          type: 'resync',
          seq,
          seat,
          view: game.playerView(state, seat),
          deadlines: this.currentWireDeadlines(),
        };
        if (new Set<Seat>(game.expectedActors(state)).has(seat)) {
          resync.hints = game.legalActions(state, seat) as unknown[];
        }
        this.send(opts.ws, resync);
      }
      logMutation({
        room: room.code,
        seq,
        actionId,
        seat,
        actionType: opts.actionType,
        outcome: 'duplicate',
        ...(stale !== undefined ? { staleExpectedSeq: stale } : {}),
      });
      return 'duplicate';
    }

    const state = this.readState();
    let applied: ReturnType<AnyGameDefinition['applyAction']>;
    try {
      applied = game.applyAction(state, seat, opts.action);
    } catch (e) {
      // A throwing applyAction is an engine-contract bug (it must return
      // {ok:false}), but the room must not crash on it.
      const message = e instanceof Error ? e.message : String(e);
      applied = { ok: false, error: wireError('action.applyThrew', { message }) };
    }

    if (!applied.ok) {
      if (opts.ws) this.sendRejected(opts.ws, applied.error, actionId);
      logMutation({
        room: room.code,
        seq,
        actionId,
        seat,
        actionType: opts.actionType,
        outcome: 'rejected',
        error: applied.error.code,
        ...(stale !== undefined ? { staleExpectedSeq: stale } : {}),
      });
      return 'rejected';
    }

    // Single-writer guarantee (PLAN §4): seq++ + snapshot + events +
    // actions_seen happen atomically within this one handler invocation.
    // seq and state_json are written in ONE combined UPDATE (not bumpSeq()'s
    // separate seq UPDATE + a second state UPDATE) — Cloudflare bills each
    // UPDATE's affected row toward rows-written, so merging the two saves one
    // row-write per applied action (~12% of the per-action write set; see
    // docs/research/free-tier-efficiency.md Q5). Identical data; the read-back
    // of the new seq is a metered READ, not a write.
    this.ctx.storage.sql.exec(
      'UPDATE snapshot SET seq = seq + 1, state_json = ? WHERE id = 1',
      JSON.stringify(applied.state),
    );
    const newSeq = this.currentSeq();
    this.ctx.storage.sql.exec(
      'INSERT INTO events (seq, events_json) VALUES (?, ?)',
      newSeq,
      JSON.stringify(applied.events),
    );
    this.ctx.storage.sql.exec(
      'INSERT INTO actions_seen (action_id, result_seq, at) VALUES (?, ?, ?)',
      actionId,
      newSeq,
      Date.now(),
    );
    // Replay-artifact log (PLAN §6): both the client path and the alarm
    // path flow through here, so every applied action — and only applied
    // ones; duplicates returned above never reach this line — gets exactly
    // one row, keyed by the mutation seq it produced.
    this.ctx.storage.sql.exec(
      'INSERT INTO actions (seq, seat, action_id, action_json) VALUES (?, ?, ?, ?)',
      newSeq,
      seat,
      actionId,
      JSON.stringify(opts.action),
    );
    if (game.isTerminal(applied.state)) {
      this.ctx.storage.sql.exec("UPDATE room SET status = 'finished' WHERE id = 1");
    }

    // Deadlines recomputed after EVERY state change (PLAN §4); fire-and-
    // forget is fine for the async alarm-scheduling tail — the delete+insert
    // SQL statements inside recomputeDeadlines run synchronously (only
    // `await scheduleAlarm()` is async), so the `deadlines` table already
    // reflects the new state by the time currentWireDeadlines() reads it
    // immediately below, BEFORE fanning out the 'event' broadcast (PLAN §5
    // deadlines field: populated from the table after recomputation).
    void this.recomputeDeadlines('decision');
    this.fanOutEvents(game, config, newSeq, applied.events, applied.state, this.currentWireDeadlines());

    logMutation({
      room: room.code,
      seq: newSeq,
      actionId,
      seat,
      actionType: opts.actionType,
      outcome: 'applied',
      ...(stale !== undefined ? { staleExpectedSeq: stale } : {}),
    });
    return 'applied';
  }

  /** Per-(socket, held-seat) fan-out (PLAN §5): each 'event' message carries
   *  the seq's REDACTED EVENT ARRAY (viewEvent per event, nulls dropped) for
   *  that seat, the seat's fresh authoritative view, and hints iff the seat
   *  is an expected actor. */
  private fanOutEvents(
    game: AnyGameDefinition,
    config: unknown,
    seq: number,
    events: readonly unknown[],
    state: unknown,
    deadlines: ReturnType<typeof toWireDeadlines>,
  ): void {
    const actors = new Set<Seat>(game.expectedActors(state));
    for (const [ws, seats] of this.sessions) {
      for (const seat of seats) {
        const msg: Extract<ServerMessage, { type: 'event' }> = {
          v: 1,
          type: 'event',
          seq,
          seat,
          event: redactEventsFor(game, events, seat, config),
          view: game.playerView(state, seat),
          deadlines,
        };
        if (actors.has(seat)) msg.hints = game.legalActions(state, seat) as unknown[];
        this.send(ws, msg);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Deadlines + alarm (PLAN §4 rule + room-timing.md §2 semantics — all row
  // math in room-helpers nextDeadlines). Two entry points over one pure
  // function: a DECISION recompute (state changed — the only path that may
  // re-arm a clock) and a PRESENCE reconcile (connectivity flipped — may
  // only clamp toward the grace or restore toward base, and touches only
  // the changed seats).
  // -------------------------------------------------------------------------

  // --- Retention activity clock + Q3 pause/resume (pause-and-retention.md §2-3) ---

  /** Bump the retention TTL anchor on a HUMAN-interaction event — every applied
   *  lobby mutation (create / seat-claim / config / timing / start) plus
   *  connect (hello) and disconnect (socket gone, seated or not). NEVER called
   *  on a game action — an auto-playing or paused room must not keep refreshing
   *  its own clock (§3, and it avoids a per-action write). */
  private touchActivity(now: number): void {
    this.ctx.storage.sql.exec('UPDATE room SET last_active_at = ? WHERE id = 1', now);
  }

  /** Q3: record the wall-clock origin the moment a playing room's connected count
   *  hits 0, so a future resume can shift frozen deadlines by the exact paused
   *  duration. Idempotent — only stamps while NULL (a resume clears it). */
  private stampPauseStart(now: number): void {
    this.ctx.storage.sql.exec(
      'UPDATE room SET pause_started_at = ? WHERE id = 1 AND pause_started_at IS NULL',
      now,
    );
  }

  /** Q3 resume (§2): shift every frozen deadline forward by the paused duration
   *  so each actor's REMAINING budget is preserved (a 2s remainder stays 2s; a
   *  grace remainder is preserved too — NO fresh clock, killing the timer-dodge),
   *  then clear the pause origin. No-op if the room was not paused. Called on the
   *  0→1 transition BEFORE the normal presence reconcile restores the reconnecting
   *  actor to its (now-shifted) base. */
  private resumeFromPause(now: number): void {
    const pausedAt = this.readRoomRow()?.pause_started_at ?? null;
    if (pausedAt === null) return;
    const offset = resumeOffsetMs(pausedAt, now);
    if (offset > 0) {
      const sql = this.ctx.storage.sql;
      // due_at shifts for ALL rows (turn remainders AND grace-only rows);
      // base_due_at shifts only where it exists (grace-only rows have base NULL).
      sql.exec('UPDATE deadlines SET due_at = due_at + ?', offset);
      sql.exec('UPDATE deadlines SET base_due_at = base_due_at + ? WHERE base_due_at IS NOT NULL', offset);
    }
    this.ctx.storage.sql.exec('UPDATE room SET pause_started_at = NULL WHERE id = 1');
  }

  /** Call sites: handleStart + applyGameAction (every state change). */
  private async recomputeDeadlines(reason: 'decision'): Promise<void> {
    this.applyNextDeadlines(reason, undefined);
    await this.scheduleAlarm();
  }

  /** Call sites: handleHelloMsg presence delta + handleSocketGone. */
  private async reconcileDeadlines(changedSeats: ReadonlySet<Seat>): Promise<void> {
    this.applyNextDeadlines('presence', changedSeats);
    await this.scheduleAlarm();
  }

  /** SYNCHRONOUS on purpose: the applyGameAction call site is fire-and-
   *  forget and fanOutEvents reads the deadlines table immediately after,
   *  so every SQL statement here must land before the first await (the
   *  callers' `await scheduleAlarm()` is the only async tail). */
  private applyNextDeadlines(
    reason: 'decision' | 'presence',
    changedSeats: ReadonlySet<Seat> | undefined,
  ): void {
    const sql = this.ctx.storage.sql;
    const room = this.readRoomRow();
    if (!room || room.status !== 'playing') {
      sql.exec('DELETE FROM deadlines');
      return;
    }
    const game = this.gameFor(room);
    const state = this.readState();
    if (game.isTerminal(state)) {
      sql.exec('DELETE FROM deadlines');
      return;
    }
    const prev: DeadlineEntry[] = this.readDeadlineRows().map((r) => ({
      seat: r.seat,
      baseDueAt: r.base_due_at,
      dueAt: r.due_at,
      timingClass:
        r.timing_class === 'turn' || r.timing_class === 'planning' ? r.timing_class : null,
    }));
    const rows = nextDeadlines({
      prev,
      expectedActors: game.expectedActors(state),
      timeoutMs: resolveTimeoutMs(game, state, this.parseTiming(room)),
      timingClass: resolveTimingClass(game, state),
      connectedSeats: this.connectedSeats(),
      now: Date.now(),
      reason,
      changedSeats,
    });
    // Replace wholesale — the pure function already returned untouched rows
    // verbatim, so the table contents equal its output either way.
    sql.exec('DELETE FROM deadlines');
    for (const row of rows) {
      sql.exec(
        'INSERT INTO deadlines (seat, due_at, base_due_at, timing_class) VALUES (?, ?, ?, ?)',
        row.seat,
        row.dueAt,
        row.baseDueAt,
        row.timingClass,
      );
    }
  }

  /** One alarm slot per DO: the earliest of (a) the soonest seat deadline —
   *  armed ONLY while a SEAT is connected (Q3: a paused room arms no turn
   *  alarm, so no auto-play burn accrues); (b) the room-retention TTL — armed
   *  only while NO LIVE SOCKET remains (T3: seats are the WRONG gate here — an
   *  occupied-but-idle lobby has 0 connected seats yet a live socket and must
   *  never purge) for a status that auto-purges in the current mode (lazy:
   *  lobby only); (c) the M0 hello probe. */
  private async scheduleAlarm(): Promise<void> {
    // The DO gathers the raw inputs; alarmCandidates() makes the DECISION (same
    // pure function the property test drives). Seat deadlines key on connected
    // SEATS (actors — M4); the TTL keys on live SOCKETS (is anyone here at all —
    // an idle/seatless lobby visitor leaves no time-axis trace under Q1's edge
    // auto-response; see retention.ts).
    const room = this.readRoomRow();
    const minRow = this.ctx.storage.sql
      .exec<{ min_due: number | null; [c: string]: SqlStorageValue }>(
        'SELECT MIN(due_at) AS min_due FROM deadlines',
      )
      .toArray()[0];
    const probe = this.readHelloRow();
    const probeDueAt =
      probe.alarm_set_at !== null && probe.alarm_fired_at === null
        ? probe.alarm_set_at + ALARM_DELAY_MS
        : null;

    // The staleness-sweep candidate's input: the oldest last-proof-of-life
    // across attached sockets (null when none) — the sweep alarm fires when
    // the QUIETEST socket reaches the deadline (socket-liveness.md §5).
    const nowForSeen = Date.now();
    let oldestSocketLastSeenAt: number | null = null;
    for (const ws of this.sessions.keys()) {
      const seen = this.socketLastSeenFor(ws, nowForSeen);
      if (oldestSocketLastSeenAt === null || seen < oldestSocketLastSeenAt) {
        oldestSocketLastSeenAt = seen;
      }
    }

    const candidates = alarmCandidates({
      status: room?.status ?? null, // null room (bare M0 probe DO) → no TTL candidate
      connectedSeatCount: this.seatCount(),
      liveSocketCount: this.socketCount(),
      minSeatDeadlineDueAt: minRow?.min_due ?? null,
      // Anchor = last_active_at ?? created_at; NULL (no room) FAILS SAFE (no TTL),
      // never `?? 0` which would read as epoch = infinitely-stale = purge-now.
      lastActiveAt: room ? (room.last_active_at ?? room.created_at) : null,
      probeDueAt,
      oldestSocketLastSeenAt,
      overrideWindowMs: this.retentionWindowOverride(),
      overrideStaleMs: this.staleSocketOverride(),
    });

    if (candidates.length > 0) {
      await this.ctx.storage.setAlarm(Math.min(...candidates));
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async alarm(): Promise<void> {
    this.ensureSchema();
    const now = Date.now();

    // (a) The M0 G-ALARM probe (kept as the permanent live probe, PLAN §9):
    // fire it only when armed, unfired, and actually due — a seat-deadline
    // alarm may wake us earlier.
    const probe = this.readHelloRow();
    if (probe.alarm_set_at !== null && probe.alarm_fired_at === null && now >= probe.alarm_set_at + ALARM_DELAY_MS) {
      this.ctx.storage.sql.exec('UPDATE hello_state SET alarm_fired_at = ? WHERE id = 1', now);
      logMutation({
        room: this.code(),
        seq: this.currentSeq(),
        actionId: null,
        seat: null,
        actionType: 'alarmFired',
        outcome: 'applied',
      });
    }

    // (a2) Staleness sweep BEFORE the counts, the TTL check, and the auto-play
    // loop: all three must see post-sweep truth — a reaped phantom may have
    // just emptied the room (pause stamped, no auto-play burn) or freed a
    // lobby for its TTL (socket-liveness.md §5). This is also the sweep-alarm
    // candidate's own wake path.
    await this.sweepStaleSockets(now);

    const connectedSeatCount = this.seatCount();
    const liveSocketCount = this.socketCount();

    // (b) Room-retention TTL self-purge (pause-and-retention.md §3.1). Runs
    // REGARDLESS of the Q3 seat-deadline guard below (a paused room past its
    // window must still be able to purge). Gated on LIVE SOCKETS, never on
    // connected seats — an occupied-but-idle lobby has 0 connected seats yet a
    // live socket, and must NOT be purged (retention.ts invariant). An abandoned
    // room past its window whose status auto-purges in the current mode (lazy:
    // lobby only) reclaims ALL its storage via deleteAll() — the only op that
    // frees a DO's storage. Lobby rooms hold no replayable game, so no dump is
    // needed; played-out rooms never reach here in lazy mode (they arm no TTL
    // alarm), preserving replay.
    const roomForTtl = this.readRoomRow();
    if (
      roomForTtl !== null &&
      isAutoPurgeEligible({
        status: roomForTtl.status,
        liveSocketCount,
        lastActiveAt: roomForTtl.last_active_at ?? roomForTtl.created_at,
        now,
        overrideWindowMs: this.retentionWindowOverride(),
      })
    ) {
      logMutation({
        room: roomForTtl.code,
        seq: this.currentSeq(),
        actionId: null,
        seat: null,
        actionType: 'roomPurged',
        outcome: 'applied',
      });
      await this.ctx.storage.deleteAll(); // reclaims all storage, incl. the alarm
      await this.ctx.storage.deleteAlarm(); // explicit (belt-and-braces across compat dates)
      // deleteAll() drops the tables too. If this DO stays warm (no constructor
      // re-run before the next request), a read would hit a missing table; restore
      // an EMPTY schema so a subsequent GET reads no room → 404 (the match's rows
      // stay reclaimed — only the empty table definitions come back).
      this.ensureSchema();
      return; // the room is gone — nothing else to do
    }

    // (c) Seat deadlines: AUTO-PLAY ONLY WHILE CONNECTED (Q3 pause guard — a room
    // at connected==0 is frozen; no default actions apply, so no burn). The
    // stale-alarm guard re-reads the table and acts only on rows due NOW; default
    // actions go through the normal action path (same seq/idempotency/fan-out)
    // with the deterministic 'timeout:<seat>:<seq>' actionId, so an alarm retry
    // (at-least-once) dedups instead of double-applying.
    for (let i = 0; mayAutoPlay(connectedSeatCount) && i < MAX_ALARM_APPLIES; i++) {
      const room = this.readRoomRow();
      if (!room || room.status !== 'playing') break;
      const due = this.ctx.storage.sql
        .exec<DeadlineRow>(
          'SELECT seat, due_at, base_due_at, timing_class FROM deadlines WHERE due_at <= ? ORDER BY due_at, seat LIMIT 1',
          Date.now(),
        )
        .toArray()[0];
      if (!due) break;

      const game = this.gameFor(room);
      const state = this.readState();
      const seq = this.currentSeq();
      const seat = due.seat;
      const defaultAction = game.defaultAction(state, seat);

      if (defaultAction === null) {
        // Seat cannot act right now — the deadline row is stale; drop it so
        // the loop terminates instead of spinning.
        this.ctx.storage.sql.exec('DELETE FROM deadlines WHERE seat = ?', seat);
        logMutation({
          room: room.code,
          seq,
          actionId: timeoutActionId(seat, seq),
          seat,
          actionType: 'timeout',
          outcome: 'rejected',
          error: 'timeout.noDefaultAction',
        });
        continue;
      }

      const outcome = this.applyGameAction({
        ws: null,
        room,
        seat,
        actionId: timeoutActionId(seat, seq),
        expectedSeq: null,
        action: defaultAction,
        actionType: 'timeout',
      });
      if (outcome !== 'applied') {
        // 'applied' recomputes deadlines itself; a rejected/duplicate
        // outcome leaves the stale row in place — remove it explicitly so
        // we can't loop on it.
        this.ctx.storage.sql.exec('DELETE FROM deadlines WHERE seat = ?', seat);
      }
    }

    await this.scheduleAlarm();
  }

  // -------------------------------------------------------------------------
  // Presence (PLAN §4): a seat is connected iff some live socket's
  // attachment includes it; recompute on close/error.
  // -------------------------------------------------------------------------

  async webSocketClose(ws: WebSocket): Promise<void> {
    // compatibility_date ≥ 2026-04-07 → web_socket_auto_reply_to_close: the
    // runtime handles the close handshake; we only do bookkeeping.
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const seats = this.sessions.get(ws);
    this.sessions.delete(ws);
    this.acceptedAt.delete(ws);
    if (!seats || seats.size === 0) {
      // No seat presence changed, but a SEATLESS departure can still be the
      // last live socket leaving: while it was attached, any TTL wake was
      // refused (T3) and scheduleAlarm() deleted the alarm (no candidates), so
      // without this re-arm an abandoned lobby that ever hosted a seatless
      // visitor would be immortal (Grok audit — the dual of the never-joined
      // orphan). The human behind the socket also just left → bump the
      // activity anchor, exactly like the seated path below.
      this.touchActivity(Date.now());
      await this.scheduleAlarm();
      return;
    }

    const stillConnected = this.connectedSeats();
    const gone = [...seats].filter((s) => !stillConnected.has(s)).sort((a, b) => a - b);
    if (gone.length === 0) return; // a takeover socket still holds them

    const seq = this.currentSeq();
    for (const s of gone) {
      this.broadcast({ v: 1, type: 'presence', seq, seat: s, connected: false });
    }
    // A disconnect is a human-interaction event → bump the retention TTL anchor
    // (also the anchor a lobby room's TTL keys on once its creator's tab closes).
    const now = Date.now();
    this.touchActivity(now);
    const room = this.readRoomRow();
    if (room && room.status === 'playing') {
      // Q3: if this disconnect empties a playing room, PAUSE — record the offset
      // origin (a future resume shifts frozen deadlines by the paused duration);
      // scheduleAlarm will then omit the seat-deadline alarm (connected==0), so
      // no auto-play burn accrues while nobody watches. Same isPausedRoom
      // predicate as the constructor stamp — so stamp ≡ pause, and a paused room
      // always has a non-NULL pause_started_at (invariant, pinned in the tests).
      if (isPausedRoom(room.status, this.seatCount())) this.stampPauseStart(now);
      // Newly-disconnected expected actors pick up the disconnect-grace
      // clamp (PLAN §4 rule); other seats' rows are untouched (room-
      // timing.md §2 presence semantics). reconcileDeadlines re-schedules.
      await this.reconcileDeadlines(new Set(gone));
    } else if (room) {
      // Lobby/finished: no seat deadlines, but a presence change updates the TTL
      // candidate — e.g. a lobby room whose creator just closed their tab is now
      // abandoned and should arm its 48h self-purge (retention §4).
      await this.scheduleAlarm();
    }
  }

  // -------------------------------------------------------------------------
  // M0 G-ALARM probe endpoints — kept verbatim as the permanent live probe
  // (PLAN §9 gates: G-ALARM re-checked hibernated at M2).
  // -------------------------------------------------------------------------

  private toStatus(roomCode: string, row: HelloRow): HelloStatus {
    return {
      roomCode,
      count: row.count,
      alarmSetAt: row.alarm_set_at,
      alarmFiredAt: row.alarm_fired_at,
    };
  }

  private async handleHello(roomCode: string): Promise<Response> {
    this.ctx.storage.sql.exec('UPDATE hello_state SET count = count + 1 WHERE id = 1');
    logMutation({
      room: roomCode,
      seq: this.currentSeq(),
      actionId: null,
      seat: null,
      actionType: 'hello',
      outcome: 'applied',
    });

    const row = this.readHelloRow();

    // G-ALARM probe arm step: arm exactly once per room lifetime. Checked
    // against the probe's OWN columns (not getAlarm()) because the single
    // alarm slot is now shared with seat deadlines.
    if (row.alarm_set_at === null && row.alarm_fired_at === null) {
      const alarmSetAt = Date.now();
      this.ctx.storage.sql.exec('UPDATE hello_state SET alarm_set_at = ? WHERE id = 1', alarmSetAt);
      await this.scheduleAlarm();
      logMutation({
        room: roomCode,
        seq: this.currentSeq(),
        actionId: null,
        seat: null,
        actionType: 'alarmSet',
        outcome: 'applied',
      });
    }

    const finalRow = this.readHelloRow();
    return Response.json(this.toStatus(roomCode, finalRow));
  }
}
