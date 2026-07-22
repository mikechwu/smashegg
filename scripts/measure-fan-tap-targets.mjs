// Fan tap-target sweep — the REQUIRED visual-gate check for ANY fan or
// selection-rendering change (silent-no-op round F3; docs/research/
// fan-tap-targets.md). Not a look: a MEASUREMENT at true 390x844.
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
//   node scripts/measure-fan-tap-targets.mjs
// Requires playwright + a chromium (npm i -D playwright && npx playwright
// install chromium) — deliberately NOT a repo dependency; this is a
// manual gate script. BASE overridable via FAN_SWEEP_BASE.
//
// The embedded config is a dump of the engine's JIANGSU_OFFICIAL_ONLINE
// default (room creation needs a full RuleVariant); if the variant schema
// changes, re-dump it (the server rejects a stale shape loudly).

import { chromium } from 'playwright';

const BASE = process.env.FAN_SWEEP_BASE ?? 'http://localhost:5173';
const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  const res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
const pageA = await ctx.newPage();
await pageA.goto(BASE, { waitUntil: 'networkidle' });
const drive = await pageA.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
console.log('room:', drive.code);

const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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

const areas = baseline.map((c) => c.ownedPx).sort((a, b) => a - b);
console.log(`baseline px^2 min/median/max: ${areas[0]} / ${areas[areas.length >> 1]} / ${areas[areas.length - 1]}`);
console.log(victims === 0 ? 'PASS: zero victims across the full sweep' : `FAIL: ${victims} victim measurements`);
await browser.close();
process.exit(victims === 0 ? 0 : 1);
