// The joker registry. The card FRAME (JOKER wordmark + dollar-J corner logos +
// the big joker's star, joker-art-data.ts, verbatim) is owner-kept; the BODY
// illustration is a SWAPPABLE pool entry (art-pool/joker-figures). The owner
// swapped the jester for the bombs; the jester stays archived. The ratchet,
// DOM-free per the suite's idiom (static renders + source scans):
//  • the no-color-only cue is STRUCTURAL: the big joker's star must exist and
//    the small joker's must not (a monochrome/grayscale/color-blind rendering
//    still separates the pair); the bombs add their own cue (filled vs outline
//    diamond) but the star is the guarantee;
//  • the frame art contract: verbatim wordmark/logo, no id/defs/gradients, no
//    baked color (colored by their consumer);
//  • the figure POOL: the active figure is the bombs, the jester is archived
//    and reusable, and the swap is one line;
//  • both themes delegate their joker branches to the ONE composed face;
//  • no text nodes (the wordmark is paths).

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { JokerFace, JOKER_STAR_PATH } from '../../../src/client/table/jokers';
import { JOKER_FIGURE, JOKER_LOGO, JOKER_WORDMARK } from '../../../src/client/table/joker-art-data';
import {
  ACTIVE_JOKER_FIGURE,
  fitTransform,
  JOKER_FIGURES,
} from '../../../src/client/table/art-pool/joker-figures';
import { BOMB_BLACK, BOMB_RED } from '../../../src/client/table/art-pool/joker-figures/bomb-art-data';
import { LACQUER_THEME } from '../../../src/client/table/themes/lacquer';
import { CINNABAR_COURT_THEME } from '../../../src/client/table/themes/cinnabar-court';

const ROOT = join(__dirname, '../../../');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const big = () => renderToStaticMarkup(createElement(JokerFace, { big: true }));
const small = () => renderToStaticMarkup(createElement(JokerFace, { big: false }));

// The red bomb's signature red (the big joker); the black bomb never uses it.
const BOMB_RED_HEX = '#D5161C';

describe('the kept FRAME art (joker-art-data.ts — wordmark + logo, verbatim)', () => {
  it('carries the wordmark and logo at their supplied sizes', () => {
    expect(JOKER_WORDMARK.viewBox).toBe('0 0 600 266');
    expect(JOKER_WORDMARK.paths.length).toBe(5);
    expect(JOKER_LOGO.viewBox).toBe('0 0 148 284');
    expect(JOKER_LOGO.paths.length).toBe(1);
  });

  it('the archived jester figure is still present (145 paths) and reachable via the pool', () => {
    expect(JOKER_FIGURE.viewBox).toBe('0 0 563 600');
    expect(JOKER_FIGURE.paths.length).toBe(145);
    expect(JOKER_FIGURES.jester).toBeDefined();
    expect(JOKER_FIGURES.jester!.name).toBe('jester');
  });

  it('the frame data module bakes in NO color — parts are colored by their consumer', () => {
    const src = read('src/client/table/joker-art-data.ts');
    expect(src).not.toMatch(/fill\s*[=:]/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toContain('var(--');
  });
});

describe('the swappable figure pool (art-pool/joker-figures)', () => {
  it('the ACTIVE figure is the bombs; the jester is archived and still available', () => {
    expect(ACTIVE_JOKER_FIGURE.name).toBe('bomb');
    expect(Object.keys(JOKER_FIGURES).sort()).toEqual(['bomb', 'jester']);
  });

  it('the bombs are two self-colored variants with NO full-canvas background rect', () => {
    expect(BOMB_RED.length).toBe(28);
    expect(BOMB_BLACK.length).toBe(28);
    for (const bomb of [BOMB_RED, BOMB_BLACK]) {
      for (const p of bomb) {
        expect(p.fill.length).toBeGreaterThan(0); // self-colored, every path
        expect(p.d.replace(/\s/g, '')).not.toBe('M0 0h1254v1254H0z'); // bg dropped
      }
    }
    // the red bomb carries its signature red; the black bomb never does
    expect(BOMB_RED.some((p) => p.fill.toUpperCase() === BOMB_RED_HEX)).toBe(true);
    expect(BOMB_BLACK.some((p) => p.fill.toUpperCase() === BOMB_RED_HEX)).toBe(false);
  });

  it('fitTransform fit-contains centered AND respects the viewBox origin (any figure lands on-card)', () => {
    // zero-origin (the current figures): plain fit-contain
    expect(fitTransform('0 0 100 100', { x: 0, y: 0, w: 100, h: 100 })).toBe('translate(0 0) scale(1)');
    expect(fitTransform('0 0 200 100', { x: 0, y: 0, w: 100, h: 100 })).toBe('translate(0 25) scale(0.5)');
    // non-zero origin (a future figure whose art starts off 0,0) is shifted in,
    // not off the box (panel-audit INFO, Codex)
    expect(fitTransform('-50 -50 100 100', { x: 0, y: 0, w: 100, h: 100 })).toBe('translate(50 50) scale(1)');
  });

  it('no id/defs/gradient/url() in the frame art, the pool, or the rendered face', () => {
    for (const rel of [
      'src/client/table/joker-art-data.ts',
      'src/client/table/jokers.tsx',
      'src/client/table/art-pool/joker-figures/types.ts',
      'src/client/table/art-pool/joker-figures/bomb.tsx',
      'src/client/table/art-pool/joker-figures/bomb-art-data.ts',
      'src/client/table/art-pool/joker-figures/jester.tsx',
      'src/client/table/art-pool/joker-figures/index.ts',
    ]) {
      const src = read(rel);
      expect(src, `${rel}: id=`).not.toMatch(/\bid=/);
      expect(src, `${rel}: <defs`).not.toContain('<defs');
      expect(src, `${rel}: url(#`).not.toContain('url(#');
      expect(src, `${rel}: Gradient`).not.toContain('Gradient');
    }
    for (const html of [big(), small()]) {
      expect(html).not.toMatch(/\bid=/);
      expect(html).not.toContain('url(#');
    }
  });
});

describe('the no-color-only property (structural)', () => {
  it('the big joker carries the corner star; the small joker does NOT', () => {
    expect(big().split(JOKER_STAR_PATH).length - 1).toBe(2); // both corners
    expect(small()).not.toContain(JOKER_STAR_PATH);
  });

  it('the frame rides currentColor in both; the big figure is colored, the small figure is not red', () => {
    for (const html of [big(), small()]) {
      expect(html).toContain('fill="currentColor"'); // wordmark + logos + star
    }
    // The bombs are self-colored: the big (red bomb) shows its red; the small
    // (black bomb) shows none of it — big vs small carries a colour+shape cue
    // in the figure ON TOP of the structural star.
    expect(big()).toContain(BOMB_RED_HEX);
    expect(small()).not.toContain(BOMB_RED_HEX);
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

describe('both themes consume the registry face (no second joker render path)', () => {
  const THEMES = [LACQUER_THEME, CINNABAR_COURT_THEME];
  for (const theme of THEMES) {
    it(`${theme.id}: BJ/SJ render the composed face, star only on BJ`, () => {
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
