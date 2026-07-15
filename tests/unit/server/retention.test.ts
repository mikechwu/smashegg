// Retention + Q3 pause/TTL DECISION tests (pause-and-retention.md §2-5). These
// exercise the exact pure functions game-room.ts calls — isPausedRoom /
// mayAutoPlay / resumeOffsetMs / alarmCandidates (room-helpers.ts) and
// shouldAutoPurge / ttlDueAt / isAutoPurgeEligible (retention.ts) — so the
// decision matrix is proven about the PRODUCT, not a re-implementation. The
// integration of these decisions with the deadline layer over random playouts
// (P1-P4) lives in deadline-liveness.property.test.ts; SQL/alarm delivery in e2e.
//
// The two counts are BRANDED (ConnectedSeatCount vs LiveSocketCount) so a swap
// is a compile error; tests construct them via asSeatCount / asLiveSocketCount,
// exactly as game-room.ts binds them at the source.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RETENTION_WINDOW_MS,
  asLiveSocketCount,
  asSeatCount,
  isAutoPurgeEligible,
  shouldAutoPurge,
  ttlDueAt,
} from '../../../src/shared/retention';
import {
  DISCONNECT_GRACE_MS,
  STALE_SOCKET_MS,
  alarmCandidates,
  isPausedRoom,
  isStaleSocket,
  mayAutoPlay,
  resumeOffsetMs,
  socketLastSeen,
} from '../../../src/server/room-helpers';
import { ACTION_TIMEOUT_MAX_MS } from '../../../src/shared/timing';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

describe('retention windows', () => {
  it('lobby 48h / paused(playing) 14d / finished 7d', () => {
    expect(RETENTION_WINDOW_MS.lobby).toBe(48 * HOUR);
    expect(RETENTION_WINDOW_MS.playing).toBe(14 * DAY);
    expect(RETENTION_WINDOW_MS.finished).toBe(7 * DAY);
  });
});

describe('shouldAutoPurge — the lazy/eager policy (§3.1)', () => {
  it('lazy (default): only lobby-abandoned auto-purges (the cheap case)', () => {
    expect(shouldAutoPurge('lobby', 'lazy')).toBe(true);
    expect(shouldAutoPurge('playing', 'lazy')).toBe(false);
    expect(shouldAutoPurge('finished', 'lazy')).toBe(false);
  });

  it('eager: every status auto-purges (safe only once deleteAll() measured flat)', () => {
    expect(shouldAutoPurge('lobby', 'eager')).toBe(true);
    expect(shouldAutoPurge('playing', 'eager')).toBe(true);
    expect(shouldAutoPurge('finished', 'eager')).toBe(true);
  });

  it('defaults to lazy (RETENTION_MODE)', () => {
    expect(shouldAutoPurge('finished')).toBe(false);
    expect(shouldAutoPurge('lobby')).toBe(true);
  });
});

describe('ttlDueAt — when (if ever) an abandoned room arms a self-purge', () => {
  it('lobby → last_active + 48h in lazy', () => {
    expect(ttlDueAt('lobby', NOW, 'lazy')).toBe(NOW + 48 * HOUR);
  });

  it('finished/paused → NULL in lazy (no auto-purge alarm — reclaimed via §4)', () => {
    expect(ttlDueAt('finished', NOW, 'lazy')).toBeNull();
    expect(ttlDueAt('playing', NOW, 'lazy')).toBeNull();
  });

  it('all statuses arm in eager mode', () => {
    expect(ttlDueAt('lobby', NOW, 'eager')).toBe(NOW + 48 * HOUR);
    expect(ttlDueAt('finished', NOW, 'eager')).toBe(NOW + 7 * DAY);
    expect(ttlDueAt('playing', NOW, 'eager')).toBe(NOW + 14 * DAY);
  });
});

describe('isAutoPurgeEligible — the exact test alarm() applies', () => {
  const base = {
    status: 'lobby' as const,
    liveSocketCount: asLiveSocketCount(0),
    lastActiveAt: NOW,
    now: NOW + 49 * HOUR,
  };

  it('lobby past 48h with 0 live sockets → eligible (lazy)', () => {
    expect(isAutoPurgeEligible({ ...base, mode: 'lazy' })).toBe(true);
  });

  it('lobby within 48h → NOT eligible', () => {
    expect(isAutoPurgeEligible({ ...base, now: NOW + 47 * HOUR })).toBe(false);
  });

  it('T3: a live socket makes it NEVER eligible — even a seatless idle lobby past its window', () => {
    // The load-bearing invariant: Q1's auto-response means an occupied lobby
    // leaves no last_active_at trace, so time alone is not enough.
    expect(isAutoPurgeEligible({ ...base, liveSocketCount: asLiveSocketCount(1) })).toBe(false);
    expect(
      isAutoPurgeEligible({ ...base, liveSocketCount: asLiveSocketCount(4), now: NOW + 100 * DAY }),
    ).toBe(false);
  });

  it('finished/paused past window with 0 sockets → NOT eligible in lazy (manual via §4)', () => {
    expect(
      isAutoPurgeEligible({
        status: 'finished',
        liveSocketCount: asLiveSocketCount(0),
        lastActiveAt: NOW,
        now: NOW + 8 * DAY,
        mode: 'lazy',
      }),
    ).toBe(false);
    expect(
      isAutoPurgeEligible({
        status: 'playing',
        liveSocketCount: asLiveSocketCount(0),
        lastActiveAt: NOW,
        now: NOW + 15 * DAY,
        mode: 'lazy',
      }),
    ).toBe(false);
  });

  it('finished/paused past window with 0 sockets → eligible in EAGER (the measured-flat flip)', () => {
    expect(
      isAutoPurgeEligible({
        status: 'finished',
        liveSocketCount: asLiveSocketCount(0),
        lastActiveAt: NOW,
        now: NOW + 8 * DAY,
        mode: 'eager',
      }),
    ).toBe(true);
  });

  it('exactly at the window boundary is eligible (>=)', () => {
    expect(isAutoPurgeEligible({ ...base, now: NOW + 48 * HOUR })).toBe(true);
    expect(isAutoPurgeEligible({ ...base, now: NOW + 48 * HOUR - 1 })).toBe(false);
  });

  it('the last gate is the most paranoid: a NULL anchor or NULL status FAILS SAFE (never purges)', () => {
    // deleteAll() is irreversible, so an unknowable anchor/status must refuse —
    // structural, not by convention. A NULL anchor as a bare `number` would read
    // as epoch = past every window = purge; the guard forbids it.
    expect(isAutoPurgeEligible({ ...base, lastActiveAt: null })).toBe(false);
    expect(isAutoPurgeEligible({ ...base, status: null })).toBe(false);
    // even well past the window and with 0 sockets, null anchor still refuses:
    expect(isAutoPurgeEligible({ ...base, lastActiveAt: null, now: NOW + 1000 * DAY })).toBe(false);
  });
});

describe('isPausedRoom — the Q3 pause predicate (= the stamp predicate)', () => {
  it('a playing room with no connected seat is paused', () => {
    expect(isPausedRoom('playing', asSeatCount(0))).toBe(true);
  });
  it('a playing room with >=1 connected seat is NOT paused', () => {
    expect(isPausedRoom('playing', asSeatCount(1))).toBe(false);
    expect(isPausedRoom('playing', asSeatCount(4))).toBe(false);
  });
  it('lobby/finished are never "paused" (pause is a playing-only concept)', () => {
    expect(isPausedRoom('lobby', asSeatCount(0))).toBe(false);
    expect(isPausedRoom('finished', asSeatCount(0))).toBe(false);
  });
  it('stamp ≡ pause wiring: every game-room.ts stamp site is guarded by isPausedRoom (source contract)', () => {
    // The truth-table tests above pin WHAT the predicate says. Whether both DO
    // stamp sites (the constructor deploy-transition and the socket-gone 1→0
    // edge) actually consult THAT predicate is a wiring fact a unit test can
    // only pin structurally — the earlier version of this test compared
    // isPausedRoom to itself, which proved nothing (Grok/Codex audit). The
    // behavioral proof is the stamp-ordering e2e; this pins the source shape:
    // pause_started_at is only ever SET under an isPausedRoom(...) guard.
    const src = readFileSync(
      fileURLToPath(new URL('../../../src/server/game-room.ts', import.meta.url)),
      'utf8',
    );
    const lines = src.split('\n');
    // (1) Every caller of the stamp helper is isPausedRoom-guarded on the spot
    // (same line or the guarding if/else-if within the preceding few lines).
    const helperCallIdxs = lines
      .map((l, i) => [l, i] as const)
      .filter(([l]) => l.includes('this.stampPauseStart(') && !l.includes('private stampPauseStart'))
      .map(([, i]) => i);
    expect(
      helperCallIdxs.length,
      'exactly two stamp-helper call sites (socket-gone 1→0 + hello-empties)',
    ).toBe(2);
    for (const i of helperCallIdxs) {
      const context = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
      // Pin the full call shape (Grok audit): the guard must consult the LIVE
      // count via the accessor — a hardcoded or stale-captured count would
      // still match a bare isPausedRoom( regex.
      expect(
        context,
        `the stamp call near line ${i + 1} is gated by isPausedRoom(room.status, this.seatCount())`,
      ).toMatch(/if \(isPausedRoom\(room\.status, this\.seatCount\(\)\)\)/);
    }
    // (2) Raw pause_started_at WRITES exist only inside the helper itself and
    // the constructor's deploy-transition block — the latter guarded by the
    // same predicate within its enclosing condition.
    const writes = lines
      .map((l, i) => [l, i] as const)
      .filter(([l]) => /UPDATE room SET pause_started_at = \?/.test(l));
    expect(writes.length, 'exactly two raw stamp writes (helper body + constructor)').toBe(2);
    for (const [, i] of writes) {
      const context = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
      expect(
        /isPausedRoom\(room\.status, this\.seatCount\(\)\)/.test(context) ||
          /private stampPauseStart/.test(context),
        `the stamp write near line ${i + 1} is either the guarded helper's body or gated by isPausedRoom(room.status, this.seatCount())`,
      ).toBe(true);
    }
  });
});

describe('mayAutoPlay — the alarm() seat-deadline guard', () => {
  it('auto-plays only while a seat is connected', () => {
    expect(mayAutoPlay(asSeatCount(1))).toBe(true);
    expect(mayAutoPlay(asSeatCount(0))).toBe(false);
  });
  it('is exactly the negation of isPausedRoom for a playing room', () => {
    for (const seats of [0, 1, 3, 4]) {
      expect(mayAutoPlay(asSeatCount(seats))).toBe(!isPausedRoom('playing', asSeatCount(seats)));
    }
  });
});

describe('resumeOffsetMs — the pause-duration shift (§2)', () => {
  it('is the elapsed pause duration', () => {
    expect(resumeOffsetMs(NOW, NOW + 5_000)).toBe(5_000);
  });
  it('clamps to 0 on clock skew (never rewinds a deadline)', () => {
    expect(resumeOffsetMs(NOW, NOW - 5_000)).toBe(0);
    expect(resumeOffsetMs(NOW, NOW)).toBe(0);
  });
  it('guard-path 0-remaining: a deadline due AT pause time resumes to ≈now (one immediate auto-play, no fresh budget)', () => {
    // Deploy-transition: the constructor stamps pause_started_at at the alarm
    // wake, when the frozen deadline is already due — so due ≈ pause_started_at.
    // Shifting by the offset lands it at ≈now: exactly 0 remaining, NOT a fresh
    // clock. Pinned per §3.2 — do NOT add a floor (a floor is the timer-dodge).
    const pausedAt = NOW;
    const frozenDue = NOW; // due == pause instant (guard path)
    const reconnectAt = NOW + 3 * DAY;
    const shiftedDue = frozenDue + resumeOffsetMs(pausedAt, reconnectAt);
    expect(shiftedDue).toBe(reconnectAt); // 0 remaining, auto-plays once
    expect(shiftedDue).not.toBe(reconnectAt + 45_000); // NOT a fresh 45s budget
  });
  it('normal pause preserves the exact remainder (no dodge)', () => {
    const pausedAt = NOW;
    const frozenDue = NOW + 2_000; // 2s remained at pause
    const reconnectAt = NOW + 10 * DAY;
    expect(frozenDue + resumeOffsetMs(pausedAt, reconnectAt)).toBe(reconnectAt + 2_000); // 2s, not 45s
  });
});

describe('alarmCandidates — the scheduleAlarm decision (§1 unified model)', () => {
  const probeDueAt = NOW + 15_000;

  it('P1: a paused playing room (0 connected seats) arms NO seat-deadline candidate', () => {
    const cands = alarmCandidates({
      status: 'playing',
      connectedSeatCount: asSeatCount(0),
      liveSocketCount: asLiveSocketCount(0),
      minSeatDeadlineDueAt: NOW + 45_000, // a frozen row exists
      lastActiveAt: NOW,
      probeDueAt: null,
      oldestSocketLastSeenAt: null, // paused AND socketless — nothing to sweep
    });
    expect(cands).toEqual([]); // frozen: no seat alarm, no TTL (playing lazy) → hibernate at $0
  });

  it('a connected playing room arms the seat deadline', () => {
    const cands = alarmCandidates({
      status: 'playing',
      connectedSeatCount: asSeatCount(2),
      liveSocketCount: asLiveSocketCount(2),
      minSeatDeadlineDueAt: NOW + 45_000,
      lastActiveAt: NOW,
      probeDueAt: null,
      oldestSocketLastSeenAt: NOW, // healthy sockets → the sweep sits 3 min out
    });
    // The seat deadline stays the armed minimum: STALE_SOCKET_MS is calibrated
    // ABOVE every legal turn budget (see the liveness matrix below).
    expect(cands).toEqual([NOW + 45_000, NOW + STALE_SOCKET_MS]);
    expect(Math.min(...cands)).toBe(NOW + 45_000);
  });

  it('T2: a finished room in lazy arms no TTL alarm (persists until §4)', () => {
    expect(
      alarmCandidates({
        status: 'finished',
        connectedSeatCount: asSeatCount(0),
        liveSocketCount: asLiveSocketCount(0),
        minSeatDeadlineDueAt: null,
        lastActiveAt: NOW,
        probeDueAt: null,
        oldestSocketLastSeenAt: null,
      }),
    ).toEqual([]);
  });

  it('an abandoned lobby (0 sockets) arms its 48h TTL', () => {
    expect(
      alarmCandidates({
        status: 'lobby',
        connectedSeatCount: asSeatCount(0),
        liveSocketCount: asLiveSocketCount(0),
        minSeatDeadlineDueAt: null,
        lastActiveAt: NOW,
        probeDueAt: null,
        oldestSocketLastSeenAt: null,
      }),
    ).toEqual([NOW + 48 * HOUR]);
  });

  it('T3: a lobby with a live (seatless) socket arms NO TTL — but DOES arm the sweep wake', () => {
    // Pre-liveness this returned [] — the immortal-phantom shape: an attached
    // half-open socket suppressed the TTL forever with no future wake to reap
    // it. The sweep candidate closes that hole (socket-liveness.md §5).
    expect(
      alarmCandidates({
        status: 'lobby',
        connectedSeatCount: asSeatCount(0), // no seat claimed
        liveSocketCount: asLiveSocketCount(1), // but someone is sitting there
        minSeatDeadlineDueAt: null,
        lastActiveAt: NOW,
        probeDueAt: null,
        oldestSocketLastSeenAt: NOW - 60_000, // last ping a minute ago
      }),
    ).toEqual([NOW - 60_000 + STALE_SOCKET_MS]);
  });

  it('a room-less probe DO (null status) arms only the probe, never a TTL', () => {
    expect(
      alarmCandidates({
        status: null,
        connectedSeatCount: asSeatCount(0),
        liveSocketCount: asLiveSocketCount(0),
        minSeatDeadlineDueAt: null,
        lastActiveAt: 0,
        probeDueAt,
        oldestSocketLastSeenAt: null,
      }),
    ).toEqual([probeDueAt]);
  });

  it('a NULL anchor fails SAFE — no TTL candidate even for an abandoned lobby', () => {
    // Defense-in-depth: an unknown retention anchor must never read as "epoch =
    // infinitely stale = purge now" for an irreversible deleteAll().
    expect(
      alarmCandidates({
        status: 'lobby',
        connectedSeatCount: asSeatCount(0),
        liveSocketCount: asLiveSocketCount(0),
        minSeatDeadlineDueAt: null,
        lastActiveAt: null,
        probeDueAt: null,
        oldestSocketLastSeenAt: null,
      }),
    ).toEqual([]);
  });

  it('the probe rides alongside a seat deadline (arms the earliest via min)', () => {
    const cands = alarmCandidates({
      status: 'playing',
      connectedSeatCount: asSeatCount(1),
      liveSocketCount: asLiveSocketCount(1),
      minSeatDeadlineDueAt: NOW + 45_000,
      lastActiveAt: NOW,
      probeDueAt,
      oldestSocketLastSeenAt: NOW,
    });
    expect(cands).toEqual([NOW + 45_000, probeDueAt, NOW + STALE_SOCKET_MS]);
    expect(Math.min(...cands)).toBe(probeDueAt);
  });
});

describe('socket liveness — the staleness-sweep decisions (socket-liveness.md §5)', () => {
  it('socketLastSeen: the accept time is the baseline until the first ping', () => {
    expect(socketLastSeen(null, NOW)).toBe(NOW);
  });

  it('socketLastSeen: the later of ping and accept wins', () => {
    expect(socketLastSeen(NOW + 25_000, NOW)).toBe(NOW + 25_000);
    // A rehydrated pre-liveness socket can have acceptedAt (treated as "now")
    // AFTER its last real ping — accept must win or it would read as stale.
    expect(socketLastSeen(NOW - 60_000, NOW)).toBe(NOW);
  });

  it('isStaleSocket: fresh is not stale; AT the deadline is (>=, or the sweep alarm would spin)', () => {
    expect(isStaleSocket(NOW, NOW + STALE_SOCKET_MS - 1)).toBe(false);
    expect(isStaleSocket(NOW, NOW + STALE_SOCKET_MS)).toBe(true);
    expect(isStaleSocket(NOW, NOW + STALE_SOCKET_MS + 1)).toBe(true);
  });

  it('isStaleSocket: the test override shrinks the deadline', () => {
    expect(isStaleSocket(NOW, NOW + 1_500, 1_500)).toBe(true);
    expect(isStaleSocket(NOW, NOW + 1_499, 1_500)).toBe(false);
  });

  it('calibration: the deadline clears every legal turn budget and the grace', () => {
    // Load-bearing for the property suite's "seat deadline is the armed min"
    // invariant AND for fairness: a healthy room's alarm math is unchanged by
    // the sweep candidate, and no legitimately-pinging-at-60s background tab
    // (Chrome intensive throttling) can be reaped between two of its pings.
    expect(STALE_SOCKET_MS).toBeGreaterThan(ACTION_TIMEOUT_MAX_MS);
    expect(STALE_SOCKET_MS).toBeGreaterThan(DISCONNECT_GRACE_MS);
    expect(STALE_SOCKET_MS).toBeGreaterThanOrEqual(2 * 60_000 + 60_000); // ≥2 missed 60s pings + margin
  });

  it('the sweep candidate arms iff a socket is attached (the anti-immortal wake)', () => {
    const withSocket = alarmCandidates({
      status: 'lobby',
      connectedSeatCount: asSeatCount(0),
      liveSocketCount: asLiveSocketCount(1),
      minSeatDeadlineDueAt: null,
      lastActiveAt: NOW,
      probeDueAt: null,
      oldestSocketLastSeenAt: NOW,
    });
    expect(withSocket).toEqual([NOW + STALE_SOCKET_MS]);
    // No sockets → no sweep; the TTL takes over (mutually exclusive gates, so
    // exactly one of {sweep, TTL} can be armed for a lobby — never neither).
    const without = alarmCandidates({
      status: 'lobby',
      connectedSeatCount: asSeatCount(0),
      liveSocketCount: asLiveSocketCount(0),
      minSeatDeadlineDueAt: null,
      lastActiveAt: NOW,
      probeDueAt: null,
      oldestSocketLastSeenAt: null,
    });
    expect(without).toEqual([NOW + 48 * HOUR]);
  });

  it('the sweep keys on the QUIETEST socket and honors the test override', () => {
    const cands = alarmCandidates({
      status: 'playing',
      connectedSeatCount: asSeatCount(2),
      liveSocketCount: asLiveSocketCount(2),
      minSeatDeadlineDueAt: null, // e.g. rows momentarily empty at terminal
      lastActiveAt: NOW,
      probeDueAt: null,
      oldestSocketLastSeenAt: NOW - 100_000,
      overrideStaleMs: 1_500,
    });
    expect(cands).toEqual([NOW - 100_000 + 1_500]);
  });
});
