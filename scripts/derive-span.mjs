// DERIVE THE SIMULTANEITY SPAN — practice 14 applied to the metric itself.
//
// G-SIM's baselines are worst-case-OBSERVED over n=16..24 deals. A worst case
// drawn from a sample understates the true worst case every time, by an amount
// that grows as the deciding case gets rarer — which is exactly how "11-14
// value columns" was recorded when the structural maximum was 15. The desktop
// margin of +26.3px is thin enough that the difference matters.
//
// THE CLAIM THIS SCRIPT TESTS. Under the `panel` must-see set the span runs from
// the trick well's top to the action bar's bottom, and everything between them
// is stacked in one column. So it should decompose additively:
//
//     span = fanHeight + deskHeight + K        (K constant at a given width)
//
// If K is constant across deals AND across staged-card counts, then the span's
// maximum follows from the maxima of its two variable terms, and no sampling is
// needed to state a bound:
//   - fanHeight is a step function of the dealt hand, already characterised
//     (+21.3px per extra copy in a line's tallest column);
//   - deskHeight varies with the desk's STATE, and its stage is a flex row with
//     NO wrap capped at DESK_STAGE_MAX_FACES = 10 faces, so it is bounded too.
//
// AND IT CLOSES A HOLE. Every simultaneity figure so far was measured with NO
// CARDS STAGED — but staging is what happens immediately before the decision the
// metric is about, and the desk grows a whole card row when it happens. The
// recorded baselines therefore describe a state the player passes THROUGH, not
// the one they decide in. This script measures the staged states directly.
//
// Run: dev server up, then
//   SPAN_W=390 SPAN_H=664 node scripts/derive-span.mjs

import { PROFILES, SIMULTANEITY_PROBE, spanFor } from './simultaneity.mjs';

const BASE = process.env.SPAN_BASE ?? 'http://localhost:8787';
if (process.env.SPAN_W === undefined || process.env.SPAN_H === undefined) {
  console.log(
    '\nSPAN_W and SPAN_H are REQUIRED — there is deliberately no default.\n' +
      '  Real phone INNER heights at 390 wide: ~664 with toolbars, ~748 minimized.\n' +
      '  e.g.  SPAN_W=390 SPAN_H=664 node scripts/derive-span.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.SPAN_W);
const VH = Number(process.env.SPAN_H);

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
const DEALS = Number(process.env.SPAN_DEALS ?? 6);
const THEME = process.env.SPAN_THEME ?? 'lacquer';
// The stage caps at DESK_STAGE_MAX_FACES = 10 (helpers.ts:898) and then shows a
// "+N" pill, so staging beyond 10 cannot grow the row further. 12 is measured
// anyway, to confirm the cap holds rather than to assume it does.
const MAX_STAGE = Number(process.env.SPAN_MAX_STAGE ?? 12);
// TIMING — an axis NO gate in this repo has ever varied. Every driver creates an
// UNTIMED room (`{perTurnMs: null, planningMs: null}`) while the product's DEFAULT
// is TIMING_PRESETS.standard (45s/90s). A timed room renders the desk's countdown
// bar, which the untimed one does not, so every desk height this project has
// recorded describes a configuration most rooms are not in.
const TIMING = process.env.SPAN_TIMING === 'timed'
  ? { perTurnMs: 45000, planningMs: 90000, autoPassNoPlay: true }
  : { perTurnMs: null, planningMs: null };

export const AXES_PINNED = {
  viewportWidth: { value: 'SPAN_W (required)' },
  viewportHeight: { value: 'SPAN_H (required)' },
  deckTheme: { value: 'SPAN_THEME, default lacquer' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'SPAN_TIMING, default UNTIMED', justification: 'the untimed case is the CONTROL for the +8.0px the timed desk adds; both are measured and reported' },
  shelf: { value: 'none' },
  handSort: { value: 'ascending' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both, split by well presence', justification: 'the split IS this script\'s finding — K differs by 132.5px between them' },
  turnDecidability: { value: 'both' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
  browserChrome: { value: 'none (headless inner size)', justification: 'inner size set directly' },
  handSize: { value: '27 (first decision)' },
};

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: ${JSON.stringify(TIMING)}})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 6000));
  }
  if (res === null || !res.ok) throw new Error('room create failed: ' + (res ? res.status : 'none'));
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

// The two variable terms, plus the fan's shape so a step can be attributed.
const TERMS = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    const q = el.getBoundingClientRect();
    return { top: r(q.top + window.scrollY), bottom: r(q.bottom + window.scrollY), h: r(q.height) };
  };
  const rows = [...document.querySelectorAll('.gd-fan__stackRow')];
  const stacks = [...document.querySelectorAll('.gd-fan__stack')];
  const depths = stacks.map((s) => s.querySelectorAll('.gd-fan__card').length);
  return {
    fan: box('.gd-fan'),
    desk: box('.gd-desk'),
    stage: box('.gd-desk__stage'),
    well: box('.gd-well'),
    actions: box('.gd-actionsRow__bar'),
    fanRows: rows.length,
    columns: stacks.length,
    maxDepth: depths.length === 0 ? 0 : Math.max(...depths),
    staged: document.querySelectorAll('.gd-desk__stagedCard').length,
    overflowPill: document.querySelector('.gd-desk__more')?.textContent ?? null,
  };
}`;

const browser = await chromium.launch();
const rows = [];
console.log(`=== SPAN DECOMPOSITION @ INNER ${VW}x${VH} (${THEME}, zh-Hant) ===`);
console.log('    INNER dimensions, browser chrome EXCLUDED.');
console.log(`    ${DEALS} deals x staging 0..${MAX_STAGE} cards.  timing: ${process.env.SPAN_TIMING === 'timed' ? '45s/90s standard preset (the DEFAULT)' : 'UNTIMED (not the product default)'}\n`);

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

  for (let k = 0; k <= MAX_STAGE; k += 1) {
    if (k > 0) {
      const ok = await p.evaluate((i) => {
        const cards = [...document.querySelectorAll('.gd-fan__card')];
        const c = cards[i - 1];
        if (c === undefined) return false;
        c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }, k);
      if (!ok) break;
      await p.waitForTimeout(140);
    }
    const t = await p.evaluate(`(${TERMS})()`);
    const s = await p.evaluate(`(${SIMULTANEITY_PROBE})({})`);
    if (s.error) throw new Error(`probe failed at deal ${deal} k=${k}: ${s.error}`);
    const panel = spanFor(s, PROFILES.panel.facts);
    rows.push({
      deal, k,
      staged: t.staged,
      fanH: t.fan?.h ?? null,
      deskH: t.desk?.h ?? null,
      stageH: t.stage?.h ?? null,
      fanRows: t.fanRows,
      columns: t.columns,
      maxDepth: t.maxDepth,
      boxes: { fan: t.fan, desk: t.desk, well: t.well, actions: t.actions },
      wellH: t.well?.h ?? null,
      wellPresent: (t.well?.h ?? 0) > 0,
      span: panel === null ? null : panel.span,
      slack: panel === null ? null : -panel.deficit,
      overflowPill: t.overflowPill,
    });
  }
  const first = rows.filter((r) => r.deal === deal)[0];
  const last = rows.filter((r) => r.deal === deal).slice(-1)[0];
  console.log(
    `  deal ${deal}: cols ${first.columns} maxDepth ${first.maxDepth} rows ${first.fanRows}  ` +
      `fan ${first.fanH}px  desk ${first.deskH} -> ${last.deskH}px  ` +
      `span ${first.span} -> ${last.span}px  slack ${first.slack} -> ${last.slack}px`,
  );
  await ctx.close();
  await ctxB.close();
}
await browser.close();

// K = span - fanH - deskH. The claim is that this is CONSTANT.
const withK = rows
  .filter((r) => r.span !== null && r.fanH !== null && r.deskH !== null)
  .map((r) => ({ ...r, K: Math.round((r.span - r.fanH - r.deskH) * 10) / 10 }));
// SPLIT BY THE STATE VARIABLE, not lumped. K has two clusters because the
// trick well is EMPTY on a deal where the viewer LEADS — `.gd-well` has no
// min-height, so it renders 0x0, the `trick` fact drops out of the profile, and
// the span's top jumps down from the well to the fan. That is a named state, not
// an unexplained term, and the BOUND must use the larger (well present).
const present = withK.filter((r) => r.wellPresent);
const absent = withK.filter((r) => !r.wellPresent);
const spreadOf = (rs) => {
  if (rs.length === 0) return { lo: null, hi: null, spread: 0 };
  const v = rs.map((r) => r.K);
  return { lo: Math.min(...v), hi: Math.max(...v), spread: Math.max(...v) - Math.min(...v) };
};
const kp = spreadOf(present);
const ka = spreadOf(absent);
console.log(`\n--- K BY TRICK-WELL STATE ---`);
console.log(`  well PRESENT (${present.length} states): K = ${kp.lo}..${kp.hi}  spread ${kp.spread.toFixed(1)}px`);
console.log(`  well EMPTY   (${absent.length} states): K = ${ka.lo}..${ka.hi}  spread ${ka.spread.toFixed(1)}px`);
console.log(`  the well contributes ${kp.lo === null || ka.lo === null ? 'n/a' : (kp.lo - ka.lo).toFixed(1) + 'px'} to the span when it renders; the BOUND uses the present case.`);

const ks = [...new Set(present.map((r) => r.K))].sort((a, b) => a - b);
// SUB-PIXEL TOLERANCE, for the same reason the containment probe has one:
// getBoundingClientRect returns fractional CSS pixels and the terms are rounded
// independently, so K can differ in the last tenth without anything varying.
// The first version of this check demanded EXACT equality and printed
// "NOT ADDITIVE: K moves over 0.1px" — a verdict its own number refuted. A
// threshold that calls 0.1px a structural term is an instrument defect, not a
// finding, so the tolerance is stated rather than left at zero.
const SPREAD = ks.length === 0 ? 0 : ks[ks.length - 1] - ks[0];
const TOL = 1;

console.log(`\n--- IS span = fanH + deskH + K ADDITIVE? (${withK.length} states) ---`);
console.log(`  (well-present states only) distinct K: ${ks.join(', ')}   spread ${SPREAD.toFixed(1)}px (tolerance ${TOL}px)`);
if (SPREAD <= TOL) {
  console.log(
    `  ADDITIVE. K = ${ks[0]}px, constant to within ${SPREAD.toFixed(1)}px across ${withK.length} ` +
      `states spanning ${DEALS} deals and 0..${MAX_STAGE} staged cards.\n` +
      `  => span_max = fanH_max + deskH_max + ${ks[0]}. The span's bound REDUCES to the bounds\n` +
      `     of its two variable terms; it does not need to be sampled in its own right.`,
  );
} else {
  console.log(
    `  NOT ADDITIVE: K moves over ${SPREAD.toFixed(1)}px, beyond the ${TOL}px rounding tolerance. ` +
      `The span has a term this decomposition does not name, so a structural bound cannot be ` +
      `stated from fanH and deskH alone. Spread: ${ks[0]} .. ${ks[ks.length - 1]}.`,
  );
}

const maxBy = (f) => withK.reduce((a, b) => (f(b) > f(a) ? b : a));
const worstDesk = maxBy((r) => r.deskH);
const worstFan = maxBy((r) => r.fanH);
const worstSpan = maxBy((r) => r.span);
console.log(`\n--- THE VARIABLE TERMS, OBSERVED ---`);
console.log(
  `  deskH: ${Math.min(...withK.map((r) => r.deskH))} .. ${worstDesk.deskH}px ` +
    `(worst at ${worstDesk.staged} staged; stage row ${worstDesk.stageH}px)`,
);
console.log(`  fanH:  ${Math.min(...withK.map((r) => r.fanH))} .. ${worstFan.fanH}px`);
console.log(
  `  span:  ${Math.min(...withK.map((r) => r.span))} .. ${worstSpan.span}px ` +
    `(worst slack ${Math.min(...withK.map((r) => r.slack))}px against innerH ${VH})`,
);

// K's COMPOSITION. Of the four terms in the span, three are CONTENT (fanHeight =
// cards, deskHeight = stage + title, and the 132.5px difference between K's two
// values = the trick well). K's 66.0px residual is the only PURE INTER-ELEMENT
// SPACING in the whole span, so it is the only place slack can be found without
// removing something the player looks at. Decomposed here rather than left as a
// constant.
const gapRow = withK.find((r) => r.wellPresent && r.k === 1) ?? withK[0];
if (gapRow !== undefined && gapRow.boxes !== undefined) {
  const b = gapRow.boxes;
  const g = (a, z) => Math.round((z - a) * 10) / 10;
  console.log(`\n--- K's 66.0px RESIDUAL, DECOMPOSED (the only pure spacing in the span) ---`);
  console.log(`  fan bottom -> desk top      ${String(g(b.fan.bottom, b.desk.top)).padStart(6)}px`);
  console.log(`  desk bottom -> actions top  ${String(g(b.desk.bottom, b.actions.top)).padStart(6)}px`);
  console.log(`  action bar's own height     ${String(b.actions.h).padStart(6)}px   (CONTENT, not spacing)`);
  const spacing = Math.round((g(b.fan.bottom, b.desk.top) + g(b.desk.bottom, b.actions.top)) * 10) / 10;
  console.log(
    `  => ${spacing}px is spacing, ${b.actions.h}px is the control itself. ` +
      `Recovering the whole ${spacing}px would collapse Play/Pass onto the desk.`,
  );
  console.log(
    `  well top -> well bottom     ${String(b.well.h).padStart(6)}px   ` +
      `well bottom -> fan top ${g(b.well.bottom, b.fan.top)}px   (together the 132.5px K difference)`,
  );
}

// THE HOLE THIS SCRIPT EXISTS TO CLOSE: what staging costs, which every earlier
// simultaneity figure omitted by measuring only the un-staged state.
const byK = new Map();
for (const r of withK) {
  const cur = byK.get(r.k);
  if (cur === undefined || r.deskH > cur.deskH) byK.set(r.k, r);
}
console.log(`\n--- WHAT STAGING COSTS (max over deals, per staged count) ---`);
const zero = byK.get(0);
for (const k of [...byK.keys()].sort((a, b) => a - b)) {
  const r = byK.get(k);
  console.log(
    `  ${String(k).padStart(2)} staged: desk ${String(r.deskH).padStart(6)}px  ` +
      `span ${String(r.span).padStart(7)}px  slack ${String(r.slack).padStart(7)}px  ` +
      `(+${(r.deskH - zero.deskH).toFixed(1)}px of desk vs un-staged)` +
      (r.overflowPill !== null ? `  overflow pill "${r.overflowPill}"` : ''),
  );
}
