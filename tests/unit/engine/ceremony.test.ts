// 翻牌定先 drawCard ceremony tests (spec §5.1 firstLeadMethod='drawCard',
// owner counting rule; M3). The ceremony is seeded engine data attached to
// hand 1's handStarted event: cutter → counting-card flips → count around
// the table (A=1 .. K=13, offset (count-1) mod 4 along turnDirection) →
// marker seat = the hand's leader.
//
// Test strategy: an ORACLE reimplementation of the documented draw sequence
// (same PRNG, same consumption order as init: deal shuffle first, then
// ceremony draws) lets us find seeds with specific outcomes — including
// joker draws, which the frozen `flips: Rank[]` contract cannot record —
// and assert the engine's ceremony bit-for-bit.

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng } from '../../../src/engine/core/prng';
import { shuffle } from '../../../src/engine/core/prng';
import type { Seat } from '../../../src/engine/core/game';
import { GuandanGame } from '../../../src/engine/guandan';
import { buildDeck, naturalValue, RANKS, type Rank } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import { nextSeat, partnerOf, type GuandanEvent, type GuandanState } from '../../../src/engine/guandan/types';
import { getGame } from '../../../src/shared/games';
import { recordPlayout, replayMatch } from '../../../scripts/replay';

const DRAW_CFG: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'drawCard' };
const CW_DRAW_CFG: RuleVariant = { ...DRAW_CFG, turnDirection: 'clockwise' };

type HandStarted = Extract<GuandanEvent, { type: 'handStarted' }>;
type Ceremony = NonNullable<HandStarted['ceremony']>;

function handStartedOf(events: readonly GuandanEvent[], handNo: number): HandStarted {
  const e = events.find(
    (ev): ev is HandStarted => ev.type === 'handStarted' && ev.handNo === handNo,
  );
  if (!e) throw new Error(`no handStarted event for hand ${handNo}`);
  return e;
}

function initCeremony(seed: string, config: RuleVariant): { ceremony: Ceremony | undefined; state: GuandanState } {
  const { state, events } = GuandanGame.init(config, 4, seed);
  return { ceremony: handStartedOf(events, 1).ceremony, state };
}

/** The owner counting rule, restated independently: A=1, 2..10 face, J=11,
 *  Q=12, K=13 (naturalValue coincides for everything except A). */
function countOf(rank: Rank): number {
  return rank === 'A' ? 1 : naturalValue(rank);
}

function stepSeats(from: Seat, steps: number, config: RuleVariant): Seat {
  let seat = from;
  for (let i = 0; i < steps; i++) seat = nextSeat(seat, config);
  return seat;
}

/** Oracle: replay the DOCUMENTED draw sequence directly on the PRNG. Must
 *  mirror the engine's consumption order exactly — init() shuffles the
 *  108-card deal BEFORE the ceremony draws. Hand 1 always plays at level
 *  '2' (STARTING_LEVEL), so '2' is the re-flipping level rank here. */
function oracleCeremony(seed: string, config: RuleVariant): { ceremony: Ceremony; jokerDraws: number } {
  let prng = shuffle(buildDeck(), seedPrng(seed)).state;

  const cut = nextInt(prng, 4);
  prng = cut.state;
  const cutter = cut.value as Seat;

  const flips: Ceremony['flips'] = [];
  let jokerDraws = 0;
  let counted: Rank | null = null;
  while (counted === null) {
    const draw = nextInt(prng, 108); // 8 copies × 13 ranks + 4 jokers
    prng = draw.state;
    if (draw.value >= 104) {
      jokerDraws++;
      // Jokers are RECORDED re-flips (contract widened for animation
      // fidelity): slots 104-105 are the small jokers, 106-107 the big.
      flips.push(draw.value - 104 < 2 ? 'SJ' : 'BJ');
      continue;
    }
    const rank = RANKS[Math.floor(draw.value / 8)]!;
    flips.push(rank);
    if (rank !== '2') counted = rank;
  }

  const firstDrawer = stepSeats(cutter, (countOf(counted) - 1) % 4, config);
  const marker = nextInt(prng, 4);
  prng = marker.state;
  const markerSeat = stepSeats(firstDrawer, marker.value, config);
  return { ceremony: { cutter, flips, firstDrawer, markerSeat }, jokerDraws };
}

/** Deterministic seed hunt: fixed candidate list, same result every run. */
function findSeed(
  tag: string,
  config: RuleVariant,
  pred: (c: Ceremony, jokerDraws: number) => boolean,
): { seed: string; ceremony: Ceremony; state: GuandanState } {
  for (let i = 0; i < 3000; i++) {
    const seed = `ceremony-${tag}-${i}`;
    const o = oracleCeremony(seed, config);
    if (!pred(o.ceremony, o.jokerDraws)) continue;
    const { ceremony, state } = initCeremony(seed, config);
    expect(ceremony).toEqual(o.ceremony); // engine must agree with the oracle
    return { seed, ceremony: ceremony!, state };
  }
  throw new Error(`findSeed(${tag}): no matching seed within bound`);
}

describe('drawCard ceremony — exact counting mapping (owner rule)', () => {
  it('final flip A → firstDrawer is the cutter (A counts 1, i.e. self)', () => {
    const { ceremony } = findSeed('ace', DRAW_CFG, (c) => c.flips[c.flips.length - 1] === 'A');
    expect(ceremony.firstDrawer).toBe(ceremony.cutter);
  });

  it("final flip 3 → firstDrawer is the cutter's partner (offset 2)", () => {
    const { ceremony } = findSeed('three', DRAW_CFG, (c) => c.flips[c.flips.length - 1] === '3');
    expect(ceremony.firstDrawer).toBe(partnerOf(ceremony.cutter));
  });

  it('final flip 4 → firstDrawer is the remaining seat (offset 3)', () => {
    const { ceremony } = findSeed('four', DRAW_CFG, (c) => c.flips[c.flips.length - 1] === '4');
    expect(ceremony.firstDrawer).toBe(stepSeats(ceremony.cutter, 3, DRAW_CFG));
    // "Remaining" = neither the cutter, nor the cutter's 下家, nor partner.
    expect(ceremony.firstDrawer).not.toBe(ceremony.cutter);
    expect(ceremony.firstDrawer).not.toBe(nextSeat(ceremony.cutter, DRAW_CFG));
    expect(ceremony.firstDrawer).not.toBe(partnerOf(ceremony.cutter));
  });

  it('wrap case: final flip 6 → nextSeat(cutter) ((6-1) mod 4 = 1)', () => {
    // NOTE: the count-2 mapping (rank '2' → nextSeat) is untestable via a
    // final flip at hand 1 — '2' is the level rank and always re-flips —
    // so offset 1 is exercised through the wrapping rank 6 instead.
    const { ceremony } = findSeed('six', DRAW_CFG, (c) => c.flips[c.flips.length - 1] === '6');
    expect(ceremony.firstDrawer).toBe(nextSeat(ceremony.cutter, DRAW_CFG));
  });

  it('the marker seat is the hand-1 trick leader', () => {
    for (let i = 0; i < 20; i++) {
      const { ceremony, state } = initCeremony(`ceremony-leader-${i}`, DRAW_CFG);
      expect(state.trick!.leader).toBe(ceremony!.markerSeat);
      expect(state.trick!.toAct).toBe(ceremony!.markerSeat);
    }
  });

  it('matches the documented PRNG draw sequence bit-for-bit (oracle sweep)', () => {
    for (let i = 0; i < 50; i++) {
      const seed = `ceremony-oracle-${i}`;
      const { ceremony } = initCeremony(seed, DRAW_CFG);
      expect(ceremony).toEqual(oracleCeremony(seed, DRAW_CFG).ceremony);
    }
  });
});

describe('drawCard ceremony — re-flips', () => {
  it("level-rank flips ('2' at hand 1) are recorded re-flips; the last flip is always countable", () => {
    const { ceremony } = findSeed('reflip-level', DRAW_CFG, (c) => c.flips.length >= 2);
    // Every recorded non-final flip is the level rank (jokers, the other
    // re-flip cause, cannot appear in the frozen Rank[] type).
    for (const flip of ceremony.flips.slice(0, -1)) expect(flip).toBe('2');
    expect(ceremony.flips[ceremony.flips.length - 1]).not.toBe('2');
  });

  it('a joker flip consumes a PRNG draw and forces a re-flip (oracle-verified)', () => {
    // Jokers are invisible in flips[] (frozen Rank[] contract), so the
    // proof is agreement with the oracle, which explicitly routed >=1 draw
    // through the joker band: if the engine did NOT consume that draw, all
    // subsequent draws would shift and the ceremonies would diverge.
    const { ceremony } = findSeed('reflip-joker', DRAW_CFG, (_c, jokerDraws) => jokerDraws >= 1);
    expect(ceremony.flips[ceremony.flips.length - 1]).not.toBe('2'); // still countable
  });

  it('joker and level-rank re-flips in one ceremony still end on a countable flip', () => {
    const { ceremony } = findSeed(
      'reflip-both',
      DRAW_CFG,
      (c, jokerDraws) => jokerDraws >= 1 && c.flips.length >= 2,
    );
    // Every non-final flip must be a re-flip cause: the level rank ('2' on
    // hand 1) or a recorded joker. The final flip is always countable.
    for (const flip of ceremony.flips.slice(0, -1)) {
      expect(['2', 'SJ', 'BJ']).toContain(flip);
    }
    const last = ceremony.flips[ceremony.flips.length - 1]!;
    expect(['2', 'SJ', 'BJ']).not.toContain(last);
  });
});

describe('drawCard ceremony — distribution and determinism', () => {
  it('leader is uniform over seats: 25% ± 5% across 400 seeds', () => {
    const tally = [0, 0, 0, 0];
    const n = 400;
    for (let i = 0; i < n; i++) {
      const { state } = initCeremony(`ceremony-unif-${i}`, DRAW_CFG);
      tally[state.trick!.leader]!++;
    }
    for (const count of tally) {
      expect(count).toBeGreaterThanOrEqual(n * 0.2);
      expect(count).toBeLessThanOrEqual(n * 0.3);
    }
  });

  it('same seed twice ⇒ identical ceremony, state and events', () => {
    const a = GuandanGame.init(DRAW_CFG, 4, 'ceremony-determinism');
    const b = GuandanGame.init(DRAW_CFG, 4, 'ceremony-determinism');
    expect(handStartedOf(a.events, 1).ceremony).toBeDefined();
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });

  it('a drawCard match replays bit-for-bit through the harness', () => {
    const rec = recordPlayout('ceremony-replay', DRAW_CFG, undefined, {
      maxActions: 20_000,
      stopAfterHands: 1,
    });
    expect(handStartedOf(rec.events[0] as GuandanEvent[], 1).ceremony).toBeDefined();
    const result = replayMatch(rec.artifact, {
      snapshots: rec.states.map((state, seq) => ({ seq, state })),
    });
    expect(result.ok).toBe(true);
    expect(result.events).toEqual(rec.events);
  });
});

describe('drawCard ceremony — scope (hand 1, drawCard only)', () => {
  it("absent under firstLeadMethod='random'", () => {
    const { events } = GuandanGame.init(JIANGSU_OFFICIAL_ONLINE, 4, 'ceremony-absent-random');
    expect(handStartedOf(events, 1).ceremony).toBeUndefined();
  });

  it("absent under firstLeadMethod='fixedSeat' (and seat 0 leads)", () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'fixedSeat' };
    const { state, events } = GuandanGame.init(config, 4, 'ceremony-absent-fixed');
    expect(handStartedOf(events, 1).ceremony).toBeUndefined();
    expect(state.trick!.leader).toBe(0);
  });

  it('absent on hand 2+ even under drawCard (lead comes from tribute rules)', () => {
    const rec = recordPlayout('ceremony-hand2', DRAW_CFG, undefined, {
      maxActions: 20_000,
      stopAfterHands: 1,
    });
    const allEvents = rec.events.flat();
    expect(handStartedOf(allEvents, 1).ceremony).toBeDefined();
    expect(handStartedOf(allEvents, 2).ceremony).toBeUndefined();
  });
});

describe('drawCard ceremony — clockwise turnDirection counts clockwise', () => {
  it('offset-1 final flip steps to the CLOCKWISE 下家, not the CCW one', () => {
    const { ceremony } = findSeed('cw-six', CW_DRAW_CFG, (c) => {
      // The final flip is countable by construction — never a joker.
      const last = c.flips[c.flips.length - 1]! as Rank;
      return (countOf(last) - 1) % 4 === 1;
    });
    expect(ceremony.firstDrawer).toBe(nextSeat(ceremony.cutter, CW_DRAW_CFG));
    expect(ceremony.firstDrawer).toBe((ceremony.cutter + 3) % 4);
    expect(ceremony.firstDrawer).not.toBe((ceremony.cutter + 1) % 4);
  });

  it('matches the oracle under clockwise config (sweep)', () => {
    for (let i = 0; i < 25; i++) {
      const seed = `ceremony-cw-oracle-${i}`;
      const { ceremony } = initCeremony(seed, CW_DRAW_CFG);
      expect(ceremony).toEqual(oracleCeremony(seed, CW_DRAW_CFG).ceremony);
    }
  });
});

describe('drawCard ceremony — visibility and registration', () => {
  it('viewEvent keeps the ceremony public while redacting other hands', () => {
    const { events } = GuandanGame.init(DRAW_CFG, 4, 'ceremony-view');
    const handStarted = handStartedOf(events, 1);
    for (let seat = 0; seat < 4; seat++) {
      const viewed = GuandanGame.viewEvent(handStarted, seat, DRAW_CFG) as HandStarted;
      expect(viewed.ceremony).toEqual(handStarted.ceremony);
      for (let s = 0; s < 4; s++) {
        expect(viewed.hands[s]!).toEqual(s === seat ? handStarted.hands[s] : []);
      }
    }
  });

  it("the registry resolves 'guandan' to GuandanGame (M3 registration)", () => {
    expect(getGame('guandan')).toBe(GuandanGame);
  });
});
