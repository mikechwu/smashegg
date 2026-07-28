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
// I0 — THE VALIDATED-BIN TERM, which H1 deleted along with the unvalidated tail.
//
// H1 removed R from the gate because discriminating 0.08% from 0.74% grants precision two
// orders below any bin the held-out test checked. That is right for choosing AMONG
// candidates and WRONG for separating today from them: today's 7.65% is the modelled
// counterpart of a MEASURED 9.17%/9.09%, squarely inside the validated region. Deleting R
// entirely removed the only term that could see the reason for the work — and under the
// purely geometric gate TODAY PASSES, with a better discontinuity setback than the
// recommended pick.
//
// The fix is to state it as a BIN INDEX rather than a probability, which needs no
// threshold and no tail extrapolation: prereg-descending-holdout.md criterion 1 validated
// bins with expected count >= 5, up to 316.0 px, which is s=9. So EVERY VALIDATED BIN MUST
// BE FEASIBLE, i.e. margin(s=9, w) >= 0.
const LAST_VALIDATED_BIN = Number(process.env.LAST_VALIDATED_BIN ?? 9);
const validatedBinFeasible = (w) => marginFor(LAST_VALIDATED_BIN, w) >= 0;
const MIN_SETBACK = Number(process.env.MIN_SETBACK ?? 0.5);
const STEP = 0.01;

function segmentsAt(W, minMargin) {
  const segs = [];
  let cur = null;
  for (let w = FLOOR; w <= Math.min(CEIL, 52); w = Math.round((w + STEP) * 100) / 100) {
    const mb = marginalBin(W, w);
    const pass = mb.margin >= minMargin && validatedBinFeasible(w);
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
    cells.every((c) => validatedBinFeasible(c.w)) &&
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


// ---------------------------------------------------------------- I3
// AN INDEPENDENT EXHAUSTIVE RECONSTRUCTION OF THE SEGMENT BOUNDARIES.
//
// The routing note for H0/H2/H3 said no external audit was needed because each is
// closed-form and brute-force verifiable. H0a was then a SIGN ERROR in a closed-form scan
// over a closed-form domain, and it survived until an outside reader found it.
//
// The principle holds — an exhaustive check does beat a second opinion — but "verifiable
// by brute force" is not "verified by brute force", and a check that is merely available
// is worth exactly what F2's pin was worth before it deliberately staged a joker. So the
// substitute for an external lineage is a SECOND DERIVATION OF THE SAME OBJECT that shares
// no algebra with the first: walk w in 0.01px steps, emit the boundaries from where the
// pass/fail flag actually changes, and assert they agree with the closed-form ones.
//
// A sign error dies on the first comparison. This runs in seconds.
console.log('\n=== I3: EXHAUSTIVE RECONSTRUCTION vs THE CLOSED FORM ===');
{
  const W = 390;
  // Closed form: a segment boundary is a tooth root, a capacity crossing, or a margin-floor
  // crossing for the bin that is marginal there.
  const closed = new Set();
  for (const d of discontinuities(W)) closed.add(Math.round(d.w * 100) / 100);
  for (let s = 3; s <= 16; s += 1) {
    const w = (436.0 - MIN_MARGIN) / (4 * ASPECT + 0.42 * (s - 2));
    if (w > FLOOR && w < 52) closed.add(Math.round(w * 100) / 100);
  }
  closed.add(Math.round((436.0 / (4 * ASPECT + 0.42 * (LAST_VALIDATED_BIN - 2))) * 100) / 100);

  // Numerical: where does the pass flag actually flip?
  const flips = [];
  let prev = null;
  for (let w = FLOOR; w <= 52; w = Math.round((w + 0.01) * 100) / 100) {
    const mb = marginalBin(W, w);
    const pass = mb.margin >= MIN_MARGIN && validatedBinFeasible(w);
    if (prev !== null && pass !== prev) flips.push(Math.round(w * 100) / 100);
    prev = pass;
  }
  console.log(`  numerical pass/fail flips: ${flips.join(', ')}`);
  const unexplained = flips.filter((f) => ![...closed].some((c) => Math.abs(c - f) <= 0.02));
  if (unexplained.length === 0) {
    console.log(
      `  every flip is within 0.02px of a closed-form boundary (${closed.size} candidates). AGREE.`,
    );
  } else {
    console.log(`  UNEXPLAINED FLIPS: ${unexplained.join(', ')} — the closed form is missing a term.`);
    process.exitCode = 1;
  }
  // NON-VACUITY: the reconstruction must be capable of disagreeing.
  const bogus = flips.filter((f) => Math.abs(f - 99.99) <= 0.02);
  if (flips.length === 0) {
    console.log('  NO FLIPS FOUND — the reconstruction examined nothing and proves nothing.');
    process.exitCode = 1;
  }
  console.log(`  (non-vacuity: ${flips.length} flips examined, ${bogus.length} matched a deliberately absent boundary)`);
}

// ---------------------------------------------------------------- J0
// THE DECISION, AND WHY IT REDUCES TO ONE WIDTH.
//
// I2 established that a SINGLE constant is capped at 46.10px by width 320, which costs
// -9.1% of card. The owner's ruling: the entire cost of that option is paid to support one
// width, so raise the minimum GUARANTEED width to 360 and send everything below it to a
// compact mode. Then segment three's optimum, 48.15px, is available, at -5.0%.
//
// TWO STRUCTURAL FACTS make "the gate at every supported width" reduce to a single check,
// and they are worth stating because they are what a per-width sweep would otherwise
// obscure:
//
//   1. `margin(s, w)` DOES NOT DEPEND ON W AT ALL. threshold and fanHeight are both
//      vertical; W enters only through `capacity`, and capacity enters the marginal bin
//      only via maxS = 27 - (min(15, 2*cap) - 2), which is 14 for EVERY cap >= 8 (2*8=16
//      already saturates the 15 value classes). So for a constant cardW, every geometric
//      term of the gate is identical at every width that clears capacity >= 8.
//   2. `capacity` is MONOTONICALLY NON-DECREASING IN W at fixed w. So the binding width
//      is the SMALLEST supported one, and checking 360 checks 375, 390, 430 and every
//      width in between.
//
// That is why this section reports a ceiling CURVE rather than a pass/fail per width: the
// curve is the whole content of "at every supported width", and the ruling is a choice of
// where to start reading it.
console.log('\n=== J0: THE CAPACITY CEILING BY WIDTH, AND WHERE A CONSTANT CAN SIT ===');
const CONSTANT = Number(process.env.CARDW ?? 48.15);
const MIN_GUARANTEED = Number(process.env.MIN_GUARANTEED_W ?? 360);
// capacity >= 8  <=>  (W - ROW_CHROME - 0.3w) / (0.7w) >= 8  <=>  W - ROW_CHROME >= 5.9w
const ceilingFor = (W) => (W - ROW_CHROME) / (0.7 * 8 + 0.3);
console.log('  width   max cardW at capacity >= 8   ratio at the constant   capacity   slack (columns)');
for (const W of [320, ...WIDTHS.filter((x) => x !== 320)]) {
  const ceil = ceilingFor(W);
  const ratio = contentFor(W, CONSTANT) / (0.7 * CONSTANT);
  const cap = capacityFor(W, CONSTANT);
  console.log(
    `  ${String(W).padStart(5)}   ${ceil.toFixed(2).padStart(26)}   ${ratio.toFixed(2).padStart(21)}   ` +
      `${String(cap).padStart(8)}   ${(ratio - 8).toFixed(2).padStart(15)}` +
      (cap < 8 ? '   <-- COMPACT MODE' : ''),
  );
}
// The crossover: the width at which the constant stops clearing capacity >= 8.
const CROSSOVER = ROW_CHROME + 5.9 * CONSTANT;
console.log(
  `\n  compact-mode crossover: W < ${ROW_CHROME} + 5.9 * ${CONSTANT} = ${CROSSOVER.toFixed(1)} CSS px.\n` +
    `  Below it capacity falls to 7 and 15 value classes need three lines.`,
);

console.log(`\n=== J0: THE CONSTANT ${CONSTANT}px AGAINST THE GEOMETRIC GATE ===`);
console.log(`  gate: margin >= ${MIN_MARGIN}px AND margin(s=${LAST_VALIDATED_BIN}) >= 0 AND capacity >= 8`);
{
  const mb = marginalBin(MIN_GUARANTEED, CONSTANT);
  // Setback, BROKEN OUT BY KIND rather than minimised into one number. A tooth boundary is
  // a FEASIBILITY cliff (a bin stops fitting); a capacity crossing at cap >= 8 only changes
  // the line SPLIT, which moves the distribution but never the pass/fail. Reporting the min
  // of the two would let a benign 11->10 crossing at width 430 read as a near miss.
  const teeth = [];
  for (let s = 3; s <= 16; s += 1) {
    const w = (INNER_H - DESK_MINUS_CARD - K_MINUS_CARD - CHROME - GAP) / (4 * ASPECT + STRIP * (s - 2));
    if (w > FLOOR - 6 && w < CEIL + 6) teeth.push({ w, s });
  }
  const nearestTooth = teeth.reduce((a, b) =>
    Math.abs(b.w - CONSTANT) < Math.abs(a.w - CONSTANT) ? b : a,
  );
  console.log(
    `  marginal bin s=${mb.s}   margin ${mb.margin.toFixed(2)}px   ` +
      `above the ${MIN_MARGIN}px floor by ${(mb.margin - MIN_MARGIN).toFixed(2)}px`,
  );
  console.log(
    `  validated bin s=${LAST_VALIDATED_BIN} feasible: ${validatedBinFeasible(CONSTANT) ? 'yes' : 'NO'}   ` +
      `(margin ${marginFor(LAST_VALIDATED_BIN, CONSTANT).toFixed(2)}px)`,
  );
  console.log(
    `  nearest FEASIBILITY cliff: tooth s=${nearestTooth.s} at ${nearestTooth.w.toFixed(2)}px, ` +
      `setback ${Math.abs(nearestTooth.w - CONSTANT).toFixed(2)}px`,
  );
  console.log('\n  width   capacity   nearest capacity crossing   distance   consequence of crossing it');
  for (const W of WIDTHS.filter((x) => x >= MIN_GUARANTEED)) {
    let near = null;
    for (let k = 6; k <= 20; k += 1) {
      const w = (W - ROW_CHROME) / (0.7 * k + 0.3);
      if (near === null || Math.abs(w - CONSTANT) < Math.abs(near.w - CONSTANT)) near = { w, k };
    }
    const cap = capacityFor(W, CONSTANT);
    console.log(
      `  ${String(W).padStart(5)}   ${String(cap).padStart(8)}   ${near.w.toFixed(2).padStart(25)}   ` +
        `${Math.abs(near.w - CONSTANT).toFixed(2).padStart(8)}   ` +
        `${near.k - 1 >= 8 ? `split ${near.k} -> ${near.k - 1} columns, still two lines` : 'THREE LINES'}`,
    );
  }
  const pass =
    mb.margin >= MIN_MARGIN &&
    validatedBinFeasible(CONSTANT) &&
    WIDTHS.filter((x) => x >= MIN_GUARANTEED).every((W) => capacityFor(W, CONSTANT) >= 8);
  console.log(`\n  GATE at every width >= ${MIN_GUARANTEED}: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) process.exitCode = 1;
}

// PRACTICE 33: an independent exhaustive reconstruction of the ceiling curve, sharing no
// algebra with it. The closed form divides; this one counts columns with the SAME floor()
// the layout uses, stepping w until capacity drops below 8. A sign or rearrangement error
// in `(W - ROW_CHROME) / 5.9` dies on the first comparison.
console.log('\n=== J0: EXHAUSTIVE RECONSTRUCTION OF THE CEILING CURVE ===');
{
  let checked = 0;
  let disagreements = 0;
  for (const W of [320, 360, 375, 390, 430]) {
    let last = null;
    for (let w = 30; w <= 80; w = Math.round((w + 0.01) * 100) / 100) {
      if (capacityFor(W, w) >= 8) last = w;
    }
    const closed = ceilingFor(W);
    const agree = Math.abs(last - closed) <= 0.011;
    checked += 1;
    if (!agree) disagreements += 1;
    console.log(
      `  ${String(W).padStart(4)}   closed form ${closed.toFixed(4)}   numerical ${last.toFixed(2)}   ` +
        `${agree ? 'AGREE' : 'DISAGREE'}`,
    );
  }
  if (checked === 0) {
    console.log('  NOTHING CHECKED — the reconstruction proves nothing.');
    process.exitCode = 1;
  }
  if (disagreements > 0) process.exitCode = 1;
  // NON-VACUITY: the comparison must be capable of failing. Feed it a deliberately wrong
  // closed form and require that it is rejected.
  const bogus = (320 - ROW_CHROME) / 5.8;
  let lastTrue = null;
  for (let w = 30; w <= 80; w = Math.round((w + 0.01) * 100) / 100) if (capacityFor(320, w) >= 8) lastTrue = w;
  const rejected = Math.abs(lastTrue - bogus) > 0.011;
  console.log(
    `  (non-vacuity: ${checked} widths compared; a deliberately wrong divisor 5.8 gives ` +
      `${bogus.toFixed(2)} and is ${rejected ? 'REJECTED' : 'ACCEPTED — THE CHECK IS BLIND'})`,
  );
  if (!rejected) process.exitCode = 1;
}

// ---------------------------------------------------------------- K0
// THE GATE REWARDED THE WORSE OPTION, AND THE MECHANISM IS STRUCTURAL.
//
// `margin(s, w) = 436.0 - c(s)*w` is linear in w with a per-s coefficient, so the MARGINAL
// BIN is a step function of the CARD ALONE — the viewport width does not appear. Growing
// the card past a band edge pushes the marginal bin down one index, and that does two
// things at once:
//
//   it INCREASES the marginal bin's own slack   (the new marginal bin is shallower)
//   it INCREASES the mass sitting ABOVE it      (more hands are now too deep)
//
// `margin` measures the first. `R` measures the second. So over a band boundary they are
// not merely loosely coupled, they are ANTI-CORRELATED, and a gate built on `margin >= 10`
// prefers the larger card precisely because it made things worse. At width 360 the previous
// card (46.80) FAILS the floor at 7.37px with R(0) 0.15% modelled, while the card that
// shipped (48.15) PASSES at 15.23px with R(0) 1.78% modelled — twelve times the rate.
//
// `margin(s = LAST_VALIDATED_BIN) >= 0` does not catch this: it bounds the EXTREME and says
// nothing about the gradient, which is why I0 could adopt it and still leave this open.
//
// THE FIX IS AN ORDINAL TERM ON THE BIN INDEX, not a probability. `marginal bin >= 10` is
// pure geometry, width-independent, needs no threshold on a model tail, and refers only to
// bins the held-out test validated (expected count >= 5, up to s = 9). It is the same move
// I0 made for the validated-bin term: state it as an index rather than as a rate.
const MIN_MARGINAL_BIN = Number(process.env.MIN_MARGINAL_BIN ?? 10);
const bandCeiling = (bin) => 436.0 / (4 * ASPECT + STRIP * (bin - 2));

console.log('\n=== K0: THE MARGINAL BIN IS A STEP FUNCTION OF THE CARD ALONE ===');
console.log('  marginal bin   card-width band          R(0) at that bin, modelled');
for (let bin = 12; bin >= 7; bin -= 1) {
  const hi = bandCeiling(bin);
  const lo = bandCeiling(bin + 1);
  console.log(
    `  ${String(bin).padStart(12)}   ${lo.toFixed(2)} < w <= ${hi.toFixed(2)}` +
      `${bin >= MIN_MARGINAL_BIN ? '   <- admitted by the bin term' : ''}`,
  );
}
console.log(
  `\n  gate term: marginal bin >= ${MIN_MARGINAL_BIN}, i.e. w <= ${bandCeiling(MIN_MARGINAL_BIN).toFixed(2)}px.`,
);

console.log('\n=== K0: THE INVERSION, AT WIDTH 360 ===');
console.log('  cardW   marginal bin   margin   margin >= 10?   R(0) modelled (recorded)');
for (const [w, r] of [[46.8, '0.15%'], [48.15, '1.78%']]) {
  const mb = marginalBin(360, w);
  console.log(
    `  ${w.toFixed(2)}   ${String(mb.s).padStart(12)}   ${mb.margin.toFixed(2).padStart(6)}   ` +
      `${(mb.margin >= 10 ? 'PASSES' : 'FAILS').padStart(13)}   ${r}`,
  );
}
console.log(
  '  The gate passes the card with 12x the failure rate and fails the other. That is the\n' +
    '  defect, and it is not a tuning problem: no threshold on the marginal bin\'s own slack\n' +
    '  can order these two correctly, because the quantity moves the wrong way.',
);

// ---------------------------------------------------------------- K1
// THE CANDIDATE BAND, ONCE A FLOOR SERVES THE NARROW WIDTHS.
//
// K2 puts a 44px floor below 332px, which is exactly what ships at 320 today. That removes
// `capacity >= 8 at 320` from the constant's constraints — the constant no longer has to
// serve 320 — and the smallest width it must serve becomes 333. So the binding term inside
// band 10 changes, and it is worth recomputing rather than carrying 46.10 forward: 46.10
// was chosen as the 320 capacity ceiling, and that is no longer what binds.
const FLOOR_BELOW = Number(process.env.FLOOR_BELOW ?? 332);
const CONSTANT_WIDTHS = WIDTHS.filter((W) => W > FLOOR_BELOW);
const SMALLEST_CONSTANT_WIDTH = FLOOR_BELOW + 1;

console.log('\n=== K1: THE ADMITTED SET, WITH A FLOOR BELOW ' + FLOOR_BELOW + 'px ===');
{
  const bandLo = bandCeiling(MIN_MARGINAL_BIN + 1);
  const bandHi = bandCeiling(MIN_MARGINAL_BIN);
  const capHi = (SMALLEST_CONSTANT_WIDTH - ROW_CHROME) / 5.9;
  console.log(
    `  band ${MIN_MARGINAL_BIN}:            ${bandLo.toFixed(2)} < w <= ${bandHi.toFixed(2)}\n` +
      `  capacity >= 8 at ${SMALLEST_CONSTANT_WIDTH}:  w <= ${capHi.toFixed(2)}\n` +
      `  => the BAND binds${capHi > bandHi ? '' : ' — NO, capacity binds; re-read this'}, so the admitted set is ` +
      `(${bandLo.toFixed(2)}, ${bandHi.toFixed(2)}]`,
  );

  // TWO SETBACKS, KEPT APART (I1). A tooth boundary is a FEASIBILITY cliff: a bin stops
  // fitting and the failure rate steps. A capacity crossing at cap >= 8 only changes the
  // line SPLIT, which moves the distribution without ever changing pass/fail. Minimising
  // over both together would let a benign split change veto the feasibility-optimal point.
  const teeth = [];
  for (let s = 3; s <= 16; s += 1) {
    const w = bandCeiling(s);
    if (w > FLOOR - 6 && w < CEIL + 6) teeth.push({ w, s });
  }
  const splits = [];
  for (const W of CONSTANT_WIDTHS.concat([SMALLEST_CONSTANT_WIDTH])) {
    for (let k = 6; k <= 20; k += 1) {
      const w = (W - ROW_CHROME) / (0.7 * k + 0.3);
      if (w > FLOOR - 6 && w < CEIL + 6) splits.push({ w, W, k });
    }
  }
  const nearest = (list, w) => list.reduce((a, b) => (Math.abs(b.w - w) < Math.abs(a.w - w) ? b : a));

  console.log('\n  cardW   feasibility setback   split setback   nearest split   vs today at 390');
  let best = null;
  for (let w = Math.ceil(bandLo * 100) / 100; w <= bandHi; w = Math.round((w + 0.01) * 100) / 100) {
    const f = Math.min(Math.abs(w - bandLo), Math.abs(w - bandHi));
    const sp = Math.abs(nearest(splits, w).w - w);
    if (best === null || f > best.f || (Math.abs(f - best.f) < 0.005 && sp > best.sp)) best = { w, f, sp };
  }
  for (const w of [46.1, 46.3, best.w, 46.8, 47.0, 47.6]) {
    const f = Math.min(Math.abs(w - bandLo), Math.abs(w - bandHi));
    const n = nearest(splits, w);
    console.log(
      `  ${w.toFixed(2)}   ${f.toFixed(2).padStart(19)}   ${Math.abs(n.w - w).toFixed(2).padStart(13)}   ` +
        `${n.w.toFixed(2)} (cap ${n.k} at ${n.W})   ${(((w - 50.7) / 50.7) * 100).toFixed(1)}%` +
        `${Math.abs(w - best.w) < 0.005 ? '   <- feasibility-optimal' : ''}`,
    );
  }
  console.log(
    `\n  The feasibility-optimal point in the band is the MIDPOINT ${best.w.toFixed(2)}px, ` +
      `${best.f.toFixed(2)}px from either cliff.\n` +
      `  46.10 sits ${(46.1 - bandLo).toFixed(2)}px from the lower cliff because it was chosen as the ` +
      `320 capacity ceiling,\n  which under a floor is no longer a constraint on it.`,
  );
}

// PRACTICE 33: the band edges are closed-form, so they get an independent reconstruction
// that shares no algebra — walk w and read the marginal bin off the same marginalBin()
// the gate uses, emitting the edges from where the INDEX actually changes.
console.log('\n=== K1: EXHAUSTIVE RECONSTRUCTION OF THE BAND EDGES ===');
{
  let prev = null;
  const observed = [];
  for (let w = FLOOR; w <= 56; w = Math.round((w + 0.01) * 100) / 100) {
    const s = marginalBin(390, w).s;
    if (prev !== null && s !== prev) observed.push({ w: Math.round(w * 100) / 100, from: prev, to: s });
    prev = s;
  }
  let bad = 0;
  for (const o of observed) {
    const closed = bandCeiling(o.from);
    const agree = Math.abs(closed - o.w) <= 0.011;
    if (!agree) bad += 1;
    console.log(
      `  bin ${o.from} -> ${o.to} at w = ${o.w.toFixed(2)}   closed form ${closed.toFixed(4)}   ` +
        `${agree ? 'AGREE' : 'DISAGREE'}`,
    );
  }
  if (observed.length === 0) {
    console.log('  NO BAND EDGE OBSERVED — the reconstruction examined nothing.');
    process.exitCode = 1;
  }
  if (bad > 0) process.exitCode = 1;
  const bogus = 436.0 / (4 * ASPECT + 0.43 * (10 - 2));
  const rejected = !observed.some((o) => Math.abs(o.w - bogus) <= 0.011);
  console.log(
    `  (non-vacuity: ${observed.length} edges observed; a deliberately wrong strip 0.43 predicts ` +
      `${bogus.toFixed(2)} and is ${rejected ? 'REJECTED' : 'ACCEPTED — THE CHECK IS BLIND'})`,
  );
  if (!rejected) process.exitCode = 1;
}

// ---------------------------------------------------------------- K0, REFORMULATED
// THE VERTICAL TERM IS REPLACED, NOT SUPPLEMENTED.
//
// The first draft of this round added `marginal bin >= 10` alongside the existing
// `margin(marginal bin) >= 10px`. Grok's review (docs/research/proposals/gate-monotonicity-
// grok.md) rejected the composition, and it is right on two counts:
//
//   1. STACKING MASKS THE BUG FOR ONE PAIR AND LEAVES THE REWARD STRUCTURE INTACT. Inside
//      every band the bin floor still admits, the floating term still prefers early position
//      in a band (just dropped a bin, ~20px of fresh slack) over late position in a better
//      one. The composition fixes the 46.80/48.15 comparison and nothing general.
//
//   2. COMPARING THE TWO MARGINS IS A UNIT ERROR. 15.23px and 7.37px are the slacks of
//      DIFFERENT HANDS — an s=9 hand and an s=10 hand. Reading one as "safer" than the other
//      is comparing a surplus on one part against a surplus on a different part.
//
// AND A THIRD, WHICH IS THIS PROJECT'S OWN ERROR CLASS. `margin(s*, w) >= 10` is a ONE-SIDED
// setback: within a band it constrains only the distance to the tooth ABOVE (as w grows the
// margin falls to zero at the tooth), and says nothing about the tooth below. H0a diagnosed
// exactly this shape in the discontinuity scan and fixed it there; the same defect sat in
// the gate's own vertical term and survived because a one-sided constraint still reads as a
// number that gets larger when things get better.
//
// THE REPLACEMENT, in three terms that measure three different things:
//
//   DEPTH FLOOR      margin(K, w) >= 0 for a FIXED K — "depth-K hands must fit".
//   SETBACK          distance IN CARD WIDTH to the tooth ABOVE >= eps.
//   CAPACITY FLOOR   capacity(W, w) >= 8 at every supported width.
//
// AND THE SETBACK IS DIRECTIONAL, WHICH IS A CORRECTION TO H0a RATHER THAN A RETREAT FROM
// IT. H0a made setback two-sided because a one-sided figure hides the cliff you are standing
// next to. That is right when both neighbours are hazards. Here they are not: teeth are
// ordered in w, and the bin index DECREASES as w grows, so crossing the tooth ABOVE loses a
// depth bin (worse) while crossing the one BELOW gains one (better). A two-sided minimum
// therefore fails a card for being close to an improvement — it rejected the 44.00px floor
// value, which ships today, for sitting 0.39px above a tooth it would be harmless to cross.
// Both distances are reported; only the degrading one gates.
//
// K IS A PRODUCT POLICY AND MUST BE WRITTEN AS ONE. The held-out test validated bins with
// expected count >= 5, i.e. s <= 9; that earns K = 9 (I0's term) and does NOT earn K = 10.
// Requiring depth-10 hands to fit is a stricter product claim — "this depth is in scope" —
// and the honest sentence is that the owner chose it, not that validation forced it. Writing
// it the other way would be the precision claim H1 removed, respelled.
const DEPTH_FLOOR = Number(process.env.DEPTH_FLOOR ?? 10);
const MIN_TOOTH_SETBACK = Number(process.env.MIN_TOOTH_SETBACK ?? 0.5);

console.log('\n=== K0 REFORMULATED: THE GATE, WITH THE FLOATING TERM REMOVED ===');
console.log(
  `  1. depth floor    margin(K=${DEPTH_FLOOR}, w) >= 0        (product policy; the holdout earns K=${LAST_VALIDATED_BIN})\n` +
    `  2. tooth setback  in cardW, to the DEGRADING side only, >= ${MIN_TOOTH_SETBACK}px\n` +
    `  3. capacity       >= 8 at every supported width\n` +
    `  R is CONTEXT, reported stratified by capacity, and gates nothing.\n`,
);
{
  const toothAt = (s) => 436.0 / (4 * ASPECT + STRIP * (s - 2));
  const teeth = [];
  for (let s = 3; s <= 16; s += 1) {
    const w = toothAt(s);
    if (w > FLOOR - 6 && w < CEIL + 6) teeth.push({ w, s });
  }
  const above = (w) => teeth.filter((t) => t.w > w).reduce((a, b) => (b.w < a.w ? b : a), { w: Infinity });
  const below = (w) => teeth.filter((t) => t.w <= w).reduce((a, b) => (b.w > a.w ? b : a), { w: -Infinity });
  const degradeSetback = (w) => above(w).w - w;
  const improveSetback = (w) => w - below(w).w;
  const capOk = (w) =>
    CONSTANT_WIDTHS.concat([SMALLEST_CONSTANT_WIDTH]).every((W) => capacityFor(W, w) >= 8);
  const passes = (w) =>
    marginFor(DEPTH_FLOOR, w) >= 0 && degradeSetback(w) >= MIN_TOOTH_SETBACK && capOk(w);

  console.log('  cardW   depth floor   setback UP (gates)   setback down   capacity   VERDICT');
  for (const w of [44.0, 46.1, 46.51, 46.56, 46.8, 47.1, 47.6, 48.15, 50.7]) {
    const d = marginFor(DEPTH_FLOOR, w) >= 0;
    const up = degradeSetback(w);
    console.log(
      `  ${w.toFixed(2)}   ${(d ? 'pass' : 'FAIL').padStart(11)}   ${up.toFixed(2).padStart(18)}` +
        `${up >= MIN_TOOTH_SETBACK ? ' ' : '!'}   ${improveSetback(w).toFixed(2).padStart(12)}   ` +
        `${(capOk(w) ? 'pass' : 'FAIL').padStart(8)}   ${passes(w) ? 'PASS' : 'FAIL'}`,
    );
  }

  let lo = null;
  let hi = null;
  for (let w = FLOOR; w <= 56; w = Math.round((w + 0.01) * 100) / 100) {
    if (!passes(w)) continue;
    if (lo === null) lo = w;
    hi = w;
  }
  console.log(
    `\n  admitted: [${lo === null ? '-' : lo.toFixed(2)}, ${hi === null ? '-' : hi.toFixed(2)}]` +
      ` (scanned from the old rem floor ${FLOOR}px up).\n` +
      `  R IS NOT FLAT ACROSS THIS SET — it spans marginal bins ${marginalBin(390, hi).s} to ` +
      `${marginalBin(390, lo).s}, and a smaller card is strictly better on R. The depth floor\n` +
      `  guarantees only that depth ${DEPTH_FLOOR} fits. Within ONE band R is flat, so the trade at the\n` +
      `  top of the set is CARD SIZE against SETBACK to the degrading cliff at ${above(46).w.toFixed(2)}px:`,
  );
  console.log('\n  cardW   setback up   vs today at 390   note');
  for (const w of [46.1, 46.51, 46.56, 47.0, 47.1]) {
    const note =
      Math.abs(w - 46.1) < 0.005
        ? "the J0 pick — chosen as 320's capacity ceiling, which a floor removes"
        : Math.abs(w - 46.51) < 0.005
          ? 'keeps exactly the tolerance the old 10px vertical floor bought'
          : Math.abs(w - 47.1) < 0.005
            ? `largest card meeting the ${MIN_TOOTH_SETBACK}px term`
            : '';
    console.log(
      `  ${w.toFixed(2)}   ${degradeSetback(w).toFixed(2).padStart(10)}   ` +
        `${(((w - 50.7) / 50.7) * 100).toFixed(1).padStart(15)}%   ${note}`,
    );
  }
  console.log(
    `\n  The old floating floor of ${MIN_MARGIN}px on margin(s*) is, in card width, a setback of ` +
      `${(above(46).w - (436.0 - MIN_MARGIN) / (4 * ASPECT + STRIP * (DEPTH_FLOOR - 2))).toFixed(2)}px\n` +
      `  below the tooth — the same tolerance, stated in the units the choice is made in.`,
  );
  console.log(
    `  the shipped constant 48.15 is ${passes(48.15) ? 'INSIDE' : 'OUTSIDE'} the admitted set — ` +
      `its depth floor is margin(${DEPTH_FLOOR}, 48.15) = ${marginFor(DEPTH_FLOOR, 48.15).toFixed(2)}px.`,
  );
  console.log(
    '\n  NOTE, so this is not read as a discovery: the term was chosen knowing it excludes the\n' +
      '  shipped value. That is the point of it — a gate carved to admit whatever shipped last\n' +
      '  is not a gate. What it is NOT is a validation result; see the K comment above.',
  );
}
