// Pure helpers extracted from the GameRoom Durable Object (PLAN.md §4/§6)
// so the token hashing, per-seat event redaction, deadline math, and
// resync-gap logic are unit-testable without a DO runtime (see
// tests/unit/server/room-helpers.test.ts).
//
// PLATFORM-NEUTRAL ON PURPOSE: this file is typechecked both under
// tsconfig.server.json (workers-types) and — via the unit tests — under
// tsconfig.client.json (DOM lib), so it may only use globals that exist in
// both (crypto.subtle, crypto.getRandomValues, TextEncoder). No SqlStorage,
// no WebSocket, no cloudflare:workers imports here.

import type { Seat } from '../engine/core/game';
import type { AnyGameDefinition } from '../shared/games';
import { ROOM_CODE_ALPHABET } from '../shared/protocol';

// ---------------------------------------------------------------------------
// Hashing / token material (PLAN §8: 128-bit+ random seat tokens, SHA-256
// hashed at rest; the raw token is NEVER stored or logged).
// ---------------------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** SHA-256 of a UTF-8 string as lowercase hex — the only representation of
 *  a seat token that is ever persisted (seats.token_hash) or dumped. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/** Map random bytes onto the unambiguous room-code alphabet (PLAN §8).
 *  The alphabet has exactly 32 characters and 256 % 32 === 0, so a plain
 *  modulo is bias-free — every code is uniformly likely. */
export function roomCodeFromBytes(bytes: Uint8Array): string {
  if (ROOM_CODE_ALPHABET.length !== 32) {
    // Guards the bias-free-modulo argument above if the alphabet ever changes.
    throw new Error('ROOM_CODE_ALPHABET must have exactly 32 characters');
  }
  let code = '';
  for (const b of bytes) code += ROOM_CODE_ALPHABET[b % 32];
  return code;
}

// ---------------------------------------------------------------------------
// Deadline math (PLAN §4 turn-timeout rule, applied verbatim):
//   - one deadline row per expected actor;
//   - due = now + actionTimeoutMs(state), clamped to [5s, 120s];
//   - a DISCONNECTED expected actor gets min(that, now + 60s);
//   - actionTimeoutMs === null disables the timeout ONLY for connected
//     seats — a disconnected expected actor still gets now + 60s, so the
//     table can never deadlock on an absent player (obligation 5 / the M4
//     deadlock-freedom property).
// ---------------------------------------------------------------------------

export const ACTION_TIMEOUT_MIN_MS = 5_000;
export const ACTION_TIMEOUT_MAX_MS = 120_000;
export const DISCONNECT_GRACE_MS = 60_000;

export interface SeatDeadline {
  seat: Seat;
  dueAt: number;
}

export function computeDeadlines(
  expectedActors: readonly Seat[],
  actionTimeoutMs: number | null,
  connectedSeats: ReadonlySet<Seat>,
  now: number,
): SeatDeadline[] {
  const deadlines: SeatDeadline[] = [];
  for (const seat of expectedActors) {
    const connected = connectedSeats.has(seat);
    if (actionTimeoutMs === null) {
      // Untimed phase: no deadline for connected seats; disconnected seats
      // still get the grace deadline (PLAN §4, the null-timeout rule).
      if (!connected) deadlines.push({ seat, dueAt: now + DISCONNECT_GRACE_MS });
      continue;
    }
    const clamped = Math.min(ACTION_TIMEOUT_MAX_MS, Math.max(ACTION_TIMEOUT_MIN_MS, actionTimeoutMs));
    const due = now + clamped;
    deadlines.push({ seat, dueAt: connected ? due : Math.min(due, now + DISCONNECT_GRACE_MS) });
  }
  return deadlines;
}

/** The idempotency key for an alarm-applied default action (PLAN §4):
 *  keyed on the seq the timeout fired against, so an alarm retry (at-least-
 *  once semantics) dedups via actions_seen instead of double-applying. */
export function timeoutActionId(seat: Seat, seq: number): string {
  return `timeout:${seat}:${seq}`;
}

/** The wire shape of a broadcast deadline (protocol.ts `ServerMessage`
 *  'welcome' | 'resync' | 'event'): who is on the clock and when their
 *  deadline expires, in server-clock epoch ms. This is PUBLIC information —
 *  at a physical table everyone can see whose turn it is — so it is sent
 *  unredacted to every seat, unlike game events/views. Clients render it as
 *  RELATIVE time (dueAt - Date.now()); server/client clock skew is cosmetic
 *  (a countdown a little fast or slow), never a correctness concern, since
 *  the DO's own alarm — not the client — is what actually applies the
 *  default action at expiry. */
export interface WireDeadline {
  seat: Seat;
  dueAt: number;
}

/** Maps the DO's `deadlines` table rows (snake_case, persisted shape) to the
 *  wire's camelCase shape, sorted by seat for a deterministic broadcast.
 *  Pure so it's testable without a DO/SqlStorage runtime. */
export function toWireDeadlines(
  rows: readonly { seat: Seat; due_at: number }[],
): WireDeadline[] {
  return rows
    .map((r) => ({ seat: r.seat, dueAt: r.due_at }))
    .sort((a, b) => a.seat - b.seat);
}

// ---------------------------------------------------------------------------
// Redaction fan-out (PLAN §3 obligation 3 / §5): viewEvent is the ONLY
// event egress. One applied action produces an ARRAY of engine events; the
// wire 'event' message carries the seq's redacted event array for one held
// seat, with nulls (fully-hidden events) dropped.
// ---------------------------------------------------------------------------

export function redactEventsFor(
  game: AnyGameDefinition,
  events: readonly unknown[],
  seat: Seat,
  config: unknown,
): unknown[] {
  const redacted: unknown[] = [];
  for (const event of events) {
    const view = game.viewEvent(event, seat, config);
    if (view !== null) redacted.push(view);
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// Resync gap check (PLAN §5 reconnection flow, step 3): the event delta
// lastSeenSeq+1..seq is only sent when the retained log actually covers it
// contiguously. Lobby-phase seq bumps write NO events rows (only game
// mutations are logged), so a client whose lastSeenSeq predates the start
// falls through to snapshot-only resync — the view alone is sufficient.
// ---------------------------------------------------------------------------

export function deltaCoversGap(
  lastSeenSeq: number,
  currentSeq: number,
  retainedSeqs: readonly number[],
): boolean {
  if (lastSeenSeq >= currentSeq) return false; // nothing missed (or client ahead — resync by snapshot)
  const wanted = currentSeq - lastSeenSeq;
  if (retainedSeqs.length !== wanted) return false;
  for (let i = 0; i < wanted; i++) {
    if (retainedSeqs[i] !== lastSeenSeq + 1 + i) return false;
  }
  return true;
}

/** Constant-time-ish string equality for secret comparison (Grok M2 audit
 *  F2). Leaks only the length, which is acceptable for the dump token —
 *  the practical timing-exploit surface over the network is already weak;
 *  this removes the trivially variable early-exit compare. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
