// Wild-chooser card-face derivation (M4 item A) — the pure presentation
// helpers of docs/research/wild-chooser-ux.md §1/§7: wildSubstitutions
// (required-multiset-minus-naturals per decl type) and resolveComboFaces
// (the post-substitution combo, one face per selected card). Layout:
// (1) named rows keyed to docs/research/wild-disambiguation.md §2 IDs;
// (2) the four §7.1 properties over a seeded sweep × the 2^5 config grid,
// with the reconstruction property closed through the ENGINE's own
// validatePlay (a wrong target could not re-validate);
// (3) the CSS-token arithmetic ratchet re-proving the §3.1 390px fit from
// the actual stylesheet text (arithmetic only — render is owned by the
// visual round);
// (4) the optionAria composition (§6/§7.3 — the maximal two-wild SF case).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The CSS-token ratchet needs the stylesheets as TEXT. Vitest stubs CSS
// imports (`?raw` included) to '' under its default css:false, so fs it
// is; tsconfig.client is deliberately node-types-free (DOM-shaped
// program), so the one API this file uses is declared minimally here
// instead of widening the whole program with @types/node.
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}

const tableCss = readFileSync(new URL('../../../src/client/table/table.css', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../../../src/client/app.css', import.meta.url), 'utf8');
import type { Card, Rank, Suit } from '../../../src/engine/guandan/cards';
import {
  RANKS,
  buildDeck,
  isJoker,
  isWild,
  rankOf,
  suitOf,
} from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import type { CanonicalForm } from '../../../src/engine/guandan/types';
import { classifyPlays, sequenceWindow, validatePlay } from '../../../src/engine/guandan/combos';
import type { ComboForm } from '../../../src/engine/guandan/combos';
import { nextInt, seedPrng, shuffle } from '../../../src/engine/core/prng';
import type { PrngState } from '../../../src/engine/core/prng';
import {
  resolveComboFaces,
  substitutionChips,
  wildSubstitutions,
  type WildSubstitution,
} from '../../../src/client/table/helpers';
import { optionAria } from '../../../src/client/table/ActionBar';
import { getLocale, setLocale } from '../../../src/client/i18n';

const cfg = JIANGSU_OFFICIAL_ONLINE;
const vary = (overrides: Partial<RuleVariant>): RuleVariant => ({ ...cfg, ...overrides });

/** The offered decl matching a (type, keyRank[, suit]) fingerprint — the
 *  test's way of picking one reading out of classifyPlays's ordered set. */
function declOf(
  cards: Card[],
  level: Rank,
  pick: { type: CanonicalForm['type']; keyRank: Rank; suit?: Suit },
  config: RuleVariant = cfg,
): CanonicalForm {
  const form = classifyPlays(cards, level, config).find(
    (f) => f.type === pick.type && f.keyRank === pick.keyRank && (pick.suit === undefined || f.suit === pick.suit),
  );
  expect(form, `${pick.type}-${pick.keyRank} offered for [${cards.join(',')}] @${level}`).toBeDefined();
  return form!;
}

/** Compact fingerprint of a substitution: 'self' or 'rank[suit]'. */
function sfp(sub: WildSubstitution): string {
  return sub.asSelf ? 'self' : `${sub.becomesRank}${sub.becomesSuit ?? ''}`;
}

describe('wildSubstitutions — named rows (wild-disambiguation.md §2 IDs)', () => {
  it('S-1: lone wild is the level single, as itself — no chip', () => {
    const subs = wildSubstitutions(['2H'], declOf(['2H'], '2', { type: 'single', keyRank: '2' }), '2');
    expect(subs.map(sfp)).toEqual(['self']);
    expect(substitutionChips(subs)).toEqual([]);
  });

  it('S-9 variant (allowWildUnderDeclare): lone wild declared 9 arrows to 9', () => {
    const c = vary({ allowWildUnderDeclare: true });
    const decl = declOf(['2H'], '2', { type: 'single', keyRank: '9' }, c);
    expect(wildSubstitutions(['2H'], decl, '2').map(sfp)).toEqual(['9']);
  });

  it('ST-2: one wild, both end windows — 9 vs 4', () => {
    const cards: Card[] = ['5S', '6D', '7C', '8H', '2H'];
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'straight', keyRank: '9' }), '2').map(sfp)).toEqual(['9']);
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'straight', keyRank: '8' }), '2').map(sfp)).toEqual(['4']);
  });

  it('ST-7: wild = level = A — A-high reading is wild-as-itself, K-high arrows to 9', () => {
    const cards: Card[] = ['TS', 'JD', 'QC', 'KS', 'AH'];
    expect(wildSubstitutions(cards, declOf(cards, 'A', { type: 'straight', keyRank: 'A' }), 'A').map(sfp)).toEqual(['self']);
    expect(wildSubstitutions(cards, declOf(cards, 'A', { type: 'straight', keyRank: 'K' }), 'A').map(sfp)).toEqual(['9']);
  });

  it('FH-1: dual assignment — the SAME cards yield different targets per decl', () => {
    const cards: Card[] = ['8S', '8D', '9S', '9D', '2H'];
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: '9' }), '2').map(sfp)).toEqual(['9']);
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: '8' }), '2').map(sfp)).toEqual(['8']);
  });

  it('FH-3: split wilds = two distinct chips; concentrated = one ×2 chip', () => {
    const cards: Card[] = ['KS', 'KC', '9S', '2H', '2H'];
    const split = wildSubstitutions(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: 'K' }), '2');
    expect(split.map(sfp)).toEqual(['K', '9']); // triple slot first, then the pair
    expect(substitutionChips(split).map((c) => `${c.becomesRank}x${c.count}`)).toEqual(['Kx1', '9x1']);
    const concentrated = wildSubstitutions(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: '9' }), '2');
    expect(concentrated.map(sfp)).toEqual(['9', '9']);
    expect(substitutionChips(concentrated).map((c) => `${c.becomesRank}x${c.count}`)).toEqual(['9x2']);
  });

  it('FH-4: free pair ⇒ both wilds as themselves; the bomb reading ⇒ one ×2 chip', () => {
    const cards: Card[] = ['9S', '9C', '9D', '2H', '2H'];
    const free = wildSubstitutions(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: '9' }), '2');
    expect(free.map(sfp)).toEqual(['self', 'self']);
    expect(substitutionChips(free)).toEqual([]);
    const bomb = wildSubstitutions(cards, declOf(cards, '2', { type: 'bomb', keyRank: '9' }), '2');
    expect(bomb.map(sfp)).toEqual(['9', '9']);
    expect(substitutionChips(bomb).map((c) => `${c.becomesRank}x${c.count}`)).toEqual(['9x2']);
  });

  it('five-of-kind variant (fiveOfKindAsFullHouse, keyCount=4): the pair rank IS keyRank', () => {
    const c = vary({ fiveOfKindAsFullHouse: true });
    const cards: Card[] = ['9S', '9C', '9D', '9H', '2H'];
    const decl = declOf(cards, '2', { type: 'fullHouse', keyRank: '9' }, c);
    expect(wildSubstitutions(cards, decl, '2').map(sfp)).toEqual(['9']);
  });

  it('SF-1 (§9.18 end positions): suited targets carry decl.suit', () => {
    const cards: Card[] = ['2S', '3S', '4S', '5S', '6H']; // level 6 ⇒ 6H is the wild
    expect(wildSubstitutions(cards, declOf(cards, '6', { type: 'straightFlush', keyRank: '6', suit: 'S' }), '6').map(sfp)).toEqual(['6S']);
    expect(wildSubstitutions(cards, declOf(cards, '6', { type: 'straightFlush', keyRank: '5', suit: 'S' }), '6').map(sfp)).toEqual(['AS']);
  });

  it('SF-3: one wild, both SF end windows — 9♠ vs 4♠', () => {
    const cards: Card[] = ['5S', '6S', '7S', '8S', '2H'];
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'straightFlush', keyRank: '9', suit: 'S' }), '2').map(sfp)).toEqual(['9S']);
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'straightFlush', keyRank: '8', suit: 'S' }), '2').map(sfp)).toEqual(['4S']);
  });

  it('SF-7: the (level,H) slot is wild-as-itself — mirrors the engine non-demotion (§9.11)', () => {
    const cards: Card[] = ['4H', '5H', '6H', '8H', '7H']; // 7H IS the wild at level 7
    const decl = declOf(cards, '7', { type: 'straightFlush', keyRank: '8', suit: 'H' });
    const subs = wildSubstitutions(cards, decl, '7');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.asSelf).toBe(true);
    expect(subs[0]!.becomesRank).toBe('7');
    expect(subs[0]!.becomesSuit).toBe('H');
  });

  it('TP-2: tube ×2 collapse vs plate two distinct chips vs tube ×2 (6-card cross-type)', () => {
    const cards: Card[] = ['4S', '4D', '5S', '5D', '2H', '2H'];
    const tube6 = wildSubstitutions(cards, declOf(cards, '2', { type: 'tube', keyRank: '6' }), '2');
    expect(tube6.map(sfp)).toEqual(['6', '6']);
    expect(substitutionChips(tube6).map((c) => `${c.becomesRank}x${c.count}`)).toEqual(['6x2']);
    const plate5 = wildSubstitutions(cards, declOf(cards, '2', { type: 'plate', keyRank: '5' }), '2');
    expect(plate5.map(sfp)).toEqual(['4', '5']);
    expect(substitutionChips(plate5)).toHaveLength(2);
    const tube5 = wildSubstitutions(cards, declOf(cards, '2', { type: 'tube', keyRank: '5' }), '2');
    expect(tube5.map(sfp)).toEqual(['3', '3']);
  });

  it('TP-3: same pattern one window up', () => {
    const cards: Card[] = ['5S', '5D', '6S', '6D', '2H', '2H'];
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'tube', keyRank: '7' }), '2').map(sfp)).toEqual(['7', '7']);
    expect(wildSubstitutions(cards, declOf(cards, '2', { type: 'plate', keyRank: '6' }), '2').map(sfp)).toEqual(['5', '6']);
  });

  it('B-4: bomb completion collapses to one ×2 chip', () => {
    const cards: Card[] = ['KS', 'KC', 'KD', 'KH', '2H', '2H'];
    const subs = wildSubstitutions(cards, declOf(cards, '2', { type: 'bomb', keyRank: 'K' }), '2');
    expect(subs.map(sfp)).toEqual(['K', 'K']);
    expect(substitutionChips(subs).map((c) => `${c.becomesRank}x${c.count}`)).toEqual(['Kx2']);
  });
});

describe('resolveComboFaces — named rows', () => {
  it('ST-7: the wild sits in ITS window slot — as itself at A-high, as a ghost 9 at K-high', () => {
    const cards: Card[] = ['TS', 'JD', 'QC', 'KS', 'AH'];
    const aHigh = resolveComboFaces(cards, declOf(cards, 'A', { type: 'straight', keyRank: 'A' }), 'A');
    expect(aHigh.map((f) => `${f.displayRank}${f.displaySuit ?? '-'}${f.viaWild ? 'w' : ''}`)).toEqual([
      'TS', 'JD', 'QC', 'KS', 'AHw',
    ]);
    const kHigh = resolveComboFaces(cards, declOf(cards, 'A', { type: 'straight', keyRank: 'K' }), 'A');
    expect(kHigh.map((f) => `${f.displayRank}${f.displaySuit ?? '-'}${f.viaWild ? 'w' : ''}`)).toEqual([
      '9-w', 'TS', 'JD', 'QC', 'KS',
    ]);
    expect(kHigh[0]!.card).toBe('AH'); // the ghost slot is backed by the physical wild
  });

  it('FH-4: full house renders triple-then-pair; the free pair is the physical wilds', () => {
    const cards: Card[] = ['9S', '9C', '9D', '2H', '2H'];
    const faces = resolveComboFaces(cards, declOf(cards, '2', { type: 'fullHouse', keyRank: '9' }), '2');
    expect(faces.map((f) => f.card)).toEqual(['9C', '9D', '9S', '2H', '2H']);
    expect(faces.map((f) => f.viaWild)).toEqual([false, false, false, true, true]);
    // Wilds-as-themselves display their own identity (marker via isWild).
    expect(faces[3]!.displayRank).toBe('2');
    expect(faces[3]!.displaySuit).toBe('H');
  });

  it('SF-3: the substituted face carries the run suit in its window slot', () => {
    const cards: Card[] = ['5S', '6S', '7S', '8S', '2H'];
    const faces = resolveComboFaces(cards, declOf(cards, '2', { type: 'straightFlush', keyRank: '9', suit: 'S' }), '2');
    expect(faces.map((f) => `${f.displayRank}${f.displaySuit}${f.viaWild ? 'w' : ''}`)).toEqual([
      '5S', '6S', '7S', '8S', '9Sw',
    ]);
  });
});

// ---------------------------------------------------------------------------
// §7.1 properties over a seeded sweep × the 2^5 config grid.
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

/** Seeded selection generator (the wild-disambiguation.test.ts §5.2 shape,
 *  capped at the chooser-relevant sizes 1–6; ≥50% wild inclusion). */
function makeSweeper(seed: string): (level: Rank) => Card[] {
  let state: PrngState = seedPrng(seed);
  const deck = buildDeck();
  const rand = (bound: number): number => {
    const r = nextInt(state, bound);
    state = r.state;
    return r.value;
  };
  return (level: Rank): Card[] => {
    const sh = shuffle(deck, state);
    state = sh.state;
    const wild: Card = `${level}H`;
    const size = 1 + rand(6);
    const wantWilds = Math.min(rand(3) === 0 ? 0 : 1 + rand(2), size);
    const wilds = sh.items.filter((c) => c === wild).slice(0, wantWilds);
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
}

const SEQUENCE_COPIES: Partial<Record<CanonicalForm['type'], number>> = {
  straight: 1,
  straightFlush: 1,
  tube: 2,
  plate: 3,
};

/** All four §7.1 properties for one (selection, decl); returns a failure
 *  label or null — collected so a sweep reports every disagreement. */
function checkProperties(
  selection: Card[],
  decl: CanonicalForm,
  level: Rank,
  config: RuleVariant,
): string | null {
  const label = `[${selection.join(',')}] ${decl.type}-${decl.keyRank}${decl.suit ?? ''} level=${level} mask=${SWEEP_KEYS.map((k) => Number(config[k])).join('')}`;
  const wild: Card = `${level}H`;
  const wildCount = selection.filter((c) => isWild(c, level)).length;
  const subs = wildSubstitutions(selection, decl, level);

  // P1 — count & asSelf coherence: one entry per wild; asSelf exactly when
  // the target is the wild's own identity.
  if (subs.length !== wildCount) return `${label}: P1 ${subs.length} subs for ${wildCount} wilds`;
  for (const sub of subs) {
    if (sub.wild !== wild) return `${label}: P1 wild card ${sub.wild}`;
    const own =
      sub.becomesSuit === null ? sub.becomesRank === level : sub.becomesRank === level && sub.becomesSuit === 'H';
    if (sub.asSelf !== own) return `${label}: P1 asSelf=${sub.asSelf} target=${sfp(sub)}`;
  }

  // P3 — SF-suit iff: becomesSuit set exactly for straight flushes, and
  // then equal to the declared suit.
  for (const sub of subs) {
    if ((sub.becomesSuit !== null) !== (decl.type === 'straightFlush')) {
      return `${label}: P3 becomesSuit=${sub.becomesSuit}`;
    }
    if (sub.becomesSuit !== null && sub.becomesSuit !== decl.suit) {
      return `${label}: P3 suit ${sub.becomesSuit} != ${decl.suit}`;
    }
  }

  // P2 — reconstruction through the ENGINE: naturals + derived targets
  // re-validate as the same canonical form. asSelf wilds stay physical
  // (they play as themselves); suit-blind targets take an arbitrary suit
  // (the engine is suit-blind there); demoted is RECOMPUTED — after
  // substitution no wild substitutes, so the §3.7 flag drops (combos.ts
  // enforces, not infers, the flag).
  const substituted: Card[] = selection.filter((c) => !isWild(c, level));
  for (const sub of subs) {
    substituted.push(sub.asSelf ? wild : (`${sub.becomesRank}${sub.becomesSuit ?? 'S'}` as Card));
  }
  const recomputed: ComboForm = { ...(decl as ComboForm) };
  delete recomputed.demoted;
  const v = validatePlay(substituted, recomputed, level, config);
  if (!v.ok) return `${label}: P2 substituted [${substituted.join(',')}] → ${v.error.code}`;

  // P4 — face list shape & order.
  const faces = resolveComboFaces(selection, decl, level);
  if (faces.length !== decl.size) return `${label}: P4 ${faces.length} faces for size ${decl.size}`;
  const facesCards = faces.map((f) => f.card).sort().join(',');
  if (facesCards !== [...selection].sort().join(',')) return `${label}: P4 cards ${facesCards}`;
  const viaWild = faces.filter((f) => f.viaWild);
  if (viaWild.length !== wildCount) return `${label}: P4 viaWild ${viaWild.length}`;
  for (const face of viaWild) {
    if (face.card !== wild) return `${label}: P4 viaWild card ${face.card}`;
  }
  for (const face of faces) {
    if (!face.viaWild) {
      if (face.displayRank !== rankOf(face.card) || face.displaySuit !== suitOf(face.card)) {
        return `${label}: P4 natural ${face.card} shown as ${face.displayRank}${face.displaySuit}`;
      }
    }
    // Suitless faces are exactly: suit-blind ghosts (wild-backed) + jokers.
    if (face.displaySuit === null && face.displayRank !== null && !face.viaWild) {
      return `${label}: P4 suitless non-wild face`;
    }
  }
  const copies = SEQUENCE_COPIES[decl.type];
  if (copies !== undefined) {
    const window = sequenceWindow(decl.keyRank, decl.size / copies)!;
    const expected = window.flatMap((rank) => Array.from({ length: copies }, () => rank));
    const got = faces.map((f) => f.displayRank);
    if (got.join(',') !== expected.join(',')) return `${label}: P4 window order ${got.join(',')}`;
    if (decl.type === 'straightFlush' && faces.some((f) => f.displaySuit !== decl.suit)) {
      return `${label}: P4 SF face off-suit`;
    }
  }
  // Cross-coherence: the ghost faces are exactly the non-asSelf targets.
  const ghostTargets = faces
    .filter((f) => f.viaWild && (f.displayRank !== rankOf(f.card) || f.displaySuit !== suitOf(f.card)))
    .map((f) => `${f.displayRank}${f.displaySuit ?? ''}`)
    .sort();
  const subTargets = subs.filter((s) => !s.asSelf).map(sfp).sort();
  if (ghostTargets.join('|') !== subTargets.join('|')) {
    return `${label}: ghosts [${ghostTargets.join(',')}] != targets [${subTargets.join(',')}]`;
  }
  return null;
}

describe('§7.1 properties over the seeded sweep × 2^5 config grid', () => {
  it('every offered reading derives coherent substitutions that re-validate through validatePlay', () => {
    const failures: string[] = [];
    for (let mask = 0; mask < 1 << SWEEP_KEYS.length; mask++) {
      const config = sweepConfig(mask);
      const selectionFor = makeSweeper(`chooser-faces:${mask}`);
      const samples = mask === 0 ? 100 : 20; // default profile gets the deep pass
      for (let i = 0; i < samples; i++) {
        const level = RANKS[(mask + i) % RANKS.length]!;
        const selection = selectionFor(level);
        for (const decl of classifyPlays(selection, level, config)) {
          const failure = checkProperties(selection, decl, level, config);
          if (failure !== null) failures.push(failure);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// chooser 390px fit — CSS-token arithmetic (render verified by visual
// round, inputs pinned here). Reads the ACTUAL stylesheets and recomputes
// the wild-chooser-ux.md §3.1 inequality, so any CSS edit that breaks the
// fit fails with the real numbers.
// ---------------------------------------------------------------------------

describe('chooser 390px fit — CSS-token arithmetic (render verified by visual round, inputs pinned here)', () => {
  const REM = 16;

  function token(css: string, re: RegExp, what: string): number {
    const m = css.match(re);
    expect(m, `token not found: ${what} (${re})`).not.toBeNull();
    return Number(m![1]);
  }

  it('re-proves the §3.1 inequality from the stylesheet text (390px and the 375px floor)', () => {
    const miniCardw = token(tableCss, /\.gd-card--mini\s*\{[^}]*--gd-cardw:\s*([\d.]+)rem/, 'mini cardw') * REM;
    const chooserBlock = tableCss.match(/\.gd-chooser\s*\{([^}]*)\}/)![1]!;
    const chooserPad = token(chooserBlock, /padding:\s*([\d.]+)rem/, 'chooser padding') * REM;
    const chooserBorder = token(chooserBlock, /border:\s*([\d.]+)px/, 'chooser border');
    const capRem = token(chooserBlock, /max-width:\s*min\(([\d.]+)rem/, 'chooser max-width cap') * REM;
    const capViewportSub = token(chooserBlock, /max-width:[^;]*calc\(100vw\s*-\s*([\d.]+)rem\)/, 'viewport sub') * REM;
    const resultGap = token(tableCss, /\.gd-chooser__result\s*\{[^}]*gap:\s*([\d.]+)rem/, 'result gap') * REM;
    const chipGap = token(tableCss, /\.gd-chooser__chip\s*\{[^}]*gap:\s*([\d.]+)rem/, 'chip gap') * REM;
    const headerGap = token(tableCss, /\.gd-chooser__header\s*\{[^}]*gap:\s*([\d.]+)rem/, 'header gap') * REM;
    const arrow = token(tableCss, /\.gd-chooser__arrow\s*\{[^}]*font-size:\s*([\d.]+)rem/, 'arrow size') * REM;
    const appPad = token(appCss, /\.app-main\s*\{[^}]*padding:\s*[\d.]+rem\s+([\d.]+)rem/, 'app-main x-padding') * REM;
    const tablePad = token(tableCss, /\.gd-table\s*\{[^}]*?padding:\s*([\d.]+)rem/, 'gd-table padding') * REM;

    const chrome = 2 * (chooserPad + chooserBorder);
    // Worst result row: 6 mini faces (7–10-card selections are single-
    // reading bombs; the chooser needs ≥2 readings), no overlap.
    const worstRow = 6 * miniCardw + 5 * resultGap;
    // One chip: wild face + gap + arrow + gap + target face.
    const chip = 2 * miniCardw + 2 * chipGap + arrow;
    const twoChips = 2 * chip + headerGap;

    for (const viewport of [390, 375]) {
      const budget = viewport - 2 * appPad - 2 * tablePad;
      const outerCap = Math.min(capRem, viewport - capViewportSub);
      expect(outerCap, `outer cap must stay within the ${viewport}px content column`).toBeLessThanOrEqual(budget);
      expect(worstRow + chrome, `6-face result row must fit at ${viewport}px`).toBeLessThanOrEqual(budget);
      expect(twoChips + chrome, `two distinct chips must fit at ${viewport}px`).toBeLessThanOrEqual(budget);
    }
    // The exact §5.4 numbers, so silent drift is visible in review.
    expect(miniCardw).toBe(32);
    expect(worstRow).toBe(202);
    expect(chip).toBe(88);
    expect(chrome).toBe(22);
  });

  // Superseded pin (item 1): the wild marker is now a language-neutral SVG
  // seal, not a sized glyph — there is no more per-size font-size ratio to
  // pin against a text legibility floor. What replaces it: the seal reads
  // as a stamp (not a smear) at the smallest shipped size, i.e. its
  // diameter clears ~8px at mini's --gd-cardw.
  it('pins the mini wild-seal diameter at ~8px (reads as a stamp, not a smear)', () => {
    const miniCardw = token(tableCss, /\.gd-card--mini\s*\{[^}]*--gd-cardw:\s*([\d.]+)rem/, 'mini cardw') * REM;
    const ratio = token(
      tableCss,
      /\.gd-card__wild\s*\{[^}]*width:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/,
      'wild seal width ratio',
    );
    expect(ratio * miniCardw).toBeGreaterThanOrEqual(8);
  });

  it('keeps Cancel outside the scroll region (only the options list scrolls)', () => {
    const optionsBlock = tableCss.match(/\.gd-chooser__options\s*\{([^}]*)\}/)![1]!;
    expect(optionsBlock).toContain('overflow-y: auto');
    const chooserBlock = tableCss.match(/\.gd-chooser\s*\{([^}]*)\}/)![1]!;
    expect(chooserBlock).not.toContain('overflow-y');
    expect(chooserBlock).toContain('max-height');
  });
});

// ---------------------------------------------------------------------------
// §6/§7.3 — optionAria: the maximal composition (two-wild SF: label + two
// substitution sentences + the played-as face list).
// ---------------------------------------------------------------------------

describe('optionAria (accessibility text backbone)', () => {
  it('composes label, every substitution sentence, and the face list (two-wild SF)', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const cards: Card[] = ['5S', '6S', '7S', '2H', '2H']; // SF-4 shape
      const decl = declOf(cards, '2', { type: 'straightFlush', keyRank: '9', suit: 'S' });
      const aria = optionAria({ cards, decl, playable: true }, '2');
      expect(aria).toContain('Straight flush 9');
      expect(aria).toContain('(5–9♠)');
      expect(aria).toContain('wild plays as 8 of Spades');
      expect(aria).toContain('wild plays as 9 of Spades');
      expect(aria).toContain('played as');
      expect(aria).toContain('7 of Spades 8 of Spades 9 of Spades');
      expect(aria).not.toContain("can't beat");
    } finally {
      setLocale(original);
    }
  });

  it('uses the collapsed both-wilds sentence and appends the unplayable note', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const cards: Card[] = ['9S', '9C', '9D', '2H', '2H']; // FH-4 shape
      const decl = declOf(cards, '2', { type: 'bomb', keyRank: '9' });
      const aria = optionAria({ cards, decl, playable: false }, '2');
      expect(aria).toContain('both wilds play as 9');
      expect(aria).toContain("can't beat the table");
    } finally {
      setLocale(original);
    }
  });

  // Totality check (M4 regression follow-up, docs/research/METHODOLOGY.md
  // QA ratchet): the chooser NEVER actually offers a jokerRank decl — a
  // joker single/pair takes no wild substitutions, so classifyPlays'ed
  // selections that reach the chooser are never joker-keyed. But comboKey's
  // caller here (optionAria's label segment) must still be TOTAL over a
  // jokerRank decl rather than falling back to the FROZEN-TYPES keyRank 'A'
  // placeholder if one ever reached it (the bug this whole regression suite
  // guards against, just exercised through the chooser's own label path
  // instead of the trick-well/feed paths covered in table.test.ts).
  it('names the joker in the label for a synthetic joker-keyed single (totality)', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const cards: Card[] = ['BJ'];
      const decl = { type: 'single', size: 1, keyRank: 'A', jokerRank: 'BJ' } as CanonicalForm;
      const aria = optionAria({ cards, decl, playable: true }, '2');
      expect(aria).toContain('Single Big Joker');
      expect(aria).not.toContain('Single A');
    } finally {
      setLocale(original);
    }
  });
});
