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

import type { Seat, TimingClass } from '../engine/core/game';
import type { AnyGameDefinition } from '../shared/games';
import { ROOM_CODE_ALPHABET, type RoomStatus, type WireDeadline } from '../shared/protocol';
import {
  ACTION_TIMEOUT_MAX_MS,
  ACTION_TIMEOUT_MIN_MS,
  timeoutMsFor,
  type RoomTiming,
} from '../shared/timing';
import { ttlDueAt, type RetentionMode } from '../shared/retention';

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
// Deadline math (PLAN §4 turn-timeout rule + the M4 recompute semantics,
// docs/research/room-timing.md §2). Core rule: a deadline is a property of
// a DECISION POINT, not of connectivity —
//   - one row per expected actor; budget = now-at-arm + clamp(ms, [5s,120s]);
//   - baseDueAt records the budget armed when the decision became the
//     seat's; presence events may only CLAMP DOWN toward the disconnect
//     grace or RESTORE UP to base — never beyond base, never re-arm, never
//     touch uninvolved seats;
//   - a null timeout disables the deadline ONLY for connected seats — a
//     disconnected expected actor always gets a grace row, so the table can
//     never deadlock on an absent player (deadlock-freedom DL1).
// The clamp bounds live in shared/timing.ts (validateRoomTiming enforces
// them at config time) and are re-exported here for the DO/tests.
// ---------------------------------------------------------------------------

export { ACTION_TIMEOUT_MIN_MS, ACTION_TIMEOUT_MAX_MS } from '../shared/timing';
export const DISCONNECT_GRACE_MS = 60_000;

/** One persisted deadlines-table row in camelCase (the pure-math shape).
 *  baseDueAt NULL ⇔ the row exists only as a disconnect grace for an
 *  untimed actor. timingClass NULL only on rows armed before the class
 *  column existed (pre-M4 migration). */
export interface DeadlineEntry {
  seat: Seat;
  baseDueAt: number | null;
  dueAt: number;
  timingClass: TimingClass | null;
}

/** Resolved timing class of the current state — the erased optional call
 *  the DO makes; an omitted engine method means every state is 'turn'. */
export function resolveTimingClass(game: AnyGameDefinition, state: unknown): TimingClass {
  return game.timingClass?.(state) ?? 'turn';
}

/** Effective timeout for the current state (room-timing.md §1 resolution
 *  order): a legacy room (timing NULL) takes the engine suggestion
 *  verbatim; an engine-declared untimed state (actionTimeoutMs null)
 *  always wins; otherwise the state's class maps through RoomTiming. */
export function resolveTimeoutMs(
  game: AnyGameDefinition,
  state: unknown,
  timing: RoomTiming | null,
): number | null {
  const suggested = game.actionTimeoutMs(state);
  if (timing === null) return suggested;
  if (suggested === null) return null;
  return timeoutMsFor(timing, resolveTimingClass(game, state));
}

export interface NextDeadlinesInput {
  /** The current deadlines rows (any order). */
  prev: readonly DeadlineEntry[];
  expectedActors: readonly Seat[];
  /** Resolved budget for the CURRENT state (resolveTimeoutMs). */
  timeoutMs: number | null;
  /** Resolved class for the CURRENT state — stamped on newly armed rows;
   *  preserved rows keep the class they were armed under. */
  timingClass: TimingClass;
  connectedSeats: ReadonlySet<Seat>;
  now: number;
  /** 'decision' = the state changed (start / applied action — the ONLY
   *  path that may re-arm a clock); 'presence' = connectivity flipped for
   *  exactly `changedSeats`, state unchanged. */
  reason: 'decision' | 'presence';
  /** presence only: the seats whose connectivity changed. */
  changedSeats?: ReadonlySet<Seat>;
}

/** The room-timing.md §2 decision table, verbatim. Pure so every row and
 *  invariant (I1-I4) is unit-testable without a DO runtime; the DO replaces
 *  the deadlines table with the returned rows. */
export function nextDeadlines(input: NextDeadlinesInput): DeadlineEntry[] {
  const { prev, timeoutMs, timingClass, connectedSeats, now, reason } = input;
  const grace = now + DISCONNECT_GRACE_MS;
  const actors = new Set(input.expectedActors);
  const prevBySeat = new Map(prev.map((row) => [row.seat, row]));
  const out: DeadlineEntry[] = [];

  if (reason === 'decision') {
    // Rows for non-actors are dropped by not being emitted.
    for (const seat of input.expectedActors) {
      const row = prevBySeat.get(seat);
      const connected = connectedSeats.has(seat);
      if (timeoutMs === null) {
        // Untimed: no row while connected; a disconnected actor keeps its
        // existing grace row VERBATIM (anchored at first disconnect — a
        // co-actor's action never extends an absent player's grace, I4),
        // else gets one now.
        if (connected) continue;
        out.push(row ? { ...row } : { seat, baseDueAt: null, dueAt: grace, timingClass });
        continue;
      }
      const budget =
        now + Math.min(ACTION_TIMEOUT_MAX_MS, Math.max(ACTION_TIMEOUT_MIN_MS, timeoutMs));
      if (row !== undefined && row.baseDueAt !== null) {
        // Remained an actor across a co-actor's action (e.g. the second
        // tribute payer): PRESERVE base — the decision point is still the
        // same one, so no fresh clock.
        out.push({
          seat,
          baseDueAt: row.baseDueAt,
          dueAt: connected ? row.baseDueAt : Math.min(row.dueAt, grace),
          timingClass: row.timingClass,
        });
        continue;
      }
      if (row !== undefined) {
        // Grace-only row while the state resolved timed (reachable only if
        // the resolved timeout flips null→number across states while the
        // seat stays an actor — neither current game does): arm the budget,
        // but a disconnected seat's due may only shrink (I2).
        out.push({
          seat,
          baseDueAt: budget,
          dueAt: connected ? budget : Math.min(row.dueAt, budget, grace),
          timingClass,
        });
        continue;
      }
      // Newly acting: the one legitimate fresh clock.
      out.push({
        seat,
        baseDueAt: budget,
        dueAt: connected ? budget : Math.min(budget, grace),
        timingClass,
      });
    }
    return out.sort((a, b) => a.seat - b.seat);
  }

  // reason === 'presence': touch ONLY changedSeats — every other row is
  // returned identical (I3), and the state's actors/budget never re-arm.
  const changed = input.changedSeats ?? new Set<Seat>();
  for (const row of prev) {
    if (!changed.has(row.seat) || !actors.has(row.seat)) {
      // Untouched seat, or a stale non-actor row (the alarm's stale-row
      // guard owns those) — no-op.
      out.push(row);
      continue;
    }
    if (!connectedSeats.has(row.seat)) {
      // Disconnect: clamp down toward the grace; base unchanged.
      out.push({ ...row, dueAt: Math.min(row.dueAt, grace) });
    } else if (row.baseDueAt !== null) {
      // Reconnect: restore the ORIGINAL decision-point deadline — only the
      // remainder comes back, never a fresh budget (the M2 fix).
      out.push({ ...row, dueAt: row.baseDueAt });
    }
    // Reconnect with base NULL: untimed again — the grace was only for
    // absence; the row is dropped.
  }
  for (const seat of changed) {
    if (!actors.has(seat) || connectedSeats.has(seat) || prevBySeat.has(seat)) continue;
    // Disconnect of an untimed (row-less) actor: insert the grace row in
    // the SAME event, so an absent actor is never left unclocked (DL1).
    out.push({ seat, baseDueAt: null, dueAt: grace, timingClass });
  }
  return out.sort((a, b) => a.seat - b.seat);
}

/** The idempotency key for an alarm-applied default action (PLAN §4):
 *  keyed on the seq the timeout fired against, so an alarm retry (at-least-
 *  once semantics) dedups via actions_seen instead of double-applying. */
export function timeoutActionId(seat: Seat, seq: number): string {
  return `timeout:${seat}:${seq}`;
}

// The wire deadline shape is DEFINED in protocol.ts (the single wire
// vocabulary) and re-exported here so the helper and the protocol can
// never drift apart.
export type { WireDeadline } from '../shared/protocol';

/** Maps the DO's `deadlines` table rows (snake_case, persisted shape) to the
 *  wire's camelCase shape, sorted by seat for a deterministic broadcast.
 *  timingClass rides along when the row carries a valid class (rows armed
 *  before the column existed read back NULL and simply omit it). Pure so
 *  it's testable without a DO/SqlStorage runtime. */
export function toWireDeadlines(
  rows: readonly { seat: Seat; due_at: number; timing_class?: string | null }[],
): WireDeadline[] {
  return rows
    .map((r) => {
      const wire: WireDeadline = { seat: r.seat, dueAt: r.due_at };
      if (r.timing_class === 'turn' || r.timing_class === 'planning') {
        wire.timingClass = r.timing_class;
      }
      return wire;
    })
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

// ---------------------------------------------------------------------------
// Q3 pause / resume + retention TTL — the DO ORCHESTRATION DECISIONS as pure
// functions (pause-and-retention.md §1-3). game-room.ts calls these AND the
// deadline-liveness property test drives them, so the model IS the product
// (same discipline as nextDeadlines / isCeremonyShowing): the properties are
// proven about the real decision code, not a re-implementation. Only the SQL
// application of these decisions (shifting rows, deleting storage, alarm
// delivery timing) stays in the DO and is owned by the wire e2e.
// ---------------------------------------------------------------------------

/** Q3 pause predicate: a PLAYING room with no connected SEAT is paused — there
 *  is no actor to protect (M4 semantics), so no turn alarm is armed and no
 *  default action auto-plays. This SAME predicate gates the pause STAMP (both
 *  handleSocketGone and the constructor deploy-transition stamp), which
 *  GUARANTEES stamp ≡ pause: a room in the paused state always has a non-NULL
 *  pause_started_at, so resume can never hit `now - NULL`. Keys on connected
 *  SEATS ("is there an actor?"), never sockets — contrast the TTL, which asks
 *  "is anyone here?" and keys on live sockets (isAutoPurgeEligible). */
export function isPausedRoom(status: RoomStatus, connectedSeatCount: number): boolean {
  return status === 'playing' && connectedSeatCount === 0;
}

/** Whether alarm() may auto-play a due seat deadline: only while a SEAT is
 *  connected (the Q3 pause guard — a room with no actor present is frozen).
 *  Exactly `!isPausedRoom` for a playing room, named for the alarm call site. */
export function mayAutoPlay(connectedSeatCount: number): boolean {
  return connectedSeatCount > 0;
}

/** Q3 resume shift (§2): the wall-clock duration a room was frozen, added to
 *  every frozen deadline so each actor's REMAINING budget is preserved (never a
 *  fresh clock — this is what kills the 0→1→0 timer-dodge). Clamped ≥ 0 so a
 *  clock skew can never rewind a deadline. */
export function resumeOffsetMs(pauseStartedAt: number, now: number): number {
  return Math.max(0, now - pauseStartedAt);
}

export interface AlarmCandidatesInput {
  /** Room status, or null when no room row exists yet (a bare M0 probe DO) — a
   *  room-less DO has no TTL candidate regardless of retention mode. */
  status: RoomStatus | null;
  /** Connected SEATS — gates the seat-deadline candidate (Q3). */
  connectedSeatCount: number;
  /** Live SOCKETS (ctx.getWebSockets().length) — gates the TTL candidate (T3:
   *  an occupied room is never purged, even a seatless/idle lobby visitor). */
  liveSocketCount: number;
  /** MIN(due_at) over the deadlines table, or null when empty. */
  minSeatDeadlineDueAt: number | null;
  /** room.last_active_at (the retention anchor). */
  lastActiveAt: number;
  /** The armed-and-unfired M0 probe's due time, or null. */
  probeDueAt: number | null;
  mode?: RetentionMode;
}

/** The candidate wake times for the DO's single alarm slot (the scheduleAlarm
 *  DECISION, §1 unified model): (a) the soonest seat deadline — only while a
 *  seat is connected (Q3 pause: a frozen room arms no turn alarm, so no
 *  auto-play burn); (b) the retention TTL — only while NO live socket is
 *  attached (T3); (c) the M0 hello probe. The DO arms `min(result)` or clears
 *  the alarm when the result is empty. */
export function alarmCandidates(input: AlarmCandidatesInput): number[] {
  const out: number[] = [];
  if (input.connectedSeatCount > 0 && input.minSeatDeadlineDueAt !== null) {
    out.push(input.minSeatDeadlineDueAt);
  }
  if (input.status !== null && input.liveSocketCount === 0) {
    const ttl = ttlDueAt(input.status, input.lastActiveAt, input.mode);
    if (ttl !== null) out.push(ttl);
  }
  if (input.probeDueAt !== null) out.push(input.probeDueAt);
  return out;
}
