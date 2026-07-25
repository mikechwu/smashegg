// Manual sort areas — the UI-level contracts.
//
// The model's invariants live in hand-areas.test.ts. These are the claims that
// are only true of the BUILT UI, and each one is a defect the pre-build
// critiques found in the proposal before a line was written:
//   - progressive disclosure must hold in the rendered fan, not just the model;
//   - the seam must not be reachable by variant D's documented near-miss;
//   - the straight-flush finder's control must never invert its own label.
//
// The client suite is DOM-free (`environment: 'node'`, see vitest.config.ts), so
// these are source-and-logic pins rather than render assertions. Where that
// makes a claim weaker than a behaviour test, it is stated on the test itself —
// the geometry claims are proven for real by scripts/measure-fan-tap-targets.mjs
// at true 390px, which is the required visual gate.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/engine/guandan/cards';
import {
  AREA_HARD_MAX,
  MAIN_AREA,
  commitIsResolved,
  setAsideDestination,
  NEW_SHELF,
  applyMove,
  bandOrder,
  moveWouldChange,
  seamAction,
  slotsOf,
  type HandAreas,
} from '../../../src/client/table/areas';

/** Build a HandAreas from just its area map — the recorded-grouping fields
 *  default to "nothing grouped", which is what every pre-grouping test means. */
function A(areaOf: number[], areaCount: number, groupOf?: number[], groupSize?: number[]): HandAreas {
  return {
    areaOf,
    areaCount,
    groupOf: groupOf ?? new Array<number>(areaOf.length).fill(0),
    groupSize: groupSize ?? [0],
  };
}

const read = (rel: string): string =>
  readFileSync(new URL(`../../../src/client/${rel}`, import.meta.url), 'utf8');

const CSS = read('table/table.css');
const FAN = read('table/HandFan.tsx');

// ---------------------------------------------------------------------------
// Progressive disclosure, at the level of what actually renders.
// ---------------------------------------------------------------------------

describe('PROGRESSIVE DISCLOSURE — a zero-area fan is today\'s fan', () => {
  it('every CSS rule this feature adds requires a class a zero-area fan never emits', () => {
    // The never-user contract expressed structurally: not `display: none` on a
    // hidden band (which would still occupy the layout arithmetic) but selectors
    // that cannot match at all. Scan the block's own rules.
    const start = CSS.indexOf('MANUAL SORT AREAS — bands and seams');
    expect(start, 'the area CSS block is findable').toBeGreaterThan(0);
    const end = CSS.indexOf('.gd-fan__stack {', start);
    const block = CSS.slice(start, end);
    const selectors = [...block.matchAll(/^(\.[^{]+)\{/gm)].map((m) => m[1]!.trim());
    expect(selectors.length, 'the block really has rules').toBeGreaterThan(2);
    // The allowed markers are the classes a zero-area fan CANNOT emit. Each is
    // rendered only inside the split branch, which requires a non-null partition
    // with a real shelf; the source pin below is what keeps that true.
    const splitOnly = ['.gd-fan--split', '.gd-fan__seam', '.gd-fan__run'];
    for (const selector of selectors) {
      expect(
        splitOnly.some((c) => selector.includes(c)),
        `"${selector}" could match a zero-area fan`,
      ).toBe(true);
    }
    // Runs and seams are emitted ONLY in the shelf branch — a zero-area fan
    // never reaches it, so those selectors have nothing to match.
    const shelfBranch = FAN.slice(FAN.indexOf('band === MAIN_AREA ?'));
    expect(shelfBranch, 'runs live in the non-MAIN branch').toContain('gd-fan__run');
    expect(
      FAN.slice(0, FAN.indexOf('const split =')),
      'nothing emits a run before the split gate is computed',
    ).not.toContain('gd-fan__run"');
  });

  it('the split branch is gated on a non-null partition with a real shelf', () => {
    // `split` is what adds the wrapper class and the bands. It must require
    // areas !== null AND areaCount > 1 AND not dealing — the dealing clause is
    // what keeps the deal overlay's slot-measurement path untouched.
    expect(FAN).toContain('const split = !dealing && areas !== null && areas.areaCount > 1;');
    // The class list is built additively, so a zero-area fan emits exactly
    // 'gd-fan' (or 'gd-fan gd-fan--dim'), byte-identical to before the feature.
    expect(FAN).toContain("if (split) fanClasses.push('gd-fan--split');");
  });

  it('a zero-area fan renders ONE stack row, the same one as before', () => {
    expect(FAN).toContain('<div className="gd-fan__stackRow">{columns.map(renderStack)}</div>');
  });
});

// ---------------------------------------------------------------------------
// The seam vs variant D's documented near-miss.
// ---------------------------------------------------------------------------

describe('SEAM — out of variant D\'s lift strip', () => {
  it('the seam row carries a safety margin ON TOP of the band lift headroom', () => {
    // A selected face paints 14px above its own hit box, so whatever sits above
    // a band can be hit by a tap aimed at the top of a lifted card. The band
    // keeps its 14px inert padding-top; the seam adds --space-xs (6px) more.
    // That is 20px to the HIT BOX and 6px above the lifted PAINT — the sweep
    // measures both and this pin only asserts the declarations exist, which is
    // why the real guarantee is the measurement, not this test.
    const seamRow = CSS.slice(CSS.indexOf('.gd-fan__seamRow {'));
    expect(seamRow.slice(0, seamRow.indexOf('}'))).toContain('margin-bottom: var(--space-xs)');
    // The band's own lift headroom must still be there — the margin is ADDITIVE
    // to it, not a replacement for it.
    const stackRow = CSS.slice(CSS.indexOf('.gd-fan__stackRow {'));
    expect(stackRow.slice(0, stackRow.indexOf('}'))).toContain('padding-top: 0.875rem');
  });

  it('the seam is a 44px target, not a hairline', () => {
    const seam = CSS.slice(CSS.indexOf('.gd-fan__seam {'));
    expect(seam.slice(0, seam.indexOf('}'))).toContain('min-height: 2.75rem');
  });

  it('MAIN is rendered LAST so the hand never moves away from the desk', () => {
    expect(bandOrder(null)).toEqual([MAIN_AREA]);
    expect(bandOrder(A([1, 0], 2))).toEqual([1, MAIN_AREA]);
    expect(bandOrder(A([1, 2, 0], 3))).toEqual([1, 2, MAIN_AREA]);
  });
});

// ---------------------------------------------------------------------------
// The seam's action is total, and never inverts.
// ---------------------------------------------------------------------------

describe('SEAM ACTION — total, and every branch changes something', () => {
  const areas = A([1, 1, MAIN_AREA, MAIN_AREA], 2);

  it('nothing selected -> select the shelf', () => {
    expect(seamAction(areas, new Set(), 1)).toBe('selectAll');
  });

  it('PART of the shelf selected -> select the rest, never a no-op move', () => {
    // The exact case the critique found: a strict subset is "entirely within"
    // the shelf, so it must not route to moveHere (which would move cards that
    // are already there — a silent no-op reachable in three presses).
    expect(seamAction(areas, new Set([0]), 1)).toBe('selectAll');
  });

  it('the WHOLE shelf selected -> put it back', () => {
    expect(seamAction(areas, new Set([0, 1]), 1)).toBe('putBack');
  });

  it('anything outside selected -> move it here', () => {
    expect(seamAction(areas, new Set([2]), 1)).toBe('moveHere');
    expect(seamAction(areas, new Set([0, 2]), 1)).toBe('moveHere');
  });

  it('every branch really changes state', () => {
    const hand = 4;
    // selectAll changes the selection (the shelf is not fully selected yet).
    expect(slotsOf(areas, 1)).toEqual([0, 1]);
    // moveHere changes the partition.
    expect(moveWouldChange(areas, hand, new Set([2]), 1, 3)).toBe(true);
    // putBack changes the partition (and empties the shelf away entirely).
    expect(applyMove(areas, hand, new Set([0, 1]), MAIN_AREA, 3)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The straight-flush finder's control cannot invert its own label.
// ---------------------------------------------------------------------------

describe('SF FINDER — "set aside" can never un-set-aside', () => {
  const GAME_TABLE = readFileSync(
    new URL('../../../src/client/GameTable.tsx', import.meta.url),
    'utf8',
  );

  it('the finder moves only toward a NEW shelf — there is no MAIN fallback', () => {
    // The defect: a `?? MAIN_AREA` fallback made a button reading "set aside"
    // DELETE the band when the same group was picked twice. The destination is
    // now a literal NEW_SHELF with no fallback expression at all.
    const from = GAME_TABLE.indexOf('const sendSfGroupToArea');
    expect(from, 'the finder staging path is findable').toBeGreaterThan(0);
    // Bound the slice to the FUNCTION BODY, not a character count: a fixed
    // window silently grows into unrelated code as the file changes, which
    // would make this pin fail (or worse, pass) for the wrong reason.
    const body = GAME_TABLE.slice(from, GAME_TABLE.indexOf('\n  };\n', from));
    // Scan CODE, not commentary. The comment above the call deliberately names
    // the defect it prevents, and a naive substring scan would trip on the
    // explanation rather than on a real regression.
    const stage = body
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    // The destination comes from setAsideDestination, which returns NEW_SHELF or
    // an existing SHELF id — never MAIN. The pin is that no MAIN fallback can
    // reappear in this path by any spelling.
    expect(stage).toContain('setAsideDestination');
    expect(stage, 'no MAIN fallback may reappear in the finder path').not.toContain('MAIN_AREA');
  });

  it('REPEAT PICK: picking the same group twice does not destroy its shelf', () => {
    // The path that triggered the inversion. The five flush cards are already
    // alone on a shelf; picking them again must leave that arrangement intact.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'KD', 'KH'];
    const flush = new Set([0, 1, 2, 3, 4]);
    const once = applyMove(null, hand.length, flush, NEW_SHELF, 3)!;
    expect(slotsOf(once, 1)).toEqual([0, 1, 2, 3, 4]);
    const twice = applyMove(once, hand.length, flush, NEW_SHELF, 3);
    // Same arrangement, and the SAME INSTANCE — so React bails out and nothing
    // flickers. Before the applyMove guard this returned an equal-but-new object
    // via mint-then-normalize, which re-rendered while changing nothing.
    expect(twice).toBe(once);
    expect(slotsOf(twice, 1), 'the shelf still holds the flush').toEqual([0, 1, 2, 3, 4]);
    expect(moveWouldChange(once, hand.length, flush, NEW_SHELF, 3)).toBe(false);
  });

  it('at the allowance cap the finder still answers, and still does not invert', () => {
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'KD', 'KH'];
    const capped = applyMove(null, hand.length, new Set([5, 6]), NEW_SHELF, 2)!;
    // No further shelf fits; the partition is unchanged (the SELECTION change
    // carries the response, and the desk shows the reason).
    expect(applyMove(capped, hand.length, new Set([0, 1]), NEW_SHELF, 2)).toBe(capped);
    // Crucially it did NOT fall back to MAIN and dissolve anything.
    expect(slotsOf(capped, 1)).toEqual([5, 6]);
  });
});

// ---------------------------------------------------------------------------
// The commit must survive the intermediate render act() causes.
// ---------------------------------------------------------------------------

describe('COMMIT LIFETIME — held until the hand really changes', () => {
  const ctx = (hand: Card[], handNo = 1, dealNo = 1, seat = 0) => ({
    seat: seat as 0 | 1 | 2 | 3,
    handNo,
    dealNo,
    hand,
  });
  const hand: Card[] = ['5S', '5S', '6S', '7S'];

  it('an UNCHANGED hand does not resolve the commit', () => {
    // The regression Codex found. act() stores the commit and immediately calls
    // setSelected(new Set()); the reconciliation effect has NO dependency array,
    // so it runs on that render with the hand still unchanged. Consuming the
    // commit there threw it away, and the real hand change that followed fell
    // back to the identity walk — reintroducing the twin defect.
    expect(commitIsResolved(ctx(hand), ctx([...hand]))).toBe(false);
  });

  it('a changed hand resolves it', () => {
    expect(commitIsResolved(ctx(hand), ctx(['5S', '6S', '7S']))).toBe(true);
  });

  it('a hand of the same LENGTH but different cards resolves it', () => {
    // Tribute: one card out, one in. Same length, different contents.
    expect(commitIsResolved(ctx(hand), ctx(['5S', '5S', '6S', 'BJ']))).toBe(true);
  });

  it('a seat switch or a fresh deal resolves it, so it cannot outlive its context', () => {
    expect(commitIsResolved(ctx(hand), ctx(hand, 1, 1, 2))).toBe(true);
    expect(commitIsResolved(ctx(hand), ctx(hand, 2, 1))).toBe(true);
    expect(commitIsResolved(ctx(hand), ctx(hand, 1, 2))).toBe(true);
  });

  it('the GameTable effect consumes the commit only when it is resolved', () => {
    const src = readFileSync(
      new URL('../../../src/client/GameTable.tsx', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(
      /if \(prev !== null && commitIsResolved\(prev, ctx\)\) \{\s*const commit = pendingCommitRef\.current;\s*pendingCommitRef\.current = null;/,
    );
  });
});

// ---------------------------------------------------------------------------
// "Set aside" must set aside, at every cap.
// ---------------------------------------------------------------------------

describe('SET ASIDE — the word and the effect cannot diverge', () => {
  it('mints a new shelf while the budget allows one', () => {
    expect(setAsideDestination(null, 2)).toBe(NEW_SHELF);
  });

  it('AT THE CAP it joins the existing shelf instead of doing nothing', () => {
    // The divergence Grok found: at AREA_HARD_MAX = 2, once any shelf existed
    // the control could not mint a second and had no fallback, so a button
    // reading "set aside" left the arrangement untouched.
    const one = A([1, MAIN_AREA, MAIN_AREA], 2);
    expect(setAsideDestination(one, 2)).toBe(1);
    const hand: Card[] = ['3C', '4C', '5C'];
    const moved = applyMove(one, hand.length, new Set([2]), setAsideDestination(one, 2)!, 2)!;
    expect(slotsOf(moved, 1), 'the cards really joined the shelf').toEqual([0, 2]);
  });

  it('refuses ONLY when not even one shelf fits, which is the honest case', () => {
    expect(setAsideDestination(null, 1)).toBeNull();
  });

  it('the shipped cap is 2, so this path is the common one, not an edge case', () => {
    expect(AREA_HARD_MAX).toBe(2);
  });
});
