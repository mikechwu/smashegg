// THE FAN'S STRUCTURAL HEIGHT BOUND — the last sampled term in the G-SIM span.
//
// span = fanHeight + deskHeight + K, with K constant (198.5px when the trick
// well renders) and deskHeight <= 148.5px proved by saturation. fanHeight was
// the one term still reported as "worst observed", and a worst case drawn from a
// sample understates the real one every time (practice 14). This closes it.
//
// WHAT IS ALREADY PROVED, AND WHERE IT COMES FROM:
//   - COLUMNS <= 15. A column is a run of equal levelValue (groupHandColumns,
//     HandFan.tsx:155), and there are 15 value classes: 12 non-level natural
//     ranks + the level class + SJ + BJ. Pinned at hand-fan.test.tsx as
//     worstCaseColumns = 15.
//   - DEPTH <= 8. Two decks x four suits of one rank. Jokers cap at 2 each.
//   - The DEPTH CURVE is measured, not modelled: a single-line fan measures
//     209.5 + 21.3*(depth-1), and 21.3px is stackOffsetW(n, 0.42) * cardw =
//     0.42 * 50.7 for every depth up to 8 (the 2.95w spread budget only binds
//     from 9 copies, HandFan.tsx:180, which two decks cannot reach).
//
// WHAT WAS NOT KNOWN, AND WHY THE OLD PROBE COULD NOT SEE IT. The settled fan is
// ONE `.gd-fan__stackRow` element with `flex-wrap: wrap`, so it wraps INTERNALLY.
// The earlier probe counted `.gd-fan__stackRow` ELEMENTS and therefore reported
// "1 row" for every hand, including hands rendering on two visual lines. Lines
// are counted here by DISTINCT STACK BOTTOMS — the same correction this project
// already made once for fan lines, because `align-items: flex-end` bottom-aligns
// them and distinct TOPS would count depths instead of lines.
//
// Run: dev server up, then
//   FANB_W=390 FANB_H=664 node scripts/derive-fan-bound.mjs

const BASE = process.env.FANB_BASE ?? 'http://localhost:8787';
if (process.env.FANB_W === undefined || process.env.FANB_H === undefined) {
  console.log(
    '\nFANB_W and FANB_H are REQUIRED — there is deliberately no default.\n' +
      '  Real phone INNER heights at 390 wide: ~664 with toolbars, ~748 minimized.\n' +
      '  844 is a SCREEN size no browser presents as an inner height.\n' +
      '  These are INNER dimensions; browser chrome EXCLUDED.\n' +
      '  e.g.  FANB_W=390 FANB_H=664 node scripts/derive-fan-bound.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.FANB_W);
const VH = Number(process.env.FANB_H);
const DEALS = Number(process.env.FANB_DEALS ?? 10);
const THEME = process.env.FANB_THEME ?? 'lacquer';

const { chromium } = await import('playwright');

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: {perTurnMs: null, planningMs: null}})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 6000));
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
  if (stacks.length === 0) return { error: 'no stacks' };

  // LINES BY DISTINCT BOTTOMS. align-items: flex-end bottom-aligns every stack
  // in a line, so a line is a bottom. Distinct TOPS would count DEPTHS.
  const bottoms = [...new Set(stacks.map((s) => Math.round(s.getBoundingClientRect().bottom)))].sort((a, b) => a - b);
  const lines = bottoms.map((b) => {
    const inLine = stacks.filter((s) => Math.round(s.getBoundingClientRect().bottom) === b);
    const depths = inLine.map((s) => s.querySelectorAll('.gd-fan__card').length);
    const heights = inLine.map((s) => s.getBoundingClientRect().height);
    return {
      bottom: b,
      columns: inLine.length,
      maxDepth: Math.max(...depths),
      maxHeight: r(Math.max(...heights)),
      depths,
    };
  });

  const card = stacks[0].querySelector('.gd-fan__card');
  const cr = card === null ? null : card.getBoundingClientRect();
  // Column PITCH from two adjacent stacks in the same line, measured rather than
  // taken from the 0.70w comment.
  let pitch = null;
  for (const l of lines) {
    const inLine = stacks.filter((s) => Math.round(s.getBoundingClientRect().bottom) === l.bottom);
    if (inLine.length >= 2) {
      pitch = r(inLine[1].getBoundingClientRect().left - inLine[0].getBoundingClientRect().left);
      break;
    }
  }
  const rcs = getComputedStyle(row);
  const rr = row.getBoundingClientRect();
  return {
    fanH: r(fan.getBoundingClientRect().height),
    rowH: r(rr.height),
    rowW: r(rr.width),
    rowContentW: r(rr.width - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight)),
    rowGap: r(parseFloat(rcs.rowGap === 'normal' ? '0' : rcs.rowGap) || 0),
    paddingTop: r(parseFloat(rcs.paddingTop)),
    paddingLeft: r(parseFloat(rcs.paddingLeft)),
    cardW: cr === null ? null : r(cr.width),
    cardH: cr === null ? null : r(cr.height),
    columns: stacks.length,
    lineCount: lines.length,
    lines,
    pitch,
    seamRow: document.querySelector('.gd-fan__seamRow') !== null,
  };
}`;

const browser = await chromium.launch();
const rows = [];
console.log(`=== FAN HEIGHT BOUND @ INNER ${VW}x${VH} (${THEME}, zh-Hant) ===`);
console.log('    INNER dimensions, browser chrome EXCLUDED.\n');

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
  const p = await ctxB.newPage();
  await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await p.waitForTimeout(900);

  const got = await p.evaluate(() => localStorage.getItem('pref:deckTheme'));
  if (got !== THEME) throw new Error(`theme did not take: wanted ${THEME}, got ${got}`);
  const g = await p.evaluate(`(${GEOM})()`);
  if (g.error) throw new Error(`geometry probe failed at deal ${deal}: ${g.error}`);
  rows.push(g);
  console.log(
    `  deal ${String(deal).padStart(2)}: fan ${String(g.fanH).padStart(6)}px  cols ${String(g.columns).padStart(2)}  ` +
      `LINES ${g.lineCount}  per-line (cols/maxDepth/height): ` +
      g.lines.map((l) => `${l.columns}/${l.maxDepth}/${l.maxHeight}`).join(' | '),
  );
  await ctx.close();
  await ctxB.close();
}
await browser.close();

const c = rows[0];
console.log(`\n--- MEASURED CONSTANTS (${THEME} @ ${VW}px wide) ---`);
console.log(
  `  card ${c.cardW}x${c.cardH}px   column pitch ${c.pitch}px (= ${(c.pitch / c.cardW).toFixed(3)}w)   ` +
    `row gap ${c.rowGap}px   row padding-top ${c.paddingTop}px`,
);
console.log(`  row content width ${c.rowContentW}px`);

// COLUMNS PER LINE. EVERY stack carries the same negative left margin — the
// row's `padding-left: calc(cardw * 0.3)` exists precisely to cancel the FIRST
// stack's copy of it (table.css:873-876), so every column costs exactly one
// PITCH and none costs a full card width. Capacity is therefore
// floor(contentWidth / pitch), not the first-column-full-width form.
//
// The first-column-full-width form was written here first and gave 8, while
// every one of the deals below put 9 columns on line 1. The measurement was
// right and the arithmetic was wrong: this is practice 21's shape (the binding
// constraint is not in the expression you are reading) and the check below is
// what caught it, so it stays in as an assertion rather than a comment.
const perLine = Math.floor(c.rowContentW / c.pitch);
const observedPerLine = Math.max(...rows.flatMap((r) => r.lines.map((l) => l.columns)));
console.log(
  `  => a line holds floor(${c.rowContentW} / ${c.pitch}) = ${perLine} columns; ` +
    `largest line OBSERVED holds ${observedPerLine}.`,
);
if (perLine !== observedPerLine) {
  console.log(
    `\n  DERIVATION DISAGREES WITH MEASUREMENT (${perLine} vs ${observedPerLine}). The measurement ` +
      `wins and the bound below is NOT safe to quote until the formula is fixed.`,
  );
  process.exit(1);
}
console.log(
  `     15 columns therefore need ${Math.ceil(15 / perLine)} lines; the structural column max is 15 ` +
    `(12 non-level ranks + level class + SJ + BJ).`,
);

// THE PER-LINE HEIGHT CURVE, measured from every line observed.
const allLines = rows.flatMap((r) => r.lines);
const byDepth = new Map();
for (const l of allLines) {
  const cur = byDepth.get(l.maxDepth);
  if (cur === undefined || l.maxHeight > cur) byDepth.set(l.maxDepth, l.maxHeight);
}
const depths = [...byDepth.keys()].sort((a, b) => a - b);
console.log(`\n--- PER-LINE HEIGHT vs MAX DEPTH (${allLines.length} lines observed) ---`);
for (const d of depths) console.log(`  depth ${d}: line height ${byDepth.get(d)}px`);
const steps = [];
for (let i = 1; i < depths.length; i += 1) {
  if (depths[i] - depths[i - 1] === 1) {
    steps.push(Math.round((byDepth.get(depths[i]) - byDepth.get(depths[i - 1])) * 10) / 10);
  }
}
// SUB-PIXEL TOLERANCE — and this is the SECOND time the same zero-tolerance
// mistake was written into a new script in one round. derive-span.mjs printed
// "NOT ADDITIVE: K moves over 0.1px"; this printed "NOT a single step" for
// 21.3/21.2/21.3. Independently-rounded measured quantities differ in the last
// tenth; a check that calls that a structural term is an instrument defect.
const STEP_TOL = 0.5;
const stepSpread = steps.length === 0 ? 0 : Math.max(...steps) - Math.min(...steps);
const meanStep = steps.length === 0 ? 0 : Math.round((steps.reduce((a, b) => a + b, 0) / steps.length) * 10) / 10;
console.log(
  `  consecutive-depth steps: ${steps.join(', ')}  spread ${stepSpread.toFixed(1)}px (tolerance ${STEP_TOL}px)` +
    (stepSpread <= STEP_TOL
      ? `\n  => LINEAR at ${meanStep}px per copy = stackOffsetW(n, 0.42) * cardW = 0.42 * ${c.cardW} = ${(0.42 * c.cardW).toFixed(1)}px.` +
        `\n     The 2.95w spread budget only binds from 9 copies (HandFan.tsx:180), which two decks cannot reach,` +
        `\n     so the step stays 0.42w for every depth up to the structural maximum of 8.`
      : `  => NOT a single step; the curve is not linear over the observed range.`),
);
const uniqSteps = stepSpread <= STEP_TOL ? [meanStep] : [...new Set(steps)];

// FAN = CHROME + sum(line heights) + gaps. Solve for the chrome from every
// observation, and check it is constant — the same additivity test as the span.
const chromes = rows.map((r) => {
  const sum = r.lines.reduce((acc, l) => acc + l.maxHeight, 0);
  const gaps = (r.lines.length - 1) * r.rowGap;
  return Math.round((r.fanH - sum - gaps) * 10) / 10;
});
const uniqChrome = [...new Set(chromes)].sort((a, b) => a - b);
const chromeSpread = uniqChrome.length === 0 ? 0 : uniqChrome[uniqChrome.length - 1] - uniqChrome[0];
console.log(`\n--- IS fanH = CHROME + sum(lineHeights) + gaps? ---`);
console.log(`  chrome values: ${uniqChrome.join(', ')}   spread ${chromeSpread.toFixed(1)}px (tolerance 1px)`);
if (chromeSpread <= 1) {
  const CH = uniqChrome[0];
  const step = uniqSteps.length === 1 ? uniqSteps[0] : null;
  const base1 = byDepth.get(1) ?? (depths.length > 0 ? byDepth.get(depths[0]) - (depths[0] - 1) * (step ?? 0) : null);
  console.log(`  ADDITIVE. chrome = ${CH}px, constant across ${rows.length} deals.`);
  if (step !== null && base1 !== null) {
    const lineH = (d) => Math.round((base1 + step * (d - 1)) * 10) / 10;
    console.log(`  line height (depth d) = ${base1} + ${step}*(d-1)`);
    console.log(`\n--- THE STRUCTURAL WORST CASE ---`);
    // 27 cards, 15 columns => 15 minimum, 12 spare. Two lines. To maximise
    // fanH we want the deepest possible column on EACH line.
    //   two columns of depth d plus 13 singletons costs 2d + 13 <= 27 => d <= 7.
    //   one column of depth 8 leaves 27 - 8 - 14 = 5 spare, so the other line's
    //   deepest is at most 1 + 5 = 6.
    // fanH = chrome + gap + 2*lineH(1) + step*(d1 + d2 - 2), so ONLY d1 + d2
    // matters and FEWER columns is worse: every extra column spends a card that
    // could have gone into a pile. The binding constraints are
    //   - two lines require at least perLine + 1 = 10 columns;
    //   - C columns and 27 cards allow d1 + d2 <= 29 - C;
    //   - depth <= 8 (two decks x four suits), so d1 + d2 <= 16;
    // and at C = 10 the card budget allows 19, so the DEPTH cap binds, not the
    // cards. The deep columns must land on different lines: with C = 10 line 2
    // holds exactly one column, and it is the highest value class — reachable as
    // the LEVEL class (8 cards: two decks x four suits of the level rank) in a
    // jokerless hand, since jokers cap at 2 each and would take that slot.
    const cands = [
      { label: `${perLine + 1} cols, depth 8 on each line (8 + 8 + 8 singles = 24 <= 27)`, d1: 8, d2: 8 },
      { label: '15 cols, two depth-7 columns (2*7 + 13 = 27)', d1: 7, d2: 7 },
      { label: '15 cols, one depth-8 + one depth-6 (8 + 6 + 13 = 27)', d1: 8, d2: 6 },
    ];
    let best = null;
    for (const k of cands) {
      const h = Math.round((CH + lineH(k.d1) + c.rowGap + lineH(k.d2)) * 10) / 10;
      console.log(`  ${k.label.padEnd(52)} fanH = ${h}px`);
      if (best === null || h > best.h) best = { ...k, h };
    }
    console.log(`\n  STRUCTURAL MAX fanHeight = ${best.h}px  (${best.label})`);
    const observedMax = Math.max(...rows.map((r) => r.fanH));
    console.log(
      `  observed max over ${rows.length} deals: ${observedMax}px — the structural case is ` +
        `${Math.round((best.h - observedMax) * 10) / 10}px taller, and a sample cannot be relied on to reach it.`,
    );
  }
} else {
  console.log(
    `  NOT ADDITIVE beyond tolerance: the fan has a height term this decomposition does not name. ` +
      `A structural bound cannot be stated from line heights alone.`,
  );
}
