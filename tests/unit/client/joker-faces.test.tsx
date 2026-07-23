// The joker registry (joker round): the owner's three SVG parts composed
// into JokerFace (jokers.tsx + joker-art-data.ts), consumed by BOTH deck
// themes — never inline at call sites. The ratchet, DOM-free per the
// suite's idiom (static renders + source scans):
//  • the no-color-only-difference property is STRUCTURAL: the big joker's
//    corner star must exist and the small joker's must not, so a
//    monochrome/grayscale/color-blind rendering still separates the pair
//    (the visual halves — 12px, grayscale, fan sliver — are eyes-gated
//    with screenshots in the round records);
//  • the owner-art data contract: verbatim parts, no id/defs/gradients
//    (nothing to collide when composed), no baked color;
//  • both themes delegate their joker branches to the ONE part;
//  • no text nodes (the deck contract's wordless rule — the wordmark is
//    paths).

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { JokerFace, JOKER_PALETTE, JOKER_STAR_PATH } from '../../../src/client/table/jokers';
import { JOKER_FIGURE, JOKER_LOGO, JOKER_WORDMARK } from '../../../src/client/table/joker-art-data';
import { LACQUER_THEME } from '../../../src/client/table/themes/lacquer';
import { CINNABAR_COURT_THEME } from '../../../src/client/table/themes/cinnabar-court';

const ROOT = join(__dirname, '../../../');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const big = () => renderToStaticMarkup(createElement(JokerFace, { big: true }));
const small = () => renderToStaticMarkup(createElement(JokerFace, { big: false }));

describe('owner-art data contract (joker-art-data.ts)', () => {
  it('carries the three parts at their supplied sizes', () => {
    expect(JOKER_FIGURE.viewBox).toBe('0 0 563 600');
    expect(JOKER_FIGURE.paths.length).toBe(145);
    expect(JOKER_WORDMARK.viewBox).toBe('0 0 600 266');
    expect(JOKER_WORDMARK.paths.length).toBe(5);
    expect(JOKER_LOGO.viewBox).toBe('0 0 148 284');
    expect(JOKER_LOGO.paths.length).toBe(1);
  });

  it('no id/defs/gradient/url() anywhere in the art or its composition (nothing to collide)', () => {
    for (const src of [read('src/client/table/joker-art-data.ts'), read('src/client/table/jokers.tsx')]) {
      expect(src).not.toMatch(/\bid=/);
      expect(src).not.toContain('<defs');
      expect(src).not.toContain('url(#');
      expect(src).not.toContain('Gradient');
    }
    // and the rendered output composes clean too (word-boundary match —
    // panel note, Grok: a bare ' id=' miss vector)
    for (const html of [big(), small()]) {
      expect(html).not.toMatch(/\bid=/);
      expect(html).not.toContain('url(#');
    }
  });

  it('the data module bakes in NO color — parts are colored by their consumer', () => {
    const src = read('src/client/table/joker-art-data.ts');
    expect(src).not.toMatch(/fill\s*[=:]/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toContain('var(--');
  });
});

describe('the no-color-only property (structural half)', () => {
  it('the big joker carries the corner star; the small joker does NOT', () => {
    expect(big().split(JOKER_STAR_PATH).length - 1).toBe(2); // both corners
    expect(small()).not.toContain(JOKER_STAR_PATH);
  });

  it('the big joker is full-color (palette patches); the small joker is monochrome currentColor', () => {
    const b = big();
    expect(b).toContain(JOKER_PALETTE.purple); // a patch only the palette provides
    expect(b).toContain(`fill="${JOKER_PALETTE.ink}"`); // linework over patches
    const s = small();
    expect(s).not.toContain(JOKER_PALETTE.purple);
    // every fill in the small joker is currentColor
    const fills = [...s.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills)).toEqual(new Set(['currentColor']));
  });

  it('single-color parts (wordmark, logos, star) ride currentColor in BOTH variants', () => {
    for (const html of [big(), small()]) {
      expect(html).toContain('fill="currentColor"');
    }
  });
});

describe('composition contract', () => {
  it('no text nodes on either variant (the wordless deck rule — the wordmark is paths)', () => {
    for (const html of [big(), small()]) {
      expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
      expect(html).not.toContain('<text');
    }
  });

  it('the face is one aria-hidden .gd-joker svg filling the card box', () => {
    for (const html of [big(), small()]) {
      expect(html).toContain('class="gd-joker"');
      expect(html).toContain('viewBox="0 0 200 290"');
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe('both themes consume the registry part (no second joker render path)', () => {
  const THEMES = [LACQUER_THEME, CINNABAR_COURT_THEME];
  for (const theme of THEMES) {
    it(`${theme.id}: BJ/SJ render the composed part, star only on BJ`, () => {
      for (const size of ['hand', 'trick', 'mini'] as const) {
        const bj = renderToStaticMarkup(createElement(theme.Face, { card: 'BJ', level: '2', size }));
        const sj = renderToStaticMarkup(createElement(theme.Face, { card: 'SJ', level: '2', size }));
        expect(bj, `${theme.id} BJ @ ${size}`).toContain('gd-joker');
        expect(sj, `${theme.id} SJ @ ${size}`).toContain('gd-joker');
        // BOTH corners, per theme (panel note, Grok: a presence-only pin
        // here let a one-corner star drop slip past the theme loop).
        expect(bj.split(JOKER_STAR_PATH).length - 1, `${theme.id} BJ @ ${size}: star corners`).toBe(2);
        expect(sj).not.toContain(JOKER_STAR_PATH);
        // the identity classes still carry the color pair
        expect(bj).toContain('gd-card--red');
        expect(sj).toContain('gd-card--black');
      }
    });
  }

  it('no theme keeps a private joker figure/emblem (the old code is gone)', () => {
    for (const rel of [
      'src/client/table/themes/lacquer.tsx',
      'src/client/table/themes/cinnabar-court/index.tsx',
      'src/client/table/themes/cinnabar-court/art.tsx',
    ]) {
      const src = read(rel);
      expect(src, `${rel}: old joker component survives`).not.toMatch(
        /JokerMark|JokerEmblem|JokerFigure/,
      );
    }
  });
});
