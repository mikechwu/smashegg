// J0b — WHERE DOES THE CARD'S INK CLIP, ONCE THE BOX STOPS SCALING WITH IT?
//
// THE PROBLEM THIS EXISTS TO ANSWER. The hand card box is now a constant px, so user text
// scaling can no longer change whether the hand FITS (that was the point). But every glyph
// on the card used to be a fraction of the box, which means a constant box would also
// freeze the ink — and then raising the root font-size does nothing at all on the card
// faces, which is the accessibility behaviour, silently removed. So the ink moved to its
// own basis, `--gd-glyphw`, which CAN track the root font-size.
//
// An unbounded ink basis overflows a fixed box. This finds the bound, by MEASUREMENT
// rather than by deriving it from the fractions: the fractions are the nominal sizes, and
// what actually clips is the rendered INK of a particular font at a particular rank, in a
// row whose parts were fitted to a 0.70w budget. `rankText('T')` is two glyphs where every
// other rank is one, and it already needed its own smaller size at the nominal scale.
//
// METHOD. Ramp `--gd-glyphw` on the hand cards and, at each step, measure for every
// rendered card whether any ink box escapes its own card box. Report the largest value at
// which nothing escapes. The cap then goes into the CSS BELOW that value, and the pin in
// containment.mjs asserts the property at the shipped cap rather than re-deriving it.
//
// WHY NOT RAMP THE ROOT FONT-SIZE DIRECTLY. Because the answer wanted is a property of the
// ink basis, and driving it through `root -> rem -> min() -> --gd-glyphw` would measure the
// cap expression at the same time as the thing it caps. Ramping the basis isolates it; the
// root-font-size path is then a separate, cheap assertion (this script runs it too).
//
// Run: dev server up, then
//   GS_W=390 GS_H=664 node scripts/measure-glyph-scale.mjs

const BASE = process.env.GS_BASE ?? 'http://localhost:8787';
if (process.env.GS_W === undefined || process.env.GS_H === undefined) {
  console.log(
    '\nGS_W and GS_H are REQUIRED — there is deliberately no default.\n' +
      '  INNER dimensions, browser chrome EXCLUDED.\n' +
      '  e.g.  GS_W=390 GS_H=664 node scripts/measure-glyph-scale.mjs\n',
  );
  process.exit(2);
}
const VW = Number(process.env.GS_W);
const VH = Number(process.env.GS_H);
const DEALS = Number(process.env.GS_DEALS ?? 2);
const THEME = process.env.GS_THEME ?? 'lacquer';
const LOCALE = process.env.GS_LOCALE ?? 'zh-Hant';

const { chromium } = await import('playwright');

export const AXES_PINNED = {
  viewportWidth: { value: 'GS_W (required)' },
  viewportHeight: { value: 'GS_H (required)' },
  deckTheme: { value: 'GS_THEME, default lacquer', justification: 'the cinnabar-court art module is frozen and keeps the BOX basis, so only lacquer has ink on this basis' },
  locale: { value: 'GS_LOCALE, default zh-Hant' },
  roomTiming: { value: 'standard 45s/90s (the product default)' },
  shelf: { value: 'none', justification: 'a shelf moves cards between zones; it does not change a card face' },
  handSort: { value: 'ascending (the product default)' },
  manualAreas: { value: 'none' },
  leadOrFollow: { value: 'both', justification: 'a card face is not a function of the trick' },
  turnDecidability: { value: 'decidable turns only' },
  orientation: { value: 'portrait' },
  textScale: { value: 'RAMPED — this is the axis under measurement' },
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

// The measurement, run in the page. For every hand card: does any INK box escape the CARD
// box? Escape is measured against the card's PADDING box in document coordinates, with a
// small tolerance for sub-pixel layout.
//
// "Ink" here is the rendered element rect, not the glyph outline. That is deliberately
// CONSERVATIVE in one direction and not the other: a text element's rect includes the
// font's leading, so it can report an escape slightly before the visible glyph clips —
// which is the safe side of a cap. It cannot report the reverse.
const INK_PROBE = `() => {
  const TOL = 0.5;
  const cards = [...document.querySelectorAll('.gd-fan__card .gd-card')];
  const out = { cards: cards.length, escapes: [], ranks: {} };
  for (const card of cards) {
    const cb = card.getBoundingClientRect();
    const parts = [
      ['index', card.querySelector('.gd-card__index')],
      ['rank', card.querySelector('.gd-card__rank')],
      ['suit', card.querySelector('.gd-card__suit')],
      ['pip', card.querySelector('.gd-card__pip')],
    ];
    const rankEl = card.querySelector('.gd-card__rank');
    const rankText = rankEl ? rankEl.textContent.trim() : '';
    for (const [name, el] of parts) {
      if (el === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const over = {
        left: cb.left - r.left,
        right: r.right - cb.right,
        top: cb.top - r.top,
        bottom: r.bottom - cb.bottom,
      };
      const worst = Math.max(over.left, over.right, over.top, over.bottom);
      const key = name + '|' + rankText;
      if (out.ranks[key] === undefined || worst > out.ranks[key]) out.ranks[key] = worst;
      if (worst > TOL) {
        out.escapes.push({ part: name, rank: rankText, by: Math.round(worst * 100) / 100, side:
          over.right === worst ? 'right' : over.bottom === worst ? 'bottom' : over.left === worst ? 'left' : 'top' });
      }
    }
    // The index row and the body pip must also not COLLIDE with each other — the pip's
    // bottom-right bias exists to clear the top-left index row, and that clearance is
    // stated in the CSS as a measured one. A cap that keeps both inside the card while
    // letting them overlap would satisfy the box test and destroy the card face.
    const idx = card.querySelector('.gd-card__index');
    const pip = card.querySelector('.gd-card__pip');
    if (idx !== null && pip !== null) {
      const a = idx.getBoundingClientRect();
      const b = pip.getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > TOL && oy > TOL) {
        out.escapes.push({ part: 'index/pip collision', rank: rankText,
          by: Math.round(Math.min(ox, oy) * 100) / 100, side: 'overlap' });
      }
    }
  }
  return out;
}`;

const browser = await chromium.launch();
console.log(`=== J0b GLYPH CLIP POINT @ INNER ${VW}x${VH} (${THEME}, ${LOCALE}) ===`);
console.log('    INNER dimensions, browser chrome EXCLUDED.');
console.log('    Ramping --gd-glyphw on .gd-card--hand; the BOX stays at its shipped constant.\n');

/** Ramp results, merged across deals: basis -> worst escape seen (null if none). */
const ramp = new Map();
let dealsMeasured = 0;
let cardsSeen = 0;
const ranksSeen = new Set();

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
  }, { ...drive, theme: THEME, locale: LOCALE });
  const p = await ctxB.newPage();
  await p.goto(`${BASE}/#/room/${drive.code}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.gd-fan__card').length >= 20, null, { timeout: 60000 });
  await p.waitForTimeout(850);

  // The shipped box width, read from the rendered card rather than assumed.
  const boxW = await p.evaluate(() => {
    const c = document.querySelector('.gd-fan__card .gd-card');
    return c === null ? null : Math.round(c.getBoundingClientRect().width * 100) / 100;
  });
  if (deal === 0) console.log(`  rendered card box: ${boxW}px wide\n`);

  // TWO RAMPS, BECAUSE ONE CAP FOR TWO PARTS IS SET BY THE WRONG ONE. The body pip is
  // 0.6 of the basis and the rank glyph is 0.36-0.42 of it, so a single cap is decided by
  // the pip — a decoration — and the corner index, which is the part a reader with poor
  // eyesight actually reads, inherits a limit it did not earn. So the pip gets its own
  // basis and each is ramped with the other held at nominal.
  for (const which of ['pip', 'text']) {
    for (let basis = 40; basis <= 110; basis += 1) {
      await p.evaluate((s) => {
        let style = document.getElementById('gs-ramp');
        if (style === null) {
          style = document.createElement('style');
          style.id = 'gs-ramp';
          document.head.appendChild(style);
        }
        style.textContent = s;
      }, which === 'pip'
        ? `.gd-card--hand { --gd-pipw: ${basis}px !important; }`
        : `.gd-card--hand { --gd-glyphw: ${basis}px !important; }`);
      await p.waitForTimeout(25);
      const r = await p.evaluate(`(${INK_PROBE})()`);
      cardsSeen += r.cards;
      for (const k of Object.keys(r.ranks)) ranksSeen.add(k.split('|')[1]);
      // Only escapes attributable to the ramped part count for that part's ceiling.
      const mine = r.escapes.filter((e) =>
        which === 'pip' ? e.part === 'pip' || e.part === 'index/pip collision' : e.part !== 'pip',
      );
      const worst = mine.length === 0 ? null : mine.reduce((a, b) => (b.by > a.by ? b : a));
      const key = `${which}:${basis}`;
      const prev = ramp.get(key);
      if (prev === undefined || (worst !== null && (prev.worst === null || worst.by > prev.worst.by))) {
        ramp.set(key, { worst });
      }
    }
    await p.evaluate(() => {
      const s = document.getElementById('gs-ramp');
      if (s !== null) s.textContent = '';
    });
  }
  // Restore, then run the ROOT FONT-SIZE path end to end — the cap expression included.
  await p.evaluate(() => {
    const s = document.getElementById('gs-ramp');
    if (s !== null) s.remove();
  });
  if (deal === 0) {
    console.log('  root font-size path (the shipped cap expression, end to end):');
    // READ THE RESOLVED INK, NOT THE CUSTOM PROPERTY. getPropertyValue on an unregistered
    // custom property returns the TOKEN — literally "min(3.009375rem, 58px)" at every root
    // size — so a column filled from it would have shown the cap "working" even if the
    // property never reached a single glyph. The rendered font-size and the rendered box
    // are used values, and they are what proves BOTH halves: that the ink grows with the
    // root font-size at all, and that it stops where the cap says.
    console.log('    root    card box   rank font   pip size   escapes');
    for (const root of [12, 14, 16, 18, 20, 24]) {
      await p.evaluate((r) => { document.documentElement.style.fontSize = `${r}px`; }, root);
      await p.waitForTimeout(40);
      const m = await p.evaluate(() => {
        const c = document.querySelector('.gd-fan__card .gd-card');
        if (c === null) return null;
        const rank = c.querySelector('.gd-card__rank');
        const pip = c.querySelector('.gd-card__pip');
        return {
          box: Math.round(c.getBoundingClientRect().width * 100) / 100,
          rank: rank === null ? null : getComputedStyle(rank).fontSize,
          pip: pip === null ? null : Math.round(pip.getBoundingClientRect().width * 100) / 100,
        };
      });
      const r = await p.evaluate(`(${INK_PROBE})()`);
      console.log(
        `    ${String(root).padStart(4)}px  ${String(m.box).padStart(8)}   ${String(m.rank).padStart(9)}   ` +
          `${String(m.pip).padStart(8)}   ` +
          (r.escapes.length === 0
            ? 'none'
            : `${r.escapes.length} — worst ${r.escapes.reduce((a, b) => (b.by > a.by ? b : a)).by}px`),
      );
    }
    await p.evaluate(() => { document.documentElement.style.fontSize = ''; });
    console.log('');
  }
  dealsMeasured += 1;
  await ctxB.close();
  await ctx.close();
}
await browser.close();

if (dealsMeasured === 0) {
  console.log('\nNO DEAL WAS MEASURED — this run proves nothing about the clip point.');
  process.exit(1);
}

const summary = {};
for (const which of ['text', 'pip']) {
  console.log(`  --- ${which === 'pip' ? '--gd-pipw (the body pip)' : '--gd-glyphw (the corner index ink)'} ---`);
  console.log('  basis       worst escape   part                  rank');
  let lastClean = null;
  let firstEscape = null;
  const bases = [...ramp.keys()].filter((k) => k.startsWith(`${which}:`)).map((k) => Number(k.split(':')[1]));
  for (const basis of bases.sort((a, b) => a - b)) {
    const { worst } = ramp.get(`${which}:${basis}`);
    if (worst === null && firstEscape === null) lastClean = basis;
    else if (worst !== null && firstEscape === null) firstEscape = basis;
    const near = firstEscape !== null && Math.abs(basis - firstEscape) <= 2;
    if (!near && basis % 10 !== 0) continue;
    console.log(
      `  ${String(basis).padStart(9)}px   ${(worst === null ? 'none' : `${worst.by}px`).padStart(12)}   ` +
        `${(worst === null ? '' : worst.part).padEnd(21)} ${worst === null ? '' : worst.rank}`,
    );
  }
  summary[which] = { lastClean, firstEscape };
  console.log(
    `  LARGEST CLEAN: ${lastClean === null ? 'none' : `${lastClean}px`}   ` +
      `FIRST ESCAPE: ${firstEscape === null ? 'none in range — raise the ramp ceiling' : `${firstEscape}px`}\n`,
  );
}

console.log(
  `  deals ${dealsMeasured}, card renders examined ${cardsSeen}, distinct ranks seen ${ranksSeen.size}` +
    ` (${[...ranksSeen].filter((r) => r !== '').sort().join(' ')})`,
);
if (ranksSeen.size < 5) {
  console.log('  TOO FEW DISTINCT RANKS — the clip point is rank-dependent; raise GS_DEALS.');
  process.exit(1);
}
if (summary.text.firstEscape === null || summary.pip.firstEscape === null) {
  console.log(
    '\n  A RAMP NEVER ESCAPED IN RANGE. A ceiling that was never reached is not a measured\n' +
      '  ceiling; raise the ramp top rather than reading the highest step as clean.',
  );
  process.exit(1);
}
