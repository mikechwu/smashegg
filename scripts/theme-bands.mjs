// L1 — THE MODEL, EVALUATED AT EVERY SHIPPING DECK THEME.
//
// WHAT THIS EXISTS TO CORRECT. Every span, threshold, margin and rate figure in this arc is
// a LACQUER figure. `status/VALIDATED.md` says so in one line; nothing else does. The
// decision tables, the option comparison and the sentence "the arc now has zero regressions
// at any width" all carry a width qualifier and no theme qualifier — and the second theme is
// reachable from a <select> in the app header, one tap, on every screen.
//
// The reason it matters is not presentational. `stackStripW` is the fraction of each covered
// card left visible in a stacked column, so it multiplies directly into the lattice step:
//
//     c(s) = 4*aspect + stripW*(s - 2)        margin(s, w) = 436.0 - c(s)*w
//
// lacquer shows 0.42 of each covered card and cinnabar-court shows 0.841 — almost exactly
// twice — so cinnabar's fan grows about twice as fast with depth, and every band edge sits
// at a far smaller card.
//
// THE STRIPS ARE READ FROM THE THEME SOURCES, not restated here. A constant copied into a
// script is a constant that will disagree with the product eventually, and this whole file
// is about a figure that was true for one configuration and reported as if general.
//
// Run: node scripts/theme-bands.mjs      (no browser, no server)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const THEMES_DIR = `${ROOT}src/client/table/themes/`;

/** Every registered theme's id and stackStripW, read from its own source. */
function themeStrips() {
  const out = [];
  const consider = [];
  for (const entry of readdirSync(THEMES_DIR)) {
    const full = THEMES_DIR + entry;
    if (statSync(full).isDirectory()) consider.push(`${full}/index.tsx`);
    else if (entry.endsWith('.tsx')) consider.push(full);
  }
  for (const file of consider) {
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const id = src.match(/id:\s*'([a-z-]+)'/)?.[1];
    const strip = src.match(/stackStripW:\s*([\d.]+)/)?.[1];
    const aspect = src.match(/aspect:\s*([\d.]+)/)?.[1];
    if (id !== undefined && strip !== undefined) {
      out.push({ id, strip: Number(strip), aspect: Number(aspect ?? 1.45), file: file.slice(ROOT.length) });
    }
  }
  return out;
}

const THEMES = themeStrips();
if (THEMES.length < 2) {
  console.log('\nFEWER THAN TWO THEMES PARSED — this comparison would be vacuous. Check the parser.\n');
  process.exit(1);
}

// The model, from status/model.json's formulas. ASPECT is the script value (see MODEL.md's
// disagreement note); the themes declare 1.45 and the difference is 0.03px of span.
const ASPECT = 73.5 / 50.7;
const SPAN_BUDGET = 436.0; // innerH - deskMinusCard - kMinusCard - fanChrome - fanRowGap
const c = (s, strip) => 4 * ASPECT + strip * (s - 2);
const toothAt = (s, strip) => SPAN_BUDGET / c(s, strip);
const marginFor = (s, w, strip) => SPAN_BUDGET - c(s, strip) * w;
const binAt = (w, strip) => {
  let b = 2;
  for (let s = 2; s <= 16; s += 1) if (marginFor(s, w, strip) >= 0) b = s;
  return b;
};

// ---------------------------------------------------------------- the depth distribution
// s = d1 + d2, the summed depth of the deepest column on each of the two fan lines. The
// deal is a uniform 27-card subset of the 108-card shoe over 15 value classes; this is the
// same sampler fan-height-distribution.mjs uses, reduced to the one statistic needed here.
const CLASS_SIZES = [...Array(12).fill(8), 8, 2, 2];
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// THE REVEAL BUDGET (M0). stackOffsetW(n, strip) = min(strip, 2.95/(n-1)), so a column of n
// reveals min(strip*(n-1), 2.95) card widths in total — a fixed budget spread over the
// reveals once the strip would exceed it. It binds at n >= 5 for a 0.841 strip and NEVER for
// 0.42, because a value class holds at most 8 copies and 0.42 * 7 = 2.94 against 2.95.
//
// So the model's `stripW*(s-2)` term is EXACT for lacquer and overstates any theme whose
// strip reaches the budget. Found by a per-deal point-prediction test against 16 measured
// span deltas: the linear form was off by a full lattice step on every deal holding a
// depth-5 column, the capped form fits all 16 within 0.10px.
//
// It also breaks a property the rest of this model leans on: with the budget binding,
// feasibility is NOT a function of s = d1 + d2 alone. (5,1) and (4,2) are both s = 6 and can
// land on opposite sides. The "marginal bin" framing is a LACQUER property.
const BUDGET = 2.95;
const reveal = (n, strip) => (n <= 1 ? 0 : Math.min(strip * (n - 1), BUDGET));

/** The per-line depth PAIRS, which the capped model needs and s alone cannot supply. */
function pairDistribution(lineCap, samples, seed) {
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < samples; i += 1) {
    const shoe = [];
    for (let cl = 0; cl < CLASS_SIZES.length; cl += 1) {
      for (let k = 0; k < CLASS_SIZES[cl]; k += 1) shoe.push(cl);
    }
    const per = new Array(CLASS_SIZES.length).fill(0);
    for (let d = 0; d < 27; d += 1) {
      const j = d + Math.floor(rand() * (shoe.length - d));
      const t = shoe[d];
      shoe[d] = shoe[j];
      shoe[j] = t;
      per[shoe[d]] += 1;
    }
    const cols = per.filter((n) => n > 0);
    const l1 = cols.slice(0, lineCap);
    const l2 = cols.slice(lineCap);
    out.push([l1.length === 0 ? 0 : Math.max(...l1), l2.length === 0 ? 0 : Math.max(...l2)]);
  }
  return out;
}

/** Share of deals whose fan does NOT fit, under the CAPPED model. */
function rateFor(pairs, w, strip) {
  const room = SPAN_BUDGET / w - 4 * ASPECT;
  let bad = 0;
  for (const [d1, d2] of pairs) if (reveal(d1, strip) + reveal(d2, strip) > room) bad += 1;
  return (100 * bad) / pairs.length;
}

function depthDistribution(lineCap, samples, seed) {
  const rand = mulberry32(seed);
  const counts = new Map();
  for (let i = 0; i < samples; i += 1) {
    const shoe = [];
    for (let cl = 0; cl < CLASS_SIZES.length; cl += 1) {
      for (let k = 0; k < CLASS_SIZES[cl]; k += 1) shoe.push(cl);
    }
    const per = new Array(CLASS_SIZES.length).fill(0);
    for (let d = 0; d < 27; d += 1) {
      const j = d + Math.floor(rand() * (shoe.length - d));
      const t = shoe[d];
      shoe[d] = shoe[j];
      shoe[j] = t;
      per[shoe[d]] += 1;
    }
    const cols = per.filter((n) => n > 0);
    const l1 = cols.slice(0, lineCap);
    const l2 = cols.slice(lineCap);
    const d1 = l1.length === 0 ? 0 : Math.max(...l1);
    const d2 = l2.length === 0 ? 0 : Math.max(...l2);
    const s = d2 === 0 ? d1 : d1 + d2;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
}
const SAMPLES = Number(process.env.SAMPLES ?? 200_000);
const atMost = (dist, K) => {
  let n = 0;
  for (const [s, k] of dist) if (s <= K) n += k;
  return n / SAMPLES;
};

// ---------------------------------------------------------------- L0a.1: K as a percentile
console.log('=== L0a.1: WHAT THE DEPTH FLOOR K ACTUALLY CLAIMS ===');
console.log('  "depth <= K must fit" is a percentile of the hand distribution. Stating it that');
console.log('  way is what lets a person rule on it; "K = 10" is not a sentence anyone can weigh.\n');
console.log('  K    P(depth <= K), by per-line capacity');
console.log('       cap 8      cap 9      cap 10');
const dists = /** @type {Record<number, Map<number, number>>} */ ({ 8: depthDistribution(8, SAMPLES, 20260727), 9: depthDistribution(9, SAMPLES, 20260727), 10: depthDistribution(10, SAMPLES, 20260727) });
for (const K of [8, 9, 10, 11]) {
  console.log(
    `  ${String(K).padStart(2)}   ` +
      [8, 9, 10].map((cap) => `${(100 * atMost(dists[cap], K)).toFixed(2)}%`.padStart(9)).join('  '),
  );
}
console.log(
  `\n  modelled, ${SAMPLES.toLocaleString()} deals, lacquer, inner height 664, following state.\n` +
    '  The holdout validated bins with expected count >= 5, i.e. s <= 9; K = 10 extends one bin\n' +
    '  past that and is recorded as a product policy rather than as a validated bound.',
);

// ---------------------------------------------------------------- L0a.2: setback in span
console.log('\n=== L0a.2: SETBACK, IN A UNIT A PERSON CAN REASON ABOUT ===');
console.log('  A tooth sits at w_s = 436.0 / c(s), and 436.0 is the span budget, so the tooth moves');
console.log('  1/c(s) px of card per px of span. Multiplying a card setback by c(s) therefore gives');
console.log('  the SPAN GROWTH the option tolerates before it loses a depth bin.\n');
console.log('  option   cardW   bin   setback (card)   tolerates (span)   then bin   which is');
for (const [label, w] of [['B', 48.15], ['D', 46.1], ['D', 46.51], ['D', 47.1]]) {
  const b = binAt(w, 0.42);
  const sb = toothAt(b, 0.42) - w;
  const dist = dists[b >= 10 ? 10 : 9];
  console.log(
    `  ${label.padEnd(7)}  ${w.toFixed(2)}   ${String(b).padStart(3)}   ${sb.toFixed(2).padStart(14)}   ` +
      `${(sb * c(b, 0.42)).toFixed(1).padStart(16)}px   ${String(b - 1).padStart(8)}   ` +
      `${(100 * (1 - atMost(dist, b - 1))).toFixed(2)}% modelled`,
  );
}
console.log(
  '\n  THIS COLUMN IS margin(s*, w), THE QUANTITY K0 REMOVED FROM THE GATE, and that is not a\n' +
    '  contradiction — it is the distinction K0 drew, used correctly. margin(s*, w) is a valid\n' +
    '  measure of ROBUSTNESS TO SPAN GROWTH at the current bin, and an invalid measure of the\n' +
    '  FAILURE RATE, because across a band edge it moves opposite to the rate. Ranking options\n' +
    '  by it is the bug. Using it to break a tie among options that ALREADY pass the depth\n' +
    '  floor is exactly what it measures.\n' +
    '\n  And a setback is only half a risk: what matters with it is what is on the other side.\n' +
    "  B tolerates the most span AND lands in the worst place when it runs out. D's degraded\n" +
    "  state is B's CURRENT state.",
);

// ---------------------------------------------------------------- L1: the themes
console.log('\n=== L1: THE MODEL AT EVERY SHIPPING THEME ===');
console.log('  theme            stripW   source');
for (const t of THEMES) console.log(`  ${t.id.padEnd(16)} ${String(t.strip).padStart(6)}   ${t.file}`);

console.log('\n  c(s) by theme — the coefficient the whole model turns on');
console.log('  s    ' + THEMES.map((t) => t.id.padStart(16)).join(''));
for (const s of [6, 7, 9, 10]) {
  console.log(`  ${String(s).padStart(2)}   ` + THEMES.map((t) => c(s, t.strip).toFixed(3).padStart(16)).join(''));
}

// EVALUATED AT THE CARD'S OWN PER-LINE CAPACITY, not at a fixed one. The horizontal pitch is
// theme-independent (the column margin is a fraction of the shared card token), so capacity
// is a function of the card and the viewport only — but it still changes how columns split
// across lines and therefore the depth distribution, and at the shallow depths cinnabar
// lands in that difference is large. A fixed capacity understated cinnabar by ten points in
// the first draft of this file.
const REF_WIDTH = Number(process.env.REF_WIDTH ?? 390);
const ROW_CHROME = 48.0;
const capacityAt = (w) => Math.floor((REF_WIDTH - ROW_CHROME - 0.3 * w) / (0.7 * w));
const pairs = {};
console.log(`\n  Share of deals that do NOT fit, inner ${REF_WIDTH} wide, at the card's own capacity`);
console.log('  The LINEAR column is the model as it stood; the CAPPED column is it corrected.');
console.log('  cardW   cap   ' + THEMES.map((t) => `${t.id}: linear / capped`.padStart(34)).join(''));
for (const w of [50.7, 48.15, 46.51, 44.0]) {
  const cap = capacityAt(w);
  if (pairs[cap] === undefined) pairs[cap] = pairDistribution(cap, SAMPLES, 20260727);
  if (dists[cap] === undefined) dists[cap] = depthDistribution(cap, SAMPLES, 20260727);
  const cells = THEMES.map((t) => {
    const lin = 100 * (1 - atMost(dists[cap], binAt(w, t.strip)));
    const cp = rateFor(pairs[cap], w, t.strip);
    return `${lin.toFixed(1)}% / ${cp.toFixed(1)}%`.padStart(34);
  });
  console.log(`  ${w.toFixed(2)}   ${String(cap).padStart(3)}   ` + cells.join(''));
}
console.log(
  '\n  The two columns are identical for lacquer, because the budget never binds there.\n' +
    '  Where they differ, the CAPPED column is the one to quote.',
);

console.log('\n  What card each theme would need to reach a given depth floor:');
console.log('  K    ' + THEMES.map((t) => t.id.padStart(16)).join(''));
for (const K of [9, 10]) {
  console.log(`  ${String(K).padStart(2)}   ` + THEMES.map((t) => `${toothAt(K, t.strip).toFixed(2)}px`.padStart(16)).join(''));
}
const lac = THEMES.find((t) => t.id === 'lacquer');
const cin = THEMES.find((t) => t.id !== 'lacquer');
if (lac !== undefined && cin !== undefined) {
  const needed = (SPAN_BUDGET / 46.51 - 4 * ASPECT) / 8;
  console.log(
    `\n  STRUCTURAL, NOT A TUNING PROBLEM. For ${cin.id} to reach K=10 at a usable card it would\n` +
      `  need stripW <= ${needed.toFixed(3)} at cardW 46.51 — which is essentially lacquer's ${lac.strip}. The\n` +
      `  theme's defining visual property IS its strip: it shows ${cin.strip} of each covered card where\n` +
      `  lacquer shows ${lac.strip}, and that is what its vertical rank+suit column needs. So the strip and\n` +
      `  a two-line fan cannot both hold at any card size anyone would ship.`,
  );
}
