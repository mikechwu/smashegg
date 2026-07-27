// W1 — DOES THE MODEL SURVIVE MEASUREMENT?
//
// scripts/fan-height-distribution.mjs predicts a 13.14% infeasible rate at inner
// 390x664 in a DEFAULT TIMED room, following, staged, panel set. That number has
// never been seen in a browser. Its only validation was that the model's untimed
// 2.50% sits inside a measured 4.2% [0.7, 20.2] at n=24 — an interval that would
// also accept a model wrong by 6x, so the agreement check had almost no power.
//
// Every threshold this script judges against was fixed in
// docs/research/prereg-fan-model.md and committed BEFORE this file existed.
//
// TWO TESTS, and the second is the load-bearing one:
//   W1a the RATE, against a pre-registered cut of 8 failures in 120;
//   W1b the DISTRIBUTION, per 21.3px lattice bin — agreeing on a tail is weak,
//       agreeing on the whole shape is not.
//
// Run: dev server up, then
//   VFM_W=390 VFM_H=664 node scripts/validate-fan-model.mjs

const BASE = process.env.VFM_BASE ?? 'http://localhost:8787';
if (process.env.VFM_W === undefined || process.env.VFM_H === undefined) {
  console.log(
    '\nVFM_W and VFM_H are REQUIRED — there is deliberately no default.\n' +
      '  INNER dimensions, browser chrome EXCLUDED. Real phone inner heights at 390\n' +
      '  wide: ~664 with toolbars, ~748 minimized. 844 is a SCREEN size.\n' +
      '  e.g.  VFM_W=390 VFM_H=664 node scripts/validate-fan-model.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.VFM_W);
const VH = Number(process.env.VFM_H);
// Deals ATTEMPTED. Following deals are the analysis set and are a subset, so this
// over-provisions: ~75% of turns are following, and the pre-registration needs 120.
const DEALS = Number(process.env.VFM_DEALS ?? 165);
const NEED_FOLLOWING = Number(process.env.VFM_NEED ?? 120);
const THEME = process.env.VFM_THEME ?? 'lacquer';
const SHELF = process.env.VFM_SHELF === '1';
// THE AXIS THAT WAS PINNED WRONG. Default here is the PRODUCT default, not the
// convenient one: every other gate in this repo creates an untimed room while
// TIMING_PRESETS.standard is what a room actually gets.
const TIMED = process.env.VFM_TIMING !== 'untimed';
const TIMING = TIMED
  ? { perTurnMs: 45000, planningMs: 90000, autoPassNoPlay: true }
  : { perTurnMs: null, planningMs: null };

const { chromium } = await import('playwright');
import { PROFILES, SIMULTANEITY_PROBE, spanFor } from './simultaneity.mjs';

// AXES — every registered dimension, declared. See scripts/axes.mjs for why this
// block exists and what the test enforces. `justification` is REQUIRED wherever
// the pinned value is not the product default.
export const AXES_PINNED = {
  viewportWidth: { value: 'VFM_W (required)' },
  viewportHeight: { value: 'VFM_H (required)' },
  deckTheme: { value: 'VFM_THEME, default lacquer' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'standard 45s/90s' },
  shelf: { value: 'none unless VFM_SHELF=1' },
  handSort: { value: 'ascending' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'following only', justification: 'the leading population carries 132.5px more slack and essentially cannot fail; pooling would understate the rate a following player meets' },
  turnDecidability: { value: 'decidable turns only', justification: 'a forced-pass turn has no decision AND renders no countdown bar, so it would record the untimed desk under the timed label' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
  browserChrome: { value: 'none (headless inner size)', justification: 'playwright sets the inner size directly; real chrome is stated as an assumption instead of simulated' },
  handSize: { value: '27 (first decision)' },
};

const CONFIG = {"turnDirection":"counterclockwise","firstLeadMethod":"random","ceremonyCardCount":2,"levelTrack":"perTeam","overshootWinsGame":false,"aWinPartnerNotLast":true,"aMaxAttempts":3,"aFailConsequence":"suspendPlayOpponentLevel","aFailDemoteTo":"level2","aAttemptCounterReset":"fresh","aceFinishDemotes":false,"aAttemptOnlyAsDeclarer":true,"returnTributeMaxRank":10,"returnNoLowCardPolicy":"lowestByLevelValue","tributeLevelBasis":"upcomingLevel","equalTributeAssignment":"seatOrder","antiTributeMode":"auto","tributeVisibility":"public","cardCountVisibility":"always","jokerBombSupreme":true,"wildStraightFlushIsBomb":true,"allowUnderDeclareStraightFlush":false,"fiveOfKindAsFullHouse":false,"fullHouseJokerPair":true,"allowWildUnderDeclare":false,"jiefengRecipient":"partner"};

const DRIVER = `async (input) => {
  let res = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    res = await fetch('/api/rooms', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({gameId:'guandan', config: input.config, timing: input.timing})});
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 5000));
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
      // STOP ONLY AT A REAL DECISION. A seat-0 turn whose ONLY legal action is
      // pass is the forced-pass window: GameTable suppresses the clock there
      // (:1166) and with it the desk's countdown bar, so a timed room measured at
      // such a turn renders the UNTIMED desk. Measuring it under the timed label
      // is exactly the mislabelling this round is about, so those turns are passed
      // through rather than recorded. This CHANGES THE POPULATION to "turns where
      // the player has a choice", which is the population the metric is about —
      // declared in the report rather than left implicit.
      const canPlay = hasHints && m.hints.some((h) => h.type !== 'pass');
      if (hasHints && m.seat === 0 && canPlay) { if (!resolved) { resolved = true; clearTimeout(to); resolve(); } return; }
      if (hasHints && m.seq > inflightSeq) {
        inflightSeq = m.seq;
        ws.send(JSON.stringify({v:1, type:'action', seat: m.seat, actionId: crypto.randomUUID(), expectedSeq: m.seq, action: m.hints[0]}));
      }
    };
    ws.onerror = () => { clearTimeout(to); reject(new Error('ws error')); };
  });
  return { code, tokens, lastSeq };
}`;

const FANH = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const fan = document.querySelector('.gd-fan');
  const well = document.querySelector('.gd-well');
  const desk = document.querySelector('.gd-desk');
  const bar = document.querySelector('.gd-desk__bar');
  if (fan === null) return { error: 'no fan' };
  const wq = well === null ? null : well.getBoundingClientRect();
  return {
    fanH: r(fan.getBoundingClientRect().height),
    deskH: desk === null ? null : r(desk.getBoundingClientRect().height),
    // FOLLOWING vs LEADING: the well renders 0x0 when the viewer leads.
    following: wq !== null && wq.height > 0,
    cards: document.querySelectorAll('.gd-fan__card').length,
    // The countdown bar is the +8px the timing axis turns on. Recorded so a run
    // that CLAIMS to be timed but rendered no bar cannot pass as one.
    timedBar: bar !== null,
  };
}`;

const browser = await chromium.launch();
const rows = [];
console.log(`=== W1 MODEL VALIDATION @ INNER ${VW}x${VH} ===`);
console.log(
  `    INNER dimensions, browser chrome EXCLUDED. theme ${THEME} | locale zh-Hant | ` +
    `${SHELF ? 'ONE SHELF' : 'no shelf'} | one card staged | ` +
    `timing ${TIMED ? '45s/90s STANDARD (the product default)' : 'UNTIMED (not the default)'}`,
);
console.log(`    Thresholds pre-registered in docs/research/prereg-fan-model.md.`);
console.log(`    Attempting ${DEALS} deals to reach ${NEED_FOLLOWING} FOLLOWING ones.\n`);

let following = 0;
for (let deal = 0; deal < DEALS && following < NEED_FOLLOWING; deal += 1) {
  let drive;
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  try {
    await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
    const a = await ctx.newPage();
    await a.goto(BASE, { waitUntil: 'networkidle' });
    drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG, timing: TIMING })})`);
  } catch (e) {
    await ctx.close();
    console.log(`  deal ${deal}: driver failed (${String(e).slice(0, 80)}) — skipped, not counted`);
    continue;
  }

  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', 'zh-Hant');
    localStorage.setItem('pref:deckTheme', seed.theme);
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, { ...drive, theme: THEME });
  const p = await ctxB.newPage();
  await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await p.waitForTimeout(850);

  const got = await p.evaluate(() => localStorage.getItem('pref:deckTheme'));
  if (got !== THEME) throw new Error(`deck theme did not take: wanted ${THEME}, got ${got}`);

  // Stage one card — the decision moment, and the desk's saturating worst case.
  const staged = await p.evaluate(() => {
    const c = document.querySelector('.gd-fan__card');
    if (c === null) return false;
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!staged) throw new Error(`deal ${deal}: nothing to stage`);
  if (SHELF) {
    await p.waitForTimeout(150);
    const pressed = await p.evaluate(() => {
      const b = document.querySelector('.gd-desk__setAside');
      if (b === null) return false;
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    if (!pressed) throw new Error(`deal ${deal}: no set-aside control — the shelf row would measure the no-shelf layout`);
  }
  await p.waitForTimeout(320);

  const g = await p.evaluate(`(${FANH})()`);
  if (g.error) throw new Error(`deal ${deal}: ${g.error}`);
  // A run that claims to be timed but rendered no countdown bar is measuring the
  // untimed layout under the timed label — the exact mislabelling this round is
  // about. Fail loudly rather than record it.
  if (TIMED && !g.timedBar) {
    throw new Error(
      `deal ${deal}: timing was set to the standard preset but no .gd-desk__bar rendered — ` +
        'this run would have recorded the UNTIMED layout under the timed label',
    );
  }
  const s = await p.evaluate(`(${SIMULTANEITY_PROBE})({})`);
  if (s.error) throw new Error(`deal ${deal}: simultaneity probe: ${s.error}`);
  const panel = spanFor(s, PROFILES.panel.facts);

  const row = {
    deal,
    following: g.following,
    fanH: g.fanH,
    deskH: g.deskH,
    cards: g.cards,
    span: panel === null ? null : panel.span,
    slack: panel === null ? null : -panel.deficit,
    infeasible: panel !== null && !panel.feasible,
  };
  rows.push(row);
  if (row.following) following += 1;
  if (deal % 10 === 0 || row.infeasible) {
    console.log(
      `  deal ${String(deal).padStart(3)}: ${row.following ? 'follow' : 'LEAD  '}  ` +
        `fan ${String(row.fanH).padStart(6)}  desk ${String(row.deskH).padStart(6)}  ` +
        `span ${String(row.span).padStart(6)}  slack ${String(row.slack).padStart(7)}` +
        `${row.infeasible ? '  INFEASIBLE' : ''}   [following ${following}/${NEED_FOLLOWING}]`,
    );
  }
  await ctx.close();
  await ctxB.close();
}
await browser.close();

const follow = rows.filter((r) => r.following);
const lead = rows.filter((r) => !r.following);
const n = follow.length;
const fails = follow.filter((r) => r.infeasible).length;

const wilson = (k, m) => {
  if (m === 0) return '[--, --]';
  const z = 1.96, p = k / m, d = 1 + (z * z) / m, c = p + (z * z) / (2 * m);
  const e = z * Math.sqrt((p * (1 - p)) / m + (z * z) / (4 * m * m));
  return `[${(100 * ((c - e) / d)).toFixed(1)}%, ${(100 * ((c + e) / d)).toFixed(1)}%]`;
};

console.log(`\n############ W1a — THE RATE ############`);
console.log(`  attempted ${rows.length} deals: ${n} FOLLOWING (the analysis set), ${lead.length} leading.`);
console.log(`  infeasible (panel, staged, following): ${fails}/${n} = ${n ? ((100 * fails) / n).toFixed(2) : '--'}% ${wilson(fails, n)}`);
if (lead.length > 0) {
  const lf = lead.filter((r) => r.infeasible).length;
  console.log(`  leading, for contrast: ${lf}/${lead.length} = ${((100 * lf) / lead.length).toFixed(2)}%`);
}

// THE PRE-REGISTERED DECISION RULE, applied without adjustment.
const CUT = 8, BOTH_WRONG = 27;
const scaled = Math.round((CUT * n) / 120);
console.log(`\n  PRE-REGISTERED RULE (docs/research/prereg-fan-model.md), n=120, cut=${CUT}:`);
if (n !== 120) {
  console.log(
    `    n is ${n}, not 120 — the cut scales to ${scaled} (${CUT} x ${n}/120). This is the ` +
      `pre-registered rule applied to the achieved n, not a new threshold.`,
  );
}
// REFUSE TO CONCLUDE BELOW A STATED FLOOR. The pre-registration fixed n=120; a
// scaled cut is a faithful application of the same rule only while n is large
// enough for the cut to be meaningful. At n=2 the scaled cut is 0 and "0 >= 0"
// would read as rejecting H0 — a verdict from no evidence at all.
const MIN_N = Number(process.env.VFM_MIN_N ?? 60);
const cut = n === 120 ? CUT : Math.max(1, scaled);
if (n < MIN_N) {
  console.log(
    `    NO CONCLUSION: n=${n} is below the floor of ${MIN_N}. The pre-registered rule needs\n` +
      `    n=120; below ${MIN_N} the scaled cut cannot separate 2.50% from 13.14%. Rates above\n` +
      `    are printed but must not be recorded as a verdict (practice 12).`,
  );
} else if (fails > BOTH_WRONG * (n / 120)) {
  console.log(`    ${fails} failures — ABOVE BOTH hypotheses' 3-sigma bands. THE MODEL IS WRONG in a new way.`);
} else if (fails >= cut) {
  console.log(`    ${fails} >= ${cut}: REJECT H0 (2.50%). Consistent with H1, the 13.14% timed prediction.`);
} else {
  console.log(`    ${fails} <= ${cut - 1}: REJECT H1 (13.14%). Consistent with H0, the 2.50% untimed rate.`);
  console.log(`    => the TIMED correction is not supported by measurement, and PLAN.md must be corrected.`);
}

console.log(`\n############ W1b — THE DISTRIBUTION (the load-bearing test) ############`);
// The model's shares, copied from fan-height-distribution.mjs's 200k run. Stated
// here as data so the comparison is auditable.
const MODEL = {
  209.5: 0.000015, 215.2: 0.00005, 230.8: 0.005640, 236.5: 0.00001,
  252.1: 0.169690, 273.4: 0.386795, 294.7: 0.304805, 316.0: 0.106465,
  337.3: 0.022080, 358.6: 0.002655, 379.9: 0.000210, 401.2: 0.000030,
};
const obs = new Map();
let offLattice = [];
for (const r of follow) {
  const nearest = Object.keys(MODEL).map(Number).reduce((a, b) => (Math.abs(b - r.fanH) < Math.abs(a - r.fanH) ? b : a));
  if (Math.abs(nearest - r.fanH) > 1.0) offLattice.push(r.fanH);
  obs.set(nearest, (obs.get(nearest) ?? 0) + 1);
}
console.log('  bin       model share   expected   observed   95% interval on expected   verdict');
let agree = true;
for (const binStr of Object.keys(MODEL).sort((a, b) => Number(a) - Number(b))) {
  const bin = Number(binStr);
  const share = MODEL[binStr];
  const exp = share * n;
  const o = obs.get(bin) ?? 0;
  if (exp < 5 && o === 0) continue;
  const sd = Math.sqrt(n * share * (1 - share));
  const lo = Math.max(0, Math.round(exp - 1.96 * sd));
  const hi = Math.round(exp + 1.96 * sd);
  const strict = exp >= 5;
  const inside = o >= lo && o <= hi;
  if (strict && !inside) agree = false;
  if (share >= 0.05 && o === 0) agree = false;
  console.log(
    `  ${String(bin).padStart(6)}px  ${(100 * share).toFixed(2).padStart(9)}%  ${exp.toFixed(1).padStart(9)}  ` +
      `${String(o).padStart(8)}   [${String(lo).padStart(3)}, ${String(hi).padStart(3)}]${' '.repeat(15)}` +
      `${strict ? (inside ? 'ok' : 'OUTSIDE') : '(not tested, expected < 5)'}`,
  );
}
if (offLattice.length > 0) {
  agree = false;
  console.log(`\n  OFF-LATTICE fanHeights (>1.0px from any bin): ${[...new Set(offLattice)].join(', ')}`);
  console.log('  => the HEIGHT FORMULA is wrong, not merely its weights.');
}
console.log(
  `\n  DISTRIBUTION VERDICT: ${agree ? 'AGREES with the model on every tested bin.' : 'DISAGREES — this is the round\'s headline finding.'}`,
);

console.log(`\n############ W1d — THE UNIT ############`);
console.log(
  `  Every rate above is PER DEAL AT THE VIEWER'S FIRST DECISION. That is the deal's\n` +
    `  MAXIMUM: the hand only shrinks as cards are played and fanHeight is monotone in\n` +
    `  the hand, so the per-TURN rate is strictly lower. Reported this way deliberately —\n` +
    `  it is the conservative direction — but it is not the same claim as "13% of turns".`,
);
const maxCards = Math.max(...rows.map((r) => r.cards));
const minCards = Math.min(...rows.map((r) => r.cards));
console.log(`  hand sizes observed at the measured moment: ${minCards}..${maxCards} cards.`);
