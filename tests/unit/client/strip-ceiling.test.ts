// A DECK THEME REQUESTS A COVERED-CARD REVEAL; THE FRAMEWORK OWNS THE CEILING.
//
// `stackStripW` is declared per theme as the height its covered-card identity mark needs.
// It is also the single largest multiplier on the hand fan's HEIGHT, because a stacked
// column of n cards stands `aspect + reveal*(n - 1)` card widths tall — so the strip spends
// the same vertical budget the trick well, the desk and the action row spend. The type has
// always permitted [0.3, 1.0], which presents a layout-unsafe value as conforming.
//
// One shipped. `cinnabar-court` requested 0.841 against lacquer's 0.42, and at inner
// 390x664 that took roughly half of deals to a state where no single scroll position shows
// the must-see set. It was in that state from the day it shipped until round M2, and the
// reason it survived is that nothing checked: the strip was art freedom, and the budget it
// spends was nobody's to defend.
//
// This is that check. It is deliberately a property of the REGISTRY rather than a list of
// theme ids: a list is a thing someone must remember to update, which is exactly what failed
// here. Registering a theme whose strip exceeds the ceiling turns this red at the moment the
// theme is added.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  collapsedExactCeilingFor,
  deckThemes,
  stripCeilingFor,
  themesNeedingCappedRates,
  themesOverStripCeiling,
} from '../../../src/client/table/theme';
import '../../../src/client/table/themes/lacquer';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, 'utf8');

/** The shipped card and depth floor, read from their sources rather than restated. */
function shipped(): { cardW: number; depthFloor: number } {
  const cardW = Number(read('src/client/app.css').match(/--gd-handcardw:\s*([\d.]+)px;/)?.[1] ?? NaN);
  const depthFloor = Number(
    JSON.parse(read('status/model.json')).constants.find((c: { id: string }) => c.id === 'depthFloor').value,
  );
  return { cardW, depthFloor };
}

describe('the covered-card reveal is a framework budget, not art freedom', () => {
  const { cardW, depthFloor } = shipped();

  it('reads the shipped card and depth floor from their sources', () => {
    expect(cardW, 'the phone card constant parses out of app.css').toBeGreaterThan(30);
    expect(depthFloor, 'the depth floor parses out of model.json').toBeGreaterThanOrEqual(8);
  });

  it('the ceiling is derived and matches the model', () => {
    // status/MODEL.md records stripCeiling(46.51, 10) = 0.447. Recomputed here from the
    // formula rather than compared against a stored number, so the two cannot drift.
    expect(stripCeilingFor(cardW, depthFloor)).toBeCloseTo(0.447, 3);
    // It must MOVE with its inputs, or it is a constant wearing a function's clothes.
    expect(stripCeilingFor(cardW, depthFloor + 1)).toBeLessThan(stripCeilingFor(cardW, depthFloor));
    expect(stripCeilingFor(cardW * 1.2, depthFloor)).toBeLessThan(stripCeilingFor(cardW, depthFloor));
  });

  it('no registered theme requests more reveal than the framework allows', () => {
    const over = themesOverStripCeiling(cardW, depthFloor);
    expect(
      over,
      `these registered themes request a covered-card reveal the layout cannot pay for:\n` +
        over.map((t) => `  ${t.id}: requests ${t.requested}, ceiling ${t.ceiling.toFixed(3)}`).join('\n') +
        `\nA strip above the ceiling means hands of depth ${depthFloor} no longer fit at the ` +
        `shipped ${cardW}px card. Design the covered mark for the ceiling; do not raise it ` +
        'silently, and do not clamp the theme to a strip its designer did not choose.',
    ).toEqual([]);
  });

  it('the check is capable of failing (the withdrawn theme is the fixture)', () => {
    // NON-VACUITY, using the real case rather than an invented one. cinnabar-court is no
    // longer registered, so it cannot make the assertion above fail — but its metric is
    // still in tree, and the ceiling must still reject it. A ceiling that accepted 0.841
    // would be green and worthless.
    const cinnabar = Number(
      read('src/client/table/themes/cinnabar-court/index.tsx').match(/stackStripW:\s*([\d.]+)/)?.[1] ?? NaN,
    );
    expect(cinnabar, "the withdrawn theme's strip is still readable in tree").toBeCloseTo(0.841, 3);
    expect(
      cinnabar,
      'the ceiling must reject the value that caused this whole finding',
    ).toBeGreaterThan(stripCeilingFor(cardW, depthFloor));
  });

  // N1: THERE ARE TWO STRIP THRESHOLDS AND THE GATE ONLY ENFORCES ONE.
  //
  //   stripCeilingFor(46.51, 10)   = 0.447   — do depth-10 hands still fit?  (gated)
  //   collapsedExactCeilingFor(8)  = 0.4214  — is the simple height formula still exact?
  //
  // The second is LOWER, so a theme can pass the gate and still break its own rates: at
  // 0.43 the depth-8 columns reach the reveal budget and every rate computed from the
  // collapsed form is wrong, with the gate green throughout. Exceeding it is legal — it only
  // says which formula that theme's rates need — so it is detected, never refused.
  it('the two strip thresholds are distinct, and the looser-looking one is lower', () => {
    const gate = stripCeilingFor(cardW, depthFloor);
    const exact = collapsedExactCeilingFor(8);
    expect(exact).toBeCloseTo(2.95 / 7, 6);
    expect(exact, 'the collapsed-exact line sits BELOW the feasibility gate').toBeLessThan(gate);
    // The gap is the hole: a strip in it passes the gate and needs the capped form anyway.
    const inTheGap = (gate + exact) / 2;
    expect(inTheGap).toBeLessThan(gate);
    expect(inTheGap).toBeGreaterThan(exact);
  });

  it('lacquer is exact, and says how little margin that rests on', () => {
    const lacquer = deckThemes().find((t) => t.id === 'lacquer');
    expect(lacquer, 'lacquer is registered').toBeTruthy();
    const exact = collapsedExactCeilingFor(8);
    expect(
      lacquer!.metrics.stackStripW,
      'lacquer must stay below the collapsed-exact line — every lacquer figure in this ' +
        'project depends on it, and the whole margin is 0.00143',
    ).toBeLessThan(exact);
    expect(exact - lacquer!.metrics.stackStripW).toBeLessThan(0.002);
  });

  it('no registered theme silently needs the capped rate form', () => {
    // Not a defect if it fires — a routing fact. But it must never be a SURPRISE, which is
    // what it was for cinnabar-court for the whole time that theme shipped.
    const needsCapped = themesNeedingCappedRates(8);
    expect(
      needsCapped,
      `these registered themes exceed the collapsed-exact line, so their RATES must be ` +
        `computed with the capped height form:\n` +
        needsCapped.map((t) => `  ${t.id}: ${t.requested} > ${t.ceiling.toFixed(4)}`).join('\n') +
        `\nThat is legal. It is not legal to then quote a rate computed the cheap way.`,
    ).toEqual([]);
  });

  it('every theme the picker offers is registered, and the withdrawn one is not', () => {
    const ids = deckThemes().map((t) => t.id);
    expect(ids, 'lacquer is registered').toContain('lacquer');
    // The registration is a side effect of an import in CardFace.tsx; the withdrawal is that
    // import being commented out. Assert the SOURCE, because this test file imports lacquer
    // directly and cannot observe CardFace's import list any other way.
    const cardFace = read('src/client/table/CardFace.tsx');
    expect(
      /^import '\.\/themes\/cinnabar-court';/m.test(cardFace),
      'cinnabar-court must stay unregistered until its covered mark is designed for the ceiling',
    ).toBe(false);
    expect(cardFace, 'the withdrawal is explained where it happens').toContain('withdrawn from the picker');
  });
});
