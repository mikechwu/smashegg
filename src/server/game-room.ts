// GameRoom Durable Object — M2 (PLAN.md §4 transport/session, §5 protocol,
// §6 debuggability). One DO instance per room code, SQLite-backed,
// WebSocket Hibernation API throughout (docs/research/reconnection-patterns
// §1 is the canonical shape this follows).
//
// GAME-AGNOSTICISM (the M2 proof, PLAN §9): this file imports ONLY from
// '../shared/protocol', '../shared/games', '../engine/core/*',
// './room-helpers' (pure extractions of this file's own logic), './index'
// (the Env type), and 'cloudflare:workers'. ZERO imports from
// engine/guandan or engine/guess-number — compile-proven at the gate.
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
  bytesToHex,
  computeDeadlines,
  deltaCoversGap,
  redactEventsFor,
  sha256Hex,
  timeoutActionId,
} from './room-helpers';

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
    }
    this.ctx.setWebSocketAutoResponse(PING_PONG);
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
         seed TEXT  -- set at start: the exact seed passed to game.init (PLAN §6 replay)
       )`,
    );
    // Migration for rooms created before the seed column existed: SQLite has
    // no ADD COLUMN IF NOT EXISTS, so probe the live schema first.
    const roomColumns = sql
      .exec<{ name: string; [c: string]: SqlStorageValue }>("SELECT name FROM pragma_table_info('room')")
      .toArray();
    if (!roomColumns.some((c) => c.name === 'seed')) {
      sql.exec('ALTER TABLE room ADD COLUMN seed TEXT');
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
         due_at INTEGER NOT NULL
       )`,
    );
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
      .exec<RoomRow>('SELECT game_id, config_json, status, code, created_at, seed FROM room WHERE id = 1')
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

  private setSeats(ws: WebSocket, seats: Set<Seat>): void {
    this.sessions.set(ws, seats);
    const attachment: SocketAttachment = { seats: [...seats].sort((a, b) => a - b) };
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
    let body: { gameId?: unknown; config?: unknown };
    try {
      body = (await request.json()) as { gameId?: unknown; config?: unknown };
    } catch {
      return Response.json({ error: 'request.invalidJson' }, { status: 400 });
    }
    const gameId = body.gameId;
    if (typeof gameId !== 'string' || getGame(gameId) === null) {
      return Response.json({ error: 'game.unknown' }, { status: 400 });
    }
    this.ctx.storage.sql.exec(
      'INSERT INTO room (id, game_id, config_json, status, code, created_at) VALUES (1, ?, ?, ?, ?, ?)',
      gameId,
      JSON.stringify(body.config ?? null),
      'lobby',
      code,
      Date.now(),
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
    return Response.json({ ok: true }, { status: 201 });
  }

  private handleInfo(): Response {
    const room = this.readRoomRow();
    if (!room) return Response.json({ error: 'notFound' }, { status: 404 });
    return Response.json(this.buildRoomInfo(room));
  }

  private handleWebSocketUpgrade(): Response {
    if (this.readRoomRow() === null) {
      return Response.json({ error: 'notFound' }, { status: 404 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // NO tags: seats are unknown at upgrade time — identity is acquired via
    // hello/claimSeat and lives in the attachment (PLAN §4).
    this.ctx.acceptWebSocket(server);
    this.setSeats(server, new Set());

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Room dump (PLAN §6): the SQLite content IS the audit trail; dumping it
   *  is a first-class documented affordance. Gated: always on when
   *  ENVIRONMENT === 'dev'; otherwise requires the DEBUG_DUMP_TOKEN secret
   *  to be configured AND presented — else an indistinguishable 404. Token
   *  HASHES only, never raw tokens. */
  private handleDump(request: Request): Response {
    const devMode = this.env.ENVIRONMENT === 'dev';
    const configuredToken = this.env.DEBUG_DUMP_TOKEN;
    const presented = request.headers.get('x-debug-dump-token');
    const allowed =
      devMode || (configuredToken !== undefined && configuredToken !== '' && presented === configuredToken);
    if (!allowed) return Response.json({ error: 'notFound' }, { status: 404 });

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
    const deadlineRows = this.ctx.storage.sql
      .exec<DeadlineRow>('SELECT seat, due_at FROM deadlines ORDER BY seat')
      .toArray();

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
      deadlines: deadlineRows.map((r) => ({ seat: r.seat, dueAt: r.due_at })),
    });
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
    this.send(ws, { v: 1, type: 'welcome', seq, seats: sortedSeats, room: this.buildRoomInfo(room) });

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

    // Presence broadcast for newly-connected seats.
    const newlyConnected = sortedSeats.filter((s) => !connectedBefore.has(s));
    for (const s of newlyConnected) {
      this.broadcast({ v: 1, type: 'presence', seq, seat: s, connected: true });
    }
    if (newlyConnected.length > 0 && room.status === 'playing') {
      // Reconnection lifts the disconnect-grace clamp — recompute deadlines
      // fresh under the PLAN §4 rule (note: this restarts the phase timer).
      await this.recomputeDeadlinesAndAlarm();
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
    this.fanOutEvents(game, config, seq, init.events, init.state);
    await this.recomputeDeadlinesAndAlarm();

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
    const newSeq = this.bumpSeq();
    this.ctx.storage.sql.exec(
      'UPDATE snapshot SET state_json = ? WHERE id = 1',
      JSON.stringify(applied.state),
    );
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

    this.fanOutEvents(game, config, newSeq, applied.events, applied.state);
    // Deadlines recomputed after EVERY state change (PLAN §4); fire-and-
    // forget is fine — storage writes settle within this invocation.
    void this.recomputeDeadlinesAndAlarm();

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
        };
        if (actors.has(seat)) msg.hints = game.legalActions(state, seat) as unknown[];
        this.send(ws, msg);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Deadlines + alarm (PLAN §4, verbatim rule — math in room-helpers)
  // -------------------------------------------------------------------------

  private async recomputeDeadlinesAndAlarm(): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM deadlines');
    const room = this.readRoomRow();
    if (room && room.status === 'playing') {
      const game = this.gameFor(room);
      const state = this.readState();
      if (!game.isTerminal(state)) {
        const rows = computeDeadlines(
          game.expectedActors(state),
          game.actionTimeoutMs(state),
          this.connectedSeats(),
          Date.now(),
        );
        for (const { seat, dueAt } of rows) {
          this.ctx.storage.sql.exec('INSERT INTO deadlines (seat, due_at) VALUES (?, ?)', seat, dueAt);
        }
      }
    }
    await this.scheduleAlarm();
  }

  /** One alarm slot per DO: schedule the earliest of (a) the soonest seat
   *  deadline and (b) the M0 hello probe's due time (if armed, unfired). */
  private async scheduleAlarm(): Promise<void> {
    const candidates: number[] = [];
    const minRows = this.ctx.storage.sql
      .exec<{ min_due: number | null; [c: string]: SqlStorageValue }>(
        'SELECT MIN(due_at) AS min_due FROM deadlines',
      )
      .toArray();
    if (minRows[0] && minRows[0].min_due !== null) candidates.push(minRows[0].min_due);

    const probe = this.readHelloRow();
    if (probe.alarm_set_at !== null && probe.alarm_fired_at === null) {
      candidates.push(probe.alarm_set_at + ALARM_DELAY_MS);
    }

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

    // (b) Seat deadlines: stale-alarm guard by re-reading the table and only
    // acting on rows that are actually due NOW. Default actions go through
    // the normal action path (same seq/idempotency/fan-out machinery) with
    // the deterministic 'timeout:<seat>:<seq>' actionId, so an alarm retry
    // (at-least-once semantics) dedups instead of double-applying.
    for (let i = 0; i < MAX_ALARM_APPLIES; i++) {
      const room = this.readRoomRow();
      if (!room || room.status !== 'playing') break;
      const due = this.ctx.storage.sql
        .exec<DeadlineRow>(
          'SELECT seat, due_at FROM deadlines WHERE due_at <= ? ORDER BY due_at, seat LIMIT 1',
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
    if (!seats || seats.size === 0) return;

    const stillConnected = this.connectedSeats();
    const gone = [...seats].filter((s) => !stillConnected.has(s)).sort((a, b) => a - b);
    if (gone.length === 0) return; // a takeover socket still holds them

    const seq = this.currentSeq();
    for (const s of gone) {
      this.broadcast({ v: 1, type: 'presence', seq, seat: s, connected: false });
    }
    const room = this.readRoomRow();
    if (room && room.status === 'playing') {
      // Newly-disconnected expected actors pick up the disconnect-grace
      // clamp (PLAN §4 deadline rule; note: fresh recompute restarts the
      // phase timer for everyone).
      await this.recomputeDeadlinesAndAlarm();
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
