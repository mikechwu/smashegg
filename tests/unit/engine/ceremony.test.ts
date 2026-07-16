// 翻牌定先 with a REAL cut (item 3; owner counting rule from M3 preserved).
// Hand 1 under firstLeadMethod='drawCard' now OPENS in phase 'ceremonyCut':
// init commits a shuffled deck (hidden), the cutter picks a position, and
// the cutDeck action derives flips, first drawer, marker seat AND the deal
// from the same rotated deck — the choice genuinely matters.
//
// Test strategy: an ORACLE reimplementation of the documented ritual (same
// PRNG setup as init — deck shuffle then cutter draw — then the pure deck
// arithmetic) lets us hunt (seed, position) pairs with specific outcomes
// and assert the engine bit-for-bit; plus the physical pins the old
// PRNG-theatre version could never state: the marker card REALLY lands in
// the leader's hand, and a different cut REALLY changes the hands.

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, shuffle } from '../../../src/engine/core/prng';
import type { Seat } from '../../../src/engine/core/game';
import { CUT_MAX, CUT_MIN, DEFAULT_CUT_POSITION, GuandanGame } from '../../../src/engine/guandan';
import { buildDeck, isJoker, naturalValue, rankOf, type Card, type Rank } from '../../../src/engine/guandan/cards';
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

/** Oracle setup — mirrors init's PRNG consumption exactly: the deck shuffle,
 *  then the cutter draw. */
function oracleSetup(seed: string): { deck: Card[]; cutter: Seat } {
  const shuffled = shuffle(buildDeck(), seedPrng(seed));
  const cut = nextInt(shuffled.state, 4);
  return { deck: shuffled.items, cutter: cut.value as Seat };
}

/** Oracle ritual — the documented deck arithmetic, no PRNG: rotate at the
 *  position, flip real cards until countable (jokers + level '2' re-flip),
 *  count from the cutter, and locate the marker's landing seat in the
 *  one-card-at-a-time deal from the first drawer. */
function oracleRitual(seed: string, position: number, config: RuleVariant): Ceremony {
  const { deck, cutter } = oracleSetup(seed);
  const rotated = [...deck.slice(position), ...deck.slice(0, position)];
  const flips: Card[] = [];
  let counted: Rank | null = null;
  for (let i = 0; counted === null; i++) {
    const card = rotated[i]!;
    flips.push(card);
    const r = rankOf(card);
    if (r !== null && r !== '2') counted = r; // hand 1 plays at level '2'
  }
  const firstDrawer = stepSeats(cutter, (countOf(counted) - 1) % 4, config);
  const markerSeat = stepSeats(firstDrawer, (flips.length - 1) % 4, config);
  return { cutter, cutPosition: position, flips, firstDrawer, markerSeat };
}

/** Drive the real thing: init → assert phase ceremonyCut → apply cutDeck. */
function runCut(
  seed: string,
  config: RuleVariant,
  position: number = DEFAULT_CUT_POSITION,
): { ceremony: Ceremony; state: GuandanState; initState: GuandanState; handStarted: HandStarted } {
  const init = GuandanGame.init(config, 4, seed);
  expect(init.state.phase).toBe('ceremonyCut');
  const cutter = init.state.ceremonyCut!.cutter;
  const res = GuandanGame.applyAction(init.state, cutter, { type: 'cutDeck', position });
  if (!res.ok) throw new Error(`cut rejected: ${res.error.code}`);
  const handStarted = handStartedOf(res.events, 1);
  return { ceremony: handStarted.ceremony!, state: res.state, initState: init.state, handStarted };
}

/** Deterministic (seed, position) hunt via the oracle; the found case is
 *  then asserted against the ENGINE bit-for-bit. */
function findCut(
  tag: string,
  config: RuleVariant,
  pred: (c: Ceremony) => boolean,
): { seed: string; position: number; ceremony: Ceremony; state: GuandanState } {
  for (let i = 0; i < 200; i++) {
    const seed = `cut-${tag}-${i}`;
    for (let p = CUT_MIN; p <= CUT_MAX; p += 5) {
      const o = oracleRitual(seed, p, config);
      if (!pred(o)) continue;
      const { ceremony, state } = runCut(seed, config, p);
      expect(ceremony).toEqual(o); // engine must agree with the oracle
      return { seed, position: p, ceremony, state };
    }
  }
  throw new Error(`findCut(${tag}): no matching (seed, position) within bound`);
}

const lastFlipRank = (c: Ceremony): Rank | null => rankOf(c.flips[c.flips.length - 1]!);

describe('real cut — exact counting mapping (owner rule preserved)', () => {
  it('final flip A → firstDrawer is the cutter (A counts 1, i.e. self)', () => {
    const { ceremony } = findCut('ace', DRAW_CFG, (c) => lastFlipRank(c) === 'A');
    expect(ceremony.firstDrawer).toBe(ceremony.cutter);
  });

  it("final flip 3 → firstDrawer is the cutter's partner (offset 2)", () => {
    const { ceremony } = findCut('three', DRAW_CFG, (c) => lastFlipRank(c) === '3');
    expect(ceremony.firstDrawer).toBe(partnerOf(ceremony.cutter));
  });

  it('final flip 4 → firstDrawer is the remaining seat (offset 3)', () => {
    const { ceremony } = findCut('four', DRAW_CFG, (c) => lastFlipRank(c) === '4');
    expect(ceremony.firstDrawer).toBe(stepSeats(ceremony.cutter, 3, DRAW_CFG));
    expect(ceremony.firstDrawer).not.toBe(ceremony.cutter);
    expect(ceremony.firstDrawer).not.toBe(nextSeat(ceremony.cutter, DRAW_CFG));
    expect(ceremony.firstDrawer).not.toBe(partnerOf(ceremony.cutter));
  });

  it('wrap case: final flip 6 → nextSeat(cutter) ((6-1) mod 4 = 1)', () => {
    const { ceremony } = findCut('six', DRAW_CFG, (c) => lastFlipRank(c) === '6');
    expect(ceremony.firstDrawer).toBe(nextSeat(ceremony.cutter, DRAW_CFG));
  });

  it('oracle sweep: engine ceremony equals the documented arithmetic bit-for-bit', () => {
    for (let i = 0; i < 40; i++) {
      const seed = `cut-oracle-${i}`;
      const position = CUT_MIN + ((i * 13) % (CUT_MAX - CUT_MIN + 1));
      const { ceremony } = runCut(seed, DRAW_CFG, position);
      expect(ceremony).toEqual(oracleRitual(seed, position, DRAW_CFG));
    }
  });
});

describe('real cut — the physical pins the theatre version could not state', () => {
  it("the marker card REALLY lands in the leader's hand (明牌落在該家)", () => {
    for (let i = 0; i < 15; i++) {
      const position = CUT_MIN + ((i * 11) % (CUT_MAX - CUT_MIN + 1));
      const { ceremony, state } = runCut(`cut-marker-${i}`, DRAW_CFG, position);
      const marker = ceremony.flips[ceremony.flips.length - 1]!;
      expect(state.hands[ceremony.markerSeat]!).toContain(marker);
      expect(state.trick!.leader).toBe(ceremony.markerSeat);
      expect(state.trick!.toAct).toBe(ceremony.markerSeat);
    }
  });

  it('every flip lands at its derivable seat (the flips are REAL deal cards)', () => {
    const { ceremony, state } = findCut('flips-land', DRAW_CFG, (c) => c.flips.length >= 2);
    ceremony.flips.forEach((flip, i) => {
      const seat = stepSeats(ceremony.firstDrawer, i % 4, DRAW_CFG);
      expect(state.hands[seat]!, `flip ${i} (${flip}) lands at seat ${seat}`).toContain(flip);
    });
  });

  it('the CUT MATTERS: a different position ⇒ different hands (the agency pin)', () => {
    const a = runCut('cut-agency', DRAW_CFG, 20);
    const b = runCut('cut-agency', DRAW_CFG, 80);
    expect(a.state.hands).not.toEqual(b.state.hands);
  });

  it('27 cards each, every deck card dealt exactly once', () => {
    const { state } = runCut('cut-conserve', DRAW_CFG, 33);
    for (const hand of state.hands) expect(hand).toHaveLength(27);
    const all = state.hands.flat().sort();
    expect(all).toEqual([...buildDeck()].sort());
  });
});

describe('real cut — re-flips over real cards', () => {
  it("level-rank ('2') and joker flips are recorded re-flips; the last flip is countable", () => {
    const { ceremony } = findCut('reflip', DRAW_CFG, (c) => c.flips.length >= 2);
    for (const flip of ceremony.flips.slice(0, -1)) {
      expect(isJoker(flip) || rankOf(flip) === '2', `re-flip cause: ${flip}`).toBe(true);
    }
    const last = ceremony.flips[ceremony.flips.length - 1]!;
    expect(isJoker(last)).toBe(false);
    expect(rankOf(last)).not.toBe('2');
  });

  it('a joker at the cut point is flipped, recorded and passed over', () => {
    const { ceremony } = findCut('reflip-joker', DRAW_CFG, (c) => isJoker(c.flips[0]!));
    expect(isJoker(ceremony.flips[0]!)).toBe(true);
    expect(ceremony.flips.length).toBeGreaterThanOrEqual(2);
  });
});

describe('real cut — the phase machinery (actor, liveness, validation)', () => {
  it('init stops in ceremonyCut: cutter is the only actor; hands are empty', () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-phase');
    expect(state.phase).toBe('ceremonyCut');
    expect(GuandanGame.expectedActors(state)).toEqual([state.ceremonyCut!.cutter]);
    for (const hand of state.hands) expect(hand).toHaveLength(0);
  });

  it('legalActions is the EXACT interior-position set for the cutter, [] otherwise', () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-legal');
    const cutter = state.ceremonyCut!.cutter;
    const legal = GuandanGame.legalActions(state, cutter);
    expect(legal).toHaveLength(CUT_MAX - CUT_MIN + 1);
    expect(legal[0]).toEqual({ type: 'cutDeck', position: CUT_MIN });
    expect(legal[legal.length - 1]).toEqual({ type: 'cutDeck', position: CUT_MAX });
    const other = ((cutter + 1) % 4) as Seat;
    expect(GuandanGame.legalActions(state, other)).toEqual([]);
  });

  it('defaultAction is the indifferent middle cut — an AFK cutter cannot deadlock the table', () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-default');
    const cutter = state.ceremonyCut!.cutter;
    expect(GuandanGame.defaultAction(state, cutter)).toEqual({
      type: 'cutDeck',
      position: DEFAULT_CUT_POSITION,
    });
    expect(GuandanGame.defaultAction(state, ((cutter + 1) % 4) as Seat)).toBeNull();
    const applied = GuandanGame.applyAction(state, cutter, GuandanGame.defaultAction(state, cutter)!);
    expect(applied.ok).toBe(true);
    if (applied.ok) expect(applied.state.phase).toBe('playing');
  });

  it("the cut classes 'turn' and consumes NOBODY's planning window (items 2+3)", () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-timing');
    for (const s of [0, 1, 2, 3] as Seat[]) {
      expect(GuandanGame.timingClass!(state, s)).toBe('turn');
    }
    const cutter = state.ceremonyCut!.cutter;
    const applied = GuandanGame.applyAction(state, cutter, { type: 'cutDeck', position: 50 });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      // Post-deal: EVERY seat is planning — the cutter included.
      for (const s of [0, 1, 2, 3] as Seat[]) {
        expect(GuandanGame.timingClass!(applied.state, s)).toBe('planning');
      }
    }
  });

  it('validation: out-of-range / non-integer positions and wrong seats reject precisely', () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-validate');
    const cutter = state.ceremonyCut!.cutter;
    for (const bad of [0, CUT_MIN - 1, CUT_MAX + 1, 108, 54.5, NaN]) {
      const res = GuandanGame.applyAction(state, cutter, { type: 'cutDeck', position: bad });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('ceremony.invalidCutPosition');
    }
    const other = ((cutter + 1) % 4) as Seat;
    const wrongSeat = GuandanGame.applyAction(state, other, { type: 'cutDeck', position: 54 });
    expect(wrongSeat.ok).toBe(false);
    if (!wrongSeat.ok) expect(wrongSeat.error.code).toBe('action.notYourTurn');
    const wrongType = GuandanGame.applyAction(state, cutter, { type: 'pass' });
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.error.code).toBe('action.wrongPhase');
  });
});

describe('real cut — redaction (obligation 3: the deck is everyone\'s future hands)', () => {
  it('no view during ceremonyCut contains ANY card token; the cutter is public', () => {
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-redact');
    for (let seat = 0 as Seat; seat < 4; seat++) {
      const view = GuandanGame.playerView(state, seat);
      expect(view.ceremonyCutter).toBe(state.ceremonyCut!.cutter);
      expect(view.hand).toEqual([]);
      const json = JSON.stringify(view);
      // No concrete card identity may be derivable from any view while the
      // committed deck exists: match the card-token grammar exactly.
      expect(json).not.toMatch(/"[2-9TJQKA][SHCD]"/);
      expect(json).not.toMatch(/"SJ"|"BJ"/);
      expect(json).not.toContain('deck');
    }
  });

  it('obs 1: the cutter learns NO outcome pre-commit — no firstDrawer/markerSeat/flips/cutPosition', () => {
    // The fairness hard line behind obs 1: if the cutter could see who gets the
    // marker for a candidate position, they could slide until they liked it,
    // and the ceremony would be theatre. The outcome is a function of the
    // HIDDEN deck and is computed only at the cutDeck commit, so no view — the
    // cutter's included — may carry any outcome field while phase==='ceremonyCut'.
    const { state } = GuandanGame.init(DRAW_CFG, 4, 'cut-outcome-redact');
    const cutter = state.ceremonyCut!.cutter;
    const json = JSON.stringify(GuandanGame.playerView(state, cutter));
    // (not 'ceremonyCut' as a substring — the public 'ceremonyCutter' actor
    // field legitimately contains it; the KEY-level ceremonyCut/deck checks
    // live in obligations.property.test.ts checkViews.)
    for (const leak of ['firstDrawer', 'markerSeat', 'flips', 'cutPosition']) {
      expect(json, `cutter's ceremonyCut view must not carry '${leak}'`).not.toContain(leak);
    }
    // What it MAY carry: the public actor, nothing more outcome-bearing.
    expect(JSON.parse(json).ceremonyCutter).toBe(cutter);
  });

  it('the ceremonyCutStarted event is public and card-free for every seat', () => {
    const { events } = GuandanGame.init(DRAW_CFG, 4, 'cut-event-redact');
    const started = events.find((e) => e.type === 'ceremonyCutStarted')!;
    for (let seat = 0 as Seat; seat < 4; seat++) {
      const viewed = GuandanGame.viewEvent(started, seat, DRAW_CFG);
      expect(viewed).toEqual(started);
      expect(JSON.stringify(viewed)).not.toMatch(/"[2-9TJQKA][SHCD]"|"SJ"|"BJ"/);
    }
  });

  it('viewEvent keeps the post-cut ceremony public while redacting other hands', () => {
    const { handStarted } = runCut('cut-view', DRAW_CFG, 42);
    for (let seat = 0; seat < 4; seat++) {
      const viewed = GuandanGame.viewEvent(handStarted, seat, DRAW_CFG) as HandStarted;
      expect(viewed.ceremony).toEqual(handStarted.ceremony);
      for (let s = 0; s < 4; s++) {
        expect(viewed.hands[s]!).toEqual(s === seat ? handStarted.hands[s] : []);
      }
    }
  });

  it('obs 3: each seat is delivered EXACTLY its own cards in TRUE DEAL ORDER — no leak', () => {
    // The faithful-deal animation uses the order the server ALREADY sends: the
    // deal is unsorted (round-robin) in handStarted.hands, viewEvent redacts it
    // to the seat's own cards, and that is a permutation of the seat's sorted
    // hand — its own 27 and nothing from the other 81. Publishing per-seat deal
    // order leaks nothing (owner's argument, pinned continuously here).
    const key = (cards: readonly Card[]) => [...cards].sort().join(',');
    let anyUnsorted = false;
    for (let s = 0; s < 4; s++) {
      const { handStarted, state } = runCut(`obs3-${s}`, DRAW_CFG, DEFAULT_CUT_POSITION);
      for (let seat = 0; seat < 4; seat++) {
        const viewed = GuandanGame.viewEvent(handStarted, seat, DRAW_CFG) as HandStarted;
        const own = viewed.hands[seat]!;
        const sortedOwn = GuandanGame.playerView(state, seat as Seat).hand;
        // Exactly this seat's cards (same multiset as its sorted hand)…
        expect(key(own)).toBe(key(sortedOwn));
        expect(own).toHaveLength(27);
        // …and nothing from the other three seats.
        for (let other = 0; other < 4; other++) {
          if (other !== seat) expect(viewed.hands[other]!).toEqual([]);
        }
        // The delivered order is the DEAL order, not pre-sorted.
        if (own.join(',') !== [...own].sort().join(',')) anyUnsorted = true;
      }
    }
    // Across 16 seat views the dealt order is genuinely shuffled, never sorted
    // — proving the client is not being handed a fake "arrives sorted" order.
    expect(anyUnsorted, 'the delivered deal order must not be pre-sorted').toBe(true);
  });
});

describe('real cut — distribution and determinism', () => {
  it('leader is uniform over seats at a FIXED position: 25% ± 5% across 400 seeds', () => {
    const tally = [0, 0, 0, 0];
    const n = 400;
    for (let i = 0; i < n; i++) {
      const { state } = runCut(`cut-unif-${i}`, DRAW_CFG, DEFAULT_CUT_POSITION);
      tally[state.trick!.leader]!++;
    }
    for (const count of tally) {
      expect(count).toBeGreaterThanOrEqual(n * 0.2);
      expect(count).toBeLessThanOrEqual(n * 0.3);
    }
  });

  it('leader stays uniform when the position varies too (player-chosen cuts)', () => {
    const tally = [0, 0, 0, 0];
    const n = 400;
    for (let i = 0; i < n; i++) {
      const position = CUT_MIN + ((i * 13) % (CUT_MAX - CUT_MIN + 1));
      const { state } = runCut(`cut-unif-var-${i}`, DRAW_CFG, position);
      tally[state.trick!.leader]!++;
    }
    for (const count of tally) {
      expect(count).toBeGreaterThanOrEqual(n * 0.2);
      expect(count).toBeLessThanOrEqual(n * 0.3);
    }
  });

  it('same (seed, position) twice ⇒ identical ceremony, state and events', () => {
    const run = () => {
      const init = GuandanGame.init(DRAW_CFG, 4, 'cut-determinism');
      const cutter = init.state.ceremonyCut!.cutter;
      return GuandanGame.applyAction(init.state, cutter, { type: 'cutDeck', position: 31 });
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });

  it('a drawCard match (cut action included) replays bit-for-bit through the harness', () => {
    const rec = recordPlayout('cut-replay', DRAW_CFG, undefined, {
      maxActions: 20_000,
      stopAfterHands: 1,
    });
    // The very first logged action is the cut.
    expect((rec.artifact.actions[0]!.action as { type: string }).type).toBe('cutDeck');
    const result = replayMatch(rec.artifact, {
      snapshots: rec.states.map((state, seq) => ({ seq, state })),
    });
    expect(result.ok).toBe(true);
    expect(result.events).toEqual(rec.events);
  });
});

describe('real cut — scope (hand 1, drawCard only)', () => {
  it("absent under firstLeadMethod='random' (init deals directly)", () => {
    const { state, events } = GuandanGame.init(JIANGSU_OFFICIAL_ONLINE, 4, 'cut-absent-random');
    expect(state.phase).toBe('playing');
    expect(handStartedOf(events, 1).ceremony).toBeUndefined();
  });

  it("absent under firstLeadMethod='fixedSeat' (and seat 0 leads)", () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'fixedSeat' };
    const { state, events } = GuandanGame.init(config, 4, 'cut-absent-fixed');
    expect(state.phase).toBe('playing');
    expect(handStartedOf(events, 1).ceremony).toBeUndefined();
    expect(state.trick!.leader).toBe(0);
  });

  it('absent on hand 2+ even under drawCard (lead comes from tribute rules)', () => {
    const rec = recordPlayout('cut-hand2', DRAW_CFG, undefined, {
      maxActions: 20_000,
      stopAfterHands: 1,
    });
    const allEvents = rec.events.flat();
    expect(handStartedOf(allEvents, 1).ceremony).toBeDefined();
    expect(handStartedOf(allEvents, 2).ceremony).toBeUndefined();
  });
});

describe('real cut — clockwise turnDirection counts clockwise', () => {
  it('offset-1 final flip steps to the CLOCKWISE 下家, not the CCW one', () => {
    const { ceremony } = findCut('cw-one', CW_DRAW_CFG, (c) => {
      const last = lastFlipRank(c);
      return last !== null && (countOf(last) - 1) % 4 === 1;
    });
    expect(ceremony.firstDrawer).toBe(nextSeat(ceremony.cutter, CW_DRAW_CFG));
    expect(ceremony.firstDrawer).toBe((ceremony.cutter + 3) % 4);
    expect(ceremony.firstDrawer).not.toBe((ceremony.cutter + 1) % 4);
  });

  it('matches the oracle under clockwise config (sweep)', () => {
    for (let i = 0; i < 25; i++) {
      const seed = `cut-cw-oracle-${i}`;
      const position = CUT_MIN + ((i * 17) % (CUT_MAX - CUT_MIN + 1));
      const { ceremony } = runCut(seed, CW_DRAW_CFG, position);
      expect(ceremony).toEqual(oracleRitual(seed, position, CW_DRAW_CFG));
    }
  });
});

describe('registration', () => {
  it("the registry resolves 'guandan' to GuandanGame (M3 registration)", () => {
    expect(getGame('guandan')).toBe(GuandanGame);
  });
});
