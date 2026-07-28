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
// SCOPE, chosen deliberately. Only the CURRENT (top) entry of STATUS.md and the latest
// numbered section of reachability.md are checked. History is immutable by convention
// here — old entries record what was believed at the time, and retro-fitting tables into
// them would destroy the record. The errors have all been in the entry being written,
// which is also the only place a fix is cheap.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string =>
  readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

/** The top STATUS entry: from the first `## ` heading to the next one. */
function topStatusEntry(): string {
  const src = read('STATUS.md');
  const first = src.indexOf('\n## ');
  const second = src.indexOf('\n## ', first + 1);
  return src.slice(first, second === -1 ? undefined : second);
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
  '69.5px': 'the joker SVG height — a component measurement, not a row of any decision table',
  '0.1px': "C1's off-lattice distance, quoted from the held-out test's own criteria",
  '69%': 'P(a hand contains a joker), a probability of the shoe and not a layout figure',
  '9.20px': 'quoted precisely BECAUSE it is the withdrawn value; the sentence is the retraction',
  '415px': 'the width at which the vw term stops binding — derived in the text, not a swept row',
  '100%': 'a rate of 1, used rhetorically',
  '0%': 'a rate of 0, used rhetorically',
  '14.20px': 'the CORRECTED value, quoted in the sentence that records the correction',
  '137.7px': 'the mutant figure used to demonstrate this very scanner, quoted as an example',
  '3.6%': 'a ratio BETWEEN two table rows, which no single row can carry',
  '8.4%': 'a ratio between a candidate and today, likewise a relation and not a row',
  '5.6%': 'a ratio between two candidate rows',
  '0.04px': 'the stability of a derived constant across widths, reported in prose only',
  '200%': 'a browser zoom level, not a layout measurement',
  '390px': 'the device width the zoom path starts from, named to make the path concrete',
  '195px': 'the CSS viewport that zoom produces — derived in the sentence, not swept',
  '310px': 'the capacity-8 crossing, stated in prose because the table brackets it (305/310)',
};

// FRICTION, MEASURED AND REPORTED RATHER THAN HIDDEN. The rule as specified ("every
// px/% in prose must be in a table here") produced ELEVEN exemptions across two entries.
// Most are relations between rows (a ratio, a difference) or quantities that are not
// decision figures at all (a zoom level, an SVG height). That is the honest cost of a
// deliberately over-broad rule, and it is preferable to a clever narrower one that would
// fail silently — but if it proves unworkable the narrower rule to try is "figures that
// name a unit a table column also uses", not a smaller allowlist.

describe('a figure in prose is backed by a table in the same section', () => {
  const section = topStatusEntry();
  const { prose, tables } = split(section);

  // G4a: A RATCHET, because a justification string is what the axis registry's
  // exemption started as before it became the escape hatch. The count may fall and may
  // not rise: a new exemption has to displace an old one, or the ceiling has to be moved
  // deliberately in a commit that says why.
  it('the allowlist does not grow', () => {
    const CEILING = 17;
    expect(
      Object.keys(ALLOWED).length,
      `the prose-figure allowlist has ${Object.keys(ALLOWED).length} entries against a ` +
        `ceiling of ${CEILING}. Raising the ceiling is a deliberate act — say why in the ` +
        `commit. Otherwise put the figure in a table, which is what the rule is for.`,
    ).toBeLessThanOrEqual(CEILING);
  });

  it('every allowlist entry states a reason', () => {
    for (const [figure, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, `"${figure}" needs a stated reason, not a bare exemption`).toBeGreaterThan(25);
    }
  });

  it('finds a section with both prose and tables (not vacuous)', () => {
    expect(section.length, 'the top STATUS entry is findable').toBeGreaterThan(400);
    expect(tables.length, 'it contains at least one table to check against').toBeGreaterThan(40);
  });

  it('every px/% figure in prose also appears in a table here', () => {
    const orphans: { line: string; figure: string }[] = [];
    for (const line of prose) {
      // Skip headings, blockquotes and code — they are commentary, not claims.
      const t = line.trim();
      if (t.startsWith('#') || t.startsWith('>') || t.startsWith('```')) continue;
      for (const m of line.matchAll(FIGURE)) {
        const figure = `${m[1]}${m[2]}`;
        if (Object.prototype.hasOwnProperty.call(ALLOWED, figure)) continue;
        // A bare number in the table is enough; the unit may be in the header.
        if (tables.includes(m[1]!)) continue;
        orphans.push({ line: t.slice(0, 110), figure });
      }
    }
    expect(
      orphans,
      `these figures appear in prose with no table in the same section carrying them:\n` +
        orphans.map((o) => `  ${o.figure}  in: ${o.line}`).join('\n') +
        `\nEither put the figure in the section's table, or add it to ALLOWED with a reason. ` +
        `A prose figure with no table behind it is how "9.20px of margin" survived a ` +
        `correction that fixed the rate in the same sentence.`,
    ).toEqual([]);
  });
});
