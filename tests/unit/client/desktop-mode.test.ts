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
    const widened = ['min(94vw, 100rem)', 'min(94vw, 56rem)', '96vw'];
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
