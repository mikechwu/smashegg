// Generate status/MODEL.md from status/model.json.
//
// WHY GENERATE IT. Every quantity in this model has been re-derived by grep from five
// rounds' tables, and the arc's recurring error is a prose figure that contradicts the
// table beside it. A generated file cannot contradict its source. What it CAN do is
// contradict the code — so generation alone is half a mechanism, and the other half is
// tests/unit/client/model-drift.test.ts, which asserts that every `source.literal` in
// model.json is still physically present in the file it names.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not typeset provenance. A constant whose
// story needs a paragraph has that paragraph in status/VALIDATED.md, and MODEL.md carries
// only a pointer. Keeping the generator dumb is what keeps it stable; a generator that
// renders essays acquires a template language and then a maintainer.
//
// Run: node scripts/gen-model.mjs          (writes status/MODEL.md)
//      node scripts/gen-model.mjs --check  (exit 1 if the file on disk differs)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const model = JSON.parse(readFileSync(`${root}status/model.json`, 'utf8'));

const num = (v) => (Number.isInteger(v) ? String(v) : String(v));

function render(m) {
  const L = [];
  L.push('<!-- GENERATED from status/model.json by scripts/gen-model.mjs. DO NOT EDIT.');
  L.push('     Regenerate: node scripts/gen-model.mjs -->');
  L.push('# MODEL (generated)');
  L.push('');
  L.push(
    '> **Answers:** what the layout model IS — every constant, formula and decomposition, in ' +
      'one place. **Evidence** (measured or modelled, n, configuration, validity range): ' +
      '`status/VALIDATED.md`. **Decisions and open items:** `status/CURRENT.md`. ' +
      '**Machine source:** `status/model.json`.',
  );
  L.push('');
  L.push(
    'This file is a projection of `model.json` and is regenerated, never edited. A figure ' +
      'here is the value the code actually contains: every `source` below names a file and a ' +
      'literal, and `tests/unit/client/model-drift.test.ts` fails if that literal is no longer ' +
      'there. **It does not tell you whether the value is trustworthy** — that is VALIDATED\'s ' +
      'job, and a value can be present in the code and still be a model tail, a sampled bound, ' +
      'or a constant measured in one pinned configuration.',
  );
  L.push('');
  L.push('## Reference cell');
  L.push('');
  L.push(`Inner **${m.reference.innerW} x ${m.reference.innerH}**. ${m.reference.note}`);
  L.push('');
  L.push('## Constants');
  L.push('');
  L.push('| id | value | what | source |');
  L.push('|---|---|---|---|');
  for (const c of m.constants) {
    L.push(
      `| \`${c.id}\` | ${num(c.value)} ${c.unit} | ${c.what} | \`${c.source.file}\` — \`${c.source.literal}\` |`,
    );
  }
  L.push('');
  const withParts = m.constants.filter((c) => c.parts !== undefined);
  if (withParts.length > 0) {
    L.push('## Decompositions');
    L.push('');
    L.push('| id | parts | sum | stated total | residual |');
    L.push('|---|---|---|---|---|');
    for (const c of withParts) {
      const sum = Object.values(c.parts).reduce((a, b) => a + b, 0);
      const residual = Math.round((c.value - sum) * 1000) / 1000;
      L.push(
        `| \`${c.id}\` | ${Object.entries(c.parts).map(([k, v]) => `${k} ${v}`).join(' + ')} | ` +
          `${num(sum)} | ${num(c.value)} | **${num(residual)}** |`,
      );
    }
    L.push('');
    for (const c of withParts) {
      if (c.partsNote !== undefined) L.push(`- \`${c.id}\`: ${c.partsNote}`);
    }
    L.push('');
  }
  L.push('## Formulas');
  L.push('');
  for (const f of m.formulas) {
    L.push(`### \`${f.id}\``);
    L.push('');
    L.push('```');
    L.push(f.expression);
    L.push('```');
    L.push('');
    L.push(f.what);
    L.push('');
  }
  const notes = m.constants.filter((c) => c.scriptNote !== undefined);
  if (notes.length > 0) {
    L.push('## Where two sources disagree');
    L.push('');
    for (const c of notes) {
      L.push(`- **\`${c.id}\`** — model ${num(c.value)}, scripts ${c.scriptValue}. ${c.scriptNote}`);
    }
    L.push('');
  }
  L.push('## What ships');
  L.push('');
  for (const [k, v] of Object.entries(m.shipped)) {
    L.push(`- **${k}**: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  L.push('');
  return L.join('\n');
}

const out = render(model);
const target = `${root}status/MODEL.md`;
if (process.argv.includes('--check')) {
  let current = null;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    console.log('status/MODEL.md does not exist. Run: node scripts/gen-model.mjs');
    process.exit(1);
  }
  if (current !== out) {
    console.log('status/MODEL.md DIFFERS from what model.json generates. It was hand-edited, or');
    console.log('model.json changed without regenerating. Run: node scripts/gen-model.mjs');
    process.exit(1);
  }
  console.log('status/MODEL.md matches status/model.json.');
} else {
  writeFileSync(target, out);
  console.log(`wrote status/MODEL.md (${out.split('\n').length} lines)`);
}
