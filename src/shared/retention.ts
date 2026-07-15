// Room-layer retention vocabulary (docs/research/pause-and-retention.md §3-4):
// when an ABANDONED room (connected==0) becomes eligible to be reclaimed, and
// — the crux — WHETHER that eligibility triggers an automatic self-purge. Lives
// in src/shared and is game-agnostic: the engine never imports it (retention is
// not a game rule; the DO keys the windows on the opaque room `status`, never on
// any Guandan concept).
//
// The meter asymmetry drives the policy (§3.1): rows-written is the SCARCE,
// fail-closed meter (100k/day); storage is ABUNDANT (5 GB, per-room tiny). A
// `deleteAll()` purge may be per-row billed (§6, unmeasured), so auto-purging an
// EXPENSIVE room (finished/paused, ~1-23k rows) on a timer would spend the scarce
// meter to reclaim the abundant one. Therefore, in the default LAZY mode only the
// CHEAP case (lobby-abandoned, a few rows) auto-purges; played-out rooms are
// reclaimed manually via scripts/cleanup-rooms.ts.
//
// `RETENTION_MODE='eager'` is a ONE-CONSTANT change once §6 measures deleteAll()
// as flat-billed — but it is NOT RETROACTIVE, and the comment must not overstate
// it (that overstatement is exactly the doc-vs-code drift the PLAN sweep exists to
// catch — here in a fresh comment). A room paused under lazy armed NO alarm
// (ttlDueAt('playing', …, 'lazy') → null → alarm cleared) and is fully inert:
// nothing wakes it, so flipping the constant never arms it. The flip governs only
// rooms that run scheduleAlarm AFTER the flip; the pre-existing BACKLOG (the
// zombies, any finished/paused rooms accumulated under lazy) is reclaimed by
// scripts/cleanup-rooms.ts, not by the flip.

import type { RoomStatus } from './protocol';

/** 'lazy' (default) = auto-purge only lobby-abandoned rooms; finished/paused are
 *  reclaimed manually (scripts/cleanup-rooms.ts). 'eager' = auto-purge every
 *  eligible room that arms an alarm AFTER the flip (NOT retroactive — the
 *  pre-existing backlog stays manual); safe only once deleteAll() is measured
 *  flat-billed (§6). */
export type RetentionMode = 'lazy' | 'eager';
export const RETENTION_MODE: RetentionMode = 'lazy';

// Branded counts. The two numbers that gate Q3/TTL answer OPPOSITE questions but
// are both `number`, so a swap at a binding site is invisible — and a mis-bind
// passes every pure decision test while silently killing T3 (an occupied lobby
// gets deleteAll()'d). Branding makes the swap a COMPILE error. Construct once,
// at the source, via asSeatCount / asLiveSocketCount — never re-cast downstream.
/** Connected SEATS — "is there an ACTOR?" (gates pause / auto-play, M4). */
export type ConnectedSeatCount = number & { readonly __brand: 'ConnectedSeatCount' };
/** Live SOCKETS (ctx.getWebSockets().length) — "is ANYONE here?" (gates the TTL,
 *  including a seatless/idle lobby visitor — T3). */
export type LiveSocketCount = number & { readonly __brand: 'LiveSocketCount' };
export const asSeatCount = (n: number): ConnectedSeatCount => n as ConnectedSeatCount;
export const asLiveSocketCount = (n: number): LiveSocketCount => n as LiveSocketCount;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Eligibility FLOORS, measured from room.last_active_at (last human-interaction
 *  event, never a game action — §3). A room is not even a purge CANDIDATE before
 *  its window elapses; whether eligibility then auto-purges depends on the mode
 *  (see shouldAutoPurge). Deliberately generous — the scarce resource is
 *  write-budget, not storage. */
export const RETENTION_WINDOW_MS: Record<RoomStatus, number> = {
  // Lobby never started: tiny; the cost of being wrong is a family trickling in
  // from a group chat, so 48h ("made a room last night, all join tomorrow").
  lobby: 48 * HOUR_MS,
  // Paused mid-match (Q3): someone may reconnect to the exact remaining clock.
  // Err generous — days, not minutes.
  playing: 14 * DAY_MS,
  // Finished: holds the full match (~1-23k rows). A week is ample to dump/replay
  // anything interesting before reclaiming.
  finished: 7 * DAY_MS,
};

/** Does `status` auto-purge in `mode`? Lazy: lobby only (cheap regardless of
 *  deleteAll() billing). Eager: all. This gates BOTH whether a TTL alarm is
 *  armed (scheduleAlarm) and whether alarm() actually calls deleteAll(). */
export function shouldAutoPurge(status: RoomStatus, mode: RetentionMode = RETENTION_MODE): boolean {
  if (mode === 'eager') return true;
  return status === 'lobby';
}

/** Wall-clock time at which an abandoned room becomes purge-eligible, or null if
 *  it does not auto-purge in this mode (played-out rooms in lazy mode → no TTL
 *  alarm; they persist until scripts/cleanup-rooms.ts). Callers arm the alarm at
 *  this value ONLY while the room is abandoned (connected==0); a connected room
 *  is never TTL-eligible. */
export function ttlDueAt(
  status: RoomStatus,
  lastActiveAt: number,
  mode: RetentionMode = RETENTION_MODE,
  overrideWindowMs?: number,
): number | null {
  if (!shouldAutoPurge(status, mode)) return null;
  return lastActiveAt + (overrideWindowMs ?? RETENTION_WINDOW_MS[status]);
}

/** True iff an abandoned room is past its retention window AND its status
 *  auto-purges in this mode — the exact test alarm() applies before deleteAll().
 *
 *  `liveSocketCount` MUST be `ctx.getWebSockets().length` — the LIVE SOCKET
 *  count, NOT the connected-SEAT count. This is load-bearing: Q1's edge
 *  auto-response answers pings WITHOUT waking the DO, so a client that opens a
 *  room and sits in the lobby waiting for family generates zero DO activity and
 *  `last_active_at` never moves — an occupied lobby and an abandoned one are
 *  indistinguishable on the time axis. And `connectedSeats()` counts CLAIMED
 *  seats, so a lobby visitor who hasn't claimed a seat yet has 0 connected seats
 *  but a live socket. Gating on the live socket is the only thing that keeps the
 *  purge from deleting a room someone is actively sitting in. INVARIANT: TTL
 *  never purges a room with a live socket. */
export function isAutoPurgeEligible(args: {
  status: RoomStatus | null;
  liveSocketCount: LiveSocketCount;
  lastActiveAt: number | null;
  now: number;
  mode?: RetentionMode;
  /** Test-only window shrink (RETENTION_TEST_WINDOW_MS env) so the e2e can drive
   *  a real purge without waiting 48h; undefined in production. */
  overrideWindowMs?: number;
}): boolean {
  // This is the LAST gate before an irreversible deleteAll() — so it is the most
  // paranoid function in the file: an unknowable status or anchor can never be
  // COERCED into a purge (a NULL anchor as `number` would read as epoch = always
  // past every window = purge). Structural impossibility beats convention here,
  // exactly as with the branded counts.
  const mode = args.mode ?? RETENTION_MODE;
  if (args.liveSocketCount > 0) return false; // never purge an occupied room (T3)
  if (args.status === null || args.lastActiveAt === null) return false; // unknown → fail safe
  if (!shouldAutoPurge(args.status, mode)) return false;
  const window = args.overrideWindowMs ?? RETENTION_WINDOW_MS[args.status];
  return args.now - args.lastActiveAt >= window;
}
