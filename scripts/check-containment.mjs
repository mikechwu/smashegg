// CONTAINMENT, as a CI-affordable check.
//
// THE DECISION THIS FILE EMBODIES (owner asked for it to be explicit rather
// than implicit). The fold and tap-target gates are MANUAL because playwright
// is deliberately not a repo dependency, so they run only when someone
// remembers. Containment just caught a whole player rendered off-screen while
// every other signal stayed green, which makes "only when someone remembers"
// too weak for that particular class.
//
// The split is by the nature of the property, not by convenience:
//
//   CONTAINMENT is (mostly) DETERMINISTIC. A box that escapes its container
//   escapes on every deal, at a given viewport — the clipped seat did. A small
//   sample is therefore adequate, so this runs in CI on every push.
//
//   The FOLD RATE is DEAL-DEPENDENT. It is a step function of the dealt hand,
//   so it needs n>=24 to say anything (practice 12), which is minutes per
//   viewport. That stays MANUAL, at the sample sizes measure-fold.mjs enforces.
//
// The honest limit of this check, stated rather than left to be discovered: at
// n=CONTAIN_DEALS it catches STRUCTURAL violations — a wrong box model, a cap
// that lets a child overflow, a rule that escapes its media query. It does NOT
// reliably catch a violation that only a rare hand produces (a 15-column fan
// overflowing a narrow zone occurs on ~3.4% of deals). The manual sweep is
// what covers those, and it is not replaced by this.
//
// Run: `npm run build && npx wrangler dev` (or any server), then
// `BASE=http://localhost:8787 node scripts/check-containment.mjs`.

import { chromium } from 'playwright';
import { CONTAINMENT_PROBE, checkContainment, newTally, reportContainment } from './containment.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const DEALS = Number(process.env.CONTAIN_DEALS ?? 2);
// Every mode boundary this project has, plus one either side of each, because a
// layout bug lives at a breakpoint far more often than in the middle of a band.
const VIEWPORTS = (
  process.env.CONTAIN_VIEWPORTS ??
  '390x844,390x664,719x900,720x900,1024x768,1280x800,1400x900,1440x900,1920x1080,2478x1400'
)
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w, h };
  });

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

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
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/rooms/' + code + '/ws');
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

const browser = await chromium.launch();
const tally = newTally();
console.log('=== CONTAINMENT CHECK ===');
console.log(
  `INNER viewports (browser chrome EXCLUDED — these are not screen sizes): ` +
    VIEWPORTS.map((v) => `${v.w}x${v.h}`).join(', '),
);
console.log(`${DEALS} deal(s) per viewport, each measured with NO shelf and with ONE shelf open.\n`);

for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx.newPage();
  await a.goto(BASE, { waitUntil: 'networkidle' });
  const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
  // Driver context stays open: closing it lets the DO's 60s disconnect grace
  // auto-play seat 0's turn part-way through the sweep.
  for (const vp of VIEWPORTS) {
    const c = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await c.addInitScript((s) => {
      localStorage.setItem('locale', 'zh-Hant');
      localStorage.setItem('room:' + s.code, JSON.stringify({ tokens: [s.tokens[0]], lastSeenSeq: s.lastSeq }));
    }, drive);
    const p = await c.newPage();
    await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
    await p.waitForTimeout(700);

    const label = `deal ${deal} @${vp.w}x${vp.h}`;
    const clean = checkContainment(await p.evaluate(`(${CONTAINMENT_PROBE})({})`), `${label} no shelf`, tally);

    // A SHELF is a different layout — side by side on desktop, banded on the
    // phone — so it gets its own probe. This is the state the widened
    // `:has(.gd-fan--split)` cap exists for, and therefore the state where a
    // wrong cap would show.
    await p.evaluate(() => {
      const cards = [...document.querySelectorAll('.gd-fan__card')];
      for (const i of [0, 2, 4]) cards[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    const pressed = await p.evaluate(() => {
      const btn = document.querySelector('.gd-desk__setAside');
      if (btn === null) return false;
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    if (!pressed) {
      throw new Error(`${label}: no set-aside control — the shelf half of this check measured nothing`);
    }
    await p.waitForTimeout(450);
    const cleanShelf = checkContainment(
      await p.evaluate(`(${CONTAINMENT_PROBE})({})`),
      `${label} one shelf`,
      tally,
    );
    console.log(`  ${label}: no shelf ${clean ? 'ok' : 'VIOLATION'}, one shelf ${cleanShelf ? 'ok' : 'VIOLATION'}`);
    await c.close();
  }
  await ctx.close();
}
await browser.close();

const ok = reportContainment(tally);
if (!ok) {
  console.log(
    '\nFAIL: containment. An element renders outside its container. This is the ' +
      'class that produces no scrollbar, no red test and a clean fold rate — ' +
      'see scripts/containment.mjs for why the container\'s own overflow-x hides it.',
  );
  process.exit(1);
}
console.log(
  `\nPASS. NOTE THE LIMIT: ${DEALS} deal(s) per viewport catches STRUCTURAL ` +
    'violations, not ones that need a rare hand (a 15-column fan is ~3.4% of ' +
    'deals). The manual measure-fold.mjs sweep at n>=24 is what covers those ' +
    'and is not replaced by this.',
);
