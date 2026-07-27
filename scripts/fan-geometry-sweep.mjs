// W3 + W6 — THE FAN'S GEOMETRY ACROSS WIDTHS AND THEMES.
//
// The bound `fanHeight <= 465.1px` was derived from five constants all measured at
// inner 390px wide with the lacquer theme: card height 73.5, step 21.3, chrome 13.9,
// row gap 6, and a per-line capacity of 9 columns. Height-independence was swept
// across nine heights; WIDTH was never swept at all, and the bound's key structural
// step is `floor(326.8 / 35.5) = 9`.
//
// TWO THINGS THIS DECIDES.
//
// 1. IS "LINES ARE EXACTLY 2" WIDTH-DEPENDENT? `--gd-cardw: clamp(2.75rem, 13vw,
//    4.25rem)` shrinks with the viewport down to a 44px floor, and the pitch shrinks
//    with it — but the CONTENT WIDTH shrinks too, and it is the ratio that decides
//    capacity. If capacity drops below 8 anywhere supported, 15 columns need a THIRD
//    line and the bound is wrong there. 320 is the case to check and it is not
//    exotic: iOS Display Zoom renders a normal iPhone at 320 logical width, and
//    elders are the population most likely to have it on.
//
// 2. ARE THE DESKTOP ROWS IN PLAN.md SS9 COMPUTED WITH PHONE GEOMETRY? They are:
//    fan-height-distribution.mjs hardcodes CARD_H 73.5 / STEP 21.3 / LINE_CAP 9,
//    all measured at 390, and applies them to 1366x681. At 1366 the card is at its
//    4.25rem ceiling, so the step and the capacity both differ. Whatever this run
//    finds, the desktop rows must be recomputed from it or withdrawn.
//
// This measures the geometry only — no fold, no span — so ONE driven room serves
// every viewport, the same amortisation check-containment.mjs uses.
//
// Run: dev server up, then
//   FGS_WIDTHS=320,360,375,390,768,1366,1440 node scripts/fan-geometry-sweep.mjs

const BASE = process.env.FGS_BASE ?? 'http://localhost:8787';
if (process.env.FGS_WIDTHS === undefined) {
  console.log(
    '\nFGS_WIDTHS is REQUIRED — there is deliberately no default list.\n' +
      '  INNER widths, browser chrome EXCLUDED.\n' +
      '  e.g.  FGS_WIDTHS=320,360,375,390,768,1366,1440 node scripts/fan-geometry-sweep.mjs\n',
  );
  process.exit(2);
}
const WIDTHS = process.env.FGS_WIDTHS.split(',').map(Number);
const HEIGHT = Number(process.env.FGS_H ?? 900);
const THEMES = (process.env.FGS_THEMES ?? 'lacquer,cinnabar-court').split(',');

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'FGS_WIDTHS (required) — the swept axis' },
  viewportHeight: { value: 'FGS_H, default 900', justification: 'geometry only; the fan\'s width-driven layout does not depend on height (verified: the 536.2px offset held across nine heights)' },
  deckTheme: { value: 'FGS_THEMES — swept, both shipping themes', justification: 'the theme IS a swept axis here: cinnabar-court declares stackStripW 0.841 against lacquer 0.42, which changes pile height at the common depths, so measuring only the default would miss the taller theme entirely' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'standard 45s/90s' },
  shelf: { value: 'none' },
  handSort: { value: 'descending' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both', justification: 'the well is not a term in the fan\'s geometry' },
  turnDecidability: { value: 'both' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
  browserChrome: { value: 'none (headless inner size)', justification: 'inner size set directly' },
  handSize: { value: '27, one hand reused at every width', justification: 'holding the hand FIXED is the point: width is then the only varied axis' },
};

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: 45000, planningMs: 90000, autoPassNoPlay: true}})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (res === null || !res.ok) throw new Error('room create failed');
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

const GEOM = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const row = document.querySelector('.gd-fan__stackRow');
  const fan = document.querySelector('.gd-fan');
  if (row === null || fan === null) return { error: 'no fan' };
  const stacks = [...row.querySelectorAll('.gd-fan__stack')];
  if (stacks.length < 2) return { error: 'need >=2 stacks for a pitch' };
  const bottoms = [...new Set(stacks.map((s) => Math.round(s.getBoundingClientRect().bottom)))].sort((a,b)=>a-b);
  const perLine = bottoms.map((b) => stacks.filter((s) => Math.round(s.getBoundingClientRect().bottom) === b).length);
  const first = stacks.filter((s) => Math.round(s.getBoundingClientRect().bottom) === bottoms[0]);
  const pitch = first.length >= 2 ? r(first[1].getBoundingClientRect().left - first[0].getBoundingClientRect().left) : null;
  const card = stacks[0].querySelector('.gd-fan__card');
  const cq = card === null ? null : card.getBoundingClientRect();
  const rcs = getComputedStyle(row);
  const rr = row.getBoundingClientRect();
  const contentW = r(rr.width - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight));
  // The theme's declared strip width, read from the live token rather than a
  // constant, so the bound is recomputed rather than quoted (W6).
  const stripVar = getComputedStyle(document.documentElement).getPropertyValue('--gd-strip-f').trim();
  return {
    cardW: cq === null ? null : r(cq.width),
    cardH: cq === null ? null : r(cq.height),
    pitch,
    contentW,
    rowGap: r(parseFloat(rcs.rowGap === 'normal' ? '0' : rcs.rowGap) || 0),
    paddingTop: r(parseFloat(rcs.paddingTop)),
    columns: stacks.length,
    linesNow: bottoms.length,
    perLine,
    fanH: r(fan.getBoundingClientRect().height),
    stripVar: stripVar === '' ? null : stripVar,
  };
}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const a = await ctx.newPage();
await a.goto(BASE, { waitUntil: 'networkidle' });
const drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);

console.log(`=== FAN GEOMETRY ACROSS WIDTHS (inner, chrome EXCLUDED; height ${HEIGHT}) ===`);
console.log(`    One driven room reused at every viewport, so the HAND is identical throughout —`);
console.log(`    the only varied axis is width (and theme). timing: 45s/90s standard.\n`);

const MAX_COLUMNS = 15; // 12 non-level ranks + level class + SJ + BJ
for (const theme of THEMES) {
  console.log(`--- theme ${theme} ---`);
  console.log(
    '  width   cardW  cardH   pitch  contentW  capacity  lines(15 cols)  step=0.42w  lineH(8)   fanH(8,8)',
  );
  for (const w of WIDTHS) {
    const c = await browser.newContext({ viewport: { width: w, height: HEIGHT }, deviceScaleFactor: 1 });
    await c.addInitScript((s) => {
      localStorage.setItem('locale', 'zh-Hant');
      localStorage.setItem('pref:deckTheme', s.theme);
      localStorage.setItem('room:' + s.code, JSON.stringify({ tokens: [s.tokens[0]], lastSeenSeq: s.lastSeq }));
    }, { ...drive, theme });
    const p = await c.newPage();
    await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
    await p.waitForTimeout(500);
    const got = await p.evaluate(() => localStorage.getItem('pref:deckTheme'));
    if (got !== theme) throw new Error(`theme did not take at ${w}: wanted ${theme}, got ${got}`);
    const g = await p.evaluate(`(${GEOM})()`);
    if (g.error) { console.log(`  ${String(w).padStart(5)}   ${g.error}`); await c.close(); continue; }

    const capacity = Math.floor(g.contentW / g.pitch);
    const linesFor15 = Math.ceil(MAX_COLUMNS / capacity);
    // The step is stackOffsetW(n, stripW) * cardW; at depth 8 the 2.95w spread
    // budget binds when 2.95/7 = 0.4214 < stripW, which is theme-dependent.
    const stripW = theme === 'lacquer' ? 0.42 : 0.841;
    const offset8 = Math.min(stripW, 2.95 / 7);
    const step8 = offset8 * g.cardW;
    const lineH8 = g.cardH + 7 * step8;
    const fan88 = linesFor15 >= 2 ? g.paddingTop + lineH8 + g.rowGap + lineH8 : g.paddingTop + lineH8;
    console.log(
      `  ${String(w).padStart(5)}  ${String(g.cardW).padStart(6)} ${String(g.cardH).padStart(6)}  ` +
        `${String(g.pitch).padStart(6)}  ${String(g.contentW).padStart(8)}  ${String(capacity).padStart(8)}  ` +
        `${String(linesFor15).padStart(14)}  ${step8.toFixed(1).padStart(10)}  ${lineH8.toFixed(1).padStart(8)}  ` +
        `${fan88.toFixed(1).padStart(9)}` +
        (capacity < 8 ? '   <-- CAPACITY BELOW 8: 15 columns need a THIRD line here' : ''),
    );
    await c.close();
  }
  console.log('');
}
await ctx.close();
await browser.close();

console.log(
  'READ THIS BEFORE QUOTING ANY OF IT. `capacity` is floor(contentW / pitch) and\n' +
    '`lines(15 cols)` is ceil(15 / capacity) — the number of lines the STRUCTURAL maximum\n' +
    'column count needs, not the number a typical hand uses. `fanH(8,8)` is the structural\n' +
    'maximum AT THAT WIDTH AND THEME, recomputed from the measured card size and the\n' +
    "theme's own stackStripW, not quoted from the 390/lacquer constant.",
);
