// HISTORY IS IMMUTABLE, AS A MECHANISM RATHER THAN A CONVENTION.
//
// The split of STATUS.md into status/rounds/*.md was required to be VERBATIM: an old entry
// records what was believed at the time, including claims later withdrawn, and retro-fitting
// corrections into one would destroy the only thing that makes it evidence. "Moved
// verbatim" was true at the migration; this file is what keeps it true.
//
// The pin is the SHA-256 of the concatenation of every round file's BODY — each file below
// its pointer block — which at the migration equalled the SHA-256 of the original
// STATUS.md from its first `## ` heading to the end. Any edit to any round file, any
// reordering, any deletion, and any newly added round that is not appended in order,
// changes it.
//
// ADDING A ROUND deliberately requires updating the expected hash in status/rounds/INDEX.md
// in the same commit. That is the point: appending is a normal act that leaves a record,
// and the DIFF is what a reviewer reads. A test that allowed appends silently would not be
// pinning much.
//
// AUDIT FINDING (Codex, round J0-J3): that alone enforces "matches the current manifest",
// not immutability — because INDEX.md is mutable, editing a historical round and updating
// the hash in the same commit passes. So there is a SECOND, stronger pin: the MIGRATION
// BASELINE, the hash of rounds 001-118 as they were written out of the original STATUS.md,
// hardcoded HERE in the test rather than in a document. Appending rounds 119+ cannot change
// it, and editing any round in 001-118 does — including in the same commit that updates
// INDEX.md, because the baseline is not in INDEX.md to update.
//
// The two pins answer different questions and both are needed: the baseline says the moved
// history is untouched, and the manifest says the round list as a whole is what it was at
// the last review.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ROUNDS = `${ROOT}status/rounds/`;

/** Round files, oldest first — the order the migration wrote and the hash assumes. */
function roundFiles(): string[] {
  return readdirSync(ROUNDS)
    .filter((f) => /^\d{3}-.*\.md$/.test(f))
    .sort();
}

/** A round file's body: everything after the pointer block the migration prepended. */
function body(file: string): string {
  const text = readFileSync(ROUNDS + file, 'utf8');
  const i = text.indexOf('\n\n');
  return text.slice(i + 2);
}

describe('the round record is append-only', () => {
  const files = roundFiles();

  it('the rounds exist and are numbered contiguously from 001', () => {
    expect(files.length, 'status/rounds has round files').toBeGreaterThanOrEqual(100);
    files.forEach((f, i) => {
      expect(f.slice(0, 3), `round ${i + 1} is numbered in order`).toBe(String(i + 1).padStart(3, '0'));
    });
  });

  it('every round file opens with the history pointer block', () => {
    const missing = files.filter((f) => !readFileSync(ROUNDS + f, 'utf8').startsWith('> **Answers:**'));
    expect(missing, `these round files have no pointer block: ${missing.join(', ')}`).toEqual([]);
  });

  it('every round file body starts at its own heading', () => {
    // Cheap structural check that the pointer-stripping above is finding the real seam. If
    // it drifted, the hash would change for a reason that has nothing to do with an edit.
    const bad = files.filter((f) => !body(f).startsWith('## '));
    expect(bad, `these bodies do not start at a '## ' heading: ${bad.join(', ')}`).toEqual([]);
  });

  it('the concatenated bodies still hash to what INDEX.md records', () => {
    const concat = files.map(body).map((b) => b.replace(/\n+$/, '')).join('\n');
    const actual = createHash('sha256').update(concat, 'utf8').digest('hex');
    const index = readFileSync(`${ROUNDS}INDEX.md`, 'utf8');
    const m = index.match(/hashes to `([0-9a-f]{64})`/);
    expect(m, 'rounds/INDEX.md records the expected hash').toBeTruthy();
    expect(
      actual,
      'A ROUND FILE CHANGED.\n' +
        '  If you edited history: do not. Corrections go in status/CURRENT.md or\n' +
        '  status/WITHDRAWN.md, which is the whole reason those files exist.\n' +
        '  If you APPENDED a new round: that is fine — update the hash in\n' +
        '  status/rounds/INDEX.md in the same commit, so the change is reviewable.\n' +
        `  expected ${m?.[1]}\n  actual   ${actual}`,
    ).toBe(m![1]);
  });

  it('the migrated history is byte-identical to what the split produced', () => {
    // Hardcoded, and deliberately not read from any document: a pin a commit can update in
    // passing is a manifest, not a baseline. Rounds 001-118 are the sections moved out of
    // the original STATUS.md; nothing appended later is included, so this hash is fixed
    // forever and any edit inside the migrated history fails here.
    const MIGRATION_BASELINE = 'e01f45806670c414f288de9100771da151740f643ca0c8918bd21faf92b71326';
    const MIGRATED = 118;
    const migrated = files.filter((f) => Number(f.slice(0, 3)) <= MIGRATED);
    expect(migrated.length, 'the 118 migrated rounds are all present').toBe(MIGRATED);
    const concat = migrated.map(body).map((b) => b.replace(/\n+$/, '')).join('\n');
    expect(
      createHash('sha256').update(concat, 'utf8').digest('hex'),
      'A ROUND FROM THE MIGRATED HISTORY (001-118) CHANGED.\n' +
        '  These files were moved verbatim out of the original STATUS.md and are never\n' +
        '  edited. Corrections go in status/CURRENT.md or status/WITHDRAWN.md.\n' +
        '  This baseline is hardcoded in the test precisely so that updating a manifest\n' +
        '  cannot launder an edit past it.',
    ).toBe(MIGRATION_BASELINE);
  });

  it('the live status files each open with a pointer line', () => {
    // Constraint 7: every file says what it answers and where the deeper detail is. This is
    // what lets a reader load two files instead of seven, so it is pinned rather than
    // trusted.
    for (const f of ['CURRENT.md', 'MODEL.md', 'VALIDATED.md', 'WITHDRAWN.md', 'README.md']) {
      const text = readFileSync(`${ROOT}status/${f}`, 'utf8');
      expect(text, `status/${f} opens with an "Answers:" pointer line`).toMatch(/\*\*Answers:\*\*/);
    }
  });

  // K3: CURRENT.md BROKE ITS OWN CONTRACT ON DAY ONE, which is the drift the folder was
  // built to prevent, appearing before the first round closed. README's rule was too blunt
  // ("CURRENT contains no measurement tables") rather than wrong: a decision page that
  // cannot show what it is choosing between forces a two-file read for the commonest
  // question. The line now falls between DECISION tables (options against consequences,
  // which belong here) and MEASUREMENT tables (quantity, n, configuration, validity range,
  // which belong in VALIDATED). This is the check, because a contract nothing enforces is
  // how the first one lasted less than a day.
  const PROVENANCE_COLUMNS = /^(n|configuration|config|validated over|validated|status|sample|deals)$/i;

  it('CURRENT.md carries decision tables, never provenance columns', () => {
    const lines = readFileSync(`${ROOT}status/CURRENT.md`, 'utf8').split('\n');
    const offenders: string[] = [];
    let headers = 0;
    lines.forEach((line, i) => {
      const t = line.trim();
      if (!t.startsWith('|')) return;
      // A header row is one whose NEXT line is the markdown separator.
      const next = (lines[i + 1] ?? '').trim();
      if (!/^\|[\s|:-]+\|$/.test(next)) return;
      headers += 1;
      for (const cell of t.split('|').map((c) => c.replace(/\*/g, '').trim())) {
        if (cell !== '' && PROVENANCE_COLUMNS.test(cell)) {
          offenders.push(`status/CURRENT.md:${i + 1} column "${cell}"`);
        }
      }
    });
    expect(headers, 'CURRENT.md has tables to check (not vacuous)').toBeGreaterThanOrEqual(3);
    expect(
      offenders,
      `these look like MEASUREMENT tables and belong in VALIDATED.md:\n  ${offenders.join('\n  ')}\n` +
        'CURRENT may quote a measured figure; it may not carry how well the figure is known, ' +
        'because then two files record that and they will disagree.',
    ).toEqual([]);
  });

  it('every section of CURRENT.md that carries a table links to the provenance', () => {
    const src = readFileSync(`${ROOT}status/CURRENT.md`, 'utf8');
    const lines = src.split('\n');
    const heads: number[] = [];
    lines.forEach((l, i) => {
      if (l.startsWith('## ')) heads.push(i);
    });
    const bounds = [0, ...heads, lines.length];
    const orphans: string[] = [];
    for (let k = 0; k < bounds.length - 1; k += 1) {
      const text = lines.slice(bounds[k]!, bounds[k + 1]!).join('\n');
      if (!/^\|/m.test(text)) continue;
      if (/VALIDATED\.md|MODEL\.md/.test(text)) continue;
      // The preamble carries the pointer line for the whole file.
      if (k === 0) continue;
      orphans.push((lines[bounds[k]!] ?? 'preamble').slice(0, 70));
    }
    expect(
      orphans,
      `these sections of CURRENT.md carry a table with no route to its provenance:\n  ` +
        `${orphans.join('\n  ')}\nLink VALIDATED.md or MODEL.md so the n and the ` +
        'configuration are one hop away.',
    ).toEqual([]);
  });

  // N3b: A DECIDED ITEM MUST NOT ALSO BE OPEN, and no existing scanner could see this.
  //
  // CURRENT.md's Blocking section still read "the second theme is broken for anyone who
  // picks it... a live product defect awaiting a ruling" one round after the theme was
  // withdrawn AND after that exact wording had been corrected elsewhere on the same page.
  // Both halves were stale in a file whose header says "always true", and the prose-figure
  // and withdrawn-number scanners were both blind to it because the sentence contains no
  // figure at all.
  //
  // The rule is structural and cheap: an identifier that appears in the Decided table may
  // not also appear in Blocking. Identifiers are used rather than prose because they are the
  // one part of a sentence that survives rewording.
  const sectionOf = (src: string, heading: RegExp): string => {
    const lines = src.split('\n');
    const start = lines.findIndex((l) => heading.test(l));
    if (start === -1) return '';
    const rest = lines.slice(start + 1).findIndex((l) => l.startsWith('## '));
    return lines.slice(start, rest === -1 ? undefined : start + 1 + rest).join('\n');
  };
  const identifiersIn = (text: string): string[] =>
    [...text.matchAll(/`([^`\s]{4,})`/g)].map((m) => m[1]!).filter((t) => /[a-z]/i.test(t));

  /** The check, factored out so the mutant below runs the SAME code, not a copy of it. */
  const decidedAlsoBlocking = (src: string): string[] => {
    const decided = new Set(identifiersIn(sectionOf(src, /^## Decided/)));
    return identifiersIn(sectionOf(src, /^## Blocking/)).filter((t) => decided.has(t));
  };

  it('nothing under Decided is also under Blocking', () => {
    const src = readFileSync(`${ROOT}status/CURRENT.md`, 'utf8');
    expect(sectionOf(src, /^## Decided/).length, 'CURRENT.md has a Decided section').toBeGreaterThan(100);
    expect(sectionOf(src, /^## Blocking/).length, 'CURRENT.md has a Blocking section').toBeGreaterThan(20);
    const both = decidedAlsoBlocking(src);
    expect(
      both,
      `these are recorded as DECIDED and also appear under Blocking: ${both.join(', ')}.\n` +
        'A page whose header says "always true" cannot carry a decision in both states. ' +
        'Blocking is for what is actually blocked.',
    ).toEqual([]);
  });

  it('that check would catch the staleness it was written for', () => {
    // MUTANT, run through the same function. The real stale text: the theme was withdrawn
    // and Blocking still called it a live defect awaiting a ruling.
    const mutant = [
      '## Decided, and shipped',
      '| decision | what shipped |',
      '|---|---|',
      '| the second theme is withdrawn | `cinnabar-court` unregistered |',
      '',
      '## Blocking',
      'The second theme is broken for anyone who picks it — `cinnabar-court` is a live',
      'product defect awaiting a ruling.',
    ].join('\n');
    expect(
      decidedAlsoBlocking(mutant),
      'the check must flag an item that is both decided and blocking, or it is decoration',
    ).toContain('cinnabar-court');
  });

  it('the root STATUS.md is a stub that points into the folder', () => {
    const stub = readFileSync(`${ROOT}STATUS.md`, 'utf8');
    expect(stub.length, 'the stub is short').toBeLessThan(1500);
    expect(stub).toContain('status/CURRENT.md');
    expect(stub).toContain('status/README.md');
  });
});
