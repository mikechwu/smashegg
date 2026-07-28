// C3 — THE CARD-SCALE SWEEP, WITH THE CAPACITY DISCONTINUITY HANDLED.
//
// `capacity = floor(contentWidth / (0.7 * cardW))`, so capacity crosses 9 -> 10 at
// cardW ~= 46.7 and the distribution changes DISCONTINUOUSLY there. cardW 47 is
// capacity 9; cardW 44.6 is capacity 10. Any claim that two such points share "the
// same rate" has to be computed with each point's own capacity, not one of them.
//
// WHY R(delta) IS THE DECISION COLUMN AND MARGIN-IN-PX IS NOT.
// Margin says how far the threshold sits above the highest bin that still fits. It
// does not say what happens if the threshold moves. Two layouts with the same margin
// are not the same risk when one has 8.3% of deals sitting just above and the other
// has 0.27%. So the decision column is
//     R(delta) = P(fanH > T - delta)
// the failure rate if the threshold were delta pixels LOWER than modelled — i.e. if
// something eats delta of budget. Margin is reported as supporting detail.
//
// THE DELTA BUDGET IS JUSTIFIED, NOT GUESSED. Sources, each with its status:
//   delta = 0     the modelled configuration exactly.
//   delta = 5     small measured drift: deskH varies with title length, clock digits
//                 and level string. MEASURED: the same gate saw deskH 156.5 and 161.5
//                 in two configurations of the same viewport.
//   delta = 10    the above plus K's constancy being established only INSIDE the
//                 pinned configuration (0.1px across 78 states, all lacquer/zh-Hant).
//   delta = 21.3  one whole lattice step: a layout that survives this is insensitive
//                 to any single unmeasured term short of a wrapped title.
// A wrapped desk title costs ~27px outright and is NOT in this budget — C4 makes it
// impossible instead, because no remedy survives it.
//
// UNMEASURED AND THEREFORE NOT IN THE BUDGET: the inner heights of the LINE and WeChat
// in-app webviews. This product is shared by room code in a family chat, so a webview
// is a plausible primary entry path; its chrome is fixed and cannot collapse. Until
// those are measured the budget's right-hand end is a guess and this file says so.
//
// Run: node scripts/cardw-sweep.mjs   (no browser, no server)

const SAMPLES = Number(process.env.SAMPLES ?? 200_000);
const HAND = 27;

// Measured at inner 390 (derive-fan-bound.mjs, fan-geometry-sweep.mjs). cardH/cardW is
// a FIXED aspect; the 2.75rem floor clamps cardW only. C5a re-checks that from source,
// because all card-scale pricing rests on this single ratio.
const ASPECT = 73.5 / 50.7;
const CHROME = 13.9;
const GAP = 6.0;
const STRIP = 0.42; // lacquer stackStripW
const K_FOLLOW = 198.6;
const INNER_H = 664;
const BASE_CARDW = 50.7;
const BASE_CARDH = 73.5;
// D1: deskH IS NOT CONSTANT, AND `<= 156.5 structural` WAS WRONG.
// The staged card row is 78.5px when the staged card is a JOKER and 73.5px otherwise —
// a joker face is 5px taller than a normal one, i.e. its own aspect is 1.548 against
// the 1.45 every other card uses. The player chooses what to stage, so this is
// CONTENT-dependent (practice 18) and the term needs a proved worst case, not a mean.
// P(a 27-card hand contains at least one joker) = 69.0%, which is exactly the 16/23
// split the held-out run saw; that run staged cards[0], which under descending is the
// highest class and therefore a joker whenever the hand has one.
const JOKER_ASPECT = 78.5 / 50.7; // 1.548
const CARD_ASPECT = 73.5 / 50.7; // 1.4497
const DESK_MINUS_STAGE = 156.5 - 73.5; // 83.0, the desk without its staged card row
const deskFor = (cardW, staged) =>
  DESK_MINUS_STAGE + (staged === 'joker' ? JOKER_ASPECT : CARD_ASPECT) * cardW;
// D2: the trick well renders `<CardFace size="hand">` (TrickWell.tsx:60,67), so it uses
// the SAME clamp as the fan and SCALES with the card — measured: well card 50.7x73.5,
// fan card 50.7x73.5. K therefore has a card-sized term the threshold model never
// varied: K = (K at 50.7) - cardH(50.7) + cardH(cardW).
const kFor = (cardW) => 198.6 - 73.5 + CARD_ASPECT * cardW;
const BASE_DESK = 156.5; // retained for the legacy single-threshold path
// The stack row's own padding-left is `calc(cardw * 0.3)`, so the CONTENT width grows
// as the card shrinks. Ignoring that moves the capacity crossover; it is small but it
// is exactly the term the crossover is sensitive to.
const BASE_CONTENT = 326.8;
const contentFor = (cardW) => BASE_CONTENT + (BASE_CARDW - cardW) * 0.3;
// D3: the recommendation is implemented as a `vw` coefficient, so cardW tracks WIDTH.
// A plateau computed at 390 alone cannot be implemented as a width-proportional rule.
const WIDTHS = (process.env.WIDTHS ?? '390').split(',').map(Number);

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
for (let c = 0; c < CLASS_SIZES.length; c += 1) {
  for (let k = 0; k < CLASS_SIZES[c]; k += 1) shoe.push(c);
}
const hands = [];
for (let i = 0; i < SAMPLES; i += 1) {
  const s = shoe.slice();
  const counts = new Array(CLASS_SIZES.length).fill(0);
  for (let j = 0; j < HAND; j += 1) {
    const t = j + Math.floor(rand() * (s.length - j));
    const tmp = s[j];
    s[j] = s[t];
    s[t] = tmp;
    counts[s[j]] += 1;
  }
  hands.push(counts.filter((v) => v > 0));
}

const DELTAS = [0, 5, 10, 21.3];

// WORST CASE unless told otherwise: a joker staged. The mixture is reported beside it.
const STAGED = process.env.STAGED ?? 'joker';
function evaluate(cardW, order = 'ascending') {
  const cardH = ASPECT * cardW;
  const step = STRIP * cardW;
  const pitch = 0.7 * cardW;
  const capacity = Math.floor(contentFor(cardW) / pitch);
  // The desk's staged card row scales with the card too, so the threshold moves.
  const desk = deskFor(cardW, STAGED);
  const T = INNER_H - desk - kFor(cardW);
  const lineH = (d) => cardH + step * (d - 1);

  const hist = new Map();
  for (const cols of hands) {
    const c = order === 'descending' ? cols.slice().reverse() : cols;
    const a = c.slice(0, capacity);
    const b = c.slice(capacity);
    const d1 = a.length === 0 ? 0 : Math.max(...a);
    const d2 = b.length === 0 ? 0 : Math.max(...b);
    const h = Math.round((CHROME + lineH(d1) + (d2 > 0 ? GAP + lineH(d2) : 0)) * 10) / 10;
    hist.set(h, (hist.get(h) ?? 0) + 1);
  }
  const rateAt = (t) => {
    let bad = 0;
    for (const [h, n] of hist) if (h > t) bad += n;
    return (100 * bad) / SAMPLES;
  };
  const fitting = [...hist.keys()].filter((h) => h <= T);
  const highestFitting = fitting.length > 0 ? Math.max(...fitting) : NaN;
  return {
    cardW,
    capacity,
    step: Math.round(step * 10) / 10,
    desk: Math.round(desk * 10) / 10,
    T: Math.round(T * 10) / 10,
    R: DELTAS.map((d) => rateAt(T - d)),
    marginPx: Math.round((T - highestFitting) * 100) / 100,
    rideShare: (100 * (hist.get(highestFitting) ?? 0)) / SAMPLES,
  };
}

console.log('=== C3 — CARD SCALE SWEEP (lacquer, timed, following, staged, inner 390x664) ===');
console.log(`    ${SAMPLES.toLocaleString()} simulated deals. MODELLED, on a model whose held-out`);
console.log('    validation (C1) is the gate on every figure below.');
console.log(
  `\n    capacity crosses 9 -> 10 at cardW = ${(BASE_CONTENT / (0.7 * 10)).toFixed(2)} with a fixed content width,`,
);
console.log('    and slightly higher once the row padding is allowed to shrink with the card.\n');
console.log(
  '  cardW  cap   step   deskH      T     R(0)    R(5)   R(10)  R(21.3)   margin   share on it',
);
const rows = [];
for (let cw = 50.7; cw >= 44.0 - 1e-9; cw -= 0.25) {
  const r = evaluate(Math.round(cw * 100) / 100);
  rows.push(r);
}
rows.push(evaluate(44.0));
for (const r of rows) {
  console.log(
    `  ${r.cardW.toFixed(2).padStart(5)}  ${String(r.capacity).padStart(3)}  ` +
      `${r.step.toFixed(1).padStart(5)}  ${r.desk.toFixed(1).padStart(6)}  ${r.T.toFixed(1).padStart(6)}  ` +
      r.R.map((x) => `${x.toFixed(2).padStart(6)}%`).join(' ') +
      `  ${r.marginPx.toFixed(2).padStart(7)}px ${r.rideShare.toFixed(2).padStart(7)}%`,
  );
}

// A PLATEAU is a run of consecutive cardW values whose R(10) stays low: it is what
// survives the threshold moving, which is the property a choice needs. Picking the
// SMALLEST reduction that hits a target rate is how cardW 47 was chosen, and 47 sits
// at the bottom of a sawtooth with 0.16px of margin.
console.log('\n--- PLATEAUX: the widest runs where R(10) stays under a stated ceiling ---');
for (const ceiling of [1.0, 0.5, 0.2]) {
  let best = null;
  let start = null;
  for (let i = 0; i < rows.length; i += 1) {
    const ok = rows[i].R[2] <= ceiling;
    if (ok && start === null) start = i;
    if ((!ok || i === rows.length - 1) && start !== null) {
      const end = ok ? i : i - 1;
      if (best === null || end - start > best.end - best.start) best = { start, end };
      start = null;
    }
  }
  if (best === null) {
    console.log(`  R(10) <= ${ceiling}%: no cardW in the swept range achieves it.`);
    continue;
  }
  const hi = rows[best.start];
  const lo = rows[best.end];
  const mid = rows[Math.floor((best.start + best.end) / 2)];
  console.log(
    `  R(10) <= ${ceiling.toFixed(1)}%: cardW ${lo.cardW.toFixed(2)}..${hi.cardW.toFixed(2)} ` +
      `(${best.end - best.start + 1} steps) — midpoint ${mid.cardW.toFixed(2)}, ` +
      `capacity ${mid.capacity}, R(0) ${mid.R[0].toFixed(2)}%, R(21.3) ${mid.R[3].toFixed(2)}%, ` +
      `margin ${mid.marginPx.toFixed(2)}px`,
  );
}
console.log(
  '\n  Read the PLATEAU, not the minimum. A point chosen because it is the smallest\n' +
    '  reduction reaching a target rate sits wherever the sawtooth happens to dip, and\n' +
    '  the sawtooth is an artifact of the lattice rather than a property of the design.',
);

// THE SELECTION RULE IS "LARGEST CARD THAT CLEARS THE BAR", NOT "BEST POINT".
//
// Every tooth peaks at the LOW end of its interval, so "pick the point with the best
// margin" walks downhill and systematically selects a SMALLER card — and card size is
// the only quantity the one remaining human constraint (legibility) cares about. The
// output is therefore a short candidate table for the elder session, not one number.
console.log('\n--- CANDIDATES: the LARGEST cardW meeting each stated bar ---');
console.log('  R(10) ceiling   min margin   largest cardW   cap   R(0)    R(10)   R(21.3)  margin');
for (const ceiling of [1.0, 0.5, 0.1]) {
  for (const minMargin of [5, 10, 15]) {
    const ok = rows.filter((r) => r.R[2] <= ceiling && r.marginPx >= minMargin);
    if (ok.length === 0) {
      console.log(
        `  ${String(ceiling).padStart(13)}%  ${String(minMargin).padStart(10)}px   ` +
          `none in the swept range`,
      );
      continue;
    }
    const best = ok.reduce((a, b) => (b.cardW > a.cardW ? b : a));
    console.log(
      `  ${String(ceiling).padStart(13)}%  ${String(minMargin).padStart(10)}px   ` +
        `${best.cardW.toFixed(2).padStart(13)}  ${String(best.capacity).padStart(3)}  ` +
        `${best.R[0].toFixed(2).padStart(5)}%  ${best.R[2].toFixed(2).padStart(5)}%  ` +
        `${best.R[3].toFixed(2).padStart(6)}%  ${best.marginPx.toFixed(2).padStart(6)}px`,
    );
  }
}
console.log(
  '\n  THE TIEBREAK BETWEEN THE TOP CANDIDATES IS R(21.3), and it only matters if a\n' +
    '  ~21px drift source is real. The largest UNMEASURED one is the LINE / WeChat\n' +
    '  in-app browser inner height — so that measurement decides the card size, and it\n' +
    '  is the reason it moved up the device-session list.',
);
