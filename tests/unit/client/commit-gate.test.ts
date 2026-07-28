// A RED SUITE MUST NOT BE COMMITTABLE.
//
// Commit f29e389 went in with tests failing. "Run the suite first" is the wrong
// correction — METHODOLOGY practice 26 says recording a lapse without a mechanism IS
// the lapse, and this project has now written that sentence three times. So the
// mechanism, and a check that the mechanism is wired.
//
// WHAT THIS CAN AND CANNOT ASSERT. It cannot run `git commit` — that would need a
// dirty tree and a subprocess with side effects. What it CAN assert is that the hook
// exists, is executable, actually invokes the suite, and that `core.hooksPath` points
// at the tracked directory rather than at the untracked `.git/hooks` nobody else
// receives. The hook's BLOCKING behaviour was verified by mutation at the time it was
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

  it('core.hooksPath points at the TRACKED hooks directory', () => {
    // .git/hooks is not version-controlled, so a hook installed there is a gate for
    // exactly one machine. If this is unset the gate is off, and a clone must find
    // that out from a red test rather than from a bad commit.
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
