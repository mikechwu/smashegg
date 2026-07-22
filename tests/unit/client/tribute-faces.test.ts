// Tribute-panel card sizing (post-M5 human-feedback item 2): the cards the
// panel reveals — paid/returned pairings, the anti-tribute jokers, own staged
// card — must render at the SAME size as hand cards (the owner's consistency
// rule; the chooser round set the precedent and chooser-faces.test.ts pins
// the hand-clamp arithmetic itself). Found visually in the first real-human
// playtest: panel cards rendered at the smaller dormant 'trick' size.
//
// DOM-free suite: these are source-text and stylesheet-text pins (the render
// is owned by the visual round; the ratchet here makes the FIND a regression
// so the fix can't silently revert).

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
  export function readdirSync(path: URL): string[];
}

const tributeSrc = readFileSync(
  new URL('../../../src/client/table/TributePanel.tsx', import.meta.url),
  'utf8',
);
const tableCss = readFileSync(new URL('../../../src/client/table/table.css', import.meta.url), 'utf8');

describe('tribute panel renders hand-size faces (owner consistency rule)', () => {
  it('every CardFace in TributePanel is size="hand"; the trick size is gone', () => {
    expect(tributeSrc).not.toContain('size="trick"');
    const handFaces = tributeSrc.match(/size="hand"/g) ?? [];
    // Pairings + anti reveal + own staged — all three reveal sites.
    expect(handFaces.length).toBeGreaterThanOrEqual(3);
  });

  it('no table component ships trick- or mini-size faces anymore (both tokens dormant)', () => {
    // The game UI's consistency rule is global: every visible card face is
    // hand-size. A new component reintroducing a smaller face must come back
    // through this pin deliberately. Enumerated from the directory (not a
    // hand list) so a NEW component is swept automatically — Codex audit LOW.
    const dir = new URL('../../../src/client/table/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const name of files) {
      const src = readFileSync(new URL(name, dir), 'utf8');
      expect(src, `${name}: no trick faces`).not.toContain('size="trick"');
      expect(src, `${name}: no mini faces`).not.toContain('size="mini"');
    }
  });

  it('pairing and own-staged rows wrap, so a hand-size card can never overflow 390px', () => {
    // The hand clamp reaches ~50.7px at 390 (13vw) vs the old trick 36px;
    // the rows hold user-content names (unbounded width), so wrap is the
    // structural guarantee — not arithmetic over text we cannot measure.
    const pairing = tableCss.match(/\.gd-tribute__pairing\s*\{([^}]*)\}/)?.[1];
    expect(pairing, '.gd-tribute__pairing block').toBeDefined();
    expect(pairing).toContain('flex-wrap: wrap');
    const own = tableCss.match(/\.gd-tribute__own\s*\{([^}]*)\}/)?.[1];
    expect(own, '.gd-tribute__own block').toBeDefined();
    expect(own).toContain('flex-wrap: wrap');
    const panel = tableCss.match(/\.gd-tribute\s*\{([^}]*)\}/)?.[1];
    expect(panel, '.gd-tribute block').toBeDefined();
    expect(panel).toContain('max-width: 100%');
  });
});
