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
import { readdirSync, readFileSync } from 'node:fs';
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

  // P0a: THE FLOOR BOUNDARY IS A CHOICE, AND THE CHOICE MUST MATCH THE CSS.
  //
  // The crossover is `rowChrome + 5.9*cardW`, a function of the card — and the card has
  // moved twice in five rounds. It was recorded as 332.1 (correct for the 48.15px card) and
  // stayed there after the card became 46.51, where it is 322.4. A figure derived from a
  // moving input and then stored will go stale; the fix is to derive it and pin the shipped
  // boundary against it, so "conservative by choice" stays a choice rather than becoming a
  // forgotten mistake.
  it('the shipped floor boundary matches the CSS, and is at least the derived crossover', () => {
    const model = JSON.parse(read('status/model.json'));
    const floor = model.constants.find((c: { id: string }) => c.id === 'floorBelowWidth');
    const rowChrome = model.constants.find((c: { id: string }) => c.id === 'rowChrome').value;
    const floorCardW = model.constants.find((c: { id: string }) => c.id === 'floorCardW').value;

    // 1. The recorded boundary is what the CSS actually says.
    const css = read('src/client/app.css');
    expect(
      css,
      `model.json records the narrow floor at ${floor.value}px; the CSS must agree`,
    ).toContain(`@media (max-width: ${floor.value}px)`);

    // 2. It is at or above the derived crossover for the SHIPPED card — below that, the
    //    constant would not clear 8 columns and the floor would be arriving too late.
    const crossover = rowChrome + 5.9 * cardW;
    expect(floor.value, 'the floor boundary must not sit below the crossover it protects').toBeGreaterThanOrEqual(
      Math.ceil(crossover) - 1,
    );
    expect(floor.derivedBoundary, 'the derived boundary is recorded beside the shipped one').toBe(
      Math.ceil(crossover) - 1,
    );

    // 3. And the floor card itself must clear 8 columns at the narrowest supported width,
    //    or the floor is decorative.
    const capacity = (W: number, w: number): number => Math.floor((W - rowChrome - 0.3 * w) / (0.7 * w));
    expect(capacity(320, floorCardW), 'the 44px floor clears 8 columns at 320').toBeGreaterThanOrEqual(8);
  });

  // P0b: NO GATE SCRIPT MAY DEFAULT TO A DECK THEME THE APP CANNOT RENDER.
  //
  // The failure this closes needs two things to line up: a script requests a theme id, and
  // that id is not registered. The app maps an unregistered id to the default, so the script
  // renders lacquer and labels it something else. Six scripts "verified" their theme by
  // reading back the value they had just written to localStorage, which confirms only that
  // storage works; five more wrote it and checked nothing.
  //
  // Rather than add a rendered check to eleven scripts, this removes the other half of the
  // conjunction: if no script can NAME an unregistered theme, the silent fallback cannot be
  // reached. Enumerated from the filesystem, per the lesson of N3a — a list of scripts is a
  // thing someone must remember to update.
  it('no script defaults to an unregistered deck theme', () => {
    const dir = fileURLToPath(new URL('../../../scripts/', import.meta.url));
    const registered = new Set(deckThemes().map((t) => t.id));
    expect(registered.size, 'at least one theme is registered').toBeGreaterThanOrEqual(1);
    const offenders: string[] = [];
    let defaultsSeen = 0;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
      const src = readFileSync(dir + f, 'utf8');
      // `process.env.X ?? 'a'` and `?? 'a,b'` — the shape a theme default takes here.
      for (const m of src.matchAll(/process\.env\.[A-Z_]*THEMES?[A-Z_]*\s*\?\?\s*'([^']+)'/g)) {
        defaultsSeen += 1;
        for (const id of m[1]!.split(',').map((x) => x.trim())) {
          if (!registered.has(id)) offenders.push(`${f}: defaults to '${id}'`);
        }
      }
    }
    expect(defaultsSeen, 'the scan found theme defaults to check (not vacuous)').toBeGreaterThanOrEqual(3);
    expect(
      offenders,
      `these scripts default to a deck theme that is not registered:\n  ${offenders.join('\n  ')}\n` +
        'An unregistered id falls back to the default deck, so the script would render one ' +
        'theme and label it another. Name a registered theme, or require the knob.',
    ).toEqual([]);
  });

  // P0c: A PINNED DIMENSION MUST SAY WHAT PINNING IT COSTS.
  //
  // The reference cell fixes nine dimensions, and a figure stated at that cell says nothing
  // about any other value of any of them. Eight had somewhere to land — a row with a
  // validity range, or an entry in the not-validated list. The ninth, `no shelf`, had
  // neither: the set-aside shelf is a shipped feature, containment measures both states,
  // and the SPAN model measures only one, which nothing recorded.
  //
  // The rule is the file's own stated purpose, applied to the cell rather than to the rows:
  // every pinned dimension is covered, and "covered" includes "declared unmeasured".
  const coverageOf = (): { axis: string; value: string; coverage: string }[] =>
    JSON.parse(read('status/model.json')).reference.dimensions;

  it('every dimension the reference cell pins is covered in VALIDATED', () => {
    const dims = coverageOf();
    const validated = read('status/VALIDATED.md');
    expect(dims.length, 'the reference cell pins dimensions (not vacuous)').toBeGreaterThanOrEqual(7);
    const uncovered = dims.filter((d) => !validated.includes(d.coverage));
    expect(
      uncovered,
      `these pinned dimensions have no row and no not-validated entry:\n` +
        uncovered.map((d) => `  ${d.axis} = ${d.value} (looked for "${d.coverage}")`).join('\n') +
        `\nA figure stated at the reference cell says nothing about any other value of them. ` +
        'Measure it, or say in VALIDATED.md that it is not measured.',
    ).toEqual([]);
  });

  it('that check would catch a newly pinned dimension with nothing behind it', () => {
    // MUTANT: a fictitious pin whose coverage phrase appears nowhere.
    const validated = read('status/VALIDATED.md');
    const fictitious = { axis: 'handedness', value: 'right', coverage: 'left-handed layout' };
    expect(
      validated.includes(fictitious.coverage),
      'the mutant phrase must be absent, or this proves nothing',
    ).toBe(false);
    const uncovered = [...coverageOf(), fictitious].filter((d) => !validated.includes(d.coverage));
    expect(uncovered.map((d) => d.axis), 'the check flags the unbacked pin').toEqual(['handedness']);
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
