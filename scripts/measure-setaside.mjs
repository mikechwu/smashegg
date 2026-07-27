// SET-ASIDE GATE — is the "set aside" affordance there when cards are lifted?
//
// The owner's report this exists to prevent, verbatim:
//
//   "In phone version put side feature is not always shown. Sometimes it
//    doesn't show up in the first cycle. The feature show up in the 2nd cycle
//    with the same hand cards."
//
// Cause: `areaAllowed` was measured from `window.innerHeight -
// handZone.getBoundingClientRect().top - RESERVED_BELOW_FAN_PX`. That rect is
// VIEWPORT-relative on a page the client scrolls itself, the measurement was a
// LAYOUT effect (so it always ran before ScrollActionsIntoView's passive
// scroll), and its deps could only re-fire on a new server view — which cannot
// arrive during your own turn. Below innerHeight ~765 it latched "no room" and
// `setAsideDestination` returned null, which rendered NOTHING.
//
// WHY THIS SCRIPT SWEEPS VIEWPORTS. The repo's other gates hardcode 390x844.
// 844 is above the threshold, so that viewport is green on the broken code and
// on the fix alike — it cannot tell them apart, and a gate pinned to it
// measures nothing about this defect. Verified by running this script against
// the reverted source: MISSING at 390x659 and 844x340, `ok` at 390x844. The
// landscape row is not optional either: at 844x340 the old code never
// recovered, because no scroll offset lifts a 340px window over the threshold.
//
// WHAT THIS GATE DOES NOT CHECK. It asserts the affordance is PRESENT. It does
// not measure card geometry, fan overflow, or where Play/Pass lands — so it
// cannot tell you a shelf is safe to open, only that the control exists. Those
// were measured by hand (see setAsideDestination in src/client/table/areas.ts)
// and are NOT gated anywhere. scripts/measure-fold.mjs is the Play-position
// gate; run it too, and at a sub-765 height, not only at its 844 default.
//
// Run: dev servers up, then `node scripts/measure-setaside.mjs`.
// Requires playwright + chromium (deliberately NOT a repo dependency — this is
// a manual gate script, same policy as the fold and tap-target sweeps).


const BASE = process.env.FAN_SWEEP_BASE ?? 'http://localhost:5173';
const DEALS = Number(process.env.SETASIDE_DEALS ?? 3);
// NO DEFAULT VIEWPORT LIST. This defaulted to '390x659,390x745,390x844,844x340'
// — a list whose third entry is the inner height measure-fold.mjs now records as
// `void: true`, because no browser presents it. A default LIST is the same defect
// as a default dimension and slipped past the check that banned the latter: the
// check looked for `?? <number>`, and a comma-separated string is not a number.
// The rule is about what can be INHERITED, not about the shape of the literal.
if (process.env.SETASIDE_VIEWPORTS === undefined) {
  console.log(
    '\nSETASIDE_VIEWPORTS is REQUIRED — there is deliberately no default list.\n\n' +
      '  Real phone INNER heights at 390 wide: ~664 with toolbars, ~748 minimized.\n' +
      '  844 is a SCREEN size no browser presents as an inner height.\n\n' +
      '  e.g.  SETASIDE_VIEWPORTS=390x664,390x748 node scripts/measure-setaside.mjs\n',
  );
  process.exit(2);
}
const VIEWPORTS = process.env.SETASIDE_VIEWPORTS
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w, h };
  });

const { chromium } = await import('playwright');

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

// Build the room IN-PAGE — driving it from node races the token capture.
const DRIVER = `async (input) => {
  const res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
  const { code } = await res.json();
  const tokens = []; let lastSeq = 0;
  const ws = new WebSocket('ws://' + location.host + '/api/rooms/' + code + '/ws');
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

const SNAP = `() => ({
  cards: document.querySelectorAll('.gd-fan__card').length,
  selected: document.querySelectorAll('.gd-fan__card--selected').length,
  stage: document.querySelectorAll('.gd-desk__stage').length,
  button: document.querySelectorAll('.gd-desk__setAside').length,
  note: document.querySelectorAll('.gd-desk__setAsideNote').length,
  sfSend: document.querySelectorAll('.gd-sf__stage').length,
  sfSent: document.querySelectorAll('.gd-sf__sent').length,
  scrollY: Math.round(window.scrollY),
  innerHeight: window.innerHeight,
})`;

const PICK = `(idxs) => {
  const cs = [...document.querySelectorAll('.gd-fan__card')];
  let n = 0;
  for (const i of idxs) { if (cs[i]) { cs[i].dispatchEvent(new MouseEvent('click', {bubbles:true})); n += 1; } }
  return n;
}`;

const browser = await chromium.launch();
const failures = [];
let checks = 0;

for (const { w, h } of VIEWPORTS) {
  for (let deal = 0; deal < DEALS; deal += 1) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
    const a = await ctx.newPage();
    await a.goto(BASE, { waitUntil: 'networkidle' });
    const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctxB.addInitScript((seed) => {
      localStorage.setItem('locale', 'zh-Hant');
      localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
    }, drive);
    const page = await ctxB.newPage();
    await page.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
    await page.waitForTimeout(1500);

    // Lift a selection on the FIRST turn — the turn the owner never saw the
    // control on. Everything below is asserted against this moment.
    const picked = await page.evaluate(`(${PICK})([2,4,6])`);
    await page.waitForTimeout(400);
    const first = await page.evaluate(`(${SNAP})()`);

    // The probe must not pass by measuring nothing: if the selection did not
    // take, there is no stage row and the assertion below would be vacuous.
    if (first.selected === 0 || first.stage === 0) {
      failures.push(`${w}x${h} deal ${deal}: selection did not take (clicked ${picked}) — probe measured nothing`);
      await ctx.close();
      await ctxB.close();
      continue;
    }

    checks += 1;
    const affordance = first.button + first.note;
    const ok = affordance > 0;
    if (!ok) {
      failures.push(
        `${w}x${h} deal ${deal} (${drive.code}): stage row up with ${first.selected} cards lifted, ` +
          `but NO set-aside affordance (button ${first.button}, note ${first.note}), scrollY ${first.scrollY}`,
      );
    }
    console.log(
      `${w}x${h} deal ${deal} ${drive.code}: cards=${first.cards} sel=${first.selected} ` +
        `stage=${first.stage} button=${first.button} note=${first.note} ` +
        `scrollY=${first.scrollY} ih=${first.innerHeight}  ${ok ? 'ok' : 'MISSING'}`,
    );

    // And after a press, the slot still says something (the already-there case,
    // which is the OTHER way the control used to vanish silently).
    if (first.button > 0) {
      await page.evaluate(() =>
        document.querySelector('.gd-desk__setAside').dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForTimeout(500);
      await page.evaluate(`(${PICK})([2,4,6])`);
      await page.waitForTimeout(400);
      const again = await page.evaluate(`(${SNAP})()`);
      if (again.stage > 0 && again.button + again.note === 0) {
        failures.push(
          `${w}x${h} deal ${deal} (${drive.code}): after set-aside, re-selecting the shelved cards ` +
            'leaves the stage row up with NO affordance and no statement',
        );
      }
    }

    await ctx.close();
    await ctxB.close();
  }
}

await browser.close();

console.log(`\n=== SET-ASIDE GATE: ${checks} first-turn checks over ${VIEWPORTS.length} viewports ===`);
// METHODOLOGY practice 15: these are INNER viewport sizes, not screen sizes.
console.log(
  `    inner viewports ${VIEWPORTS.map((v) => v.w + 'x' + v.h).join(', ')}; ` +
    'browser chrome EXCLUDED — a device with a matching SCREEN presents less inner height.',
);
if (checks === 0) {
  console.log('FAIL: no check ran — the gate measured nothing.');
  process.exit(1);
}
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length} violation(s)`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('PASS: with cards lifted, the set-aside slot is never empty at any swept viewport.');
