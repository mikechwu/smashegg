// Wild-card (the wild rule) selection disambiguation — spec v1.4 / the M3-hardening
// owner mission, per docs/research/wild-disambiguation.md (Option A,
// OWNER-SIGNED-OFF):
//
//   G1 — validatePlay enforces the owner-extended §3.8 guard (R4c): a
//        straight declaration whose NATURAL cards are all one suit is
//        rejected under allowUnderDeclareStraightFlush=false REGARDLESS of
//        wilds; classifyPlays / matchSelection / legalPlays inherit it.
//   G2 — classifyPlays returns the offered set in R5 strength order
//        (compareComboStrength, strongest first; the SF end-position pair
//        larger-on-top — owner pin).
//
// Layout: (1) every named edge row of the research doc §2 (S-*, FH-*,
// ST-*, SF-*, TP-*, B-*) asserted as the EXACT ORDERED offered set;
// (2) the four properties (P-SOUND / P-COMPLETE / P-MINIMAL /
// P-STABLY-ORDERED) over a seeded sweep with the doc §5.3 brute-force
// oracle — every wild assignment (≤ 52 + C(52+1,2) = 1378 for two wilds,
// order-free) pushed through an INDEPENDENT reference classifier (direct
// shape checks, no template reuse), R4 suppressions applied as
// selection-level filters; (3) the §5.4 generator sentinels (P6 flips to
// suppression; the deficit path gained the suit-union check).
//
// Two doc-table discrepancies found while implementing (the doc's "Offered"
// column, not the engine): FH-9 {7,7,W,K,K}@7 also offers fullHouse-K (the
// FH-1 dual-assignment pattern), and SF-8 {4♥5♥6♥+W+W}@7 offers THREE SF
// windows (the SF-4 pattern), not one. The oracle and the engine agree on
// both; the rows below assert the true sets.

import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/engine/guandan/cards';
import {
  RANKS,
  SUITS,
  buildDeck,
  isJoker,
  isWild,
  naturalValue,
  rankOf,
  suitOf,
} from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import type { CanonicalForm, ComboType } from '../../../src/engine/guandan/types';
import {
  classifyPlays,
  compareComboStrength,
  validatePlay,
} from '../../../src/engine/guandan/combos';
import type { ComboForm } from '../../../src/engine/guandan/combos';
import { legalPlays } from '../../../src/engine/guandan/generate';
import { nextInt, seedPrng, shuffle } from '../../../src/engine/core/prng';
import type { PrngState } from '../../../src/engine/core/prng';

const cfg = JIANGSU_OFFICIAL_ONLINE;
const vary = (overrides: Partial<RuleVariant>): RuleVariant => ({ ...cfg, ...overrides });

/** ORDERED fingerprint (combos.test.ts format, but NOT sorted — the whole
 *  point of G2 is the emission order). */
function ofp(f: CanonicalForm): string {
  const x = f as ComboForm;
  return [f.type, f.size, f.keyRank, f.suit ?? '-', x.jokerRank ?? '-', x.demoted === true ? 'demoted' : '-'].join(':');
}

function offered(cards: Card[], level: Rank, config: RuleVariant = cfg): string[] {
  return classifyPlays(cards, level, config).map(ofp);
}

/** Suit-blind projection (the doc §1.1 π — mirrors helpers.formProjectionKey,
 *  re-declared locally so the oracle comparison shares nothing with the
 *  client). */
function pk(f: { type: ComboType; size: number; keyRank: Rank; jokerRank?: string; demoted?: boolean }): string {
  return [f.type, f.size, f.keyRank, f.jokerRank ?? '', f.demoted === true ? 'D' : ''].join('|');
}

// ---------------------------------------------------------------------------
// §2.1 singles, pairs, triples — standalone-wild rule and joker exclusions.
// ---------------------------------------------------------------------------

describe('§2.1 singles/pairs/triples (S-1..S-9)', () => {
  it('S-1: lone wild is the level single only (R4a, §4.2)', () => {
    expect(offered(['2H'], '2')).toEqual(['single:1:2:-:-:-']);
  });

  it('S-2: two wilds are the level pair only (§9.7)', () => {
    expect(offered(['2H', '2H'], '2')).toEqual(['pair:2:2:-:-:-']);
  });

  it('S-3: natural + wild level pair — one reading (§4.2)', () => {
    expect(offered(['9S', '9H'], '9')).toEqual(['pair:2:9:-:-:-']);
  });

  it('S-4: wild completes a natural pair', () => {
    expect(offered(['KS', '2H'], '2')).toEqual(['pair:2:K:-:-:-']);
  });

  it('S-5: wild completes a triple', () => {
    expect(offered(['KS', 'KC', '2H'], '2')).toEqual(['triple:3:K:-:-:-']);
  });

  it('S-6: BOTH wilds in one triple slot-group', () => {
    expect(offered(['KS', '2H', '2H'], '2')).toEqual(['triple:3:K:-:-:-']);
  });

  it('S-7: wild never pairs a joker (§4.1)', () => {
    expect(offered(['SJ', '2H'], '2')).toEqual([]);
  });

  it('S-8: mixed jokers are never a pair (§2.2)', () => {
    expect(offered(['SJ', 'BJ'], '2')).toEqual([]);
  });

  it('S-9: lone wild under allowWildUnderDeclare=true offers all 13 singles, strongest first', () => {
    const c = vary({ allowWildUnderDeclare: true });
    expect(classifyPlays(['2H'], '2', c).map((f) => f.keyRank)).toEqual([
      '2', 'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3',
    ]);
  });
});

// ---------------------------------------------------------------------------
// §2.2 full houses.
// ---------------------------------------------------------------------------

describe('§2.2 full houses (FH-1..FH-9)', () => {
  it('FH-1 (owner mission example): {8,8,9,9,W} — dual assignment, two full houses, larger first', () => {
    expect(offered(['8S', '8D', '9S', '9D', '2H'], '2')).toEqual([
      'fullHouse:5:9:-:-:-',
      'fullHouse:5:8:-:-:-',
    ]);
  });

  it('FH-2: {9,9,9,K,W} — only fullHouse-9 (triple-K infeasible: 1 K + 1 W < 3)', () => {
    expect(offered(['9S', '9C', '9D', 'KS', '2H'], '2')).toEqual(['fullHouse:5:9:-:-:-']);
  });

  it('FH-3: {K,K,9,W,W} — split vs concentrated wilds, both keys', () => {
    expect(offered(['KS', 'KC', '9S', '2H', '2H'], '2')).toEqual([
      'fullHouse:5:K:-:-:-',
      'fullHouse:5:9:-:-:-',
    ]);
  });

  it('FH-4: {9,9,9,W,W} — bomb above the ONE fullHouse entry (pair rank invisible, R3)', () => {
    expect(offered(['9S', '9C', '9D', '2H', '2H'], '2')).toEqual([
      'bomb:5:9:-:-:-',
      'fullHouse:5:9:-:-:-',
    ]);
  });

  it('FH-5: wild-completed five-of-kind is the 5-bomb only (R4b, §3.6)', () => {
    expect(offered(['9S', '9C', '9D', '9H', '2H'], '2')).toEqual(['bomb:5:9:-:-:-']);
    // Variant: the fullHouse reading joins, bomb stays on top.
    expect(offered(['9S', '9C', '9D', '9H', '2H'], '2', vary({ fiveOfKindAsFullHouse: true }))).toEqual([
      'bomb:5:9:-:-:-',
      'fullHouse:5:9:-:-:-',
    ]);
  });

  it('FH-6: joker pair + wild-completed triple (fullHouseJokerPair default true; gated off → nothing)', () => {
    expect(offered(['9S', '9C', '2H', 'SJ', 'SJ'], '2')).toEqual(['fullHouse:5:9:-:-:-']);
    expect(offered(['9S', '9C', '2H', 'SJ', 'SJ'], '2', vary({ fullHouseJokerPair: false }))).toEqual([]);
  });

  it('FH-7: a lone joker completes nothing (wild never completes a joker pair, §4.1)', () => {
    expect(offered(['9S', '9C', '9D', 'SJ', '2H'], '2')).toEqual([]);
  });

  it('FH-8: mixed jokers never the pair (§2.2 invariant)', () => {
    expect(offered(['9S', '9C', '9D', 'SJ', 'BJ'], '2')).toEqual([]);
  });

  it('FH-9: {7,7,W,K,K}@7 — level triple on top AND the dual fullHouse-K (doc-table row was incomplete)', () => {
    expect(offered(['7S', '7C', '7H', 'KS', 'KC'], '7')).toEqual([
      'fullHouse:5:7:-:-:-', // levelValue 15 beats Aces-up (§9.6)
      'fullHouse:5:K:-:-:-', // wild into the K-triple, 7s as the pair
    ]);
  });
});

// ---------------------------------------------------------------------------
// §2.3 plain straights (mixed-suit naturals — no SF interplay).
// ---------------------------------------------------------------------------

describe('§2.3 plain straights (ST-1..ST-9)', () => {
  it('ST-1: interior gap', () => {
    expect(offered(['5S', '6D', '8C', '9S', '2H'], '2')).toEqual(['straight:5:9:-:-:-']);
  });

  it('ST-2 (owner mission example): 4-consecutive + wild — BOTH end positions, larger on top', () => {
    expect(offered(['5S', '6D', '7C', '8H', '2H'], '2')).toEqual([
      'straight:5:9:-:-:-',
      'straight:5:8:-:-:-',
    ]);
  });

  it('ST-3: two wilds, three windows, descending', () => {
    expect(offered(['5S', '6D', '7C', '2H', '2H'], '2')).toEqual([
      'straight:5:9:-:-:-',
      'straight:5:8:-:-:-',
      'straight:5:7:-:-:-',
    ]);
  });

  it('ST-4: top boundary — no wrap above A (§2.5)', () => {
    expect(offered(['JS', 'QD', 'KC', 'AS', '2H'], '2')).toEqual(['straight:5:A:-:-:-']);
  });

  it('ST-5: bottom boundary — nothing below A-low', () => {
    expect(offered(['AS', '2D', '3C', '4S', '7H'], '7')).toEqual(['straight:5:5:-:-:-']);
  });

  it('ST-6: wild in its own natural slot (window with two deficits infeasible)', () => {
    expect(offered(['4S', '5D', '6H', '7C', '8S'], '6')).toEqual(['straight:5:8:-:-:-']);
  });

  it('ST-7: level = A — wild as itself A-high AND as a 9 (both readings)', () => {
    expect(offered(['TS', 'JD', 'QC', 'KS', 'AH'], 'A')).toEqual([
      'straight:5:A:-:-:-',
      'straight:5:K:-:-:-',
    ]);
  });

  it('ST-8: A-boundary with two wilds — window 3-7 blocked by the natural 2', () => {
    expect(offered(['2S', '3D', '4C', '7H', '7H'], '7')).toEqual([
      'straight:5:6:-:-:-',
      'straight:5:5:-:-:-',
    ]);
  });

  it('ST-9: 3+1-suit naturals — R4c does NOT fire, both windows retained, no SF exists', () => {
    expect(offered(['5S', '6S', '7S', '8D', '2H'], '2')).toEqual([
      'straight:5:9:-:-:-',
      'straight:5:8:-:-:-',
    ]);
  });
});

// ---------------------------------------------------------------------------
// §2.4 straight flushes and the §3.8/R4c interplay (Option A).
// ---------------------------------------------------------------------------

describe('§2.4 straight flushes / R4c (SF-1..SF-12)', () => {
  it('SF-1 (§9.18): 2♠3♠4♠5♠+W — ONLY the two SFs, larger-on-top (owner pin)', () => {
    expect(offered(['2S', '3S', '4S', '5S', '6H'], '6')).toEqual([
      'straightFlush:5:6:S:-:-',
      'straightFlush:5:5:S:-:-',
    ]);
  });

  it('SF-2: interior wild — one SF window, no plain straight', () => {
    expect(offered(['5S', '6S', '7S', '9S', '2H'], '2')).toEqual(['straightFlush:5:9:S:-:-']);
  });

  it('SF-3: one wild, both ends — SF pair larger-on-top, straights suppressed', () => {
    expect(offered(['5S', '6S', '7S', '8S', '2H'], '2')).toEqual([
      'straightFlush:5:9:S:-:-',
      'straightFlush:5:8:S:-:-',
    ]);
  });

  it('SF-4: two wilds, three SF windows, descending — the chooser-size bound witness', () => {
    expect(offered(['5S', '6S', '7S', '2H', '2H'], '2')).toEqual([
      'straightFlush:5:9:S:-:-',
      'straightFlush:5:8:S:-:-',
      'straightFlush:5:7:S:-:-',
    ]);
  });

  it('SF-5: top boundary — single window, no wrap', () => {
    expect(offered(['JS', 'QS', 'KS', 'AS', '2H'], '2')).toEqual(['straightFlush:5:A:S:-:-']);
  });

  it('SF-6: bottom boundary (A-low)', () => {
    expect(offered(['AS', '2S', '3S', '4S', '7H'], '7')).toEqual(['straightFlush:5:5:S:-:-']);
  });

  it('SF-7: physically-all-hearts run whose own card is the wild — SF only (the P11 oddity, fixed)', () => {
    expect(offered(['4H', '5H', '6H', '7H', '8H'], '7')).toEqual(['straightFlush:5:8:H:-:-']);
  });

  it('SF-8: 3 hearts + both wilds — THREE SF windows (doc-table row was incomplete), no straights', () => {
    expect(offered(['4H', '5H', '6H', '7H', '7H'], '7')).toEqual([
      'straightFlush:5:8:H:-:-',
      'straightFlush:5:7:H:-:-',
      'straightFlush:5:6:H:-:-',
    ]);
  });

  it('SF-9: fully-natural one-suit run — unchanged v1.3 §3.8 guard', () => {
    expect(offered(['5S', '6S', '7S', '8S', '9S'], '2')).toEqual(['straightFlush:5:9:S:-:-']);
  });

  it('SF-10: natural mixed run — plain straight only (no SF suit validates)', () => {
    expect(offered(['5S', '6S', '7S', '8S', '9D'], '2')).toEqual(['straight:5:9:-:-:-']);
  });

  it('SF-11: wildStraightFlushIsBomb=false — ONE demoted entry, straight still suppressed (§1.3)', () => {
    const c = vary({ wildStraightFlushIsBomb: false });
    expect(offered(['5S', '6S', '7S', '9S', '2H'], '2', c)).toEqual([
      'straightFlush:5:9:S:-:demoted',
    ]);
  });

  it('SF-11b interplay: demotion + allowUnderDeclareStraightFlush=true — demoted SF sorts above the equal-window straight', () => {
    const c = vary({ wildStraightFlushIsBomb: false, allowUnderDeclareStraightFlush: true });
    expect(offered(['5S', '6S', '7S', '9S', '2H'], '2', c)).toEqual([
      'straightFlush:5:9:S:-:demoted', // non-bomb, equal key — TYPE_ORDER tiebreak
      'straight:5:9:-:-:-',
    ]);
  });

  it('SF-12: allowUnderDeclareStraightFlush=true — SFs (bombs) on top, then the straights', () => {
    const c = vary({ allowUnderDeclareStraightFlush: true });
    expect(offered(['5S', '6S', '7S', '8S', '2H'], '2', c)).toEqual([
      'straightFlush:5:9:S:-:-',
      'straightFlush:5:8:S:-:-',
      'straight:5:9:-:-:-',
      'straight:5:8:-:-:-',
    ]);
  });
});

// ---------------------------------------------------------------------------
// §2.5 tubes and plates.
// ---------------------------------------------------------------------------

describe('§2.5 tubes and plates (TP-1..TP-8)', () => {
  it('TP-1: deficits split across ranks — tube only', () => {
    expect(offered(['4S', '4C', '5D', '6S', '2H', '2H'], '2')).toEqual(['tube:6:6:-:-:-']);
  });

  it('TP-2 (owner mission example): both-end extension + cross-type — tube-6, plate-5, tube-5', () => {
    expect(offered(['4S', '4D', '5S', '5D', '2H', '2H'], '2')).toEqual([
      'tube:6:6:-:-:-',
      'plate:6:5:-:-:-', // equal key 5: plate above tube (pinned presentation tiebreak)
      'tube:6:5:-:-:-',
    ]);
  });

  it('TP-3: the P1 twin one rank up', () => {
    expect(offered(['5S', '5D', '6S', '6D', '2H', '2H'], '2')).toEqual([
      'tube:6:7:-:-:-',
      'plate:6:6:-:-:-',
      'tube:6:6:-:-:-',
    ]);
  });

  it('TP-4: A-boundary — lowest-of-family windows only, no wrap (§3.2)', () => {
    expect(offered(['AS', 'AC', '2S', '2C', '7H', '7H'], '7')).toEqual([
      'tube:6:3:-:-:-',
      'plate:6:2:-:-:-',
    ]);
  });

  it('TP-5: one wild — plate only (third 5 has no tube slot)', () => {
    expect(offered(['5S', '5C', '5D', '6S', '6C', '2H'], '2')).toEqual(['plate:6:6:-:-:-']);
  });

  it('TP-6: plate only (third 6 has no tube slot)', () => {
    expect(offered(['6S', '6C', '6D', '7S', '7C', '2H'], '2')).toEqual(['plate:6:7:-:-:-']);
  });

  it('TP-7: same-rank six — the 6-bomb, never a "plate of 6-and-6"', () => {
    expect(offered(['6S', '6S', '6C', '6C', '2H', '2H'], '2')).toEqual(['bomb:6:6:-:-:-']);
  });

  it('TP-8: plate-6 only (tube 4-6 infeasible: third 5 has no slot)', () => {
    expect(offered(['5S', '5C', '5D', '6S', '2H', '2H'], '2')).toEqual(['plate:6:6:-:-:-']);
  });
});

// ---------------------------------------------------------------------------
// §2.6 bombs 4–10 and level-rank caps; §2.7 joker exclusions.
// ---------------------------------------------------------------------------

describe('§2.6 bombs (B-1..B-8)', () => {
  it('B-1/B-2: wild-completed 4-bombs (one and two wilds)', () => {
    expect(offered(['KS', 'KC', 'KD', '2H'], '2')).toEqual(['bomb:4:K:-:-:-']);
    expect(offered(['KS', 'KC', '2H', '2H'], '2')).toEqual(['bomb:4:K:-:-:-']);
  });

  it('B-3: two wilds cannot bridge two ranks in a 4-set', () => {
    expect(offered(['KS', '9S', '2H', '2H'], '2')).toEqual([]);
  });

  it('B-4: every bomb size 4..10 — the 10-bomb only as 8 naturals + 2 wilds (§9.14)', () => {
    const kings: Card[] = ['KS', 'KS', 'KC', 'KC', 'KD', 'KD', 'KH', 'KH', '2H', '2H'];
    for (let size = 4; size <= 10; size++) {
      expect(offered(kings.slice(0, size), '2'), `size ${size}`).toEqual([`bomb:${size}:K:-:-:-`]);
    }
  });

  it('B-5: all 8 level-rank copies (wilds as themselves) — the level cap by pure counting', () => {
    expect(offered(['7S', '7S', '7C', '7C', '7D', '7D', '7H', '7H'], '7')).toEqual(['bomb:8:7:-:-:-']);
  });

  it('B-6: the four jokers are ONLY the joker bomb', () => {
    expect(offered(['SJ', 'SJ', 'BJ', 'BJ'], '2')).toEqual(['jokerBomb:4:A:-:-:-']);
  });

  it('B-7: wilds never join the joker bomb; jokers never join rank bombs', () => {
    expect(offered(['2H', '2H', 'SJ', 'SJ'], '2')).toEqual([]);
  });

  it('B-8: 7..10-card selections are bombs or nothing', () => {
    expect(offered(['AS', 'AS', 'AC', 'AC', 'AD', 'AD', 'AH', '2H', '2H'], '2')).toEqual(['bomb:9:A:-:-:-']);
  });
});

// ---------------------------------------------------------------------------
// compareComboStrength — the §4.3 comparator, directly.
// ---------------------------------------------------------------------------

describe('compareComboStrength (§4.3 exact comparator)', () => {
  const f = (
    type: ComboType,
    size: number,
    keyRank: Rank,
    extra?: { suit?: Suit; jokerRank?: 'SJ' | 'BJ'; demoted?: boolean },
  ): CanonicalForm => ({ type, size, keyRank, ...extra }) as CanonicalForm;

  it('bombs above non-bombs; §3.11 ladder inside bombs', () => {
    expect(compareComboStrength(f('bomb', 4, '2'), f('straight', 5, 'A'), '5', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('jokerBomb', 4, 'A'), f('bomb', 10, 'K'), '5', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('straightFlush', 5, '6', { suit: 'S' }), f('bomb', 5, '5'), '5', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('bomb', 6, '3'), f('straightFlush', 5, 'A', { suit: 'S' }), '5', cfg)).toBeGreaterThan(0);
  });

  it('SF end-position pair: larger-on-top (owner pin)', () => {
    expect(compareComboStrength(f('straightFlush', 5, '7', { suit: 'S' }), f('straightFlush', 5, '6', { suit: 'S' }), '2', cfg)).toBeGreaterThan(0);
  });

  it('non-bombs by key (levelValue for rank-keyed, naturalValue for sequences, jokers 16/17)', () => {
    expect(compareComboStrength(f('single', 1, '7'), f('single', 1, 'A'), '7', cfg)).toBeGreaterThan(0); // level card
    expect(compareComboStrength(f('pair', 2, 'A', { jokerRank: 'SJ' }), f('pair', 2, '7'), '7', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('fullHouse', 5, '9'), f('fullHouse', 5, '8'), '2', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('straight', 5, '6'), f('straight', 5, '5'), '2', cfg)).toBeGreaterThan(0);
  });

  it('equal-key cross-type tiebreak: plate above tube; demoted SF above the equal-window straight', () => {
    expect(compareComboStrength(f('plate', 6, '5'), f('tube', 6, '5'), '2', cfg)).toBeGreaterThan(0);
    expect(compareComboStrength(f('tube', 6, '6'), f('plate', 6, '5'), '2', cfg)).toBeGreaterThan(0); // key wins first
    const c = vary({ wildStraightFlushIsBomb: false, allowUnderDeclareStraightFlush: true });
    expect(
      compareComboStrength(f('straightFlush', 5, '9', { suit: 'S', demoted: true }), f('straight', 5, '9'), '2', c),
    ).toBeGreaterThan(0);
  });

  it('is an exact antisymmetric numeric order on examples', () => {
    const forms = [
      f('bomb', 4, '2'),
      f('straightFlush', 5, '9', { suit: 'S' }),
      f('straight', 5, '9'),
      f('plate', 6, '5'),
      f('tube', 6, '5'),
      f('single', 1, 'A'),
      f('pair', 2, 'A', { jokerRank: 'BJ' }),
    ];
    for (const a of forms) {
      expect(compareComboStrength(a, a, '2', cfg)).toBe(0);
      for (const b of forms) {
        // sign(cmp(a,b)) + sign(cmp(b,a)) == 0 — antisymmetry without the
        // -0/+0 Object.is trap.
        expect(
          Math.sign(compareComboStrength(a, b, '2', cfg)) + Math.sign(compareComboStrength(b, a, '2', cfg)),
        ).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// §5.3 completeness oracle — brute force over wild assignments through an
// independent reference classifier.
// ---------------------------------------------------------------------------

interface RefForm {
  type: ComboType;
  size: number;
  keyRank: Rank;
  suit?: Suit;
  jokerRank?: 'SJ' | 'BJ';
  demoted?: boolean;
}

function rankAtValue(v: number): Rank {
  return v === 1 ? 'A' : RANKS[v - 2]!;
}

/** Top rank of a consecutive run over DISTINCT ranks, honoring A-duality
 *  (A = 14 or 1, no wrap); null when not consecutive. Independent of the
 *  engine's sequenceWindow. */
function runTop(ranks: readonly Rank[]): Rank | null {
  const high = ranks.map(naturalValue).sort((a, b) => a - b);
  if (new Set(high).size === high.length && high[high.length - 1]! - high[0]! === high.length - 1) {
    return rankAtValue(high[high.length - 1]!);
  }
  if (ranks.includes('A')) {
    const low = ranks.map((r) => (r === 'A' ? 1 : naturalValue(r))).sort((a, b) => a - b);
    if (low[0] === 1 && new Set(low).size === low.length && low[low.length - 1]! - low[0]! === low.length - 1) {
      return rankAtValue(low[low.length - 1]!);
    }
  }
  return null;
}

/** Reference classifier for an ALL-NATURAL multiset (wilds already
 *  substituted; jokers may remain — they were never wilds): direct shape
 *  checks per the spec §3 table, no templates, no validatePlay reuse.
 *  Config-scoped shape rules (§3.5 joker pair, §3.6 five-of-kind) applied
 *  here because they are statements about the SHAPE, not about wilds. */
function refClassify(cards: readonly Card[], config: RuleVariant): RefForm[] {
  const out: RefForm[] = [];
  const n = cards.length;
  let sj = 0;
  let bj = 0;
  const byRank = new Map<Rank, number>();
  const suits = new Set<Suit>();
  for (const card of cards) {
    if (card === 'SJ') sj++;
    else if (card === 'BJ') bj++;
    else {
      const r = rankOf(card)!;
      byRank.set(r, (byRank.get(r) ?? 0) + 1);
      suits.add(suitOf(card)!);
    }
  }
  const jokers = sj + bj;
  const ranks = [...byRank.keys()];
  const allEqual = jokers === 0 && ranks.length === 1;

  if (n === 1) {
    if (sj === 1) out.push({ type: 'single', size: 1, keyRank: 'A', jokerRank: 'SJ' });
    else if (bj === 1) out.push({ type: 'single', size: 1, keyRank: 'A', jokerRank: 'BJ' });
    else out.push({ type: 'single', size: 1, keyRank: ranks[0]! });
  } else if (n === 2) {
    if (sj === 2) out.push({ type: 'pair', size: 2, keyRank: 'A', jokerRank: 'SJ' });
    else if (bj === 2) out.push({ type: 'pair', size: 2, keyRank: 'A', jokerRank: 'BJ' });
    else if (allEqual) out.push({ type: 'pair', size: 2, keyRank: ranks[0]! });
  } else if (n === 3) {
    if (allEqual) out.push({ type: 'triple', size: 3, keyRank: ranks[0]! });
  } else if (n === 4) {
    if (sj === 2 && bj === 2) out.push({ type: 'jokerBomb', size: 4, keyRank: 'A' });
    else if (allEqual) out.push({ type: 'bomb', size: 4, keyRank: ranks[0]! });
  } else if (n === 5) {
    if (allEqual) {
      out.push({ type: 'bomb', size: 5, keyRank: ranks[0]! });
      if (config.fiveOfKindAsFullHouse) out.push({ type: 'fullHouse', size: 5, keyRank: ranks[0]! });
    } else if (jokers === 0 && ranks.length === 2) {
      const [a, b] = ranks as [Rank, Rank];
      if (byRank.get(a) === 3 && byRank.get(b) === 2) out.push({ type: 'fullHouse', size: 5, keyRank: a });
      else if (byRank.get(a) === 2 && byRank.get(b) === 3) out.push({ type: 'fullHouse', size: 5, keyRank: b });
    } else if ((sj === 2 || bj === 2) && jokers === 2 && ranks.length === 1 && byRank.get(ranks[0]!) === 3) {
      if (config.fullHouseJokerPair) out.push({ type: 'fullHouse', size: 5, keyRank: ranks[0]! });
    }
    if (jokers === 0 && ranks.length === 5) {
      const top = runTop(ranks);
      if (top !== null) {
        out.push({ type: 'straight', size: 5, keyRank: top });
        if (suits.size === 1) {
          out.push({ type: 'straightFlush', size: 5, keyRank: top, suit: [...suits][0]! });
        }
      }
    }
  } else if (n === 6) {
    if (allEqual) out.push({ type: 'bomb', size: 6, keyRank: ranks[0]! });
    else if (jokers === 0) {
      if (ranks.length === 3 && ranks.every((r) => byRank.get(r) === 2)) {
        const top = runTop(ranks);
        if (top !== null) out.push({ type: 'tube', size: 6, keyRank: top });
      }
      if (ranks.length === 2 && ranks.every((r) => byRank.get(r) === 3)) {
        const top = runTop(ranks);
        if (top !== null) out.push({ type: 'plate', size: 6, keyRank: top });
      }
    }
  } else if (n >= 7 && n <= 10) {
    if (allEqual) out.push({ type: 'bomb', size: n, keyRank: ranks[0]! });
  }
  return out;
}

const ALL_IDENTITIES: Card[] = (() => {
  const ids: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) ids.push(`${r}${s}` as Card);
  return ids;
})();

/** Independent 5-rank window of a straight-flush top (for the demoted
 *  recomputation) — NOT the engine's sequenceWindow. */
function windowRanks(top: Rank): Rank[] {
  const t = naturalValue(top);
  const out: Rank[] = [];
  for (let v = t - 4; v <= t; v++) out.push(rankAtValue(v));
  return out;
}

/** The doc §5.3 oracle: substitute every non-joker identity for each wild
 *  (order-free pairs for two wilds — ≤ 1378 assignments), classify each
 *  substituted ALL-NATURAL multiset independently, union the projections,
 *  then apply the R4 suppressions as selection-level filters on S and
 *  recompute `demoted` from S + window directly (substitution loses which
 *  slots were wild). */
function oracleOffered(selection: readonly Card[], level: Rank, config: RuleVariant): Set<string> {
  const wilds = selection.filter((c) => isWild(c, level));
  const rest = selection.filter((c) => !isWild(c, level));

  let assignments: Card[][];
  if (wilds.length === 0) assignments = [[]];
  else if (wilds.length === 1) assignments = ALL_IDENTITIES.map((i) => [i]);
  else {
    assignments = [];
    for (let i = 0; i < ALL_IDENTITIES.length; i++) {
      for (let j = i; j < ALL_IDENTITIES.length; j++) {
        assignments.push([ALL_IDENTITIES[i]!, ALL_IDENTITIES[j]!]);
      }
    }
  }

  const union = new Map<string, RefForm>();
  for (const assign of assignments) {
    for (const f of refClassify([...rest, ...assign], config)) {
      if (f.type === 'straightFlush') {
        // §3.7 demoted recomputed from S: the (level,♥) slot of a hearts
        // window is wild-as-itself (§9.11), everything else substitutes.
        const substituting = wilds.length - (f.suit === 'H' && windowRanks(f.keyRank).includes(level) ? 1 : 0);
        if (!config.wildStraightFlushIsBomb && substituting > 0) f.demoted = true;
      }
      union.set(pk(f), f);
    }
  }

  // R4a (§4.2): an all-wild single/pair offers only the level rank.
  if (rest.length === 0 && selection.length <= 2 && !config.allowWildUnderDeclare) {
    for (const [k, f] of [...union]) {
      if (f.keyRank !== level) union.delete(k);
    }
  }
  // R4c (owner-extended §3.8): one-suit NATURALS never offer a plain straight.
  if (!config.allowUnderDeclareStraightFlush) {
    const naturalSuits = new Set(rest.filter((c) => !isJoker(c)).map((c) => suitOf(c)!));
    if (naturalSuits.size === 1) {
      for (const [k, f] of [...union]) {
        if (f.type === 'straight') union.delete(k);
      }
    }
  }
  return new Set(union.keys());
}

// ---------------------------------------------------------------------------
// The four properties (doc §5.2) over a seeded sweep + the 2^5 config grid.
// ---------------------------------------------------------------------------

const SWEEP_KEYS = [
  'allowUnderDeclareStraightFlush',
  'wildStraightFlushIsBomb',
  'allowWildUnderDeclare',
  'fiveOfKindAsFullHouse',
  'fullHouseJokerPair',
] as const;

function sweepConfig(mask: number): RuleVariant {
  const overrides: Partial<RuleVariant> = {};
  SWEEP_KEYS.forEach((key, i) => {
    overrides[key] = (mask & (1 << i)) !== 0;
  });
  return vary(overrides);
}

function configName(config: RuleVariant): string {
  return SWEEP_KEYS.map((k) => `${k}=${config[k]}`).join(' ');
}

interface Sweeper {
  rand: (bound: number) => number;
  selection: (level: Rank) => Card[];
}

function makeSweeper(seed: string): Sweeper {
  let state: PrngState = seedPrng(seed);
  const deck = buildDeck();
  const rand = (bound: number): number => {
    const r = nextInt(state, bound);
    state = r.state;
    return r.value;
  };
  const selection = (level: Rank): Card[] => {
    const sh = shuffle(deck, state);
    state = sh.state;
    const wild: Card = `${level}H`;
    const size = 1 + rand(10);
    // ≥50% wild inclusion (doc §5.2): 0 wilds 1/3 of the time, else 1-2.
    const wantWilds = Math.min(rand(3) === 0 ? 0 : 1 + rand(2), size);
    const wilds = sh.items.filter((c) => c === wild).slice(0, wantWilds);
    // Cluster the rest into a narrow rank band so pairs/bombs/sequences
    // (the interesting shapes) appear often; uniform picks otherwise.
    let pool: Card[];
    if (rand(4) === 0) {
      pool = sh.items.filter((c) => c !== wild);
    } else {
      const base = rand(13);
      const span = 1 + rand(4);
      const keepJokers = rand(4) === 0;
      pool = sh.items.filter((c) => {
        if (c === wild) return false;
        if (isJoker(c)) return keepJokers;
        const idx = RANKS.indexOf(rankOf(c)!);
        return idx >= base && idx < base + span;
      });
      if (pool.length < size) pool = pool.concat(sh.items.filter((c) => c !== wild && !pool.includes(c)));
    }
    return wilds.concat(pool.slice(0, size - wilds.length));
  };
  return { rand, selection };
}

/** Run all four properties on one selection; returns a failure label or
 *  null. Collected (not thrown) so a sweep reports every disagreement. */
function checkProperties(selection: Card[], level: Rank, config: RuleVariant): string | null {
  const label = `[${selection.join(',')}] level=${level} ${configName(config)}`;
  const forms = classifyPlays(selection, level, config);

  // P-SOUND: every emitted form validates.
  for (const f of forms) {
    const v = validatePlay(selection, f, level, config);
    if (!v.ok) return `${label}: P-SOUND ${ofp(f)} → ${v.error.code}`;
  }

  // P-MINIMAL: no duplicate projections; no R4-suppressed entries.
  const projections = forms.map((f) => pk(f as RefForm));
  if (new Set(projections).size !== projections.length) return `${label}: P-MINIMAL duplicate projection`;
  const naturals = selection.filter((c) => !isWild(c, level) && !isJoker(c));
  if (!config.allowUnderDeclareStraightFlush && naturals.length > 0) {
    const suitSet = new Set(naturals.map((c) => suitOf(c)!));
    if (suitSet.size === 1 && forms.some((f) => f.type === 'straight')) {
      return `${label}: P-MINIMAL R4c-suppressed straight emitted`;
    }
  }
  if (
    naturals.length === 0 &&
    selection.length <= 2 &&
    selection.every((c) => isWild(c, level)) &&
    !config.allowWildUnderDeclare &&
    forms.some((f) => f.keyRank !== level)
  ) {
    return `${label}: P-MINIMAL R4a-suppressed under-declaration emitted`;
  }

  // P-COMPLETE: projection-set equality with the brute-force oracle.
  const oracle = oracleOffered(selection, level, config);
  const emitted = new Set(projections);
  for (const k of oracle) if (!emitted.has(k)) return `${label}: P-COMPLETE missing ${k}`;
  for (const k of emitted) if (!oracle.has(k)) return `${label}: P-COMPLETE extra ${k}`;

  // P-STABLY-ORDERED: strictly descending; antisymmetric & transitive on
  // the emitted set.
  for (let i = 0; i < forms.length; i++) {
    for (let j = i + 1; j < forms.length; j++) {
      const ij = compareComboStrength(forms[i]!, forms[j]!, level, config);
      const ji = compareComboStrength(forms[j]!, forms[i]!, level, config);
      if (ij <= 0) return `${label}: P-STABLY-ORDERED ${ofp(forms[i]!)} !> ${ofp(forms[j]!)}`;
      if (Math.sign(ij) !== -Math.sign(ji)) return `${label}: comparator not antisymmetric`;
      for (let k = j + 1; k < forms.length; k++) {
        const jk = compareComboStrength(forms[j]!, forms[k]!, level, config);
        const ik = compareComboStrength(forms[i]!, forms[k]!, level, config);
        if (ij > 0 && jk > 0 && ik <= 0) return `${label}: comparator not transitive`;
      }
    }
  }

  // Chooser-size bound (doc §2, PROVED ≤3 under the default config).
  if (
    !config.allowUnderDeclareStraightFlush &&
    !config.allowWildUnderDeclare &&
    forms.length > 3
  ) {
    return `${label}: chooser-size bound exceeded (${forms.length})`;
  }
  return null;
}

describe('§5.2 the four properties over the seeded sweep × 2^5 config grid', () => {
  it('random selections: sound, complete vs the wild-assignment oracle, minimal, stably ordered', () => {
    const failures: string[] = [];
    for (let mask = 0; mask < 1 << SWEEP_KEYS.length; mask++) {
      const config = sweepConfig(mask);
      const sweeper = makeSweeper(`wild-disambiguation:${mask}`);
      const samples = mask === 0 ? 120 : 24; // default profile gets the deep pass
      for (let i = 0; i < samples; i++) {
        const level = RANKS[(mask + i) % RANKS.length]!;
        const selection = sweeper.selection(level);
        const failure = checkProperties(selection, level, config);
        if (failure !== null) failures.push(failure);
      }
    }
    expect(failures).toEqual([]);
  });

  it('exhaustive rank-projected multisets, sizes 1–3 (default + allowWildUnderDeclare)', () => {
    // Alphabet: one representative suit per rank (suits are irrelevant
    // below size 5), the wild, and both jokers — ≤2 copies each, exactly
    // as the double deck supplies them.
    const level: Rank = '9';
    const symbols: Card[] = [...RANKS.map((r) => `${r}S` as Card), `${level}H` as Card, 'SJ', 'BJ'];
    const multisets: Card[][] = [];
    for (let i = 0; i < symbols.length; i++) {
      multisets.push([symbols[i]!]);
      for (let j = i; j < symbols.length; j++) {
        multisets.push([symbols[i]!, symbols[j]!]);
        for (let k = j; k < symbols.length; k++) {
          if (i === j && j === k) continue; // only 2 copies of any identity exist
          multisets.push([symbols[i]!, symbols[j]!, symbols[k]!]);
        }
      }
    }
    const failures: string[] = [];
    for (const config of [cfg, vary({ allowWildUnderDeclare: true })]) {
      for (const selection of multisets) {
        const failure = checkProperties(selection, level, config);
        if (failure !== null) failures.push(failure);
      }
    }
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §5.4 generator sentinels — obligation 4 across the R4c predicate change.
// ---------------------------------------------------------------------------

describe('§5.4 generator cross-surface sentinels (realizeStraight predicate)', () => {
  it('P6 sentinel: 5♠6♠7♠8♠9♠+W generates NO plain straights; all three SF windows remain', () => {
    const plays = legalPlays(['5S', '6S', '7S', '8S', '9S', '2H'], null, '2', cfg);
    expect(plays.some((p) => p.decl.type === 'straight')).toBe(false);
    const sfTops = plays
      .filter((p) => p.decl.type === 'straightFlush')
      .map((p) => p.decl.keyRank)
      .sort();
    expect(sfTops).toEqual(['8', '9', 'T']);
    for (const p of plays) {
      expect(validatePlay(p.cards, p.decl, '2', cfg), ofp(p.decl)).toEqual({ ok: true });
    }
  });

  it('deficit path suppression: one-suit in-window pool + wild-filled gap emits no straight (the G3 corollary)', () => {
    // Window 5-9 has deficit 1 (the 8) and a pure-♠ natural pool: v1.3's
    // deficit path had NO suit check at all — v1.4 suppresses.
    const plays = legalPlays(['5S', '6S', '7S', '9S', '2H'], null, '2', cfg);
    expect(plays.some((p) => p.decl.type === 'straight')).toBe(false);
    expect(plays.some((p) => p.decl.type === 'straightFlush' && p.decl.keyRank === '9')).toBe(true);
  });

  it('deficit path with a mixed pool still emits, and the realization validates', () => {
    const plays = legalPlays(['5S', '6D', '7S', '9S', '2H'], null, '2', cfg);
    const straight = plays.find((p) => p.decl.type === 'straight' && p.decl.keyRank === '9');
    expect(straight).toBeDefined();
    expect(validatePlay(straight!.cards, straight!.decl, '2', cfg)).toEqual({ ok: true });
  });

  it('deficit path swaps in an off-suit copy when the default picks are one-suit', () => {
    // byRank sorting picks 5C first (one-suit ♣ picks) — the pool's 5S
    // must be swapped in for the realization to validate under v1.4.
    const plays = legalPlays(['5C', '5S', '6C', '7C', '9C', '2H'], null, '2', cfg);
    const straight = plays.find((p) => p.decl.type === 'straight' && p.decl.keyRank === '9');
    expect(straight).toBeDefined();
    expect(straight!.cards).toContain('5S');
    expect(validatePlay(straight!.cards, straight!.decl, '2', cfg)).toEqual({ ok: true });
  });

  it('obligation 4 (i): every generated play validates under its own decl across the R4c-relevant configs', () => {
    // Legal hands only: sub-multisets of one shuffled 108-card deal with
    // 0-2 wilds forced to the front (the generate.test.ts idiom).
    let state: PrngState = seedPrng('wild-disambiguation:generator');
    const deck = buildDeck();
    const rand = (bound: number): number => {
      const r = nextInt(state, bound);
      state = r.state;
      return r.value;
    };
    const randomHand = (level: Rank): Card[] => {
      const sh = shuffle(deck, state);
      state = sh.state;
      const wild: Card = `${level}H`;
      const size = 8 + rand(12);
      const wilds = sh.items.filter((c) => c === wild).slice(0, rand(3));
      return wilds.concat(sh.items.filter((c) => c !== wild).slice(0, size - wilds.length));
    };
    const configs = [cfg, vary({ allowUnderDeclareStraightFlush: true }), vary({ wildStraightFlushIsBomb: false })];
    const failures: string[] = [];
    for (let i = 0; i < 30; i++) {
      const level = RANKS[i % RANKS.length]!;
      const hand = randomHand(level);
      for (const config of configs) {
        for (const play of legalPlays(hand, null, level, config)) {
          const v = validatePlay(play.cards, play.decl, level, config);
          if (!v.ok) failures.push(`${hand.join(',')} lvl=${level} ${ofp(play.decl)} → ${v.error.code}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
