// Variant D — hit/paint decoupling (silent-no-op round item 1, owner F1-F3;
// docs/research/fan-tap-targets.md). The invariant: NO transform ever
// rides the fan card BUTTON — every lift/nudge lives on the FACE
// (.gd-card) with pointer-events:none, so the button hit boxes stay at
// base layout in every selection state (measured zero-victim across the
// full 27x27 sweep; the old button-level lift halved the strip above it,
// 700 -> 350px^2).
//
// These pins catch the two silent-revert vectors the owner named (guard
// 2): re-attaching a transform to the button, and dropping
// pointer-events:none from the face. They are necessary but NOT the whole
// gate — scripts/measure-fan-tap-targets.mjs is the REQUIRED end-to-end
// check for any fan/selection change (this suite is DOM-free and cannot
// hit-test).

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
  join(__dirname, '../../../src/client/table/table.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('variant D — the paint/hit decoupling invariant', () => {
  it('the fan card FACE is pointer-transparent and owns the transition', () => {
    const rule = css.match(/\.gd-fan__card \.gd-card \{[^}]*\}/)?.[0] ?? '';
    expect(rule, 'face rule not found').not.toBe('');
    expect(rule).toContain('pointer-events: none');
    expect(rule).toContain('transition: transform');
  });

  it('NO fan-card BUTTON rule carries a transform — lifts live on the face only', () => {
    // Every rule where ANY comma-separated selector targets a fan BUTTON
    // (mentions .gd-fan__card without descending into .gd-card) must be
    // transform-free — the silent-revert vector. Panel LOW, Codex: the
    // scan splits selector LISTS, so a fan selector hiding first in a
    // comma list (".gd-fan__card--selected, .other { transform }") is
    // still attributed to the fan.
    let fanButtonRules = 0;
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const targetsFanButton = selectors
        .split(',')
        .some((sel) => sel.includes('.gd-fan__card') && !sel.includes('.gd-card'));
      if (!targetsFanButton) continue;
      fanButtonRules += 1;
      expect(body, `transform on a fan BUTTON rule (${selectors.trim()})`).not.toContain(
        'transform',
      );
    }
    expect(fanButtonRules).toBeGreaterThan(0);
    // And the face rules DO carry the lifts (hover nudge + selected lift).
    expect(css).toMatch(/\.gd-fan__card:hover \.gd-card \{\s*transform: translateY\(-4px\);/);
    expect(css).toMatch(
      /\.gd-fan__card--selected \.gd-card,\s*\.gd-fan__card--selected:hover \.gd-card \{\s*transform: translateY\(-14px\);/,
    );
  });

  it('the pointer-events rule is scoped to the FAN — desk staged faces stay tappable', () => {
    // The desk's tap-to-unstage buttons carry CardFaces too; a global
    // .gd-card pointer-events rule would be harmless for them (clicks
    // bubble to the button) but the scoping keeps intent explicit.
    expect(css).not.toMatch(/^\s*\.gd-card \{[^}]*pointer-events/m);
  });

  it('the enforced end-to-end check exists where the docs point', () => {
    expect(existsSync(join(__dirname, '../../../scripts/measure-fan-tap-targets.mjs'))).toBe(true);
    const script = readFileSync(
      join(__dirname, '../../../scripts/measure-fan-tap-targets.mjs'),
      'utf8',
    );
    expect(script).toContain('elementFromPoint');
    expect(script).toContain('ZERO VICTIMS');
  });

  it('reduced motion collapses the FACE transforms in place (panel LOW, Grok: this suite is the D gate)', () => {
    // Deleting the reduced-motion block outright would leave faces
    // lifting under prefers-reduced-motion while the button scan above
    // stays green — pin the face-scoped override HERE, not only in the
    // play-desk suite.
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(
      /\.gd-fan__card--selected \.gd-card,\s*\.gd-fan__card--selected:hover \.gd-card,\s*\.gd-fan__card:hover \.gd-card \{\s*transform: none;/,
    );
  });

  it('the desk-as-unselect dependency is recorded next to the code (guard 3)', () => {
    const raw = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8');
    expect(raw).toContain('EXPLICIT DEPENDENCY');
    expect(raw).toContain('tap-to-unstage');
  });
});
