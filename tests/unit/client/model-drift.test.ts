// status/model.json IS THE MODEL ONLY IF IT CANNOT DRIFT FROM THE CODE.
//
// The owner asked for the model to be GENERATED rather than written, so that "claims must
// match code" stops being a convention and becomes a mechanism. Generating status/MODEL.md
// from status/model.json is half of that: it makes the doc unable to contradict its source.
// It does nothing at all about the doc contradicting the CODE — which is the failure this
// project has actually had, four times, in the form of a prose figure that no longer
// matches the table or the file beside it.
//
// So each entry in model.json names the file and the literal where its value physically
// lives, and this test asserts the literal is still there. A constant changed in the CSS or
// a gate script without being changed here turns the suite red, which is the only version
// of "single source of truth" that survives contact with a future round.
//
// NON-VACUITY. A substring search that always passes proves nothing, so every literal is
// also checked in a PERTURBED form: the same string with the number moved by one, asserted
// ABSENT. If a perturbed literal were also found, the search would be matching something
// other than what it claims.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, 'utf8');

interface Source {
  file: string;
  literal: string;
}
interface Constant {
  id: string;
  value: number;
  unit: string;
  what: string;
  source: Source;
  parts?: Record<string, number>;
  partsNote?: string;
  scriptValue?: number;
  scriptNote?: string;
}
interface Model {
  reference: { innerW: number; innerH: number; note: string };
  constants: Constant[];
  formulas: { id: string; expression: string; what: string; source?: Source }[];
  shipped: Record<string, unknown>;
}

const model = JSON.parse(read('status/model.json')) as Model;

/** The literal with its first number moved by one — a string that must NOT be found. */
function perturb(literal: string): string | null {
  const m = literal.match(/\d+(?:\.\d+)?/);
  if (m === null) return null;
  const n = Number(m[0]);
  const bumped = m[0].includes('.') ? (n + 1).toFixed(m[0].split('.')[1]!.length) : String(n + 1);
  return literal.replace(m[0], bumped);
}

describe('the model file does not drift from the code', () => {
  it('has enough constants and formulas to be the model at all', () => {
    expect(model.constants.length, 'model.json carries the constants').toBeGreaterThanOrEqual(12);
    expect(model.formulas.length, 'model.json carries the formulas').toBeGreaterThanOrEqual(6);
  });

  it('every constant names a source file and a literal', () => {
    for (const c of model.constants) {
      expect(c.source?.file, `${c.id} names the file its value lives in`).toBeTruthy();
      expect(c.source?.literal, `${c.id} names the literal`).toBeTruthy();
      expect(c.what.length, `${c.id} says what it is`).toBeGreaterThan(20);
    }
  });

  it('every literal is still present in the file it names', () => {
    const missing: string[] = [];
    for (const c of model.constants) {
      const text = read(c.source.file);
      if (!text.includes(c.source.literal)) missing.push(`${c.id}: "${c.source.literal}" not in ${c.source.file}`);
    }
    expect(
      missing,
      'a value changed in the code without being changed in status/model.json:\n  ' +
        missing.join('\n  ') +
        '\nUpdate model.json (and re-run `node scripts/gen-model.mjs`), or put the value back.',
    ).toEqual([]);
  });

  it('a perturbed literal is NOT found, so the search discriminates', () => {
    const blind: string[] = [];
    let checked = 0;
    for (const c of model.constants) {
      const p = perturb(c.source.literal);
      if (p === null) continue;
      checked += 1;
      if (read(c.source.file).includes(p)) blind.push(`${c.id}: perturbed "${p}" also matches ${c.source.file}`);
    }
    expect(checked, 'the perturbation check examined something').toBeGreaterThanOrEqual(10);
    expect(blind, `the literal search is not specific:\n  ${blind.join('\n  ')}`).toEqual([]);
  });

  it('every decomposition sums to its stated total, and the residual is recorded', () => {
    const decomposed = model.constants.filter((c) => c.parts !== undefined);
    expect(decomposed.length, 'there are decompositions to check').toBeGreaterThanOrEqual(2);
    for (const c of decomposed) {
      const sum = Object.values(c.parts!).reduce((a, b) => a + b, 0);
      const residual = Math.abs(c.value - sum);
      // The residual may be nonzero — kMinusCard's is 0.1px — but it may not be a
      // SURPRISE. Anything above a tenth of a pixel has to be explained in partsNote,
      // which is the field a reader checks before quoting the decomposition as exact.
      expect(residual, `${c.id} parts sum to ${sum} against ${c.value}`).toBeLessThanOrEqual(0.15);
      if (residual > 0.001) {
        expect(
          c.partsNote ?? '',
          `${c.id} has a residual of ${residual.toFixed(3)} and must say so in partsNote — ` +
            'an undocumented residual is how "decomposed to 0px" was recorded for a sum that is not 0.',
        ).toMatch(/residual/i);
      }
    }
  });

  // AUDIT FINDING (Codex, round J0-J3): the first version of this checked only CONSTANTS.
  // Changing `capacityFor` in cardw-gate.mjs from `0.7 * w` to `0.8 * w` leaves every
  // constant literal exactly where model.json says it is, and makes MODEL.md's capacity
  // formula silently wrong. A formula is as much a claim about the code as a number is, so
  // each one now names the fragment that implements it.
  it('every formula names the code that implements it, and that code still says so', () => {
    const missing: string[] = [];
    const unbound: string[] = [];
    for (const f of model.formulas) {
      if (f.source === undefined) {
        unbound.push(f.id);
        continue;
      }
      if (!read(f.source.file).includes(f.source.literal)) {
        missing.push(`${f.id}: "${f.source.literal}" not in ${f.source.file}`);
      }
    }
    expect(
      unbound,
      `these formulas claim to describe the code but name none of it: ${unbound.join(', ')}. ` +
        'An unbound formula is a sentence in a generated document with nothing behind it.',
    ).toEqual([]);
    expect(
      missing,
      `a formula's implementation changed without model.json changing:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('a perturbed formula fragment is NOT found, so those searches discriminate too', () => {
    const blind: string[] = [];
    let checked = 0;
    for (const f of model.formulas) {
      if (f.source === undefined) continue;
      const p = perturb(f.source.literal);
      if (p === null) continue;
      checked += 1;
      if (read(f.source.file).includes(p)) blind.push(`${f.id}: perturbed "${p}" also matches`);
    }
    expect(checked, 'the formula perturbation check examined something').toBeGreaterThanOrEqual(5);
    expect(blind, `formula binding is not specific:\n  ${blind.join('\n  ')}`).toEqual([]);
  });

  it('MODEL.md is what the generator produces from model.json', () => {
    // RUN THE GENERATOR rather than re-implementing it here: a second implementation in
    // the test would agree with a bug in the first. Exit 0 means the file on disk is
    // byte-identical to what model.json renders, so a hand-edit to MODEL.md is red.
    const out = execFileSync('node', ['scripts/gen-model.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(out).toContain('matches');
  });

  it('the generated file carries its do-not-edit banner', () => {
    const md = read('status/MODEL.md');
    expect(md.startsWith('<!-- GENERATED'), 'MODEL.md opens with the generated banner').toBe(true);
    expect(md).toContain('DO NOT EDIT');
  });
});
