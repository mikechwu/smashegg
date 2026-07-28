// E1 + E2 — WHERE DOES THE 5px COME FROM, AND IS 161.5 A BOUND?
//
// THE CONTRADICTION THIS RESOLVES. D1 concluded "a joker card face is 5px taller, aspect
// 1.548". D2 read from source that `.gd-card` sets `height: calc(var(--gd-cardw) * 1.45)`
// with no separate clamp, and that the fan, the well and the stage all render
// `<CardFace size="hand">`. Both cannot be true on one render path. And C1's criterion 3
// measured a worst off-lattice distance of 0.1px while 69% of hands hold a joker — so the
// FAN is not 5px taller on joker hands, which means the fan constrains something the
// stage does not.
//
// D1'S ATTRIBUTION WAS LOOSE, AND THIS CHECKS IT. What D1 measured was
// `.gd-desk__stage` — the flex ROW — at 78.5 against 73.5. It then said "the card face is
// 5px taller". A row is not a card: the row's height is its tallest item's MARGIN box,
// so padding, a transform, an outline or an overflowing child would all produce the same
// reading. This measures every layer — row, button, frame, card, art — in both states, so
// the 5px is attributed to a box rather than inferred.
//
// E2. D1's 161.5 came from staging `cards[0]`, which is the highest value class under
// descending and the lowest under ascending — so 32 deals probed three of fifteen
// classes. This stages EVERY distinct class present in the hand and reports deskH for
// each, so "the worst case is 161.5" is either proved or replaced.
//
// Run: dev server up, then
//   CB_W=390 CB_H=664 node scripts/diagnose-cardbox.mjs

const BASE = process.env.CB_BASE ?? 'http://localhost:8787';
if (process.env.CB_W === undefined || process.env.CB_H === undefined) {
  console.log(
    '\nCB_W and CB_H are REQUIRED — there is deliberately no default.\n' +
      '  INNER dimensions, browser chrome EXCLUDED.\n' +
      '  e.g.  CB_W=390 CB_H=664 node scripts/diagnose-cardbox.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.CB_W);
const VH = Number(process.env.CB_H);
const DEALS = Number(process.env.CB_DEALS ?? 3);
const THEME = process.env.CB_THEME ?? 'lacquer';

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'CB_W (required)' },
  viewportHeight: { value: 'CB_H (required)' },
  deckTheme: { value: 'CB_THEME, default lacquer' },
  locale: { value: 'zh-Hant' },
  roomTiming: { value: 'standard 45s/90s (the product default)' },
  shelf: { value: 'none' },
  handSort: { value: 'ascending (the product default)' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both', justification: 'the desk is not a function of the trick' },
  turnDecidability: { value: 'decidable turns only', justification: 'a forced-pass turn renders no desk stage to measure' },
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

// EVERY LAYER, so the 5px is attributed to a box rather than inferred from a row.
const LAYERS = `() => {
  const r = (n) => Math.round(n * 10) / 10;
  const box = (el) => {
    if (el === null || el === undefined) return null;
    const q = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      w: r(q.width), h: r(q.height),
      mt: r(parseFloat(cs.marginTop) || 0), mb: r(parseFloat(cs.marginBottom) || 0),
      pt: r(parseFloat(cs.paddingTop) || 0), pb: r(parseFloat(cs.paddingBottom) || 0),
      bt: r(parseFloat(cs.borderTopWidth) || 0), bb: r(parseFloat(cs.borderBottomWidth) || 0),
      transform: cs.transform === 'none' ? null : cs.transform,
      overflow: cs.overflow,
      tag: el.tagName,
      cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 46),
    };
  };
  const stage = document.querySelector('.gd-desk__stage');
  const btn = document.querySelector('.gd-desk__stagedCard');
  const frame = btn ? btn.querySelector('.gd-cardframe') : null;
  const card = btn ? btn.querySelector('.gd-card') : null;
  const art = btn ? btn.querySelector('svg') : null;
  // The same card class rendered in the FAN, for comparison.
  const fanCard = document.querySelector('.gd-fan__card .gd-card');
  const fanArt = document.querySelector('.gd-fan__card svg');
  const wellCard = document.querySelector('.gd-well .gd-card');
  const wellArt = document.querySelector('.gd-well svg');
  return {
    label: btn ? btn.getAttribute('aria-label') : null,
    stage: box(stage), btn: box(btn), frame: box(frame), card: box(card), art: box(art),
    fanCard: box(fanCard), fanArt: box(fanArt),
    wellCard: box(wellCard), wellArt: box(wellArt),
    deskH: r((document.querySelector('.gd-desk') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height),
    // Is the art larger than the box that holds it?
    artOverflowsCard: art && card ? r(art.getBoundingClientRect().height - card.getBoundingClientRect().height) : null,
    // E1a: the button's own subtree, so the 5px can be attributed to an ELEMENT rather
    // than to a theory about line boxes. Every descendant with its box and offset from
    // the button's top — whatever ends 5px below the card is the answer.
    subtree: btn === null ? null : [...btn.querySelectorAll('*')].map((el) => {
      const q = el.getBoundingClientRect();
      const bq = btn.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 40),
        top: r(q.top - bq.top), bottom: r(q.bottom - bq.top), h: r(q.height),
        pos: cs.position, disp: cs.display,
      };
    }),
  };
}`;

const browser = await chromium.launch();
console.log(`=== E1/E2 CARD BOX DIAGNOSIS @ INNER ${VW}x${VH} (${THEME}, zh-Hant, timed) ===`);
console.log('    INNER dimensions, browser chrome EXCLUDED.\n');

const seen = new Map();
for (let deal = 0; deal < DEALS; deal += 1) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  let drive;
  try {
    await ctx.addInitScript(() => localStorage.setItem('locale', 'zh-Hant'));
    const a = await ctx.newPage();
    await a.goto(BASE, { waitUntil: 'networkidle' });
    drive = await a.evaluate(`(${DRIVER})(${JSON.stringify({ config: CONFIG })})`);
  } catch {
    await ctx.close();
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

  // E2: stage EVERY distinct value class this hand holds, one at a time.
  const groups = await p.evaluate(() => {
    const out = [];
    const stacks = [...document.querySelectorAll('.gd-fan__stack')];
    stacks.forEach((s, i) => {
      const c = s.querySelector('.gd-fan__card');
      out.push({ i, label: c ? c.getAttribute('aria-label') : null });
    });
    return out;
  });
  for (const g of groups) {
    await p.evaluate(() => {
      for (const c of document.querySelectorAll('.gd-fan__card[aria-pressed="true"]')) {
        c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await p.waitForTimeout(90);
    const ok = await p.evaluate((i) => {
      const s = document.querySelectorAll('.gd-fan__stack')[i];
      const c = s ? s.querySelector('.gd-fan__card') : null;
      if (c === null) return false;
      c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }, g.i);
    if (!ok) continue;
    await p.waitForTimeout(200);
    const L = await p.evaluate(`(${LAYERS})()`);
    if (L.label === null) continue;
    const key = (L.label || '').replace(/^\S+\s*/, '');
    if (!seen.has(key)) seen.set(key, L);
  }
  await ctx.close();
  await ctxB.close();
}
await browser.close();

console.log('--- E2: deskH BY STAGED VALUE CLASS (every class reached) ---');
console.log('  staged card         deskH   stage row   button   frame    card     art   art-card');
const rows = [...seen.entries()].sort((a, b) => b[1].deskH - a[1].deskH);
for (const [label, L] of rows) {
  console.log(
    `  ${label.padEnd(18)} ${String(L.deskH).padStart(6)}  ${String(L.stage?.h).padStart(9)}  ` +
      `${String(L.btn?.h).padStart(7)}  ${String(L.frame?.h).padStart(6)}  ${String(L.card?.h).padStart(6)}  ` +
      `${String(L.art?.h ?? '-').padStart(6)}  ${String(L.artOverflowsCard ?? '-').padStart(7)}`,
  );
}
const heights = [...new Set(rows.map(([, L]) => L.deskH))].sort((a, b) => a - b);
console.log(`\n  distinct deskH values: ${heights.join(', ')}   over ${rows.length} value classes reached`);

console.log('\n--- E1a: WHICH LAYER CARRIES THE 5px? ---');
if (heights.length < 2) {
  console.log('  only one deskH here; run more deals to reach a joker.');
} else {
  const hi = rows[0][1];
  const lo = rows[rows.length - 1][1];
  const cmp = (name, a, b) =>
    console.log(
      `  ${name.padEnd(10)} ${String(a?.h ?? '-').padStart(7)} vs ${String(b?.h ?? '-').padStart(7)}` +
        `${(a?.h ?? 0) !== (b?.h ?? 0) ? '   <-- DIFFERS' : ''}` +
        `   (margins ${a?.mt ?? '-'}/${a?.mb ?? '-'} vs ${b?.mt ?? '-'}/${b?.mb ?? '-'};` +
        ` transform ${a?.transform ? 'yes' : 'no'} vs ${b?.transform ? 'yes' : 'no'})`,
    );
  console.log(`  tallest staged: "${rows[0][0]}"   shortest: "${rows[rows.length - 1][0]}"`);
  cmp('stage row', hi.stage, lo.stage);
  cmp('button', hi.btn, lo.btn);
  cmp('frame', hi.frame, lo.frame);
  cmp('card', hi.card, lo.card);
  cmp('art(svg)', hi.art, lo.art);
  console.log(
    `\n  art beyond its card box: ${hi.artOverflowsCard}px (tallest) vs ${lo.artOverflowsCard}px (shortest)`,
  );
  console.log(
    `  SAME CARD CLASS IN THE FAN: card ${hi.fanCard?.h}, art ${hi.fanArt?.h ?? '-'}` +
      `   IN THE WELL: card ${hi.wellCard?.h ?? '-'}, art ${hi.wellArt?.h ?? '-'}`,
  );
  console.log(`\n  THE TALLEST BUTTON'S SUBTREE (offsets from the button's top):`);
  for (const n of hi.subtree ?? []) {
    const flag = n.bottom > (hi.card?.h ?? 0) + 0.5 ? '   <-- EXTENDS PAST THE CARD' : '';
    console.log(
      `    ${n.tag.padEnd(6)} ${n.cls.padEnd(40)} top ${String(n.top).padStart(6)}  bottom ${String(n.bottom).padStart(6)}  h ${String(n.h).padStart(6)}  ${n.pos}/${n.disp}${flag}`,
    );
  }
}
