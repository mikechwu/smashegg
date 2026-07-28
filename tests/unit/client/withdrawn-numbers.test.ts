// A WITHDRAWN NUMBER MUST NOT SURVIVE AS A LIVE CLAIM ANYWHERE IT COULD BE RE-QUOTED.
//
// PLAN.md and STATUS.md were corrected when 13.14% was refuted; reachability.md was not —
// and reachability.md is the document an outside reader reads. That is the drift this
// project has now recorded three times in a different costume: a correction lands in the
// file where it was noticed and stops there.
//
// TWO CHANGES FROM THE FIRST VERSION OF THIS FILE.
//
// 1. THE REGISTRY IS NOW A DOCUMENT, NOT A FIXTURE. It lived in a const array here, which
//    reproduced the original drift in reverse: the tooling knew which figures were dead and
//    no document did. It is now parsed from status/WITHDRAWN.md, so there is one list and a
//    human can read it.
//
// 2. THE SCOPE FOLLOWS THE SPLIT. STATUS.md became status/rounds/*.md, and those files are
//    history moved verbatim. Scanning them would either freeze on frozen sins or force the
//    retro-edits that immutability forbids, so they are exempt — the same KIND of exemption
//    a pre-registration gets, and for the same reason. The live surfaces (status/*.md,
//    docs/**, PLAN.md) are in scope, which is where a re-quote can actually mislead.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Entry {
  pattern: RegExp;
  label: string;
  replacement: string;
}

/** Parse the registry table out of status/WITHDRAWN.md.
 *
 *  The table's rows are `| \`pattern\` | label | replacement |`. Parsing a document rather
 *  than importing a fixture is the whole point, so this is deliberately strict: a row it
 *  cannot parse is a row that silently stops protecting anything, and the count assertion
 *  below is what makes that visible. */
function loadRegistry(): Entry[] {
  const src = readFileSync(`${ROOT}status/WITHDRAWN.md`, 'utf8');
  const start = src.indexOf('## Registry');
  expect(start, 'status/WITHDRAWN.md has a "## Registry" section').toBeGreaterThan(-1);
  const section = src.slice(start, src.indexOf('\n## ', start + 1) === -1 ? undefined : src.indexOf('\n## ', start + 1));
  const out: Entry[] = [];
  const unparsed: string[] = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(t)) continue; // the separator row
    const m = t.match(/^\|\s*`(.+?)`\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m !== null && m[1] === 'pattern') continue; // the header row
    if (m === null) {
      // AUDIT FINDING (Codex, round J0-J3): the first version simply skipped any row it
      // could not parse. A registry row that stops parsing stops protecting anything, and
      // it does so invisibly — which is the precise shape of the failure this whole
      // mechanism exists to prevent, one level up. An unparseable row is now an error.
      if (t.startsWith('| pattern')) continue;
      unparsed.push(t.slice(0, 120));
      continue;
    }
    out.push({ pattern: new RegExp(m[1]!, 'i'), label: m[2]!, replacement: m[3]! });
  }
  expect(
    unparsed,
    'these rows of status/WITHDRAWN.md\'s registry do not parse and therefore protect ' +
      `nothing:\n  ${unparsed.join('\n  ')}\n` +
      'A row is `| \`pattern\` | what it was | replaced by |`.',
  ).toEqual([]);
  return out;
}

/** Markers that make an occurrence a citation of history rather than a live claim. */
const WITHDRAWAL_MARKERS =
  /withdraw|WITHDRAWN|superseded|refuted|rejected|corrected|was wrong|no longer|struck|retracted|stale|do not quote|not be quoted|residual/i;

/** Paths exempt from the scan, each with the reason. A trailing '/' marks a directory. */
const EXEMPT: { path: string; reason: string }[] = [
  {
    path: 'docs/research/prereg-',
    reason:
      'a pre-registration is immutable by construction: it states the hypotheses as they stood ' +
      'before the data existed, and editing it to reflect the outcome would be the exact ' +
      'retrofitting pre-registration exists to prevent. Outcomes are appended in a banner.',
  },
  {
    path: 'docs/research/proposals/',
    reason:
      'panel artifacts are RECEIVED verbatim from an external lineage. Editing one to reflect a ' +
      'later correction would misrepresent what that lineage actually said, and the panel is only ' +
      'evidence because it is unedited. Corrections belong in the doc that CITES the proposal.',
  },
  {
    path: 'status/rounds/',
    reason:
      'round files are history, moved verbatim from the former STATUS.md and never edited. ' +
      'Scanning them would either freeze the suite on claims that were true when written, or ' +
      'force the rewrites that immutability forbids. Their protection is the pointer block at ' +
      'the top of each file, not this scanner. rounds/INDEX.md pins the hash.',
  },
  {
    path: 'status/WITHDRAWN.md',
    reason: 'it IS the registry — every occurrence in it is definitionally a withdrawal',
  },
];

/** Every mutable markdown file a withdrawn figure could be re-quoted as live in. */
function scannedFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.md')) out.push(full);
    }
  };
  walk(`${ROOT}docs`);
  walk(`${ROOT}status`);
  out.push(`${ROOT}PLAN.md`);
  out.push(`${ROOT}STATUS.md`);
  return out;
}

describe('withdrawn numbers do not survive as live claims', () => {
  const registry = loadRegistry();
  const files = scannedFiles();

  it('the registry parses out of the document', () => {
    // A parser that silently returns [] would make every other assertion vacuous.
    expect(registry.length, 'status/WITHDRAWN.md yields registry rows').toBeGreaterThanOrEqual(6);
    for (const e of registry) {
      expect(e.label.length, `"${e.pattern.source}" states what it was`).toBeGreaterThan(15);
      expect(e.replacement.length, `"${e.pattern.source}" states what replaced it`).toBeGreaterThan(25);
    }
  });

  it('every exemption names a real path and a reason', () => {
    for (const e of EXEMPT) {
      expect(
        files.some((f) => f.slice(ROOT.length).startsWith(e.path)),
        `the exemption for "${e.path}" matches no scanned file`,
      ).toBe(true);
      expect(e.reason.length, `"${e.path}" needs a stated reason`).toBeGreaterThan(30);
    }
  });

  it('the scan covers both doc trees and is not vacuous', () => {
    const rel = files.map((f) => f.slice(ROOT.length));
    expect(rel.filter((r) => r.startsWith('docs/')).length, 'docs/ is scanned').toBeGreaterThanOrEqual(10);
    expect(rel.filter((r) => r.startsWith('status/')).length, 'status/ is scanned').toBeGreaterThanOrEqual(5);
    // The history is present to be exempted — if the split were undone or misnamed, the
    // exemption would quietly cover nothing and this test would still be green.
    expect(
      rel.filter((r) => r.startsWith('status/rounds/')).length,
      'the round files exist, so the history exemption is exempting something real',
    ).toBeGreaterThanOrEqual(50);
    // …and the scanner can actually detect a withdrawn item where one is known to be.
    const reach = files.find((f) => f.endsWith('reachability.md'));
    expect(reach, 'reachability.md is in scope').toBeTruthy();
    const reachText = readFileSync(reach!, 'utf8');
    expect(
      registry.some((w) => w.pattern.test(reachText)),
      'the scanner can detect a withdrawn item at all — otherwise a clean pass is vacuous',
    ).toBe(true);
    // …and specifically a PROSE entry, not only a numeric one. A number-only scanner
    // passing on a doc full of withdrawn sentences is the blind spot the list was extended
    // to close.
    expect(
      /cannot be found in spacing|extra pixels buy nothing/i.test(reachText),
      'a withdrawn PROSE conclusion is present to be detected, so a pass is not vacuous ' +
        'merely because prose entries never match anything',
    ).toBe(true);
  });

  it('every occurrence of a withdrawn item sits in a section that marks it withdrawn', () => {
    for (const file of files) {
      const rel = file.slice(ROOT.length);
      if (EXEMPT.some((e) => rel.startsWith(e.path))) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const w of registry) {
        lines.forEach((line, i) => {
          if (!w.pattern.test(line)) return;
          // SCOPE THE MARKER TO THE ENCLOSING SECTION. A withdrawn table is withdrawn as a
          // block, and a table row cannot carry the marker itself without becoming
          // unreadable. Searching from the nearest preceding heading is stable as the
          // document grows, where a fixed line window silently stops covering a table once
          // it gets longer — a check that decays with the document is worse than no check,
          // because it still looks green.
          let sectionStart = i;
          while (sectionStart > 0 && !/^#{1,6}\s/.test(lines[sectionStart]!)) sectionStart -= 1;
          const covered = lines.slice(sectionStart, i + 1).some((l) => WITHDRAWAL_MARKERS.test(l));
          expect(
            covered,
            `${rel}:${i + 1} quotes ${w.label} without marking it withdrawn.\n` +
              `  line: ${line.trim().slice(0, 160)}\n` +
              `  replaced by: ${w.replacement}\n` +
              `  Cite it if the history needs it, but say in the same section that it is withdrawn.`,
          ).toBe(true);
        });
      }
    }
  });
});
