// FOLD GATE — HOW OFTEN does Play/Pass fall below the fold, at true 390x844?
//
// A REQUIRED check whenever layout changes, alongside
// scripts/measure-fan-tap-targets.mjs.
//
// IT REPORTS A RATE, NOT A VERDICT, and that is the whole point. The question
// was never "did any deal scroll" — the answer to that is yes, and has always
// been yes. The fan's settled height is a step function of the dealt hand, so
// "does Play fit" is a property of the DEAL, not of the layout. Asking it as a
// yes/no of a 6-deal sample produced a false claim that stood for weeks.
//
// The owner has ACCEPTED the ~8% below-fold rate (STATUS.md, 2026-07-25), so a
// deal that needs scrolling is NOT a failure here. What this gate now watches
// for is a base document position above the highest KNOWN bucket, which would
// mean the step function itself moved — that is the regression signal.
//
// WHY IT MEASURES DOCUMENT COORDINATES. getBoundingClientRect() is
// VIEWPORT-relative, so a page that ScrollActionsIntoView has already scrolled
// reports a comfortable number for a layout that does not actually fit. That
// mistake was made twice in this project's own reporting: a shelf was recorded
// as "Play stayed above the fold, 834-835" when the real reading was
// scrollY=112 and a document position of 947. This script records scrollY and
// the document position so the safety net can never be mistaken for a fit.
//
// Run: dev servers up, then `node scripts/measure-fold.mjs`.
// Requires playwright + chromium (deliberately NOT a repo dependency — this is
// a manual gate script, same policy as the tap-target sweep).

import { chromium } from 'playwright';
import {
  CONTAINMENT_PROBE,
  checkContainment,
  newTally,
  reportContainment,
} from './containment.mjs';

const BASE = process.env.FAN_SWEEP_BASE ?? 'http://localhost:5173';

// SAMPLE SIZE, JUSTIFIED RATHER THAN INHERITED.
//
// This defaulted to 6, and 6 could not answer the question it was asked. The
// base layout puts Play below the fold on ~8% of deals, so a 6-deal run sees
// nothing on (1 - 0.08)^6 = 61% of runs — and one such run is what put the
// false claim "the base layout puts Play above the fold" into the record.
//
//   n=6   miss 61%   CI on a 0/6 result:  [0.0%, 39.0%]  (says nothing)
//   n=24  miss 14%   CI on a 2/24 result: [2.3%, 25.8%]
//   n=40  miss  3.6% CI on a 3/40 result: [2.6%, 20.0%]
//
// 40 is the default: it is the smallest round number whose miss probability is
// under 5%, i.e. the point at which a clean run is weak evidence of absence
// rather than no evidence at all. MIN_DEALS is the floor below which this
// script refuses to draw a conclusion in either direction.
const DEALS = Number(process.env.FOLD_DEALS ?? 40);
const MIN_DEALS = Number(process.env.FOLD_MIN_DEALS ?? 24);
// The viewport is a KNOB, not a constant. It used to be hardcoded 390x844, and
// 844 is an inner height no phone browser produces — Safari and Chrome keep
// toolbars, so a 390x844 device reports ~664. Every geometry claim this repo
// made was therefore measured at a size no user has, which is exactly how the
// set-aside control could be missing on every phone while every gate ran green.
// THE AXIS THIS GATE NEVER VARIED, AND THE DEFECT THAT COST.
//
// `stackStripW` is a per-THEME metric, and the pile's height is
// (n-1) * min(stripW, 2.95/(n-1)) * cardWidth. Every fold number this project
// produced before 2026-07-27 held the theme at the default (lacquer, 0.42).
// `cinnabar-court` ships, is selectable from the header picker at any time, and
// declares 0.841 — and measured, it puts Play below the fold on 95.8% of deals
// on a phone WITH NO SHELF, against lacquer's 4.2%.
//
// So the theme is now a knob with a stated default, and the run prints which
// theme it measured. A fold conclusion that does not name its theme is scoped to
// one theme whether or not it says so.
const THEME = process.env.FOLD_THEME ?? 'lacquer';
// NO DEFAULT. A known-wrong default plus a warning IS this round's failure mode:
// the comment above has said since 2026-07-25 that 844 is a height no phone
// presents, and the default stayed 844 for weeks anyway, steering every phone
// baseline at a fiction. A warning above a wrong default is the weakest possible
// response — so there is no value to inherit. Every recorded figure names the
// height it used, which is what keeps the history interpretable.
//   phone, iOS Safari on a 390x844 device: ~664 with toolbars, ~748 minimized.
//   844 itself is the SCREEN size and no browser presents it.
if (process.env.FOLD_W === undefined || process.env.FOLD_H === undefined) {
  console.log(
    '\nFOLD_W and FOLD_H are REQUIRED — there is deliberately no default.\n\n' +
      '  A fold rate is meaningless without the INNER viewport it was measured at,\n' +
      '  and this gate previously defaulted to 390x844, which is a phone SCREEN\n' +
      '  size that no browser ever presents. Measured 2026-07-27: at a real\n' +
      '  390x664 or 390x748, Play is below the fold at EVERY pile depth — the rate\n' +
      '  is 100%, not the ~8% recorded against 844.\n\n' +
      '  Real phone inner heights (390 wide): 664 with toolbars, 748 minimized.\n' +
      '  Desktop: subtract ~90-120px of browser chrome from the SCREEN height.\n\n' +
      '  e.g.  FOLD_W=390 FOLD_H=664 node scripts/measure-fold.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.FOLD_W);
const VH = Number(process.env.FOLD_H);

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

// NOTE ON PACING. POST /api/rooms is rate-limited to 15 creates / 60s per IP
// (CREATE_LIMITER, wrangler.toml). At the old n=6 that never mattered; at the
// n=40 this gate now needs, a straight loop trips it and the run dies mid-way
// with an opaque WebSocket error. So the create RETRIES on 429 rather than
// failing, and the driver reports how long it waited — a gate that cannot
// complete its own sample size is not a gate.
const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 6000));
  }
  if (res === null || !res.ok) throw new Error('room create failed: ' + (res ? res.status : 'no response'));
  const { code } = await res.json();
  const tokens = []; let lastSeq = 0;
  const ws = new WebSocket('ws://' + location.host + '/api/rooms/' + code + '/ws');
  window.__driveWs = ws;
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('drive timeout')), 120000);
    let inflightSeq = -1; let resolved = false;
    ws.onopen = () => ws.send(JSON.stringify({v:1,type:'hello',tokens:[]}));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.seq !== undefined) lastSeq = Math.max(lastSeq, m.seq);
      if (m.type === 'hello' || m.type === 'welcome') ws.send(JSON.stringify({v:1,type:'claimSeat',name:'M1'}));
      if (m.type === 'seatClaimed' && m.token) {
        tokens.push(m.token);
        if (tokens.length < 4) ws.send(JSON.stringify({v:1,type:'claimSeat',name:'M' + (tokens.length + 1)}));
        else ws.send(JSON.stringify({v:1,type:'start'}));
      }
      if (m.type !== 'event' && m.type !== 'resync') return;
      if (!m.view) return;
      const hasHints = m.hints && m.hints.length > 0;
      if (hasHints && m.seat === 0) { if (!resolved) { resolved = true; clearTimeout(to); resolve(); } return; }
      if (hasHints && m.seq > inflightSeq) {
        inflightSeq = m.seq;
        ws.send(JSON.stringify({v:1, type:'action', seat: m.seat, actionId: crypto.randomUUID(), expectedSeq: m.seq, action: m.hints[0]}));
      }
    };
    ws.onerror = () => { clearTimeout(to); reject(new Error('ws error')); };
  });
  return { code, tokens, lastSeq };
}`;

const FOLD = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const play = document.querySelector('.gd-actionsRow__bar button');
  if (!play) return null;
  const q = play.getBoundingClientRect();
  return {
    viewportBottom: r(q.bottom),
    scrollY: r(window.scrollY),
    docBottom: r(q.bottom + window.scrollY),
    fold: window.innerHeight,
    docHeight: r(document.documentElement.scrollHeight),
  };
}`;

const browser = await chromium.launch();
const rows = [];
// Containment rides along with the fold sweep rather than being its own script:
// it needs exactly the same expensive setup (a driven room, a real dealt hand,
// a chosen viewport), and a check nobody runs is not a gate.
const containment = newTally();
for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
  const a = await ctx.newPage();
  await a.goto(BASE, { waitUntil: 'networkidle' });
  const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', 'zh-Hant');
    localStorage.setItem('pref:deckTheme', seed.theme);
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, { ...drive, theme: THEME });
  const page = await ctxB.newPage();
  await page.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await page.waitForTimeout(900);

  // Verify the theme actually took. A knob that silently does nothing would
  // make every per-theme run a re-measurement of the default (practice 13:
  // execute the claim, do not cite it).
  const gotTheme = await page.evaluate(() => localStorage.getItem('pref:deckTheme'));
  if (gotTheme !== THEME) {
    throw new Error(`deck theme did not take: wanted ${THEME}, page reports ${gotTheme}`);
  }
  const plain = await page.evaluate(`(${FOLD})()`);
  checkContainment(
    await page.evaluate(`(${CONTAINMENT_PROBE})({})`),
    `deal ${deal} @${VW}x${VH} no shelf`,
    containment,
  );

  // The worst realistic case: a set-aside shelf open as well.
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.gd-fan__card')];
    for (const i of [0, 2, 4]) cards[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  // FAIL LOUDLY if the control is not there. This used to be an optional-chained
  // dispatch: `document.querySelector('.gd-desk__setAside')?.dispatchEvent(...)`.
  // When the button was absent the press silently did nothing and the script
  // recorded the NO-SHELF layout under the "one shelf" label — a green that
  // measured the wrong thing (METHODOLOGY practice 11). It never noticed because
  // it only ever ran at 844, above the height where the control went missing.
  // Now that the viewport is a knob, that hole would open at every phone height.
  const pressed = await page.evaluate(() => {
    const btn = document.querySelector('.gd-desk__setAside');
    if (btn === null) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!pressed) {
    throw new Error(
      `deal ${deal}: no .gd-desk__setAside with a selection lifted at ${VW}x${VH} — ` +
        'the "one shelf" row would have measured the no-shelf layout',
    );
  }
  await page.waitForTimeout(500);
  const shelved = await page.evaluate(`(${FOLD})()`);
  // A shelf changes the fan's shape, so it is a second layout worth containing.
  checkContainment(
    await page.evaluate(`(${CONTAINMENT_PROBE})({})`),
    `deal ${deal} @${VW}x${VH} one shelf`,
    containment,
  );

  rows.push({ deal, plain, shelved });
  await ctx.close();
  await ctxB.close();
}

const show = (tag, m) =>
  m === null
    ? `${tag}: no action bar`
    : `${tag}: doc ${m.docBottom} vs fold ${m.fold} (viewport ${m.viewportBottom}, scrollY ${m.scrollY}, docH ${m.docHeight})` +
      `${m.docBottom > m.fold ? '  NEEDS SCROLL' : '  fits'}`;

console.log(`\n=== FOLD GATE @ INNER ${VW}x${VH} (zh-Hant) ===`);
// METHODOLOGY practice 15: say INNER, and name the chrome assumption. This
// is what `window.innerHeight` reports, NOT a device or screen size —
// playwright's `viewport` sets the inner size directly. A real machine whose
// SCREEN is ${VW}x${VH} presents roughly 90-120px less inner height once
// browser chrome is subtracted, so it is strictly WORSE than this reading.
// Recorded twice as a correction ("390x844" vs a phone's real ~664; desktop
// rows labelled as screen sizes) before it became a printed line.
console.log(
  `    inner viewport ${VW}x${VH}; browser chrome EXCLUDED. A device with a ` +
    `${VW}x${VH} SCREEN presents ~90-120px less inner height than this.`,
);
// PRINT WHAT WAS VARIED AND WHAT WAS HELD (practice 24: a result's scope belongs
// in its own output). Theme is the axis whose omission hid a 95.8% defect.
console.log(
  `    deck theme: ${THEME}  |  locale: zh-Hant  |  varied: deal only. ` +
    `Re-run with FOLD_THEME=<id> for another theme — stackStripW differs per ` +
    `theme and drives pile height, so this rate is scoped to "${THEME}".`,
);
let needScroll = 0;
for (const row of rows) {
  console.log(`deal ${row.deal}`);
  console.log('  ' + show('no shelf ', row.plain));
  console.log('  ' + show('one shelf', row.shelved));
  if ((row.plain?.docBottom ?? 0) > (row.plain?.fold ?? 0)) needScroll += 1;
}

// ---------------------------------------------------------------------------
// THE ARTIFACT IS A RATE, NOT A VERDICT.
//
// The question was never "did any deal scroll" but "how often". This script
// used to print PASS/FAIL from a 6-deal run, and that is how the false claim
// "the base layout puts Play above the fold" entered the record: at a true rate
// near 8%, a 6-deal run sees nothing on (1-0.08)^6 = 61% of runs. It reported a
// SAMPLE as a PROPERTY. Six deals could not have answered the question it was
// being asked, whichever way it came out.
// ---------------------------------------------------------------------------
const n = rows.length;

// A READING THAT DID NOT HAPPEN IS NOT A READING THAT FOUND NOTHING.
//
// FOLD() returns null when `.gd-actionsRow__bar button` does not match. Without
// this guard the null flows onward harmlessly-looking: `(null?.docBottom ?? 0) >
// (null?.fold ?? 0)` is `0 > 0` = false, so the deal counts as "fits"; the
// bucket list comes out empty; the novel-bucket check finds nothing; and the
// script prints NO REGRESSION and exits 0 having measured NOTHING. A selector
// rename would produce a perfectly green run. MIN_DEALS floors the number of
// ROWS, which is not the same as the number of MEASUREMENTS — that gap is
// exactly the class this rewrite exists to retire, so it is closed here.
const measured = rows.filter((r) => r.plain !== null).length;
const shelvedMeasured = rows.filter((r) => r.shelved !== null).length;
if (measured < n || shelvedMeasured < n) {
  console.log(
    `\nFAIL: ${n - measured} of ${n} base readings and ${n - shelvedMeasured} of ${n} shelf ` +
      `readings found no action bar. The selector '.gd-actionsRow__bar button' matched nothing — ` +
      `this run measured nothing and must not be read as a pass.`,
  );
  await browser.close();
  process.exit(1);
}
/** Wilson score interval — honest at small n, unlike the normal approximation,
 *  and it never runs off the [0,1] ends. */
function wilson95(k, total) {
  if (total === 0) return '[n/a]';
  const p = k / total, z = 1.96, d = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / d;
  return `[${Math.max(0, (centre - half) * 100).toFixed(1)}%, ${Math.min(100, (centre + half) * 100).toFixed(1)}%]`;
}

const shelfScroll = rows.filter((r) => (r.shelved?.docBottom ?? 0) > (r.shelved?.fold ?? 0)).length;
console.log(`\n--- RATE (n=${n}) ---`);
// THE COMPARISON IS BUILT IN, NOT REMEMBERED.
//
// "Play below the fold is a serious regression" is a rule the base layout has
// never satisfied: the phone's own no-shelf rate is ~12.5%, and the owner
// accepted it on the record (2026-07-25). While the gate printed a rate against
// an implied zero, every round re-discovered that gap by arguing over margins
// too small to mean anything. So the BASELINE is printed beside the rate, and
// the verdict below is expressed against it.
const BASELINES_NOSHELF = {
  // CANONICAL, and pooled deliberately. Two equally-sized samples gave 12.5%
  // (3/24) and 4.2% (1/24) — point estimates a factor of three apart, with
  // heavily overlapping intervals. Since G-FOLD now reads "must not raise the
  // rate above the measured baseline", the baseline's VALUE is load-bearing and
  // n=24 cannot pin it better than ~3x (practice 25). A baseline is measured
  // once and re-used every round, so it earns a larger n than any single
  // comparison does. Pooled: 4/48.
  //
  // VOID, AND THE VOID IS RECORDED IN THE DATA RATHER THAN IN PROSE ABOVE IT —
  // which is the whole lesson of practice 26. 844 is a phone SCREEN size; a
  // browser presents ~664 with toolbars or ~748 minimized, and at BOTH of those
  // the below-fold rate is 100% at every pile depth. So 8.3% never described any
  // phone, and a candidate layout cannot be ranked against it. The row stays for
  // provenance (rounds of decisions were taken against it and their records must
  // remain readable) and `void: true` makes the run SAY SO rather than leaving a
  // reader to notice the height.
  '390x844@lacquer': {
    rate: 0.0833, lo: 0.033, hi: 0.196, n: 48,
    note: 'VOID from 2026-07-27 — measured at an inner height no browser presents',
    void: true,
    voidReason:
      'inner 390x844 is unreachable on a phone; at 390x664 and 390x748 the rate is 100%. ' +
      'Superseded by scripts/measure-simultaneity.mjs, which has a gradient where this is saturated.',
  },
  '390x844@cinnabar-court': null,
};
const scopeKey = `${VW}x${VH}@${THEME}`;
const nsBase = BASELINES_NOSHELF[scopeKey] ?? null;
console.log(
  `WITHOUT a shelf, Play needs scrolling in ${needScroll}/${n} = ` +
    `${n ? ((needScroll / n) * 100).toFixed(1) : '0.0'}%   95% CI ${wilson95(needScroll, n)}` +
    (nsBase
      ? `\n    vs no-shelf baseline ${(nsBase.rate * 100).toFixed(1)}% ` +
        `[${(nsBase.lo * 100).toFixed(1)}%, ${(nsBase.hi * 100).toFixed(1)}%] (n=${nsBase.n}, ${nsBase.note}). ` +
        (nsBase.void === true ? '' : 'THE TARGET IS THE BASELINE, NOT ZERO.')
      : `\n    NO ACCEPTED BASELINE for ${scopeKey}. This rate is compared to nothing — an accepted\n    rate for one theme does not describe another, because stackStripW drives pile height.`),
);
// A VOID BASELINE MUST NOT READ AS A PASS. Printing a comparison against a
// number measured at an unreachable viewport is exactly the shape that let 8.3%
// steer decisions for weeks; the run refuses rather than reporting.
if (nsBase !== null && nsBase.void === true) {
  console.log(
    `\nVOID BASELINE at inner ${scopeKey}: ${nsBase.voidReason}\n` +
      '  This run measured a real rate, but it has nothing legitimate to be compared\n' +
      '  against, so it is NOT a pass and must not be quoted as one.',
  );
  process.exit(4);
}
console.log(
  `WITH one shelf:                          ${shelfScroll}/${n} = ` +
    `${n ? ((shelfScroll / n) * 100).toFixed(1) : '0.0'}%   95% CI ${wilson95(shelfScroll, n)}`,
);

// The fan's settled height is a STEP function of the dealt hand — every extra
// copy in a line's tallest column costs 21.3px — so the base positions fall
// into buckets. The bucket list is the real signal: a NEW bucket above the
// known maximum means the step function itself moved, which is a regression.
// A changed rate within known buckets is just a different draw.
const buckets = [...new Set(rows.map((r) => r.plain?.docBottom).filter((x) => x !== undefined))].sort(
  (a, b) => a - b,
);
// THE BASELINE IS PER-VIEWPORT, and it has to be. The recorded buckets below
// were all observed at 390x844; quoting them while measuring an inner 1280x800
// compares a desktop layout against a phone's step function, which is not a
// regression check at all. That is what this gate did for one run, and it
// printed "NEW bucket(s) not previously recorded: ..." immediately followed by
// "every base position falls in a known bucket" — two lines that contradict
// each other, in the summary of a gate whose whole purpose is not to be
// misread. Both defects are fixed here: the baseline is keyed by viewport, and
// an unknown viewport says so instead of borrowing another one's numbers.
const BASELINES = {
  // inner WxH -> { buckets, note }. Only the TOP matters for the one-sided
  // check; a lower bucket is a better deal, not a regression.
  '390x844@lacquer': {
    buckets: [736.9, 758.1, 767.1, 788.4, 809.6, 830.9, 852.2],
    note: 'n=80 cumulative, 2026-07-25/26, phone reference',
  },
  // AN EXPLICIT ABSENCE, IN CODE. This was a comment, and a comment satisfied
  // desktop-mode.test.ts's theme-coverage check — so the theme whose 95.8%
  // below-fold rate motivated that check passed it on a sentence. `null` is the
  // absence stated in syntax, which is what the test now demands.
  // A 6-deal bucket list was drafted here and removed: it immediately fired a
  // false REGRESSION on a seventh deal, because 6 deals cannot enumerate a step
  // function's buckets. "No baseline" is the honest state.
  '390x844@cinnabar-court': null,
  '1280x800@lacquer': {
    buckets: [641.7, 646, 664.6, 674.6, 693.2, 703.1, 721.7, 731.7, 750.3],
    note: 'n=48 cumulative, 2026-07-27, AFTER rung 0 (before it, every bucket was 831.6-936.2)',
  },
  '1024x768@lacquer': {
    buckets: [613.1, 646, 674.6, 693.2, 703.1, 721.7],
    note: 'n=24, 2026-07-27, AFTER rung 0 (before it: 100% below fold, 831.6-936.2)',
  },
};
const key = scopeKey;
const baseline = BASELINES[key] ?? null;
console.log(`base-layout document positions observed: ${buckets.join(' / ')}`);
if (baseline === null) {
  console.log(
    `NO RECORDED BASELINE for inner ${key}. The buckets above are this run's; ` +
      'they are not compared against anything. Add them to BASELINES to arm the ' +
      'regression check at this viewport — do NOT read a pass below as one.',
  );
} else {
  console.log(`known buckets at inner ${key} (${baseline.note}): ${baseline.buckets.join(' / ')}`);
  const fresh = buckets.filter((b) => !baseline.buckets.some((k) => Math.abs(k - b) < 0.5));
  if (fresh.length > 0) console.log(`NEW bucket(s) not previously recorded here: ${fresh.join(', ')}`);
}
const KNOWN_MAX = baseline === null ? Infinity : Math.max(...baseline.buckets);
const novel = buckets.filter((b) => b > KNOWN_MAX + 0.5);

if (n < MIN_DEALS) {
  console.log(
    `\nINCONCLUSIVE: n=${n} is below the ${MIN_DEALS}-deal floor this gate needs to say anything ` +
      `about a rate near 8% (at n=6 the miss probability is 61%). Re-run with FOLD_DEALS>=${MIN_DEALS}.`,
  );
  process.exit(2);
}
if (novel.length > 0) {
  console.log(
    `\nREGRESSION: base position(s) ${novel.join(', ')} exceed the known maximum ${KNOWN_MAX}. ` +
      `The fan's step function has moved — this is the signal this gate exists to catch.`,
  );
  process.exit(1);
}
// Say only what was actually checked. The previous wording asserted "every base
// position falls in a known bucket" unconditionally — including on runs that had
// just listed eight positions that were in no known bucket, and on viewports
// with no baseline at all.
// Containment is a HARD failure, unlike the below-fold rate (which is an
// accepted property of the product). A player rendering outside the table is
// never acceptable, and the one time it happened every other signal was green.
const contained = reportContainment(containment);
if (!contained) {
  console.log(
    '\nFAIL: containment. This is the check that catches a clipped seat — the ' +
      'class of bug that produces no scrollbar, no red test and a clean fold rate.',
  );
  await browser.close();
  process.exit(1);
}

if (baseline === null) {
  console.log(
    `\nNO BASELINE CHECKED at inner ${key}. The rate above is this run's measurement; ` +
      'nothing was compared, so this is not a pass. Record the buckets in BASELINES first.',
  );
} else {
  console.log(
    `\nNO REGRESSION at inner ${key}: no base position exceeds the recorded maximum ` +
      `${KNOWN_MAX}. Lower buckets are a better deal, not a regression — the check is ` +
      'one-sided by design. Read the RATE above; this line does not say "the layout fits".',
  );
}
await browser.close();
