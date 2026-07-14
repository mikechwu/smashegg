// Wire protocol v1 (PLAN.md §5, M2 revision): versioned JSON envelope,
// locale-free, game-agnostic. Multi-seat model (PLAN §4): one multiplexed
// socket carries every seat whose token the connection presented — per-seat
// messages repeat per held seat; actions name their seat. Liveness pings
// are the BARE string 'ping' (answered by the DO's auto-response while
// hibernated), never JSON.

import type { Seat } from '../engine/core/game';

export interface HealthResponse {
  ok: true;
}

/** Kept from M0 as the permanent live G-ALARM probe (PLAN §9 gates). */
export interface HelloStatus {
  roomCode: string;
  count: number;
  alarmSetAt: number | null;
  alarmFiredAt: number | null;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface SeatInfo {
  seat: Seat;
  name: string | null;
  claimed: boolean;
  connected: boolean;
}

/** Public room snapshot. `config` is opaque game-defined data — the room
 *  layer never interprets it (PLAN §4 lobby phase). */
export interface RoomInfo {
  gameId: string;
  status: RoomStatus;
  config: unknown;
  seats: SeatInfo[];
  seq: number;
}

// ---------------------------------------------------------------------------
// Client → server
// ---------------------------------------------------------------------------

export type ClientMessage =
  | {
      v: 1;
      type: 'hello';
      /** Seat tokens this connection holds (0..4 of them; empty = not yet
       *  seated, e.g. a fresh join still in the lobby). */
      tokens: string[];
      lastSeenSeq: number;
    }
  | { v: 1; type: 'claimSeat'; name: string } // lobby only; mints that seat's token
  | { v: 1; type: 'setConfig'; config: unknown } // lobby only; any seated player
  | { v: 1; type: 'start' } // lobby only; any seated player, all seats claimed
  | {
      v: 1;
      type: 'action';
      /** The acting seat — must be one whose token this connection holds. */
      seat: Seat;
      /** Client-generated UUID: exactly-once across retries (PLAN §5). */
      actionId: string;
      /** Advisory optimistic-concurrency hint; the engine's own validation
       *  is the real guard (PLAN §5). */
      expectedSeq: number;
      action: unknown;
    };

// ---------------------------------------------------------------------------
// Server → client. Every message carries the room seq at/after which it
// applies. Per-seat messages ('event' | 'resync') are sent once per seat
// the connection holds.
// ---------------------------------------------------------------------------

export interface WireError {
  code: string;
  params?: Record<string, unknown>;
}

/** Who is on the clock and when their deadline expires (PLAN §4 turn
 *  timeouts). `dueAt` is a SERVER-CLOCK epoch-ms timestamp: clients render
 *  it as relative time (`dueAt - Date.now()`), so client/server clock skew
 *  is purely cosmetic (a countdown a little fast or slow) — the DO's own
 *  alarm, not the client, is what actually applies the timeout at expiry.
 *  This is PUBLIC info (who is on the clock is visible at a physical table)
 *  so it is broadcast unredacted, unlike per-seat events/views. */
export interface WireDeadline {
  seat: Seat;
  dueAt: number;
}

export type ServerMessage =
  | {
      v: 1;
      type: 'welcome';
      seq: number;
      seats: Seat[];
      room: RoomInfo;
      /** Current per-seat deadlines (empty when none are outstanding, e.g.
       *  lobby/terminal). */
      deadlines?: WireDeadline[];
    }
  | { v: 1; type: 'roomChanged'; seq: number; room: RoomInfo } // claims/presence/lobby churn
  | {
      v: 1;
      type: 'seatClaimed';
      seq: number;
      seat: Seat;
      name: string;
      /** Present ONLY on the claiming connection's copy — the minted seat
       *  token. Everyone else sees the claim without it. */
      token?: string;
    }
  | { v: 1; type: 'configChanged'; seq: number; config: unknown; bySeat: Seat }
  | { v: 1; type: 'started'; seq: number }
  | {
      v: 1;
      type: 'event';
      seq: number;
      /** The held seat this copy is redacted for. */
      seat: Seat;
      event: unknown;
      view: unknown;
      /** The seat's current legal actions — present iff it is an expected
       *  actor (PLAN §5 hints). */
      hints?: unknown[];
      /** Current per-seat deadlines, read AFTER this action's deadline
       *  recomputation (empty array when none outstanding). */
      deadlines?: WireDeadline[];
    }
  | {
      v: 1;
      type: 'resync';
      seq: number;
      seat: Seat;
      view: unknown;
      /** Redacted missed events when the gap fits the retained log. */
      events?: { seq: number; event: unknown }[];
      hints?: unknown[];
      /** Current per-seat deadlines (empty array when none outstanding). */
      deadlines?: WireDeadline[];
    }
  | { v: 1; type: 'presence'; seq: number; seat: Seat; connected: boolean }
  | { v: 1; type: 'rejected'; seq: number; actionId?: string; error: WireError };

export const PROTOCOL_VERSION = 1 as const;

/** Room codes: 6 chars, unambiguous alphabet (no 0/O/1/I) — PLAN §8. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
