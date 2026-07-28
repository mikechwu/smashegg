// A WORKFLOW STEP MAY NOT RUN A BROWSER GATE IT HAS NOT MADE RUNNABLE.
//
// The defect this exists for: ci.yml ran `playwright install --with-deps chromium`,
// which fetches BROWSER BINARIES and nothing else, and then invoked a script whose
// first act is `await import('playwright')`. The install step reported success. The
// gate died on ERR_MODULE_NOT_FOUND. Two facts make that install-shaped command a
// convincing decoy: it is named "install", and NODE_PATH — the reflex fix — is ignored
// by Node for ESM imports, so the usual escape hatch does not exist.
//
// It was wrong from the day the step was added and never once ran green. It stayed
// invisible because a unit test was failing earlier in the same job, so the step was
// SKIPPED rather than red, and a skipped step is not a signal anyone reads.
//
// WHY TEXTUAL AND NOT A YAML PARSE. No YAML parser is a dependency of this project and
// playwright's absence from package.json is the very constraint under test, so adding
// one to check it would be self-defeating. The assertions below are over raw text and
// character offsets, which is the same choice commit-gate.test.ts makes for the hook:
// assert the COMMANDS in order, not a prose claim about them.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const WORKFLOW_DIR = `${ROOT}.github/workflows`;
const SCRIPT_DIR = `${ROOT}scripts`;

/** Scripts whose first act is an ESM import of playwright. Enumerated, never listed. */
function scriptsImportingPlaywright(): string[] {
  return readdirSync(SCRIPT_DIR)
    .filter((f) => f.endsWith('.mjs'))
    .filter((f) => /(?:import\(\s*['"]playwright['"]\s*\)|from\s+['"]playwright['"])/.test(
      readFileSync(`${SCRIPT_DIR}/${f}`, 'utf8'),
    ));
}

function workflows(): { name: string; text: string }[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({ name: f, text: readFileSync(`${WORKFLOW_DIR}/${f}`, 'utf8') }));
}

// Installing the PACKAGE. `npm install playwright` / `npm i -D playwright` put a
// resolvable module in node_modules. `playwright install` does not, and the negative
// lookbehind is what tells the two apart — it is the entire point of this file.
const INSTALLS_THE_PACKAGE = /npm\s+(?:install|i|add|ci)\b[^\n]*\bplaywright\b/;

describe('a workflow cannot invoke a browser gate it has not made importable', () => {
  it('the enumeration finds gate scripts and finds a workflow using one', () => {
    // Non-vacuity, both halves. If either set were empty every assertion below would
    // pass by having nothing to check — the failure mode an enumeration replaces a
    // hand-maintained list to avoid, reintroduced one level up.
    const scripts = scriptsImportingPlaywright();
    expect(scripts.length, 'some script imports playwright').toBeGreaterThan(0);
    expect(scripts, 'check-containment is one of them').toContain('check-containment.mjs');

    const used = workflows().filter((w) => scripts.some((s) => w.text.includes(s)));
    expect(
      used.length,
      'at least one workflow invokes a playwright gate, so the rule below has a subject',
    ).toBeGreaterThan(0);
  });

  it('every workflow that runs a playwright gate installs the PACKAGE first', () => {
    const scripts = scriptsImportingPlaywright();

    for (const wf of workflows()) {
      for (const script of scripts) {
        const invokedAt = wf.text.indexOf(script);
        if (invokedAt === -1) continue;

        const installedAt = wf.text.search(INSTALLS_THE_PACKAGE);
        expect(
          installedAt,
          `${wf.name} runs ${script}, which imports playwright, but never installs the playwright PACKAGE. ` +
            'Note that `playwright install` fetches browser binaries only and does NOT satisfy this; ' +
            'NODE_PATH does not work for ESM. Use `npm install --no-save playwright@1`.',
        ).toBeGreaterThan(-1);

        expect(
          installedAt,
          `${wf.name} installs the playwright package, but AFTER it runs ${script}. ` +
            'Steps execute in file order, so the install must come first.',
        ).toBeLessThan(invokedAt);
      }
    }
  });

  it('the package install does not write to package.json', () => {
    // playwright is deliberately absent from the manifest: the measurement gates are
    // manual and package.json stays clean. A CI install that saved would put it back,
    // and the next `npm ci` on a developer machine would quietly pull a browser driver
    // nobody asked for.
    for (const wf of workflows()) {
      const line = wf.text.split('\n').find((l) => INSTALLS_THE_PACKAGE.test(l));
      if (!line) continue;
      expect(
        line,
        `${wf.name} installs playwright without --no-save, which would dirty package.json`,
      ).toMatch(/--no-save/);
    }

    const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(
      Object.keys(declared).filter((k) => k === 'playwright' || k === 'playwright-core'),
      'playwright is not a repo dependency; the gates symlink it or CI installs it --no-save',
    ).toEqual([]);
  });
});
