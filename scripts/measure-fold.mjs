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
const VW = Number(process.env.FOLD_W ?? 390);
const VH = Number(process.env.FOLD_H ?? 844);
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
for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
  const a = await ctx.newPage();
  await a.goto(BASE, { waitUntil: 'networkidle' });
  const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', 'zh-Hant');
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, drive);
  const page = await ctxB.newPage();
  await page.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await page.waitForTimeout(900);

  const plain = await page.evaluate(`(${FOLD})()`);

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

  rows.push({ deal, plain, shelved });
  await ctx.close();
  await ctxB.close();
}

const show = (tag, m) =>
  m === null
    ? `${tag}: no action bar`
    : `${tag}: doc ${m.docBottom} vs fold ${m.fold} (viewport ${m.viewportBottom}, scrollY ${m.scrollY}, docH ${m.docHeight})` +
      `${m.docBottom > m.fold ? '  NEEDS SCROLL' : '  fits'}`;

console.log(`\n=== FOLD GATE @ true ${VW}x${VH} (zh-Hant) ===`);
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
console.log(
  `WITHOUT a shelf, Play needs scrolling in ${needScroll}/${n} = ` +
    `${n ? ((needScroll / n) * 100).toFixed(1) : '0.0'}%   95% CI ${wilson95(needScroll, n)}`,
);
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
// Observed across n=16, n=24 and n=40 runs on 2026-07-25/26. A bucket BELOW
// this range is a better deal, not a regression — only the top matters, which
// is why the check below is one-sided.
const KNOWN_BUCKETS = [736.9, 758.1, 767.1, 788.4, 809.6, 830.9, 852.2];
console.log(`base-layout document positions observed: ${buckets.join(' / ')}`);
console.log(`known buckets (n=80 cumulative, 2026-07-26): ${KNOWN_BUCKETS.join(' / ')}  (fold 844)`);
const fresh = buckets.filter((b) => !KNOWN_BUCKETS.some((k) => Math.abs(k - b) < 0.5));
if (fresh.length > 0) console.log(`NEW bucket(s) not previously recorded: ${fresh.join(', ')}`);
const KNOWN_MAX = 852.2;
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
console.log(
  `\nNO REGRESSION: every base position falls in a known bucket. The ~8% below-fold rate is the ` +
    `ACCEPTED state of the product (owner decision 2026-07-25), not a failure — see STATUS.md. ` +
    `Read the rate above; do not read this line as "the base layout fits", which is false.`,
);
await browser.close();
