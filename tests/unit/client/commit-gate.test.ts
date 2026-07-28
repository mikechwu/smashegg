// A RED SUITE MUST NOT BE COMMITTABLE.
//
// Commit f29e389 went in with tests failing. "Run the suite first" is the wrong
// correction — METHODOLOGY practice 26 says recording a lapse without a mechanism IS
// the lapse, and this project has now written that sentence three times. So the
// mechanism, and a check that the mechanism is wired.
//
// WHAT THIS CAN AND CANNOT ASSERT. It cannot run `git commit` — that would need a
// dirty tree and a subprocess with side effects. What it CAN assert everywhere is that
// the hook exists, is executable on disk AND in the index, and actually invokes the
// suite. What it can assert only on a developer clone is that `core.hooksPath` points
// at the tracked directory rather than at the untracked `.git/hooks` nobody else
// receives — that is local config a CI checkout never has, and the reasoning for
// splitting the two is at the conditional below. The BLOCKING behaviour was verified
// by mutation at the time the hook was
// added: a deliberately failing test made `git commit` exit non-zero and write no
// commit. That verification is recorded here rather than re-run, because re-running it
// on every suite execution would mean committing a broken test to prove commits break.

import { execFileSync } from 'node:child_process';
import { accessSync, constants, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOOK = `${ROOT}.githooks/pre-commit`;

describe('the commit gate is wired, not just written', () => {
  it('the pre-commit hook exists and is executable', () => {
    const src = readFileSync(HOOK, 'utf8');
    expect(src.length, 'the hook has content').toBeGreaterThan(100);
    expect(() => accessSync(HOOK, constants.X_OK), 'the hook is executable').not.toThrow();
  });

  it('the hook actually runs the suite and the typecheck', () => {
    // Asserting the COMMANDS, not a phrase: a hook that echoes "running tests" and
    // exits 0 would satisfy any prose check (practice 29's ladder — demand syntax a
    // comment cannot supply).
    const src = readFileSync(HOOK, 'utf8');
    expect(src, 'the hook runs the unit suite').toMatch(/vitest run/);
    expect(src, 'the hook runs the typecheck').toMatch(/npm run typecheck/);
    expect(
      src,
      'the hook must fail the commit on a non-zero exit rather than continuing past it',
    ).toMatch(/set -e/);
  });

  it('the hook is executable in the INDEX, so every clone receives it armable', () => {
    // The executable bit checked above is THIS machine's filesystem. What a fresh
    // clone receives is the index mode, and a hook checked out 100644 cannot run no
    // matter how correctly core.hooksPath points at it. This is the portable half of
    // "the gate works for everyone", and unlike the arming below it holds in every
    // environment — which is what makes it the assertion CI gets to keep.
    const entry = execFileSync('git', ['ls-files', '-s', '--', '.githooks/pre-commit'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    expect(entry, 'the hook is tracked at all').not.toBe('');
    expect(
      entry.split(/\s/)[0],
      'the hook is tracked mode 100755; a 100644 checkout cannot execute. Run `git update-index --chmod=+x .githooks/pre-commit`.',
    ).toBe('100755');
  });

  // WHY THIS ONE IS CONDITIONAL, AND WHAT THE CONDITION COSTS.
  //
  // core.hooksPath is per-clone LOCAL config, not tracked content. A runner does a
  // fresh checkout and never runs `npm run hooks`, so this assertion could not hold
  // there and never could — it was red on CI from the moment it was written, and only
  // went unnoticed because nothing was pushed for the two days it existed. It is a
  // developer-environment assertion wearing a unit test's clothes.
  //
  // Skipping it on CI costs nothing real: a runner cannot commit, so it has no commit
  // to gate, and ci.yml/deploy.yml each run the suite and the typecheck as their own
  // steps regardless — the gate's PURPOSE is served there by the workflow, not by the
  // hook. What CI still asserts is the test above: that every clone receives a hook it
  // is able to arm. What no environment asserts is that a given developer HAS armed it;
  // that is unprovable from inside CI by construction, and stating so is the honest
  // form of a check that was previously just wrong on half the machines that ran it.
  const onCI = process.env.CI === 'true' || process.env.CI === '1';

  it.runIf(!onCI)('core.hooksPath points at the TRACKED hooks directory', () => {
    // .git/hooks is not version-controlled, so a hook installed there is a gate for
    // exactly one machine. If this is unset the gate is off, and a developer clone must
    // find that out from a red test rather than from a bad commit.
    let configured = '';
    try {
      configured = execFileSync('git', ['config', 'core.hooksPath'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
    } catch {
      configured = '';
    }
    expect(
      configured,
      'core.hooksPath is unset or wrong, so the commit gate is not active. Run `npm run hooks`.',
    ).toBe('.githooks');
  });

  it('npm run hooks is the documented way to arm it', () => {
    const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.hooks, 'package.json carries the arming script').toMatch(
      /core\.hooksPath\s+\.githooks/,
    );
  });
});
