// GameRoom Durable Object — M0 scope (PLAN.md §4, §6, §9).
//
// M0 is the G-COMPOSE / G-ALARM gate probe, NOT the real room: it proves
// (a) a single Worker deploy serves assets *and* answers through this DO,
// and (b) a DO alarm fires on the free tier. The real per-room SQLite
// schema (room/players/snapshot/events/actions_seen/deadlines), the
// versioned wire envelope, and WebSocket Hibernation session/seat
// discipline described in PLAN.md §4/§5 land with the M2 GameRoom work.
// This file only exercises the alarm + hibernation + SQLite primitives in
// isolation so the gate checks have something real to measure.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import type { HelloStatus } from "../shared/protocol";

// Bare literal "ping" -> "pong" answered while hibernated, at zero cost
// (PLAN.md §4). Matches exact literal strings only.
const PING_PONG = new WebSocketRequestResponsePair("ping", "pong");

const ALARM_DELAY_MS = 15_000;

// Extends Record<string, SqlStorageValue> (index signature) so this shape
// satisfies SqlStorage.exec's generic constraint.
interface HelloRow {
  id: number;
  count: number;
  alarm_set_at: number | null;
  alarm_fired_at: number | null;
  [column: string]: SqlStorageValue;
}

/** One JSON line per mutation (PLAN.md §6) — greppable by room + actionType. */
function logMutation(
  room: string,
  actionType: "hello" | "alarmSet" | "alarmFired" | "wsOpen" | "wsMessage",
): void {
  console.log(
    JSON.stringify({
      room,
      seq: null,
      actionId: null,
      seat: null,
      actionType,
      outcome: "applied",
    }),
  );
}

export class GameRoom extends DurableObject<Env> {
  // Rebuildable in-memory cache of the room code this DO instance is
  // currently serving (one DO per room code) — set on every `fetch`,
  // used by callbacks (webSocketMessage/alarm) that don't carry a
  // request URL of their own. Never authoritative: the SQLite row above
  // is the durable state, and a fresh instance simply falls back to
  // "unknown" for log correlation until the next `fetch` repopulates it.
  private roomCode: string | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(PING_PONG);
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS hello_state (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         count INTEGER NOT NULL,
         alarm_set_at INTEGER,
         alarm_fired_at INTEGER
       )`,
    );
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO hello_state (id, count, alarm_set_at, alarm_fired_at)
       VALUES (1, 0, NULL, NULL)`,
    );
  }

  private readRow(): HelloRow {
    return this.ctx.storage.sql
      .exec<HelloRow>("SELECT id, count, alarm_set_at, alarm_fired_at FROM hello_state WHERE id = 1")
      .one();
  }

  private toStatus(roomCode: string, row: HelloRow): HelloStatus {
    return {
      roomCode,
      count: row.count,
      alarmSetAt: row.alarm_set_at,
      alarmFiredAt: row.alarm_fired_at,
    };
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureSchema();

    const url = new URL(request.url);
    // Room code lives in the URL path, not stored state (one DO per room
    // code already; re-deriving it from the request avoids a redundant
    // second source of truth).
    const segments = url.pathname.split("/").filter(Boolean); // ["api","rooms",code,leaf]
    const roomCode = segments[2] ?? "unknown";
    const leaf = segments[3] ?? "";
    this.roomCode = roomCode;

    if (leaf === "hello" && request.method === "GET") {
      return this.handleHello(roomCode);
    }

    if (leaf === "status" && request.method === "GET") {
      const row = this.readRow();
      return Response.json(this.toStatus(roomCode, row));
    }

    if (leaf === "ws" && request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(roomCode);
    }

    return new Response("not found", { status: 404 });
  }

  private async handleHello(roomCode: string): Promise<Response> {
    this.ctx.storage.sql.exec(
      "UPDATE hello_state SET count = count + 1 WHERE id = 1",
    );
    logMutation(roomCode, "hello");

    const row = this.readRow();

    // G-ALARM probe arm step: arm the alarm exactly once per room lifetime
    // (no alarm currently pending, and it has never fired yet).
    const pending = await this.ctx.storage.getAlarm();
    if (pending === null && row.alarm_fired_at === null) {
      const alarmSetAt = Date.now();
      await this.ctx.storage.setAlarm(alarmSetAt + ALARM_DELAY_MS);
      this.ctx.storage.sql.exec(
        "UPDATE hello_state SET alarm_set_at = ? WHERE id = 1",
        alarmSetAt,
      );
      logMutation(roomCode, "alarmSet");
    }

    const finalRow = this.readRow();
    return Response.json(this.toStatus(roomCode, finalRow));
  }

  private handleWebSocketUpgrade(roomCode: string): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation API: the runtime owns the accept, not ws.accept().
    this.ctx.acceptWebSocket(server);
    logMutation(roomCode, "wsOpen");

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    ws.send(`echo:${text}`);
    logMutation(this.roomCode ?? "unknown", "wsMessage");
  }

  async alarm(): Promise<void> {
    this.ensureSchema();
    const firedAt = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE hello_state SET alarm_fired_at = ? WHERE id = 1",
      firedAt,
    );
    logMutation(this.roomCode ?? "unknown", "alarmFired");
  }
}
