// SIMULTANEITY GATE — the replacement for the phone fold metric.
//
// WHAT IT REPLACES AND WHY. The fold gate asked "is Play/Pass above the fold at
// scrollY=0". At inner 390x844 that read ~8%; 844 is a phone SCREEN size no
// browser presents, and at a real 390x664 the answer is 100% at every pile
// depth. So the metric had no discriminating power left on a phone: every
// candidate layout scores 100% and the gate ranks nothing.
//
// What the fold metric was actually protecting was never "no scrolling". It was
// the player's ability to decide. `ScrollActionsIntoView` guarantees the action
// row is REACHED; it guarantees nothing about what LEAVES the screen to make
// room. That is the property this measures, and it is the one that still has a
// gradient: a taller shelf indicator costs nothing on a metric that is already
// saturated at 100%, and costs real pixels here.
//
// THE MEASUREMENT IS STRUCTURAL FIRST (practice 14). "Does a scroll offset exist
// that shows every must-see fact" is decided by the union span against innerH,
// not by where the page happens to be scrolled. Sampling answers only how often
// and by how much. See scripts/simultaneity.mjs for the derivation and for the
// MUST_SEE set, which is the definition this rests on and is stated there so it
// can be argued with.
//
// Run: dev server up, then
//   SIM_W=390 SIM_H=664 node scripts/measure-simultaneity.mjs
// Requires playwright + chromium (deliberately NOT a repo dependency — a manual
// gate, same policy as the fold and tap-target sweeps).

import { CONTAINMENT_PROBE, checkContainment, newTally, reportContainment } from './containment.mjs';
import {
  PROFILES,
  SIMULTANEITY_PROBE,
  newSimTally,
  recordSimultaneity,
  reportScrollTrade,
  reportSimultaneity,
  spanFor,
} from './simultaneity.mjs';

const BASE = process.env.SIM_BASE ?? 'http://localhost:8787';

// NO DEFAULT VIEWPORT. Same rule as measure-fold.mjs, for the same reason: a
// wrong default steered every phone figure in this repo for weeks while a
// comment eleven lines above it said the default was wrong (practice 26).
if (process.env.SIM_W === undefined || process.env.SIM_H === undefined) {
  console.log(
    '\nSIM_W and SIM_H are REQUIRED — there is deliberately no default.\n\n' +
      '  Real phone INNER heights at 390 wide: ~664 with toolbars, ~748 minimized.\n' +
      '  844 is the SCREEN size and no browser presents it.\n' +
      '  Desktop: a maximized window on a 1366x768 laptop gives ~681 inner;\n' +
      '  1440x900 gives ~813; 1512x982 gives ~895 (macOS Chrome, ~87px chrome).\n\n' +
      '  e.g.  SIM_W=390 SIM_H=664 node scripts/measure-simultaneity.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.SIM_W);
const VH = Number(process.env.SIM_H);

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

// Deal-dependent (the fan's height is a step function of the hand), so this
// needs a real sample, and the floor below which it refuses to conclude is
// stated rather than assumed (practice 12).
const DEALS = Number(process.env.SIM_DEALS ?? 24);
const MIN_DEALS = Number(process.env.SIM_MIN_DEALS ?? 12);
// stackStripW is per-theme and drives pile height, which drives fan height,
// which is a term in the span. A run that does not name its theme is scoped to
// one theme whether or not it says so.
const THEME = process.env.SIM_THEME ?? 'lacquer';
// Whether to open a set-aside shelf as the second, worst-realistic state.
const SHELF = process.env.SIM_SHELF !== '0';

export const AXES_PINNED = {
  viewportWidth: { value: 'SIM_W (required)' },
  viewportHeight: { value: 'SIM_H (required)' },
  deckTheme: { value: 'SIM_THEME, default lacquer' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'UNTIMED', justification: 'PREDATES the timing finding and is a KNOWN GAP: the product default is the standard preset, whose countdown bar adds 8.0px of desk. This gate has not yet been re-run timed' },
  shelf: { value: 'none and one-shelf, both measured' },
  handSort: { value: 'descending' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both, reported pooled', justification: 'the per-profile table pools them; the split lives in fan-height-distribution.mjs and validate-fan-model.mjs' },
  turnDecidability: { value: 'both', justification: 'stops at seat 0 first hints regardless of whether a play is available' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
  browserChrome: { value: 'none (headless inner size)', justification: 'inner size set directly; chrome stated as an assumption' },
  handSize: { value: '27 (first decision)' },
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

const browser = await chromium.launch();
const settled = newSimTally();
const atTop = newSimTally();
const stagedTally = newSimTally();
const shelfTally = newSimTally();
const containment = newTally();
let scrolls = 0;

console.log(`=== SIMULTANEITY @ INNER ${VW}x${VH} ===`);
console.log(
  `    INNER viewport; browser chrome EXCLUDED. A device whose SCREEN is ` +
    `${VW}x${VH} presents ~90-120px less inner height than this and is therefore WORSE.`,
);
console.log(`    deck theme: ${THEME} | locale: zh-Hant | varied: deal only | n=${DEALS}`);
console.log(
  `    Each deal probed at the SETTLED scroll (what the player sees), at scrollY=0\n` +
    `    (what the auto-scroll traded away), and with ONE CARD STAGED — the state the\n` +
    `    player actually DECIDES in, where the desk grows a card row` +
    `${SHELF ? ', plus one set-aside shelf open' : ''}.\n`,
);

for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
  const a = await ctx.newPage();
  await a.goto(BASE, { waitUntil: 'networkidle' });
  const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', 'zh-Hant');
    localStorage.setItem('pref:deckTheme', seed.theme);
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, { ...drive, theme: THEME });
  const page = await ctxB.newPage();
  await page.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  // Let ScrollActionsIntoView run and the layout settle. The probe is taken
  // POST-SCROLL deliberately: this metric is about what the auto-scroll costs,
  // so the compensator is the subject, not an error to be removed (practice 11
  // — name the compensator; here it is named and measured rather than disabled).
  await page.waitForTimeout(900);

  const gotTheme = await page.evaluate(() => localStorage.getItem('pref:deckTheme'));
  if (gotTheme !== THEME) {
    throw new Error(`deck theme did not take: wanted ${THEME}, page reports ${gotTheme}`);
  }

  const s = recordSimultaneity(
    await page.evaluate(`(${SIMULTANEITY_PROBE})({})`),
    `deal ${deal} settled`,
    settled,
  );
  if (s.scrollY > 0.5) scrolls += 1;
  checkContainment(
    await page.evaluate(`(${CONTAINMENT_PROBE})({})`),
    `deal ${deal} @${VW}x${VH} settled`,
    containment,
  );

  // The counterfactual: the same layout at the top of the document. The
  // difference between these two rows IS the auto-scroll's cost, which is the
  // quantity the old fold metric could not see at all.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  recordSimultaneity(await page.evaluate(`(${SIMULTANEITY_PROBE})({})`), `deal ${deal} top`, atTop);

  // THE DECISION MOMENT, which the un-staged reading is not.
  //
  // Every simultaneity figure before 2026-07-27 was taken with NO cards staged.
  // But a player stages, then decides — so the un-staged state is one the player
  // passes THROUGH, and the state the metric is about is the one after. Staging
  // opens `.gd-desk__stage`, a card row worth +54.0px of desk, and the span is
  // additive in desk height (scripts/derive-span.mjs), so the whole 54px lands
  // on the budget. Measuring only the un-staged state overstated the slack at
  // 390x664 from ~+1px to +55px.
  //
  // ONE card is the worst case, not a sample of it: the stage is a flex row with
  // no wrap, capped at DESK_STAGE_MAX_FACES = 10 faces and then a "+N" pill, so
  // its height saturates at the first card. Verified 0..12 in derive-span.mjs.
  const staged1 = await page.evaluate(() => {
    const c = document.querySelector('.gd-fan__card');
    if (c === null) return false;
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!staged1) {
    throw new Error(`deal ${deal}: no .gd-fan__card to stage — the staged row would measure the un-staged layout`);
  }
  await page.waitForTimeout(260);
  const st = recordSimultaneity(
    await page.evaluate(`(${SIMULTANEITY_PROBE})({})`),
    `deal ${deal} staged`,
    stagedTally,
  );
  if (st.facts.find((f) => f.key === 'desk') === undefined) {
    throw new Error(`deal ${deal}: desk vanished while staged — the staged reading is not of the desk state`);
  }

  if (SHELF) {
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.gd-fan__card')];
      // Card 0 is already staged by the step above; clicking it again would
      // UNstage it, so this adds to the selection rather than toggling it.
      for (const i of [2, 4]) cards[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const pressed = await page.evaluate(() => {
      const btn = document.querySelector('.gd-desk__setAside');
      if (btn === null) return false;
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    if (!pressed) {
      throw new Error(
        `deal ${deal}: no .gd-desk__setAside with a selection lifted at ${VW}x${VH} — ` +
          'the shelf row would have measured the no-shelf layout',
      );
    }
    await page.waitForTimeout(600);
    recordSimultaneity(
      await page.evaluate(`(${SIMULTANEITY_PROBE})({})`),
      `deal ${deal} one shelf`,
      shelfTally,
    );
    checkContainment(
      await page.evaluate(`(${CONTAINMENT_PROBE})({})`),
      `deal ${deal} @${VW}x${VH} one shelf`,
      containment,
    );
  }

  // The per-deal line shows BOTH the strictest and the panel-converged reading,
  // because the gap between them is how much of the verdict is the definition
  // rather than the layout.
  const strict = spanFor(s, PROFILES['in-house'].facts);
  const panel = spanFor(s, PROFILES.panel.facts);
  console.log(
    `  deal ${String(deal).padStart(2)}: in-house ${String(strict.span).padStart(7)}px ` +
      `${strict.feasible ? 'fits ' : `SHORT ${String(strict.deficit).padStart(6)}`}  |  ` +
      `panel ${String(panel.span).padStart(7)}px ` +
      `${panel.feasible ? 'fits ' : `SHORT ${String(panel.deficit).padStart(6)}`}  |  ` +
      `vs ${VH}  scrollY ${String(s.scrollY).padStart(6)}`,
  );

  await ctx.close();
  await ctxB.close();
}
await browser.close();

console.log(`\nauto-scroll fired (scrollY > 0) on ${scrolls}/${DEALS} deals.`);

console.log('\n############ SETTLED (what the player actually sees) ############');
const okSettled = reportSimultaneity(settled, { innerW: VW, innerH: VH, at: 'the settled scroll' });
console.log('\n############ AT scrollY=0 (what the auto-scroll traded away) ############');
reportSimultaneity(atTop, { innerW: VW, innerH: VH, at: 'scrollY=0' });
const tradeOk = reportScrollTrade(atTop, settled);
console.log('\n############ WITH ONE CARD STAGED (the decision moment) ############');
console.log(
  'This is the state a player decides IN. The un-staged reading above is one they\n' +
    'pass THROUGH; staging opens the desk stage row, worth +54.0px of span at 390px.',
);
const okStaged = reportSimultaneity(stagedTally, { innerW: VW, innerH: VH, at: 'the settled scroll' });
if (SHELF) {
  console.log('\n############ WITH ONE SET-ASIDE SHELF OPEN ############');
  reportSimultaneity(shelfTally, { innerW: VW, innerH: VH, at: 'the settled scroll' });
}

const contOk = reportContainment(containment);

if (DEALS < MIN_DEALS) {
  console.log(
    `\nNO CONCLUSION: n=${DEALS} is below the stated floor of ${MIN_DEALS}. The rates ` +
      'above are printed but must not be recorded as properties (practice 12).',
  );
  process.exit(3);
}

// PRACTICE 25 — say which question this n can answer, and DERIVE it from n
// rather than asserting it. A fixed sentence that does not move with DEALS is a
// comment routed through console.log: it would keep claiming the same power at
// n=4 as at n=400, which is the shape practice 26 is about.
const halfWidth = (p, n) => {
  const z = 1.96;
  const d = 1 + (z * z) / n;
  return (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
};
const worstHalf = 100 * halfWidth(0.5, DEALS);
const tailHalf = 100 * halfWidth(0.1, DEALS);
console.log(
  `\nWHAT n=${DEALS} CAN ANSWER (derived, not asserted): the 95% Wilson interval is ` +
    `+/-${worstHalf.toFixed(1)} points at its widest (p=50%) and +/-${tailHalf.toFixed(1)} points near p=10%. ` +
    `So this run separates two rates that differ by more than about ${(2 * worstHalf).toFixed(0)} points ` +
    `and CANNOT separate anything closer. Establishing EQUIVALENCE between two ` +
    `candidate layouts needs a pre-declared margin and an n chosen for it; this ` +
    `n was not chosen for that and must not be quoted as showing "no difference".`,
);

if (!tradeOk) {
  console.log(
    '\nProperty 4 (owner wording) is VIOLATED: a fact the player must see was ' +
      'fully visible before the auto-scroll and clipped after it.',
  );
}

if (!okStaged) {
  console.log(
    '\nThe STAGED state fails where the un-staged one may not. That is the state the\n' +
      'player decides in, so it is the one G-SIM baselines must be recorded against.',
  );
}

if (!okSettled || !okStaged || !contOk) {
  console.log(
    '\nFAIL: at the settled scroll position the player cannot see every critical ' +
      'fact at once. Read the DROP-ONE table above for which fact is spending the ' +
      'vertical budget — that is the lever, not the auto-scroll.',
  );
  process.exit(1);
}
console.log('\nPASS: every critical must-see fact is simultaneously visible on every sampled deal.');
