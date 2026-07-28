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

import { CONTAINMENT_PROBE, checkContainment, newTally, reportContainment } from './containment.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const DEALS = Number(process.env.CONTAIN_DEALS ?? 2);
// Every mode boundary this project has, plus one either side of each, because a
// layout bug lives at a breakpoint far more often than in the middle of a band.
// NO DEFAULT VIEWPORT LIST — and this file is why the rule had to be widened.
// It defaulted to a ten-viewport list whose FIRST entry was 390x844, the inner
// height measure-fold.mjs records as `void: true`. The test that banned default
// dimensions looked for `process.env.X ?? <number>`; a comma-separated string
// slipped straight through it, so the CI gate went on measuring a height no
// browser presents while the rule read as absolute.
if (process.env.CONTAIN_VIEWPORTS === undefined) {
  console.log(
    '\nCONTAIN_VIEWPORTS is REQUIRED — there is deliberately no default list.\n\n' +
      '  Real phone INNER heights at 390 wide: ~664 with toolbars, ~748 minimized.\n' +
      '  Desktop maximized: ~681 on a 1366x768 laptop, ~813 on 1440x900.\n' +
      '  844 is a SCREEN size no browser presents as an inner height.\n\n' +
      '  e.g.  CONTAIN_VIEWPORTS=390x664,720x900 node scripts/check-containment.mjs\n',
  );
  process.exit(2);
}
const VIEWPORTS = process.env.CONTAIN_VIEWPORTS
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w, h };
  });

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'CONTAIN_VIEWPORTS (required)' },
  viewportHeight: { value: 'CONTAIN_VIEWPORTS (required)' },
  deckTheme: { value: 'lacquer', justification: 'containment is a box-model property; a theme changes paint, not the boxes' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'UNTIMED', justification: 'PREDATES the timing finding; containment is horizontal and the countdown bar is vertical, so it cannot reach the result' },
  shelf: { value: 'none and one-shelf, both measured' },
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

// The DRIVER page's viewport, which is not a measurement and must not be read
// as one. This page only runs fetch + a WebSocket to fast-forward a room to
// seat 0's turn; nothing is measured in it and its size cannot reach any figure
// this gate reports. Named rather than inlined so that the rule "no gate script
// hardcodes a viewport" (tests/unit/client/desktop-mode.test.ts) stays absolute
// for the pages that DO get measured — an exemption in the test would be a hole
// someone later widens; a named constant is a hole with a label on it.
const DRIVER_VIEWPORT = { width: 1280, height: 800 };

const browser = await chromium.launch();
const tally = newTally();
// How many probes actually had a joker staged — the card-frame assertion is vacuous
// without one, so a clean run must say whether the case was present at all.
let jokerRuns = 0;
console.log('=== CONTAINMENT CHECK ===');
console.log(
  `INNER viewports (browser chrome EXCLUDED — these are not screen sizes): ` +
    VIEWPORTS.map((v) => `${v.w}x${v.h}`).join(', '),
);
console.log(`${DEALS} deal(s) per viewport, each measured with NO shelf and with ONE shelf open.\n`);

for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: DRIVER_VIEWPORT });
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

    // STAGE A JOKER IF THE HAND HAS ONE, so the card-frame assertion has the case it
    // exists for. The frame-inflation defect needs a card with NO IN-FLOW TEXT — a
    // joker, whose art is position:absolute — inside a wrapper that baseline-aligns it.
    // Without one staged, the probe examines only cards whose rank text supplies a
    // baseline above the bottom, where no descender is reserved and nothing is wrong.
    // A first version of this gate ran the assertion without staging anything and
    // passed a deliberately reverted fix; that is a vacuous check, not a green one.
    const jokerStaged = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('.gd-fan__card')];
      // By CLASS, not by the localised aria-label. A label match would have been a CJK
      // literal in a script file (the english-only sweep catches that, and did) and it
      // would silently stop matching in another locale — the joker is what matters, not
      // its name.
      const joker = cards.find((c) => c.querySelector('.gd-card--joker') !== null);
      if (joker === undefined) return false;
      joker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    if (jokerStaged) {
      await p.waitForTimeout(250);
      checkContainment(
        await p.evaluate(`(${CONTAINMENT_PROBE})({})`),
        `${label} joker staged`,
        tally,
      );
      await p.evaluate(() => {
        for (const c of document.querySelectorAll('.gd-fan__card[aria-pressed="true"]')) {
          c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
      await p.waitForTimeout(120);
    }
    jokerRuns += jokerStaged ? 1 : 0;

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
  `\nCARD-FRAME ASSERTION: a joker was staged on ${jokerRuns} probe(s). ` +
    (jokerRuns === 0
      ? 'ZERO — that assertion examined no card without in-flow text and proves nothing this run.'
      : 'The frame-inflation case was present and clean.'),
);
console.log(
  `\nPASS. NOTE THE LIMIT: ${DEALS} deal(s) per viewport catches STRUCTURAL ` +
    'violations, not ones that need a rare hand (a 15-column fan is ~3.4% of ' +
    'deals). The manual measure-fold.mjs sweep at n>=24 is what covers those ' +
    'and is not replaced by this.',
);
