// PREPARE AN AUDIT CLONE, AND MAKE IT IMPOSSIBLE TO AUDIT THE WRONG TREE.
//
// THE INSTANCE THIS EXISTS FOR. Round J0-J3's first audit run cloned the repository with
// `git clone file://$PWD` while the change under review was STAGED BUT NOT COMMITTED. That
// clones HEAD, so the auditor received the tree from before the change and returned four
// confident HIGH/MED findings, every one of the form "the described change is not present".
// It did not error. It did not warn. The only tell was that all four findings said the same
// thing, and that tell is only visible after reading the whole report.
//
// An auditor cannot detect this: from inside the clone, a tree without the change looks
// exactly like a tree where the change was never made. So the check has to happen here,
// before the auditor runs, and it has to be an ASSERTION rather than a note.
//
// WHAT IT ASSERTS
//   1. The working tree is CLEAN. Uncommitted work is invisible to a clone, and that is the
//      whole failure. Staged-but-uncommitted counts as dirty.
//   2. The clone's HEAD equals the working tree's HEAD.
//   3. The clone's tree hash equals the working tree's tree hash — stronger than HEAD alone,
//      because it also catches a clone that resolved a different default branch.
//   4. If --expect-diff <ref> is given, that the diff the auditor will see against that ref
//      is non-empty. An audit of a no-op is a different way to get four confident findings.
//
// It then writes a FINGERPRINT file into the clone and prints the line to paste into the
// audit brief, so the report itself records which tree was read.
//
// Run: node scripts/prepare-audit.mjs <target-dir> [--expect-diff <ref>]

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const target = args[0];
if (target === undefined || target.startsWith('-')) {
  console.log(
    '\nUsage: node scripts/prepare-audit.mjs <target-dir> [--expect-diff <ref>]\n\n' +
      '  Clones the repository at its current HEAD into <target-dir> and asserts the clone\n' +
      '  is the tree you meant to audit. Refuses to run against a dirty working tree.\n',
  );
  process.exit(2);
}
const expectIdx = args.indexOf('--expect-diff');
const expectRef = expectIdx === -1 ? null : args[expectIdx + 1];

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const here = process.cwd();

// 1. The working tree must be clean.
const dirty = git(here, 'status', '--porcelain');
if (dirty !== '') {
  console.log(
    '\nREFUSING: the working tree is not clean, so a clone will NOT contain your change.\n\n' +
      dirty
        .split('\n')
        .slice(0, 20)
        .map((l) => `  ${l}`)
        .join('\n') +
      '\n\n  This is the exact failure this script exists for: a clone takes HEAD, an auditor\n' +
      '  cannot tell a missing change from an unmade one, and it will report confidently on\n' +
      '  the wrong tree. Commit first, then audit the commit.\n',
  );
  process.exit(1);
}

const head = git(here, 'rev-parse', 'HEAD');
const tree = git(here, 'rev-parse', 'HEAD^{tree}');
const subject = git(here, 'log', '-1', '--format=%s');

rmSync(target, { recursive: true, force: true });
execFileSync('git', ['clone', '--quiet', `file://${here}`, target], { encoding: 'utf8' });

// 2 and 3. The clone must BE that tree.
const cloneHead = git(target, 'rev-parse', 'HEAD');
const cloneTree = git(target, 'rev-parse', 'HEAD^{tree}');
const problems = [];
if (cloneHead !== head) problems.push(`clone HEAD ${cloneHead} != working tree HEAD ${head}`);
if (cloneTree !== tree) problems.push(`clone tree ${cloneTree} != working tree ${tree}`);
if (problems.length > 0) {
  console.log(`\nREFUSING: the clone is not the tree you are auditing.\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}

// 4. The change under audit must actually be in it.
let diffStat = null;
if (expectRef !== null) {
  const files = git(target, 'diff', '--name-only', `${expectRef}..HEAD`);
  if (files === '') {
    console.log(
      `\nREFUSING: ${expectRef}..HEAD is EMPTY in the clone, so there is nothing to audit.\n` +
        '  An audit of a no-op returns findings just as confidently as an audit of the wrong\n' +
        '  tree, and reads the same in the report.\n',
    );
    process.exit(1);
  }
  diffStat = `${files.split('\n').length} file(s) changed against ${expectRef}`;
}

const fingerprint =
  `AUDIT TREE FINGERPRINT\n` +
  `  HEAD:    ${head}\n` +
  `  tree:    ${tree}\n` +
  `  subject: ${subject}\n` +
  (diffStat === null ? '' : `  diff:    ${diffStat}\n`);
writeFileSync(`${target}/AUDIT-TREE.txt`, fingerprint);

console.log(`\nClone ready: ${target}`);
console.log(fingerprint);
console.log(
  'Paste this into the audit brief, and require the auditor to echo the HEAD it read back in\n' +
    'its report. A report whose fingerprint does not match this one audited something else.\n',
);
