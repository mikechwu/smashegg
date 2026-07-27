// Desktop layout, rung 0 — the PHONE-IDENTITY gate.
//
// The owner's hardest condition on this round: "the phone stays byte-identical
// below the first rung — pinned, not claimed". This file is the pin.
//
// WHAT MAKES IT A PROOF RATHER THAN A PROMISE. A media query cannot apply below
// its breakpoint by construction. So "the phone is unchanged" reduces to a
// property of the stylesheet TEXT — that every declaration rung 0 introduces
// lives inside a `@media (min-width: 720px)` block — and that is decidable by
// scanning, without a DOM, without a browser, and without anyone remembering.
// This is the same shape as the progressive-disclosure pin in
// hand-areas-ui.test.ts: express the contract as something the code cannot
// violate silently, rather than as something a reviewer must notice.
//
// The measured backstop, for the record (docs/research/desktop-layout.md §3.5,
// §3.10): across every reclaim variant and every ladder step, at 390x844 the
// below-fold rate, card size, fan ink, line count, fan height, ring height and
// seat span were IDENTICAL to baseline over 24 deals. That is evidence; this
// file is the guarantee.
//
// The client suite is DOM-free (`environment: 'node'`, vitest.config.ts), so
// these are source pins. The geometry claims they stand in for are measured by
// scripts/measure-fold.mjs and scripts/measure-fan-tap-targets.mjs at stated
// INNER viewport dimensions (METHODOLOGY practice 15).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string =>
  readFileSync(new URL(`../../../src/client/${rel}`, import.meta.url), 'utf8');

/** Pins must match CODE, not prose: the rung-0 comments deliberately quote the
 *  old values and the rejected alternatives so the next reader learns why they
 *  are gone, and a bare substring check would fire on the explanation. */
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '');

const TABLE = stripComments(read('table/table.css'));
const APP = stripComments(read('app.css'));

/** Every `@media (min-width: N)` block's body, brace-matched. A regex cannot do
 *  this correctly — the blocks contain nested rules — and getting it wrong in
 *  the permissive direction would make the whole file vacuous. */
function minWidthBlocks(css: string): { min: number; body: string }[] {
  const out: { min: number; body: string }[] = [];
  const re = /@media\s*\(min-width:\s*(\d+)px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    expect(depth, 'unbalanced braces in a min-width block').toBe(0);
    out.push({ min: Number(m[1]), body: css.slice(start, i - 1) });
  }
  return out;
}

/** The css OUTSIDE every min-width block — i.e. everything the phone sees. */
function outsideMinWidth(css: string): string {
  const blocks = minWidthBlocks(css);
  let rest = css;
  for (const b of blocks) rest = rest.replace(b.body, '');
  return rest;
}

const TABLE_DESKTOP = minWidthBlocks(TABLE).filter((b) => b.min >= 720);
const APP_DESKTOP = minWidthBlocks(APP).filter((b) => b.min >= 720);

describe('the scanner itself is not vacuous', () => {
  // A scanner that finds nothing passes everything. These two checks are what
  // stop this file from silently becoming a no-op after an unrelated edit —
  // the class of failure this project has caught three times now (a gate that
  // exits 0 having measured nothing).
  it('finds the desktop blocks it is going to scan', () => {
    expect(TABLE_DESKTOP.length, 'table.css has ≥720px blocks').toBeGreaterThanOrEqual(2);
    expect(APP_DESKTOP.length, 'app.css has a ≥720px block').toBeGreaterThanOrEqual(1);
    expect(TABLE_DESKTOP.map((b) => b.body).join('').length).toBeGreaterThan(200);
  });

  it('brace matching really returns a block BODY, not the rest of the file', () => {
    const probe = minWidthBlocks('@media (min-width: 720px) { .a { color: red } } .b { color: blue }');
    expect(probe).toHaveLength(1);
    expect(probe[0]!.body).toContain('.a');
    expect(probe[0]!.body, 'the block must end at its own closing brace').not.toContain('.b');
  });
});

describe('PHONE IDENTITY — rung 0 cannot reach a viewport below 720px', () => {
  it('the widened caps exist ONLY inside ≥720px blocks', () => {
    // These three max-widths ARE rung 0's width change. If any appears outside a
    // min-width block it applies at 390px, where `min(94vw, …)` and `96vw` are
    // NARROWER than the viewport — so the leak would not merely be a style
    // difference, it would shrink the phone's content column.
    const widened = ['min(94vw, 100rem)', 'min(94vw, 56rem)', 'min(94vw, 78rem)', '96vw'];
    const phoneTable = outsideMinWidth(TABLE);
    const phoneApp = outsideMinWidth(APP);
    for (const value of widened) {
      expect(
        phoneTable.includes(value) || phoneApp.includes(value),
        `"${value}" must not appear outside a min-width block — it would apply at 390px`,
      ).toBe(false);
    }
    // …and they really are present inside one, or this test is vacuous.
    const desktop = [...TABLE_DESKTOP, ...APP_DESKTOP].map((b) => b.body).join('\n');
    for (const value of widened) {
      expect(desktop, `"${value}" should be declared in a ≥720px block`).toContain(value);
    }
  });

  it('the seat re-siting — the one structural change — is ≥720px only', () => {
    // Taking .gd-ring__seat--west/east out of flow is what reclaims the 138.4px
    // that fixes the fold. On a PHONE the ring is 342px wide and the seats have
    // nowhere to hang: absolute positioning there would overlap the trick well.
    // So this rule leaking below 720 is a visual break, not a subtle drift.
    const phone = outsideMinWidth(TABLE);
    const seatRule = /\.gd-ring__seat--(west|east)\s*,?[^{]*\{[^}]*position:\s*absolute/;
    expect(
      seatRule.test(phone),
      'no rule may position a west/east seat cell absolutely outside a ≥720px block',
    ).toBe(false);
    const desktop = TABLE_DESKTOP.map((b) => b.body).join('\n');
    expect(seatRule.test(desktop), 'the seat re-siting should be present at ≥720px').toBe(true);
  });

  it('SIDE-BY-SIDE areas are ≥720px only — the phone keeps its bands', () => {
    // The phone has no horizontal room: the sort-areas round refuted this exact
    // layout at 390px on measurement (a 50.7px column against 7.4px of slack),
    // and that refutation still holds THERE. It is the desktop arithmetic that
    // voided it (METHODOLOGY practice 17: a refutation carries its conditions).
    // So this rule leaking below 720 would re-introduce a layout already
    // measured not to fit.
    const phone = outsideMinWidth(TABLE);
    const rowRule = /\.gd-fan--split\s*\{[^}]*flex-direction:\s*row/;
    expect(rowRule.test(phone), 'no side-by-side split outside a ≥720px block').toBe(false);
    const desktop = TABLE_DESKTOP.map((b) => b.body).join('\n');
    expect(rowRule.test(desktop), 'side-by-side should be present at ≥720px').toBe(true);
    // The wrap fallback is not optional: whether two areas fit is a property of
    // the DEAL, so without it a card overflows .gd-table invisibly (measured at
    // inner 720x900 before it was added).
    const splitBlock = desktop.match(/\.gd-fan--split\s*\{[^}]*\}/)?.[0] ?? '';
    expect(splitBlock, 'side-by-side must degrade by wrapping, not by overflowing').toContain(
      'flex-wrap: wrap',
    );
    // The widened cap is conditional on a shelf actually being open.
    expect(desktop, 'the split cap is scoped by :has()').toContain('.gd-handzone:has(.gd-fan--split)');
    expect(phone, 'no :has() cap on the phone').not.toContain('.gd-handzone:has(');
  });

  it('the split hand cap clears the SPLIT bound, which is not the single-area one', () => {
    // The 15-class bound does NOT survive splitting: a value can be a column in
    // MAIN and also sit on the shelf, so the two areas are not partitioned by
    // value. Re-derived here from the stylesheet's own numbers rather than from
    // the 906.1px an n=12 sweep happened to produce — that sample understated
    // the true bound by 237.5px, which is exactly practice 14's failure mode.
    const REM = 16;
    const cardPx =
      Number(TABLE.match(/\.gd-card--hand\s*\{[^}]*clamp\([\d.]+rem,\s*[\d.]+vw,\s*([\d.]+)rem\)/)?.[1] ?? NaN) * REM;
    const pitchFactor = Number(
      (TABLE.match(/\.gd-fan__stack\s*\{[^}]*\}/)?.[0] ?? '').match(
        /margin-left:\s*calc\([^)]*\)\s*\*\s*-([\d.]+)\)/,
      )?.[1] ?? NaN,
    );
    const runFactor = Number(
      (TABLE.match(/\.gd-fan__runCards > \.gd-fan__card \+ \.gd-fan__card\s*\{[^}]*\}/)?.[0] ?? '').match(
        /margin-left:\s*calc\([^)]*\)\s*\*\s*-([\d.]+)\)/,
      )?.[1] ?? NaN,
    );
    expect(cardPx).toBe(68);
    expect(pitchFactor).toBeCloseTo(0.3, 10);
    expect(runFactor, 'shelf run overlap is parseable').toBeCloseTo(0.6, 10);

    const CLASSES = 15;
    const HAND = 27;
    const BAND_GAP = 12; // --space-lg between the two areas
    const RUN_GAP = 6; //  --space-xs between runs
    // A recorded GROUP comes only from the straight-flush finder
    // (GameTable.tsx's applyMoveAsGroup); the desk's set-aside uses applyMove
    // and records nothing. A straight flush is at least 5 cards. THAT is the
    // structural fact that bounds run count — without it the shelf could be all
    // 2-card runs and the maximum would be 1389.6px instead.
    const MIN_GROUP = 5;
    const mainInk = (c: number): number => (c === 0 ? 0 : (1 + (c - 1) * (1 - pitchFactor)) * cardPx);
    // g runs holding k cards: each run starts at a full card and adds
    // (1 - runFactor) per extra card, plus the gaps between runs.
    const shelfInk = (k: number, runs: number): number =>
      ((1 - (1 - runFactor)) * runs + (1 - runFactor) * k) * cardPx + Math.max(0, runs - 1) * RUN_GAP;
    let bound = 0;
    for (let k = 1; k <= HAND; k += 1) {
      const c = Math.min(CLASSES, HAND - k);
      for (let g = 0; g <= Math.floor(k / MIN_GROUP); g += 1) {
        const runs = g + (k - g * MIN_GROUP > 0 ? 1 : 0);
        if (runs === 0) continue;
        bound = Math.max(bound, mainInk(c) + (c > 0 ? BAND_GAP : 0) + shelfInk(k, runs));
      }
    }
    // 1207.2px: a 12-card shelf in 3 runs (2 flushes + 2 loose) beside a
    // 15-column MAIN. PROVED over the whole space, not a sampled scenario —
    // the previous figure (1143.6) modelled the shelf as one run and was
    // therefore a configuration, not a maximum.
    expect(Math.round(bound * 10) / 10).toBe(1207.2);

    const desktop = TABLE_DESKTOP.map((b) => b.body).join('\n');
    const capRem = Number(
      desktop.match(/\.gd-handzone:has\(\.gd-fan--split\)\s*\{[^}]*max-width:\s*min\([\d.]+vw,\s*([\d.]+)rem\)/)?.[1] ?? NaN,
    );
    expect(capRem, 'the split cap is parseable').toBeGreaterThan(0);
    expect(
      capRem * REM,
      `the split hand cap (${capRem * REM}px) must clear the split bound (${bound}px)`,
    ).toBeGreaterThan(bound);
  });

  it('the phone keeps the ring geometry the fold measurements were taken against', () => {
    // The base .gd-ring__table rule is what a phone renders. Its row floor and
    // its lack of a max-width are inputs to the 8.3% below-fold rate the owner
    // has accepted; if either moves, that acceptance no longer describes the
    // product and the fold gate must be re-run before it is quoted again.
    const base = TABLE.match(/\.gd-ring__table\s*\{[^}]*\}/)?.[0] ?? '';
    expect(base, 'the base .gd-ring__table rule is findable').not.toBe('');
    expect(base, 'phone ring row floor').toContain('minmax(6.5rem, 1fr)');
    expect(base, 'the phone ring must stay uncapped').not.toContain('max-width');
  });

  it('the ≤719px block is untouched by this round', () => {
    // seat-stack.test.tsx:1122 slices this block with a literal regex, so its
    // header text is load-bearing for another suite too. Rung 0 adds nothing
    // here — the compression it does is the phone's own, from an earlier round.
    const narrow = TABLE.match(/@media \(max-width: 719px\) \{([\s\S]*?)\n\}/);
    expect(narrow, 'the ≤719px block still exists and is still sliceable').not.toBeNull();
    expect(narrow![1], 'rung 0 must not add a desktop cap to the phone block').not.toContain('94vw');
    expect(narrow![1]).not.toContain('position: absolute');
  });
});

describe('RUNG 0 is present and is what it claims to be', () => {
  it('the ring tracks the viewport instead of stopping at a rem cap', () => {
    const ring = TABLE_DESKTOP.map((b) => b.body)
      .join('\n')
      .match(/\.gd-ring__table\s*\{[^}]*\}/)?.[0] ?? '';
    expect(ring, 'the ≥720 .gd-ring__table rule is findable').not.toBe('');
    // 38rem was the cap that froze the west-east span at 608px from 720px all
    // the way to 2478px. Its absence is the change.
    expect(ring, 'the 38rem cap is gone').not.toContain('38rem');
    expect(ring).toContain('min(94vw, 100rem)');
    // 9rem stopped being the binding constraint the moment the seat cells left
    // the flow; leaving it would waste 64px of the reclaim.
    expect(ring, 'the ring row floor drops with the seats').toContain('minmax(5rem, 1fr)');
  });

  it('the hand zone tracks the viewport too, and by the same rule', () => {
    const desktop = TABLE_DESKTOP.map((b) => b.body).join('\n');
    const hand = desktop.match(/\.gd-handzone\s*\{[^}]*\}/)?.[0] ?? '';
    expect(hand, 'the ≥720 .gd-handzone rule is findable').not.toBe('');
    expect(hand, 'the 44rem cap is gone').not.toContain('44rem');
    // Deliberately NOT the ring's cap. The hand zone is sized to its content's
    // structural worst case (15 value columns = 734px of ink at today's pitch),
    // because widening it past that spreads the hand's CHROME — the sort pills
    // and the seat plate — to the screen edges while the fan stays centred.
    expect(hand).toContain('min(94vw, 56rem)');
    expect(hand, 'the hand must not adopt the ring cap').not.toContain('100rem');
  });

  it('the hand cap clears the 15-column worst case, DERIVED from the stylesheet', () => {
    // A literal pin on "56rem" says the value did not change. This says the
    // value is still CORRECT, by re-deriving the quantity it was chosen to
    // clear from the same stylesheet the layout uses. It therefore also breaks
    // if the clamp ceiling or the column pitch moves — which is the point, since
    // those are the two inputs that decide whether a hand wraps.
    //
    // The bound is STRUCTURAL, not sampled (METHODOLOGY practice 14): 15 value
    // columns = 12 non-level natural ranks + the level class + both jokers. It
    // is written down independently at hand-fan.test.tsx:415, and it occurs on
    // 3.4% of deals — which an 8-deal sample misses 76% of the time, so it must
    // be constructed and never waited for.
    //
    // This is a REGRESSION the round found in passing: the previous 44rem
    // (704px) cap was BELOW the 734.4px a 15-column hand needs, so such a hand
    // wrapped to two lines at EVERY width, 2478px included, for the project's
    // whole life.
    const REM = 16;
    const handBlock = TABLE.match(/\.gd-card--hand\s*\{[^}]*\}/)?.[0] ?? '';
    const ceilingRem = Number(
      handBlock.match(/clamp\([\d.]+rem,\s*[\d.]+vw,\s*([\d.]+)rem\)/)?.[1] ?? NaN,
    );
    expect(ceilingRem, 'card clamp ceiling is parseable').toBeGreaterThan(0);

    const pitchBlock = TABLE.match(/\.gd-fan__stack\s*\{[^}]*\}/)?.[0] ?? '';
    const pitchFactor = Number(
      pitchBlock.match(/margin-left:\s*calc\([^)]*\)\s*\*\s*-([\d.]+)\)/)?.[1] ?? NaN,
    );
    expect(pitchFactor, 'stack pitch factor is parseable').toBeGreaterThan(0);

    const desktop = TABLE_DESKTOP.map((b) => b.body).join('\n');
    const capRem = Number(
      desktop.match(/\.gd-handzone\s*\{[^}]*max-width:\s*min\([\d.]+vw,\s*([\d.]+)rem\)/)?.[1] ?? NaN,
    );
    expect(capRem, 'desktop hand cap is parseable').toBeGreaterThan(0);

    const cardPx = ceilingRem * REM;
    const visible = 1 - pitchFactor;
    const WORST_CASE_COLUMNS = 15;
    const inkPx = (1 + (WORST_CASE_COLUMNS - 1) * visible) * cardPx;
    const capPx = capRem * REM;

    expect(cardPx).toBe(68);
    expect(visible).toBeCloseTo(0.7, 10);
    expect(Math.round(inkPx * 10) / 10).toBe(734.4);
    expect(
      capPx,
      `the desktop hand cap (${capPx}px) must clear a ${WORST_CASE_COLUMNS}-column hand ` +
        `(${inkPx}px of ink) or such a hand wraps at every width`,
    ).toBeGreaterThan(inkPx);
  });

  it('rung 0 changes NO card metric — it is a container change only', () => {
    // The round's finding was that the hand's clarity constraint is VERTICAL
    // (the 28.56px pile strip), not horizontal, so rung 0 deliberately touches
    // no card size, no column pitch and none of the nine clamp sites. This pin
    // is what stops a later "while we're here" edit from smuggling one in under
    // rung 0's name — and the clamp sites in particular are load-bearing:
    // table.css:805-813 records that a wrong one silently yields margin 0 and
    // renders 27 full-height cards with no overlap at all.
    const desktop = [...TABLE_DESKTOP, ...APP_DESKTOP].map((b) => b.body).join('\n');
    expect(desktop, 'no desktop card-width override').not.toContain('--gd-cardw');
    expect(desktop, 'no desktop column-pitch override').not.toContain('.gd-fan__stack');
    expect(desktop, 'no desktop index-ratio override').not.toContain('.gd-card__rank');
    const clampCopies = (TABLE.match(/clamp\(2\.75rem, 13vw, 4\.25rem\)/g) ?? []).length;
    expect(clampCopies, 'the nine clamp sites are untouched by this round').toBe(9);
  });
});

// ---------------------------------------------------------------------------
// The nine clamp sites must AGREE. Not consolidated — that was withdrawn, and
// correctly: five of them are deliberate ancestor definitions serving inline
// `calc(var(--gd-cardw) * F)` styles, and a missing one makes the calc invalid
// at computed-value time so the margin silently becomes 0 (table.css:805-813
// records this observed live as 27 full-height cards at zero overlap).
//
// So the risk here is not that the value is hardcoded — someone has to choose
// it — but that nine copies DRIFT. That is checkable without touching any of
// them, which is most of the benefit at none of the silent-breakage risk.
// ---------------------------------------------------------------------------
describe('the card clamp is duplicated on purpose — but the copies must agree', () => {
  it('every clamp() spelling of the hand card is character-identical', () => {
    const clamps = [...TABLE.matchAll(/clamp\(\s*[\d.]+rem\s*,\s*[\d.]+vw\s*,\s*[\d.]+rem\s*\)/g)].map(
      (m) => m[0].replace(/\s+/g, ' '),
    );
    // Non-vacuity: if the spelling changes so this finds nothing, the test must
    // fail rather than pass on an empty set.
    expect(clamps.length, 'the clamp copies are findable').toBeGreaterThanOrEqual(9);
    const distinct = [...new Set(clamps)];
    expect(
      distinct,
      `the hand card's clamp is written ${clamps.length} times and they must all ` +
        `be the same string; found ${distinct.length} distinct: ${distinct.join(' | ')}`,
    ).toHaveLength(1);
  });

  it('the count is pinned, so ADDING a tenth copy is a deliberate act', () => {
    // Not a style rule — a change-detector on purpose. A new copy is a new place
    // to drift, and the person adding it should have to say so here.
    const clamps = TABLE.match(/clamp\(\s*[\d.]+rem\s*,\s*[\d.]+vw\s*,\s*[\d.]+rem\s*\)/g) ?? [];
    expect(clamps).toHaveLength(9);
  });
});
