// Tests for combos.ts — combination classification, wild validation
// (Problem V, spec §4.4.2), and the beats relation (spec §3/§3.11).
// Spec: docs/rules/guandan.md v1.3; every test name cites its section.

import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import type { CanonicalForm, ComboType } from '../../../src/engine/guandan/types';
import {
  beats,
  classifyPlays,
  comboKeyValue,
  inferDecl,
  isBombForm,
  validatePlay,
} from '../../../src/engine/guandan/combos';
import type { ComboForm } from '../../../src/engine/guandan/combos';

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
const sf = (top: Rank, suit: Suit = 'S', demoted?: boolean): CanonicalForm =>
  form('straightFlush', 5, top, { suit, ...(demoted === undefined ? {} : { demoted }) });
const jokerBomb: CanonicalForm = form('jokerBomb', 4, 'A');
const jokerSingle = (jr: 'SJ' | 'BJ'): CanonicalForm => form('single', 1, 'A', { jokerRank: jr });
const jokerPair = (jr: 'SJ' | 'BJ'): CanonicalForm => form('pair', 2, 'A', { jokerRank: jr });

function expectOk(cards: Card[], decl: CanonicalForm, level: Rank, config: RuleVariant = cfg): void {
  expect(validatePlay(cards, decl, level, config)).toEqual({ ok: true });
}

function expectErr(
  cards: Card[],
  decl: CanonicalForm,
  code: string,
  level: Rank,
  config: RuleVariant = cfg,
): void {
  const result = validatePlay(cards, decl, level, config);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

/** Sorted (type,size,keyRank,suit,extras) fingerprints for set comparison. */
function fingerprints(forms: CanonicalForm[]): string[] {
  return forms
    .map((f) => {
      const x = f as ComboForm;
      return [f.type, f.size, f.keyRank, f.suit ?? '-', x.jokerRank ?? '-', x.demoted === true ? 'demoted' : '-'].join(
        ':',
      );
    })
    .sort();
}

// ---------------------------------------------------------------------------

describe('§3 table — validation of every combination type', () => {
  it('§3 row 1: single — any card', () => {
    expectOk(['9S'], single('9'), '2');
    expectOk(['AS'], single('A'), '2');
    expectOk(['SJ'], jokerSingle('SJ'), '2');
    expectOk(['BJ'], jokerSingle('BJ'), '2');
    expectErr(['9S'], single('8'), 'play.cardsMismatch', '2');
  });

  it('§3 row 2: pair — two equal ranks, incl. SJ+SJ and BJ+BJ', () => {
    expectOk(['9S', '9C'], pair('9'), '2');
    expectOk(['SJ', 'SJ'], jokerPair('SJ'), '2');
    expectOk(['BJ', 'BJ'], jokerPair('BJ'), '2');
    expectErr(['9S', '8C'], pair('9'), 'play.cardsMismatch', '2');
  });

  it('§3 row 3: triple — three equal ranks; jokers impossible', () => {
    expectOk(['9S', '9C', '9D'], triple('9'), '2');
    expectErr(['SJ', 'SJ', 'BJ'], triple('A'), 'play.jokerNotAllowed', '2');
  });

  it('§3 row 4: full house — triple + pair of different ranks', () => {
    expectOk(['9S', '9C', '9D', 'KS', 'KC'], fullHouse('9'), '2');
    // key must be the TRIPLE rank — declaring the pair rank fails.
    expectErr(['9S', '9C', '9D', 'KS', 'KC'], fullHouse('K'), 'play.cardsMismatch', '2');
    // Three distinct non-key ranks can never decompose.
    expectErr(['9S', '9C', '9D', 'KS', 'QC'], fullHouse('9'), 'play.cardsMismatch', '2');
  });

  it('§3 row 5 / §3.1: straight — exactly 5 consecutive natural ranks, mixed suits, no jokers', () => {
    expectOk(['5S', '6D', '7C', '8H', '9S'], straight('9'), '2');
    expectErr(['JS', 'QS', 'KD', 'AS', 'SJ'], straight('A'), 'play.jokerNotAllowed', '2');
    // 6-card straights do not exist: size 6 is not a straight shape.
    expectErr(['4S', '5D', '6C', '7S', '8D', '9C'], form('straight', 6, '9'), 'play.declSizeInvalid', '2');
    expect(classifyPlays(['4S', '5D', '6C', '7S', '8D', '9C'], '2', cfg)).toEqual([]);
  });

  it('§3 row 6: tube — 3 consecutive pairs, no jokers', () => {
    expectOk(['4S', '4C', '5D', '5H', '6S', '6C'], tube('6'), '2');
    expectErr(['4S', '4C', '5D', '5H', '6S', '7C'], tube('6'), 'play.cardsMismatch', '2');
  });

  it('§3 row 7: plate — 2 consecutive triples, no jokers', () => {
    expectOk(['5S', '5C', '5D', '6S', '6C', '6D'], plate('6'), '2');
    expectErr(['5S', '5C', '5D', '7S', '7C', '7D'], plate('7'), 'play.cardsMismatch', '2');
  });

  it('§3 row 8 / §3.3: bombs — n of one rank for every n in 4..10, jokers excluded', () => {
    // 8 naturals of K + 2 wilds (level 2) give every size a concrete multiset.
    const kings: Card[] = ['KS', 'KS', 'KC', 'KC', 'KD', 'KD', 'KH', 'KH', '2H', '2H'];
    for (let size = 4; size <= 10; size++) {
      expectOk(kings.slice(0, size), bomb(size, 'K'), '2');
    }
    expectErr(['KS', 'KC', 'KD', 'SJ'], bomb(4, 'K'), 'play.jokerNotAllowed', '2');
    expectErr(['KS', 'KC', 'KD'], bomb(3, 'K'), 'play.declSizeInvalid', '2');
    expectErr(
      ['KS', 'KS', 'KC', 'KC', 'KD', 'KD', 'KH', 'KH', '3S', '3C', '3D'],
      bomb(11, 'K'),
      'play.declSizeInvalid',
      '2',
    );
  });

  it('§3 row 9: straight flush — 5-card one-suit straight, validated by (rank,suit) identities', () => {
    expectOk(['5S', '6S', '7S', '8S', '9S'], sf('9', 'S'), '2');
    expectErr(['5S', '6S', '7S', '8S', '9D'], sf('9', 'S'), 'play.cardsMismatch', '2');
    expectErr(['5S', '6S', '7S', '8S', 'SJ'], sf('9', 'S'), 'play.jokerNotAllowed', '2');
  });

  it('§3 row 10: joker bomb — exactly SJ,SJ,BJ,BJ; wilds never contribute', () => {
    expectOk(['SJ', 'SJ', 'BJ', 'BJ'], jokerBomb, '2');
    expectErr(['SJ', 'SJ', 'BJ', '2H'], jokerBomb, 'play.invalidJokerBomb', '2');
    expectErr(['SJ', 'SJ', 'SJ', 'BJ'], jokerBomb, 'play.invalidJokerBomb', '2');
    // The four jokers are nothing else — no bomb interpretation.
    expectErr(['SJ', 'SJ', 'BJ', 'BJ'], bomb(4, 'A'), 'play.jokerNotAllowed', '2');
    expect(fingerprints(classifyPlays(['SJ', 'SJ', 'BJ', 'BJ'], '2', cfg))).toEqual([
      'jokerBomb:4:A:-:-:-',
    ]);
  });
});

describe('§3 table — beats keys per type', () => {
  it('§3 row 1: singles by levelValue — natural < level card < SJ < BJ (level T)', () => {
    expect(beats(single('J'), single('9'), 'T', cfg)).toBe(true);
    expect(beats(single('T'), single('A'), 'T', cfg)).toBe(true); // level card above A
    expect(beats(jokerSingle('SJ'), single('T'), 'T', cfg)).toBe(true);
    expect(beats(jokerSingle('BJ'), jokerSingle('SJ'), 'T', cfg)).toBe(true);
    expect(beats(single('A'), single('T'), 'T', cfg)).toBe(false);
    expect(beats(jokerSingle('SJ'), jokerSingle('BJ'), 'T', cfg)).toBe(false);
  });

  it('§3 row 2: pairs by levelValue — pair A < level pair < SJ pair < BJ pair (level 9)', () => {
    expect(beats(pair('9'), pair('A'), '9', cfg)).toBe(true);
    expect(beats(jokerPair('SJ'), pair('9'), '9', cfg)).toBe(true);
    expect(beats(jokerPair('BJ'), jokerPair('SJ'), '9', cfg)).toBe(true);
    expect(beats(pair('A'), pair('9'), '9', cfg)).toBe(false);
  });

  it('§3 row 4: full house compared by the triple only; pair irrelevant', () => {
    // A 9-triple full house beats an 8-triple one regardless of pairs.
    expect(beats(fullHouse('9'), fullHouse('8'), '2', cfg)).toBe(true);
    // Equal triples never beat, whatever the pairs were (form carries no pair).
    expect(beats(fullHouse('9'), fullHouse('9'), '2', cfg)).toBe(false);
  });

  it('§3 rows 5-7: sequences by naturalValue of the top card', () => {
    expect(beats(straight('T'), straight('9'), '2', cfg)).toBe(true);
    expect(beats(straight('A'), straight('K'), '2', cfg)).toBe(true);
    expect(beats(tube('7'), tube('6'), '2', cfg)).toBe(true);
    expect(beats(plate('7'), plate('6'), '2', cfg)).toBe(true);
    // Type and size must match — a straight never beats a tube.
    expect(beats(straight('A'), tube('6'), '2', cfg)).toBe(false);
    expect(beats(tube('A'), plate('A'), '2', cfg)).toBe(false);
  });

  it('§3.9/§3.10: bombs beat every non-bomb; non-bombs never beat bombs', () => {
    expect(beats(bomb(4, '2'), jokerSingle('BJ'), '5', cfg)).toBe(true);
    expect(beats(bomb(4, '2'), straight('A'), '5', cfg)).toBe(true);
    expect(beats(bomb(4, '2'), fullHouse('A'), '5', cfg)).toBe(true);
    expect(beats(sf('6'), straight('A'), '5', cfg)).toBe(true); // SF is a bomb
    expect(beats(straight('A'), sf('6'), '5', cfg)).toBe(false);
    expect(beats(jokerSingle('BJ'), bomb(4, '2'), '5', cfg)).toBe(false);
  });
});

describe('§3.11 bomb hierarchy (incl. §3.4 level bombs, §9.16 equal never beats)', () => {
  // Ascending ladder at level 5: within each size rank by levelValue (the
  // level-rank bomb tops its size, §3.4); SF strictly between 5- and 6-bombs;
  // joker bomb highest (default jokerBombSupreme=true).
  const level: Rank = '5';
  const ladder: { label: string; f: CanonicalForm }[] = [
    { label: '4-bomb 2s', f: bomb(4, '2') },
    { label: '4-bomb As', f: bomb(4, 'A') },
    { label: '4-bomb 5s (level, §3.4)', f: bomb(4, '5') },
    { label: '5-bomb 2s', f: bomb(5, '2') },
    { label: '5-bomb 5s (level)', f: bomb(5, '5') },
    { label: 'SF top 6', f: sf('6') },
    { label: 'SF top A', f: sf('A') },
    { label: '6-bomb 3s', f: bomb(6, '3') },
    { label: '6-bomb 5s (level)', f: bomb(6, '5') },
    { label: '7-bomb 2s', f: bomb(7, '2') },
    { label: '8-bomb 2s', f: bomb(8, '2') },
    { label: '9-bomb 2s', f: bomb(9, '2') },
    { label: '10-bomb 2s', f: bomb(10, '2') },
    { label: 'joker bomb', f: jokerBomb },
  ];

  ladder.forEach((entry, i) => {
    it(`§3.11 ladder[${i}] ${entry.label}: beats all lower, loses to all higher, never itself`, () => {
      for (let j = 0; j < ladder.length; j++) {
        const expected = i > j;
        expect(beats(entry.f, ladder[j]!.f, level, cfg), `${entry.label} vs ${ladder[j]!.label}`).toBe(expected);
      }
    });
  });

  it('§9.16 equal never beats — equal-top straight flushes of different suits', () => {
    expect(beats(sf('9', 'H'), sf('9', 'S'), '2', cfg)).toBe(false);
    expect(beats(sf('9', 'S'), sf('9', 'H'), '2', cfg)).toBe(false);
  });

  it('§3.4: a level-rank bomb beats any same-size bomb but not a bigger bomb', () => {
    expect(beats(bomb(4, '5'), bomb(4, 'A'), '5', cfg)).toBe(true);
    expect(beats(bomb(4, '5'), bomb(5, '2'), '5', cfg)).toBe(false); // size outranks rank
  });

  it('§3.11 jokerBombSupreme=false variant: 8+-bombs beat the joker bomb', () => {
    const c = vary({ jokerBombSupreme: false });
    expect(beats(bomb(8, '2'), jokerBomb, '5', c)).toBe(true);
    expect(beats(bomb(9, '2'), jokerBomb, '5', c)).toBe(true);
    expect(beats(bomb(10, '2'), jokerBomb, '5', c)).toBe(true);
    expect(beats(jokerBomb, bomb(8, '2'), '5', c)).toBe(false);
    // It still beats everything up through the 7-bomb...
    expect(beats(jokerBomb, bomb(7, 'A'), '5', c)).toBe(true);
    expect(beats(jokerBomb, sf('A'), '5', c)).toBe(true);
    expect(beats(jokerBomb, bomb(6, '5'), '5', c)).toBe(true);
    // ...and any non-bomb.
    expect(beats(jokerBomb, single('A'), '5', c)).toBe(true);
    expect(beats(jokerBomb, jokerBomb, '5', c)).toBe(false);
  });
});

describe('§4.4.2 Problem V — wild substitution in every family', () => {
  it('§4.1: wild completes a pair / triple / bomb of a natural rank', () => {
    expectOk(['KS', '2H'], pair('K'), '2');
    expectOk(['KS', 'KC', '2H'], triple('K'), '2');
    expectOk(['KS', 'KC', '2H', '2H'], bomb(4, 'K'), '2'); // both wilds, §4.1
  });

  it('§4.1: wild fills any rank slot in a straight, incl. the level rank at its natural spot (§2.4)', () => {
    // level 6: 6H is wild; it sits in the 6-slot of 4-8 (its own rank slot).
    expectOk(['4S', '5D', '6H', '7C', '8S'], straight('8'), '6');
    // Or represents a missing off-rank card entirely.
    expectOk(['4S', '5D', '7C', '8S', '6H'], straight('8'), '6');
    const result = inferDecl(['4S', '5D', '6H', '7C', '8S'], '6', cfg);
    expect(result).toEqual({ decl: straight('8') });
  });

  it('§4.1: wilds fill deficits in tubes and plates', () => {
    expectOk(['4S', '4C', '5D', '6S', '2H', '2H'], tube('6'), '2');
    expectOk(['5S', '5C', '5D', '6S', '6C', '2H'], plate('6'), '2');
    // A card outside the declared window can never be absorbed — with a
    // fixed card count, exceeding the wild deficit ALWAYS surfaces as an
    // out-of-window natural (inclusion is the whole check, §4.4.2).
    expectErr(['4S', '4C', '5D', '7S', '6C', '2H'], tube('6'), 'play.cardsMismatch', '2');
    expectErr(['4S', '4C', '4D', '5S', '5C', '2H'], plate('6'), 'play.cardsMismatch', '2');
  });

  it('§4.1: wild completes a full house triple or pair', () => {
    expectOk(['9S', '9C', '2H', 'KS', 'KC'], fullHouse('9'), '2'); // triple deficit
    expectOk(['9S', '9C', '9D', 'KS', '2H'], fullHouse('9'), '2'); // pair deficit
    expectOk(['9S', '9C', '2H', '2H', 'KS'], fullHouse('9'), '2'); // both wilds split
  });

  it('§4.1: a wild may never be (or pair with) a joker', () => {
    expectErr(['SJ', '2H'], jokerPair('SJ'), 'play.wildCannotBeJoker', '2');
    expectErr(['2H'], jokerSingle('SJ'), 'play.wildCannotBeJoker', '2');
  });

  it('play.tooManyWilds: more than two wilds is corrupt input', () => {
    expectErr(['2H', '2H', '2H', '2S'], bomb(4, '2'), 'play.tooManyWilds', '2');
  });
});

describe('§4.2 standalone wilds (and §9.7 pair of two wilds)', () => {
  it('§4.2: a lone wild single IS a level card; under-declaring is rejected by default', () => {
    expectOk(['2H'], single('2'), '2');
    expectErr(['2H'], single('9'), 'play.wildUnderDeclare', '2');
    expect(inferDecl(['2H'], '2', cfg)).toEqual({ decl: single('2') });
  });

  it('§9.7: two wilds = pair of level cards — beats pair of Aces, loses to SJ pair', () => {
    expectOk(['2H', '2H'], pair('2'), '2');
    expectErr(['2H', '2H'], pair('9'), 'play.wildUnderDeclare', '2');
    expect(beats(pair('2'), pair('A'), '2', cfg)).toBe(true);
    expect(beats(jokerPair('SJ'), pair('2'), '2', cfg)).toBe(true);
  });

  it('§4.2: wild + natural level card = level pair (identical result, no gate)', () => {
    expectOk(['9S', '9H'], pair('9'), '9'); // 9H is the wild at level 9
  });

  it('§4.2 allowWildUnderDeclare=true: under-declaration becomes legal (and ambiguous)', () => {
    const c = vary({ allowWildUnderDeclare: true });
    expectOk(['2H'], single('9'), '2', c);
    expectOk(['2H', '2H'], pair('9'), '2', c);
    expect(inferDecl(['2H'], '2', c)).toEqual({ ambiguous: true }); // 13 rank choices
  });
});

describe('§2.2 / §9.15 joker constraints', () => {
  it('§2.2 hard invariant: SJ+BJ is NEVER a pair, anywhere', () => {
    expectErr(['SJ', 'BJ'], jokerPair('SJ'), 'play.mixedJokerPair', '2');
    expectErr(['SJ', 'BJ'], jokerPair('BJ'), 'play.mixedJokerPair', '2');
    expectErr(['SJ', 'BJ'], pair('A'), 'play.mixedJokerPair', '2');
    expect(classifyPlays(['SJ', 'BJ'], '2', cfg)).toEqual([]);
    // ...including as the pair of a full house (§3.5 owner reaffirmation).
    expectErr(['9S', '9C', '9D', 'SJ', 'BJ'], fullHouse('9'), 'play.mixedJokerPair', '2');
  });

  it('§9.15: three jokers are nothing; SJ,SJ,BJ,BJ is ONLY the joker bomb', () => {
    expect(classifyPlays(['SJ', 'SJ', 'BJ'], '2', cfg)).toEqual([]);
    expect(classifyPlays(['SJ', 'SJ', 'BJ', 'BJ'], '2', cfg)).toHaveLength(1);
  });

  it('§2.2: jokers never join straights, tubes, plates, straight flushes, or rank bombs', () => {
    expectErr(['JS', 'QD', 'KC', 'AS', 'BJ'], straight('A'), 'play.jokerNotAllowed', '2');
    expectErr(['QS', 'QC', 'KD', 'KH', 'SJ', 'SJ'], tube('A'), 'play.jokerNotAllowed', '2');
    expectErr(['AS', 'AC', 'AD', 'SJ', 'SJ', 'BJ'], plate('A'), 'play.jokerNotAllowed', '2');
    expectErr(['JS', 'QS', 'KS', 'AS', 'SJ'], sf('A', 'S'), 'play.jokerNotAllowed', '2');
    expectErr(['AS', 'AC', 'AD', 'BJ'], bomb(4, 'A'), 'play.jokerNotAllowed', '2');
  });
});

describe('§3.5 full house details', () => {
  it('§3.5/§9.6: level-rank triple beats an Aces-up full house; wilds complete either part', () => {
    expect(beats(fullHouse('7'), fullHouse('A'), '7', cfg)).toBe(true); // levelValue 15 > 14
    expectOk(['7S', '7C', '7H', 'KS', 'KC'], fullHouse('7'), '7'); // wild as itself in the triple
  });

  it('§3.5: joker pair allowed as the pair part (fullHouseJokerPair=true default)', () => {
    expectOk(['9S', '9C', '9D', 'SJ', 'SJ'], fullHouse('9'), '2');
    expectOk(['9S', '9C', '9D', 'BJ', 'BJ'], fullHouse('9'), '2');
    // Even with a wild-completed triple.
    expectOk(['9S', '9C', '2H', 'SJ', 'SJ'], fullHouse('9'), '2');
  });

  it('§3.5: fullHouseJokerPair=false rejects the joker pair', () => {
    const c = vary({ fullHouseJokerPair: false });
    expectErr(['9S', '9C', '9D', 'SJ', 'SJ'], fullHouse('9'), 'play.fullHouseJokerPairDisabled', '2', c);
  });

  it('§3.5: the triple can never be jokers; a lone joker completes nothing', () => {
    expectErr(['SJ', 'SJ', 'BJ', '9S', '9C'], fullHouse('9'), 'play.jokerNotAllowed', '2');
    expectErr(['9S', '9C', '9D', 'SJ', 'KS'], fullHouse('9'), 'play.jokerPairIncomplete', '2');
  });

  it('§4.4.3: two wilds may BE the (rank-free) pair of a full house', () => {
    expectOk(['9S', '9C', '9D', '2H', '2H'], fullHouse('9'), '2');
  });

  it('wild split is flexible: KK99+wild admits both triple keys (ambiguous, §4.4.4)', () => {
    const cards: Card[] = ['KS', 'KC', '9S', '9C', '2H'];
    expectOk(cards, fullHouse('K'), '2');
    expectOk(cards, fullHouse('9'), '2');
    expect(inferDecl(cards, '2', cfg)).toEqual({ ambiguous: true });
  });
});

describe('§3.6 five of a kind is a bomb, not a full house', () => {
  const five: Card[] = ['9S', '9S', '9C', '9D', '9H']; // level 2 → 9H natural

  it('§3.6 default: reject the full-house declaration; the 5-bomb stands', () => {
    expectErr(five, fullHouse('9'), 'play.fiveOfKindNotFullHouse', '2');
    expectOk(five, bomb(5, '9'), '2');
    expect(fingerprints(classifyPlays(five, '2', cfg))).toEqual(['bomb:5:9:-:-:-']);
  });

  it('§3.6: the guard also catches the wild-completed five-of-a-kind shape', () => {
    expectErr(['9S', '9C', '9D', '9H', '2H'], fullHouse('9'), 'play.fiveOfKindNotFullHouse', '2');
    expectOk(['9S', '9C', '9D', '9H', '2H'], bomb(5, '9'), '2');
  });

  it('§3.6 fiveOfKindAsFullHouse=true: both declarations valid → explicit decl required', () => {
    const c = vary({ fiveOfKindAsFullHouse: true });
    expectOk(five, fullHouse('9'), '2', c);
    expectOk(five, bomb(5, '9'), '2', c);
    expect(inferDecl(five, '2', c)).toEqual({ ambiguous: true });
  });
});

describe('§3.8 under-declaring a suited run as a plain straight', () => {
  const suited: Card[] = ['5S', '6S', '7S', '8S', '9S'];

  it('§3.8 default (false): a no-wild one-suit run MUST be declared straight flush', () => {
    expectErr(suited, straight('9'), 'play.mustDeclareStraightFlush', '2');
    expectOk(suited, sf('9', 'S'), '2');
    expect(fingerprints(classifyPlays(suited, '2', cfg))).toEqual(['straightFlush:5:9:S:-:-']);
  });

  it('§3.8 allowUnderDeclareStraightFlush=true: both declarations valid → ambiguous', () => {
    const c = vary({ allowUnderDeclareStraightFlush: true });
    expectOk(suited, straight('9'), '2', c);
    expectOk(suited, sf('9', 'S'), '2', c);
    expect(inferDecl(suited, '2', c)).toEqual({ ambiguous: true });
  });

  it('§4.4.2 wild policy: a wild-completed suited set may be declared either way even by default', () => {
    const cards: Card[] = ['5S', '6S', '7S', '9S', '2H']; // wild covers the 8
    expectOk(cards, sf('9', 'S'), '2');
    expectOk(cards, straight('9'), '2'); // wild assigned an off-suit 8 — legal substitution
  });

  it('§3.8: mixed-suit no-wild straights are unaffected by the guard', () => {
    expectOk(['5S', '6D', '7C', '8H', '9S'], straight('9'), '2');
  });
});

describe('§3.7 / §9.12 wild straight flushes and the demotion variant', () => {
  const wildSf: Card[] = ['5S', '6S', '7S', '9S', '2H']; // wild = 8S, level 2

  it('§9.12 default: a wild-completed SF keeps bomb status — beats a 5-bomb, loses to a 6-bomb', () => {
    expectOk(wildSf, sf('9', 'S'), '2');
    expect(isBombForm(sf('9', 'S'), cfg)).toBe(true);
    expect(beats(sf('9', 'S'), bomb(5, 'A'), '2', cfg)).toBe(true);
    expect(beats(bomb(6, '3'), sf('9', 'S'), '2', cfg)).toBe(true);
  });

  it('§9.13: a wild may represent the OTHER heart level card inside a hearts SF window', () => {
    // level 7: both 7H are wilds; one sits in its own 7-slot, the other
    // substitutes for the missing 8H.
    expectOk(['4H', '5H', '6H', '7H', '7H'], sf('8', 'H'), '7');
  });

  it('§9.11 wild-as-itself: hearts SF through the level slot is natural — never demoted', () => {
    const c = vary({ wildStraightFlushIsBomb: false });
    const cards: Card[] = ['5H', '6H', '7H', '8H', '9H']; // level 7 → 7H is the wild, in its own slot
    expectOk(cards, sf('9', 'H'), '7');
    expectOk(cards, sf('9', 'H'), '7', c); // no demoted flag even under the variant
    expectErr(cards, sf('9', 'H', true), 'play.declDemotedMismatch', '7', c);
    expect(isBombForm(sf('9', 'H'), c)).toBe(true);
  });

  it('§3.7 wildStraightFlushIsBomb=false: substituting wilds demote the SF to non-bomb', () => {
    const c = vary({ wildStraightFlushIsBomb: false });
    expectErr(wildSf, sf('9', 'S'), 'play.declDemotedMismatch', '2', c);
    expectOk(wildSf, sf('9', 'S', true), '2', c);
    const found = classifyPlays(wildSf, '2', c).find((f) => f.type === 'straightFlush');
    expect((found as ComboForm | undefined)?.demoted).toBe(true);
    expect(isBombForm(sf('9', 'S', true), c)).toBe(false);
  });

  it('§3.7 variant: a demoted SF beats like a plain straight of its window', () => {
    const c = vary({ wildStraightFlushIsBomb: false });
    const demoted = sf('9', 'S', true);
    expect(beats(demoted, straight('8'), '2', c)).toBe(true); // straight-like follow
    expect(beats(straight('A'), demoted, '2', c)).toBe(true); // and is beaten like one
    expect(beats(demoted, straight('9'), '2', c)).toBe(false); // equal never beats
    expect(beats(demoted, bomb(4, '2'), '2', c)).toBe(false); // no bomb power
    expect(beats(bomb(4, '2'), demoted, '2', c)).toBe(true);
    expect(beats(sf('6', 'H'), demoted, '2', c)).toBe(true); // natural SF is still a bomb
    expect(beats(demoted, pair('9'), '2', c)).toBe(false); // still not a pair-beater
    // Two demoted SFs compare by window top, straight-style.
    expect(beats(sf('T', 'H', true), demoted, '2', c)).toBe(true);
  });

  it('§3.7 default config: the demoted spelling is rejected outright', () => {
    expectErr(wildSf, sf('9', 'S', true), 'play.declDemotedMismatch', '2');
    expectErr(['9S', '9C'], form('pair', 2, '9', { demoted: true }), 'play.declDemotedUnexpected', '2');
  });
});

describe('§2.5 / §9.8–§9.10 A-duality and the level card in sequences', () => {
  it('§9.8 level Q: T-J-Q-K-A is a valid straight; Q is just a Q there (§2.4)', () => {
    expectOk(['TS', 'JD', 'QC', 'KC', 'AS'], straight('A'), 'Q');
    // The level card grants no elevation inside sequences: top-A beats top-K
    // and nothing more.
    expect(beats(straight('A'), straight('K'), 'Q', cfg)).toBe(true);
    expect(beats(straight('K'), straight('A'), 'Q', cfg)).toBe(false);
  });

  it('§2.5: A-2-3-4-5 is the lowest straight (top = 5); no wrap-around', () => {
    expectOk(['AS', '2D', '3C', '4S', '5H'], straight('5'), '7');
    expect(beats(straight('6'), straight('5'), '7', cfg)).toBe(true);
    // Q-K-A-2-3 is nothing.
    expect(classifyPlays(['QS', 'KD', 'AC', '2S', '3D'], '7', cfg)).toEqual([]);
    // A straight cannot top out below 5.
    expectErr(['AS', '2D', '3C', '4S', '5H'], straight('4'), 'play.declKeyRankInvalid', '7');
  });

  it('§9.10 level 2: A-2-3-4-5 still valid with a natural 2 — and with the wild filling the 2-slot', () => {
    expectOk(['AS', '2S', '3D', '4C', '5H'], straight('5'), '2');
    expectOk(['AS', '2H', '3D', '4C', '5S'], straight('5'), '2'); // wild as its own rank
  });

  it('§9.10 level A: both A-high and A-low straights valid with natural (non-heart) Aces', () => {
    expectOk(['TS', 'JD', 'QC', 'KS', 'AS'], straight('A'), 'A');
    expectOk(['AS', '2D', '3C', '4S', '5S'], straight('5'), 'A');
  });

  it('§3.2/§9.9: AA2233 is the lowest tube, AAA222 the lowest plate; QQKKAA/KKKAAA top at A', () => {
    expectOk(['AS', 'AC', '2S', '2C', '3D', '3H'], tube('3'), '7');
    expectOk(['QS', 'QC', 'KD', 'KH', 'AS', 'AC'], tube('A'), '7');
    expectOk(['AS', 'AC', 'AD', '2S', '2C', '2D'], plate('2'), '7');
    expectOk(['KS', 'KC', 'KD', 'AS', 'AC', 'AD'], plate('A'), '7');
    expect(beats(tube('4'), tube('3'), '7', cfg)).toBe(true); // 223344 beats AA2233
    expect(beats(plate('3'), plate('2'), '7', cfg)).toBe(true); // 222333 beats AAA222
    expect(beats(tube('A'), tube('K'), '7', cfg)).toBe(true);
    // No wrap: KKAA22 is not a tube.
    expect(classifyPlays(['KS', 'KC', 'AS', 'AC', '2S', '2C'], '7', cfg)).toEqual([]);
  });

  it('§9.8: straight flush comparison is naturalValue of the top card too', () => {
    expect(beats(sf('A', 'S'), sf('K', 'H'), 'Q', cfg)).toBe(true);
    expect(beats(sf('5', 'S'), sf('6', 'H'), 'Q', cfg)).toBe(false); // A-low SF is the lowest
  });
});

describe('§9.11 / §9.14 level-rank and ten-card bombs', () => {
  it('§9.11 wild-as-itself: all 8 copies of the level rank (incl. both hearts) = 8-bomb', () => {
    expectOk(['7S', '7S', '7C', '7C', '7D', '7D', '7H', '7H'], bomb(8, '7'), '7');
  });

  it('§9.14: ten-card bomb = 8 naturals + 2 wilds, non-level ranks only', () => {
    const tenKings: Card[] = ['KS', 'KS', 'KC', 'KC', 'KD', 'KD', 'KH', 'KH', '2H', '2H'];
    expectOk(tenKings, bomb(10, 'K'), '2');
    expect(beats(bomb(10, 'K'), bomb(9, 'A'), '2', cfg)).toBe(true);
    expect(beats(jokerBomb, bomb(10, 'K'), '2', cfg)).toBe(true);
  });

  it('§9.14: level-rank bombs cap at 8 by pure counting — a 9th card cannot exist', () => {
    // 6 naturals + both wilds is the level rank’s entire supply.
    expectOk(['2S', '2S', '2C', '2C', '2D', '2D', '2H', '2H'], bomb(8, '2'), '2');
    // Any 9th card is off-rank → plain multiset mismatch, no special rule.
    expectErr(
      ['2S', '2S', '2C', '2C', '2D', '2D', '2H', '2H', '3S'],
      bomb(9, '2'),
      'play.cardsMismatch',
      '2',
    );
  });

  it('§3.4: same-size bombs compare by rankLevelValue (8-bomb of level beats 8-bomb of A)', () => {
    expect(beats(bomb(8, '7'), bomb(8, 'A'), '7', cfg)).toBe(true);
    expect(beats(bomb(8, 'A'), bomb(8, '7'), '7', cfg)).toBe(false);
  });
});

describe('§4.4.4 / §9.18 classifyPlays & inferDecl', () => {
  it('§9.18: 2♠3♠4♠5♠ + wild admits SF-6♠, SF-A-low♠, and both plain-straight windows', () => {
    const cards: Card[] = ['2S', '3S', '4S', '5S', '6H']; // level 6 → 6H is the wild
    const forms = classifyPlays(cards, '6', cfg);
    expect(fingerprints(forms)).toEqual([
      'straight:5:5:-:-:-',
      'straight:5:6:-:-:-',
      'straightFlush:5:5:S:-:-',
      'straightFlush:5:6:S:-:-',
    ]);
    expect(inferDecl(cards, '6', cfg)).toEqual({ ambiguous: true });
  });

  it('§4.4.4: unambiguous multisets infer their unique decl', () => {
    expect(inferDecl(['9S'], '2', cfg)).toEqual({ decl: single('9') });
    expect(inferDecl(['9S', '9C'], '2', cfg)).toEqual({ decl: pair('9') });
    expect(inferDecl(['SJ'], '2', cfg)).toEqual({ decl: jokerSingle('SJ') });
    expect(inferDecl(['KS', 'KC', 'KD', 'KH'], '2', cfg)).toEqual({ decl: bomb(4, 'K') });
    expect(inferDecl(['9S', '9C', '9D', 'KS', 'KC'], '2', cfg)).toEqual({ decl: fullHouse('9') });
  });

  it('§4.4.4: 999 + two wilds is fullHouse-9 or 5-bomb-9 → decl required', () => {
    const cards: Card[] = ['9S', '9C', '9D', '2H', '2H'];
    expect(fingerprints(classifyPlays(cards, '2', cfg))).toEqual([
      'bomb:5:9:-:-:-',
      'fullHouse:5:9:-:-:-',
    ]);
    expect(inferDecl(cards, '2', cfg)).toEqual({ ambiguous: true });
  });

  it('inferDecl: garbage multisets are invalid', () => {
    expect(inferDecl(['9S', '8C'], '2', cfg)).toEqual({ invalid: true });
    expect(inferDecl(['9S', '8C', '7D', 'KS'], '2', cfg)).toEqual({ invalid: true });
    expect(inferDecl([], '2', cfg)).toEqual({ invalid: true });
    expect(inferDecl(['SJ', 'BJ'], '2', cfg)).toEqual({ invalid: true });
  });

  it('classifyPlays: 7..10 card multisets classify as bombs only', () => {
    const nineAces: Card[] = ['AS', 'AS', 'AC', 'AC', 'AD', 'AD', 'AH', '2H', '2H'];
    expect(fingerprints(classifyPlays(nineAces, '2', cfg))).toEqual(['bomb:9:A:-:-:-']);
  });
});

describe('isBombForm', () => {
  it('bombs, joker bombs, and (default) straight flushes are bombs; nothing else is', () => {
    expect(isBombForm(bomb(4, '2'), cfg)).toBe(true);
    expect(isBombForm(bomb(10, 'K'), cfg)).toBe(true);
    expect(isBombForm(jokerBomb, cfg)).toBe(true);
    expect(isBombForm(sf('9', 'S'), cfg)).toBe(true);
    for (const f of [single('A'), pair('A'), triple('A'), fullHouse('A'), straight('A'), tube('A'), plate('A')]) {
      expect(isBombForm(f, cfg)).toBe(false);
    }
  });

  it('§3.7 variant: only the demoted SF loses bomb status', () => {
    const c = vary({ wildStraightFlushIsBomb: false });
    expect(isBombForm(sf('9', 'S'), c)).toBe(true);
    expect(isBombForm(sf('9', 'S', true), c)).toBe(false);
  });
});

describe('decl shape errors (locale-free RuleError codes)', () => {
  it('play.cardCountMismatch: cards must match decl.size', () => {
    expectErr(['9S'], pair('9'), 'play.cardCountMismatch', '2');
  });

  it('play.declSizeInvalid: fixed sizes per type; bombs 4..10', () => {
    expectErr(['9S', '9C', '9D', '9H', '9S', '9C'], form('fullHouse', 6, '9'), 'play.declSizeInvalid', '2');
    expectErr(['9S', '9C', '9D'], form('bomb', 3, '9'), 'play.declSizeInvalid', '2');
  });

  it('play.declSuitRequired / play.declSuitUnexpected: suit exactly for straight flushes', () => {
    expectErr(['5S', '6S', '7S', '8S', '9S'], form('straightFlush', 5, '9'), 'play.declSuitRequired', '2');
    expectErr(['5S', '6D', '7C', '8H', '9S'], form('straight', 5, '9', { suit: 'S' }), 'play.declSuitUnexpected', '2');
  });

  it('play.declKeyRankInvalid: sequence tops below their window floor; joker forms not keyed A', () => {
    expectErr(['AS', 'AC', '2S', '2C', '3D', '3H'], tube('2'), 'play.declKeyRankInvalid', '7');
    expectErr(['SJ'], form('single', 1, 'K', { jokerRank: 'SJ' }), 'play.declKeyRankInvalid', '2');
    expectErr(['SJ', 'SJ', 'BJ', 'BJ'], form('jokerBomb', 4, 'K'), 'play.declKeyRankInvalid', '2');
  });

  it('play.declJokerRankInvalid: jokerRank only on singles and pairs', () => {
    expectErr(['9S', '9C', '9D'], form('triple', 3, 'A', { jokerRank: 'SJ' }), 'play.declJokerRankInvalid', '2');
  });
});

describe('comboKeyValue (exported for the generate/trick layers)', () => {
  it('rank-keyed types use levelValue ordering; sequences use naturalValue; jokers 16/17', () => {
    expect(comboKeyValue(single('7'), '7')).toBe(15);
    expect(comboKeyValue(single('A'), '7')).toBe(14);
    expect(comboKeyValue(jokerSingle('SJ'), '7')).toBe(16);
    expect(comboKeyValue(jokerPair('BJ'), '7')).toBe(17);
    expect(comboKeyValue(straight('5'), '7')).toBe(5); // A-low top
    expect(comboKeyValue(sf('A', 'S'), '7')).toBe(14);
    expect(comboKeyValue(straight('7'), '7')).toBe(7); // no elevation in sequences (§2.4)
    expect(comboKeyValue(bomb(4, '7'), '7')).toBe(15); // §3.4
  });
});
