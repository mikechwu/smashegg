// docs/rules/guandan.md §9 "Engine Edge-Cases Checklist" (v1.3) as a NAMED
// test suite — one test per item §9.1..§9.22, in the item's own words
// (abbreviated). This file is the M1 gate's map from checklist item to
// test: DO NOT merge items, even where combos.test.ts / tribute.test.ts /
// trick.test.ts / levels.test.ts already exercise the same substance —
// coverage must be visible here, thinly if need be.
//
// Style: engine-level scenarios (constructed GuandanState + real
// GuandanGame.applyAction calls) are preferred per the task brief; a few
// items are module-scoped (combos.ts wild/bomb intricacies, tribute.ts
// eligible-set math, trick.ts rotation) and are tested directly against
// their owning module, which is both more precise and mirrors how
// combos.test.ts / tribute.test.ts / trick.test.ts already test those
// modules. Every constructed GuandanState documents its scenario intent
// inline — per-field realism (e.g. duplicate-looking hands across seats)
// is deliberately not a real 108-card deal unless the test needs one.

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng } from '../../../src/engine/core/prng';
import type { Card, Rank } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import {
  beats,
  classifyPlays,
  isBombForm,
  sequenceWindow,
  validatePlay,
} from '../../../src/engine/guandan/combos';
import { legalPlays } from '../../../src/engine/guandan/generate';
import { GuandanGame } from '../../../src/engine/guandan';
import {
  eligibleReturnCards,
  eligibleTributeCards,
  setupTribute,
  type Hands,
} from '../../../src/engine/guandan/tribute';
import { applyPass, applyPlay, startTrick } from '../../../src/engine/guandan/trick';
import type { CanonicalForm, ComboType, GuandanEvent, GuandanState } from '../../../src/engine/guandan/types';

const cfg = JIANGSU_OFFICIAL_ONLINE;

/** Same trick-form-literal convenience as combos.test.ts / trick.test.ts:
 *  `as CanonicalForm` sidesteps TS excess-property checks for the joker /
 *  demoted extras that live on ComboForm, not the base interface. */
function form(
  type: ComboType,
  size: number,
  keyRank: Rank,
  extra?: { suit?: 'S' | 'H' | 'C' | 'D'; jokerRank?: 'SJ' | 'BJ'; demoted?: boolean },
): CanonicalForm {
  return { type, size, keyRank, ...extra } as CanonicalForm;
}
const single = (r: Rank): CanonicalForm => form('single', 1, r);

/** Minimal legal GuandanState for playing-phase scenarios: hand 1
 *  (declarerTeam/prevFinishOrder null), no tribute in progress. Callers
 *  override `hands`, `currentLevel`, and `trick` (and anything else the
 *  scenario needs) — every call site documents WHY its overrides matter. */
function playingState(overrides: Partial<GuandanState> & Pick<GuandanState, 'hands' | 'currentLevel'>): GuandanState {
  return {
    config: cfg,
    prng: seedPrng('spec9-fixture'),
    handNo: 1,
    phase: 'playing',
    actedThisHand: [false, false, false, false],
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    declarerTeam: null,
    finishOrder: [],
    trick: null,
    tribute: null,
    prevFinishOrder: null,
    antiTributePending: null,
    firstFinisherAllAces: null,
    matchWinner: null,
    ...overrides,
  };
}

/** Shared scaffold for §9.3 and §9.19: seat 3 leads their LAST card as a
 *  fresh trick (seats 0 and 1 already finished 1st/2nd, non-partners, so
 *  the hand is still open), making seat 3 the 3rd finisher — hand-end
 *  fires immediately per spec §5.8/§9.3, before the trick could otherwise
 *  resolve, and index.ts atomically scores + deals hand 2 in the same
 *  applyAction call. Seat 2's leftover ['3S','4S'] (2 cards) is the
 *  "previous hand's leftover" that §9.3/§9.19 say must NEVER be consulted
 *  for hand 2's tribute — the real newly-dealt hand is 27 fresh cards. */
function stateAfterThirdFinisherEndsHand(): { state: GuandanState; events: GuandanEvent[] } {
  const hands: Hands = [[], [], ['3S', '4S'], ['9H']];
  const state = playingState({
    currentLevel: '2',
    declarerTeam: 0,
    finishOrder: [0, 1],
    hands,
    trick: startTrick(3, hands, cfg),
    prevFinishOrder: null,
  });
  const res = GuandanGame.applyAction(state, 3, {
    type: 'play',
    cards: ['9H'],
    decl: single('9'),
  });
  if (!res.ok) throw new Error(`scaffold broken: ${res.error.code}`);
  return { state: res.state, events: res.events };
}

describe('spec §9 engine edge-cases checklist', () => {
  it('§9.1 last play must be one legal combination — no dump-the-remainder rule', () => {
    // Seat 0's whole hand is two odd, non-combinable cards (different
    // ranks, no wild in play at level '2'). There is no legal way to play
    // both at once — only single-card plays exist.
    const hands: Hands = [['3S', '5H'], ['4S'], ['6S'], ['7S']];
    const state = playingState({ currentLevel: '2', hands, trick: startTrick(0, hands, cfg) });

    const legal = GuandanGame.legalActions(state, 0);
    const plays = legal.filter((a) => a.type === 'play');
    expect(plays.length).toBeGreaterThan(0);
    for (const a of plays) {
      if (a.type === 'play') expect(a.cards.length).toBe(1); // never "both at once"
    }

    // Directly attempting to "dump" the remainder as one play is rejected:
    // the two cards form no legal combination at all.
    const res = GuandanGame.applyAction(state, 0, { type: 'play', cards: ['3S', '5H'] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('play.invalidCombination');
  });

  it('§9.2 cannot pass when leading', () => {
    const hands: Hands = [['3S', '4S'], ['5S'], ['6S'], ['7S']];
    const state = playingState({ currentLevel: '2', hands, trick: startTrick(0, hands, cfg) });
    expect(state.trick!.top).toBeNull(); // seat 0 holds the lead

    const res = GuandanGame.applyAction(state, 0, { type: 'pass' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('play.cannotPassLeading');
  });

  it('§9.3 hand may end mid-trick (3rd finisher) — trick aborted immediately, next hand dealt fresh', () => {
    const { state: next, events } = stateAfterThirdFinisherEndsHand();

    // The hand-ending applyAction atomically scores hand 1 and deals hand 2
    // (obligation: no actorless phases) — reached hand 2 with a full fresh
    // 27-card deal for every seat, INCLUDING seat 2 whose hand-1 leftover
    // was just ['3S','4S'] (2 cards, never consulted).
    expect(next.handNo).toBe(2);
    expect(next.finishOrder).toEqual([]);
    for (const hand of next.hands) expect(hand.length).toBe(27);

    // The trick was aborted, not resolved: no trickWon/jiefeng bookkeeping,
    // even though this WAS a legal leading play that nobody had a chance to
    // beat yet.
    const types = events.map((e) => e.type);
    expect(types).toContain('played');
    expect(types).toContain('playerFinished');
    expect(types).toContain('handEnded');
    expect(types).toContain('handStarted');
    expect(types).not.toContain('trickWon');
  });

  it('§9.4 接风 invariant never fires across seeded playouts (trick.ts throw would surface here)', () => {
    // trick.ts asserts the §5.6/§9.4 invariant by THROWING (an engine bug,
    // not a RuleError) if a jiefeng recipient is ever inactive. Driving
    // several full seeded playouts through the public GameDefinition and
    // observing zero throws (with jiefeng actually occurring at least
    // once) is the test that the invariant genuinely holds, not merely
    // that it's never exercised.
    let jiefengCount = 0;
    for (const seed of ['spec9-4-a', 'spec9-4-b', 'spec9-4-c', 'spec9-4-d']) {
      const init = GuandanGame.init(cfg, 4, seed);
      let state = init.state;
      let bot = seedPrng(`bot:${seed}`);
      for (let actions = 0; actions < 20_000 && !GuandanGame.isTerminal(state); actions++) {
        const seat = GuandanGame.expectedActors(state)[0]!;
        const legal = GuandanGame.legalActions(state, seat);
        const fallback = GuandanGame.defaultAction(state, seat);
        let action = fallback!;
        if (legal.length > 0) {
          const plays = legal.filter((a) => a.type !== 'pass');
          const pool = plays.length > 0 ? plays : legal;
          const pick = nextInt(bot, pool.length);
          bot = pick.state;
          action = pool[pick.value]!;
        }
        const res = GuandanGame.applyAction(state, seat, action); // would throw on invariant violation
        if (!res.ok) throw new Error(`applyAction rejected a legal action: ${res.error.code}`);
        for (const e of res.events) if (e.type === 'jiefeng') jiefengCount++;
        state = res.state;
      }
    }
    expect(jiefengCount).toBeGreaterThan(0); // the scenario was genuinely exercised
  });

  it('§9.5 four jokers & tribute — joker bomb never paid; one BJ payable; both BJ ⇒ 抗贡', () => {
    // Single tribute (prevFinishOrder [0,1,3], non-partners 1st/2nd):
    // payer = seat 2 (末游). Seat 2 holds ALL FOUR jokers — the "joker
    // bomb" — but tribute is a single card, so it can never be "paid" as
    // a bomb: both big jokers being in the payer set instead cancels
    // tribute outright (抗贡).
    const allFourJokersHand: Hands = [['9S'], ['9S'], ['SJ', 'SJ', 'BJ', 'BJ', '3S'], ['9S']];
    const setup1 = setupTribute([0, 1, 3], allFourJokersHand, '2', cfg);
    expect(setup1.kind).toBe('anti');
    if (setup1.kind === 'anti') {
      expect(setup1.reveals).toHaveLength(2);
      for (const r of setup1.reveals) {
        expect(r.seat).toBe(2);
        expect(r.card).toBe('BJ'); // only the BJs are revealed, never the SJs
      }
    }

    // A payer holding exactly ONE big joker (no anti-tribute condition):
    // the joker itself is payable as the forced (highest) tribute card.
    const eligible = eligibleTributeCards(['BJ', '5S', '6C'], '2');
    expect(eligible).toEqual(['BJ']);

    // Double tribute where the two payers hold one BJ EACH (together both
    // big jokers) — also cancels tribute for both.
    const splitPairHands: Hands = [['3S'], ['BJ', '8H'], ['3S'], ['BJ', '9S']];
    const setup2 = setupTribute([0, 2], splitPairHands, '2', cfg); // 0,2 are partners: double tribute
    expect(setup2.kind).toBe('anti');
    if (setup2.kind === 'anti') {
      expect(setup2.reveals).toHaveLength(2);
      expect(setup2.reveals).toContainEqual({ seat: 3, card: 'BJ' });
      expect(setup2.reveals).toContainEqual({ seat: 1, card: 'BJ' });
    }
  });

  it('§9.6 level card in full house — triple(level) beats triple(A); pair irrelevant; wild completes either part', () => {
    const level: Rank = '7';
    // Triple = level rank beats triple = Aces (levelValue 15 > 14) — pair
    // never enters the comparison key.
    expect(beats(form('fullHouse', 5, '7'), form('fullHouse', 5, 'A'), level, cfg)).toBe(true);

    // Wild completes the TRIPLE part: 2 wilds ('7H','7H') + 1 natural
    // '7S' = the triple; '9S','9S' the (fully natural) pair.
    expect(validatePlay(['7H', '7H', '7S', '9S', '9S'], form('fullHouse', 5, '7'), level, cfg)).toEqual({
      ok: true,
    });

    // Wild completes the PAIR part: 3 natural 7s = the triple; '9S' +
    // one wild ('7H') = the pair.
    expect(validatePlay(['7S', '7S', '7S', '9S', '7H'], form('fullHouse', 5, '7'), level, cfg)).toEqual({
      ok: true,
    });
  });

  it('§9.7 pair of two wilds = pair of level cards — beats AA, loses to SJ pair, no under-declaration', () => {
    const level: Rank = '7';
    expect(validatePlay(['7H', '7H'], form('pair', 2, '7'), level, cfg)).toEqual({ ok: true });

    const wildPair = form('pair', 2, '7');
    expect(beats(wildPair, form('pair', 2, 'A'), level, cfg)).toBe(true); // 15 > 14
    const sjPair = form('pair', 2, 'A', { jokerRank: 'SJ' }); // convention keyRank
    expect(beats(wildPair, sjPair, level, cfg)).toBe(false); // 15 < 16
    expect(beats(sjPair, wildPair, level, cfg)).toBe(true);

    // §4.2: deterministic — declaring the two wilds as a lower rank is
    // disallowed by default (no under-declaration).
    const underDeclared = validatePlay(['7H', '7H'], form('pair', 2, '6'), level, cfg);
    expect(underDeclared.ok).toBe(false);
    if (!underDeclared.ok) expect(underDeclared.error.code).toBe('play.wildUnderDeclare');
  });

  it('§9.8 A-high vs level-high straights — the level card never elevates inside a sequence', () => {
    const level: Rank = 'Q'; // Q is the elevated level card everywhere EXCEPT sequences.
    // 10-J-Q-K-A, mixed suits (avoid an incidental straight-flush), Q at
    // its natural spot (not above A).
    expect(validatePlay(['TS', 'JH', 'QC', 'KD', 'AS'], form('straight', 5, 'A'), level, cfg)).toEqual({
      ok: true,
    });
    // It's the TOP straight: naturalValue(A)=14 beats the A-low straight's key (5).
    expect(beats(form('straight', 5, 'A'), form('straight', 5, '5'), level, cfg)).toBe(true);
  });

  it('§9.9 A-low sequences — A=1, lowest of its family, no wrap-around anywhere', () => {
    const level: Rank = '9'; // arbitrary, uninvolved level to isolate the A-low mechanics
    // A-2-3-4-5 straight (mixed suits): valid, key = naturalValue('5') = 5 (lowest).
    expect(validatePlay(['AS', '2H', '3C', '4D', '5S'], form('straight', 5, '5'), level, cfg)).toEqual({
      ok: true,
    });
    // AA2233 tube: A=1 at the low end, still valid, no different treatment.
    expect(validatePlay(['AS', 'AH', '2S', '2H', '3S', '3H'], form('tube', 6, '3'), level, cfg)).toEqual({
      ok: true,
    });
    // No wrap: there is no window for a top below '5' (straights) — the
    // engine simply has no such window, rather than wrapping Q-K-A-2-3.
    expect(sequenceWindow('2', 5)).toBeNull();
  });

  it('§9.10 level rank inside sequences at level=2 or A: both still form their natural sequences', () => {
    // level=2: A-2-3-4-5 still valid (2 sits naturally, not elevated).
    expect(validatePlay(['AS', '2C', '3H', '4D', '5S'], form('straight', 5, '5'), '2', cfg)).toEqual({
      ok: true,
    });
    // level=A: 10-J-Q-K-A valid (A natural high)...
    expect(validatePlay(['TC', 'JH', 'QD', 'KS', 'AC'], form('straight', 5, 'A'), 'A', cfg)).toEqual({
      ok: true,
    });
    // ...AND A-2-3-4-5 valid (A natural low), same level.
    expect(validatePlay(['AS', '2H', '3C', '4D', '5S'], form('straight', 5, '5'), 'A', cfg)).toEqual({
      ok: true,
    });
  });

  it('§9.11 wild-as-itself — 8-copy level-rank bomb; hearts SF through the level rank natural slot', () => {
    const level: Rank = '7';
    // All 8 physical 7s (6 non-heart naturals + the 2 heart wilds) = an
    // 8-bomb; the hearts ARE played as themselves (natural level cards).
    const eightSevens: Card[] = ['7S', '7S', '7C', '7C', '7D', '7D', '7H', '7H'];
    expect(validatePlay(eightSevens, form('bomb', 8, '7'), level, cfg)).toEqual({ ok: true });
    const plays = legalPlays(eightSevens, null, level, cfg);
    const sevenBombSizes = plays.filter((p) => p.decl.type === 'bomb' && p.decl.keyRank === '7').map((p) => p.decl.size);
    expect(Math.max(...sevenBombSizes)).toBe(8);
    expect(sevenBombSizes).not.toContain(9);

    // Hearts straight flush through the level rank's natural slot: 7H
    // fills its OWN slot (wild-as-itself), not a substitution — bomb
    // status is unaffected.
    const decl = form('straightFlush', 5, '7', { suit: 'H' });
    expect(validatePlay(['3H', '4H', '5H', '6H', '7H'], decl, level, cfg)).toEqual({ ok: true });
    expect(isBombForm(decl, cfg)).toBe(true);
  });

  it('§9.12 wild completing a straight flush keeps bomb status; a wild may represent any suit', () => {
    const level: Rank = '7';
    // Window 5-6-7-8-9 ♠: missing 6♠, filled by the (heart) wild acting
    // as a SPADE, not a heart — substitution targets any suit.
    const decl = form('straightFlush', 5, '9', { suit: 'S' });
    expect(validatePlay(['5S', '7S', '8S', '9S', '7H'], decl, level, cfg)).toEqual({ ok: true });
    expect(isBombForm(decl, cfg)).toBe(true); // still a bomb, not demoted
  });

  it("§9.13 wild representing the 'other' heart level card is legal", () => {
    const level: Rank = '7';
    // Window 6-7-8-9-10 ♥: naturals 8H,9H,TH present; BOTH physical wilds
    // ('7H','7H') are held. One plays AS ITSELF at the natural 7H slot;
    // the other substitutes for the missing 6H — a legal assignment even
    // though both wilds are physically identical cards.
    const decl = form('straightFlush', 5, 'T', { suit: 'H' });
    expect(validatePlay(['7H', '7H', '8H', '9H', 'TH'], decl, level, cfg)).toEqual({ ok: true });
    expect(isBombForm(decl, cfg)).toBe(true); // the substituting wild doesn't demote it
  });

  it('§9.14 ten-card bomb only for non-level ranks; level-rank bombs cap at 8', () => {
    const level: Rank = '7';
    // Non-level rank '5': 8 naturals (2 per suit) + both wilds = 10-bomb.
    const fiveHand: Card[] = ['5S', '5S', '5H', '5H', '5C', '5C', '5D', '5D', '7H', '7H'];
    const fivePlays = legalPlays(fiveHand, null, level, cfg);
    const fiveBombSizes = fivePlays.filter((p) => p.decl.type === 'bomb' && p.decl.keyRank === '5').map((p) => p.decl.size);
    expect(Math.max(...fiveBombSizes)).toBe(10);

    // The level rank itself: only 6 naturals exist (2 of the 8 physical
    // copies ARE the wilds) — the cap is 8, enforced purely by counts.
    const sevenHand: Card[] = ['7S', '7S', '7C', '7C', '7D', '7D', '7H', '7H'];
    const sevenPlays = legalPlays(sevenHand, null, level, cfg);
    const sevenBombSizes = sevenPlays.filter((p) => p.decl.type === 'bomb' && p.decl.keyRank === '7').map((p) => p.decl.size);
    expect(Math.max(...sevenBombSizes)).toBe(8);
    expect(sevenBombSizes).not.toContain(9);
    expect(sevenBombSizes).not.toContain(10);
  });

  it('§9.15 mixed joker "pair" invalid; joker combos other than the exact 4-joker set invalid', () => {
    const mixed = validatePlay(['SJ', 'BJ'], form('pair', 2, 'A'), '2', cfg);
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) expect(mixed.error.code).toBe('play.mixedJokerPair');

    const tripleOfJokers = validatePlay(['SJ', 'SJ', 'BJ'], form('triple', 3, 'A'), '2', cfg);
    expect(tripleOfJokers.ok).toBe(false);
    if (!tripleOfJokers.ok) expect(tripleOfJokers.error.code).toBe('play.jokerNotAllowed');

    // 3 jokers is never a combo under ANY interpretation.
    expect(classifyPlays(['SJ', 'SJ', 'BJ'], '2', cfg)).toEqual([]);
  });

  it('§9.16 equal never beats — including equal-top straight flushes of different suits', () => {
    const a = form('straightFlush', 5, '9', { suit: 'S' });
    const b = form('straightFlush', 5, '9', { suit: 'H' });
    expect(beats(a, b, '2', cfg)).toBe(false);
    expect(beats(b, a, '2', cfg)).toBe(false);
  });

  it('§9.17 passing then playing later in the same trick is legal; beating your own partner is legal', () => {
    const hands: Hands = [
      ['5S', '2C', '3C'],
      ['4H', '8H', '9H'],
      ['6S', 'TH', 'JH'],
      ['7C', '8C', '9C'],
    ];
    const state0 = playingState({ currentLevel: '2', hands, trick: startTrick(0, hands, cfg) });

    const r0 = GuandanGame.applyAction(state0, 0, { type: 'play', cards: ['5S'], decl: single('5') });
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;

    const r1 = GuandanGame.applyAction(r0.state, 1, { type: 'pass' });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Seat 2 = partnerOf(0) beats seat 0's own play — no team-protection rule.
    const r2 = GuandanGame.applyAction(r1.state, 2, { type: 'play', cards: ['6S'], decl: single('6') });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.trick!.top!.seat).toBe(2);

    const r3 = GuandanGame.applyAction(r2.state, 3, { type: 'pass' });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    const r0b = GuandanGame.applyAction(r3.state, 0, { type: 'pass' }); // can't beat 6S; passing is always allowed
    expect(r0b.ok).toBe(true);
    if (!r0b.ok) return;

    // Turn returns to seat 1, who ALREADY passed earlier in this very
    // trick (to the old top) — spec §5.3/§9.17 says they may still play.
    expect(r0b.state.trick!.toAct).toBe(1);
    const r1b = GuandanGame.applyAction(r0b.state, 1, { type: 'play', cards: ['8H'], decl: single('8') });
    expect(r1b.ok).toBe(true);
    if (r1b.ok) expect(r1b.state.trick!.top!.seat).toBe(1);
  });

  it('§9.18 ambiguous wild selections require a declared canonical form that binds what followers must beat', () => {
    // Spec's own example (v1.4): 2♠3♠4♠5♠+wild (level=6, wild=6♥) admits
    // SF top-6♠ and SF top-5/A-low ♠ — plain-straight readings are barred
    // for one-suit naturals (owner-extended §3.8). Seat 0 additionally
    // holds an off-suit 5♦ so a MIXED-suit wild straight (a different
    // concrete selection) demonstrates the binding-declaration mechanics.
    const hands: Hands = [
      ['2S', '3S', '4S', '5S', '5D', '6H', '9C'],
      ['3H', '4C', '5D', '6C', '7S'], // follow-up: mixed-suit straight top-7
      ['8S'],
      ['9S'],
    ];
    const state = playingState({ currentLevel: '6', hands, trick: startTrick(0, hands, cfg) });

    const ambiguous = GuandanGame.applyAction(state, 0, { type: 'play', cards: ['2S', '3S', '4S', '5S', '6H'] });
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) expect(ambiguous.error.code).toBe('play.declRequired');

    // v1.4 owner-extended §3.8: the one-suit-naturals selection may NOT be
    // under-declared as a plain straight — the wild opens no off-suit escape.
    const asStraight = GuandanGame.applyAction(state, 0, {
      type: 'play',
      cards: ['2S', '3S', '4S', '5S', '6H'],
      decl: form('straight', 5, '6'),
    });
    expect(asStraight.ok).toBe(false);
    if (!asStraight.ok) expect(asStraight.error.code).toBe('play.mustDeclareStraightFlush');

    // A mixed-suit selection (5♦ instead of 5♠) IS a plain straight
    // (non-bomb): a stronger plain straight beats it.
    const asMixedStraight = GuandanGame.applyAction(state, 0, {
      type: 'play',
      cards: ['2S', '3S', '4S', '5D', '6H'],
      decl: form('straight', 5, '6'),
    });
    expect(asMixedStraight.ok).toBe(true);
    if (asMixedStraight.ok) {
      const follow = GuandanGame.applyAction(asMixedStraight.state, 1, {
        type: 'play',
        cards: ['3H', '4C', '5D', '6C', '7S'],
        decl: form('straight', 5, '7'),
      });
      expect(follow.ok).toBe(true);
    }

    // The one-suit selection declared as a straight FLUSH (a bomb): the
    // identical follow-up straight can no longer beat it — the
    // declaration is what binds.
    const asStraightFlush = GuandanGame.applyAction(state, 0, {
      type: 'play',
      cards: ['2S', '3S', '4S', '5S', '6H'],
      decl: form('straightFlush', 5, '6', { suit: 'S' }),
    });
    expect(asStraightFlush.ok).toBe(true);
    if (asStraightFlush.ok) {
      const follow = GuandanGame.applyAction(asStraightFlush.state, 1, {
        type: 'play',
        cards: ['3H', '4C', '5D', '6C', '7S'],
        decl: form('straight', 5, '7'),
      });
      expect(follow.ok).toBe(false);
      if (!follow.ok) expect(follow.error.code).toBe('play.cannotBeatTop');
    }
  });

  it('§9.19 tribute forced-rank excludes wilds, includes non-heart level cards and single jokers, from the fresh deal', () => {
    const level: Rank = '7';
    // Excluding the wild matters: without exclusion, '7H' (levelValue 15)
    // would beat 'AS' (14) and be wrongly forced as tribute.
    expect(eligibleTributeCards(['7H', 'AS', 'KH'], level)).toEqual(['AS']);
    // A NON-heart level card ('7S') is NOT excluded — it IS the forced rank.
    expect(eligibleTributeCards(['7S', 'AS', 'KH'], level)).toEqual(['7S']);
    // A single big joker is the forced (highest) rank when nothing outranks it.
    expect(eligibleTributeCards(['BJ', 'AS', 'KS'], '2')).toEqual(['BJ']);

    // And it's computed on the NEWLY DEALT hand, never previous leftovers
    // (reusing the §9.3 scaffold: seat 2's hand-1 leftover was ['3S','4S'],
    // but hand 2's tribute setup — reached atomically in the same
    // applyAction — sees a fresh 27-card hand for every seat).
    const { state: next } = stateAfterThirdFinisherEndsHand();
    expect(next.hands[2]!.length).toBe(27);
  });

  it('§9.20 return card must satisfy levelValue ≤ 10; no-qualifying-card fallback per returnNoLowCardPolicy', () => {
    const level: Rank = '7';
    // Every card in this hand has levelValue > 10 (J/Q/K/A/level-card):
    // no qualifying card exists.
    const highHand: Card[] = ['JS', 'QH', 'KS', '7S', 'AS'];
    expect(eligibleReturnCards(highHand, level, cfg, '2S')).toEqual(['JS']); // lowestByLevelValue fallback (J=11, the min)

    const anyCardCfg = { ...cfg, returnNoLowCardPolicy: 'anyCard' as const };
    expect(eligibleReturnCards(highHand, level, anyCardCfg, '2S')).toEqual(highHand); // whole hand fallback

    // Normal case: wilds, the level card, and jokers are excluded BY
    // CONSTRUCTION (their levelValue is always > 10); only the plain low
    // card qualifies.
    const mixedHand: Card[] = ['5S', '7H', '7S', 'BJ'];
    expect(eligibleReturnCards(mixedHand, level, cfg, 'AS')).toEqual(['5S']);
  });

  it('§9.21 first trick after tribute: the leader is not required to lead any particular card', () => {
    // Single tribute already resolved (payer seat 2 → receiver seat 0,
    // return already made) — constructed directly at the moment the
    // leader (seat 2, the payer, per spec §7.5) is about to lead.
    const hands: Hands = [
      ['5H', '9D', 'AS'], // seat 0: kept 'AS' it received, gave back '6C'
      ['3H', '4H', '5C'],
      ['KH', 'QS', '6C'], // seat 2 (payer/leader): gave 'AS', got '6C' back
      ['3D', '4D', '5D'],
    ];
    const state = playingState({
      currentLevel: '2',
      hands,
      trick: startTrick(2, hands, cfg),
      declarerTeam: 0,
      tribute: {
        kind: 'single',
        payers: [2],
        receivers: [0],
        staged: {},
        paid: [{ from: 2, to: 0, card: 'AS' }],
        returnsStaged: {},
        returned: [{ from: 0, to: 2, card: '6C' }],
        leader: 2,
      },
    });

    const legal = GuandanGame.legalActions(state, 2);
    const keyRanks = legal.filter((a) => a.type === 'play').map((a) => (a.type === 'play' ? a.decl!.keyRank : null));
    expect(new Set(keyRanks)).toEqual(new Set(['K', 'Q', '6'])); // every held card is a free lead choice

    // Leading with a card that is neither the tribute card, the returned
    // card, nor the highest card — still perfectly legal.
    const res = GuandanGame.applyAction(state, 2, { type: 'play', cards: ['QS'], decl: single('Q') });
    expect(res.ok).toBe(true);
  });

  it('§9.22 skipped seats & pass-counting — turn returns to the top-play owner, correct at both 4 and 2 active', () => {
    // 4 active players: closes only once the 3rd pass returns the turn to
    // the owner (seat 0) — not because "3" is hardcoded, but because that
    // is where the rotation lands.
    const hands4: Hands = [['2S', '3S'], ['4S', '5S'], ['6S', '7S'], ['8S', '9S']];
    const afterPlay4 = applyPlay(
      startTrick(0, hands4, cfg),
      { seat: 0, cards: ['2S'], decl: single('2') },
      [['3S'], ['4S', '5S'], ['6S', '7S'], ['8S', '9S']],
      cfg,
      [],
    );
    const remaining4: Hands = [['3S'], ['4S', '5S'], ['6S', '7S'], ['8S', '9S']];
    const p1 = applyPass(afterPlay4.trick!, 1, remaining4, cfg);
    expect(p1.trickWon).toBe(false);
    const p2 = applyPass(p1.trick, 2, remaining4, cfg);
    expect(p2.trickWon).toBe(false);
    const p3 = applyPass(p2.trick, 3, remaining4, cfg);
    expect(p3.trickWon).toBe(true);

    // 2 active players (seats 1 and 3 already finished — a skip, not a
    // pass): a SINGLE pass now suffices to return the turn to the owner.
    const hands2: Hands = [['2S', '3S'], [], ['6S', '7S'], []];
    const afterPlay2 = applyPlay(
      startTrick(0, hands2, cfg),
      { seat: 0, cards: ['2S'], decl: single('2') },
      [['3S'], [], ['6S', '7S'], []],
      cfg,
      [],
    );
    expect(afterPlay2.trick!.toAct).toBe(2); // seats 1,3 skipped entirely
    const single2 = applyPass(afterPlay2.trick!, 2, [['3S'], [], ['6S', '7S'], []], cfg);
    expect(single2.trickWon).toBe(true); // ONE pass, not three
  });
});
