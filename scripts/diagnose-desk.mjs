// D1 + D2 — WHY deskH HAS TWO VALUES, AND WHETHER THE WELL SCALES WITH THE CARD.
//
// D1. The held-out run measured deskH at 161.5 on 16 deals and 156.5 on 7. That is 70%
// of deals sitting 5px BELOW the threshold every remedy in this arc was priced against,
// and 5px is a third of the 316.0 bin's 7.1px deficit. PLAN section 9 asserts
// `deskHeight <= 156.5px, structural`, and the majority of measured deals contradict it.
//
// DO NOT GUESS THE CAUSE. The 16/7 split matches no rare card type's frequency, so
// hypotheses about joker or wild faces are probably wrong. Rather than correlate deskH
// against external attributes, this DECOMPOSES it: the desk is a flex column, so
// deskH = sum(child heights) + gaps + padding + border. Whatever differs is one of the
// children, and the decomposition localises it inside the element instead of inferring
// it from outside. Per-deal attributes are logged alongside anyway, so a correlation is
// available if the decomposition does not settle it.
//
// D2. K = 198.6 decomposes with 73.5px of trick well, and cardH is 73.5px. Source says
// TrickWell renders `<CardFace size="hand">` (TrickWell.tsx:60,67) which selects
// `.gd-card--hand { --gd-cardw: clamp(2.75rem, 13vw, 4.25rem) }` — the SAME clamp as the
// fan — while `.gd-card--trick` (2.25rem) is documented DORMANT. So the well should
// scale with the card, and a card-scale change removes ~8.3px from K that the threshold
// model never counted. This measures it rather than resting on the read.
//
// Run: dev server up, then
//   DD_W=390 DD_H=664 node scripts/diagnose-desk.mjs

const BASE = process.env.DD_BASE ?? 'http://localhost:8787';
if (process.env.DD_W === undefined || process.env.DD_H === undefined) {
  console.log(
    '\nDD_W and DD_H are REQUIRED — there is deliberately no default.\n' +
      '  INNER dimensions, browser chrome EXCLUDED.\n' +
      '  e.g.  DD_W=390 DD_H=664 node scripts/diagnose-desk.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.DD_W);
const VH = Number(process.env.DD_H);
const DEALS = Number(process.env.DD_DEALS ?? 24);
const THEME = process.env.DD_THEME ?? 'lacquer';
// The candidate axis for the deskH split: the C1 held-out run that saw 161.5 was
// DESCENDING, and this diagnostic's first run (ascending) saw 156.5 on 20/20.
const SORT = process.env.DD_SORT === 'descending' ? 'descending' : 'ascending';

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'DD_W (required)' },
  viewportHeight: { value: 'DD_H (required)' },
  deckTheme: { value: 'DD_THEME, default lacquer' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'standard 45s/90s (the product default)' },
  shelf: { value: 'none' },
  handSort: { value: 'DD_SORT, default ascending (the product default)' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both, recorded per deal', justification: 'the desk is not a function of the trick, so both populations inform the decomposition' },
  turnDecidability: { value: 'decidable turns only', justification: 'a forced-pass turn renders no countdown bar, which is itself one of the desk children under test' },
  orientation: { value: 'portrait' },
  textScale: { value: '100%' },
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

// DECOMPOSE THE DESK. Every direct child, its class and its height — plus the desk's
// own padding, border and gap, so the sum can be reconciled against the whole.
const DESK = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const desk = document.querySelector('.gd-desk');
  if (desk === null) return { error: 'no desk' };
  const cs = getComputedStyle(desk);
  const kids = [...desk.children].map((el) => ({
    cls: el.className,
    h: r(el.getBoundingClientRect().height),
    text: (el.textContent ?? '').slice(0, 24),
  }));
  const well = document.querySelector('.gd-well');
  const wellCard = document.querySelector('.gd-well .gd-card');
  const fanCard = document.querySelector('.gd-fan__card .gd-card, .gd-fan__card');
  const stagedCard = document.querySelector('.gd-desk__stagedCard .gd-card');
  return {
    deskH: r(desk.getBoundingClientRect().height),
    padTop: r(parseFloat(cs.paddingTop)), padBottom: r(parseFloat(cs.paddingBottom)),
    borderTop: r(parseFloat(cs.borderTopWidth)), borderBottom: r(parseFloat(cs.borderBottomWidth)),
    gap: r(parseFloat(cs.rowGap === 'normal' ? '0' : cs.rowGap) || 0),
    kids,
    // D2: does the well's card render at the same size as the fan's?
    wellH: well === null ? null : r(well.getBoundingClientRect().height),
    wellCardW: wellCard === null ? null : r(wellCard.getBoundingClientRect().width),
    wellCardH: wellCard === null ? null : r(wellCard.getBoundingClientRect().height),
    fanCardW: fanCard === null ? null : r(fanCard.getBoundingClientRect().width),
    fanCardH: fanCard === null ? null : r(fanCard.getBoundingClientRect().height),
    stagedCardW: stagedCard === null ? null : r(stagedCard.getBoundingClientRect().width),
    // per-deal attributes, so a correlation is available if the decomposition is not enough
    title: (document.querySelector('.gd-desk__title')?.textContent ?? '').slice(0, 30),
    status: (document.querySelector('.gd-desk__status')?.textContent ?? '').slice(0, 30),
    statusHint: (document.querySelector('.gd-desk__statusHint')?.textContent ?? '').slice(0, 30),
    hasBar: document.querySelector('.gd-desk__bar') !== null,
    hasClock: document.querySelector('.gd-desk__clock') !== null,
    hasMore: document.querySelector('.gd-desk__more') !== null,
    hasClear: document.querySelector('.gd-desk__clear') !== null,
    hasSetAside: document.querySelector('.gd-desk__setAside') !== null,
    stagedLabel: document.querySelector('.gd-desk__stagedCard')?.getAttribute('aria-label') ?? null,
    deskClasses: desk.className,
    following: (well?.getBoundingClientRect().height ?? 0) > 0,
  };
}`;

const browser = await chromium.launch();
console.log(`=== D1/D2 DESK DIAGNOSIS @ INNER ${VW}x${VH} (${THEME}, zh-Hant, timed, sort ${SORT}) ===`);
console.log('    INNER dimensions, browser chrome EXCLUDED. One card staged.\n');

const rows = [];
for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  let drive;
  try {
    await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
    const a = await ctx.newPage();
    await a.goto(BASE, { waitUntil: 'networkidle' });
    drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
  } catch (e) {
    await ctx.close();
    console.log(`  deal ${deal}: driver failed, skipped`);
    continue;
  }
  const ctxB = await browser.newContext({ viewport: { width: VW, height: VH } });
  await ctxB.addInitScript((seed) => {
    localStorage.setItem('locale', 'zh-Hant');
    localStorage.setItem('pref:deckTheme', seed.theme);
    if (seed.sort === 'descending') localStorage.setItem('pref:handSort', 'desc');
    localStorage.setItem('room:' + seed.code, JSON.stringify({ tokens: [seed.tokens[0]], lastSeenSeq: seed.lastSeq }));
  }, { ...drive, theme: THEME, sort: SORT });
  const p = await ctxB.newPage();
  await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await p.waitForTimeout(850);
  await p.evaluate(() => document.querySelector('.gd-fan__card')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(320);
  const d = await p.evaluate(`(${DESK})()`);
  if (d.error) throw new Error(`deal ${deal}: ${d.error}`);
  rows.push(d);
  console.log(
    `  deal ${String(deal).padStart(2)}: deskH ${String(d.deskH).padStart(6)}  ` +
      `kids ${d.kids.map((k) => `${k.cls.replace('gd-desk__', '')}:${k.h}`).join(' ')}  staged="${d.stagedLabel ?? '?'}"`,
  );
  await ctx.close();
  await ctxB.close();
}
await browser.close();

// ---------------------------------------------------------------- D1
const byH = new Map();
for (const r of rows) byH.set(r.deskH, (byH.get(r.deskH) ?? 0) + 1);
console.log(`\n--- D1: deskH VALUES OBSERVED (${rows.length} deals) ---`);
for (const [h, n] of [...byH.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${h}px on ${n}/${rows.length} deals`);
}
if (byH.size === 1) {
  console.log('  ONE value here. The split did not reproduce in this configuration.');
} else {
  const heights = [...byH.keys()].sort((a, b) => a - b);
  const lo = rows.find((r) => r.deskH === heights[0]);
  const hi = rows.find((r) => r.deskH === heights[heights.length - 1]);
  console.log(`\n  DECOMPOSITION — the two states side by side:`);
  const names = [...new Set([...lo.kids, ...hi.kids].map((k) => k.cls))];
  for (const cls of names) {
    const a = lo.kids.find((k) => k.cls === cls);
    const b = hi.kids.find((k) => k.cls === cls);
    const mark = (a?.h ?? 0) !== (b?.h ?? 0) ? '   <-- DIFFERS' : '';
    console.log(
      `    ${cls.padEnd(42)} ${String(a?.h ?? 'absent').padStart(7)}  vs ${String(b?.h ?? 'absent').padStart(7)}${mark}`,
    );
  }
  console.log(
    `\n  padding ${lo.padTop}/${lo.padBottom} vs ${hi.padTop}/${hi.padBottom}   ` +
      `border ${lo.borderTop}/${lo.borderBottom} vs ${hi.borderTop}/${hi.borderBottom}   ` +
      `gap ${lo.gap} vs ${hi.gap}`,
  );
  console.log(`  title  "${lo.title}"  vs  "${hi.title}"`);
  console.log(`  status "${lo.status}"  vs  "${hi.status}"`);
  console.log(`  hint   "${lo.statusHint}"  vs  "${hi.statusHint}"`);
  console.log(
    `  bar ${lo.hasBar}/${hi.hasBar}  clock ${lo.hasClock}/${hi.hasClock}  ` +
      `clear ${lo.hasClear}/${hi.hasClear}  setAside ${lo.hasSetAside}/${hi.hasSetAside}`,
  );
  // Is the split content-dependent (practice 18) or state-dependent?
  const kidCounts = new Set(rows.map((r) => r.kids.length));
  console.log(
    `\n  child COUNT across all deals: ${[...kidCounts].join(', ')} — ` +
      (kidCounts.size === 1
        ? 'the same children every time, so the difference is a HEIGHT, not a presence.'
        : 'the children themselves differ, so a child appears or disappears.'),
  );
}

// ---------------------------------------------------------------- D2
console.log(`\n--- D2: DOES THE TRICK WELL SCALE WITH THE CARD? ---`);
const withWell = rows.filter((r) => r.wellCardW !== null);
if (withWell.length === 0) {
  console.log('  no deal rendered a non-empty well; inconclusive here.');
} else {
  const w = withWell[0];
  const same = Math.abs((w.wellCardW ?? 0) - (w.fanCardW ?? 0)) <= 0.5;
  console.log(`  well card ${w.wellCardW}x${w.wellCardH}   fan card ${w.fanCardW}x${w.fanCardH}`);
  console.log(
    `  => the well ${same ? 'SCALES WITH' : 'does NOT scale with'} the hand card.` +
      (same
        ? ` So a cardW change removes ${((w.wellCardH ?? 0) * (1 - 44.95 / 50.7)).toFixed(1)}px from K` +
          ' at cardW 44.95, which the threshold model never counted.'
        : ' The fan would shrink while the well does not — a visual inconsistency to weigh.'),
  );
  console.log(
    `  aspect check: well ${((w.wellCardH ?? 1) / (w.wellCardW ?? 1)).toFixed(4)}, ` +
      `fan ${((w.fanCardH ?? 1) / (w.fanCardW ?? 1)).toFixed(4)} — source says ` +
      'height: calc(var(--gd-cardw) * 1.45), a fixed multiplier with no separate clamp.',
  );
}
