// EVERY GATE DECLARES WHAT IT PINNED, AND JUSTIFIES ANY DEVIATION FROM THE PRODUCT.
//
// Three times a measurement has been found pinned at a value the product is not in,
// and all three were found BY ACCIDENT rather than by a check:
//   - inner height 844 (a phone SCREEN size no browser presents);
//   - deck theme held at lacquer while cinnabar-court measured 95.8% below fold;
//   - room timing held UNTIMED while the product default is the 45s/90s preset,
//     which adds 8.0px of desk and moved a failure rate from 1-in-40 to 1-in-8.
//
// The rule is NOT "no gate may deviate" — deviating is frequently the point, since
// a gate that only measured the default would never measure the worst case. The rule
// is that a deviation must be DELIBERATE and SAID. What went wrong all three times
// was never the value; it was that nobody knew a choice had been made.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// The registry is PARSED from source, not imported: `scripts/` is plain .mjs with
// no declaration file, and the client tsconfig would have to widen to admit it.
// Parsing also keeps this test from executing anything.
const REGISTRY = readFileSync(new URL('../../../scripts/axes.mjs', import.meta.url), 'utf8');

function registeredAxes(): Map<string, { productDefault: string; note: string }> {
  const body = REGISTRY.match(/export const AXES = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  const out = new Map<string, { productDefault: string; note: string }>();
  for (const m of body.matchAll(/^  (\w+): \{([\s\S]*?)^  \},$/gm)) {
    const inner = m[2]!;
    out.set(m[1]!, {
      productDefault: inner.match(/productDefault:\s*'((?:[^'\\]|\\.)*)'/)?.[1] ?? '',
      note: inner.match(/note:\s*'((?:[^'\\]|\\.)*)'/)?.[1] ?? '',
    });
  }
  return out;
}
const AXES = registeredAxes();
const AXIS_NAMES = [...AXES.keys()];

const GATES = [
  'measure-fold.mjs',
  'measure-simultaneity.mjs',
  'measure-fan-tap-targets.mjs',
  'measure-setaside.mjs',
  'check-containment.mjs',
  'derive-span.mjs',
  'derive-fan-bound.mjs',
  'fan-geometry-sweep.mjs',
  'validate-fan-model.mjs',
];

const read = (name: string): string =>
  readFileSync(new URL(`../../../scripts/${name}`, import.meta.url), 'utf8');

/** The `AXES_PINNED` literal's per-axis entries, parsed from source text.
 *  Deliberately a parse of the DECLARATION rather than an import: importing would
 *  execute the module, and every gate's top level launches a browser. */
function pinnedAxes(src: string): Map<string, { value: string; justification: string | null }> {
  const block = src.match(/export const AXES_PINNED = \{([\s\S]*?)\n\};/);
  const out = new Map<string, { value: string; justification: string | null }>();
  if (block === null) return out;
  const body = block[1]!;
  for (const m of body.matchAll(/^\s*(\w+):\s*\{([^}]*)\},?\s*$/gm)) {
    const inner = m[2]!;
    const value = inner.match(/value:\s*'((?:[^'\\]|\\.)*)'/)?.[1] ?? '';
    const justification = inner.match(/justification:\s*'((?:[^'\\]|\\.)*)'/)?.[1] ?? null;
    out.set(m[1]!, { value, justification });
  }
  return out;
}

describe('the axis registry is real', () => {
  it('registers the axes the project has actually been burned by', () => {
    for (const required of ['viewportHeight', 'deckTheme', 'roomTiming', 'locale']) {
      expect(AXIS_NAMES, `${required} must be a registered axis`).toContain(required);
    }
    expect(AXIS_NAMES.length, 'the registry is substantive').toBeGreaterThanOrEqual(10);
  });

  it('every axis states a product default and a why-it-matters note', () => {
    for (const name of AXIS_NAMES) {
      const axis = AXES.get(name)!;
      expect(axis.productDefault, `${name} declares a product default`).toBeTruthy();
      expect(axis.note.length, `${name} says why it can change an answer`).toBeGreaterThan(40);
    }
  });
});

describe('every gate declares its pinned value for every registered axis', () => {
  it('finds the gates it is going to check (not vacuous)', () => {
    for (const g of GATES) expect(read(g).length, `${g} is readable`).toBeGreaterThan(500);
  });

  it('no gate leaves a registered axis undeclared', () => {
    for (const g of GATES) {
      const pinned = pinnedAxes(read(g));
      expect(pinned.size, `scripts/${g} has an AXES_PINNED declaration`).toBeGreaterThan(0);
      const missing = AXIS_NAMES.filter((a) => !pinned.has(a));
      expect(
        missing,
        `scripts/${g} does not declare: ${missing.join(', ')}. An axis nobody declared is ` +
          `an axis nobody chose — which is how 844, lacquer-only and untimed each survived ` +
          `for weeks. Add it to AXES_PINNED, with a justification if it is not the product default.`,
      ).toEqual([]);
    }
  });

  it('any axis pinned away from the product default carries a justification', () => {
    // Matching is deliberately loose: the declaration is prose describing a knob,
    // and demanding an exact token would make the check about spelling. What is
    // enforced is that a value which does NOT mention the product default must say
    // WHY — the justification is the deliverable, not the string equality.
    for (const g of GATES) {
      for (const [axis, decl] of pinnedAxes(read(g))) {
        const def = AXES.get(axis)?.productDefault;
        if (def === undefined || def === 'range' || def === 'both') continue;
        const mentionsDefault = decl.value.toLowerCase().includes(def.toLowerCase());
        if (mentionsDefault) continue;
        expect(
          decl.justification,
          `scripts/${g} pins "${axis}" at "${decl.value}", which is not the product default ` +
            `("${def}"), and gives no justification. Deviating is often correct — measuring only ` +
            `the default would never reach the worst case — but it has to be a stated choice.`,
        ).not.toBeNull();
        expect(
          (decl.justification ?? '').length,
          `scripts/${g}'s justification for "${axis}" must say something`,
        ).toBeGreaterThan(20);
      }
    }
  });
});
