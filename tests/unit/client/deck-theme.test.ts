// DeckTheme conformance suite (item 5) — runs against EVERY registered
// theme, so adding a deck means passing this ratchet before anything else.
// The client suite is DOM-free; renderToStaticMarkup exercises the real
// component tree without a browser. The 390px EYES-gate is on top of this,
// never replaced by it (a theme failing it does not ship).

import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardBack, CardFace, GhostFace } from '../../../src/client/table/CardFace';
import {
  activeDeckTheme,
  deckThemes,
  setDeckTheme,
  subscribeDeckTheme,
  DEFAULT_DECK_THEME_ID,
} from '../../../src/client/table/theme';
import { buildDeck, isWild, SUITS, type Card } from '../../../src/engine/guandan/cards';
import { CINNABAR_COURT_THEME } from '../../../src/client/table/themes/cinnabar-court';
import { SUIT_PATHS } from '../../../src/client/table/themes/cinnabar-court/art';
import { PIP_LAYOUTS } from '../../../src/client/table/themes/cinnabar-court/pips';

const SIZES = ['hand', 'trick', 'mini'] as const;
const DISTINCT_CARDS: Card[] = [...new Set(buildDeck())];
const JOKERS: Card[] = ['SJ', 'BJ'];

const tableCss = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8');

describe('DeckTheme registry', () => {
  // Cinnabar Court is the owner-picked default (DEFAULT_DECK_THEME_ID
  // flipped from 'lacquer'); lacquer stays registered and selectable —
  // both facts are pinned honestly rather than assuming either theme's id.
  it('the default theme is registered and active, and lacquer remains selectable', () => {
    expect(DEFAULT_DECK_THEME_ID).toBe('cinnabar-court');
    const ids = deckThemes().map((t) => t.id);
    expect(ids).toContain(DEFAULT_DECK_THEME_ID);
    expect(ids).toContain('lacquer');
    expect(activeDeckTheme().id).toBe(DEFAULT_DECK_THEME_ID);
  });
});

for (const theme of deckThemes()) {
  describe(`theme '${theme.id}' conformance`, () => {
    it('metrics are inside the contract ranges', () => {
      expect(theme.metrics.aspect).toBeGreaterThanOrEqual(1.3);
      expect(theme.metrics.aspect).toBeLessThanOrEqual(1.6);
      expect(theme.metrics.cornerIndexMinPx).toBeGreaterThanOrEqual(10);
      expect(theme.metrics.backEdge.length).toBeGreaterThan(0);
      expect(theme.metrics.backGradient.length).toBeGreaterThan(0);
    });

    it('Face renders every distinct card at every size without throwing', () => {
      for (const card of DISTINCT_CARDS) {
        for (const size of SIZES) {
          const html = renderToStaticMarkup(
            createElement(theme.Face, { card, level: '2', size }),
          );
          expect(html.length, `${card} @ ${size}`).toBeGreaterThan(0);
        }
      }
    });

    it('Back renders at every size without throwing', () => {
      for (const size of SIZES) {
        expect(renderToStaticMarkup(createElement(theme.Back, { size })).length).toBeGreaterThan(0);
      }
    });

    it('a theme Face never emits the wild-marker markup itself (framework-owned)', () => {
      // The marker is game state: it must come from the FRAMEWORK overlay,
      // never the theme — otherwise a theme could also STYLE it away.
      const wild: Card = '2H'; // level '2' => heart 2 is the wild
      expect(isWild(wild, '2')).toBe(true);
      for (const size of SIZES) {
        const html = renderToStaticMarkup(
          createElement(theme.Face, { card: wild, level: '2', size }),
        );
        expect(html).not.toContain('gd-card__wild');
      }
    });

    // Item 5a / regression for item 4's fix: a joker face used to be a
    // vertical CJK letter-stack of the localized name — a text node that
    // letter-stacked English into overflowing columns. Jokers are wordless
    // now (silhouette-only emblems), so NO text node may survive tag
    // stripping, at any size, in any theme.
    it('joker faces carry no text nodes at any size', () => {
      for (const joker of JOKERS) {
        for (const size of SIZES) {
          const html = renderToStaticMarkup(
            createElement(theme.Face, { card: joker, level: '2', size }),
          );
          const textOnly = html.replace(/<[^>]*>/g, '');
          expect(textOnly.trim(), `${theme.id} ${joker} @ ${size}: "${textOnly}"`).toBe('');
        }
      }
    });
  });
}

describe('the framework overlays (structural: no theme can remove them)', () => {
  it('the composed CardFace carries the wild marker for the wild, and only the wild', () => {
    for (const size of SIZES) {
      const wildHtml = renderToStaticMarkup(createElement(CardFace, { card: '2H', level: '2', size }));
      expect(wildHtml).toContain('gd-card__wild');
      const plainHtml = renderToStaticMarkup(createElement(CardFace, { card: '2S', level: '2', size }));
      expect(plainHtml).not.toContain('gd-card__wild');
      // Level moves the wild with it: at level '7', 7H is wild and 2H is not.
      const movedHtml = renderToStaticMarkup(createElement(CardFace, { card: '7H', level: '7', size }));
      expect(movedHtml).toContain('gd-card__wild');
      const demotedHtml = renderToStaticMarkup(createElement(CardFace, { card: '2H', level: '7', size }));
      expect(demotedHtml).not.toContain('gd-card__wild');
    }
  });

  it('GhostFace always carries the marker (the wild is at work on this card)', () => {
    const html = renderToStaticMarkup(createElement(GhostFace, { rank: '9', suit: 'S', size: 'mini' }));
    expect(html).toContain('gd-card__wild');
  });

  it('CardBack routes through the active theme', () => {
    const html = renderToStaticMarkup(createElement(CardBack, { size: 'trick' }));
    expect(html).toContain('gd-cardframe');
  });

  it('the marker paints ABOVE any theme content (CSS stacking pin, panel hardening)', () => {
    // The frame is an isolated stacking context and the framework marker
    // sits on its own z layer — a theme's internal z-index games cannot
    // cover it. Pinned from the stylesheet text (the chooser-faces CSS-token
    // ratchet precedent).
    const css = readFileSync(
      join(__dirname, '../../../src/client/table/table.css'),
      'utf8',
    );
    const frameRule = css.match(/^\.gd-cardframe\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(frameRule).toContain('isolation: isolate');
    const markerRule = css.match(/\.gd-cardframe\s*>\s*\.gd-card__wild\s*\{[^}]*\}/)?.[0] ?? '';
    expect(markerRule).toContain('z-index: 1');
  });

  it('the physical-deal deck slabs apply only to the deck back, not the marker face', () => {
    const css = readFileSync(
      join(__dirname, '../../../src/client/table/table.css'),
      'utf8',
    );
    const deckDepthBlock = css.match(/\/\* Deck depth[\s\S]*?\/\* Undealt fan/)?.[0] ?? '';
    expect(deckDepthBlock).not.toMatch(
      /\.gd-deal__deck(?:\[data-depth-tier='[0-3]'\])?\s+\.gd-card\s*\{/,
    );
    expect(deckDepthBlock).not.toMatch(/\.gd-deal__marker\s+\.gd-card/);

    const scopedSelectors = [...deckDepthBlock.matchAll(
      /(^|\n)(\.gd-deal__deck(?:\[data-depth-tier='[0-3]'\])?\s*>\s*\.gd-cardframe\s*>\s*\.gd-card)\s*\{/g,
    )].map((match) => match[2].replace(/\s+/g, ' '));
    expect(scopedSelectors).toEqual([
      '.gd-deal__deck > .gd-cardframe > .gd-card',
      ".gd-deal__deck[data-depth-tier='3'] > .gd-cardframe > .gd-card",
      ".gd-deal__deck[data-depth-tier='2'] > .gd-cardframe > .gd-card",
      ".gd-deal__deck[data-depth-tier='1'] > .gd-cardframe > .gd-card",
      ".gd-deal__deck[data-depth-tier='0'] > .gd-cardframe > .gd-card",
    ]);
  });

  it('the centre well paints above the physical-deal deck layer', () => {
    const css = readFileSync(
      join(__dirname, '../../../src/client/table/table.css'),
      'utf8',
    );
    const dealRule = css.match(/^\.gd-deal\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(dealRule).toContain('z-index: 9');
    const wellRule = css.match(/^\.gd-well\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(wellRule).toContain('position: relative');
    expect(wellRule).toContain('z-index: 10');
  });
});

// Item 5b/c: the wild seal's geometry, CSS-token-pinned the same way the
// chooser-faces §3.1 ratchet pins layout — read the actual stylesheet, not
// a restated constant, so a CSS edit that drifts the geometry fails here
// with the real numbers.
describe('wild seal geometry (CSS-token pin)', () => {
  it('sits IN-COLUMN: left + width stays inside the 0.40w fan-visible sliver, clear of the card edge', () => {
    // Anchored to line start: ".gd-cardframe > .gd-card__wild { z-index: 1 }"
    // (the stacking-order rule, pinned separately above) also contains the
    // substring '.gd-card__wild {' but does not START the line with it.
    const wildRule = tableCss.match(/^\.gd-card__wild\s*\{[^}]*\}/m)?.[0] ?? '';
    const left = Number(wildRule.match(/left:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/)?.[1]);
    const width = Number(wildRule.match(/width:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/)?.[1]);
    expect(left, 'left multiplier not found in .gd-card__wild').not.toBeNaN();
    expect(width, 'width multiplier not found in .gd-card__wild').not.toBeNaN();
    expect(left).toBeGreaterThanOrEqual(0.05);
    expect(left + width).toBeLessThanOrEqual(0.4);
  });

  it('regression: the old junction-riding triangle (clip-path) is gone', () => {
    const wildRule = tableCss.match(/^\.gd-card__wild\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(wildRule.length).toBeGreaterThan(0);
    expect(wildRule).not.toContain('clip-path');
  });
});

// Item 4 regression: the joker emblem box reproduced the exact defect its
// own rewrite was meant to fix — a right edge past the 0.40w fan-visible
// sliver (fixed-px margin on a scaling box drifts the ratio as cardw
// shrinks at hand size). Pinned the same way as the wild seal above so a
// future edit that re-introduces a fixed-px offset or grows the box fails
// here with the real numbers, not just at the wild seal's check.
describe('joker emblem geometry (CSS-token pin)', () => {
  it('sits IN-COLUMN: left + width stays inside the 0.40w fan-visible sliver, clear of the card edge', () => {
    const jokerRule = tableCss.match(/^\.gd-card__jokerMark\s*\{[^}]*\}/m)?.[0] ?? '';
    const left = Number(jokerRule.match(/left:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/)?.[1]);
    const width = Number(jokerRule.match(/width:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/)?.[1]);
    expect(left, 'left multiplier not found in .gd-card__jokerMark').not.toBeNaN();
    expect(width, 'width multiplier not found in .gd-card__jokerMark').not.toBeNaN();
    expect(left + width).toBeLessThanOrEqual(0.4);
  });

  it('regression: no fixed-px margin/offset that would drift the ratio as --gd-cardw shrinks', () => {
    const jokerRule = tableCss.match(/^\.gd-card__jokerMark\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(jokerRule.length).toBeGreaterThan(0);
    expect(jokerRule).not.toContain('margin');
    expect(jokerRule).toContain('position: absolute');
  });
});

// Generalizes the pin above to EVERY theme's joker-identity emblem/index
// class, not just lacquer's — a future theme reproducing the exact fixed-px
// defect on ITS OWN box must fail here too. Selector regexes are anchored to
// the LINE START (the wild-seal pin's own comment explains why: a bare
// substring match can hit an unrelated combinator rule that happens to
// contain the class name, e.g. `.foo > svg { ... }` under a `.foo { ... }`
// rule).
describe('joker-identity emblem geometry across every theme (CSS-token pin)', () => {
  const JOKER_IDENTITY_CLASSES = [
    { theme: 'lacquer', selector: '.gd-card__jokerMark' },
    { theme: 'cinnabar-court', selector: '.gd-ccourt__jokerEmblem' },
  ];

  for (const { theme, selector } of JOKER_IDENTITY_CLASSES) {
    it(`${theme}'s ${selector} sits IN-COLUMN with no fixed-px/rem horizontal offset`, () => {
      const escaped = selector.replace(/\./g, '\\.');
      const rule = tableCss.match(new RegExp(`^${escaped}\\s*\\{[^}]*\\}`, 'm'))?.[0] ?? '';
      expect(rule.length, `rule not found: ${selector}`).toBeGreaterThan(0);

      const left = Number(rule.match(/left:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)\)/)?.[1]);
      const width = Number(rule.match(/width:\s*calc\(var\(--gd-cardw\)\s*\*\s*([\d.]+)/)?.[1]);
      expect(left, `${selector}: left multiplier not found`).not.toBeNaN();
      expect(width, `${selector}: width multiplier not found`).not.toBeNaN();
      expect(left + width, `${selector}: right edge past the 0.40w sliver`).toBeLessThanOrEqual(0.4);

      // Horizontal properties only (left/right/width) — a fixed-px/rem
      // TOP or HEIGHT can't drift the fan-visible ratio, only a horizontal
      // one can.
      const horizontalDecls = rule.match(/(?:^|[\s{])(?:left|right|width)\s*:[^;]*;/gm) ?? [];
      expect(horizontalDecls.length, `${selector}: no left/right/width declarations found`).toBeGreaterThan(0);
      for (const decl of horizontalDecls) {
        expect(decl, `${selector}: fixed-px/rem horizontal offset in "${decl.trim()}"`).not.toMatch(/\d(?:px|rem)\b/);
      }
    });
  }
});

// Item 4b: 'mini' is index-only for EVERY theme's court/joker faces — the
// full body illustration only earns its keep at sizes big enough to read
// it (hand/trick). Data comes from the theme's own rendered markup, not a
// restated constant, so a Face that drops the body at hand/trick (or grows
// it back in at mini) fails here with the real HTML.
describe("cinnabar-court body-art ladder ('mini' = index only)", () => {
  it('courts and jokers carry a body svg at hand/trick but not at mini', () => {
    const cards: Card[] = ['KS', 'QH', 'JD', 'BJ', 'SJ'];
    for (const card of cards) {
      for (const size of ['hand', 'trick'] as const) {
        const html = renderToStaticMarkup(
          createElement(CINNABAR_COURT_THEME.Face, { card, level: '2', size }),
        );
        expect(html, `${card} @ ${size}: missing body art`).toContain('gd-ccourt__body');
      }
      const miniHtml = renderToStaticMarkup(
        createElement(CINNABAR_COURT_THEME.Face, { card, level: '2', size: 'mini' }),
      );
      expect(miniHtml, `${card} @ mini: body art should not render`).not.toContain('gd-ccourt__body');
    }
  });
});

// Item 4c: the pip field must paint exactly one suit-path occurrence per
// spot, plus the ONE more occurrence painted by the corner index glyph
// (same SUIT_PATHS entry, reused for both). The expected count below is the
// standard French pip count per rank, typed independently of PIP_LAYOUTS —
// if it were `layout.length` instead, a dropped or doubled spot in
// PIP_LAYOUTS would move the expectation right along with the render and
// this test would never fail, contrary to what it claims to guard against.
describe('cinnabar-court pip count (independent of PIP_LAYOUTS)', () => {
  const EXPECTED_PIP_COUNT: Record<string, number> = {
    A: 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    T: 10,
  };

  it('PIP_LAYOUTS matches the standard French pip count for every rank', () => {
    for (const [rank, layout] of Object.entries(PIP_LAYOUTS)) {
      expect(layout.length, `${rank}: PIP_LAYOUTS spot count`).toBe(EXPECTED_PIP_COUNT[rank]);
    }
  });

  it('the hand face paints exactly one suit-path occurrence per pip, plus the corner index glyph', () => {
    for (const suit of SUITS) {
      for (const rank of Object.keys(PIP_LAYOUTS)) {
        const card = `${rank}${suit}` as Card;
        const html = renderToStaticMarkup(
          createElement(CINNABAR_COURT_THEME.Face, { card, level: '2', size: 'hand' }),
        );
        const occurrences = html.split(SUIT_PATHS[suit]).length - 1;
        expect(occurrences, `${card} @ hand: expected ${EXPECTED_PIP_COUNT[rank] + 1} suit-path occurrences`).toBe(
          EXPECTED_PIP_COUNT[rank] + 1,
        );
      }
    }
  });
});

// Item 5d: the defect CLASS, not just the one joker instance that exposed
// it — writing-mode: vertical-rl + text-orientation: upright letter-stacks
// any English text painted through a .gd-card rule, so no .gd-card rule may
// reintroduce it, whatever future theme or element it lands on.
describe('letter-stack regression (the defect class, not just the joker instance)', () => {
  it('no .gd-card rule sets writing-mode: vertical-rl', () => {
    const gdCardRules = [...tableCss.matchAll(/\.gd-card[\w-]*[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(gdCardRules.length).toBeGreaterThan(0);
    for (const rule of gdCardRules) {
      expect(rule).not.toContain('writing-mode: vertical-rl');
    }
  });
});

// Item 5e: setDeckTheme/subscribeDeckTheme, the reactive preference's
// write + notify half. vitest.config.ts runs this suite under environment:
// 'node', which has no global `localStorage` at all — the SAME branch
// production hits in storage-unavailable settings (private mode, quota).
// So the very first test below needs no mock; the later ones stub a
// minimal Storage-shaped object with vi.stubGlobal to exercise the persist
// path. Order matters: the no-global-storage test must run BEFORE any
// setDeckTheme call in this file sets the in-memory override, or it would
// trivially pass off that override instead of the storage-unavailable
// fallback it's meant to pin.
describe('reactive deck-theme preference (item 2)', () => {
  function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    return store;
  }

  it('with no localStorage global, activeDeckTheme returns the default without crashing', () => {
    expect(typeof localStorage).toBe('undefined');
    expect(() => activeDeckTheme()).not.toThrow();
    expect(activeDeckTheme().id).toBe(DEFAULT_DECK_THEME_ID);
  });

  it('setDeckTheme persists to storage and notifies subscribers', () => {
    const store = stubStorage();
    const seen: string[] = [];
    const unsubscribe = subscribeDeckTheme(() => seen.push(activeDeckTheme().id));
    try {
      setDeckTheme(DEFAULT_DECK_THEME_ID);
      expect(seen).toEqual([DEFAULT_DECK_THEME_ID]);
      expect(store.get('pref:deckTheme')).toBe(DEFAULT_DECK_THEME_ID);
    } finally {
      unsubscribe();
      vi.unstubAllGlobals();
    }
  });

  it('rejects an unregistered id with no crash, no persist, no notify', () => {
    const store = stubStorage();
    const seen: string[] = [];
    const unsubscribe = subscribeDeckTheme(() => seen.push(activeDeckTheme().id));
    try {
      expect(() => setDeckTheme('not-a-real-theme')).not.toThrow();
      expect(seen).toEqual([]);
      expect(store.has('pref:deckTheme')).toBe(false);
    } finally {
      unsubscribe();
      vi.unstubAllGlobals();
    }
  });
});
