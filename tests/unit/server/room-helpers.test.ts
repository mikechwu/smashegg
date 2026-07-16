// Unit tests for the pure GameRoom helpers (src/server/room-helpers.ts) —
// hashing, room-code generation, deadline math (the PLAN §4 rule verbatim),
// redaction fan-out, and the resync gap check. No DO runtime needed.

import { describe, expect, it } from 'vitest';
import type { Seat } from '../../../src/engine/core/game';
import type { AnyGameDefinition } from '../../../src/shared/games';
import { ROOM_CODE_RE } from '../../../src/shared/protocol';
import { TIMING_PRESETS } from '../../../src/shared/timing';
import {
  ACTION_TIMEOUT_MAX_MS,
  ACTION_TIMEOUT_MIN_MS,
  DISCONNECT_GRACE_MS,
  bytesToHex,
  deltaCoversGap,
  nextDeadlines,
  redactEventsFor,
  resolveSeatTiming,
  resolveTimeoutMs,
  resolveTimingClass,
  roomCodeFromBytes,
  sha256Hex,
  timeoutActionId,
  toWireDeadlines,
  type DeadlineEntry,
  type NextDeadlinesInput,
} from '../../../src/server/room-helpers';

describe('bytesToHex', () => {
  it('renders each byte as two lowercase hex chars', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });

  it('renders the empty array as the empty string', () => {
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });

  it('produces a 64-char string for 32 bytes (the seat-token shape)', () => {
    expect(bytesToHex(new Uint8Array(32).fill(0xab))).toHaveLength(64);
  });
});

describe('sha256Hex', () => {
  it('matches the FIPS-180 known vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the known vector for the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic and collision-distinct for distinct tokens', async () => {
    const a1 = await sha256Hex('token-a');
    const a2 = await sha256Hex('token-a');
    const b = await sha256Hex('token-b');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });
});

describe('roomCodeFromBytes', () => {
  it('maps 6 bytes to a 6-char code matching the wire regex', () => {
    const code = roomCodeFromBytes(new Uint8Array([0, 31, 32, 64, 255, 128]));
    expect(code).toHaveLength(6);
    expect(code).toMatch(ROOM_CODE_RE);
  });

  it('is deterministic in the byte values (mod 32)', () => {
    // byte % 32 indexes the alphabet, so 0, 32, 64 all map to 'A'.
    expect(roomCodeFromBytes(new Uint8Array([0, 32, 64, 96, 128, 160]))).toBe('AAAAAA');
    expect(roomCodeFromBytes(new Uint8Array([31, 63, 95, 127, 159, 191]))).toBe('999999');
  });

  it('never emits an ambiguous character (0/O/1/I) for any byte value', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const chars = roomCodeFromBytes(allBytes);
    expect(chars).not.toMatch(/[0O1I]/);
  });
});

// ---------------------------------------------------------------------------
// nextDeadlines — every row of the room-timing.md §2 decision table pinned
// by name, then the invariants I1-I4. `arm` mirrors the DO's decision
// recompute; `presence` mirrors its reconcile.
// ---------------------------------------------------------------------------

describe('nextDeadlines (room-timing.md §2 decision table)', () => {
  const NOW = 1_000_000;
  const GRACE = NOW + DISCONNECT_GRACE_MS;
  const connected = (...seats: Seat[]): ReadonlySet<Seat> => new Set(seats);
  const row = (
    seat: Seat,
    baseDueAt: number | null,
    dueAt: number,
    timingClass: DeadlineEntry['timingClass'] = 'turn',
  ): DeadlineEntry => ({ seat, baseDueAt, dueAt, timingClass });

  /** Uniform per-seat resolver — the pre-item-2 "one budget, one class for
   *  everyone" shape most table rows still exercise. */
  const rf =
    (timeoutMs: number | null, timingClass: DeadlineEntry['timingClass'] & string = 'turn') =>
    () => ({ timeoutMs, timingClass });

  type LegacyTiming = { timeoutMs?: number | null; timingClass?: 'turn' | 'planning' };

  function decision(
    input: Partial<NextDeadlinesInput> & LegacyTiming & Pick<NextDeadlinesInput, 'expectedActors'>,
  ): DeadlineEntry[] {
    const { timeoutMs = 45_000, timingClass = 'turn', ...rest } = input;
    return nextDeadlines({
      prev: [],
      resolveFor: rf(timeoutMs, timingClass),
      connectedSeats: connected(),
      now: NOW,
      reason: 'decision',
      ...rest,
    });
  }

  function presence(
    input: Partial<NextDeadlinesInput> &
      LegacyTiming &
      Pick<NextDeadlinesInput, 'expectedActors' | 'changedSeats'>,
  ): DeadlineEntry[] {
    const { timeoutMs = 45_000, timingClass = 'turn', ...rest } = input;
    return nextDeadlines({
      prev: [],
      resolveFor: rf(timeoutMs, timingClass),
      connectedSeats: connected(),
      now: NOW,
      reason: 'presence',
      ...rest,
    });
  }

  // --- reason = 'decision' -------------------------------------------------

  it('decision / not an expected actor → delete row', () => {
    expect(
      decision({ prev: [row(1, NOW + 45_000, NOW + 45_000)], expectedActors: [2], connectedSeats: connected(2) }),
    ).toEqual([row(2, NOW + 45_000, NOW + 45_000)]);
  });

  it('decision / actor, timed, row exists, connected → PRESERVE base; due = base', () => {
    // Second tribute payer: their clock was armed earlier (base in the
    // past relative to a fresh budget) and a co-actor's action must not
    // refresh it.
    const armed = row(1, NOW - 10_000 + 45_000, NOW - 10_000 + 45_000, 'planning');
    expect(decision({ prev: [armed], expectedActors: [1], connectedSeats: connected(1) })).toEqual([armed]);
  });

  it("re-cut: the seat that ACTED and is STILL an actor gets a FRESH clock (not the co-actor preserve)", () => {
    // The ceremony re-cut: the cutter cuts, flips an uncountable card, and
    // is immediately the actor again — a NEW decision point, so the base
    // re-arms. Without actedSeat this row would preserve its (possibly
    // expired) base and an alarm-fired default cut would refire in a loop.
    const stale = row(1, NOW - 10_000, NOW - 10_000, 'turn');
    expect(
      decision({ prev: [stale], expectedActors: [1], connectedSeats: connected(1), actedSeat: 1 }),
    ).toEqual([row(1, NOW + 45_000, NOW + 45_000)]);
  });

  it('re-cut: a DISCONNECTED acted seat re-arms fresh too, clamped to a new grace (no alarm tight-loop)', () => {
    // The alarm path: the server default-cuts for a disconnected AFK
    // cutter, the flip is uncountable, and the cutter is the actor again.
    // The fresh due must be REAL (min(budget, grace anchored now)) — the
    // shrink-only clamp would keep the expired due and loop the alarm.
    const expired = row(1, NOW - 10_000, NOW - 10_000, 'turn');
    expect(decision({ prev: [expired], expectedActors: [1], actedSeat: 1 })).toEqual([
      row(1, NOW + 45_000, Math.min(NOW + 45_000, GRACE)),
    ]);
  });

  it('re-cut: actedSeat does NOT disturb a CO-ACTOR that remained an actor (preserve stays scoped)', () => {
    // Double tribute: payer 1 pays (actedSeat=1) and leaves the actor set;
    // payer 2 remains — their base must survive untouched.
    const armed = row(2, NOW - 5_000 + 45_000, NOW - 5_000 + 45_000, 'planning');
    expect(
      decision({ prev: [armed], expectedActors: [2], connectedSeats: connected(2), actedSeat: 1 }),
    ).toEqual([armed]);
  });

  it('decision / actor, timed, row exists, disconnected → base preserved; due = min(prev due, grace)', () => {
    const clampedDue = NOW - 30_000 + DISCONNECT_GRACE_MS; // grace anchored at an earlier disconnect
    const armed = row(1, NOW + 100_000, clampedDue);
    expect(decision({ prev: [armed], expectedActors: [1] })).toEqual([
      row(1, NOW + 100_000, Math.min(clampedDue, GRACE)),
    ]);
  });

  it('decision / actor, timed, no row, connected → insert base = budget = due', () => {
    expect(decision({ expectedActors: [0], connectedSeats: connected(0), timingClass: 'planning', timeoutMs: 90_000 })).toEqual([
      row(0, NOW + 90_000, NOW + 90_000, 'planning'),
    ]);
  });

  it('decision / actor, timed, no row, disconnected → due = min(base, grace)', () => {
    expect(decision({ expectedActors: [3], timeoutMs: 90_000 })).toEqual([
      row(3, NOW + 90_000, GRACE),
    ]);
    // ...and the game budget wins when it beats the grace.
    expect(decision({ expectedActors: [3], timeoutMs: 15_000 })).toEqual([
      row(3, NOW + 15_000, NOW + 15_000),
    ]);
  });

  it('decision / actor, untimed, connected → no row', () => {
    expect(decision({ expectedActors: [0], timeoutMs: null, connectedSeats: connected(0) })).toEqual([]);
  });

  it('decision / actor, untimed, disconnected, no row → insert base = NULL, due = grace', () => {
    expect(decision({ expectedActors: [0], timeoutMs: null })).toEqual([row(0, null, GRACE)]);
  });

  it('decision / actor, untimed, disconnected, grace row exists → kept VERBATIM (I4)', () => {
    const anchored = row(0, null, NOW - 20_000 + DISCONNECT_GRACE_MS);
    expect(decision({ prev: [anchored], expectedActors: [0], timeoutMs: null })).toEqual([anchored]);
  });

  it('decision clamps the budget to the [5s, 120s] bounds', () => {
    expect(decision({ expectedActors: [1], connectedSeats: connected(1), timeoutMs: 1_000 })).toEqual([
      row(1, NOW + ACTION_TIMEOUT_MIN_MS, NOW + ACTION_TIMEOUT_MIN_MS),
    ]);
    expect(decision({ expectedActors: [1], connectedSeats: connected(1), timeoutMs: 600_000 })).toEqual([
      row(1, NOW + ACTION_TIMEOUT_MAX_MS, NOW + ACTION_TIMEOUT_MAX_MS),
    ]);
  });

  it('decision with no expected actors (terminal) → empty', () => {
    expect(decision({ prev: [row(0, NOW, NOW)], expectedActors: [] })).toEqual([]);
  });

  // --- reason = 'presence' -------------------------------------------------

  it('presence / disconnects, actor, row exists → due = min(due, grace); base unchanged', () => {
    const armed = row(1, NOW + 100_000, NOW + 100_000);
    expect(
      presence({ prev: [armed], expectedActors: [1], changedSeats: connected(1) }),
    ).toEqual([row(1, NOW + 100_000, GRACE)]);
    // A due already inside the grace is NOT extended (min, not overwrite).
    const short = row(1, NOW + 20_000, NOW + 20_000);
    expect(
      presence({ prev: [short], expectedActors: [1], changedSeats: connected(1) }),
    ).toEqual([short]);
  });

  it('presence / disconnects, actor, no row (untimed) → insert base = NULL, due = grace', () => {
    expect(presence({ expectedActors: [2], changedSeats: connected(2), timeoutMs: null })).toEqual([
      row(2, null, GRACE),
    ]);
  });

  it('presence / reconnects, actor, base ≠ NULL → due = base (THE FIX: only the remainder comes back)', () => {
    const clamped = row(1, NOW + 100_000, NOW - 5_000 + DISCONNECT_GRACE_MS);
    expect(
      presence({
        prev: [clamped],
        expectedActors: [1],
        changedSeats: connected(1),
        connectedSeats: connected(1),
      }),
    ).toEqual([row(1, NOW + 100_000, NOW + 100_000)]);
  });

  it('presence / reconnects, actor, base = NULL → delete row (untimed again)', () => {
    expect(
      presence({
        prev: [row(1, null, GRACE)],
        expectedActors: [1],
        changedSeats: connected(1),
        connectedSeats: connected(1),
        timeoutMs: null,
      }),
    ).toEqual([]);
  });

  it('presence / seat not an expected actor → no-op', () => {
    const stale = row(3, NOW + 10_000, NOW + 10_000);
    expect(
      presence({ prev: [stale], expectedActors: [1], changedSeats: connected(3) }),
    ).toEqual([stale]);
    // A row-less non-actor stays row-less too.
    expect(presence({ expectedActors: [1], changedSeats: connected(2) })).toEqual([]);
  });

  // --- invariants I1-I4 ----------------------------------------------------

  it('I1: due ≤ base whenever base ≠ NULL, across arm/disconnect/reconnect', () => {
    let rows = decision({ expectedActors: [0, 2], connectedSeats: connected(0, 2), timeoutMs: 90_000 });
    const assertI1 = (rs: DeadlineEntry[]): void => {
      for (const r of rs) if (r.baseDueAt !== null) expect(r.dueAt).toBeLessThanOrEqual(r.baseDueAt);
    };
    assertI1(rows);
    rows = nextDeadlines({
      prev: rows, expectedActors: [0, 2], resolveFor: rf(90_000),
      connectedSeats: connected(2), now: NOW + 1_000, reason: 'presence', changedSeats: connected(0),
    });
    assertI1(rows);
    rows = nextDeadlines({
      prev: rows, expectedActors: [0, 2], resolveFor: rf(90_000),
      connectedSeats: connected(0, 2), now: NOW + 2_000, reason: 'presence', changedSeats: connected(0),
    });
    assertI1(rows);
  });

  it('I2: no presence sequence can increase due beyond its decision-time value', () => {
    // 90s budget so the 60s grace ACTUALLY clamps on disconnect and the
    // reconnect ACTUALLY restores — due may oscillate below base but the
    // running max never exceeds the original armed due.
    let rows = decision({ expectedActors: [0], connectedSeats: connected(0), timeoutMs: 90_000 });
    const originalDue = rows[0]!.dueAt;
    let maxDue = originalDue;
    let sawClamp = false;
    for (let step = 1; step <= 6; step++) {
      const nowStep = NOW + step * 7_000;
      const isConnected = step % 2 === 0;
      rows = nextDeadlines({
        prev: rows, expectedActors: [0], resolveFor: rf(90_000),
        connectedSeats: isConnected ? connected(0) : connected(), now: nowStep,
        reason: 'presence', changedSeats: connected(0),
      });
      expect(rows).toHaveLength(1);
      if (rows[0]!.dueAt < originalDue) sawClamp = true;
      maxDue = Math.max(maxDue, rows[0]!.dueAt);
    }
    expect(sawClamp).toBe(true); // the cycle really exercised the clamp
    expect(maxDue).toBe(originalDue);
  });

  it("I3: seat X's presence never changes seat Y's row (byte-identical)", () => {
    // 90s budget so seat 1's disconnect grace actually clamps its due.
    const before = decision({ expectedActors: [1, 3], connectedSeats: connected(1, 3), timeoutMs: 90_000 });
    const after = nextDeadlines({
      prev: before, expectedActors: [1, 3], resolveFor: rf(90_000),
      connectedSeats: connected(3), now: NOW + 5_000, reason: 'presence', changedSeats: connected(1),
    });
    expect(JSON.stringify(after.find((r) => r.seat === 3))).toBe(
      JSON.stringify(before.find((r) => r.seat === 3)),
    );
    expect(after.find((r) => r.seat === 1)!.dueAt).toBe(NOW + 5_000 + DISCONNECT_GRACE_MS);
  });

  it("I4: a disconnected actor's grace is anchored at first disconnect and survives co-actor actions", () => {
    // Double tribute: payers 1 and 3 armed, then 3 disconnects, then 1 pays
    // (a decision recompute where 3 REMAINS an actor).
    let rows = decision({ expectedActors: [1, 3], connectedSeats: connected(1, 3), timeoutMs: 45_000 });
    rows = nextDeadlines({
      prev: rows, expectedActors: [1, 3], resolveFor: rf(45_000),
      connectedSeats: connected(1), now: NOW + 10_000, reason: 'presence', changedSeats: connected(3),
    });
    const graceDue = rows.find((r) => r.seat === 3)!.dueAt;
    expect(graceDue).toBe(NOW + 45_000); // base beat the grace here
    const afterCoActor = nextDeadlines({
      prev: rows, expectedActors: [3], resolveFor: rf(45_000),
      connectedSeats: connected(1), now: NOW + 20_000, reason: 'decision',
    });
    expect(afterCoActor).toHaveLength(1);
    expect(afterCoActor[0]!.seat).toBe(3);
    expect(afterCoActor[0]!.dueAt).toBe(graceDue);
    expect(afterCoActor[0]!.baseDueAt).toBe(rows.find((r) => r.seat === 3)!.baseDueAt);
  });

  it('item 2: co-actors resolve INDEPENDENT budgets and classes (per-seat window)', () => {
    // Double tribute where payer 0 has not acted this hand (planning, 90s)
    // while payer 1 already has (turn, 45s) — the same decision arms two
    // DIFFERENT fresh clocks. Pre-item-2 this was impossible: one class and
    // one budget applied to every actor.
    const rows = nextDeadlines({
      prev: [],
      expectedActors: [0, 1],
      resolveFor: (seat) =>
        seat === 0
          ? { timeoutMs: 90_000, timingClass: 'planning' as const }
          : { timeoutMs: 45_000, timingClass: 'turn' as const },
      connectedSeats: connected(0, 1),
      now: NOW,
      reason: 'decision',
    });
    expect(rows).toEqual([
      row(0, NOW + 90_000, NOW + 90_000, 'planning'),
      row(1, NOW + 45_000, NOW + 45_000, 'turn'),
    ]);
  });

  it('I4 (untimed flavor): a NULL-base grace row survives a co-actor decision verbatim', () => {
    const anchored = row(3, null, NOW - 30_000 + DISCONNECT_GRACE_MS);
    const after = nextDeadlines({
      prev: [anchored, row(1, NOW + 40_000, NOW + 40_000)],
      expectedActors: [3], resolveFor: rf(null),
      connectedSeats: connected(1), now: NOW, reason: 'decision',
    });
    expect(after).toEqual([anchored]);
  });
});

// ---------------------------------------------------------------------------
// resolveTimeoutMs / resolveTimingClass (room-timing.md §1 resolution order)
// ---------------------------------------------------------------------------

describe('resolveTimeoutMs / resolveTimingClass', () => {
  const gameWith = (timeoutMs: number | null, cls?: 'turn' | 'planning'): AnyGameDefinition =>
    ({
      actionTimeoutMs: () => timeoutMs,
      ...(cls !== undefined ? { timingClass: () => cls } : {}),
    }) as unknown as AnyGameDefinition;

  it('legacy room (timing null) → the engine suggestion verbatim, class ignored', () => {
    expect(resolveTimeoutMs(gameWith(15_000, 'planning'), {}, null, 0)).toBe(15_000);
    expect(resolveTimeoutMs(gameWith(null, 'planning'), {}, null, 0)).toBeNull();
  });

  it('engine-declared untimed state (actionTimeoutMs null) always wins over room timing', () => {
    expect(resolveTimeoutMs(gameWith(null, 'turn'), {}, TIMING_PRESETS.standard, 0)).toBeNull();
    expect(resolveTimeoutMs(gameWith(null), {}, TIMING_PRESETS.fast, 0)).toBeNull();
  });

  it('timed state maps the class through RoomTiming', () => {
    expect(resolveTimeoutMs(gameWith(30_000, 'turn'), {}, TIMING_PRESETS.standard, 0)).toBe(45_000);
    expect(resolveTimeoutMs(gameWith(30_000, 'planning'), {}, TIMING_PRESETS.standard, 0)).toBe(90_000);
    expect(resolveTimeoutMs(gameWith(30_000, 'turn'), {}, TIMING_PRESETS.untimed, 0)).toBeNull();
  });

  it("omitted timingClass method defaults to 'turn' (the guess-number path)", () => {
    expect(resolveTimingClass(gameWith(15_000), {}, 0)).toBe('turn');
    expect(resolveTimeoutMs(gameWith(15_000), {}, TIMING_PRESETS.fast, 0)).toBe(20_000);
  });

  it('implemented timingClass is respected', () => {
    expect(resolveTimingClass(gameWith(45_000, 'planning'), {}, 0)).toBe('planning');
  });

  // --- item 2: the class (and therefore the budget) is PER-SEAT --------------

  /** A game whose seat 0 is still planning while every other seat is not —
   *  the owner scenario ("seat 1 plays fast; seats 2-4 are still sorting"). */
  const perSeatGame = {
    actionTimeoutMs: () => 30_000,
    timingClass: (_state: unknown, seat: number) => (seat === 0 ? 'planning' : 'turn'),
  } as unknown as AnyGameDefinition;

  it('resolveSeatTiming maps EACH seat through its own class (item 2)', () => {
    const resolve = resolveSeatTiming(perSeatGame, {}, TIMING_PRESETS.standard);
    expect(resolve(0)).toEqual({ timeoutMs: 90_000, timingClass: 'planning' });
    expect(resolve(1)).toEqual({ timeoutMs: 45_000, timingClass: 'turn' });
  });

  it('resolveSeatTiming under untimed stays moot for every class (item 2)', () => {
    const resolve = resolveSeatTiming(perSeatGame, {}, TIMING_PRESETS.untimed);
    expect(resolve(0).timeoutMs).toBeNull();
    expect(resolve(1).timeoutMs).toBeNull();
  });
});

describe('timeoutActionId', () => {
  it('is deterministic in (seat, seq) so alarm retries dedup via actions_seen', () => {
    expect(timeoutActionId(2, 17)).toBe('timeout:2:17');
    expect(timeoutActionId(2, 17)).toBe(timeoutActionId(2, 17));
    expect(timeoutActionId(2, 18)).not.toBe(timeoutActionId(2, 17));
  });
});

describe('redactEventsFor', () => {
  // A stub game whose viewEvent hides events not addressed to the seat and
  // strips a 'secret' field from public ones — enough to prove the fan-out
  // applies viewEvent per event, threads config, and drops nulls.
  const stubGame = {
    viewEvent(event: unknown, seat: Seat, config: unknown): unknown {
      const e = event as { to?: number; kind: string; secret?: string };
      if (e.to !== undefined && e.to !== seat) return null; // hidden entirely
      const redactSecrets = (config as { redactSecrets?: boolean })?.redactSecrets === true;
      if (redactSecrets && e.secret !== undefined) {
        const { secret: _secret, ...rest } = e;
        return rest;
      }
      return e;
    },
  } as unknown as AnyGameDefinition;

  const events = [
    { kind: 'public' },
    { kind: 'private', to: 0, secret: 's0' },
    { kind: 'private', to: 1, secret: 's1' },
  ];

  it('keeps only events visible to the seat, in order, dropping nulls', () => {
    expect(redactEventsFor(stubGame, events, 0, {})).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 0, secret: 's0' },
    ]);
    expect(redactEventsFor(stubGame, events, 1, {})).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 1, secret: 's1' },
    ]);
  });

  it('threads the (opaque) config through to viewEvent', () => {
    expect(redactEventsFor(stubGame, events, 0, { redactSecrets: true })).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 0 },
    ]);
  });

  it('returns an empty array when every event is hidden', () => {
    expect(redactEventsFor(stubGame, [{ kind: 'x', to: 3 }], 0, {})).toEqual([]);
  });
});

describe('toWireDeadlines (PLAN §5 broadcast deadlines field)', () => {
  it('maps snake_case due_at rows to the camelCase wire shape', () => {
    expect(toWireDeadlines([{ seat: 1, due_at: 1_000 }])).toEqual([{ seat: 1, dueAt: 1_000 }]);
  });

  it('carries a valid timing_class through and omits NULL/unknown ones (pre-M4 rows)', () => {
    expect(
      toWireDeadlines([
        { seat: 0, due_at: 1_000, timing_class: 'planning' },
        { seat: 1, due_at: 2_000, timing_class: 'turn' },
        { seat: 2, due_at: 3_000, timing_class: null },
        { seat: 3, due_at: 4_000, timing_class: 'bogus' },
      ]),
    ).toEqual([
      { seat: 0, dueAt: 1_000, timingClass: 'planning' },
      { seat: 1, dueAt: 2_000, timingClass: 'turn' },
      { seat: 2, dueAt: 3_000 },
      { seat: 3, dueAt: 4_000 },
    ]);
  });

  it('sorts by seat regardless of input order', () => {
    expect(
      toWireDeadlines([
        { seat: 2, due_at: 3_000 },
        { seat: 0, due_at: 1_000 },
        { seat: 1, due_at: 2_000 },
      ]),
    ).toEqual([
      { seat: 0, dueAt: 1_000 },
      { seat: 1, dueAt: 2_000 },
      { seat: 2, dueAt: 3_000 },
    ]);
  });

  it('returns an empty array for no outstanding deadlines', () => {
    expect(toWireDeadlines([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const rows = [
      { seat: 2, due_at: 3_000 },
      { seat: 0, due_at: 1_000 },
    ];
    const rowsCopy = rows.map((r) => ({ ...r }));
    toWireDeadlines(rows);
    expect(rows).toEqual(rowsCopy);
  });
});

describe('deltaCoversGap (resync delta vs snapshot-only)', () => {
  it('true when the retained rows exactly cover lastSeenSeq+1..seq', () => {
    expect(deltaCoversGap(3, 6, [4, 5, 6])).toBe(true);
  });

  it('false when the client is already caught up (lastSeenSeq === seq)', () => {
    expect(deltaCoversGap(6, 6, [])).toBe(false);
  });

  it('false when the client claims to be ahead of the room', () => {
    expect(deltaCoversGap(9, 6, [])).toBe(false);
  });

  it('false when the log has a leading gap (lobby seqs wrote no events rows)', () => {
    // Room started at seq 3 → events rows begin at 3; a client whose
    // lastSeenSeq is 1 (lobby-era) cannot get a delta.
    expect(deltaCoversGap(1, 4, [3, 4])).toBe(false);
  });

  it('false when a row is missing mid-range (trimmed log)', () => {
    expect(deltaCoversGap(3, 6, [4, 6])).toBe(false);
  });

  it('false when there are extra unexpected rows', () => {
    expect(deltaCoversGap(3, 6, [4, 5, 6, 7])).toBe(false);
  });

  it('handles the single-event gap', () => {
    expect(deltaCoversGap(5, 6, [6])).toBe(true);
  });
});
