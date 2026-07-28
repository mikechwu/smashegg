// A FIGURE IN PROSE MUST BE BACKED BY A TABLE IN THE SAME SECTION.
//
// Four instances now, all the same shape — a sentence quoting a number that the table
// beside it contradicts or does not contain:
//   "between step boundaries extra pixels buy nothing" (its own margin column said
//     otherwise), "cardW 47 already reaches 0.16%" (the only row quoted without a
//     margin), "same R at every delta" (R(0) differed 8x), and "9.20px of margin" left
//     pre-fix inside a sentence whose rate figure had been corrected.
// The rule has been stated four times and broken four times, so it goes in the tooling.
//
// SCOPE, RE-AIMED BY THE status/ SPLIT (round J1). It used to be "the top ## entry of
// STATUS.md", which no longer exists: STATUS.md became status/rounds/*.md, and those files
// are history moved verbatim.
//
// The rule the new scope follows is: TABLE-BACKING APPLIES ONLY TO FILES THAT ARE ALLOWED
// TO CHANGE WHEN A CLAIM IS WRONG. That is status/CURRENT.md and status/VALIDATED.md — the
// live surfaces, the ones a reader is told to load, and the ones where a fix is cheap.
// Round files are excluded on the same reasoning as before, now made structural rather than
// positional: fixing an old orphan figure would be a rewrite, and a scanner over immutable
// files either freezes the suite on frozen sins or forces the rewrites immutability
// forbids.
//
// THE COST, STATED. Old rounds keep whatever prose/table disagreements they had; they are a
// transcript, not an encyclopedia. What protects a reader there is the pointer block at the
// top of every round file and status/WITHDRAWN.md, not this test. And a figure asserted in
// a round file and never promoted to CURRENT or VALIDATED is checked by nothing — which is
// the argument for CURRENT carrying the round's live claims, not merely summarising it.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string =>
  readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

/** The mutable live surfaces. Both are allowed to change when a claim is wrong, which is
 *  exactly the property that makes table-backing enforceable on them. */
const SCANNED = ['status/CURRENT.md', 'status/VALIDATED.md'];

/** Each file split into SECTIONS at its `## ` headings.
 *
 *  AUDIT FINDING (Codex, round J0-J3): the first version of this after the status/ split
 *  concatenated both files and asked whether a prose figure appeared in a table ANYWHERE in
 *  the combined text. The test's own name says "in the same section", and the failure it
 *  exists for is a sentence contradicting the table BESIDE it — so a stale figure in
 *  CURRENT.md could be "backed" by an unrelated row in VALIDATED.md and the check would pass
 *  while the defect it was built for sat in the file. Sectioning restores the claim. */
function sections(): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  for (const f of SCANNED) {
    const src = read(f);
    const idx: number[] = [];
    src.split('\n').forEach((line, i) => {
      if (line.startsWith('## ')) idx.push(i);
    });
    const lines = src.split('\n');
    // Everything before the first `## ` is the file's own preamble and is a section too.
    const bounds = [0, ...idx, lines.length];
    for (let k = 0; k < bounds.length - 1; k += 1) {
      const text = lines.slice(bounds[k]!, bounds[k + 1]!).join('\n');
      if (text.trim().length > 0) out.push({ label: `${f} :: ${(lines[bounds[k]!] ?? '').replace(/^#+\s*/, '') || 'preamble'}`, text });
    }
  }
  return out;
}

/** Lines that are table rows (markdown pipe rows) versus prose. */
function split(section: string): { prose: string[]; tables: string } {
  const prose: string[] = [];
  const tables: string[] = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (t.startsWith('|')) tables.push(line);
    else prose.push(line);
  }
  return { prose, tables: tables.join('\n') };
}

/** Figures a sentence can quote: px values and percentages. */
const FIGURE = /(\d+(?:\.\d+)?)\s*(px|%)/g;

/** Figures that legitimately appear only in prose, each with its reason.
 *
 *  The allowlist is the point, not a loophole: the rule as stated ("every px/% in prose
 *  must be in a table here") is deliberately over-broad, because the alternative — trying
 *  to guess which figures are CLAIMS about the table and which are incidental — is the
 *  kind of cleverness that fails silently. So every exemption is written down with why,
 *  the same shape the axis registry uses, and a new orphan has to be triaged rather than
 *  absorbed. Five on the first entry is the expected friction. */
const ALLOWED: Record<string, string> = {
  '0.1px': "the kMinusCard decomposition residual — a property OF the table, not a row in it",
  '0.04px': "rowChrome's calibration residual across four widths, reported in prose only",
};

// FRICTION, MEASURED AND REPORTED RATHER THAN HIDDEN — AND IT COLLAPSED WHEN THE SCOPE
// MOVED. Under the old scope (the top STATUS entry) this list held SEVENTEEN exemptions,
// most of them relations BETWEEN table rows — a ratio, a difference — or quantities that
// were not decision figures at all: a zoom level, an SVG height, a device width. That was
// the honest cost of a deliberately over-broad rule.
//
// Re-aiming the scanner at status/CURRENT.md and status/VALIDATED.md dropped fourteen of
// the seventeen, because those two files are structurally tabular: CURRENT states decisions
// with their numbers in tables, and VALIDATED is one row per quantity by construction. The
// three that remain are all the same shape — a property OF a table rather than a row IN one,
// and round L0-L2 shed one more as the documents got more tabular still.
//
// That is worth recording as evidence about the rule, not just about the list. The friction
// was never the rule being too broad; it was the rule being pointed at a document whose
// FORM was narrative. The ceiling is now 2.

describe('a figure in prose is backed by a table in the same section', () => {
  const all = sections();
  const section = all.map((s) => s.text).join('\n');
  const { tables } = split(section);

  // G4a: A RATCHET, because a justification string is what the axis registry's
  // exemption started as before it became the escape hatch. The count may fall and may
  // not rise: a new exemption has to displace an old one, or the ceiling has to be moved
  // deliberately in a commit that says why.
  it('the allowlist does not grow', () => {
    const CEILING = 2;
    expect(
      Object.keys(ALLOWED).length,
      `the prose-figure allowlist has ${Object.keys(ALLOWED).length} entries against a ` +
        `ceiling of ${CEILING}. Raising the ceiling is a deliberate act — say why in the ` +
        `commit. Otherwise put the figure in a table, which is what the rule is for.`,
    ).toBeLessThanOrEqual(CEILING);
  });

  // THE RATCHET'S OTHER HALF: an exemption that no longer exempts anything is dead weight
  // that keeps the ceiling high and lets a real orphan slip in under it later. The scope
  // moved this round from "the top STATUS entry" to the live status files, which made
  // several exemptions stale — and a stale exemption is invisible, because nothing it
  // covers exists to fail. So the list must be USED, not merely justified.
  it('every allowlist entry is still needed', () => {
    const unused = Object.keys(ALLOWED).filter((fig) => !section.includes(fig));
    expect(
      unused,
      `these exemptions no longer cover any figure in scope: ${unused.join(', ')}.\n` +
        `Delete them — an unused exemption holds the ceiling up for nothing, and re-adding ` +
        `one when it is needed again is a one-line commit that says why.`,
    ).toEqual([]);
  });

  it('every allowlist entry states a reason', () => {
    for (const [figure, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, `"${figure}" needs a stated reason, not a bare exemption`).toBeGreaterThan(25);
    }
  });

  it('finds a section with both prose and tables (not vacuous)', () => {
    expect(section.length, 'the live status surfaces are findable').toBeGreaterThan(400);
    expect(tables.length, 'it contains at least one table to check against').toBeGreaterThan(40);
  });

  it('finds more than one section, so the sectioning is real', () => {
    expect(all.length, 'the live surfaces split into sections').toBeGreaterThanOrEqual(6);
  });

  // L1: A RATE WITHOUT A THEME IS A RATE WITHOUT ITS CONFIGURATION.
  //
  // Every span, threshold, margin and rate figure in this arc is a LACQUER figure, because
  // `stackStripW` is a per-theme metric and the second shipping theme's is 0.841 against
  // lacquer's 0.42 — which roughly doubles the lattice step and moves every band edge. The
  // arc reported "zero regressions at any width" with a width qualifier and no theme
  // qualifier for eleven rounds, while the other theme sat one tap away in the header.
  //
  // Card WIDTHS are theme-independent and are not required to carry one; RATES are not. So
  // the rule is scoped to percentages, which is where the omission actually misleads.
  it('every section quoting a rate names the theme AND the width it is a rate for', () => {
    // THEME was added in round L1 and WIDTH in M1, one round apart, because the very table
    // the theme fix produced then omitted the width. Both are configuration, both move the
    // number, and neither is recoverable from the figure itself:
    //   theme — stripW 0.42 against 0.841 changes the lattice step outright;
    //   width — capacity is floor((W - 48.0 - 0.3w) / (0.7w)), which changes how columns
    //           split across the two lines and therefore the depth distribution. Measured:
    //           cinnabar-court is 50.3% at inner 390 and 66.6% at inner 360, same card.
    const missing: string[] = [];
    for (const sec of all) {
      const rates = [...sec.text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => m[0]);
      if (rates.length === 0) continue;
      const hasTheme = /lacquer|cinnabar|theme/i.test(sec.text);
      // A width is an inner dimension: "390", "inner 360", "390x664", or a stated range.
      const hasWidth = /\b(3[0-9]{2}|4[0-9]{2}|inner|width)\b/i.test(sec.text);
      if (hasTheme && hasWidth) continue;
      missing.push(
        `${sec.label} (${rates.slice(0, 3).join(', ')})` +
          `${hasTheme ? '' : ' — no theme'}${hasWidth ? '' : ' — no width'}`,
      );
    }
    expect(
      missing,
      `these sections quote rates without their configuration:\n  ${missing.join('\n  ')}\n` +
        'Every rate here is per-theme and per-width. Name both, or say which the quantity ' +
        'is independent of and why.',
    ).toEqual([]);
  });

  it('every px/% figure in prose also appears in a table IN THE SAME SECTION', () => {
    const orphans: { line: string; figure: string; where: string }[] = [];
    for (const sec of all) {
      const { prose, tables: secTables } = split(sec.text);
      for (const line of prose) {
        // Skip headings, blockquotes and code — they are commentary, not claims.
        const t = line.trim();
        if (t.startsWith('#') || t.startsWith('>') || t.startsWith('```')) continue;
        for (const m of line.matchAll(FIGURE)) {
          const figure = `${m[1]}${m[2]}`;
          if (Object.prototype.hasOwnProperty.call(ALLOWED, figure)) continue;
          // A bare number in the table is enough; the unit may be in the header.
          if (secTables.includes(m[1]!)) continue;
          orphans.push({ line: t.slice(0, 110), figure, where: sec.label });
        }
      }
    }
    expect(
      orphans,
      `these figures appear in prose with no table in the same section carrying them:\n` +
        orphans.map((o) => `  ${o.figure}  in ${o.where}\n    ${o.line}`).join('\n') +
        `\nEither put the figure in the section's table, or add it to ALLOWED with a reason. ` +
        `A prose figure with no table behind it is how "9.20px of margin" survived a ` +
        `correction that fixed the rate in the same sentence.`,
    ).toEqual([]);
  });
});
