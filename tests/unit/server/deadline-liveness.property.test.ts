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
// SCOPE (stated honestly, per the Codex M4 audit): VirtualRoom exercises
// the pure deadline layer (nextDeadlines / resolveTimeoutMs / the real
// engines) with an in-memory mirror of the DO's call pattern — it does NOT
// execute DO SQL replacement, hello/takeover ordering, socket-close
// ordering, idempotency, or the fire-and-forget async boundary. Those
// integration behaviors are owned by the e2e suites
// (reconnection.e2e.test.ts, timing.e2e.test.ts) over the real DO.
//       (named double-tribute case below).

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
  nextDeadlines,
  resolveTimeoutMs,
  resolveTimingClass,
  type DeadlineEntry,
} from '../../../src/server/room-helpers';

const T0 = 1_700_000_000_000;
const MAX_ALARM_APPLIES = 32; // mirrors game-room.ts

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
    // scheduleAlarm, minus the unrelated hello probe.
    this.alarmAt = this.rows.length > 0 ? Math.min(...this.rows.map((r) => r.dueAt)) : null;
    const nowSeats = new Set(this.rows.map((r) => r.seat));
    for (const s of nowSeats) if (!prevSeats.has(s)) this.armedAt.set(s, this.now);
    for (const s of [...this.armedAt.keys()]) if (!nowSeats.has(s)) this.armedAt.delete(s);
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
    this.recompute('presence', new Set([seat]));
  }

  reconnect(seat: Seat): void {
    if (this.connected.has(seat)) return;
    this.connected.add(seat);
    this.disconnectedAt.delete(seat);
    this.recompute('presence', new Set([seat]));
  }

  /** The alarm loop (game-room.ts alarm(), path (b)) — DL3 asserted per
   *  iteration: seq strictly advances or a stale row is deleted. */
  fireAlarmIfDue(): void {
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

  // DL2: alarm parked at min(due) exactly when rows exist.
  if (room.rows.length > 0) {
    expect(room.alarmAt).toBe(Math.min(...room.rows.map((r) => r.dueAt)));
  } else {
    expect(room.alarmAt).toBeNull();
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
      if (pool.length > 0) presenceWithChecks(room, pool[draw(pool.length)]!, 'disconnect');
    } else if (roll < 80) {
      const pool = Array.from({ length: spec.seats }, (_, s) => s).filter((s) => !room.connected.has(s));
      if (pool.length > 0) presenceWithChecks(room, pool[draw(pool.length)]!, 'reconnect');
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
