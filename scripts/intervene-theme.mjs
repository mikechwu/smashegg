// L1 — THE SECOND DECK THEME'S OWN EFFECT ON SIMULTANEITY, BY INTERVENTION.
//
// WHY AN INTERVENTION AND NOT TWO SWEEPS. A theme-vs-theme comparison across two separate
// runs is confounded by the state each run happened to land in: K is 198.6px when the trick
// well renders and 66.0px when the viewer leads, so a 132.5px difference in the mix of
// lead and follow turns swamps the effect being measured. A first attempt at this comparison
// did exactly that — two 14-deal runs, cinnabar's spans 60-100px larger as predicted, and
// the panel profile fitting in BOTH arms because the deals were a mix of states. That run
// tests nothing about the model's following-state rate.
//
// So: same page, same deal, same scroll state, same turn. Only the deck theme is toggled,
// and it is toggled THROUGH THE PICKER the player uses, so the arms differ by exactly the
// action a player takes.
//
// WHAT THIS MEASURES. `stackStripW` is a per-theme metric: lacquer leaves 0.42 of each
// covered card visible in a stacked column, cinnabar-court 0.841. It multiplies into the
// lattice step, so the model predicts cinnabar's fan grows about twice as fast with depth
// and that its band edges sit at a far smaller card. This is the check on whether the model
// extends to the second theme at all.
//
// Run: dev server up, then
//   IC_W=390 IC_H=664 node scripts/intervene-theme.mjs

import { PROFILES, SIMULTANEITY_PROBE, spanFor } from './simultaneity.mjs';

const BASE = process.env.IC_BASE ?? 'http://localhost:8787';
if (process.env.IC_W === undefined || process.env.IC_H === undefined) {
  console.log(
    '\nIC_W and IC_H are REQUIRED — there is deliberately no default.\n' +
      '  INNER dimensions, browser chrome EXCLUDED.\n' +
      '  e.g.  IC_W=390 IC_H=664 node scripts/intervene-cardw.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.IC_W);
const VH = Number(process.env.IC_H);
const DEALS = Number(process.env.IC_DEALS ?? 12);
const LOCALE = process.env.IC_LOCALE ?? 'zh-Hant';
// The two arms: theme ids, switched through the header picker.
const FROM = process.env.IC_FROM ?? 'lacquer';
// NO DEFAULT FOR THE TARGET THEME. It defaulted to 'cinnabar-court', which round M2
// unregistered — so the default names a deck the app cannot render. This script switches
// through the PICKER and asserts the select actually took the value, so it fails loudly
// rather than silently measuring lacquer twice (setting `select.value` to a nonexistent
// option leaves it empty). Loud is the right behaviour and it is still the wrong default:
// a script whose out-of-the-box invocation cannot work is a trap for the next reader.
if (process.env.IC_TO === undefined) {
  console.log(
    '\nIC_TO is REQUIRED — there is deliberately no default.\n' +
      '  The theme to switch TO. It must be a REGISTERED deck theme; an unregistered id\n' +
      '  cannot render and this script will refuse rather than measure the fallback.\n' +
      '  e.g.  IC_W=390 IC_H=664 IC_FROM=lacquer IC_TO=<theme> node scripts/intervene-theme.mjs\n',
  );
  process.exit(2);
}
const TO = process.env.IC_TO;

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'IC_W (required)' },
  viewportHeight: { value: 'IC_H (required)' },
  deckTheme: { value: 'INTERVENED — this is the axis under measurement' },
  locale: { value: 'IC_LOCALE, default zh-Hant' },
  roomTiming: { value: 'standard 45s/90s (the product default)' },
  shelf: { value: 'none' },
  handSort: { value: 'ascending (the product default)' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both', justification: 'held FIXED within each pair, which is what an intervention requires; it is not held across pairs' },
  turnDecidability: { value: 'decidable turns only' },
  orientation: { value: 'portrait' },
  textScale: { value: '100% (root 16px)', justification: 'the cap expression is measured separately by measure-glyph-scale.mjs' },
  browserChrome: { value: 'none (headless inner size)', justification: 'inner size set directly' },
  handSize: { value: '27 (first decision)' },
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


// M0 — THE HAND'S DEPTH, COUNTED, NOT INFERRED.
//
// The model makes a per-deal POINT prediction of this intervention's effect:
//
//     dSpan(s) = (stripW_after - stripW_before) * cardW * (s - 2)
//
// Testing it needs `s` for each deal, and `s` must come from somewhere INDEPENDENT of the
// pixel measurement, or the regression is circular: s recovered from a fan height and then
// regressed against a difference of fan heights would be fitting a quantity to itself.
//
// So s is COUNTED. d1 and d2 are the number of cards in the deepest column on each of the
// two visual fan lines, read as DOM element counts; lines are separated by their bottom
// coordinate, the same way containment.mjs finds them. A count of cards cannot be a
// restatement of a measurement in pixels.
const DEPTH_PROBE = `() => {
  const row = document.querySelector('.gd-fan__stackRow');
  if (row === null) return null;
  const stacks = [...row.querySelectorAll('.gd-fan__stack')];
  if (stacks.length === 0) return null;
  const bottoms = stacks.map((el) => Math.round(el.getBoundingClientRect().bottom));
  const lines = [...new Set(bottoms)].sort((a, b) => a - b);
  const depthOn = (bottom) =>
    Math.max(...stacks.filter((el, i) => bottoms[i] === bottom)
      .map((el) => el.querySelectorAll('.gd-fan__card').length));
  const d1 = depthOn(lines[0]);
  const d2 = lines.length > 1 ? depthOn(lines[1]) : 0;
  return { d1, d2, s: d2 === 0 ? d1 : d1 + d2, lines: lines.length, columns: stacks.length };
}`;

const browser = await chromium.launch();
console.log(`=== L1 DECK-THEME INTERVENTION @ INNER ${VW}x${VH} (${LOCALE}, timed) ===`);
console.log(
  `    BEFORE: deck theme ${FROM}.\n    AFTER:  deck theme ${TO}, selected through the header picker.\n` +
    `    Same page, same deal, same scroll state, same turn; only the theme is intervened on.\n`,
);

const rows = [];
let jokerStagedRuns = 0;
for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  let drive;
  try {
    await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
    const a = await ctx.newPage();
    await a.goto(BASE, { waitUntil: 'networkidle' });
    drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
  } catch (e) {
    console.log(`  deal ${deal}: drive failed (${e.message}) — skipped`);
    await ctx.close();
    continue;
  }
  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', seed.locale);
    localStorage.setItem('pref:deckTheme', seed.theme);
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, { ...drive, theme: FROM, locale: LOCALE });
  const p = await ctxB.newPage();
  await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await p.waitForTimeout(850);

  // Stage a card so the desk's stage row is populated in BOTH arms — an empty stage in one
  // arm and a full one in the other would be a second difference, and then the delta would
  // not belong to the card width. A joker where the hand has one, by class rather than by
  // the localised label.
  const staged = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.gd-fan__card')];
    const joker = cards.find((c) => c.querySelector('.gd-card--joker') !== null);
    const pick = joker ?? cards[0];
    if (pick === undefined) return 'none';
    pick.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return joker === undefined ? 'ordinary' : 'joker';
  });
  if (staged === 'joker') jokerStagedRuns += 1;
  await p.waitForTimeout(220);

  const arm = async (themeId) => {
    // Switch through the PICKER, not by writing localStorage and reloading: a reload loses
    // the hand, and the hand is the thing being held fixed.
    const ok = await p.evaluate((id) => {
      const sel = document.querySelector('select.app-themeSelect');
      if (sel === null) return 'no picker';
      sel.value = id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return sel.value === id ? 'ok' : 'value did not take';
    }, themeId);
    if (ok !== 'ok') throw new Error(`theme switch failed: ${ok}`);
    await p.waitForTimeout(320);
    const s = await p.evaluate(`(${SIMULTANEITY_PROBE})({})`);
    // spanFor returns a RECORD, not a number. Take .span (the union document extent) and
    // .deficit (span minus innerH — negative is slack) explicitly, so the arithmetic below
    // can never be doing string or object coercion.
    const panel = spanFor(s, PROFILES.panel.facts);
    const inhouse = spanFor(s, PROFILES['in-house'].facts);
    if (panel === null || inhouse === null) throw new Error('a profile matched no facts — vacuous probe');
    return { panel: panel.span, inhouse: inhouse.span, deficit: panel.deficit, feasible: panel.feasible };
  };

  // BEFORE then AFTER then BEFORE AGAIN. The third arm is the control: if the page has any
  // hysteresis — a layout that does not fully settle, an animation, a scroll the probe
  // itself provoked — the two BEFORE readings will differ, and a delta smaller than that
  // drift is not a measurement of anything.
  // Depth is read in the BEFORE arm and is a property of the hand, not of the theme.
  const depth = await p.evaluate(`(${DEPTH_PROBE})()`);
  const before = await arm(FROM);
  const after = await arm(TO);
  const beforeAgain = await arm(FROM);

  const drift = Math.abs(beforeAgain.panel - before.panel);
  rows.push({
    deal,
    s: depth === null ? null : depth.s,
    d1: depth === null ? null : depth.d1,
    d2: depth === null ? null : depth.d2,
    columns: depth === null ? null : depth.columns,
    staged,
    beforePanel: before.panel,
    afterPanel: after.panel,
    beforeFeasible: before.feasible,
    afterFeasible: after.feasible,
    beforeDeficit: before.deficit,
    afterDeficit: after.deficit,
    deltaPanel: Math.round((after.panel - before.panel) * 10) / 10,
    deltaInhouse: Math.round((after.inhouse - before.inhouse) * 10) / 10,
    drift: Math.round(drift * 10) / 10,
  });
  await ctxB.close();
  await ctx.close();
}
await browser.close();

if (rows.length === 0) {
  console.log('\nNO DEAL WAS MEASURED — this run proves nothing.');
  process.exit(1);
}

console.log('  deal   staged      d1+d2 = s   span BEFORE   span AFTER   delta (panel)   control drift');
for (const r of rows) {
  console.log(
    `  ${String(r.deal).padStart(4)}   ${r.staged.padEnd(9)}  ` +
      `${String(r.d1).padStart(3)}+${String(r.d2).padEnd(3)} = ${String(r.s).padEnd(3)}  ` +
      `${r.beforePanel.toFixed(1).padStart(11)}   ${r.afterPanel.toFixed(1).padStart(10)}   ` +
      `${String(r.deltaPanel).padStart(13)}   ${String(r.drift).padStart(13)}`,
  );
}

const deltas = rows.map((r) => r.deltaPanel);
const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
const worstDrift = Math.max(...rows.map((r) => r.drift));
console.log(
  `\n  n = ${rows.length}   panel-span delta: min ${Math.min(...deltas)}px  ` +
    `mean ${mean.toFixed(1)}px  max ${Math.max(...deltas)}px`,
);
console.log(`  joker staged on ${jokerStagedRuns}/${rows.length} deals`);
// FEASIBILITY IS THE DECISION QUANTITY, not the span. A span that shrinks while both arms
// stay infeasible has improved nothing a player can see.
const flipped = rows.filter((r) => !r.beforeFeasible && r.afterFeasible).length;
// THE REGRESSION DIRECTION NEEDS ITS OWN COUNTER. The first version of this reported only
// the improving flip, the both-feasible count and the both-infeasible count — so a deal that
// went feasible -> INFEASIBLE appeared in none of them and had to be inferred by subtracting
// the other three from n. An intervention that can make things worse must be able to SAY so.
const broke = rows.filter((r) => r.beforeFeasible && !r.afterFeasible).length;
const bothFeasible = rows.filter((r) => r.beforeFeasible && r.afterFeasible).length;
const bothInfeasible = rows.filter((r) => !r.beforeFeasible && !r.afterFeasible).length;
console.log(
  `  panel-profile FEASIBILITY: ${flipped} infeasible -> feasible, ` +
    `**${broke} feasible -> INFEASIBLE**, ${bothFeasible} feasible in both, ` +
    `${bothInfeasible} infeasible in both  (n = ${rows.length})`,
);
if (flipped + broke + bothFeasible + bothInfeasible !== rows.length) {
  console.log('  THE FOUR COUNTS DO NOT SUM TO n — a deal fell through this classification.');
  process.exitCode = 1;
}
console.log(
  `  worst deficit (span - innerH): BEFORE ${Math.max(...rows.map((r) => r.beforeDeficit))}px, ` +
    `AFTER ${Math.max(...rows.map((r) => r.afterDeficit))}px`,
);
console.log(`  worst control drift (BEFORE re-measured): ${worstDrift}px`);

// ---------------------------------------------------------------- M0: the point prediction
// TWELVE PAIRED CONTINUOUS MEASUREMENTS PIN THE EXTENSION FAR TIGHTER THAN TWELVE BINARY
// FLIPS. A 6-of-12 flip rate carries a 95% interval of roughly [21%, 79%] and is consistent
// with 25% and 75% as readily as with the 51.3% modelled — which is the low-power agreement
// claim this project spent an arc learning to reject. The slope below is the strong test.
{
  const usable = rows.filter((r) => r.s !== null && r.d1 !== null);
  const STRIP_FROM = Number(process.env.IC_STRIP_FROM ?? 0.42);
  const STRIP_TO = Number(process.env.IC_STRIP_TO ?? 0.841);
  const CARDW = Number(process.env.IC_CARDW ?? 46.51);
  const BUDGET = 2.95; // stackOffsetW's fixed spread budget, HandFan.tsx

  // THE PREDICTION IS NOT LINEAR IN s, AND FINDING THAT IS WHAT THIS TEST WAS FOR.
  //
  // `stackOffsetW(n, strip) = min(strip, 2.95 / (n - 1))`, so a column's total reveal is
  // `min(strip * (n - 1), 2.95)` card widths — a fixed budget spread over the reveals once
  // the strip would exceed it. The budget binds at n >= 5 for a 0.841 strip and NEVER for a
  // 0.42 one, because a value class holds at most 8 copies and 0.42 * 7 = 2.94.
  //
  // So `dSpan(s) = (stripTo - stripFrom) * w * (s - 2)` is exact for lacquer and WRONG for
  // any theme whose strip is large enough to hit the budget. Both forms are fitted below and
  // the comparison is the finding.
  const reveal = (n, strip) => (n <= 1 ? 0 : Math.min(strip * (n - 1), BUDGET));
  const capped = (r) =>
    CARDW * (reveal(r.d1, STRIP_TO) + reveal(r.d2, STRIP_TO) - reveal(r.d1, STRIP_FROM) - reveal(r.d2, STRIP_FROM));
  const linear = (r) => (STRIP_TO - STRIP_FROM) * CARDW * (r.s - 2);

  console.log(`\n  --- M0: PER-DEAL POINT PREDICTION, at cardW ${CARDW}, strip ${STRIP_FROM} -> ${STRIP_TO} ---`);
  if (usable.length < 4) {
    console.log('  TOO FEW DEALS WITH A COUNTED DEPTH — no test. This proves nothing.');
    process.exitCode = 1;
  } else {
    const worstOf = (f) => Math.max(...usable.map((r) => Math.abs(f(r) - r.deltaPanel)));
    const wLin = worstOf(linear);
    const wCap = worstOf(capped);
    const xs = usable.map((r) => r.s - 2);
    const ys = usable.map((r) => r.deltaPanel);
    const slope0 = xs.reduce((a, x, i) => a + x * ys[i], 0) / xs.reduce((a, x) => a + x * x, 0);
    console.log(`  n = ${usable.length}   distinct s: ${[...new Set(usable.map((r) => r.s))].sort((a, b) => a - b).join(', ')}`);
    console.log(`  LINEAR in (s-2): predicted slope ${((STRIP_TO - STRIP_FROM) * CARDW).toFixed(2)}, fitted ${slope0.toFixed(2)}, worst residual ${wLin.toFixed(2)}px`);
    console.log(`  CAPPED (the 2.95w budget):                                worst residual ${wCap.toFixed(2)}px`);
    const deep = usable.filter((r) => Math.max(r.d1, r.d2) >= 5).length;
    console.log(`  deals with a column of 5 or more (where the budget binds): ${deep} of ${usable.length}`);
    if (deep === 0) {
      console.log('  NO DEAL EXERCISED THE BUDGET — this run cannot tell the two forms apart.');
      process.exitCode = 1;
    } else if (wCap < wLin) {
      console.log(
        `  => the CAPPED form fits ${(wLin / Math.max(wCap, 0.01)).toFixed(0)}x tighter. The linear\n` +
          '     extension overstates any theme whose strip reaches the budget.',
      );
    }
    if (new Set(usable.map((r) => r.s)).size < 2) {
      console.log('  ONLY ONE DISTINCT DEPTH — a slope through one x value is not a slope.');
      process.exitCode = 1;
    }
  }
}
// A VIEWPORT WHERE NO INTERVENTION IS POSSIBLE IS A CONTROL, NOT A NULL RESULT. Above the
// layout breakpoint the shipped rule IS the old expression, so the two arms are the same
// CSS and the honest expectation is exactly 0.00px. Reporting that through the
// effect-versus-drift test would print "the page does not settle tightly enough", which is
// a diagnosis of the wrong thing: the delta is zero because nothing was changed, and a
// nonzero delta here would mean the media query is not doing what it claims.
const noIntervention = false;
if (noIntervention) {
  const nonzero = rows.filter((r) => r.deltaPanel !== 0);
  console.log(
    `\n  CONTROL CELL: at inner width ${VW} the shipped rule is the SAME expression as the\n` +
      `  BEFORE arm (the card constant applies only below the 720px layout breakpoint), so\n` +
      `  the expected delta is exactly 0.00px and this run tests the media query itself.`,
  );
  if (nonzero.length === 0) {
    console.log(`  0.00px on ${rows.length}/${rows.length} deals. The desktop branch is untouched.`);
  } else {
    console.log(
      `  ${nonzero.length}/${rows.length} deals moved. THE MEDIA QUERY IS LEAKING — the phone\n` +
        `  constant is reaching a viewport it must not reach.`,
    );
    process.exitCode = 1;
  }
} else if (worstDrift >= Math.abs(mean)) {
  console.log(
    '\n  THE CONTROL DRIFT IS AS LARGE AS THE EFFECT. Report no effect from this run: the\n' +
      '  page does not settle tightly enough at this viewport for a delta of this size.',
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n  The effect is ${(Math.abs(mean) / Math.max(worstDrift, 0.05)).toFixed(0)}x the worst control drift.\n` +
      `  A NEGATIVE delta is span REMOVED, which is slack GAINED.`,
  );
}
