// FOLD GATE — is Play/Pass reachable without scrolling, at true 390x844?
//
// A REQUIRED check whenever layout changes, alongside
// scripts/measure-fan-tap-targets.mjs. The fold has been the deciding
// constraint for several rounds and "Play/Pass below it" is this project's
// serious-regression class, so it gets a scripted measurement rather than an
// ad-hoc one somebody remembers to take.
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
const DEALS = Number(process.env.FOLD_DEALS ?? 6);
const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  const res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
  const a = await ctx.newPage();
  await a.goto(BASE, { waitUntil: 'networkidle' });
  const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  await page.evaluate(() =>
    document.querySelector('.gd-desk__setAside')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
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

console.log('\n=== FOLD GATE @ true 390x844 (zh-Hant) ===');
let needScroll = 0;
for (const row of rows) {
  console.log(`deal ${row.deal}`);
  console.log('  ' + show('no shelf ', row.plain));
  console.log('  ' + show('one shelf', row.shelved));
  if ((row.plain?.docBottom ?? 0) > (row.plain?.fold ?? 0)) needScroll += 1;
}
console.log(
  `\nWITHOUT a shelf, Play needs scrolling in ${needScroll}/${rows.length} deals.` +
    `\nWITH one shelf: ${rows.filter((r) => (r.shelved?.docBottom ?? 0) > (r.shelved?.fold ?? 0)).length}/${rows.length}.`,
);
// The gate fails on the BASE layout only: a shelf is opt-in, and whether its
// cost is acceptable is an owner decision recorded in STATUS, not something
// this script should silently ratify.
console.log(needScroll === 0 ? 'PASS: the base layout puts Play above the fold' : 'FAIL: the BASE layout needs scrolling');
await browser.close();
process.exit(needScroll === 0 ? 0 : 1);
