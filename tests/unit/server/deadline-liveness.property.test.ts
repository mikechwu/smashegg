// Deadlock-freedom / no-fresh-clock property tests (docs/research/
// room-timing.md §3), driving the PURE nextDeadlines helper + a virtual
// clock over seeded random event interleavings — no DO runtime, mirroring
// exactly the calls game-room.ts makes (decision recompute on start/apply,
// presence reconcile on connectivity flips, alarm loop on due rows).
//
// Checked after EVERY event, for BOTH games × presets {fast, standard,
// untimed} × legacy-null timing:
//   DL1 (coverage): every expected actor is either connected-and-untimed
//       (no row, by design) or has a row due within max(clamp(T), 60s) of
//       its arming; a DISCONNECTED actor's due never exceeds
//       max(disconnectedAt, armedAt) + 60s — including when T = null.
//   DL2 (alarm armed): rows ≠ ∅ ⇒ the alarm sits at min(due).
//   DL3 (alarm productive): a firing alarm either applies defaultAction
//       (seq strictly advances) or deletes a stale row — it terminates.
//   I1  due ≤ base whenever base ≠ NULL.
//   I2  a presence event never lifts a row's due above base (or above its
//       previous due for NULL-base grace rows).
//   I3  seat X's presence leaves seat Y's row byte-identical.
//   I4  a disconnected actor's grace anchor survives co-actor actions
//
// Q3 pause/resume (pause-and-retention.md §2, §3.2), added the same way — the
// driver calls the REAL decisions (isPausedRoom / mayAutoPlay / resumeOffsetMs /
// alarmCandidates), so the model IS the product for scheduling:
//   P1  a paused room (0 connected seats) arms NO alarm even with frozen rows.
//   P2  resume shifts each frozen deadline's base by exactly the paused duration
//       (never a fresh clock — the concrete no-timer-dodge); named + random.
//   P3  a non-actor resuming first still leaves the absent on-turn actor armed
//       (no present-player stall) — falls out of DL1's grace coverage.
//   P4  a room paused BEFORE Q3 (NULL offset) is stamped by the constructor
//       simulator on the next wake; the guard-path resumes to exactly ONE
//       0-remaining auto-play (no floor). Named, deterministic.
//
// SCOPE (stated honestly, per the Codex M4 audit): VirtualRoom exercises the pure
// deadline + Q3 decision layer (nextDeadlines / alarmCandidates / isPausedRoom /
// resumeOffsetMs / mayAutoPlay + the real engines) with an in-memory mirror of the
// DO's call pattern. What is MODELED, not executed, and therefore owned by the
// wire e2e: the SQL application of these decisions (the deadline-row shift, row
// replacement), hello/takeover/socket-close ORDERING (incl. the stamp-ordering
// dependency that stamp==pause relies on — asserted directly in e2e), real alarm
// delivery timing, deleteAll(), idempotency, and the fire-and-forget async
// boundary. liveSockets≈seats here (the seatless-socket TTL edge is a lobby
// concern — retention.test.ts at the decision level + the e2e seatless case).

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, type PrngState } from '../../../src/engine/core/prng';
import type { Seat } from '../../../src/engine/core/game';
import { GuandanGame } from '../../../src/engine/guandan';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import { GuessNumberGame } from '../../../src/engine/guess-number';
import type { AnyGameDefinition } from '../../../src/shared/games';
import { TIMING_PRESETS, type RoomTiming } from '../../../src/shared/timing';
import {
  ACTION_TIMEOUT_MAX_MS,
  ACTION_TIMEOUT_MIN_MS,
  DISCONNECT_GRACE_MS,
  alarmCandidates,
  isPausedRoom,
  mayAutoPlay,
  nextDeadlines,
  resolveTimeoutMs,
  resolveTimingClass,
  resumeOffsetMs,
  type DeadlineEntry,
} from '../../../src/server/room-helpers';
import { asLiveSocketCount, asSeatCount } from '../../../src/shared/retention';

const T0 = 1_700_000_000_000;
const MAX_ALARM_APPLIES = 32; // mirrors game-room.ts

// Provable coverage: the random driver reaches connected==0 only occasionally,
// so a green run does not by itself prove the pause/resume paths ran. Count them
// and assert > 0 at the end (honest-reporting standard) — the named P2-P4 cases
// are the deterministic guarantee; this proves the RANDOM contexts hit them too.
const q3Coverage = { pauses: 0, resumes: 0 };

function clamp(ms: number): number {
  return Math.min(ACTION_TIMEOUT_MAX_MS, Math.max(ACTION_TIMEOUT_MIN_MS, ms));
}

/** A virtual room: the exact state the DO keeps, minus the transport. All
 *  deadline math flows through the same pure helpers the DO calls. */
class VirtualRoom {
  state: unknown;
  seq = 0;
  now = T0;
  rows: DeadlineEntry[] = [];
  alarmAt: number | null = null;
  connected: Set<Seat>;
  /** When each currently-disconnected seat went away. */
  disconnectedAt = new Map<Seat, number>();
  /** When each seat's current row was inserted (re-arm anchor for DL1). */
  armedAt = new Map<Seat, number>();
  /** Q3: wall-clock the room's connected SEATS hit 0; NULL while any seat is
   *  connected. The offset origin resume shifts frozen deadlines by (§2). */
  pauseStartedAt: number | null = null;
  /** Retention anchor (bumped on presence). Never affects a PLAYING room's alarm
   *  (lazy TTL is null for 'playing'); tracked for the alarmCandidates call. */
  lastActiveAt = T0;

  constructor(
    readonly game: AnyGameDefinition,
    readonly timing: RoomTiming | null,
    readonly seats: number,
    config: unknown,
    seed: string,
  ) {
    this.state = this.game.init(config, seats, seed).state;
    this.connected = new Set(Array.from({ length: seats }, (_, s) => s));
    this.recompute('decision', undefined); // the start mutation arms the first clocks
  }

  actors(): Seat[] {
    return this.game.isTerminal(this.state) ? [] : (this.game.expectedActors(this.state) as Seat[]);
  }

  timeoutMs(): number | null {
    return resolveTimeoutMs(this.game, this.state, this.timing);
  }

  private recompute(reason: 'decision' | 'presence', changedSeats: ReadonlySet<Seat> | undefined): void {
    const prevSeats = new Set(this.rows.map((r) => r.seat));
    this.rows = this.game.isTerminal(this.state)
      ? []
      : nextDeadlines({
          prev: this.rows,
          expectedActors: this.actors(),
          timeoutMs: this.timeoutMs(),
          timingClass: resolveTimingClass(this.game, this.state),
          connectedSeats: this.connected,
          now: this.now,
          reason,
          changedSeats,
        });
    // scheduleAlarm — the REAL alarmCandidates decision (minus the hello probe),
    // so a paused room (0 connected seats) arms nothing even with frozen rows (P1)
    // and the model tracks the product's scheduling exactly.
    this.alarmAt = this.computeAlarmAt();
    const nowSeats = new Set(this.rows.map((r) => r.seat));
    for (const s of nowSeats) if (!prevSeats.has(s)) this.armedAt.set(s, this.now);
    for (const s of [...this.armedAt.keys()]) if (!nowSeats.has(s)) this.armedAt.delete(s);
  }

  /** The scheduleAlarm decision via the real alarmCandidates (no probe). For a
   *  PLAYING harness game: a seat candidate iff a seat is connected; never a TTL
   *  ('playing' arms none in lazy mode). liveSockets ≈ connected seats here — the
   *  seatless-socket edge is a lobby concern, covered by retention.test.ts + e2e. */
  private computeAlarmAt(): number | null {
    const cands = alarmCandidates({
      status: this.game.isTerminal(this.state) ? 'finished' : 'playing',
      connectedSeatCount: asSeatCount(this.connected.size),
      liveSocketCount: asLiveSocketCount(this.connected.size),
      minSeatDeadlineDueAt: this.rows.length > 0 ? Math.min(...this.rows.map((r) => r.dueAt)) : null,
      lastActiveAt: this.lastActiveAt,
      probeDueAt: null,
    });
    return cands.length > 0 ? Math.min(...cands) : null;
  }

  apply(seat: Seat, action: unknown): void {
    const res = this.game.applyAction(this.state, seat, action);
    if (!res.ok) throw new Error(`virtual room: legal action rejected: ${res.error.code}`);
    this.state = res.state;
    this.seq++;
    this.recompute('decision', undefined);
  }

  disconnect(seat: Seat): void {
    if (!this.connected.delete(seat)) return; // mirrors the DO's newly-* gate
    this.disconnectedAt.set(seat, this.now);
    this.lastActiveAt = this.now;
    this.recompute('presence', new Set([seat]));
    // Q3 pause: if that emptied the room, stamp the offset origin — the SAME
    // isPausedRoom predicate the DO uses at handleSocketGone + the constructor.
    if (this.pauseStartedAt === null && isPausedRoom('playing', asSeatCount(this.connected.size))) {
      this.pauseStartedAt = this.now;
    }
  }

  reconnect(seat: Seat): void {
    if (this.connected.has(seat)) return;
    // Q3 resume: if the room was paused, shift every frozen deadline AND its
    // anchors forward by the paused duration BEFORE the presence reconcile, so
    // each actor's REMAINING budget is preserved (no fresh clock — P2) and the
    // DL1 arm-window relationship holds (anchors move by the same offset).
    if (this.pauseStartedAt !== null) {
      const offset = resumeOffsetMs(this.pauseStartedAt, this.now);
      this.rows = this.rows.map((r) => ({
        ...r,
        dueAt: r.dueAt + offset,
        baseDueAt: r.baseDueAt === null ? null : r.baseDueAt + offset,
      }));
      for (const [s, t] of this.armedAt) this.armedAt.set(s, t + offset);
      for (const [s, t] of this.disconnectedAt) this.disconnectedAt.set(s, t + offset);
      this.pauseStartedAt = null;
    }
    this.connected.add(seat);
    this.disconnectedAt.delete(seat);
    this.lastActiveAt = this.now;
    this.recompute('presence', new Set([seat]));
  }

  /** Mirrors the DO constructor's §3.2 deploy-transition lazy-stamp: on any wake,
   *  a PLAYING room with 0 connected seats and no pause origin gets stamped NOW —
   *  the SAME isPausedRoom predicate as every other stamp site, so a paused room
   *  can never be left with a NULL offset for resume to divide by. */
  simulateConstructorStamp(): void {
    if (this.pauseStartedAt === null && isPausedRoom('playing', asSeatCount(this.connected.size))) {
      this.pauseStartedAt = this.now;
    }
  }

  /** The alarm loop (game-room.ts alarm(), path (b)) — DL3 asserted per
   *  iteration: seq strictly advances or a stale row is deleted. */
  fireAlarmIfDue(): void {
    // Q3 pause guard: a room with no connected seat never auto-plays (and the DO
    // arms no alarm for it, so it would never fire in the first place).
    if (!mayAutoPlay(asSeatCount(this.connected.size))) return;
    for (let i = 0; i < MAX_ALARM_APPLIES; i++) {
      if (this.game.isTerminal(this.state)) break;
      const due = [...this.rows]
        .filter((r) => r.dueAt <= this.now)
        .sort((a, b) => a.dueAt - b.dueAt || a.seat - b.seat)[0];
      if (!due) break;
      const seqBefore = this.seq;
      const rowsBefore = this.rows.length;
      const fallback = this.game.defaultAction(this.state, due.seat);
      if (new Set(this.actors()).has(due.seat)) {
        expect(fallback, 'defaultAction non-null for a due expected actor (DL3)').not.toBeNull();
      }
      if (fallback === null) {
        this.rows = this.rows.filter((r) => r.seat !== due.seat);
        this.armedAt.delete(due.seat);
        this.alarmAt = this.rows.length > 0 ? Math.min(...this.rows.map((r) => r.dueAt)) : null;
      } else {
        this.apply(due.seat, fallback);
      }
      expect(
        this.seq > seqBefore || this.rows.length < rowsBefore,
        'DL3: an alarm firing makes progress (applies or prunes)',
      ).toBe(true);
    }
    // Codex M4 audit: DL3's per-iteration progress alone would tolerate a
    // run that exhausts MAX_ALARM_APPLIES with due rows still pending —
    // assert the loop actually DRAINED everything due at this instant
    // (the real alarm would re-fire, but a full-budget drain that leaves
    // due rows means the bound is load-bearing, which it must never be).
    if (!this.game.isTerminal(this.state)) {
      expect(
        this.rows.filter((r) => r.dueAt <= this.now).length,
        'alarm loop drained all currently-due rows within MAX_ALARM_APPLIES',
      ).toBe(0);
    }
  }
}

/** DL1/DL2/I1 — the always-on invariants, asserted after every event. */
function assertInvariants(room: VirtualRoom): void {
  const timeoutMs = room.game.isTerminal(room.state) ? null : room.timeoutMs();
  const bySeat = new Map(room.rows.map((r) => [r.seat, r]));

  for (const actor of room.actors()) {
    const row = bySeat.get(actor);
    if (row === undefined) {
      // The ONLY row-less actor allowed: connected in an untimed state.
      expect(room.connected.has(actor), `DL1: row-less actor ${actor} must be connected`).toBe(true);
      expect(timeoutMs, `DL1: row-less actor ${actor} must be untimed`).toBeNull();
      continue;
    }
    const armed = room.armedAt.get(actor);
    expect(armed, `arm anchor tracked for seat ${actor}`).toBeDefined();
    const budgetBound = timeoutMs === null ? DISCONNECT_GRACE_MS : Math.max(clamp(timeoutMs), DISCONNECT_GRACE_MS);
    expect(row.dueAt, `DL1: seat ${actor} due within max(clamp(T), grace) of arming`).toBeLessThanOrEqual(
      armed! + budgetBound,
    );
    if (!room.connected.has(actor)) {
      const disc = room.disconnectedAt.get(actor)!;
      expect(
        row.dueAt,
        `DL1: disconnected actor ${actor} clocked within grace of max(disconnect, re-arm)`,
      ).toBeLessThanOrEqual(Math.max(disc, armed!) + DISCONNECT_GRACE_MS);
    }
  }

  // DL2 + P1: the alarm is parked at min(due) when a seat is connected and rows
  // exist; a PAUSED room (0 connected seats) arms NOTHING even with frozen rows
  // (P1 — no seat candidate, and 'playing' arms no TTL in lazy mode).
  if (room.rows.length > 0 && room.connected.size > 0) {
    expect(room.alarmAt).toBe(Math.min(...room.rows.map((r) => r.dueAt)));
  } else {
    expect(room.alarmAt, 'P1: paused (or empty) ⇒ no alarm armed').toBeNull();
  }

  // I1.
  for (const row of room.rows) {
    if (row.baseDueAt !== null) {
      expect(row.dueAt, `I1: seat ${row.seat} due ≤ base`).toBeLessThanOrEqual(row.baseDueAt);
    }
  }
}

/** I2/I3 around one presence event: snapshot before, flip, compare. */
function presenceWithChecks(room: VirtualRoom, seat: Seat, kind: 'disconnect' | 'reconnect'): void {
  const before = new Map(room.rows.map((r) => [r.seat, JSON.stringify(r)]));
  if (kind === 'disconnect') room.disconnect(seat);
  else room.reconnect(seat);
  for (const row of room.rows) {
    if (row.seat !== seat) {
      // I3: untouched seats byte-identical.
      expect(JSON.stringify(row), `I3: seat ${row.seat} untouched by seat ${seat}'s ${kind}`).toBe(
        before.get(row.seat),
      );
      continue;
    }
    // I2: the flipped seat's due never rises above base (nor above its
    // previous due for a NULL-base grace row).
    const prev = before.get(seat);
    if (row.baseDueAt !== null) {
      expect(row.dueAt, 'I2: presence capped by base').toBeLessThanOrEqual(row.baseDueAt);
    } else if (prev !== undefined) {
      expect(row.dueAt, 'I2: grace row never extended by presence').toBeLessThanOrEqual(
        (JSON.parse(prev) as DeadlineEntry).dueAt,
      );
    }
  }
}

/** P2 around a resume (0→1 from pause): the shift re-anchors every frozen row.
 *  Assert each surviving row's base was SHIFTED by exactly the paused duration,
 *  never reset to a fresh now+budget — the concrete "no fresh clock / no
 *  timer-dodge". (DL1/P1, and P3 via DL1's grace-row coverage, are asserted by
 *  assertInvariants after this returns.) */
function resumeWithChecks(room: VirtualRoom, seat: Seat): void {
  const pausedAt = room.pauseStartedAt!;
  const offset = resumeOffsetMs(pausedAt, room.now);
  const baseBefore = new Map(room.rows.map((r) => [r.seat, r.baseDueAt]));
  room.reconnect(seat);
  for (const r of room.rows) {
    const b = baseBefore.get(r.seat);
    if (b === undefined || b === null || r.baseDueAt === null) continue;
    expect(r.baseDueAt, `P2: seat ${r.seat} base shifted by the paused duration, not reset`).toBe(
      b + offset,
    );
  }
}

// ---------------------------------------------------------------------------
// The random interleaving driver.
// ---------------------------------------------------------------------------

interface GameSpec {
  name: string;
  game: AnyGameDefinition;
  config: unknown;
  seats: number;
  /** Bias action choice toward non-pass plays so Guandan hands finish. */
  preferPlays: boolean;
}

const GAMES: GameSpec[] = [
  {
    name: 'guandan',
    game: GuandanGame as unknown as AnyGameDefinition,
    config: JIANGSU_OFFICIAL_ONLINE,
    seats: 4,
    preferPlays: true,
  },
  {
    name: 'guess-number',
    game: GuessNumberGame as unknown as AnyGameDefinition,
    config: { rangeMax: 100, suddenDeath: false },
    seats: 4,
    preferPlays: false,
  },
];

const TIMINGS: { name: string; timing: RoomTiming | null }[] = [
  { name: 'fast', timing: TIMING_PRESETS.fast },
  { name: 'standard', timing: TIMING_PRESETS.standard },
  { name: 'untimed', timing: TIMING_PRESETS.untimed },
  { name: 'legacy-null', timing: null },
];

function runInterleaving(spec: GameSpec, timing: RoomTiming | null, seed: string, steps: number): void {
  const room = new VirtualRoom(spec.game, timing, spec.seats, spec.config, seed);
  let rng: PrngState = seedPrng(`dl-events:${seed}`);
  const draw = (n: number): number => {
    const pick = nextInt(rng, n);
    rng = pick.state;
    return pick.value;
  };
  assertInvariants(room);

  for (let step = 0; step < steps && !room.game.isTerminal(room.state); step++) {
    const roll = draw(100);
    if (roll < 50) {
      // applyRandomLegalAction — a random expected actor plays.
      const actors = room.actors();
      const seat = actors[draw(actors.length)]!;
      const legal = room.game.legalActions(room.state, seat) as unknown[];
      let action = room.game.defaultAction(room.state, seat);
      if (legal.length > 0) {
        const plays = spec.preferPlays
          ? legal.filter((a) => (a as { type?: string }).type !== 'pass')
          : legal;
        const pool = plays.length > 0 ? plays : legal;
        action = pool[draw(pool.length)]!;
      }
      room.apply(seat, action);
    } else if (roll < 65) {
      const pool = [...room.connected];
      if (pool.length > 0) {
        const wasPaused = room.pauseStartedAt !== null;
        presenceWithChecks(room, pool[draw(pool.length)]!, 'disconnect');
        if (!wasPaused && room.pauseStartedAt !== null) q3Coverage.pauses++;
      }
    } else if (roll < 80) {
      const pool = Array.from({ length: spec.seats }, (_, s) => s).filter((s) => !room.connected.has(s));
      if (pool.length > 0) {
        const seat = pool[draw(pool.length)]!;
        if (room.pauseStartedAt !== null) {
          // RESUME from a paused room: the shift re-anchors ALL rows, so the M4
          // I2/I3 (presence touches only the changed seat) do not apply — assert
          // P2 (no fresh clock) here; DL1/P1/P3 fall out of assertInvariants below.
          resumeWithChecks(room, seat);
          q3Coverage.resumes++;
        } else {
          presenceWithChecks(room, seat, 'reconnect');
        }
      }
    } else if (roll < 90) {
      room.now += 1_000 + draw(30_000); // advanceClock
    } else {
      room.fireAlarmIfDue();
    }
    assertInvariants(room);
  }
}

describe('deadline liveness properties (room-timing.md §3): DL1-DL3 + I1-I4', () => {
  for (const spec of GAMES) {
    for (const { name, timing } of TIMINGS) {
      it(`${spec.name} × ${name}: invariants hold across seeded random interleavings`, () => {
        for (const seed of [`dl-${spec.name}-${name}-1`, `dl-${spec.name}-${name}-2`]) {
          runInterleaving(spec, timing, seed, 200);
        }
      });
    }
  }

  it('the random interleavings actually exercised Q3 pause AND resume (coverage not vacuous)', () => {
    // Runs after the interleavings above (definition order) — proves the P1/P2
    // assertions inside the driver were reached in random contexts, not just the
    // deterministic named cases.
    expect(q3Coverage.pauses, 'some interleaving reached connected==0 (pause)').toBeGreaterThan(0);
    expect(q3Coverage.resumes, 'some interleaving resumed from a pause').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Named cases.
// ---------------------------------------------------------------------------

describe('named liveness cases', () => {
  it('untimed preset: a disconnecting sole actor gets the grace row in the SAME event, and the alarm resolves it', () => {
    const spec = GAMES[1]!; // guess-number: exactly one expected actor
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.untimed, spec.seats, spec.config, 'dl-untimed-1');
    expect(room.rows, 'all connected + untimed ⇒ no rows, alarm unset').toEqual([]);
    expect(room.alarmAt).toBeNull();

    const actor = room.actors()[0]!;
    room.disconnect(actor);
    expect(room.rows).toEqual([
      { seat: actor, baseDueAt: null, dueAt: room.now + DISCONNECT_GRACE_MS, timingClass: 'turn' },
    ]);
    expect(room.alarmAt).toBe(room.now + DISCONNECT_GRACE_MS);

    // Clock past the grace: the alarm applies the default action — no
    // deadlock in no-timer mode (liveness corollary).
    const seqBefore = room.seq;
    room.now += DISCONNECT_GRACE_MS + 1;
    room.fireAlarmIfDue();
    expect(room.seq).toBeGreaterThan(seqBefore);
    assertInvariants(room);
  });

  it('reconnect restores the ORIGINAL deadline (base), never a fresh clock', () => {
    // Guandan hand 1 opens at the 'planning' class: standard ⇒ a 90s budget
    // that the 60s disconnect grace actually clamps.
    const spec = GAMES[0]!;
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.standard, spec.seats, spec.config, 'dl-restore-1');
    const leader = room.actors()[0]!;
    const armed = room.rows.find((r) => r.seat === leader)!;
    expect(armed.timingClass).toBe('planning');
    expect(armed.dueAt).toBe(T0 + 90_000);
    expect(armed.baseDueAt).toBe(T0 + 90_000);

    room.now = T0 + 10_000;
    presenceWithChecks(room, leader, 'disconnect');
    expect(room.rows.find((r) => r.seat === leader)!.dueAt).toBe(T0 + 70_000); // grace clamp

    room.now = T0 + 20_000;
    presenceWithChecks(room, leader, 'reconnect');
    const restored = room.rows.find((r) => r.seat === leader)!;
    expect(restored.dueAt, 'due restored to base, NOT now + 90s').toBe(T0 + 90_000);
    expect(restored.baseDueAt).toBe(T0 + 90_000);
  });

  it('double tribute: presence isolation + co-actor preservation (I3/I4)', () => {
    // Deterministically drive a real match into a pending DOUBLE tribute
    // (two concurrent payers). Seed found by scan; the playout is
    // deterministic so it can never flake (reaches it at step 98).
    const spec = GAMES[0]!;
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.standard, spec.seats, spec.config, 'dl-double-9');
    let rng: PrngState = seedPrng('dl-bot:dl-double-9');
    const isDoubleTribute = (): boolean => {
      const s = room.state as { phase?: string; tribute?: { kind?: string } | null };
      return s.phase === 'tribute' && s.tribute?.kind === 'double' && room.actors().length === 2;
    };
    for (let step = 0; step < 2_500 && !isDoubleTribute(); step++) {
      const seat = room.actors()[0]!;
      const legal = room.game.legalActions(room.state, seat) as { type: string }[];
      let action: unknown = room.game.defaultAction(room.state, seat);
      if (legal.length > 0) {
        const plays = legal.filter((a) => a.type !== 'pass');
        const pool = plays.length > 0 ? plays : legal;
        const pick = nextInt(rng, pool.length);
        rng = pick.state;
        action = pool[pick.value]!;
      }
      room.apply(seat, action);
    }
    expect(isDoubleTribute(), 'seed dl-double-9 reaches a pending double tribute').toBe(true);

    const [payerX, payerY] = room.actors() as [Seat, Seat];
    expect(room.rows.map((r) => r.seat).sort()).toEqual([payerX, payerY].sort());

    // I3: payer Y's disconnect leaves payer X's row byte-identical.
    const xBefore = JSON.stringify(room.rows.find((r) => r.seat === payerX));
    room.now += 5_000;
    presenceWithChecks(room, payerY, 'disconnect');
    expect(JSON.stringify(room.rows.find((r) => r.seat === payerX))).toBe(xBefore);

    // I4: payer X commits their tribute — payer Y REMAINS an actor and
    // their row (base AND due) survives the co-actor's action unchanged.
    const yBefore = room.rows.find((r) => r.seat === payerY)!;
    room.now += 5_000;
    const xAction = room.game.defaultAction(room.state, payerX)!;
    room.apply(payerX, xAction);
    expect(room.actors()).toEqual([payerY]);
    const yAfter = room.rows.find((r) => r.seat === payerY)!;
    expect(yAfter.baseDueAt, 'I4: base preserved across co-actor action').toBe(yBefore.baseDueAt);
    expect(yAfter.dueAt, 'I4: due (grace anchor) preserved across co-actor action').toBe(yBefore.dueAt);
    expect(room.rows.some((r) => r.seat === payerX), "payer X's row dropped once no longer an actor").toBe(false);

    // ...and Y's reconnect restores exactly the base, not a fresh clock.
    room.now += 5_000;
    presenceWithChecks(room, payerY, 'reconnect');
    expect(room.rows.find((r) => r.seat === payerY)!.dueAt).toBe(yBefore.baseDueAt);
    assertInvariants(room);
  });
});

// ---------------------------------------------------------------------------
// Q3 pause/resume named cases (pause-and-retention.md §2, §3.2). Deterministic,
// so they can never flake and GUARANTEE the pause/resume paths are exercised —
// the random driver reaches connected==0 only occasionally, so green there does
// not by itself prove P2-P4.
// ---------------------------------------------------------------------------

describe('Q3 pause/resume properties (P1-P4)', () => {
  it('P1+P2: pause → 3-day wait → resume preserves the REMAINING budget, never a fresh clock (no dodge)', () => {
    const spec = GAMES[0]!; // guandan: hand-1 opening lead, 'planning' = 90s standard
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.standard, spec.seats, spec.config, 'q3-p2-1');
    const leader = room.actors()[0]!;
    expect(room.rows.find((r) => r.seat === leader)!.baseDueAt).toBe(T0 + 90_000);

    // Consume 30s of the leader's turn, then EVERYONE drops → PAUSE at T0+30s.
    room.now = T0 + 30_000;
    for (const s of [...room.connected]) room.disconnect(s);
    expect(room.pauseStartedAt, 'paused when the room emptied').toBe(T0 + 30_000);
    expect(room.alarmAt, 'P1: a paused room arms no alarm even with a frozen row').toBeNull();

    // Wall clock advances THREE DAYS while frozen; the leader reconnects.
    room.now = T0 + 30_000 + 3 * 86_400_000;
    resumeWithChecks(room, leader); // asserts base shifted, not reset (P2)
    const restored = room.rows.find((r) => r.seat === leader)!;
    // The leader had 60s left at pause (base T0+90s − pause T0+30s); resume gives
    // back EXACTLY that 60s re-anchored to now — never a fresh 90s.
    expect(restored.dueAt - room.now, 'exactly the 60s that remained at pause').toBe(60_000);
    expect(restored.dueAt - room.now, 'NOT a fresh 90s planning budget').not.toBe(90_000);
    assertInvariants(room);
  });

  it('P3: a NON-actor reconnecting first still arms the ABSENT on-turn actor (no present-player stall)', () => {
    const spec = GAMES[1]!; // guess-number: exactly one expected actor at a time
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.standard, spec.seats, spec.config, 'q3-p3-1');
    const actor = room.actors()[0]!;
    const nonActor = [0, 1, 2, 3].find((s) => s !== actor)!;

    room.now = T0 + 5_000;
    for (const s of [...room.connected]) room.disconnect(s);
    expect(room.pauseStartedAt).not.toBeNull();

    room.now = T0 + 5_000 + 2 * 86_400_000;
    resumeWithChecks(room, nonActor); // a NON-actor returns; the actor stays absent
    // The absent on-turn actor MUST still have a (shifted grace) row, so its alarm
    // fires and the present non-actor is never stalled forever waiting on it.
    expect(
      room.rows.find((r) => r.seat === actor),
      'P3: absent on-turn actor still armed after a non-actor resume',
    ).toBeDefined();
    expect(room.alarmAt, 'alarm armed (a seat is connected now)').not.toBeNull();
    assertInvariants(room);
  });

  it('P4: a room paused BEFORE Q3 (NULL offset) is stamped on the next wake; guard-path resumes to exactly ONE auto-play', () => {
    const spec = GAMES[1]!; // guess-number: single clear actor
    const room = new VirtualRoom(spec.game, TIMING_PRESETS.standard, spec.seats, spec.config, 'q3-p4-1');
    const actor = room.actors()[0]!;
    const base = room.rows.find((r) => r.seat === actor)!.baseDueAt!;

    // Advance to the deadline (it is exactly due), then everyone drops: the actor
    // grace-clamps to min(base, now+60s) = base, so its frozen due == base == now.
    room.now = base;
    for (const s of [...room.connected]) room.disconnect(s);
    expect(room.rows.find((r) => r.seat === actor)!.dueAt).toBe(base);

    // Simulate the PRE-Q3 world: the old code left no pause origin.
    room.pauseStartedAt = null;
    // The constructor wakes and lazy-stamps NOW — before any resume math (§3.2).
    room.simulateConstructorStamp();
    expect(room.pauseStartedAt, 'constructor stamped the origin — no NULL offset').toBe(base);

    // The actor reconnects 3s later. Guard-path: the frozen deadline was already
    // due at stamp time, so it shifts to ≈now → exactly 0 remaining, NOT a fresh
    // clock (§3.2 — no floor).
    room.now = base + 3_000;
    const seqBefore = room.seq;
    resumeWithChecks(room, actor);
    expect(room.rows.find((r) => r.seat === actor)!.dueAt - room.now, 'guard-path: 0 remaining').toBe(0);

    // Exactly ONE default action auto-plays (the next actor's clock is fresh, not
    // due) — a burst or a never-firing fresh clock would both be wrong.
    room.fireAlarmIfDue();
    expect(room.seq, 'exactly one 0-remaining default action auto-plays on reconnect').toBe(seqBefore + 1);
    assertInvariants(room);
  });
});
