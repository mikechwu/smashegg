// The OWNER'S six pinned house rules (docs/rules/guandan.md v1.3, round-3
// sign-off) as engine-level named tests. Every scenario drives
// GuandanGame.applyAction through the public GameDefinition interface;
// constructed GuandanState literals force near-end situations that would
// take thousands of random actions to reach organically. Each constructed
// state documents its intent inline. Determinism: every PRNG is seeded with
// a string literal; no Math.random anywhere.
//
// NOTE on constructed hands: the engine never audits that the four hands
// form a legal 108-card partition mid-hand (dealing is init's job), so the
// tiny 1–3-card hands below are legitimate scenario setups — they exercise
// exactly the finish-order / scoring / tribute paths the house rules pin.

import { describe, expect, it } from 'vitest';
import type { Seat } from '../../../src/engine/core/game';
import { seedPrng, shuffle } from '../../../src/engine/core/prng';
import { GuandanGame } from '../../../src/engine/guandan';
import { buildDeck, type Card, type Rank } from '../../../src/engine/guandan/cards';
import { classifyPlays, validatePlay } from '../../../src/engine/guandan/combos';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import { legalPlays } from '../../../src/engine/guandan/generate';
import type {
  GuandanAction,
  GuandanEvent,
  GuandanState,
  TributeState,
} from '../../../src/engine/guandan/types';

// Owner defaults, exactly as pinned: aFailConsequence='suspendPlayOpponentLevel',
// aMaxAttempts=3, aAttemptCounterReset='fresh', overshootWinsGame=false,
// aWinPartnerNotLast=true, returnTributeMaxRank=10, jiefengRecipient='partner'.
const CFG: RuleVariant = JIANGSU_OFFICIAL_ONLINE;

type Hands = [Card[], Card[], Card[], Card[]];

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------

/** A playing-phase state with an open trick (leader to act, no top play).
 *  All house-rule scenarios start from here and are then DRIVEN through
 *  GuandanGame.applyAction — the constructed part is only "who holds what
 *  and whose level is it". */
function playingState(opts: {
  currentLevel: Rank;
  levels: [Rank, Rank];
  declarerTeam: 0 | 1 | null;
  hands: Hands;
  leader: Seat;
  aAttempts?: [number, number];
  aAttemptsExhausted?: [boolean, boolean];
  seed: string;
  config?: RuleVariant;
}): GuandanState {
  return {
    config: opts.config ?? CFG,
    prng: seedPrng(opts.seed),
    handNo: 1,
    phase: 'playing',
    actedThisHand: [false, false, false, false],
    ceremonyCut: null,
    levels: opts.levels,
    aAttempts: opts.aAttempts ?? [0, 0],
    aAttemptsExhausted: opts.aAttemptsExhausted ?? [false, false],
    currentLevel: opts.currentLevel,
    declarerTeam: opts.declarerTeam,
    hands: opts.hands,
    finishOrder: [],
    trick: { leader: opts.leader, toAct: opts.leader, top: null, jiefengTo: null },
    tribute: null,
    prevFinishOrder: null,
    antiTributePending: null,
    firstFinisherAllAces: null,
    matchWinner: null,
  };
}

/** A tribute-phase state (single tribute: payer = previous 末游, receiver =
 *  previous 头游) so the tribute/return choice machinery runs for real. */
function tributeState(opts: {
  currentLevel: Rank;
  levels: [Rank, Rank];
  declarerTeam: 0 | 1;
  hands: Hands;
  payer: Seat;
  receiver: Seat;
  prevFinishOrder: Seat[];
  seed: string;
}): GuandanState {
  const tribute: TributeState = {
    kind: 'single',
    payers: [opts.payer],
    receivers: [opts.receiver],
    staged: {},
    paid: null,
    returnsStaged: {},
    returned: null,
    leader: null,
  };
  return {
    config: CFG,
    prng: seedPrng(opts.seed),
    handNo: 2,
    phase: 'tribute',
    actedThisHand: [false, false, false, false],
    ceremonyCut: null,
    levels: opts.levels,
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    currentLevel: opts.currentLevel,
    declarerTeam: opts.declarerTeam,
    hands: opts.hands,
    finishOrder: [],
    trick: null,
    tribute,
    prevFinishOrder: opts.prevFinishOrder,
    antiTributePending: null,
    firstFinisherAllAces: null,
    matchWinner: null,
  };
}

/** applyAction that must succeed — failures name the rejected action. */
function mustApply(
  state: GuandanState,
  seat: Seat,
  action: GuandanAction,
): { state: GuandanState; events: GuandanEvent[] } {
  const res = GuandanGame.applyAction(state, seat, action);
  if (!res.ok) {
    throw new Error(
      `applyAction rejected ${JSON.stringify(action)} for seat ${seat}: ${res.error.code}`,
    );
  }
  return { state: res.state, events: res.events };
}

/** Lead/follow with a single card (all scenario plays are natural singles,
 *  which have exactly one canonical interpretation — decl given anyway). */
function playSingle(state: GuandanState, seat: Seat, card: Card) {
  const rank = card[0] as Rank;
  return mustApply(state, seat, {
    type: 'play',
    cards: [card],
    decl: { type: 'single', size: 1, keyRank: rank },
  });
}

function pass(state: GuandanState, seat: Seat) {
  return mustApply(state, seat, { type: 'pass' });
}

function findEvent<T extends GuandanEvent['type']>(
  events: GuandanEvent[],
  type: T,
): Extract<GuandanEvent, { type: T }> {
  const found = events.find((e) => e.type === type);
  if (!found) throw new Error(`expected a '${type}' event, got: ${events.map((e) => e.type).join(', ')}`);
  return found as Extract<GuandanEvent, { type: T }>;
}

// ---------------------------------------------------------------------------
// 1. A-win patterns (spec §6.4, aWinPartnerNotLast=true)
// ---------------------------------------------------------------------------

describe('house rule 1: winning the match at A (1-2 / 1-3 yes, 1-4 no)', () => {
  it('house: 1-2 at A wins the match', () => {
    // Team 0 declares at its own A. Seats 0 and 2 each hold one card and can
    // finish 1st and 2nd (双上) in two plays: 0 leads 2S, 1 passes, 2 beats
    // with 5S and empties — finishOrder [0,2], teammates ⇒ hand over, 1-2.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '2'],
      declarerTeam: 0,
      hands: [['2S'], ['3C', '4C'], ['5S'], ['6D', '7D']],
      leader: 0,
      seed: 'house-1-2-at-A',
    });
    s = playSingle(s, 0, '2S').state;
    s = pass(s, 1).state;
    const last = playSingle(s, 2, '5S');
    s = last.state;

    expect(findEvent(last.events, 'matchEnded').winnerTeam).toBe(0);
    expect(s.phase).toBe('matchEnd');
    expect(s.matchWinner).toBe(0);
    // Levels untouched by the winning hand: A is passed, not exceeded.
    expect(s.levels).toEqual(['A', '2']);
    expect(GuandanGame.isTerminal(s)).toBe(true);
    expect(GuandanGame.result(s)).toEqual({
      standings: [
        { rank: 1, seats: [0, 2] },
        { rank: 2, seats: [1, 3] },
      ],
      summary: { levels: ['A', '2'], hands: 1 },
    });
  });

  it('house: 1-3 at A wins the match', () => {
    // Team 0 declares at A; finish order forced to [0, 1, 2]: seat 0 out
    // first, opponent seat 1 second, partner seat 2 third — a 1-3.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '2'],
      declarerTeam: 0,
      hands: [['2S'], ['5S'], ['7S'], ['3D', '4D']],
      leader: 0,
      seed: 'house-1-3-at-A',
    });
    s = playSingle(s, 0, '2S').state;
    s = playSingle(s, 1, '5S').state; // seat 1 empties → 2nd finisher
    const last = playSingle(s, 2, '7S'); // seat 2 empties → 3rd ⇒ hand ends
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.result.levelDelta).toBe(2); // 1-3
    expect(findEvent(last.events, 'matchEnded').winnerTeam).toBe(0);
    expect(s.matchWinner).toBe(0);
    expect(s.levels).toEqual(['A', '2']);
  });

  it('house: 1-4 at A does NOT win and grants no level', () => {
    // Team 0 declares at A but its partner (seat 2) never finishes: order
    // forced to [0, 1, 3] — seat 2 is 末游, a 1-4. No match win, no level;
    // per §6.4 the hand consumes one A-attempt.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '2'],
      declarerTeam: 0,
      hands: [['2S'], ['5S'], ['3C', '4C', '8C'], ['7S']],
      leader: 0,
      seed: 'house-1-4-at-A',
    });
    s = playSingle(s, 0, '2S').state;
    s = playSingle(s, 1, '5S').state; // 2nd finisher (opponent)
    s = pass(s, 2).state;
    const last = playSingle(s, 3, '7S'); // 3rd finisher ⇒ hand ends, seat 2 last
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.result.levelDelta).toBe(1); // 1-4
    expect(handEnded.newLevels).toEqual(['A', '2']); // no level granted at the A cap
    expect(last.events.some((e) => e.type === 'matchEnded')).toBe(false);
    expect(s.matchWinner).toBeNull();
    expect(s.phase).not.toBe('matchEnd');
    expect(s.levels).toEqual(['A', '2']);
    expect(s.aAttempts).toEqual([1, 0]); // failed attempt counted
    // Winner team 0 declares the next hand — still its own A.
    expect(s.handNo).toBe(2);
    expect(s.declarerTeam).toBe(0);
    expect(s.currentLevel).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// 2. Overshoot clamp (spec §6.3, overshootWinsGame=false)
// ---------------------------------------------------------------------------

describe('house rule 2: K+3 clamps to A', () => {
  it('house: K+3 clamps to A (overshootWinsGame=false)', () => {
    // Team 0 at K wins 双上 (+3) — raw target K+3 overshoots A. Owner pin:
    // land exactly at A, no match win.
    let s = playingState({
      currentLevel: 'K',
      levels: ['K', '2'],
      declarerTeam: 0,
      hands: [['2S'], ['3C', '4C'], ['7S'], ['6D', '8D']],
      leader: 0,
      seed: 'house-K-plus-3',
    });
    s = playSingle(s, 0, '2S').state;
    s = pass(s, 1).state;
    const last = playSingle(s, 2, '7S'); // [0,2] teammates ⇒ 双上, +3
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.result.levelDelta).toBe(3);
    expect(handEnded.newLevels).toEqual(['A', '2']); // clamped, not past A
    expect(last.events.some((e) => e.type === 'matchEnded')).toBe(false);
    expect(s.matchWinner).toBeNull();
    expect(s.levels).toEqual(['A', '2']);
    // Next hand is team 0's first genuine A attempt.
    expect(findEvent(last.events, 'handStarted').currentLevel).toBe('A');
    expect(s.currentLevel).toBe('A');
    expect(s.aAttempts).toEqual([0, 0]); // the exhausting counter has not started
  });
});

// ---------------------------------------------------------------------------
// 3. Suspension lifecycle (aFailConsequence='suspendPlayOpponentLevel',
//    aMaxAttempts=3, aAttemptCounterReset='fresh' — spec §1.5/§6.4)
// ---------------------------------------------------------------------------

describe('house rule 3: A-attempt suspension lifecycle', () => {
  it('house: 3rd failed A-attempt sets suspension, level stays A', () => {
    // Team 0 declares its own A with 2 failed attempts already on the
    // counter. Opponents (seats 1+3) win 双上 in two plays: 1 leads 2C,
    // 2 passes, 3 beats with 6C and empties — team 0's 3rd failure.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '2'],
      declarerTeam: 0,
      aAttempts: [2, 0],
      hands: [['3S', '4S'], ['2C'], ['5D', '7D'], ['6C']],
      leader: 1,
      seed: 'house-suspend-3rd-fail',
    });
    s = playSingle(s, 1, '2C').state;
    s = pass(s, 2).state;
    const last = playSingle(s, 3, '6C'); // [1,3] teammates ⇒ 双上 for team 1
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.aAttempts).toEqual([3, 0]);
    expect(handEnded.aAttemptsExhausted).toEqual([true, false]); // suspension set
    // Owner rule: NEVER demoted — team 0's level stays at A.
    expect(s.levels).toEqual(['A', '5']); // team 1: 2+3=5; team 0 untouched
    expect(s.aAttemptsExhausted).toEqual([true, false]);
    expect(s.matchWinner).toBeNull();
    // Team 1 declares the next hand at its own 5 — plain §1.5, no override.
    expect(findEvent(last.events, 'handStarted').suspensionApplied).toBe(false);
    expect(s.currentLevel).toBe('5');
  });

  it("house: suspended declarer's next hand plays at opponents' level (handStarted.suspensionApplied=true, currentLevel=opponents')", () => {
    // The distinctive owner case: team 0's 3rd failure is a 1-4 HAND WIN
    // (order [0,1,3], partner 2 last). Team 0 wins the hand, so it declares
    // next — but the just-set suspension overrides §1.5: the next hand is
    // played at the opponents' level (5), flagged suspensionApplied.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '5'],
      declarerTeam: 0,
      aAttempts: [2, 0],
      hands: [['2S'], ['5S'], ['3C', '4C', '8C'], ['7S']],
      leader: 0,
      seed: 'house-suspended-declarer',
    });
    s = playSingle(s, 0, '2S').state;
    s = playSingle(s, 1, '5S').state;
    s = pass(s, 2).state;
    const last = playSingle(s, 3, '7S'); // [0,1,3] ⇒ team 0 wins 1-4
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.result.levelDelta).toBe(1); // 1-4: attempt failed
    expect(handEnded.aAttempts).toEqual([3, 0]);
    expect(handEnded.aAttemptsExhausted).toEqual([true, false]);
    const handStarted = findEvent(last.events, 'handStarted');
    expect(handStarted.declarerTeam).toBe(0); // team 0 won ⇒ declares
    expect(handStarted.suspensionApplied).toBe(true); // the §1.5 override
    expect(handStarted.currentLevel).toBe('5'); // opponents' level, not A
    expect(s.currentLevel).toBe('5');
    expect(s.levels).toEqual(['A', '5']); // never demoted
    expect(s.matchWinner).toBeNull();
  });

  it("house: suspended team's hand win clears the flag and the following hand plays at A again", () => {
    // Suspended team 0 declares a hand played at the opponents' level 5
    // (i.e. the state the previous test produced). Team 0 wins it 双上 —
    // which must NOT win the match (this is the opponents' 5, not an A
    // attempt), must clear the suspension, and the following hand — still
    // declared by team 0 — is back at A.
    let s = playingState({
      currentLevel: '5',
      levels: ['A', '5'],
      declarerTeam: 0,
      aAttempts: [3, 0],
      aAttemptsExhausted: [true, false],
      hands: [['2S'], ['3C', '4C'], ['7S'], ['6D', '8D']],
      leader: 0,
      seed: 'house-suspension-clears',
    });
    s = playSingle(s, 0, '2S').state;
    s = pass(s, 1).state;
    const last = playSingle(s, 2, '7S'); // [0,2] ⇒ team 0 wins 双上
    s = last.state;

    expect(last.events.some((e) => e.type === 'matchEnded')).toBe(false); // not an A win
    expect(s.matchWinner).toBeNull();
    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.aAttemptsExhausted).toEqual([false, false]); // flag cleared
    expect(handEnded.newLevels).toEqual(['A', '5']); // at A: no further upgrade
    const handStarted = findEvent(last.events, 'handStarted');
    expect(handStarted.declarerTeam).toBe(0);
    expect(handStarted.currentLevel).toBe('A'); // resumed attempting A
    expect(handStarted.suspensionApplied).toBe(false);
    expect(s.aAttemptsExhausted).toEqual([false, false]);
    expect(s.aAttempts).toEqual([0, 0]); // aAttemptCounterReset='fresh'
  });

  it('house: resumed attempt window counts fresh from 0', () => {
    // Post-resumption state: team 0 back at its own A with the counter
    // freshly reset to 0 (exactly what the previous test's clear produced).
    // One more failed attempt must count 1 — NOT re-trigger exhaustion.
    let s = playingState({
      currentLevel: 'A',
      levels: ['A', '5'],
      declarerTeam: 0,
      aAttempts: [0, 0], // fresh window after resumption
      aAttemptsExhausted: [false, false],
      hands: [['3S', '4S'], ['2C'], ['5D', '7D'], ['6C']],
      leader: 1,
      seed: 'house-fresh-counter',
    });
    s = playSingle(s, 1, '2C').state;
    s = pass(s, 2).state;
    const last = playSingle(s, 3, '6C'); // opponents 双上 ⇒ team 0's attempt fails
    s = last.state;

    const handEnded = findEvent(last.events, 'handEnded');
    expect(handEnded.aAttempts).toEqual([1, 0]); // fresh count: 1, not 4
    expect(handEnded.aAttemptsExhausted).toEqual([false, false]); // no re-suspension
    expect(s.levels).toEqual(['A', '8']); // team 1: 5+3=8; team 0 stays at A
    expect(s.matchWinner).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Return tribute: levelValue ≤ 10 (spec §7.4, returnTributeMaxRank=10)
// ---------------------------------------------------------------------------

describe('house rule 4: return tribute levelValue ≤ 10', () => {
  it('house: return tribute at level T excludes the T (levelValue ≤ 10 semantics)', () => {
    // Real single-tribute phase at level T (previous order [0,1,2,3]: 末游
    // seat 3 pays 头游 seat 0). Seat 0's hand mixes T cards (levelValue 15
    // — face value ≤ 10 but ELEVATED, the exact trap the owner pinned),
    // 9s (returnable), and J/K (> 10). Wild is TH — deliberately absent.
    let s = tributeState({
      currentLevel: 'T',
      levels: ['T', '2'],
      declarerTeam: 0,
      hands: [
        ['TS', 'TC', '9S', '9H', '5C', 'JS', 'KD', '2H'], // receiver (头游)
        ['3C', '4C'],
        ['3D', '4D'],
        ['AS', 'AC', '2S', '3S'], // payer (末游): forced rank A
      ],
      payer: 3,
      receiver: 0,
      prevFinishOrder: [0, 1, 2, 3],
      seed: 'house-return-at-T',
    });

    // Payer's eligible set is every copy at the forced rank (choice, §7.2).
    expect(GuandanGame.legalActions(s, 3)).toEqual([
      { type: 'payTribute', card: 'AS' },
      { type: 'payTribute', card: 'AC' },
    ]);
    s = mustApply(s, 3, { type: 'payTribute', card: 'AS' }).state;
    expect(s.phase).toBe('returnTribute');

    const actions = GuandanGame.legalActions(s, 0);
    const cards = actions.map((a) => (a.type === 'returnTribute' ? a.card : null));
    // No T card is ever returnable at level T — levelValue(T)=15 > 10.
    expect(cards.some((c) => c !== null && c.startsWith('T'))).toBe(false);
    // The 9s (and other genuinely-low cards) are returnable.
    expect(cards).toContain('9S');
    expect(cards).toContain('9H');
    expect(cards).toContain('5C');
    expect(cards).toContain('2H');
    // J/K/A (levelValue 11/13/14) are not.
    expect(cards).not.toContain('JS');
    expect(cards).not.toContain('KD');
    expect(cards).not.toContain('AS');
    // A T return is rejected by the engine, not just absent from hints.
    const rejected = GuandanGame.applyAction(s, 0, { type: 'returnTribute', card: 'TS' });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('tribute.cardNotEligible');

    // Completing the return hands the lead to the payer (§7.5).
    s = mustApply(s, 0, { type: 'returnTribute', card: '9S' }).state;
    expect(s.phase).toBe('playing');
    expect(s.trick!.leader).toBe(3);
  });

  it('house: no-qualifying-card fallback returns the smallest card', () => {
    // Receiver's whole hand (incl. the received A) is above 10 by
    // levelValue: T=15(!), J=11, Q=12, K=13, A=14. Official fallback
    // (returnNoLowCardPolicy='lowestByLevelValue'): return the smallest —
    // here the Js at 11, NOT the T despite its face value of 10.
    let s = tributeState({
      currentLevel: 'T',
      levels: ['T', '2'],
      declarerTeam: 0,
      hands: [
        ['TS', 'JS', 'JC', 'QD', 'KD'], // receiver: nothing ≤ 10
        ['3C', '4C'],
        ['3D', '4D'],
        ['AC', 'AD', '4S'], // payer: forced rank A
      ],
      payer: 3,
      receiver: 0,
      prevFinishOrder: [0, 1, 2, 3],
      seed: 'house-return-fallback',
    });
    s = mustApply(s, 3, { type: 'payTribute', card: 'AC' }).state;

    // Eligible set = exactly the smallest-by-levelValue copies (the two Js).
    const actions = GuandanGame.legalActions(s, 0);
    const cards = actions.map((a) => (a.type === 'returnTribute' ? a.card : null)).sort();
    expect(cards).toEqual(['JC', 'JS']);

    // Anything else — including the level-T card — is rejected.
    const rejected = GuandanGame.applyAction(s, 0, { type: 'returnTribute', card: 'TS' });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('tribute.cardNotEligible');

    s = mustApply(s, 0, { type: 'returnTribute', card: 'JS' }).state;
    expect(s.phase).toBe('playing');
    expect(s.trick!.leader).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Mixed SJ+BJ is never a pair (spec §2.2 CORE invariant, §9.15)
// ---------------------------------------------------------------------------

describe('house rule 5: mixed SJ+BJ is never a pair — anywhere', () => {
  it('house: mixed SJ+BJ is never a pair — anywhere', () => {
    // (a) validatePlay rejects it as a pair, under every decl spelling.
    for (const decl of [
      { type: 'pair', size: 2, keyRank: 'A' as Rank },
      { type: 'pair', size: 2, keyRank: 'A' as Rank, jokerRank: 'SJ' as const },
      { type: 'pair', size: 2, keyRank: 'A' as Rank, jokerRank: 'BJ' as const },
    ]) {
      const res = validatePlay(['SJ', 'BJ'], decl as never, '2', CFG);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('play.mixedJokerPair');
    }

    // (b) ...as a full-house pair component (fullHouseJokerPair=true only
    // admits SJ+SJ / BJ+BJ), including when a wild completes the triple.
    const fh = validatePlay(
      ['9S', '9C', '9D', 'SJ', 'BJ'],
      { type: 'fullHouse', size: 5, keyRank: '9' },
      '2',
      CFG,
    );
    expect(fh.ok).toBe(false);
    if (!fh.ok) expect(fh.error.code).toBe('play.mixedJokerPair');
    const fhWild = validatePlay(
      ['KS', 'KC', '3H', 'SJ', 'BJ'], // 3H is the wild at level 3
      { type: 'fullHouse', size: 5, keyRank: 'K' },
      '3',
      CFG,
    );
    expect(fhWild.ok).toBe(false);
    if (!fhWild.ok) expect(fhWild.error.code).toBe('play.mixedJokerPair');

    // (c) No canonical interpretation exists AT ALL for these multisets.
    expect(classifyPlays(['SJ', 'BJ'], '2', CFG)).toEqual([]);
    expect(classifyPlays(['9S', '9C', '9D', 'SJ', 'BJ'], '2', CFG)).toEqual([]);

    // (d) Engine-driven: leading SJ+BJ is rejected with and without a decl.
    const s = playingState({
      currentLevel: '2',
      levels: ['2', '2'],
      declarerTeam: null,
      hands: [['SJ', 'BJ', '9S', '9C', '9D'], ['3C'], ['3D'], ['4D']],
      leader: 0,
      seed: 'house-mixed-joker-engine',
    });
    const declared = GuandanGame.applyAction(s, 0, {
      type: 'play',
      cards: ['SJ', 'BJ'],
      decl: { type: 'pair', size: 2, keyRank: 'A' },
    });
    expect(declared.ok).toBe(false);
    if (!declared.ok) expect(declared.error.code).toBe('play.mixedJokerPair');
    const undeclared = GuandanGame.applyAction(s, 0, { type: 'play', cards: ['SJ', 'BJ'] });
    expect(undeclared.ok).toBe(false);
    if (!undeclared.ok) expect(undeclared.error.code).toBe('play.invalidCombination');
    const asFullHouse = GuandanGame.applyAction(s, 0, {
      type: 'play',
      cards: ['9S', '9C', '9D', 'SJ', 'BJ'],
      decl: { type: 'fullHouse', size: 5, keyRank: '9' },
    });
    expect(asFullHouse.ok).toBe(false);
    if (!asFullHouse.ok) expect(asFullHouse.error.code).toBe('play.mixedJokerPair');
  });

  it('house: legalPlays never emits a mixed joker pair (seeded sweep)', () => {
    // Property-style sweep: seeded random 27-card hands FORCED to contain
    // both jokers; every generated play that uses both an SJ and a BJ must
    // be the four-joker bomb — no other form may mix them (pair, full-house
    // pair component, anything). Swept across levels and both values of
    // fullHouseJokerPair, leading and following.
    const configs: RuleVariant[] = [CFG, { ...CFG, fullHouseJokerPair: false }];
    const levels: Rank[] = ['2', 'T', 'A'];
    const toBeats = [null, { type: 'pair', size: 2, keyRank: '9' } as const];
    let jokerPlaysSeen = 0;

    for (const config of configs) {
      for (const level of levels) {
        for (let i = 0; i < 10; i++) {
          const shuffled = shuffle(buildDeck(), seedPrng(`mixed-joker-sweep-${level}-${i}`));
          const hand = shuffled.items.slice(0, 27);
          // Force both jokers into the hand (order matters: place SJ first,
          // then re-check BJ against the updated hand).
          if (!hand.includes('SJ')) hand[0] = 'SJ';
          if (!hand.includes('BJ')) hand[1] = 'BJ';

          for (const toBeat of toBeats) {
            for (const play of legalPlays(hand, toBeat, level, config)) {
              const sj = play.cards.filter((c) => c === 'SJ').length;
              const bj = play.cards.filter((c) => c === 'BJ').length;
              if (sj + bj > 0) jokerPlaysSeen++;
              if (sj > 0 && bj > 0) {
                // Only the four-joker bomb may ever mix SJ and BJ.
                expect(play.decl.type).toBe('jokerBomb');
                expect(play.cards.slice().sort()).toEqual(['BJ', 'BJ', 'SJ', 'SJ']);
              }
            }
          }
        }
      }
    }
    // Non-vacuity: the sweep really did generate joker-using plays.
    expect(jokerPlaysSeen).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. 接风 exact condition (spec §5.6, jiefengRecipient='partner')
// ---------------------------------------------------------------------------

describe('house rule 6: 接风 fires only when the winning final play was not beaten', () => {
  it("house: finisher's last play wins the trick (all pass) → partner leads next trick + jiefeng event", () => {
    // Seat 0 empties with KS; seats 1, 2, 3 all pass — the final play stood
    // unbeaten, so 接风: partner seat 2 leads the next trick.
    let s = playingState({
      currentLevel: '2',
      levels: ['2', '2'],
      declarerTeam: null,
      hands: [['KS'], ['3S', '4S'], ['5S', '6S'], ['7S', '8S']],
      leader: 0,
      seed: 'house-jiefeng-unbeaten',
    });
    const played = playSingle(s, 0, 'KS');
    s = played.state;
    expect(findEvent(played.events, 'playerFinished')).toMatchObject({ seat: 0, place: 1 });
    s = pass(s, 1).state;
    s = pass(s, 2).state;
    const closing = pass(s, 3);
    s = closing.state;

    expect(findEvent(closing.events, 'trickWon').seat).toBe(0);
    expect(findEvent(closing.events, 'jiefeng')).toMatchObject({ finisher: 0, leader: 2 });
    expect(s.trick!.leader).toBe(2); // partner leads
    expect(s.trick!.toAct).toBe(2);
    expect(s.trick!.top).toBeNull();
  });

  it("house: finisher's last play gets beaten → beater leads, no jiefeng event", () => {
    // Seat 0 empties with KS but seat 1 beats it with AS; seats 2 and 3
    // pass; the finished seat 0 is skipped and the trick closes on seat 1's
    // top play. No 接风 — the beater leads.
    let s = playingState({
      currentLevel: '2',
      levels: ['2', '2'],
      declarerTeam: null,
      hands: [['KS'], ['AS', '3S', '4S'], ['5S', '6S'], ['7S', '8S']],
      leader: 0,
      seed: 'house-jiefeng-beaten',
    });
    const allEvents: GuandanEvent[] = [];
    let r = playSingle(s, 0, 'KS'); // seat 0's final play
    allEvents.push(...r.events);
    r = playSingle(r.state, 1, 'AS'); // beaten!
    allEvents.push(...r.events);
    r = pass(r.state, 2);
    allEvents.push(...r.events);
    r = pass(r.state, 3);
    allEvents.push(...r.events);
    s = r.state;

    expect(allEvents.some((e) => e.type === 'jiefeng')).toBe(false); // no 接风, ever
    expect(findEvent(r.events, 'trickWon').seat).toBe(1);
    expect(s.trick!.leader).toBe(1); // the beater leads the next trick
    expect(s.trick!.toAct).toBe(1);
    expect(s.finishOrder).toEqual([0]); // seat 0 finished but hand continues
  });
});

// ---------------------------------------------------------------------------
// Item 2 (design-refinement round): tribute CONSUMES the planning window —
// the owner's deliberate pick: paying/returning tribute IS the hand-reading
// decision over the fresh 27, so it is the seat's planning action.
// ---------------------------------------------------------------------------

describe('item 2: tribute consumes the actor planning window', () => {
  it("payTribute / returnTribute are first actions → each consumes ONLY that seat's window", () => {
    let s = tributeState({
      currentLevel: 'T',
      levels: ['T', '2'],
      declarerTeam: 0,
      hands: [
        ['TS', 'TC', '9S', '9H', '5C', 'JS', 'KD', '2H'],
        ['3C', '4C'],
        ['3D', '4D'],
        ['AS', 'AC', '2S', '3S'],
      ],
      payer: 3,
      receiver: 0,
      prevFinishOrder: [0, 1, 2, 3],
      seed: 'item2-tribute-window',
    });
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      expect(GuandanGame.timingClass!(s, seat), `fresh hand, seat ${seat}`).toBe('planning');
    }
    s = mustApply(s, 3, { type: 'payTribute', card: 'AS' }).state;
    expect(GuandanGame.timingClass!(s, 3), 'payer window consumed by the tribute').toBe('turn');
    expect(GuandanGame.timingClass!(s, 0), 'receiver still planning').toBe('planning');
    s = mustApply(s, 0, { type: 'returnTribute', card: '9S' }).state;
    expect(GuandanGame.timingClass!(s, 0), 'receiver window consumed by the return').toBe('turn');
    expect(GuandanGame.timingClass!(s, 1)).toBe('planning');
    expect(GuandanGame.timingClass!(s, 2)).toBe('planning');
  });
});
