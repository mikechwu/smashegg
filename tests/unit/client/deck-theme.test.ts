// DeckTheme conformance suite (item 5) — runs against EVERY registered
// theme, so adding a deck means passing this ratchet before anything else.
// The client suite is DOM-free; renderToStaticMarkup exercises the real
// component tree without a browser. The 390px EYES-gate is on top of this,
// never replaced by it (a theme failing it does not ship).

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardBack, CardFace, GhostFace } from '../../../src/client/table/CardFace';
import { activeDeckTheme, deckThemes, DEFAULT_DECK_THEME_ID } from '../../../src/client/table/theme';
import { buildDeck, isWild, type Card } from '../../../src/engine/guandan/cards';

const SIZES = ['hand', 'trick', 'mini'] as const;
const DISTINCT_CARDS: Card[] = [...new Set(buildDeck())];

describe('DeckTheme registry', () => {
  it('the default lacquer theme is registered and active', () => {
    expect(deckThemes().map((t) => t.id)).toContain(DEFAULT_DECK_THEME_ID);
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
      const wild: Card = '2H'; // level '2' ⇒ 紅心2 is the wild
      expect(isWild(wild, '2')).toBe(true);
      for (const size of SIZES) {
        const html = renderToStaticMarkup(
          createElement(theme.Face, { card: wild, level: '2', size }),
        );
        expect(html).not.toContain('gd-card__wild');
      }
    });
  });
}

describe('the framework overlays (structural: no theme can remove them)', () => {
  it('the composed CardFace carries the 配 marker for the wild, and only the wild', () => {
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
});
