// HOW OFTEN DOES THE FAN GET TALL? — the frequency half of the structural bound.
//
// scripts/derive-fan-bound.mjs proves fanHeight <= 465.1px at inner 390px wide.
// A bound alone is not a decision input: practice 14's corollary says report the
// margin AND the case's frequency, so "it does not fit" is never recorded without
// "…against a case that arrives 1 deal in N". This computes N.
//
// NO BROWSER, NO ENGINE IMPORT. fanHeight depends on the hand only through the
// per-class CARD COUNTS, and the deal is a uniform 27-card subset of the 108-card
// two-deck shoe. So the distribution is a sampling problem over class counts, and
// the geometry is the measured formula from derive-fan-bound.mjs:
//
//     lineHeight(d) = CARD_H + STEP * (d - 1)
//     fanHeight     = CHROME + lineHeight(d1) + ROW_GAP + lineHeight(d2)
//
// where d1, d2 are the deepest columns on each of the two visual lines.
//
// THE CLASS STRUCTURE, which is what makes this exact rather than a model:
//   12 non-level natural ranks x 8 copies (2 decks x 4 suits) = 96
//    1 level class            x 8 copies                      =  8
//    small joker              x 2                             =  2
//    big joker                x 2                             =  2
//                                                        total 108, in 15 classes
// A COLUMN is a run of equal levelValue (groupHandColumns, HandFan.tsx:155), so a
// class present in the hand is exactly one column, and columns are ordered by
// value. Lines fill greedily at LINE_CAP columns.
//
// Run: node scripts/fan-height-distribution.mjs   (SAMPLES=200000 by default)

// Geometry measured at inner 390px wide, lacquer, by derive-fan-bound.mjs.
// Stated as data with their provenance rather than inlined into the arithmetic,
// because they are viewport- and theme-scoped and a reader must be able to see
// that (practice 15).
const MEASURED = {
  viewport: 'inner 390 wide, lacquer, zh-Hant',
  CARD_H: 73.5,
  STEP: 21.3, // stackOffsetW(n, 0.42) * cardW = 0.42 * 50.7
  CHROME: 13.9,
  ROW_GAP: 6,
  LINE_CAP: 9, // floor(rowContentWidth / pitch) = floor(326.8 / 35.5), measured
};

// J0a — A COUNTERFACTUAL CARD SIZE, WITHOUT DISTURBING THE VALIDATED RUN.
//
// The card-scale decision needs this distribution at a card the product does not ship yet,
// at a viewport width whose CAPACITY differs (8 columns per line at 360px, against the 9
// this was validated at). An 8/7 split is more balanced than 9/6, and a balanced split
// raises d1 + d2, so the rate cannot be assumed to carry across.
//
// The counterfactual is a SEPARATE BRANCH rather than a rewrite of the constants. With
// CARD_W unset this file executes exactly the arithmetic prereg-fan-model.md and
// prereg-descending-holdout.md validated — same literals, same histogram bin edges, same
// numbers. Deriving 21.3 as 0.42 * 50.7 = 21.294 would have moved a bin edge by 0.08px
// over 14 steps and quietly desynchronised the run from its own held-out test.
const ASPECT = 73.5 / 50.7; // .gd-card is calc(var(--gd-cardw) * 1.45); measured 73.5 at 50.7
const CARD_W = process.env.CARD_W === undefined ? null : Number(process.env.CARD_W);
const SIM_WIDTH = Number(process.env.SIM_WIDTH ?? 390);
const ROW_CHROME = 48.0; // contentW = W - 48.0 - 0.3*cardW (cardw-gate.mjs, calibrated)
const GEOM =
  CARD_W === null
    ? MEASURED
    : {
        viewport: `DERIVED for cardW ${CARD_W}px at inner ${SIM_WIDTH} wide, lacquer`,
        CARD_H: Math.round(ASPECT * CARD_W * 100) / 100,
        STEP: Math.round(0.42 * CARD_W * 100) / 100,
        CHROME: MEASURED.CHROME, // the fan's own padding: not card-scaled (F5a)
        ROW_GAP: MEASURED.ROW_GAP,
        LINE_CAP: Math.floor((SIM_WIDTH - ROW_CHROME - 0.3 * CARD_W) / (0.7 * CARD_W)),
      };
const SAMPLES = Number(process.env.SAMPLES ?? 200_000);
const HAND = Number(process.env.HAND_SIZE ?? 27);

// The shoe as class sizes. Index order is value order: 12 non-level naturals
// (ascending), then the level class, then SJ, then BJ.
const CLASS_SIZES = [...Array(12).fill(8), 8, 2, 2];
const TOTAL = CLASS_SIZES.reduce((a, b) => a + b, 0);
if (TOTAL !== 108) throw new Error(`shoe is ${TOTAL}, expected 108`);

const lineHeight = (d) => GEOM.CARD_H + GEOM.STEP * (d - 1);
const fanHeight = (d1, d2) =>
  Math.round((GEOM.CHROME + lineHeight(d1) + GEOM.ROW_GAP + lineHeight(d2)) * 10) / 10;

/** Deal a hand as per-class counts: a uniform HAND-card subset of the shoe. */
function dealCounts(rand) {
  // Build the shoe as class indices, shuffle a prefix, and count. Partial
  // Fisher-Yates over HAND draws is exact and costs HAND swaps, not 108.
  const shoe = [];
  for (let c = 0; c < CLASS_SIZES.length; c += 1) {
    for (let k = 0; k < CLASS_SIZES[c]; k += 1) shoe.push(c);
  }
  const counts = new Array(CLASS_SIZES.length).fill(0);
  for (let i = 0; i < HAND; i += 1) {
    const j = i + Math.floor(rand() * (shoe.length - i));
    const t = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = t;
    counts[shoe[i]] += 1;
  }
  return counts;
}

/** The two lines' deepest columns, for a given column ORDER. */
function lineDepths(counts, descending) {
  const cols = [];
  for (let c = 0; c < counts.length; c += 1) if (counts[c] > 0) cols.push(counts[c]);
  if (descending) cols.reverse();
  const line1 = cols.slice(0, GEOM.LINE_CAP);
  const line2 = cols.slice(GEOM.LINE_CAP);
  return {
    columns: cols.length,
    d1: line1.length === 0 ? 0 : Math.max(...line1),
    d2: line2.length === 0 ? 0 : Math.max(...line2),
  };
}

// A tiny deterministic PRNG so the run is reproducible and Math.random is not
// needed. mulberry32.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(Number(process.env.SEED ?? 20260727));

// Which ordering the RATE is computed at. 'ascending' matched the n=120 in-browser
// measurement most closely; both are within its interval and the difference between
// them (7.7% vs 9.3%) is smaller than the interval's width.
const ORDER = process.env.ORDER ?? 'ascending';
const hist = new Map();
const boundHist = new Map();
let max = 0;
let maxAt = null;
let twoLines = 0;
for (let i = 0; i < SAMPLES; i += 1) {
  const counts = dealCounts(rand);
  // ORDERING: A BOUND AND A RATE NEED DIFFERENT ANSWERS, AND CONFLATING THEM WAS
  // THIS MODEL'S ERROR. The player can toggle sort order, so a BOUND must hold at
  // the taller of the two. But at any given moment the browser renders exactly ONE
  // ordering, so a RATE that scores every deal at its taller ordering counts a
  // height the player is not looking at. Measured n=120 in-browser (W1b): the
  // empirical distribution matched the single-ordering model bin for bin and
  // rejected the max-over-orderings one — 252.1px was 30.8% observed against 17.0%
  // predicted, and 294.7px was 20.0% against 30.5%. The max-over form inflated the
  // headline rate from ~9% to 13.14%.
  const a = lineDepths(counts, false);
  const b = lineDepths(counts, true);
  const ha = a.d2 === 0 ? fanHeight(a.d1, 1) - lineHeight(1) - GEOM.ROW_GAP : fanHeight(a.d1, a.d2);
  const hb = b.d2 === 0 ? fanHeight(b.d1, 1) - lineHeight(1) - GEOM.ROW_GAP : fanHeight(b.d1, b.d2);
  // RATE uses one ordering; BOUND uses the taller. Both are tracked.
  const h = Math.round((ORDER === 'descending' ? hb : ha) * 10) / 10;
  const hBound = Math.round(Math.max(ha, hb) * 10) / 10;
  boundHist.set(hBound, (boundHist.get(hBound) ?? 0) + 1);
  if (a.d2 > 0 || b.d2 > 0) twoLines += 1;
  hist.set(h, (hist.get(h) ?? 0) + 1);
  if (h > max) {
    max = h;
    maxAt = { counts: [...counts], a, b };
  }
}

const STRUCTURAL_MAX = fanHeight(8, 8);
console.log(`=== FAN HEIGHT DISTRIBUTION (${SAMPLES.toLocaleString()} simulated ${HAND}-card deals) ===`);
console.log(`    geometry: ${GEOM.viewport}; measured by scripts/derive-fan-bound.mjs.`);
console.log(
  `    lineHeight(d) = ${GEOM.CARD_H} + ${GEOM.STEP}(d-1);  fanHeight = ` +
    `${GEOM.CHROME} + lineHeight(d1) + ${GEOM.ROW_GAP} + lineHeight(d2);  line cap ${GEOM.LINE_CAP} columns.`,
);
console.log(
  `    RATE scored at the ${ORDER} ordering (one ordering renders at a time).\n` +
    `    The BOUND separately uses the taller of the two, since the player can toggle.\n` +
    `    VALIDATED against n=120 in-browser: see docs/research/prereg-fan-model.md.\n`,
);

const heights = [...hist.keys()].sort((a, b) => a - b);
let cum = 0;
console.log('  fanHeight   deals        share      P(>= this)');
for (const h of heights) {
  const n = hist.get(h);
  const atLeast = SAMPLES - cum;
  console.log(
    `  ${String(h).padStart(7)}px  ${String(n).padStart(8)}  ${((100 * n) / SAMPLES).toFixed(4).padStart(9)}%  ` +
      `${((100 * atLeast) / SAMPLES).toFixed(4).padStart(9)}%` +
      (atLeast < SAMPLES ? `   1 in ${Math.round(SAMPLES / atLeast).toLocaleString()}` : ''),
  );
  cum += n;
}

console.log(`\n  two visual lines on ${((100 * twoLines) / SAMPLES).toFixed(2)}% of deals`);
console.log(`  observed maximum over the simulation: ${max}px`);
console.log(`  STRUCTURAL maximum (derive-fan-bound.mjs): ${STRUCTURAL_MAX}px`);
if (max < STRUCTURAL_MAX) {
  console.log(
    `  => the structural case is ${Math.round((STRUCTURAL_MAX - max) * 10) / 10}px above anything ` +
      `${SAMPLES.toLocaleString()} deals produced, so its frequency is below ~1 in ${SAMPLES.toLocaleString()}.`,
  );
}

// WHAT THE SPAN AND SLACK ARE, per height — the figure the decision actually
// needs. K uses the well-present (larger) value; desk uses its saturated max.
// Both terms carry ONE card height each (F5a decomposed both to 0px residual):
// deskH = 83.0 + aspect*w and K_well = 125.1 + aspect*w. K_LEAD carries none — the
// card in K_well lives inside the 132.5px well, which is exactly what is absent
// when the viewer leads. So a counterfactual card size scales the first two and
// leaves the third alone.
const cardTerm = CARD_W === null ? 73.5 : Math.round(ASPECT * CARD_W * 100) / 100;
const K_WELL = Math.round((125.1 + cardTerm) * 10) / 10;
// DESK MAXIMUM, BY ROOM TIMING — an axis no gate had ever varied. Every driver in
// this repo creates an UNTIMED room, while the product's DEFAULT is
// TIMING_PRESETS.standard (45s/90s). A timed room renders the desk's countdown
// bar, worth +8.0px, so every desk figure recorded before 2026-07-27 describes a
// configuration most rooms are not in. Both are measured (derive-span.mjs).
const DESK = {
  untimed: Math.round((83.0 + cardTerm - 8.0) * 10) / 10,
  timed: Math.round((83.0 + cardTerm) * 10) / 10,
};
const DESK_MAX = DESK.timed;
// THE POPULATION SPLIT. K is 198.6px when the trick well renders and 66.0px when
// the viewer LEADS and it is empty, and that 132.5px IS the well. So a leading
// state carries 132.5px more slack than a following one, and a single pooled rate
// averages a population that can essentially never fail with the one that can —
// practice 16's shape at the population level. The FOLLOW rate is the number a
// decision needs; the pooled rate is only reportable alongside it.
const K_LEAD = 66.0;
const rateFor = (innerH, K, desk = DESK_MAX) => {
  let bad = 0;
  for (const h of heights) if (h + desk + K > innerH) bad += hist.get(h);
  return bad;
};
const pct = (bad) => {
  const r = (100 * bad) / SAMPLES;
  // Never print a nonzero rate as "0.00%" — a floor property rounded to zero is
  // exactly the misreport practice 16 exists to prevent.
  if (bad === 0) return '     0%';
  return r < 0.01 ? `<0.01%` : `${r.toFixed(2)}%`;
};
console.log(`\n=== SLACK, panel profile, staged desk (span = fanH + deskMax + K) ===`);
console.log(`    FOLLOWING: K = ${K_WELL}px (the trick well renders).  LEADING: K = ${K_LEAD}px (well empty, 0x0).`);
console.log(`\n  viewport                        FOLLOWING            LEADING          structural worst slack (follow)`);
for (const [tlabel, desk] of [['TIMED (the product default, 45s/90s)', DESK.timed], ['untimed (what every gate measured)', DESK.untimed]]) {
  console.log(`\n  --- ${tlabel}: desk max ${desk}px ---`);
  // THE WIDTH IN THESE LABELS IS THE SIMULATED ONE, NOT A LITERAL 390. Under a
  // counterfactual card size the run's LINE_CAP comes from SIM_WIDTH, so a hardcoded
  // "390x664" would name a viewport the row does not describe — the same mislabel class
  // as a desk figure recorded in a configuration nobody is in.
  for (const [label, innerH] of [
    [`${SIM_WIDTH}x664 (toolbars)`, 664],
    [`${SIM_WIDTH}x748 (minimized)`, 748],
    ['1366x681 (maximized laptop)', 681],
  ]) {
    const bf = rateFor(innerH, K_WELL, desk);
    const bl = rateFor(innerH, K_LEAD, desk);
    const structuralSlack = Math.round((innerH - (STRUCTURAL_MAX + desk + K_WELL)) * 10) / 10;
    console.log(
      `  ${label.padEnd(30)} ${pct(bf).padStart(8)}` +
        (bf > 0 ? ` (1 in ${String(Math.round(SAMPLES / bf)).padStart(6)})` : '            ') +
        `  ${pct(bl).padStart(8)}` +
        (bl > 0 ? ` (1 in ${String(Math.round(SAMPLES / bl)).padStart(6)})` : '            ') +
        `   ${structuralSlack > 0 ? '+' : ''}${structuralSlack}px`,
    );
  }
}
console.log(
  `\n  A pooled rate over both populations would sit BELOW the following-state rate by the\n` +
    `  share of leading turns, and would describe no player's actual situation. Report both.`,
);
// CAVEAT ON THE 1366 ROW, found while making the labels honest and recorded rather than
// propagated. The histogram is built ONCE, with the line cap of the simulated width, so
// the 1366x681 row applies a ${GEOM.LINE_CAP}-column line cap to a viewport whose own cap
// is far larger (a 1366-wide desktop clamps the card to 68px and fits every value class on
// ONE line). That row therefore describes a NARROW WINDOW at 681px tall, not a maximized
// 1366-wide desktop. Fixing it needs a second simulation, not a relabel, so it is stated
// here instead of being quietly carried.
console.log(
  `\n  CAVEAT: the 1366 row uses this run's ${GEOM.LINE_CAP}-column line cap. A 1366-wide\n` +
    `  desktop has a far larger cap and fits one line, so read that row as a NARROW window\n` +
    `  at 681px tall. The label names the height honestly and the width only by convention.`,
);
console.log(
  `\n  NOTE THE TWO DIFFERENT CLAIMS. The percentage is how often the CURRENT layout fails;\n` +
    `  the structural slack is what a bound must survive. A change that clears the percentage\n` +
    `  and not the bound is a change whose failure rate is merely small, and must say so.`,
);
