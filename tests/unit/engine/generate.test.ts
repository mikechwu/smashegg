// Tests for generate.ts — legal-move generation (Problem G, spec §4.4.3
// with the v1.1 corrections). Spec: docs/rules/guandan.md v1.3; every test
// name cites its section. The two property tests make PLAN §3 obligation 4
// real: (1) soundness — every generated play validates and beats the prior
// play; (2) completeness — template enumeration produces exactly the same
// suit-blind projections as brute-force subset classification.

import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/engine/guandan/cards';
import { buildDeck, removeCards } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import type { CanonicalForm, ComboType } from '../../../src/engine/guandan/types';
import { beats, classifyPlays, validatePlay } from '../../../src/engine/guandan/combos';
import type { ComboForm } from '../../../src/engine/guandan/combos';
import { defaultPlayAction, legalActionsFor, legalPlays } from '../../../src/engine/guandan/generate';
import { nextInt, seedPrng, shuffle } from '../../../src/engine/core/prng';
import type { PrngState } from '../../../src/engine/core/prng';

const cfg = JIANGSU_OFFICIAL_ONLINE;
const vary = (overrides: Partial<RuleVariant>): RuleVariant => ({ ...cfg, ...overrides });

function form(
  type: ComboType,
  size: number,
  keyRank: Rank,
  extra?: { suit?: Suit; jokerRank?: 'SJ' | 'BJ'; demoted?: boolean },
): CanonicalForm {
  return { type, size, keyRank, ...extra } as CanonicalForm;
}

const single = (r: Rank): CanonicalForm => form('single', 1, r);
const pair = (r: Rank): CanonicalForm => form('pair', 2, r);
const triple = (r: Rank): CanonicalForm => form('triple', 3, r);
const fullHouse = (r: Rank): CanonicalForm => form('fullHouse', 5, r);
const straight = (top: Rank): CanonicalForm => form('straight', 5, top);
const tube = (top: Rank): CanonicalForm => form('tube', 6, top);
const plate = (top: Rank): CanonicalForm => form('plate', 6, top);
const bomb = (size: number, r: Rank): CanonicalForm => form('bomb', size, r);
const sf = (top: Rank, suit: Suit = 'S'): CanonicalForm => form('straightFlush', 5, top, { suit });
const jokerBomb: CanonicalForm = form('jokerBomb', 4, 'A');

/** Suit-blind projection fingerprint (spec §4.4.3 dedupe key): type, size,
 *  keyRank, plus the jokerRank / demoted extras that distinguish forms
 *  sharing a keyRank spelling. Suit deliberately dropped — SF suit is a
 *  realization detail, not a distinct move. */
function fp(decl: CanonicalForm): string {
  const x = decl as ComboForm;
  return [decl.type, decl.size, decl.keyRank, x.jokerRank ?? '-', x.demoted === true ? 'd' : '-'].join(':');
}

function fps(plays: { decl: CanonicalForm }[]): string[] {
  return plays.map((p) => fp(p.decl)).sort();
}

/** Deterministic randomness — the engine idiom (core/prng), never
 *  Math.random. Small closure that advances a local PrngState. */
function makeRand(seed: string): { rand: (bound: number) => number; draw: () => Card[] } {
  let state: PrngState = seedPrng(seed);
  const deck = buildDeck();
  return {
    rand(bound: number): number {
      const r = nextInt(state, bound);
      state = r.state;
      return r.value;
    },
    draw(): Card[] {
      const r = shuffle(deck, state);
      state = r.state;
      return r.items;
    },
  };
}

/** Random legal hand of `size` cards; `forceWilds` wild copies (♥level) are
 *  moved to the front so wild-heavy branches get exercised often. */
function randomHand(draw: () => Card[], size: number, level: Rank, forceWilds: number): Card[] {
  const deck = draw();
  const wild: Card = `${level}H`;
  const wilds = deck.filter((c) => c === wild).slice(0, forceWilds);
  const rest = deck.filter((c) => c !== wild);
  return wilds.concat(rest.slice(0, size - wilds.length));
}

const LEVELS: readonly Rank[] = ['2', '7', 'Q', 'A'];

// ---------------------------------------------------------------------------

describe('obligation 4 — randomized cross-check properties (§4.4.3)', () => {
  it('soundness: every generated play validates, comes from the hand, beats toBeat, and projections are unique', () => {
    const { rand, draw } = makeRand('smashegg-generate-soundness');
    const scenarios: (CanonicalForm | null)[] = [
      null,
      single('9'),
      pair('K'),
      triple('5'),
      fullHouse('T'),
      straight('9'),
      tube('6'),
      plate('7'),
      bomb(4, '8'),
      bomb(6, '3'),
      sf('T'),
      jokerBomb,
    ];
    const failures: string[] = [];
    for (let i = 0; i < 200; i++) {
      const level = LEVELS[i % LEVELS.length]!;
      const size = 5 + rand(23); // 5..27
      const hand = randomHand(draw, size, level, rand(3)); // 0..2 forced wilds
      for (const toBeat of scenarios) {
        const plays = legalPlays(hand, toBeat, level, cfg);
        const seen = new Set<string>();
        for (const play of plays) {
          const label = `hand#${i} level=${level} toBeat=${toBeat === null ? 'lead' : fp(toBeat)} play=${fp(play.decl)}`;
          if (removeCards(hand, play.cards) === null) failures.push(`${label}: cards not in hand`);
          const v = validatePlay(play.cards, play.decl, level, cfg);
          if (!v.ok) failures.push(`${label}: validatePlay ${v.error.code}`);
          if (toBeat !== null && !beats(play.decl, toBeat, level, cfg)) {
            failures.push(`${label}: does not beat`);
          }
          const key = fp(play.decl);
          if (seen.has(key)) failures.push(`${label}: duplicate projection`);
          seen.add(key);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('completeness: leading generation matches brute-force subset classification exactly', () => {
    // Brute force: classify EVERY subset of a small hand; the union of
    // canonical-form projections must equal what legalPlays emits. This is
    // the strongest form of the obligation-4 guarantee: no template family
    // over- or under-generates relative to combos.classifyPlays.
    const { rand, draw } = makeRand('smashegg-generate-completeness');
    for (let i = 0; i < 60; i++) {
      const level = LEVELS[i % LEVELS.length]!;
      const size = 4 + rand(5); // 4..8 — 2^8 subsets stays cheap
      const hand = randomHand(draw, size, level, rand(3));
      const brute = new Set<string>();
      for (let mask = 1; mask < 1 << hand.length; mask++) {
        const subset: Card[] = [];
        for (let b = 0; b < hand.length; b++) {
          if (mask & (1 << b)) subset.push(hand[b]!);
        }
        for (const f of classifyPlays(subset, level, cfg)) brute.add(fp(f));
      }
      const generated = new Set(legalPlays(hand, null, level, cfg).map((p) => fp(p.decl)));
      expect([...generated].sort(), `hand#${i} ${hand.join(',')} level=${level}`).toEqual([...brute].sort());
    }
  });
});

// ---------------------------------------------------------------------------

describe('§4.4.3 worked example and straight/SF generation', () => {
  it('§4.4.3 (v1.4): 3♠4♠5♠6♠ + wild ⇒ SF-top-7 and SF-top-6 ONLY — no plain-straight readings', () => {
    const hand: Card[] = ['3S', '4S', '5S', '6S', 'TH']; // level T ⇒ TH is a wild
    const plays = legalPlays(hand, null, 'T', cfg);
    const runs = plays.filter((p) => p.decl.type === 'straight' || p.decl.type === 'straightFlush');
    expect(fps(runs)).toEqual([
      'straightFlush:5:6:-:-',
      'straightFlush:5:7:-:-',
    ]);
    // Wild-frugal realizations still validate under their own decls.
    for (const play of runs) {
      expect(validatePlay(play.cards, play.decl, 'T', cfg)).toEqual({ ok: true });
    }
  });

  it('§3.8: fully-natural one-suit run yields ONLY the straight flush form (no under-declared straight)', () => {
    const plays = legalPlays(['3S', '4S', '5S', '6S', '7S'], null, '2', cfg);
    const runs = fps(plays.filter((p) => p.decl.type === 'straight' || p.decl.type === 'straightFlush'));
    expect(runs).toEqual(['straightFlush:5:7:-:-']);
  });

  it('§3.8: an off-suit natural copy makes the plain straight real (realization avoids the one-suit set)', () => {
    const plays = legalPlays(['3S', '4S', '5S', '6S', '7S', '7D'], null, '2', cfg);
    const straightPlay = plays.find((p) => fp(p.decl) === 'straight:5:7:-:-');
    expect(straightPlay).toBeDefined();
    // The realization must have used 7D — a one-suit set would be rejected.
    expect(straightPlay!.cards).toContain('7D');
    expect(validatePlay(straightPlay!.cards, straightPlay!.decl, '2', cfg)).toEqual({ ok: true });
  });

  it('§3.8 owner-extended (v1.4): one-suit naturals + wild generate NO plain straight — only the SF windows', () => {
    const hand: Card[] = ['3S', '4S', '5S', '6S', '7S', '2H']; // level 2 ⇒ 2H is a wild
    const plays = legalPlays(hand, null, '2', cfg);
    // Spending the wild on an off-suit identity would be exactly the
    // laundering R4c forbids — the suppression replaces the v1.3 wild-swap.
    expect(plays.some((p) => p.decl.type === 'straight')).toBe(false);
    const runs = fps(plays.filter((p) => p.decl.type === 'straightFlush'));
    expect(runs).toEqual([
      'straightFlush:5:6:-:-',
      'straightFlush:5:7:-:-',
      'straightFlush:5:8:-:-',
    ]);
    // Never orphaned (§1.3 lemma): every suppressed window survives as SF.
    for (const play of plays) {
      expect(validatePlay(play.cards, play.decl, '2', cfg)).toEqual({ ok: true });
    }
  });

  it('§3.8 variant allowUnderDeclareStraightFlush=true: the one-suit straight may be generated', () => {
    const config = vary({ allowUnderDeclareStraightFlush: true });
    const plays = legalPlays(['3S', '4S', '5S', '6S', '7S'], null, '2', config);
    const runs = fps(plays.filter((p) => p.decl.type === 'straight' || p.decl.type === 'straightFlush'));
    expect(runs).toEqual(['straight:5:7:-:-', 'straightFlush:5:7:-:-']);
  });

  it('§9.13: hearts SF through the level rank — the wild fills its own natural slot', () => {
    const hand: Card[] = ['8H', '9H', 'JH', 'QH', 'TH']; // level T ⇒ TH is the wild
    const plays = legalPlays(hand, null, 'T', cfg);
    const sfPlay = plays.find((p) => p.decl.type === 'straightFlush');
    expect(sfPlay).toBeDefined();
    expect(fp(sfPlay!.decl)).toBe('straightFlush:5:Q:-:-');
    expect(sfPlay!.cards).toContain('TH');
  });

  it('§3.7 variant wildStraightFlushIsBomb=false: substituted SF is generated demoted; wild-as-itself is not', () => {
    const config = vary({ wildStraightFlushIsBomb: false });
    // Substituting wild (2H stands for 7S): demoted, beats like a straight.
    const demotedPlays = legalPlays(['3S', '4S', '5S', '6S', '2H'], null, '2', config);
    const demotedSf = demotedPlays.filter((p) => p.decl.type === 'straightFlush').map((p) => fp(p.decl));
    expect(demotedSf.sort()).toEqual(['straightFlush:5:6:-:d', 'straightFlush:5:7:-:d']);
    expect(legalPlays(['3S', '4S', '5S', '6S', '2H'], bomb(4, '9'), '2', config)).toEqual([]);
    // Wild in its own hearts slot (§9.11): NOT demoted, still a bomb —
    // beats the 4-bomb per the §3.11 ladder (SF sits above 5-bombs).
    const heartsPlays = legalPlays(['8H', '9H', 'JH', 'QH', 'TH'], bomb(4, '9'), 'T', config);
    expect(fps(heartsPlays)).toEqual(['straightFlush:5:Q:-:-']);
  });
});

// ---------------------------------------------------------------------------

describe('§4.4.3 rank groups, joker guards, and bombs', () => {
  it('§4.4.3 sub-multisets: c(K)=3 yields the triple, the pair, AND the single', () => {
    expect(fps(legalPlays(['KS', 'KH', 'KC'], null, '2', cfg))).toEqual([
      'pair:2:K:-:-',
      'single:1:K:-:-',
      'triple:3:K:-:-',
    ]);
  });

  it('§4.1 joker guard: {BJ, wild} yields NO BJ pair (wilds never represent jokers)', () => {
    const plays = legalPlays(['BJ', 'TH'], null, 'T', cfg); // TH is the wild
    expect(fps(plays)).toEqual(['single:1:A:BJ:-', 'single:1:T:-:-']);
  });

  it('§4.4.3 joker guard: {9,9,9,SJ,wild} yields NO 999+SJSJ full house (joker pair needs c≥2 outright)', () => {
    const plays = legalPlays(['9S', '9C', '9D', 'SJ', 'TH'], null, 'T', cfg);
    const projections = fps(plays);
    expect(projections.some((p) => p.startsWith('fullHouse'))).toBe(false);
    expect(projections).toContain('bomb:4:9:-:-'); // 999 + wild IS a 4-bomb
  });

  it('§3.5: a real SJ pair does make the full house (fullHouseJokerPair=true), and the config gates it off', () => {
    const hand: Card[] = ['9S', '9C', '9D', 'SJ', 'SJ'];
    expect(fps(legalPlays(hand, null, 'T', cfg))).toContain('fullHouse:5:9:-:-');
    const gated = legalPlays(hand, null, 'T', vary({ fullHouseJokerPair: false }));
    expect(fps(gated).some((p) => p.startsWith('fullHouse'))).toBe(false);
  });

  it('§3.3/§9.14: 10-card bomb only via 8 naturals + 2 wilds; level-rank bombs cap at 8', () => {
    const wilds: Card[] = ['QH', 'QH']; // level Q
    const eights: Card[] = ['7S', '7S', '7H', '7H', '7C', '7C', '7D', '7D'];
    const plays = legalPlays([...eights, ...wilds], null, 'Q', cfg);
    const tenBomb = plays.find((p) => fp(p.decl) === 'bomb:10:7:-:-');
    expect(tenBomb).toBeDefined();
    expect(tenBomb!.cards.filter((c) => c === 'QH')).toHaveLength(2);
    // Without both wilds no 10-bomb exists (only 8 naturals per rank).
    const nine = legalPlays([...eights, 'QH'], null, 'Q', cfg);
    expect(fps(nine)).not.toContain('bomb:10:7:-:-');
    expect(fps(nine)).toContain('bomb:9:7:-:-');
    // Level rank: 6 naturals + 2 wilds (the other two copies ARE the wilds).
    const levelCards: Card[] = ['QS', 'QS', 'QC', 'QC', 'QD', 'QD', 'QH', 'QH'];
    const levelBombs = fps(legalPlays(levelCards, null, 'Q', cfg)).filter((p) => p.startsWith('bomb'));
    expect(levelBombs).toEqual([
      'bomb:4:Q:-:-',
      'bomb:5:Q:-:-',
      'bomb:6:Q:-:-',
      'bomb:7:Q:-:-',
      'bomb:8:Q:-:-',
    ]);
  });

  it('§4.4.3 joker bomb: emitted iff the hand holds all four jokers; beats even the 10-bomb (§3.11)', () => {
    const plays = legalPlays(['SJ', 'SJ', 'BJ', 'BJ', '3S'], bomb(10, '7'), '2', cfg);
    expect(fps(plays)).toEqual(['jokerBomb:4:A:-:-']);
    expect(legalPlays(['SJ', 'SJ', 'BJ', '3S'], null, '2', cfg).some((p) => p.decl.type === 'jokerBomb')).toBe(false);
    // Nothing ever beats a joker bomb (§3.11).
    expect(legalPlays(['SJ', 'SJ', 'BJ', 'BJ', '3S'], jokerBomb, '2', cfg)).toEqual([]);
  });

  it('§4.2: standalone wilds generate as level-rank forms only — never under-declared', () => {
    const plays = legalPlays(['2H', '2H'], null, '2', cfg); // both wilds, level 2
    expect(fps(plays)).toEqual(['pair:2:2:-:-', 'single:1:2:-:-']);
  });

  it('§2.5 A-low windows: AA2233 tube and AAA222 plate generate at their low tops', () => {
    expect(fps(legalPlays(['AS', 'AC', '2S', '2C', '3S', '3C'], null, '5', cfg))).toContain('tube:6:3:-:-');
    expect(fps(legalPlays(['AS', 'AC', 'AD', '2S', '2C', '2D'], null, '5', cfg))).toContain('plate:6:2:-:-');
  });
});

// ---------------------------------------------------------------------------

describe('legalActionsFor / defaultPlayAction (§5.2/§5.3, game.ts defaultAction contract)', () => {
  it('§5.2: the leader cannot pass — no pass action when mustLead', () => {
    const actions = legalActionsFor(['3S', '4D'], null, true, '2', cfg);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.type === 'pass')).toBe(false);
  });

  it('§5.3: a follower always gets exactly one pass, even with no beating play', () => {
    const actions = legalActionsFor(['3S', '4D'], single('A'), false, '2', cfg);
    expect(actions).toEqual([{ type: 'pass' }]);
    const canBeat = legalActionsFor(['AS', 'AD'], single('K'), false, '2', cfg);
    expect(canBeat.filter((a) => a.type === 'pass')).toHaveLength(1);
    expect(canBeat.filter((a) => a.type === 'play').length).toBeGreaterThan(0);
  });

  it('defaultPlayAction: pass when allowed; lowest legal single by levelValue when leading', () => {
    expect(defaultPlayAction(['KS', '3D'], single('9'), false, '2', cfg)).toEqual({ type: 'pass' });
    // Leading: 3D is the lowest by levelValue (TH is the elevated wild).
    const lead = defaultPlayAction(['KS', '3D', 'TH'], null, true, 'T', cfg);
    expect(lead).toEqual({ type: 'play', cards: ['3D'], decl: { type: 'single', size: 1, keyRank: '3' } });
    // A lone wild leads as the level card (§4.2); a lone joker as itself.
    expect(defaultPlayAction(['TH'], null, true, 'T', cfg)).toEqual({
      type: 'play',
      cards: ['TH'],
      decl: { type: 'single', size: 1, keyRank: 'T' },
    });
    expect(defaultPlayAction(['SJ'], null, true, 'T', cfg)).toEqual({
      type: 'play',
      cards: ['SJ'],
      decl: { type: 'single', size: 1, keyRank: 'A', jokerRank: 'SJ' },
    });
  });

  it('following filter: only beating projections are generated (§3 preamble + §3.10)', () => {
    const hand: Card[] = ['AS', 'AC', '3S', '3C', '5S', '5C', '5D', '5H'];
    const plays = legalPlays(hand, pair('K'), '2', cfg);
    expect(fps(plays)).toEqual(['bomb:4:5:-:-', 'pair:2:A:-:-']);
  });
});
