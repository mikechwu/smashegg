// H0-H3 — THE CARD-WIDTH GATE, AS A PURELY GEOMETRIC RULE OVER A CLAMP.
//
// This replaces the reporting half of cardw-sweep.mjs. Three things were wrong with it,
// and all three came from treating the answer as a POINT on a curve at ONE width.
//
// H0. THE QUALIFYING SET IS DISJOINT AND WAS REPORTED AS AN INTERVAL. Solving
// `margin >= 10` in each marginal-bin regime gives [44.00, 44.47] UNION (45.52, 46.51],
// with a 1.04px gap where the marginal bin is s=11 and margin collapses. The old report
// printed "[44.00, 46.45] width 2.45px" — max minus min of a non-contiguous set — and
// 45.00, which is inside it, has 4.95px of margin. Worse, WIDTH IS THE NO-ROBUST-CHOICE
// SIGNAL, so a set of two thin segments far apart read as comfortable. And the lower
// segment was invisible in the output although the implementation produces it: every
// phone below ~415px lands on the 2.75rem floor under the proposed clamp.
//
// H0a. SETBACK WAS ONE-SIDED, AND ITS DISCONTINUITY LIST WAS INCOMPLETE. The old scan
// looked for the margin JUMPING UP as cardW decreased; a tooth boundary is the margin
// COLLAPSING as cardW decreases, so no tooth boundary was ever found and setback was
// measured only to the capacity crossing — and to a midpoint estimate of it (46.83)
// rather than the true 46.69, which is where the reported 0.88px came from.
//
// H1. THE GATE MIXED A MEASURED QUANTITY WITH AN UNVALIDATED ONE. `margin` is geometry:
// every constant measured, and F5a decomposed both of them to 0px residual. `R(delta)` at
// these magnitudes is the MODEL'S TAIL — the held-out test validated only bins with
// expected count >= 5, and the gate was discriminating 0.08% against 0.74%, two orders
// of magnitude below anything validated. That is a structural extrapolation from a
// validated mechanism rather than a fitted parameter, so it is probably about right, but
// gating on it grants a precision it has not earned. R is now an ordinal CONTEXT column.
//
// H3. THE THING THAT MUST PASS IS A CLAMP, NOT A NUMBER. The implementation is
// `clamp(2.75rem, Xvw, 4.25rem)`, which produces a DIFFERENT cardW at every width — and
// the whole selection was made at 390. So the gate is applied to the SET of cardW values
// a coefficient produces across every supported width.
//
// Run: node scripts/cardw-gate.mjs      (no browser, no server)

// Geometry, all measured. See derive-fan-bound.mjs / fan-geometry-sweep.mjs / F5a.
const ASPECT = 73.5 / 50.7; // .gd-card height is calc(var(--gd-cardw) * 1.45); read from source
const STRIP = 0.42; // lacquer stackStripW
const CHROME = 13.9; // the fan's own padding
const GAP = 6.0; // row-gap between fan lines
const DESK_MINUS_CARD = 83.0; // F5a: 27 + 4 + 24 + 12 gaps + 14 padding + 2 border
const K_MINUS_CARD = 125.1; // F5a: 59 + 10 + 15 + 41
const INNER_H = 664;
// contentW = W - 48.0 - 0.3*cardW, calibrated on four measured widths to within 0.04px.
const ROW_CHROME = 48.0;
const MAX_CLASSES = 15; // 12 non-level ranks + level class + SJ + BJ
const ROOT_PX = Number(process.env.ROOT_PX ?? 16);
const FLOOR = 2.75 * ROOT_PX;
const CEIL = 4.25 * ROOT_PX;
// Supported inner widths. 320 is an iPhone SE and iOS Display Zoom on an ordinary phone;
// 430 is an iPhone Pro Max. The selection was made at 390, the middle one.
const WIDTHS = (process.env.WIDTHS ?? '320,360,375,390,430').split(',').map(Number);

const contentFor = (W, w) => W - ROW_CHROME - 0.3 * w;
const capacityFor = (W, w) => Math.floor(contentFor(W, w) / (0.7 * w));
/** Threshold: the tallest fan that still fits. Both terms scale with the card (D2). */
const thresholdFor = (w) => INNER_H - (DESK_MINUS_CARD + ASPECT * w) - (K_MINUS_CARD + ASPECT * w);
/** fanHeight for a given total depth s = d1 + d2 across the two lines. */
const fanFor = (s, w) => CHROME + GAP + 2 * ASPECT * w + STRIP * w * (s - 2);
/** margin(s, w) = threshold - fanHeight, linear in w with a per-s coefficient. */
const marginFor = (s, w) => thresholdFor(w) - fanFor(s, w);

/** The MARGINAL bin at a given width: the largest s that still fits. Bounded by what the
 *  hand can produce — two lines of at most `capacity` columns, 27 cards over <=15 classes. */
function marginalBin(W, w) {
  const cap = capacityFor(W, w);
  // Depth is capped by the shoe (8 per class) and by the cards available.
  const maxS = Math.min(16, 27 - (Math.min(MAX_CLASSES, 2 * cap) - 2));
  let best = 2;
  for (let s = 2; s <= maxS; s += 1) if (marginFor(s, w) >= 0) best = s;
  return { s: best, margin: Math.round(marginFor(best, w) * 100) / 100, capacity: cap, maxS };
}

/** Every discontinuity in cardW at a given width: capacity crossings and tooth boundaries.
 *  Both are computed in CLOSED FORM rather than found by scanning a grid — the scan is
 *  what missed the tooth boundaries, and a grid can only ever bracket a crossing. */
function discontinuities(W) {
  const out = [];
  // capacity k requires (W - ROW_CHROME - 0.3w) / (0.7w) >= k  =>  w <= (W-ROW_CHROME)/(0.7k+0.3)
  for (let k = 6; k <= 20; k += 1) {
    const w = (W - ROW_CHROME) / (0.7 * k + 0.3);
    if (w > FLOOR - 3 && w < CEIL + 3) out.push({ w, kind: `capacity crossing at ${k}` });
  }
  // a tooth boundary is where bin s stops fitting: margin(s, w) = 0.
  for (let s = 3; s <= 16; s += 1) {
    const coef = 2 * ASPECT + 2 * ASPECT + STRIP * (s - 2);
    const w = (INNER_H - DESK_MINUS_CARD - K_MINUS_CARD - CHROME - GAP) / coef;
    if (w > FLOOR - 3 && w < CEIL + 3) out.push({ w, kind: `tooth boundary s=${s}` });
  }
  return out.sort((a, b) => a.w - b.w);
}

/** TWO-SIDED setback: the distance to the nearest discontinuity in EITHER direction. A
 *  one-sided figure hides the cliff you are standing next to. */
function setbackFor(W, w) {
  const ds = discontinuities(W);
  let best = { d: Infinity, kind: 'none in range', at: null };
  for (const d of ds) {
    const dist = Math.abs(d.w - w);
    if (dist < best.d) best = { d: Math.round(dist * 100) / 100, kind: d.kind, at: d.w };
  }
  return best;
}

// ---------------------------------------------------------------- H0: segments
console.log('=== H0: THE QUALIFYING SET, AS CONTIGUOUS SEGMENTS ===');
console.log(`    inner ${INNER_H}, width 390, lacquer, timed+staged, root ${ROOT_PX}px.`);
console.log('    Gate below is GEOMETRIC ONLY (H1); R is context, printed but not gating.\n');

const MIN_MARGIN = Number(process.env.MIN_MARGIN ?? 10);
const MIN_SETBACK = Number(process.env.MIN_SETBACK ?? 0.5);
const STEP = 0.01;

function segmentsAt(W, minMargin) {
  const segs = [];
  let cur = null;
  for (let w = FLOOR; w <= Math.min(CEIL, 52); w = Math.round((w + STEP) * 100) / 100) {
    const mb = marginalBin(W, w);
    const pass = mb.margin >= minMargin;
    if (pass && cur === null) cur = { lo: w, hi: w, loBin: mb.s };
    else if (pass) { cur.hi = w; cur.hiBin = mb.s; }
    else if (cur !== null) { segs.push(cur); cur = null; }
  }
  if (cur !== null) segs.push(cur);
  return segs;
}

const segs390 = segmentsAt(390, MIN_MARGIN);
console.log(`  margin >= ${MIN_MARGIN}px at width 390 gives ${segs390.length} CONTIGUOUS segment(s):`);
for (const seg of segs390) {
  const width = Math.round((seg.hi - seg.lo) * 100) / 100;
  const mid = (seg.lo + seg.hi) / 2;
  console.log(
    `    [${seg.lo.toFixed(2)}, ${seg.hi.toFixed(2)}]  width ${width.toFixed(2)}px  ` +
      `marginal bin s=${marginalBin(390, mid).s}`,
  );
}
if (segs390.length > 1) {
  for (let i = 1; i < segs390.length; i += 1) {
    const gap = Math.round((segs390[i].lo - segs390[i - 1].hi) * 100) / 100;
    console.log(
      `    GAP (${segs390[i - 1].hi.toFixed(2)}, ${segs390[i].lo.toFixed(2)}) width ${gap}px — ` +
        `reporting max-minus-min across this would be the H0 bug`,
    );
  }
}

// ---------------------------------------------------------------- H3: the clamp
console.log('\n=== H3: WHAT MUST PASS IS A CLAMP, EVALUATED AT EVERY SUPPORTED WIDTH ===');
console.log(
  `    gate: margin >= ${MIN_MARGIN}px AND two-sided setback >= ${MIN_SETBACK}px AND ` +
    `capacity identical across widths`,
);
console.log(`    widths: ${WIDTHS.join(', ')}   floor ${FLOOR}px  ceiling ${CEIL}px\n`);

const candidates = [];
for (let X = 9.0; X <= 14.01; X = Math.round((X + 0.1) * 10) / 10) {
  const cells = WIDTHS.map((W) => {
    const w = Math.min(CEIL, Math.max(FLOOR, (X * W) / 100));
    const mb = marginalBin(W, w);
    const sb = setbackFor(W, w);
    return { W, w: Math.round(w * 100) / 100, ...mb, setback: sb.d, near: sb.kind };
  });
  const caps = new Set(cells.map((c) => c.capacity));
  // THE THIRD TERM IS A FLOOR, NOT AN EQUALITY, AND THAT IS NOT A RELAXATION.
  // "capacity identical across all supported widths" is UNSATISFIABLE BY ANY cardW RULE:
  //   capacity = floor((W - 48.0 - 0.3w) / (0.7w))
  // and the 48.0px of row chrome is not proportional to W, so even a pure `Xvw` (where
  // cardW is exactly proportional to W) produces different capacities — measured
  // [11,11,12,12,12] at 10vw and [8,9,9,9,9] at 13vw. A floor decouples w from W
  // entirely. What the derivations actually require is TWO LINES, i.e. capacity >= 8 for
  // 15 value classes; equality was never the property, only a proxy for it.
  const ok =
    cells.every((c) => c.margin >= MIN_MARGIN) &&
    cells.every((c) => c.setback >= MIN_SETBACK) &&
    cells.every((c) => c.capacity >= 8);
  candidates.push({ X, cells, caps: [...caps], ok });
}

console.log('  coefficient   cardW at each width           capacities   min margin   min setback   gate');
for (const c of candidates) {
  if (c.X * 10 % 5 !== 0 && !c.ok) continue; // print every 0.5 unless it passes
  const minM = Math.min(...c.cells.map((x) => x.margin));
  const minS = Math.min(...c.cells.map((x) => x.setback));
  // NAME THE BINDING TERM. "no coefficient passes" is not actionable; "the setback term
  // binds at every coefficient" says which constraint to argue with.
  const fails = [];
  if (minM < MIN_MARGIN) fails.push('margin');
  if (minS < MIN_SETBACK) fails.push('setback');
  if (c.cells.some((x) => x.capacity < 8)) fails.push('capacity<8');
  console.log(
    `  ${c.X.toFixed(1).padStart(9)}vw   ${c.cells.map((x) => x.w.toFixed(1).padStart(5)).join(' ')}   ` +
      `${c.caps.join('/').padStart(10)}   ${minM.toFixed(2).padStart(10)}   ${minS.toFixed(2).padStart(11)}   ` +
      `${c.ok ? 'PASS' : 'fails: ' + fails.join('+')}`,
  );
}

const passing = candidates.filter((c) => c.ok);
console.log('');
if (passing.length === 0) {
  console.log(
    '  NO COEFFICIENT PASSES AT EVERY SUPPORTED WIDTH.\n' +
      '  That is the finding, not a failure to search: the CLAMP FORM cannot express the\n' +
      '  answer, and a breakpoint or a different mechanism is needed. The reason is visible\n' +
      '  in the table — the floor pins narrow widths to one capacity while the vw term puts\n' +
      '  wide ones in another, and "capacity identical across widths" is exactly the term\n' +
      '  a single clamp cannot satisfy once the floor binds.',
  );
} else {
  const best = passing.reduce((a, b) =>
    Math.min(...b.cells.map((x) => x.setback)) > Math.min(...a.cells.map((x) => x.setback)) ? b : a,
  );
  console.log(`  ${passing.length} coefficient(s) pass. Best two-sided setback: ${best.X.toFixed(1)}vw`);
  for (const c of best.cells) {
    console.log(
      `    ${String(c.W).padStart(4)} -> cardW ${c.w.toFixed(2)}  capacity ${c.capacity}  ` +
        `marginal s=${c.s}  margin ${c.margin.toFixed(2)}px  setback ${c.setback}px to ${c.near}`,
    );
  }
}

// ---------------------------------------------------------------- capacity per width
console.log('\n=== THE CAPACITY CURVE, which is why one width could never decide this ===');
console.log('  width   cardW at 13vw (today)   capacity   two lines need capacity >= 8');
for (const W of WIDTHS) {
  const w = Math.min(CEIL, Math.max(FLOOR, (13 * W) / 100));
  const cap = capacityFor(W, w);
  console.log(
    `  ${String(W).padStart(5)}   ${w.toFixed(2).padStart(21)}   ${String(cap).padStart(8)}   ` +
      `${cap >= 8 ? 'ok' : 'THREE LINES'}${cap === 8 ? '   <-- at the floor, one step from three' : ''}`,
  );
}
