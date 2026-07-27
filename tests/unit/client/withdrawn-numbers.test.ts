// A WITHDRAWN NUMBER MUST NOT SURVIVE ANYWHERE UNDER docs/.
//
// PLAN.md and STATUS.md were corrected when 13.14% was refuted; reachability.md was
// not — and reachability.md is the document an outside reader reads. That is the
// drift this project has now recorded three times in a different costume: a
// correction lands in the file where it was noticed and stops there.
//
// So each withdrawn figure is listed ONCE here with what replaced it, and the test
// fails if it appears in prose anywhere it could be re-quoted as live. Files are
// allowed to CITE a withdrawn number while marking it withdrawn — provenance
// matters, and deleting the history would make the record unreadable — so an
// occurrence is permitted only inside a line that also carries a withdrawal marker.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOCS = fileURLToPath(new URL('../../../docs/', import.meta.url));

/** Withdrawn figure -> why, and what replaced it. Extend this when a number is
 *  retracted; the entry IS the record. */
const WITHDRAWN: { pattern: RegExp; label: string; replacement: string }[] = [
  {
    pattern: /13\.14\s*%/,
    label: 'the modelled 13.14% infeasible rate at inner 390x664',
    replacement:
      'measured 9.17% [5.2%, 15.7%] at n=120. The model scored each deal at the taller ' +
      'of its two sort orderings, which is right for a bound and wrong for a rate.',
  },
  {
    pattern: /structural worst slack/i,
    label: 'the "structural worst slack" column',
    replacement:
      'the marginal-bin deficit (7.1px at the 316.0 bin). The 465.1px case needs two ' +
      'value classes at all 8 copies in one 27-card hand: 1 in 5.0 billion. It anchored ' +
      'remedy sizing twice.',
  },
  {
    pattern: /1 deal in 8\b/,
    label: '"1 deal in 8", the headline drawn from 13.14%',
    replacement: 'measured 9.17%, i.e. roughly 1 deal in 11 — and only among FOLLOWING turns.',
  },
];

/** Markers that make an occurrence a citation of history rather than a live claim. */
const WITHDRAWAL_MARKERS =
  /withdraw|WITHDRAWN|superseded|refuted|rejected|corrected|was wrong|no longer|struck|retracted|stale|do not quote|not be quoted/i;

/** Files a withdrawn figure may appear in unmarked, with the reason.
 *
 *  A PRE-REGISTRATION IS IMMUTABLE BY CONSTRUCTION. It states the hypotheses as they
 *  stood before the data existed, and 13.14% was one of them. Editing it to reflect
 *  the outcome would destroy the only thing that makes it evidence — it would be the
 *  exact retrofitting that pre-registration exists to prevent. So the file carries an
 *  OUTCOME BANNER appended above its unchanged text, and is exempt here. This is the
 *  only exemption, and it is a property of the document's KIND, not a convenience. */
const EXEMPT: { file: string; reason: string }[] = [
  {
    file: 'research/prereg-fan-model.md',
    reason: 'a pre-registration is immutable; its outcome is appended in a banner, never edited in',
  },
];

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

describe('withdrawn numbers do not survive as live claims', () => {
  const files = markdownFiles(DOCS);

  it('every exemption names a real file and a reason', () => {
    // An exemption list that drifts off real files is a hole nobody can see.
    for (const e of EXEMPT) {
      expect(
        files.some((f) => f.slice(DOCS.length).endsWith(e.file)),
        `the exemption for "${e.file}" points at no file under docs/`,
      ).toBe(true);
      expect(e.reason.length, `"${e.file}" needs a stated reason`).toBeGreaterThan(30);
    }
  });

  it('finds the docs it is going to scan (not vacuous)', () => {
    expect(files.length, 'docs/ has markdown to scan').toBeGreaterThanOrEqual(10);
    // …and the scanner really can see a withdrawn figure where one is known to be.
    const reach = files.find((f) => f.endsWith('reachability.md'));
    expect(reach, 'reachability.md is in scope').toBeTruthy();
    expect(
      WITHDRAWN.some((w) => w.pattern.test(readFileSync(reach!, 'utf8'))),
      'the scanner can detect a withdrawn figure at all — otherwise a clean pass is vacuous',
    ).toBe(true);
  });

  it('every occurrence of a withdrawn figure sits on a line that marks it withdrawn', () => {
    for (const file of files) {
      const rel = file.slice(DOCS.length);
      if (EXEMPT.some((e) => rel === e.file || rel.endsWith(e.file))) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const w of WITHDRAWN) {
        lines.forEach((line, i) => {
          if (!w.pattern.test(line)) return;
          // A TABLE cannot carry the marker on every row without becoming
          // unreadable, and a withdrawn table is withdrawn as a BLOCK. So the marker
          // may sit on the occurrence's own line, anywhere in its enclosing block of
          // contiguous non-blank lines, or in the lead-in immediately above that
          // block. Scoping to the BLOCK rather than to a fixed line window matters:
          // a fixed window silently stops covering a table once the table grows past
          // it, which is a check that decays with the document.
          // SCOPE THE MARKER TO THE ENCLOSING SECTION. A withdrawn table is
          // withdrawn as a block, and a table row cannot carry the marker itself
          // without becoming unreadable. Searching from the nearest preceding
          // heading is stable as the document grows, where a fixed line window
          // silently stops covering a table once it gets longer — a check that
          // decays with the document is worse than no check, because it still
          // looks green.
          let sectionStart = i;
          while (sectionStart > 0 && !/^#{1,6}\s/.test(lines[sectionStart]!)) sectionStart -= 1;
          const covered = lines.slice(sectionStart, i + 1).some((l) => WITHDRAWAL_MARKERS.test(l));
          expect(
            covered,
            `docs/${rel}:${i + 1} quotes ${w.label} without marking it withdrawn.\n` +
              `  line: ${line.trim().slice(0, 160)}\n` +
              `  replaced by: ${w.replacement}\n` +
              `  Cite it if the history needs it, but say on the same line that it is withdrawn.`,
          ).toBe(true);
        });
      }
    }
  });
});
