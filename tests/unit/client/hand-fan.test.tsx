// Obs 3 ratchet: the fan's arrival-order → sorted mapping and display. The
// FLIP slide is a WAAPI animation (browser-only, covered by the eyes-gate);
// the pure decision — that arrival order maps bijectively onto the sorted fan
// and the fan lays cards out in deal order while dealing — is pinned here.
//
// This file also carries the settled-layout (stacked columns, owner
// reference) geometry ratchet: groupHandColumns/stackOffsetW's pure curves,
// and the CSS-token arithmetic re-proving the 390px worst-case fit from the
// actual stylesheet text — table.css's own tokens AND app.css's .app-main
// padding (the real available width is the viewport minus BOTH wrappers'
// horizontal padding, not just .gd-table's own) — same idiom as
// chooser-faces.test.ts's ratchet: render is owned by the visual round,
// inputs are pinned here.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandFan, dealToHandIndices, groupHandColumns, stackOffsetW } from '../../../src/client/table/HandFan';
import { RANKS, buildDeck, levelValue, sortCards, type Card, type Rank } from '../../../src/engine/guandan/cards';

const tableCss = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8');

const NOOP = () => {};
const EMPTY = new Set<number>();
const EMPTY_GLOW = new Set<Card>();

describe('dealToHandIndices (obs 3)', () => {
  it('is a bijection deal-position → sorted index that recovers the deal order', () => {
    const dealOrder: Card[] = ['9S', '2H', 'KD', '5C', 'AH', '2H', 'TS', 'SJ'];
    const hand = sortCards(dealOrder, '2');
    const map = dealToHandIndices(dealOrder, hand);
    // A permutation of 0..n-1 (each sorted slot used exactly once).
    expect([...map].sort((a, b) => a - b)).toEqual(hand.map((_, i) => i));
    // hand[map[j]] === dealOrder[j] — the mapping recovers arrival order,
    // duplicates included (both 2H land on distinct slots).
    map.forEach((handIdx, j) => expect(hand[handIdx]).toBe(dealOrder[j]));
  });

  it('handles a full 27-card hand with duplicates', () => {
    const dealOrder: Card[] = [
      '2H', '2H', '5S', '5S', '9D', 'KC', 'KC', 'AS', '3H', '3H', '7C', 'TD', 'TD', 'JS',
      'QH', 'QH', '4D', '6S', '8C', 'BJ', 'SJ', '2S', '5H', '9C', 'KD', 'AH', '7S',
    ];
    const hand = sortCards(dealOrder, '2');
    const map = dealToHandIndices(dealOrder, hand);
    expect([...map].sort((a, b) => a - b)).toEqual(hand.map((_, i) => i));
    map.forEach((handIdx, j) => expect(hand[handIdx]).toBe(dealOrder[j]));
  });
});

describe('HandFan arrival-order display (obs 3)', () => {
  const dealOrder: Card[] = ['9S', '2H', 'KD', '5C', 'AH'];
  const hand = sortCards(dealOrder, '2');

  function labelsInOrder(html: string): string[] {
    return [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]!);
  }

  it('lays cards out in DEAL order while dealing, not sorted', () => {
    const dealHtml = renderToStaticMarkup(
      createElement(HandFan, {
        hand,
        level: '2',
        selected: EMPTY,
        onToggle: NOOP,
        glow: EMPTY_GLOW,
        dealOrder,
        revealed: hand.length,
      }),
    );
    const sortedHtml = renderToStaticMarkup(
      createElement(HandFan, { hand, level: '2', selected: EMPTY, onToggle: NOOP, glow: EMPTY_GLOW }),
    );
    const dealLabels = labelsInOrder(dealHtml);
    const sortedLabels = labelsInOrder(sortedHtml);
    // The dealing fan is a permutation of the settled fan (same cards)…
    expect([...dealLabels].sort()).toEqual([...sortedLabels].sort());
    // …but in a DIFFERENT (arrival) order — this hand is not already sorted.
    expect(dealLabels).not.toEqual(sortedLabels);
  });

  it('reveals only the landed prefix while dealing (undealt slots hidden)', () => {
    const html = renderToStaticMarkup(
      createElement(HandFan, {
        hand,
        level: '2',
        selected: EMPTY,
        onToggle: NOOP,
        glow: EMPTY_GLOW,
        dealOrder,
        revealed: 2,
      }),
    );
    const undealt = (html.match(/gd-fan__card--undealt/g) ?? []).length;
    expect(undealt).toBe(hand.length - 2);
  });
});

// ---------------------------------------------------------------------------
// Settled layout (owner reference): groupHandColumns / stackOffsetW pure
// curves, no DOM needed.
// ---------------------------------------------------------------------------

describe('groupHandColumns (settled layout, owner reference)', () => {
  const level: Rank = '2';

  it('the wild lands INSIDE the level column with natural 2s (all share levelValue 15)', () => {
    // Ascending sortCards order for this hand: 3S(3) < 4D(4) <
    // {2C,2H,2S}(15, the wild ties naturals and the trio breaks by card
    // code) < SJ(16) < BJ(17) — the two natural 2s and the wild 2H all
    // share levelValue 15 at level '2', so they must land in ONE column.
    const hand: Card[] = ['2S', '2C', '2H', '3S', '4D', 'SJ', 'BJ'];
    const sorted = sortCards(hand, level);
    const order = sorted.map((_, i) => i);
    const columns = groupHandColumns(order, sorted, level);
    const columnCards = columns.map((col) => col.map((i) => sorted[i]));
    expect(columnCards).toEqual([['3S'], ['4D'], ['2C', '2H', '2S'], ['SJ'], ['BJ']]);
  });

  it('SJ and BJ never share a column even though both are jokers', () => {
    const hand: Card[] = ['SJ', 'SJ', 'BJ', 'BJ'];
    const sorted = sortCards(hand, level);
    const order = sorted.map((_, i) => i);
    const columns = groupHandColumns(order, sorted, level);
    const columnCards = columns.map((col) => col.map((i) => sorted[i]));
    expect(columnCards).toEqual([['SJ', 'SJ'], ['BJ', 'BJ']]);
  });

  it('descending display reverses COLUMN order (groups computed AFTER the reverse)', () => {
    const hand: Card[] = ['2S', '2C', '2H', '3S', '4D', 'SJ', 'BJ'];
    const sorted = sortCards(hand, level);
    const ascendingOrder = sorted.map((_, i) => i);
    const descendingOrder = [...ascendingOrder].reverse();
    const ascendingColumns = groupHandColumns(ascendingOrder, sorted, level);
    const descendingColumns = groupHandColumns(descendingOrder, sorted, level);
    expect(descendingColumns.map((col) => col.map((i) => sorted[i]))).toEqual([
      ['BJ'],
      ['SJ'],
      ['2S', '2H', '2C'],
      ['4D'],
      ['3S'],
    ]);
    // Same columns, reverse order AND each column's own internal order
    // reversed too — the descending display is the full-array reverse.
    expect([...descendingColumns].reverse().map((col) => [...col].reverse())).toEqual(ascendingColumns);
  });

  it('the empty hand groups into zero columns', () => {
    expect(groupHandColumns([], [], level)).toEqual([]);
  });

  it('a 27-card hand touching all 15 levelValue classes yields exactly 15 columns', () => {
    // 12 non-level natural ranks (one each) + a 4-card level-'2' column
    // (3 naturals + the wild) + SJ + BJ = 15 + 12 extra filler naturals to
    // reach 27 total, none of which introduce a 16th class.
    const hand: Card[] = [
      '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', 'AS', // 12 non-level ranks
      '2S', '2C', '2D', '2H', // level column: 3 naturals + the wild
      'SJ', 'BJ',
      // 9 filler naturals, all re-using already-present ranks (no new class):
      '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD',
    ];
    expect(hand).toHaveLength(27);
    const sorted = sortCards(hand, level);
    const order = sorted.map((_, i) => i);
    const columns = groupHandColumns(order, sorted, level);
    expect(columns).toHaveLength(15);
    expect(columns.reduce((sum, col) => sum + col.length, 0)).toBe(27);
  });
});

describe('stackOffsetW (settled layout column-height curve, per-theme stripW)', () => {
  it('short columns (2..4 cards) all expose the full stripW, whatever the theme claims', () => {
    // cinnabar-court's stripW (its own two-line vertical column).
    expect(stackOffsetW(2, 0.841)).toBe(0.841);
    expect(stackOffsetW(3, 0.841)).toBe(0.841);
    expect(stackOffsetW(4, 0.841)).toBe(0.841);
    // lacquer's stripW (its one-line horizontal row).
    expect(stackOffsetW(2, 0.42)).toBe(0.42);
    expect(stackOffsetW(3, 0.42)).toBe(0.42);
    expect(stackOffsetW(4, 0.42)).toBe(0.42);
  });

  it('is monotonic non-increasing as the column grows, for any stripW', () => {
    for (const stripW of [0.42, 0.841]) {
      let prev = stackOffsetW(2, stripW);
      for (let n = 3; n <= 12; n++) {
        const cur = stackOffsetW(n, stripW);
        expect(cur, `stripW=${stripW}: stackOffsetW(${n}) should not exceed stackOffsetW(${n - 1})`).toBeLessThanOrEqual(
          prev,
        );
        prev = cur;
      }
    }
  });

  it('the budget only binds once 2.95/(n-1) drops below stripW: an 8-copy lacquer column (stripW 0.42) still gets the full line', () => {
    // 2.95/7 ≈ 0.4214, still above 0.42 — the cap wins, stripW passes through unchanged.
    expect(stackOffsetW(8, 0.42)).toBe(0.42);
    // 2.95/8 ≈ 0.36875, below 0.42 — the budget now binds and compresses below stripW.
    expect(stackOffsetW(9, 0.42)).toBeCloseTo(2.95 / 8, 10);
    expect(stackOffsetW(9, 0.42)).toBeLessThan(0.42);
  });

  it('an 8-copy cinnabar-court column (stripW 0.841) is still budget-compressed (unchanged behavior)', () => {
    // 2.95/7 ≈ 0.4214 is well below 0.841, so the budget already binds here —
    // same curve this theme relied on before stackStripW existed.
    expect(stackOffsetW(8, 0.841)).toBeCloseTo(2.95 / 7, 10);
    expect(stackOffsetW(8, 0.841)).toBeGreaterThanOrEqual(0.42);
  });
});

// ---------------------------------------------------------------------------
// Engine-derived class-count pin: the worst-case column count the 390px
// arithmetic below depends on. Reads buildDeck()/levelValue directly rather
// than restating "15" independently, so a future engine change to the
// value space would fail loudly here first.
// ---------------------------------------------------------------------------

describe('engine-derived class-count pin (worst-case column count)', () => {
  it('every level rank sees exactly 15 distinct levelValue classes across buildDeck()', () => {
    const deck = buildDeck();
    for (const level of RANKS) {
      const classes = new Set(deck.map((card) => levelValue(card, level)));
      expect(classes.size, `level ${level}: distinct levelValue classes`).toBe(15);
    }
  });
});

// ---------------------------------------------------------------------------
// CSS-token arithmetic (render verified by the visual round, inputs pinned
// here — same idiom as chooser-faces.test.ts's ratchet).
// ---------------------------------------------------------------------------

describe('hand-card clamp lockstep (CSS-token pin)', () => {
  function clampToken(block: string, what: string): string {
    const m = block.match(/clamp\(([^)]+)\)/);
    expect(m, `clamp(...) not found: ${what}`).not.toBeNull();
    return m![1]!.replace(/\s+/g, ' ').trim();
  }

  it('the hand card, the flat dealing-fan overlap and the column pitch all share ONE clamp literal', () => {
    const handBlock = tableCss.match(/\.gd-card--hand\s*\{[^}]*\}/)?.[0] ?? '';
    const fanOverlapBlock =
      tableCss.match(/\.gd-fan__row > \.gd-fan__card \+ \.gd-fan__card\s*\{[^}]*\}/)?.[0] ?? '';
    // Unconditional on EVERY .gd-fan__stack (not a `+` sibling rule) — see
    // that rule's own comment: a sibling-scoped margin cannot tell a
    // wrapped line's first stack apart from a mid-line one, since both are
    // DOM-adjacent to the previous stack once .gd-fan__stackRow wraps.
    const stackPitchBlock = tableCss.match(/\.gd-fan__stack\s*\{[^}]*\}/)?.[0] ?? '';
    expect(handBlock.length, 'rule not found: .gd-card--hand').toBeGreaterThan(0);
    expect(fanOverlapBlock.length, 'rule not found: .gd-fan__row > .gd-fan__card + .gd-fan__card').toBeGreaterThan(0);
    expect(stackPitchBlock.length, 'rule not found: .gd-fan__stack').toBeGreaterThan(0);

    // Only the CLAMP literal (the --gd-cardw token) is shared lockstep — the
    // FACTOR each rule multiplies it by has diverged since the horizontal
    // index round: the flat dealing fan keeps -0.6 (0.40w visible, its own
    // constraint, untouched), while the settled-mode column pitch widened to
    // -0.30 (0.70w visible — the full single-glyph horizontal index row a
    // covered column now shows needs more of its own width exposed).
    const handClamp = clampToken(handBlock, '.gd-card--hand');
    const fanClamp = clampToken(fanOverlapBlock, 'fan overlap rule');
    const stackClamp = clampToken(stackPitchBlock, 'stack pitch rule');
    expect(fanClamp, 'fan overlap clamp must be IDENTICAL to the hand card clamp').toBe(handClamp);
    expect(stackClamp, 'stack pitch clamp must be IDENTICAL to the hand card clamp').toBe(handClamp);

    // The stack-overlap margin is an INLINE style on the card button of the
    // form calc(var(--gd-cardw) * F). Custom properties resolve against
    // ANCESTORS and the card's own --gd-cardw lives on a DESCENDANT of the
    // button, so the fan CONTAINER must define the var too — without it the
    // calc is invalid and the margin silently computes to 0 (found live:
    // stacked columns rendered with no overlap at all). Pin the declaration
    // (comments stripped — the deck-theme stacking pin shows why) AND its
    // lockstep with the hand clamp.
    const fanBlock = (tableCss.match(/^\.gd-fan\s*\{[^}]*\}/m)?.[0] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(
      fanBlock,
      '.gd-fan must define --gd-cardw for the inline stack margins to resolve',
    ).toMatch(/--gd-cardw:\s*clamp\(/);
    const fanVarClamp = clampToken(fanBlock, '.gd-fan --gd-cardw');
    expect(fanVarClamp, '.gd-fan --gd-cardw clamp must be IDENTICAL to the hand card clamp').toBe(
      handClamp,
    );

    // -0.6 stays ONLY on the flat dealing fan (Obs 3's own arithmetic, never
    // touched by this round); the settled-mode stack pitch is now -0.30 (see
    // the divergence comment above and the 390px wrap pin below, which
    // derives the real per-line column count from this exact factor instead
    // of a hardcoded number).
    expect(fanOverlapBlock).toMatch(/\*\s*-0\.6\)/);
    expect(stackPitchBlock).toMatch(/\*\s*-0\.3\)/);
  });

  it('.gd-fan__stackRow declares flex-wrap: wrap (the rare 15-class fresh hand wraps to two centered lines at 390)', () => {
    const stackRowBlock = (tableCss.match(/\.gd-fan__stackRow\s*\{[^}]*\}/)?.[0] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(stackRowBlock.length, 'rule not found: .gd-fan__stackRow').toBeGreaterThan(0);
    expect(stackRowBlock).toMatch(/flex-wrap:\s*wrap\s*;/);
  });

  it(".gd-fan__stackRow's padding-left exactly cancels .gd-fan__stack's own margin-left (wrapped lines share one centre axis)", () => {
    // .gd-fan__stack's margin-left is now UNCONDITIONAL (every stack, not
    // just non-first DOM siblings — see that rule's comment for why a
    // sibling selector cannot survive flex-wrap: wrap). That means the
    // first stack of every wrapped line — including line 1 — carries a
    // margin it must NOT visually keep, or the line shifts off-centre
    // relative to a lone single-line row of the same column count.
    // .gd-fan__stackRow's padding-left is the compensation: same magnitude,
    // opposite sign, so it must stay in lockstep with the margin or this
    // cancellation (and the shared centre axis across wrapped lines) breaks
    // silently.
    const stackRowBlock = tableCss.match(/\.gd-fan__stackRow\s*\{[^}]*\}/)?.[0] ?? '';
    const stackBlock = tableCss.match(/\.gd-fan__stack\s*\{[^}]*\}/)?.[0] ?? '';
    expect(stackRowBlock.length, 'rule not found: .gd-fan__stackRow').toBeGreaterThan(0);
    expect(stackBlock.length, 'rule not found: .gd-fan__stack').toBeGreaterThan(0);

    const paddingMatch = stackRowBlock.match(/padding-left:\s*calc\((clamp\([^)]*\))\s*\*\s*([\d.]+)\)/);
    const marginMatch = stackBlock.match(/margin-left:\s*calc\((clamp\([^)]*\))\s*\*\s*-([\d.]+)\)/);
    expect(paddingMatch, 'padding-left: calc(... * F) not found on .gd-fan__stackRow').not.toBeNull();
    expect(marginMatch, 'margin-left: calc(... * -F) not found on .gd-fan__stack').not.toBeNull();

    expect(paddingMatch![1]!.trim(), 'padding-left must share the hand-card clamp literal').toBe(
      marginMatch![1]!.trim(),
    );
    expect(Number(paddingMatch![2]), 'padding-left factor must exactly cancel the margin-left factor').toBe(
      Number(marginMatch![2]),
    );
  });
});

describe('390 worst-case fit pin (CSS-token)', () => {
  const REM = 16;

  // CSS padding shorthand: 1 value (all sides), 2 (vert | horiz),
  // 3 (top | horiz | bottom), 4 (top | right | bottom | left). Every
  // padding value in these two rules is a plain rem literal.
  function horizontalPaddingPx(cssBlock: string, selector: string): number {
    const m = cssBlock.match(/padding:\s*([^;]+);/);
    expect(m, `padding not found: ${selector}`).not.toBeNull();
    const parts = m![1]!.trim().split(/\s+/);
    const remOf = (v: string) => {
      expect(v.endsWith('rem'), `expected a rem literal in ${selector} padding, got "${v}"`).toBe(true);
      return Number(v.replace('rem', '')) * REM;
    };
    if (parts.length === 1) return 2 * remOf(parts[0]!);
    if (parts.length === 2) return 2 * remOf(parts[1]!);
    if (parts.length === 3) return 2 * remOf(parts[1]!);
    return remOf(parts[1]!) + remOf(parts[3]!);
  }

  // Owner-directed refinement round: the wider 0.70w column pitch (the
  // horizontal index row's own fit need — see the clamp-lockstep pin above)
  // means 15 columns no longer fit one line at 390px, so .gd-fan__stackRow
  // now wraps (flex-wrap: wrap, pinned above) instead of forcing everything
  // onto one row. What must still hold, re-derived from the REAL stylesheet
  // tokens rather than a hardcoded number: (a) at least 8 columns fit on one
  // line, so the worst-case 15-class fresh hand (12 non-level natural ranks
  // + the level class + SJ + BJ) never needs more than
  // ceil(15 / 8) = 2 wrapped lines; (b) flex-wrap: wrap is actually declared
  // (re-pinned here by a comment-stripped match, independent of the dedicated
  // pin above, so this test alone still catches a regression).
  it('at least 8 columns at the -0.30 pitch fit one line inside the REAL mobile content width at 390px (15 classes never exceed 2 lines)', () => {
    const handBlock = tableCss.match(/\.gd-card--hand\s*\{[^}]*\}/)?.[0] ?? '';
    const clampMatch = handBlock.match(/clamp\(([\d.]+)rem,\s*([\d.]+)vw,\s*([\d.]+)rem\)/);
    expect(clampMatch, 'hand clamp tokens not found').not.toBeNull();
    const minPx = Number(clampMatch![1]) * REM;
    const vw = Number(clampMatch![2]);
    const maxPx = Number(clampMatch![3]) * REM;

    const stackPitchBlock = tableCss.match(/\.gd-fan__stack\s*\{[^}]*\}/)?.[0] ?? '';
    const pitchMatch = stackPitchBlock.match(/margin-left:\s*calc\(clamp\([^)]*\)\s*\*\s*-([\d.]+)\)/);
    expect(pitchMatch, 'stack pitch factor not found').not.toBeNull();
    const pitchFactor = Number(pitchMatch![1]);
    const visibleFraction = 1 - pitchFactor;

    const viewport = 390;
    const operativeWidth = Math.min(Math.max((vw / 100) * viewport, minPx), maxPx);
    expect(operativeWidth).toBe(50.7);
    expect(visibleFraction).toBeCloseTo(0.7, 10);

    // The real available content width at the table screen is NOT just
    // .gd-table's own padding: RoomPage.tsx wraps <GameTable> (whose
    // top-level element is .gd-table) in <main className="app-main
    // app-main--wide">, and app-main--wide only widens max-width (its own
    // comment: "the table itself is full-bleed") — it does not remove
    // .app-main's horizontal padding. Both stylesheets' own padding tokens
    // are parsed here rather than hardcoded, so a future padding change to
    // either rule fails this pin instead of silently re-opening the gap.
    const appCss = readFileSync(join(__dirname, '../../../src/client/app.css'), 'utf8');
    const appMainBlock = appCss.match(/\.app-main\s*\{[^}]*\}/)?.[0] ?? '';
    const gdTableBlock = tableCss.match(/\.gd-table\s*\{[^}]*\}/)?.[0] ?? '';
    expect(appMainBlock.length, 'rule not found: .app-main').toBeGreaterThan(0);
    expect(gdTableBlock.length, 'rule not found: .gd-table').toBeGreaterThan(0);
    const availableWidth =
      viewport -
      horizontalPaddingPx(appMainBlock, '.app-main') -
      horizontalPaddingPx(gdTableBlock, '.gd-table');
    expect(availableWidth).toBe(342);

    // Total width for k columns at the real pitch: the first column's full
    // width, plus (k-1) more columns each contributing only their visible
    // sliver. Find the largest k that still fits the real budget.
    const widthFor = (k: number) => (1 + (k - 1) * visibleFraction) * operativeWidth;
    let maxColumnsPerLine = 1;
    while (widthFor(maxColumnsPerLine + 1) <= availableWidth) maxColumnsPerLine++;
    expect(maxColumnsPerLine).toBeGreaterThanOrEqual(8);

    const worstCaseColumns = 15; // 12 non-level natural ranks + level + SJ + BJ
    const linesNeeded = Math.ceil(worstCaseColumns / maxColumnsPerLine);
    expect(linesNeeded).toBeLessThanOrEqual(2);
    // The full 15-column row no longer fits ONE line at this wider pitch —
    // confirms flex-wrap: wrap is load-bearing, not a defensive no-op.
    expect(widthFor(worstCaseColumns)).toBeGreaterThan(availableWidth);
  });

  it('flex-wrap: wrap is declared on .gd-fan__stackRow (comment-stripped match)', () => {
    const stackRowBlock = (tableCss.match(/\.gd-fan__stackRow\s*\{[^}]*\}/)?.[0] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(stackRowBlock.length, 'rule not found: .gd-fan__stackRow').toBeGreaterThan(0);
    expect(stackRowBlock).toMatch(/flex-wrap:\s*wrap\s*;/);
  });
});
