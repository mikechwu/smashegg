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
// and editing history is indistinguishable from it at the hash level, so the DIFF is what a
// reviewer reads. A test that allowed appends silently would not be pinning much.

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

  it('the live status files each open with a pointer line', () => {
    // Constraint 7: every file says what it answers and where the deeper detail is. This is
    // what lets a reader load two files instead of seven, so it is pinned rather than
    // trusted.
    for (const f of ['CURRENT.md', 'MODEL.md', 'VALIDATED.md', 'WITHDRAWN.md', 'README.md']) {
      const text = readFileSync(`${ROOT}status/${f}`, 'utf8');
      expect(text, `status/${f} opens with an "Answers:" pointer line`).toMatch(/\*\*Answers:\*\*/);
    }
  });

  it('the root STATUS.md is a stub that points into the folder', () => {
    const stub = readFileSync(`${ROOT}STATUS.md`, 'utf8');
    expect(stub.length, 'the stub is short').toBeLessThan(1500);
    expect(stub).toContain('status/CURRENT.md');
    expect(stub).toContain('status/README.md');
  });
});
