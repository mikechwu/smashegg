// Fan tap-target sweep — the REQUIRED visual-gate check for ANY fan or
// selection-rendering change (silent-no-op round F3; docs/research/
// fan-tap-targets.md). Not a look: a MEASUREMENT, at a viewport the caller
// must name (TAP_W/TAP_H — see the refusal below for why there is no default).
//
// What it does: drives a fresh untimed dev room to a settled 27-card hand
// (zh-Hant), then for EVERY card, selects it alone and grid-samples
// document.elementFromPoint over EVERY card's rect — the actually-tappable
// area, not the painted one. The pinned outcome is ZERO VICTIMS: no card's
// tappable area may drop more than the sampling tolerance (100px^2) below
// its own baseline in any single-selection state. Exit 1 on any victim.
//
// Why it exists: the variant-D hit/paint decoupling (table.css — the lift
// transform lives on the card FACE with pointer-events:none, never on the
// button) can silently revert; the CSS pins catch the two named vectors,
// this sweep is the end-to-end enforcement.
//
// Run: dev servers up (npm run cf:dev + npm run dev:client), then
//   TAP_W=390 TAP_H=664 node scripts/measure-fan-tap-targets.mjs
// Requires playwright + a chromium (npm i -D playwright && npx playwright
// install chromium) — deliberately NOT a repo dependency; this is a
// manual gate script. BASE overridable via FAN_SWEEP_BASE.
//
// The embedded config is a dump of the engine's JIANGSU_OFFICIAL_ONLINE
// default (room creation needs a full RuleVariant); if the variant schema
// changes, re-dump it (the server rejects a stale shape loudly).


const BASE = process.env.FAN_SWEEP_BASE ?? 'http://localhost:5173';

// NO DEFAULT VIEWPORT — and this file is WHY the rule exists rather than an
// application of it. It hardcoded `{ width: 390, height: 844 }` at two call
// sites, directly beneath its own comment saying "a phone whose SCREEN is
// 390x844 presents ~664 of inner height, which is a different layout". The
// record was made and the value was not changed: METHODOLOGY practice 26, live
// in the tree, in the one gate that is REQUIRED for any fan change. Every
// tap-target figure this project holds was therefore measured at a height no
// phone presents — and scripts/measure-setaside.mjs separately documents that
// below inner ~765 the set-aside control disappears entirely, so the phone's
// real fan layout is not the one that was swept.
if (process.env.TAP_W === undefined || process.env.TAP_H === undefined) {
  console.log(
    '\nTAP_W and TAP_H are REQUIRED — there is deliberately no default.\n\n' +
      '  This gate hardcoded 390x844 for its whole life. 844 is a phone SCREEN\n' +
      '  size; a browser presents ~664 inner with toolbars, ~748 minimized. A\n' +
      '  tap-target sweep at 844 measures a fan the phone never renders.\n\n' +
      '  e.g.  TAP_W=390 TAP_H=664 node scripts/measure-fan-tap-targets.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.TAP_W);
const VH = Number(process.env.TAP_H);

// The playwright import is DYNAMIC and deliberately BELOW the viewport guard.
//
// Static ESM imports are hoisted, so with `import { chromium } from 'playwright'`
// at the top this script cannot reach its own refusal in an environment without
// playwright — and playwright is deliberately not a repo dependency, so that
// includes CI. The guard must be observable from outside for the rule "no gate
// script inherits a viewport" to be checked by RUNNING the script rather than by
// grepping it. Grepping it is what failed: the previous check matched one
// spelling of `viewport: { width: N, height: N }` and was defeated by hoisting
// the literal into a named constant.
const { chromium } = await import('playwright');
export const AXES_PINNED = {
  viewportWidth: { value: 'TAP_W (required)' },
  viewportHeight: { value: 'TAP_H (required)' },
  deckTheme: { value: 'lacquer', justification: 'hit geometry comes from the card BUTTON box, which no theme changes; the theme changes only the painted face' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'UNTIMED', justification: 'the desk is not in this sweep\'s hit-test scope' },
  shelf: { value: 'none' },
  handSort: { value: 'ascending' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both' },
  turnDecidability: { value: 'both' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
  browserChrome: { value: 'none (headless inner size)', justification: 'inner size set directly' },
  handSize: { value: '27' },
};

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

// POST /api/rooms is rate-limited to 15 creates / 60s per IP (CREATE_LIMITER).
// Without a retry this gate dies on an opaque `ws error` — the 429 body is not
// JSON, so `res.json()` throws, `code` is undefined, and the socket opens
// against `/api/rooms/undefined/ws`. That is exactly what happened when it ran
// alongside the fold gate. measure-fold.mjs already learned this ("a gate that
// cannot complete its own sample size is not a gate"); the same retry belongs
// here, because the SIGNAL of the failure pointed at the WebSocket rather than
// at the create, which is how it stayed misdiagnosed.
const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 6000));
  }
  if (res === null || !res.ok) throw new Error('room create failed: ' + (res ? res.status : 'no response'));
  const { code } = await res.json();
  const tokens = [];
  let lastSeq = 0;
  const ws = new WebSocket('ws://' + location.host + '/api/rooms/' + code + '/ws');
  window.__driveWs = ws; // keep alive: it holds seats 1-3 so the hand never changes
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('drive timeout')), 120000);
    let inflightSeq = -1;
    let resolved = false;
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

const MEASURE = `() => {
  const cards = [...document.querySelectorAll('.gd-fan__card')];
  const GRID = 5;
  return cards.map((el) => {
    const r = el.getBoundingClientRect();
    const x0 = Math.max(0, r.left), x1 = Math.min(window.innerWidth, r.right);
    const y0 = Math.max(0, r.top), y1 = Math.min(window.innerHeight, r.bottom);
    let owned = 0;
    for (let x = x0 + GRID / 2; x < x1; x += GRID) {
      for (let y = y0 + GRID / 2; y < y1; y += GRID) {
        const hit = document.elementFromPoint(x, y);
        if (hit !== null && (hit === el || el.contains(hit))) owned += 1;
      }
    }
    return { label: el.getAttribute('aria-label'), ownedPx: owned * GRID * GRID };
  });
}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
const pageA = await ctx.newPage();
await pageA.goto(BASE, { waitUntil: 'networkidle' });
const drive = await pageA.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
console.log('room:', drive.code);
// METHODOLOGY practice 15: state the viewport in INNER dimensions and name
// the chrome assumption, so no threshold here can be re-quoted as a screen
// size. This prints what was actually used, not a literal that can drift away
// from the `newContext` call above it — which is how the old line kept saying
// "390x844" truthfully while describing a layout no phone renders.
console.log(
  `inner viewport ${VW}x${VH}; browser chrome EXCLUDED (not a screen size). ` +
    `A device whose SCREEN is ${VW}x${VH} presents ~90-120px less inner height.`,
);

const ctxB = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
await ctxB.addInitScript((seed) => {
  localStorage.setItem('locale', 'zh-Hant');
  localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
}, drive);
const page = await ctxB.newPage();
await page.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 27, null, { timeout: 60000 });
await page.waitForTimeout(800);

const baseline = await page.evaluate(`(${MEASURE})()`);
const clickCard = (i) => page.evaluate((idx) => {
  document.querySelectorAll('.gd-fan__card')[idx]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, i);

let victims = 0;
for (let i = 0; i < baseline.length; i += 1) {
  await clickCard(i);
  await page.waitForTimeout(50);
  const m = await page.evaluate(`(${MEASURE})()`);
  for (let j = 0; j < m.length; j += 1) {
    if (j !== i && m[j].ownedPx < baseline[j].ownedPx - 100) {
      victims += 1;
      console.log(`VICTIM: select #${i} ${baseline[i].label} -> #${j} ${m[j].label} ${baseline[j].ownedPx} -> ${m[j].ownedPx}`);
    }
  }
  await clickCard(i);
  await page.waitForTimeout(40);
}

const spread = baseline.map((c) => c.ownedPx).sort((a, b) => a - b);
console.log(`baseline px^2 min/median/max: ${spread[0]} / ${spread[spread.length >> 1]} / ${spread[spread.length - 1]}`);

// ---------------------------------------------------------------------------
// SORT AREAS: the SEAM is a DESTRUCTIVE control (it moves cards between bands),
// and variant D's documented near-miss means a tap aimed at the top of a lifted
// card lands on whatever sits above that card's hit box. Relocating the seam out
// of the lift strip is only half the fix — the state has to be MEASURED, or a
// destructive mis-tap hides in geometry nobody sweeps. This phase builds a real
// shelf through the real controls and re-runs the sweep in that state.
// ---------------------------------------------------------------------------
let seamFailures = 0;
const madeShelf = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.gd-fan__card')];
  for (const i of [0, 2, 4]) cards[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return cards.length > 0;
});
await page.waitForTimeout(200);
const pressed = await page.evaluate(() => {
  const btn = document.querySelector('.gd-desk__setAside');
  if (!btn) return false;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
});
await page.waitForTimeout(350);

const seamCount = await page.evaluate(
  () => document.querySelectorAll('.gd-fan__seam, .gd-fan__runTag').length,
);
if (!madeShelf || !pressed || seamCount === 0) {
  console.log(`SKIP: could not build a shelf (madeShelf=${madeShelf} pressed=${pressed} seams=${seamCount})`);
  seamFailures += 1;
} else {
  // (a) No point inside ANY card may resolve to a seam, in every single-selection
  //     state — the same sweep shape as above, but the thief we look for is the
  //     destructive control rather than a neighbouring card.
  const SEAM_STEAL = `() => {
    const cards = [...document.querySelectorAll('.gd-fan__card')];
    // BOTH destructive controls inside the fan: the shelf's seam and each
    // recorded group's bar. The bar is only 26px tall and sits directly under
    // its run — i.e. in the region where variant D's near-miss is VERTICAL —
    // so it belongs in the measured coverage, not just the seam.
    const seams = [...document.querySelectorAll('.gd-fan__seam, .gd-fan__runTag')];
    const GRID = 5;
    let stolen = 0;
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      for (let x = r.left + GRID / 2; x < r.right; x += GRID) {
        for (let y = r.top + GRID / 2; y < r.bottom; y += GRID) {
          const hit = document.elementFromPoint(x, y);
          if (hit && seams.some((s) => s === hit || s.contains(hit))) stolen += 1;
        }
      }
    }
    return stolen;
  }`;
  const areaCards = await page.evaluate(() => document.querySelectorAll('.gd-fan__card').length);
  let stolenTotal = 0;
  for (let i = 0; i < areaCards; i += 1) {
    await clickCard(i);
    await page.waitForTimeout(30);
    stolenTotal += await page.evaluate(`(${SEAM_STEAL})()`);
    await clickCard(i);
    await page.waitForTimeout(25);
  }
  // (b) The GAP the safety argument rests on: a lifted face paints 14px above
  //     its hit box, so the seam must sit further than that from the next band.
  const gap = await page.evaluate(() => {
    const seams = [...document.querySelectorAll('.gd-fan__seam, .gd-fan__runTag')];
    const cards = [...document.querySelectorAll('.gd-fan__card')];
    let min = Infinity;
    for (const s of seams) {
      const sb = s.getBoundingClientRect().bottom;
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (r.top >= sb) min = Math.min(min, r.top - sb);
      }
    }
    return min === Infinity ? null : Math.round(min * 10) / 10;
  });
  const LIFT_PX = 14;
  // The clearance that actually matters is measured against the LIFTED PAINT,
  // not the hit box: a selected face paints LIFT_PX above its own button, so
  // the visible top of a lifted card is that much closer to the seam than the
  // hit-box gap suggests. The first version of this check reported the hit-box
  // number and read as a stronger guarantee than it was (Codex UI audit).
  const paintClearance = gap === null ? null : Math.round((gap - LIFT_PX) * 10) / 10;
  if (stolenTotal > 0) {
    console.log(`SEAM FAIL: ${stolenTotal} sampled points inside a card resolve to a seam`);
    seamFailures += 1;
  }
  if (paintClearance === null || paintClearance <= 0) {
    console.log(`SEAM FAIL: seam overlaps the lifted paint (clearance ${paintClearance}px)`);
    seamFailures += 1;
  }
  console.log(
    seamFailures === 0
      ? `PASS: seam state swept — 0 stolen points; gap to hit box ${gap}px, clearance above lifted paint ${paintClearance}px`
      : 'FAIL: seam state',
  );
}

console.log(victims === 0 ? 'PASS: zero victims across the full sweep' : `FAIL: ${victims} victim measurements`);
await browser.close();
process.exit(victims === 0 && seamFailures === 0 ? 0 : 1);
