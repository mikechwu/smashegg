// A BACKTICK INSIDE A PROBE'S TEMPLATE LITERAL TERMINATES IT.
//
// The browser probes in scripts/ are written as template-literal STRINGS, because they are
// shipped into the page with `page.evaluate`. That makes a backtick anywhere inside them —
// including inside a COMMENT, which is where it always happens, because a comment is where
// someone quotes a CSS declaration or a selector — a syntax error in the whole module.
//
// This has now happened twice, in two different scripts, both times in a comment, both
// times costing a debugging cycle in the middle of a measurement run. The first time it was
// recorded as an editor note in the file. A note is what practice 26 is about: it made
// everyone feel the hazard was handled without anything actually stopping it.
//
// So it is a test. It costs nothing and it fires at the moment the character is typed,
// rather than the next time someone runs the gate.
//
// WHY NOT JUST IMPORT THE MODULES. Importing catches it too, but only for the modules that
// are importable without side effects — several of these scripts launch a browser at the
// top level. This reads the source, so it covers every one of them.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPTS = fileURLToPath(new URL('../../../scripts/', import.meta.url));

/** Every `const NAME = \`...\`` probe in a script, with its body. */
function probeLiterals(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length;
    const end = src.indexOf('`', start);
    if (end === -1) continue;
    out.push({ name: m[1]!, body: src.slice(start, end) });
  }
  return out;
}

describe('browser probes are valid template literals', () => {
  const files = readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs'));

  it('finds the probe literals it is going to check (not vacuous)', () => {
    const total = files.reduce(
      (n, f) => n + probeLiterals(readFileSync(SCRIPTS + f, 'utf8')).length,
      0,
    );
    expect(total, 'there are UPPER_CASE template-literal probes in scripts/').toBeGreaterThanOrEqual(10);
  });

  it('every .mjs script parses as a module', () => {
    // NODE'S OWN PARSER, not a re-implementation. The first version of this test wrapped
    // each source in `new Function(...)` after stripping imports, and reported three
    // FALSE POSITIVES immediately — `import.meta` is not valid inside a Function body, and
    // the strip left dangling braces. A guard that cries wolf on correct files gets
    // disabled, so it runs `node --check`, which is the same parser that will load them.
    const broken: string[] = [];
    for (const f of files) {
      try {
        execFileSync('node', ['--check', SCRIPTS + f], { stdio: 'pipe' });
      } catch (e) {
        const err = e as { stderr?: Buffer };
        broken.push(`${f}: ${(err.stderr?.toString() ?? '').split('\n').slice(0, 3).join(' ').trim()}`);
      }
    }
    expect(broken, `these scripts do not parse:\n  ${broken.join('\n  ')}`).toEqual([]);
    // One `node --check` process per script, ~300ms each; the default 5s timeout is not
    // enough for the whole scripts/ directory and a timeout here reads as a parse failure.
  }, 30_000);

  it('the parse check would actually catch a backtick in a probe comment', () => {
    // NON-VACUITY, and specifically for the failure this file exists for. A probe body is a
    // template literal; a backtick in one of its comments ends the literal early and breaks
    // the module. This writes exactly that mistake to a temp file and requires `node --check`
    // to reject it — otherwise a green run above says nothing about the hazard.
    const mutant = join(tmpdir(), `probe-mutant-${process.pid}.mjs`);
    writeFileSync(
      mutant,
      'export const PROBE = `() => {\n' +
        '  // the CSS is `white-space: nowrap` here\n' +
        '  return 1;\n' +
        '}`;\n',
    );
    let rejected = false;
    try {
      execFileSync('node', ['--check', mutant], { stdio: 'pipe' });
    } catch {
      rejected = true;
    } finally {
      rmSync(mutant, { force: true });
    }
    expect(rejected, 'a backtick inside a probe comment must break the parse — it does not, so this guard is blind').toBe(true);
  });

});
