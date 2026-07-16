// the draw ceremony (flip-to-lead) with a REAL cut (item 3; owner counting rule from M3 preserved;
// geometry REVERSED in the ceremony-marker round 2026-07-15). Hand 1 under
// firstLeadMethod='drawCard' OPENS in phase 'ceremonyCut': init commits a
// shuffled deck (hidden), the cutter picks a position, and the cutDeck
// action PRESERVES deck order and selects the revealed cards — the count
// card and the face-up marker at the cut depth. The cut moves WHO LEADS
// (genuine agency), never which cards a seat group holds (the round-1
// "changes every hand" claim is superseded — see the REVERSAL PIN below).
//
// Test strategy: an ORACLE reimplementation of the documented ritual (same
// PRNG setup as init — deck shuffle then cutter draw — then the pure deck
// arithmetic) lets us hunt (seed, position) pairs with specific outcomes
// and assert the engine bit-for-bit; plus the physical pins: the marker
// card REALLY lands in the leader's hand, and the cut depth REALLY moves
// the leader.

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, shuffle } from '../../../src/engine/core/prng';
import type { Seat } from '../../../src/engine/core/game';
import { CUT_MAX, CUT_MIN, DEFAULT_CUT_POSITION, GuandanGame } from '../../../src/engine/guandan';
import { buildDeck, isJoker, naturalValue, rankOf, type Card, type Rank } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import { nextSeat, partnerOf, teamOf, type GuandanEvent, type GuandanState } from '../../../src/engine/guandan/types';
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

/** The count-card slot for a cut at `position` (mirrors the engine): the
 *  lifted packet's bottom under the two-card form, the split card under the
 *  one-card form. */
function countIndexAt(position: number, config: RuleVariant): number {
  return config.ceremonyCardCount === 2 ? position - 1 : position;
}

function uncountable(card: Card): boolean {
  // Owner correction 2026-07-15: only jokers and the WILD (the HEART level
  // card) re-cut — other suits of the level rank COUNT. Hand 1 plays at
  // level 2, so the uncountables are exactly {SJ, BJ, 2H} (6 cards total).
  const r = rankOf(card);
  return r === null || card === '2H';
}

/** Oracle ritual over a POSITION SEQUENCE — the documented deck arithmetic,
 *  no PRNG, REVERSED GEOMETRY + RE-CUT LOOP (owner rules): each attempt
 *  flips the count card at its own cut; an uncountable flip (joker / level
 *  '2') means CUT AGAIN (the flip is recorded publicly); the first countable
 *  flip completes the ritual, with the marker at THAT final cut position.
 *  The deal runs over the UNROTATED deck from the first drawer, so deck
 *  index i lands at stepSeats(firstDrawer, i%4). Returns each flip's deck
 *  index so physical pins can locate the flips in the dealt hands, plus the
 *  attempts actually consumed. */
function oracleRitual(
  seed: string,
  positions: readonly number[],
  config: RuleVariant,
): Ceremony & { flipIndices: number[]; attemptsUsed: number } {
  const { deck, cutter } = oracleSetup(seed);
  const flips: Card[] = [];
  const flipIndices: number[] = [];
  let finalPosition: number | null = null;
  let counted: Rank | null = null;
  for (const position of positions) {
    const idx = countIndexAt(position, config);
    const card = deck[idx]!;
    flips.push(card);
    flipIndices.push(idx);
    if (!uncountable(card)) {
      counted = rankOf(card)!;
      finalPosition = position;
      break;
    }
  }
  if (counted === null || finalPosition === null) {
    throw new Error('oracleRitual: position sequence never reached a countable flip');
  }
  const firstDrawer = stepSeats(cutter, (countOf(counted) - 1) % 4, config);
  const markerDealIndex = finalPosition; // both forms: the FINAL cut position
  const marker = deck[markerDealIndex]!;
  const markerSeat = stepSeats(firstDrawer, markerDealIndex % 4, config);
  return {
    cutter,
    cutPosition: finalPosition,
    flips,
    marker,
    markerDealIndex,
    firstDrawer,
    markerSeat,
    flipIndices,
    attemptsUsed: flips.length,
  };
}

/** Engine-comparable projection (the ceremony payload has no flipIndices). */
function oracleCeremony(seed: string, positions: readonly number[], config: RuleVariant): Ceremony {
  const { flipIndices: _a, attemptsUsed: _b, ...ceremony } = oracleRitual(seed, positions, config);
  return ceremony;
}

/** The standard test cut policy: try `position`, then +1, +2, … (wrapping
 *  inside the legal band) until the ritual completes — every attempt is a
 *  REAL logged cutDeck action, exercising the re-cut loop when the first
 *  flip is uncountable. */
function positionSequence(position: number, step = 1): number[] {
  const range = CUT_MAX - CUT_MIN + 1;
  return Array.from({ length: 20 }, (_, k) => CUT_MIN + ((position - CUT_MIN + k * step) % range));
}

/** Drive the real thing through the LOOP: init → cutDeck (re-cutting on
 *  uncountable flips per the position sequence) → handStarted. */
function runCut(
  seed: string,
  config: RuleVariant,
  position: number = DEFAULT_CUT_POSITION,
  step = 1,
): {
  ceremony: Ceremony;
  state: GuandanState;
  initState: GuandanState;
  handStarted: HandStarted;
  cutsApplied: number;
} {
  const init = GuandanGame.init(config, 4, seed);
  expect(init.state.phase).toBe('ceremonyCut');
  const cutter = init.state.ceremonyCut!.cutter;
  let state = init.state;
  let cutsApplied = 0;
  for (const p of positionSequence(position, step)) {
    const res = GuandanGame.applyAction(state, cutter, { type: 'cutDeck', position: p });
    if (!res.ok) throw new Error(`cut rejected: ${res.error.code}`);
    cutsApplied++;
    state = res.state;
    if (state.phase !== 'ceremonyCut') {
      const handStarted = handStartedOf(res.events, 1);
      return { ceremony: handStarted.ceremony!, state, initState: init.state, handStarted, cutsApplied };
    }
  }
  throw new Error('runCut: loop never completed within the position sequence');
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
      const o = oracleCeremony(seed, positionSequence(p), config);
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

  it('oracle sweep: engine ceremony equals the documented arithmetic bit-for-bit (both forms)', () => {
    const ONE_CARD_CFG: RuleVariant = { ...DRAW_CFG, ceremonyCardCount: 1 };
    for (let i = 0; i < 40; i++) {
      const seed = `cut-oracle-${i}`;
      const position = CUT_MIN + ((i * 13) % (CUT_MAX - CUT_MIN + 1));
      expect(runCut(seed, DRAW_CFG, position).ceremony).toEqual(
        oracleCeremony(seed, positionSequence(position), DRAW_CFG),
      );
      expect(runCut(seed, ONE_CARD_CFG, position).ceremony).toEqual(
        oracleCeremony(seed, positionSequence(position), ONE_CARD_CFG),
      );
    }
  });

  it('two-card form: count card is the lifted packet bottom; marker is the table packet top', () => {
    // Direct geometry pin against the committed deck: the FIRST attempt's
    // flip = deck[initial-1]; the FINAL (countable) flip = deck[final-1];
    // marker = deck[final] — adjacent at the final split, order preserved.
    for (const position of [CUT_MIN, 15, 54, 87, CUT_MAX]) {
      const seed = `cut-geometry-${position}`;
      const { deck } = oracleSetup(seed);
      const { ceremony } = runCut(seed, DRAW_CFG, position);
      expect(ceremony.flips[0]).toBe(deck[position - 1]);
      const final = ceremony.cutPosition;
      expect(ceremony.flips[ceremony.flips.length - 1]).toBe(deck[final - 1]);
      expect(ceremony.marker).toBe(deck[final]);
      expect(ceremony.markerDealIndex).toBe(final);
    }
  });

  it('one-card form: the counted card IS the marker (one card, two jobs)', () => {
    const ONE_CARD_CFG: RuleVariant = { ...DRAW_CFG, ceremonyCardCount: 1 };
    for (const position of [CUT_MIN, 33, CUT_MAX]) {
      const seed = `cut-oneform-${position}`;
      const { ceremony } = runCut(seed, ONE_CARD_CFG, position);
      expect(ceremony.marker).toBe(ceremony.flips[ceremony.flips.length - 1]);
    }
  });
});

describe('the RE-CUT loop (owner rule 2026-07-15, superseding the count walk)', () => {
  /** Hunt a (seed, position) whose FIRST flip is uncountable — a real
   *  re-cut case, deterministically. */
  function findRecut(tag: string): { seed: string; position: number } {
    for (let i = 0; i < 300; i++) {
      const seed = `recut-${tag}-${i}`;
      const { deck } = oracleSetup(seed);
      for (let p = CUT_MIN; p <= CUT_MAX; p += 3) {
        if (uncountable(deck[countIndexAt(p, DRAW_CFG)]!)) return { seed, position: p };
      }
    }
    throw new Error('findRecut: none found (statistically impossible)');
  }

  it('an uncountable flip stays in ceremonyCut, records the PUBLIC flip, and bumps attempts', () => {
    const { seed, position } = findRecut('stay');
    const init = GuandanGame.init(DRAW_CFG, 4, seed);
    const cutter = init.state.ceremonyCut!.cutter;
    const res = GuandanGame.applyAction(init.state, cutter, { type: 'cutDeck', position });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.phase).toBe('ceremonyCut');
    expect(res.state.ceremonyCut!.attempts).toBe(1);
    expect(res.state.ceremonyCut!.flips).toHaveLength(1);
    expect(res.events).toHaveLength(1);
    const ev = res.events[0]!;
    expect(ev.type).toBe('ceremonyCutFlipped');
    if (ev.type === 'ceremonyCutFlipped') {
      expect(ev.position).toBe(position);
      expect(uncountable(ev.flip)).toBe(true);
      // Public in full: every seat receives the identical event.
      for (let s = 0 as Seat; s < 4; s++) {
        expect(GuandanGame.viewEvent(ev, s, DRAW_CFG)).toEqual(ev);
      }
      // And the view carries EXACTLY that flip (resync-visible), no more.
      for (let s = 0 as Seat; s < 4; s++) {
        const view = GuandanGame.playerView(res.state, s);
        expect(view.ceremonyFlips).toEqual([ev.flip]);
        const json = JSON.stringify({ ...view, ceremonyFlips: [] });
        expect(json).not.toMatch(/"[2-9TJQKA][SHCD]"|"SJ"|"BJ"/);
      }
    }
    // The cutter is STILL the only actor, with the full legal set again.
    expect(GuandanGame.expectedActors(res.state)).toEqual([cutter]);
    expect(GuandanGame.legalActions(res.state, cutter)).toHaveLength(CUT_MAX - CUT_MIN + 1);
  });

  it('a re-cut re-picks the marker too (one physical act): the final cut decides both cards', () => {
    const { seed, position } = findRecut('repick');
    const { ceremony, cutsApplied } = runCut(seed, DRAW_CFG, position);
    expect(cutsApplied).toBeGreaterThanOrEqual(2);
    expect(ceremony.cutPosition).not.toBe(position);
    const { deck } = oracleSetup(seed);
    expect(ceremony.marker).toBe(deck[ceremony.cutPosition]);
    // All attempt flips appear, in order; only the last is countable.
    expect(ceremony.flips.length).toBe(cutsApplied);
    for (const flip of ceremony.flips.slice(0, -1)) expect(uncountable(flip)).toBe(true);
    expect(uncountable(ceremony.flips[ceremony.flips.length - 1]!)).toBe(false);
  });

  it('AFK termination bound: the varying default cut completes within 7 alarm cuts, every seed', () => {
    // The deck is fixed, so a CONSTANT default would flip the same
    // uncountable card forever; the default walks one position per attempt,
    // and a double deck holds only 6 uncountables (4 jokers + 2 heart level
    // cards — owner correction), so any 7 distinct count slots contain a
    // countable card. Sweep: simulate a fully-AFK cutter (defaultAction
    // only) across 200 seeds.
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const init = GuandanGame.init(DRAW_CFG, 4, `recut-afk-${i}`);
      const cutter = init.state.ceremonyCut!.cutter;
      let state = init.state;
      let cuts = 0;
      while (state.phase === 'ceremonyCut') {
        const def = GuandanGame.defaultAction(state, cutter);
        expect(def).not.toBeNull();
        const res = GuandanGame.applyAction(state, cutter, def!);
        expect(res.ok).toBe(true);
        if (!res.ok) break;
        state = res.state;
        cuts++;
        expect(cuts).toBeLessThanOrEqual(7);
      }
      worst = Math.max(worst, cuts);
    }
    expect(worst).toBeGreaterThanOrEqual(1);
  });

  it('the default position VARIES with attempts (the constant-default alarm loop is closed)', () => {
    const { seed, position } = findRecut('default-varies');
    const init = GuandanGame.init(DRAW_CFG, 4, seed);
    const cutter = init.state.ceremonyCut!.cutter;
    const before = GuandanGame.defaultAction(init.state, cutter);
    const res = GuandanGame.applyAction(init.state, cutter, { type: 'cutDeck', position });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    if (res.state.phase !== 'ceremonyCut') return; // hunted to be a re-cut; defensive
    const after = GuandanGame.defaultAction(res.state, cutter);
    expect(after).not.toEqual(before);
  });

  it('replay reproduces the WHOLE cut sequence from the log (re-cut included)', () => {
    // Drive a real multi-cut opening through the recording harness by
    // replaying the exact action list against a fresh init.
    const { seed, position } = findRecut('replay');
    const first = runCut(seed, DRAW_CFG, position);
    expect(first.cutsApplied).toBeGreaterThanOrEqual(2);
    const rerun = runCut(seed, DRAW_CFG, position);
    expect(rerun.ceremony).toEqual(first.ceremony);
    expect(rerun.state).toEqual(first.state);
  });
});

describe('real cut — the physical pins (reversed geometry: the cut moves the LEADER, not the cards)', () => {
  it("the marker card REALLY lands in the leader's hand (the marker card lands in that seat)", () => {
    for (let i = 0; i < 15; i++) {
      const position = CUT_MIN + ((i * 11) % (CUT_MAX - CUT_MIN + 1));
      const { ceremony, state } = runCut(`cut-marker-${i}`, DRAW_CFG, position);
      expect(state.hands[ceremony.markerSeat]!).toContain(ceremony.marker);
      expect(state.trick!.leader).toBe(ceremony.markerSeat);
      expect(state.trick!.toAct).toBe(ceremony.markerSeat);
    }
  });

  it('every flip lands at its deck-index-derivable seat (the flips are REAL deal cards)', () => {
    const found = findCut('flips-land', DRAW_CFG, (c) => c.flips.length >= 2);
    const oracle = oracleRitual(found.seed, positionSequence(found.position), DRAW_CFG);
    oracle.flips.forEach((flip, i) => {
      const seat = stepSeats(oracle.firstDrawer, oracle.flipIndices[i]! % 4, DRAW_CFG);
      expect(found.state.hands[seat]!, `flip ${i} (${flip}) lands at seat ${seat}`).toContain(flip);
    });
  });

  it('THE DEFECT REGRESSION: markerSeat is NOT pinned to firstDrawer — the cut depth moves it', () => {
    // The 2026-07-15 owner finding: the old model put the marker at deal
    // index flips.length-1 (≈0), so the first drawer always drew it and the
    // ceremony was deterministic ~89% of the time (count reaches/the marker card lands in/that seat leads
    // collapsed onto ONE seat). Now the marker sits at the cut depth:
    // markerSeat = stepSeats(firstDrawer, markerDealIndex % 4). Pins:
    // (a) the equation holds everywhere; (b) both markerSeat === firstDrawer
    // and ≠ occur (hunted deterministically); (c) across a sweep, the
    // non-collapsed cases are the MAJORITY (~75% expected: position % 4 ≠ 0).
    let differs = 0;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const position = CUT_MIN + ((i * 11) % (CUT_MAX - CUT_MIN + 1));
      const { ceremony } = runCut(`cut-defect-${i}`, DRAW_CFG, position);
      expect(ceremony.markerSeat).toBe(
        stepSeats(ceremony.firstDrawer, ceremony.markerDealIndex % 4, DRAW_CFG),
      );
      if (ceremony.markerSeat !== ceremony.firstDrawer) differs++;
    }
    expect(differs).toBeGreaterThanOrEqual(n * 0.4); // the old model scored ~11%
    findCut('marker-differs', DRAW_CFG, (c) => c.markerSeat !== c.firstDrawer);
    findCut('marker-same', DRAW_CFG, (c) => c.markerSeat === c.firstDrawer);
  });

  it('REVERSAL PIN (supersedes the round-1 agency pin): the cut NEVER changes which cards a seat group holds', () => {
    // Owner decision 2026-07-15: the physical act preserves deck order — the
    // cut selects the revealed cards and the leader, never the hands. The
    // prior claim "a different position REALLY changes every hand" is
    // superseded (STATUS process entry). The four residue-class card GROUPS
    // are invariant across positions; only their seat ASSIGNMENT (via
    // firstDrawer) and the leader move.
    const groupsOf = (state: GuandanState) =>
      state.hands
        .map((h) => [...h].sort().join(','))
        .sort();
    const a = runCut('cut-agency', DRAW_CFG, 20);
    const b = runCut('cut-agency', DRAW_CFG, 80);
    expect(groupsOf(a.state)).toEqual(groupsOf(b.state));
    // And the leader genuinely varies across depths for this same seed.
    const leaders = new Set([20, 21, 22, 23].map((p) => runCut('cut-agency', DRAW_CFG, p).state.trick!.leader));
    expect(leaders.size).toBeGreaterThan(1);
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
      expect(isJoker(flip) || flip === '2H', `re-cut cause: ${flip}`).toBe(true);
    }
    const last = ceremony.flips[ceremony.flips.length - 1]!;
    expect(isJoker(last)).toBe(false);
    expect(last).not.toBe('2H'); // a NON-heart 2 counts (owner correction)
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

  it('THE STATED EXCEPTION (owner 2026-07-15): exactly flips ∪ {marker} are public, the rest unreachable', () => {
    // The blanket "no card token" rule has precisely these intentional
    // exceptions — the table watched these cards. For every seat, the card
    // tokens visible OUTSIDE its own hand must equal flips ∪ {marker}:
    // nothing else from the other ~106 cards is reachable, and the exception
    // is deliberate, not accidentally un-caught.
    const tokenSet = (json: string): Set<string> => {
      const out = new Set<string>();
      for (const m of json.matchAll(/"([2-9TJQKA][SHCD]|SJ|BJ)"/g)) out.add(m[1]!);
      return out;
    };
    for (const position of [CUT_MIN, 42, CUT_MAX]) {
      const { handStarted } = runCut(`cut-exception-${position}`, DRAW_CFG, position);
      const ceremony = handStarted.ceremony!;
      const allowed = new Set<string>([...ceremony.flips, ceremony.marker]);
      for (let seat = 0 as Seat; seat < 4; seat++) {
        const viewed = GuandanGame.viewEvent(handStarted, seat, DRAW_CFG) as HandStarted;
        const withoutOwnHand = { ...viewed, hands: viewed.hands.map(() => []) };
        const visible = tokenSet(JSON.stringify(withoutOwnHand));
        expect([...visible].sort(), `seat ${seat} @ cut ${position}`).toEqual([...allowed].sort());
        // NOTE: token identity is rank+suit, but every rank+suit has a TWIN
        // in a double deck — the exception set is small, so a twin collision
        // reveals only "one of the two instances", exactly as at the table.
        // The MARKER itself is identified positionally (markerDealIndex),
        // never by rank — the two-deck instance rule.
        expect(typeof ceremony.markerDealIndex).toBe('number');
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

  it('CONDITIONAL (non-)uniformity, measured: the cut depth residue carries the documented edge', () => {
    // Owner finding 2026-07-15, MEASURED AND DOCUMENTED — deliberately NOT
    // fixed (the physical table has the identical property). The absolute
    // sweeps below stay uniform because the cutter is PRNG-uniform; this test
    // conditions on the cutter and shows what they cannot: the count offset
    // X=(value-1)%4 at level 2 (hand 1 ALWAYS runs at level 2; heart-only
    // wilds excluded per the owner correction) is skewed — the 102 countable
    // cards by offset: 0:{A,5,9,K}=32 1:{2(6 non-heart),6,10}=22
    // 2:{3,7,J}=24 3:{4,8,Q}=24 — so P(X even)=56/102≈54.9% and a cutter
    // picking an EVEN depth leads their own team ≈54.9% vs ≈45.1% at an ODD
    // depth: a ≈9.8pt swing chosen by the cutter.
    const N = 500;
    const teamLead = { even: 0, odd: 0 };
    let sampled = 0;
    for (let i = 0; sampled < N && i < N * 8; i++) {
      const seed = `cut-cond-${i}`;
      // Condition on the cutter WITHOUT biasing the deck: only the seed's
      // cutter draw decides inclusion.
      if (oracleSetup(seed).cutter !== 0) continue;
      sampled++;
      const cutterTeam = teamOf(0);
      const even = runCut(seed, DRAW_CFG, 54); // 54 % 4 = 2 (even offset added)
      if (teamOf(even.state.trick!.leader) === cutterTeam) teamLead.even++;
      const odd = runCut(seed, DRAW_CFG, 55); // 55 % 4 = 3 (odd)
      if (teamOf(odd.state.trick!.leader) === cutterTeam) teamLead.odd++;
    }
    expect(sampled).toBe(N);
    // Expected: even ≈ 56/102 ≈ 54.9%, odd ≈ 46/102 ≈ 45.1%. ±6pt at N=500.
    expect(teamLead.even / N).toBeGreaterThan(56 / 102 - 0.06);
    expect(teamLead.even / N).toBeLessThan(56 / 102 + 0.06);
    expect(teamLead.odd / N).toBeGreaterThan(46 / 102 - 0.06);
    expect(teamLead.odd / N).toBeLessThan(46 / 102 + 0.06);
    // The edge itself: even-depth minus odd-depth own-team lead ≈ 9.8pt.
    expect(teamLead.even / N - teamLead.odd / N).toBeGreaterThan(0.03);
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
  it('offset-1 final flip steps to the CLOCKWISE the next seat (in turn direction), not the CCW one', () => {
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
      expect(ceremony).toEqual(oracleCeremony(seed, positionSequence(position), CW_DRAW_CFG));
    }
  });
});

describe('registration', () => {
  it("the registry resolves 'guandan' to GuandanGame (M3 registration)", () => {
    expect(getGame('guandan')).toBe(GuandanGame);
  });
});

describe('superseded-model prose pin (panel catch, ceremony-marker round)', () => {
  it('no source prose re-asserts the rotated-deck / collapsed-marker / unqualified-uniformity model', () => {
    // The panel found the reversed geometry landed while six comments still
    // described the OLD model. Per the ratchet, the drift class is pinned:
    // these exact superseded phrases may not reappear (dated references to
    // the defect/supersession use different wording and stay legal).
    const files = [
      'src/engine/guandan/index.ts',
      'src/engine/guandan/types.ts',
      'src/client/table/DealOverlay.tsx',
      'src/client/table/deal.ts',
      'src/client/table/cut.ts',
      'src/client/table/CutPanel.tsx',
      'tests/unit/engine/ceremony.test.ts',
      'tests/e2e/guandan.e2e.test.ts',
      'tests/e2e/product-paths.e2e.test.ts',
    ];
    const forbidden = [
      'rotates the deck at',
      'changes both the flips and every hand',
      'the deck will rotate',
      'REALLY changes the hands',
      'hidden + uniform',
      'the first leader is uniform)',
      'count walk skips',
      "the walk's last flip",
      'walks below are total',
      '=7/12',
      '12 uncountables',
      'only 12 uncountable',
      'flies at its\n// TRUE beat (flips.length',
    ];
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    for (const file of files) {
      const text = readFileSync(join(__dirname, '../../..', file), 'utf8');
      for (const phrase of forbidden) {
        // This test file legitimately QUOTES the phrases inside this very
        // string array; exclude the array block itself by checking count.
        const hits = text.split(phrase).length - 1;
        const allowance = file.endsWith('ceremony.test.ts') ? 1 : 0;
        expect(hits, `"${phrase}" in ${file}`).toBeLessThanOrEqual(allowance);
      }
    }
  });
});
