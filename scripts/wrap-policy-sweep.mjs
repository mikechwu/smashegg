// C2 — THE WRAP POLICY: WHAT L COSTS, AND WHAT THE CUT MOVING COSTS.
//
// Grok's depth-minimising sequential wrap removes the ascending/descending asymmetry.
// Two things were not priced, and both are reported here rather than at two endpoints.
//
// C2a. L IS DOING ALL THE WORK. "depth-min BEATS today's default" holds at L=1, which
// permits a line of ONE column. The same proposal's own table puts L=4 at 8.16%, WORSE
// than today's 7.65%. So the honest headline is: removing the sort asymmetry is free
// only if a line may fall to a single column; at any defensible L it costs. The curve
// is reported for L = 1..7 with the SHORTER line's length distribution, because the
// owner picks a point on it. The L=1 figure was produced by the proposer (Grok); this
// is the other lineage's arithmetic.
//
// C2b. CUT-POINT STABILITY, the cost nobody priced. Greedy's cut sits at capacity and
// moves only when the column count crosses it — one column at a time, a few times per
// hand. Depth-min recomputes an argmin after every card leaves the hand, and the cut
// can jump several columns, re-flowing the whole second line at once. Practice 20
// permits movement BETWEEN operations, but it was written against greedy's magnitude.
//
// And a variant nobody proposed: DEPTH-MIN COMPUTED ONCE at deal start and HELD for the
// hand, re-cut only when the column count no longer fits. The expectation to test is
// that it keeps most of the symmetry benefit and nearly all of greedy's stability.
//
// Run: node scripts/wrap-policy-sweep.mjs   (no browser, no server)

const SAMPLES = Number(process.env.SAMPLES ?? 60_000);
const CAP = Number(process.env.CAP ?? 9);
const CH = 73.5, STEP = 21.3, CHROME = 13.9, GAP = 6.0;
const T = 664 - 156.5 - 198.6; // timed, staged, following
const lineH = (d) => CH + STEP * (d - 1);
const fanH = (d1, d2) => CHROME + lineH(d1) + (d2 > 0 ? GAP + lineH(d2) : 0);

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
const rand = mulberry32(Number(process.env.SEED ?? 20260727));
const shoe = [];
for (let c = 0; c < CLASS_SIZES.length; c += 1) for (let k = 0; k < CLASS_SIZES[c]; k += 1) shoe.push(c);

/** A hand as per-class counts, in value order. */
function deal() {
  const s = shoe.slice();
  const counts = new Array(CLASS_SIZES.length).fill(0);
  for (let j = 0; j < 27; j += 1) {
    const t = j + Math.floor(rand() * (s.length - j));
    const tmp = s[j]; s[j] = s[t]; s[t] = tmp;
    counts[s[j]] += 1;
  }
  return counts;
}
const columnsOf = (counts) => counts.filter((v) => v > 0);

const maxOf = (a) => (a.length === 0 ? 0 : Math.max(...a));

/** Greedy: fill line 1 to capacity. */
function greedyCut(cols) {
  return cols.length <= CAP ? cols.length : CAP;
}

/** Depth-min: the legal cut minimising (d1+d2, max(d1,d2), |k-(C-k)|, k). */
function depthMinCut(cols, L) {
  const C = cols.length;
  if (C <= CAP) return C;
  let lo = Math.max(C - CAP, L);
  let hi = Math.min(CAP, C - L);
  if (lo > hi) { lo = Math.max(C - CAP, 1); hi = Math.min(CAP, C - 1); }
  // LEXICOGRAPHIC COMPARE, WRITTEN OUT. The first version of this used `key <
  // best.key` on two ARRAYS, which coerces both to strings and compares them
  // character by character — so "10,8,..." sorted before "9,7,...". The asymmetry
  // column caught it: depth-min is symmetric BY CONSTRUCTION (cut k on the reversed
  // list has the same (d1+d2, max) as cut C-k on the original, over a legal band that
  // is itself symmetric), so any non-zero asymmetry indicts the implementation rather
  // than the policy. It read 2.1-2.8%.
  const lessThan = (a, b) => {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] < b[i]) return true;
      if (a[i] > b[i]) return false;
    }
    return false;
  };
  let best = null;
  for (let k = lo; k <= hi; k += 1) {
    const d1 = maxOf(cols.slice(0, k));
    const d2 = maxOf(cols.slice(k));
    // The tie-break keys after the first two must ALSO be reverse-invariant, or a tie
    // is broken differently in each direction. |k-(C-k)| is; a bare `k` is not, so the
    // final key is min(k, C-k).
    const key = [d1 + d2, Math.max(d1, d2), Math.abs(k - (C - k)), Math.min(k, C - k)];
    if (best === null || lessThan(key, best.key)) best = { k, key, d1, d2 };
  }
  return best.k;
}

function heightFor(cols, k) {
  return fanH(maxOf(cols.slice(0, k)), k >= cols.length ? 0 : maxOf(cols.slice(k)));
}

// ---------------------------------------------------------------- C2a: the L curve
console.log('=== C2a — WHAT L COSTS (depth-min wrap, lacquer, timed/following/staged) ===');
console.log(`    ${SAMPLES.toLocaleString()} deals, capacity ${CAP}, threshold fanH<=${T.toFixed(1)}.`);
console.log('    MODELLED. Gated on C1. The L=1 figure was produced by the proposer; this is');
console.log('    the other lineage recomputing it.\n');
const hands = [];
for (let i = 0; i < SAMPLES; i += 1) hands.push(columnsOf(deal()));

function evaluatePolicy(cutFn) {
  let bad = 0, sum = 0, asym = 0;
  const shorter = new Map();
  for (const cols of hands) {
    const k = cutFn(cols);
    const h = heightFor(cols, k);
    sum += h;
    if (h > T) bad += 1;
    const rev = cols.slice().reverse();
    const kr = cutFn(rev);
    const hr = heightFor(rev, kr);
    if (Math.abs(hr - h) > 0.05) asym += 1;
    if (cols.length > CAP) {
      const s = Math.min(k, cols.length - k);
      shorter.set(s, (shorter.get(s) ?? 0) + 1);
    }
  }
  return {
    fail: (100 * bad) / SAMPLES,
    mean: sum / SAMPLES,
    asym: (100 * asym) / SAMPLES,
    shorter,
  };
}

const greedy = evaluatePolicy(greedyCut);
console.log(
  `  greedy ascending (today)        P(fail) ${greedy.fail.toFixed(2)}%   mean ${greedy.mean.toFixed(1)}px   ` +
    `asymmetric on ${greedy.asym.toFixed(1)}% of deals`,
);
console.log('\n  L   P(fail)    mean     asym   shorter-line length distribution (2-line deals)');
for (let L = 1; L <= 7; L += 1) {
  const r = evaluatePolicy((c) => depthMinCut(c, L));
  const total = [...r.shorter.values()].reduce((a, b) => a + b, 0);
  const dist = [...r.shorter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([len, n]) => `${len}:${((100 * n) / total).toFixed(0)}%`)
    .join(' ');
  const verdict = r.fail < greedy.fail ? 'better than today' : r.fail > greedy.fail ? 'WORSE than today' : 'equal';
  console.log(
    `  ${L}   ${r.fail.toFixed(2).padStart(6)}%  ${r.mean.toFixed(1).padStart(6)}   ${r.asym.toFixed(1).padStart(4)}%   ${dist}   <- ${verdict}`,
  );
}
console.log(
  '\n  The asymmetry column is the POINT of the policy: greedy is asymmetric on a large\n' +
    '  share of deals, depth-min on none, at every L. What L buys is line-length dignity,\n' +
    '  and what it costs is the failure rate. Those are the two axes of the choice.',
);

// ------------------------------------------------------- C2b: cut-point stability
console.log('\n=== C2b — CUT-POINT STABILITY over a full play-out ===');
console.log('    Cards leave the hand one play at a time; each departure can move the cut.');
console.log('    Reported: columns that change LINE after a single play, worst case and mean.\n');

/** Play out a hand: remove one card at a time from a random present class.
 *
 *  COMPARE BY COLUMN IDENTITY, NOT BY INDEX. The first version compared
 *  `prev[i] !== lines[i]` positionally, and reported greedy at 0.000 line-changes per
 *  play — which is certainly wrong: when a column on line 1 empties, every later
 *  column shifts left by one and the column that was first on line 2 moves up to line
 *  1. Positional comparison cannot see that, because the SLOT kept its line. A column
 *  is identified by its value CLASS, which is what the player is actually looking at.
 */
function playOut(counts0, cutFn) {
  const counts = counts0.slice();
  const moves = [];
  let prev = null;
  let n = counts.reduce((a, b) => a + b, 0);
  while (n > 0) {
    const classes = [];
    for (let i = 0; i < counts.length; i += 1) if (counts[i] > 0) classes.push(i);
    const cols = classes.map((c) => counts[c]);
    const k = cutFn(cols);
    const lineOf = new Map();
    classes.forEach((c, i) => lineOf.set(c, i < k ? 0 : 1));
    if (prev !== null) {
      let changed = 0;
      for (const [c, line] of lineOf) {
        const before = prev.get(c);
        if (before !== undefined && before !== line) changed += 1;
      }
      moves.push(changed);
    }
    prev = lineOf;
    const pick = classes[Math.floor(rand() * classes.length)];
    counts[pick] -= 1;
    n -= 1;
  }
  return moves;
}

const POLICIES = [
  ['greedy', (c) => greedyCut(c)],
  ['depth-min L=1', (c) => depthMinCut(c, 1)],
  ['depth-min L=4', (c) => depthMinCut(c, 4)],
];
const PLAYOUTS = Math.min(2000, SAMPLES);
console.log('  policy            mean line-changes/play   worst    plays with >=3 changed');
for (const [name, fn] of POLICIES) {
  let all = [];
  for (let i = 0; i < PLAYOUTS; i += 1) all = all.concat(playOut(deal(), fn));
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  const worst = Math.max(...all);
  const big = (100 * all.filter((x) => x >= 3).length) / all.length;
  console.log(
    `  ${name.padEnd(18)} ${mean.toFixed(3).padStart(14)}   ${String(worst).padStart(6)}   ${big.toFixed(2).padStart(8)}%`,
  );
}

// The unproposed variant: compute the cut ONCE and hold it.
console.log('\n  --- the variant nobody proposed: compute ONCE at deal start, hold for the hand ---');
let heldFail = 0, heldAsym = 0, heldMoves = [];
for (let i = 0; i < PLAYOUTS; i += 1) {
  const counts = deal();
  const cols0 = columnsOf(counts);
  const k0 = depthMinCut(cols0, 4);
  // held policy: keep k0 while it stays legal for the current column count
  const held = (cols) => {
    if (cols.length <= CAP) return cols.length;
    const k = Math.min(k0, cols.length - Math.max(1, cols.length - CAP));
    return Math.max(cols.length - CAP, Math.min(CAP, k));
  };
  const h = heightFor(cols0, held(cols0));
  if (h > T) heldFail += 1;
  const rev = cols0.slice().reverse();
  if (Math.abs(heightFor(rev, held(rev)) - h) > 0.05) heldAsym += 1;
  heldMoves = heldMoves.concat(playOut(counts, held));
}
const heldMean = heldMoves.reduce((a, b) => a + b, 0) / heldMoves.length;
console.log(
  `  held-cut (from L=4)   P(fail) ${((100 * heldFail) / PLAYOUTS).toFixed(2)}%   ` +
    `asymmetric ${((100 * heldAsym) / PLAYOUTS).toFixed(1)}%   ` +
    `mean line-changes/play ${heldMean.toFixed(3)}   worst ${Math.max(...heldMoves)}`,
);
console.log(
  '\n  NOTE THE ASYMMETRY COLUMN HERE. Holding a cut computed on the ARRIVAL order does not\n' +
    '  survive a reverse unless the cut is computed on a canonical order first — which is\n' +
    '  exactly the equivalent form the proposal gives. If this row shows asymmetry, the\n' +
    "  held variant needs the canonical-order form, not the display-order one.",
);
