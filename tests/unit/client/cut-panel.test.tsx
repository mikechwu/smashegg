// Obs 1 regression: CutPanel shows the deck as a SPREAD that splits into two
// packets, and NEVER a numeric cut index. The leak investigation (both
// lineages, headless) proved the index leaks nothing and is meaningless, so
// its absence is now pinned — a future edit re-adding a number fails here. The
// legal cut range (CUT_MIN..CUT_MAX) is also pinned unchanged, so the slider
// restyle can't drift legalActions/defaultAction.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CutPanel } from '../../../src/client/table/CutPanel';
import { CUT_RIBBON_SLIVERS } from '../../../src/client/table/cut';
import { CUT_MIN, CUT_MAX } from '../../../src/engine/guandan';
import type { Card } from '../../../src/engine/guandan/cards';

const nameFor = (s: number) => `Seat${s}`;

function render(isCutter: boolean, flips: readonly Card[] = []): string {
  return renderToStaticMarkup(
    createElement(CutPanel, { cutter: 2, isCutter, flips, level: '2', nameFor, onCut: () => {} }),
  );
}

describe('CutPanel (obs 1)', () => {
  it('draws the spread ribbon with exactly CUT_RIBBON_SLIVERS slivers', () => {
    const html = render(true);
    expect(html).toContain('gd-cut__ribbon');
    expect(html.match(/gd-cut__sliver/g) ?? []).toHaveLength(CUT_RIBBON_SLIVERS);
    // Both packets are present at the default (middle) cut.
    expect(html).toContain("data-side=\"left\"");
    expect(html).toContain("data-side=\"right\"");
  });

  it('shows NO numeric cut index (the removed gd-cut__pos element)', () => {
    const html = render(true);
    expect(html).not.toContain('gd-cut__pos');
    // No visible "position N" text: strip tags and assert no standalone
    // 1-3 digit token survives in the cutter's prompt copy.
    const text = html.replace(/<[^>]*>/g, ' ');
    expect(text).not.toMatch(/\b\d{1,3}\b/);
  });

  it('keeps the legal cut range on the slider (legalActions unchanged)', () => {
    const html = render(true);
    expect(html).toContain(`min="${CUT_MIN}"`);
    expect(html).toContain(`max="${CUT_MAX}"`);
  });

  it('spectators see the same spread with no slider or number', () => {
    const html = render(false);
    expect(html).toContain('gd-cut__ribbon');
    expect(html).not.toContain('gd-cut__slider');
    expect(html).not.toContain('gd-cut__pos');
  });

  it('re-cut: the uncountable flip shows IN the panel, for cutter and spectator alike', () => {
    // The owner rule: the flip appears in the SAME panel and the cutter cuts
    // again — the slider stays, the flip row shows the history, and the
    // prompt switches to the flipped copy. Spectators see the same flip.
    const cutterHtml = render(true, ['SJ']);
    expect(cutterHtml).toContain('gd-cut__flips');
    expect(cutterHtml).toContain('gd-cut__slider'); // the re-cut is live
    const spectatorHtml = render(false, ['SJ']);
    expect(spectatorHtml).toContain('gd-cut__flips');
    expect(spectatorHtml).not.toContain('gd-cut__slider');
  });
});

// ---------------------------------------------------------------------------
// Flank round, owner item 5: the ceremony/cut/deal cards are the SAME cards
// the table plays — hand size, same framework style — never a private mini or
// trick size. Source pins on all three components plus the ribbon's
// --sliver-w lockstep with .gd-card--hand's clamp.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ceremony/cut/deal cards match the playing cards (owner item 5)', () => {
  const src = (name: string) =>
    readFileSync(join(__dirname, `../../../src/client/table/${name}`), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

  it('CutPanel, CeremonyOverlay and DealOverlay render ONLY hand-size cards', () => {
    for (const name of ['CutPanel.tsx', 'CeremonyOverlay.tsx', 'DealOverlay.tsx']) {
      const text = src(name);
      expect(text, `${name}: no mini cards`).not.toContain('size="mini"');
      expect(text, `${name}: no trick cards`).not.toContain('size="trick"');
      expect(text, `${name}: hand cards present`).toContain('size="hand"');
    }
  });

  it("the cut ribbon's --sliver-w is IDENTICAL to .gd-card--hand's clamp (lockstep pin)", () => {
    const css = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const clampOf = (re: RegExp, what: string): string => {
      const block = css.match(re)?.[0] ?? '';
      expect(block, `rule not found: ${what}`).not.toBe('');
      const m = block.match(/(?:--gd-cardw|--sliver-w):\s*(clamp\([^)]+\))/);
      expect(m, `clamp not found: ${what}`).not.toBeNull();
      return m![1]!.replace(/\s+/g, ' ').trim();
    };
    const handClamp = clampOf(/\.gd-card--hand\s*\{[^}]*\}/, '.gd-card--hand');
    const ribbonClamp = clampOf(/\.gd-cut__ribbon\s*\{[^}]*\}/, '.gd-cut__ribbon');
    expect(ribbonClamp).toBe(handClamp);
  });

  it('the rendered ribbon slivers are real hand-size framework backs', () => {
    const html = render(true);
    expect(html.match(/class="gd-cardframe gd-card--hand"/g) ?? []).toHaveLength(
      CUT_RIBBON_SLIVERS,
    );
  });
});
