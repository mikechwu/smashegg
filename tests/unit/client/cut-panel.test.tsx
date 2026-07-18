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

// ---------------------------------------------------------------------------
// Cut-by-hand round (owner): the ribbon IS the control — the visible slider
// bar is gone; an invisible native range input lies over the cards, so
// dragging the deck drags the slider while keyboard/AT semantics survive.
// ---------------------------------------------------------------------------

describe('cut by dragging the cards (ribbon-overlay slider)', () => {
  it("the cutter's range input lives INSIDE the live ribbon; spectators get the bare ribbon", () => {
    const cutterHtml = render(true);
    const ribbon = cutterHtml.match(/<div class="gd-cut__ribbon[^"]*"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(ribbon).toContain('gd-cut__ribbon--live');
    expect(ribbon).toContain('gd-cut__slider');
    expect(ribbon).toContain('type="range"');
    // ONE slider, and only inside the ribbon (the old bar below is gone).
    expect(cutterHtml.match(/gd-cut__slider/g) ?? []).toHaveLength(1);
    const spectatorHtml = render(false);
    expect(spectatorHtml).not.toContain('gd-cut__ribbon--live');
    expect(spectatorHtml).not.toContain('gd-cut__slider');
    // The touch affordance (panel MED, Grok): the goldleaf handle rides the
    // split for the cutter only, positioned off the same --split var the
    // ribbon advertises; decorative.
    expect(cutterHtml).toContain('gd-cut__handle');
    expect(cutterHtml).toMatch(/--split:\s*\d+/);
    expect(spectatorHtml).not.toContain('gd-cut__handle');
    // The handle's geometry (panel round-2, Grok): the parted-midpoint
    // formula — (split − 0.5) pitches + half a sliver + half a gap —
    // CLAMPED to the two edge gaps' centres (splits 0 and 24 are
    // reachable), z-29 under the z-30 input, and inert to the hit test.
    const css2 = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const handle = css2.match(/\.gd-cut__handle\s*\{[^}]*\}/)?.[0] ?? '';
    expect(handle, 'handle rule not found').not.toBe('');
    expect(handle).toMatch(/\(var\(--split\) - 0\.5\) \/ \(var\(--slivers\) - 1\)/);
    expect(handle).toMatch(/var\(--sliver-w\) \/ 2 \+ var\(--gap\) \/ 2/);
    // The reachable edge splits (0 and 24) lie OUTSIDE the interior line —
    // the component marks them and the overrides pin the handle to the edge
    // gaps' own centres (panel round-2 geometry, corrected twice).
    expect(css2).toMatch(/\[data-split-edge='low'\] \.gd-cut__handle\s*\{\s*left:\s*calc\(var\(--gap\) \/ 2\);/);
    expect(css2).toMatch(/\[data-split-edge='high'\] \.gd-cut__handle\s*\{\s*left:\s*calc\(100% - var\(--gap\) \/ 2\);/);
    expect(handle).toMatch(/z-index:\s*29/);
    expect(handle).toMatch(/pointer-events:\s*none/);
  });

  it('the overlay CSS: invisible, full-ribbon hit area, no page-scroll steal, visible focus via the ribbon frame', () => {
    const css = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const slider = css.match(/\.gd-cut__slider\s*\{[^}]*\}/)?.[0] ?? '';
    expect(slider, 'slider rule not found').not.toBe('');
    expect(slider).toMatch(/position:\s*absolute/);
    expect(slider).toMatch(/inset:\s*0/);
    expect(slider).toMatch(/opacity:\s*0/);
    // Above every sliver (their z runs 0..23) or the cards swallow the drag
    // (390 live find: the first overlay sat UNDER the slivers and dragging
    // did nothing).
    expect(slider).toMatch(/z-index:\s*30/);
    const live = css.match(/\.gd-cut__ribbon--live\s*\{[^}]*\}/)?.[0] ?? '';
    expect(live).toMatch(/touch-action:\s*none/);
    // The input must always TAKE the hit: pointer-events none would kill
    // the whole interaction silently (panel LOW, Grok).
    expect(slider).toMatch(/pointer-events:\s*auto/);
    expect(slider).not.toMatch(/pointer-events:\s*none/);
    // Keyboard focus stays visible even though the input is not.
    expect(css).toMatch(/\.gd-cut__ribbon--live:has\(\.gd-cut__slider:focus-visible\)\s*\{[^}]*outline/);
  });
});
