// Seat-zone round ratchet (remote seats: realistic hands, name-only overlay).
// R1 the pill wraps ONLY identity/state (stack + count are its SIBLINGS in
// the zone), R2 one REAL theme CardBack per card (the stack length IS the
// count — F11 with no cap), R3 one-by-one growth during the deal, R4 the
// ±90° top-view side strips, R5 the single exposure constant, R6 the count
// with its unit + tier escalation. The DOM-free suite (environment: 'node')
// pins the component markup, the GameTable zone structure on an effect-free
// static render, and the CSS/source-text geometry the same way the
// stacking-trap and --gd-cardw lockstep pins do — the moving-picture half
// (flights landing, stacks growing) stays eyes/browser-gated.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeatStack, type SeatStackDir } from '../../../src/client/table/SeatStack';
import { GameTable } from '../../../src/client/GameTable';
import {
  landRemoteDealt,
  NO_REMOTE_DEALT,
  remoteDealtCounts,
} from '../../../src/client/table/helpers';
import { RoomStore, type RoomSnapshot } from '../../../src/client/room/store';
import type { GuandanView } from '../../../src/engine/guandan/types';
import { getLocale, setLocale, t } from '../../../src/client/i18n';
import en from '../../../src/client/i18n/locales/en.json';
import zhHant from '../../../src/client/i18n/locales/zh-Hant.json';
import zhHans from '../../../src/client/i18n/locales/zh-Hans.json';

const tableCss = readFileSync(join(__dirname, '../../../src/client/table/table.css'), 'utf8');
const appCss = readFileSync(join(__dirname, '../../../src/client/app.css'), 'utf8');
const seatStackSrc = readFileSync(
  join(__dirname, '../../../src/client/table/SeatStack.tsx'),
  'utf8',
);
const dealOverlaySrc = readFileSync(
  join(__dirname, '../../../src/client/table/DealOverlay.tsx'),
  'utf8',
);
const gameTableSrc = readFileSync(join(__dirname, '../../../src/client/GameTable.tsx'), 'utf8');

function stripCssComments(block: string): string {
  return block.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every rule whose selector list mentions .gd-seatstack, ANYWHERE in the
 *  stylesheet — deliberately unanchored (review hardening): media-query
 *  blocks indent their rules, so a line-start anchor would let a breakpoint
 *  override (a rogue rotation, a divergent clamp) escape these scans.
 *  matchAll is non-overlapping, so a multi-selector rule is captured once
 *  (from its first .gd-seatstack occurrence), never double-counted. */
function seatstackRules(css: string): string[] {
  return [...stripCssComments(css).matchAll(/\.gd-seatstack[^{]*\{[^}]*\}/g)].map((m) => m[0]);
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function renderStack(dir: SeatStackDir, count: number | null): string {
  return renderToStaticMarkup(createElement(SeatStack, { dir, count }));
}

/** Every CardBack the framework renders is one `gd-cardframe gd-card--hand`
 *  span (CardFace.tsx co-classes frame + size on ONE element), so counting
 *  that exact class attribute counts real hand-size backs and nothing else. */
function backCount(html: string): number {
  return [...html.matchAll(/class="gd-cardframe gd-card--hand"/g)].length;
}

// ---------------------------------------------------------------------------
// T1 — the stack is real and exact: N backs for count N, nothing at 0, the
// "—" chip (and NO backs — a stack's length would leak the number) at null.
// ---------------------------------------------------------------------------

describe('SeatStack backs are 1:1 with the count (T1)', () => {
  it('count N renders exactly N hand-size framework CardBacks, all inside one aria-hidden stack', () => {
    for (const n of [1, 2, 5, 27]) {
      const html = renderStack('north', n);
      expect(backCount(html), `count ${n}`).toBe(n);
      expect([...html.matchAll(/gd-seatstack__slot/g)], `count ${n} slots`).toHaveLength(n);
    }
    // Decorative: the WHOLE stack container is aria-hidden (the visible count
    // label beside it is the accessible source of the number).
    expect(renderStack('north', 3)).toMatch(/class="gd-seatstack gd-seatstack--north" aria-hidden="true"/);
  });

  it('count 0 renders no stack markup at all (the pre-deal hold shows a bare pill)', () => {
    expect(renderStack('north', 0)).toBe('');
    expect(renderStack('east', 0)).toBe('');
  });

  it('count null (hidden-count config) renders ZERO backs and the "—" chip with the hiddenCount aria', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderStack('west', null);
      expect(backCount(html)).toBe(0);
      expect(html).not.toContain('gd-seatstack__slot');
      expect(html).toContain('gd-seatstack__count--hidden');
      expect(html).toContain('—');
      expect(html).toContain(`aria-label="${t('game.plate.hiddenCount')}"`);
    } finally {
      setLocale(original);
    }
  });

  it('count null beats a deal-time reservation: still the "—" chip, zero backs, no reserved strip (Codex audit)', () => {
    // The visibility contract wins over the choreography: even mid-deal
    // (reserve set), a hidden count must never render a stack or a growing
    // label — the null branch precedes every reserve read.
    const html = renderToStaticMarkup(
      createElement(SeatStack, { dir: 'west', count: null, reserve: 27 }),
    );
    expect(backCount(html)).toBe(0);
    expect(html).not.toContain('gd-seatstack__slot');
    expect(html).not.toContain('gd-seatstack gd-seatstack--');
    expect(html).toContain('gd-seatstack__count--hidden');
  });
});

// ---------------------------------------------------------------------------
// T2 — the count label carries its UNIT as visible text, and the tier
// classes flip exactly at the handSizeTier boundaries.
// ---------------------------------------------------------------------------

describe('SeatStack count label: unit + tier escalation (T2)', () => {
  it('the visible label text is t(game.stack.cards) — unit present in en ("27 cards") and zh-Hant ("27 張")', () => {
    const original = getLocale();
    try {
      setLocale('en');
      expect(renderStack('north', 27)).toContain('27 cards');
      setLocale('zh-Hant');
      expect(renderStack('north', 27)).toContain('27 張');
    } finally {
      setLocale(original);
    }
  });

  it('low flips exactly at 11→10 (11 normal, 10 low, neither critical)', () => {
    const at11 = renderStack('east', 11);
    expect(at11).not.toContain('gd-seatstack__count--low');
    expect(at11).not.toContain('gd-seatstack__count--critical');
    const at10 = renderStack('east', 10);
    expect(at10).toContain('gd-seatstack__count--low');
    expect(at10).not.toContain('gd-seatstack__count--critical');
  });

  it('critical flips exactly at 3→2, and the critical aria reuses game.plate.cardsLow', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const at3 = renderStack('west', 3);
      expect(at3).toContain('gd-seatstack__count--low');
      expect(at3).not.toContain('gd-seatstack__count--critical');
      const at2 = renderStack('west', 2);
      expect(at2).toContain('gd-seatstack__count--critical');
      expect(at2).toContain(`aria-label="${t('game.plate.cardsLow', { count: 2 })}"`);
      // The non-critical label carries NO aria override — its visible text
      // (unit included) is the accessible name.
      expect(at3).not.toContain(t('game.plate.cardsLow', { count: 3 }));
    } finally {
      setLocale(original);
    }
  });
});

// ---------------------------------------------------------------------------
// T3 — decoupling structure: rendered through GameTable, the pill contains
// neither the stack nor the count label; both are its siblings in the zone.
// Fixture idiom copied from table.test.ts's bottom-bar block (the smallest
// object satisfying GameTable's prop contract; no effects run in static
// markup, which is exactly the settled-table state this pin needs).
// ---------------------------------------------------------------------------

function minimalView(): GuandanView {
  return {
    seat: 0,
    phase: 'playing',
    handNo: 1,
    currentLevel: '2',
    declarerTeam: null,
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    hand: [],
    cardCounts: [27, 27, 27, 27],
    ceremonyCutter: null,
    ceremonyFlips: null,
    finishOrder: [],
    trick: null,
    tribute: null,
    matchWinner: null,
  } as unknown as GuandanView;
}

function minimalSnapshot(): RoomSnapshot {
  return {
    room: {
      gameId: 'guandan',
      status: 'playing',
      config: null,
      seats: [0, 1, 2, 3].map((seat) => ({
        seat,
        name: seat === 0 ? 'ViewerName' : `Seat${seat + 1}`,
        claimed: true,
        connected: true,
      })),
      timing: null,
      seq: 1,
    },
    seats: new Map([[0, { token: 'tok' }]]),
    perSeat: new Map([[0, { view: minimalView(), hints: null, lastEventBatch: null }]]),
    seq: 1,
    connected: true,
    rejections: [],
    deadlines: [],
  } as unknown as RoomSnapshot;
}

/** First element carrying `className`, returned as balanced outer HTML (div
 *  nesting counted) — same helper as table.test.ts's bottom-bar block. */
function outerHtmlByClass(html: string, className: string): string {
  const markerIndex = html.indexOf(className);
  if (markerIndex < 0) throw new Error(`class not found in markup: ${className}`);
  const tagStart = html.lastIndexOf('<div', markerIndex);
  let i = tagStart;
  let depth = 0;
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      depth++;
      i += 4;
    } else if (html.startsWith('</div>', i)) {
      depth--;
      i += 6;
      if (depth === 0) return html.slice(tagStart, i);
    } else {
      i++;
    }
  }
  throw new Error(`unbalanced <div> while scanning for: ${className}`);
}

describe('seat-zone structure: pill and stack are decoupled siblings (T3)', () => {
  it('each remote zone renders the plate WITHOUT stack/count inside it, and the zone itself carries both', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));

    for (const dir of ['north', 'east', 'west'] as const) {
      const zone = outerHtmlByClass(html, `gd-seatzone--${dir}`);
      const plate = outerHtmlByClass(zone, 'gd-plate');
      expect(plate, `${dir}: pill must not contain the stack`).not.toContain('gd-seatstack');
      expect(plate, `${dir}: pill must not contain the count label`).not.toContain(
        'gd-seatstack__count',
      );
      expect(zone, `${dir}: zone carries the count label`).toContain('gd-seatstack__count');
      expect(zone, `${dir}: zone carries the direction-modified stack`).toContain(
        `gd-seatstack--${dir}`,
      );
      // R2 end to end: the settled 27-card seat shows exactly 27 real backs.
      expect(backCount(zone), `${dir}: 1:1 backs`).toBe(27);
    }
    // The zones live INSIDE the existing ring cells, so DealOverlay's
    // .gd-ring__seat--* rect reads keep working untouched.
    for (const dir of ['north', 'east', 'west'] as const) {
      expect(html).toContain(`gd-ring__seat gd-ring__seat--${dir}`);
    }
  });

  it('the viewer bottom-bar plate is unchanged: no stack, no count (R9)', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));
    const bottombar = outerHtmlByClass(html, 'gd-bottombar');
    expect(bottombar).toContain('gd-plate--viewer');
    expect(bottombar).not.toContain('gd-seatstack');
  });
});

// ---------------------------------------------------------------------------
// T4 — orientation: the side strips declare the mirrored ±90° rotations
// (comment-stripped CSS source pins, the stacking-trap technique) and the
// markup carries the direction modifier the rules key off; north declares
// no rotation at all.
// ---------------------------------------------------------------------------

describe('side-strip rotation geometry (T4)', () => {
  it('east rotates +90deg and west mirrors with -90deg (pinned signs)', () => {
    // R10 merged the per-side top formula and the transform into ONE rule
    // per side, so the pin matches the transform INSIDE each side's own
    // single-selector rule (the shared rule holds only the left offset and
    // carries no transform — the ONLY-two-rotations scan below keeps a
    // smuggled extra transform from hiding anywhere else).
    const stripped = stripCssComments(tableCss);
    expect(stripped).toMatch(
      /\.gd-seatstack--east > \.gd-seatstack__slot\s*\{[^}]*transform:\s*rotate\(90deg\);[^}]*\}/,
    );
    expect(stripped).toMatch(
      /\.gd-seatstack--west > \.gd-seatstack__slot\s*\{[^}]*transform:\s*rotate\(-90deg\);[^}]*\}/,
    );
  });

  it('north declares NO rotation — the two pinned side transforms are the ONLY rotations in the stack rules', () => {
    // Unanchored scan (review hardening): a rotation smuggled in via an
    // indented media-query override must be seen here too.
    const stackRules = seatstackRules(tableCss);
    expect(stackRules.length, 'no .gd-seatstack rules found').toBeGreaterThan(0);
    const rotations = stackRules.flatMap((rule) => rule.match(/rotate\([^)]*\)/g) ?? []);
    expect(rotations.sort()).toEqual(['rotate(-90deg)', 'rotate(90deg)']);
    for (const rule of stackRules) {
      if (rule.includes('--north')) expect(rule, rule).not.toContain('rotate(');
    }
  });

  it('the rendered stack carries the direction modifier class the rotation rules key off', () => {
    expect(renderStack('east', 2)).toContain('gd-seatstack--east');
    expect(renderStack('west', 2)).toContain('gd-seatstack--west');
    expect(renderStack('north', 2)).toContain('gd-seatstack--north');
  });
});

// ---------------------------------------------------------------------------
// T10 — placement direction (owner follow-up): every player lays cards from
// THEIR OWN right to THEIR OWN left, each new card on top. Paint order is
// DOM order alone, so the whole requirement pins as: north/east cascade
// straight with the index (newest = last DOM slot at the screen-right /
// strip-bottom end), west REVERSES the index (newest at the strip's TOP end)
// — the two sides mirror — and no z-index exists to override any of it.
// ---------------------------------------------------------------------------

describe('placement direction — top-view physics (T10)', () => {
  const stackRules = seatstackRules(tableCss);

  it('paint order is DOM order alone: no z-index in any stack rule', () => {
    expect(stackRules.join('\n')).not.toContain('z-index');
  });

  it('north and east cascade straight with the index (newest card at the screen right / strip bottom)', () => {
    const north = stackRules.find((r) => r.includes('--north') && r.includes('left:'));
    expect(north, 'north slot rule not found').toBeDefined();
    expect(north).toMatch(/left:[^;]*var\(--gd-stack-i\)\s*\*\s*var\(--gd-stack-exposure\)/);
    expect(north).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-i\)/);
    const east = stackRules.find((r) => r.startsWith('.gd-seatstack--east >') && r.includes('top:'));
    expect(east, 'east slot rule not found').toBeDefined();
    expect(east).toMatch(/top:[^;]*var\(--gd-stack-i\)\s*\*\s*var\(--gd-stack-exposure\)/);
    expect(east).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-i\)/);
  });

  it("west reverses the index (newest card at the strip's TOP end) — the sides mirror", () => {
    const west = stackRules.find((r) => r.startsWith('.gd-seatstack--west >') && r.includes('top:'));
    expect(west, 'west slot rule not found').toBeDefined();
    expect(west).toMatch(
      /top:[^;]*\(var\(--gd-stack-n\)\s*-\s*1\s*-\s*var\(--gd-stack-i\)\)\s*\*\s*var\(--gd-stack-exposure\)/,
    );
  });

  it('slots render in arrival order (DOM index IS --gd-stack-i), so the last-arrived card paints on top', () => {
    const html = renderStack('west', 3);
    const indices = [...html.matchAll(/--gd-stack-i:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(indices).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// T5 — one source of truth for the exposure constant, and the container's
// --gd-cardw stays in lockstep with the hand-card clamp (HandFan's idiom:
// the inline-var calcs resolve against ancestors, so the container MUST
// declare the same clamp or every width/height silently computes wrong).
// ---------------------------------------------------------------------------

describe('exposure constant + card-width lockstep (T5)', () => {
  it('--gd-stack-exposure is declared exactly once (0.09), and SeatStack.tsx carries no TS mirror of it', () => {
    const stripped = stripCssComments(tableCss);
    const declarations = [...stripped.matchAll(/--gd-stack-exposure:/g)];
    expect(declarations).toHaveLength(1);
    expect(stripped).toMatch(/--gd-stack-exposure:\s*0\.09\s*;/);
    // Every geometry rule consumes the var, never a re-typed literal.
    expect(stripped).not.toMatch(/\*\s*0\.09\b/);
    // No TS mirror exists: the component passes counts/indices/aspect only.
    expect(stripTsComments(seatStackSrc)).not.toContain('0.09');
  });

  it(".gd-seatstack's --gd-cardw clamp is IDENTICAL to .gd-card--hand's (lockstep pin)", () => {
    const clampOf = (selector: RegExp, what: string): string => {
      const block = tableCss.match(selector)?.[0] ?? '';
      expect(block, `rule not found: ${what}`).not.toBe('');
      const m = block.match(/--gd-cardw:\s*(clamp\([^)]+\))/);
      expect(m, `--gd-cardw clamp not found: ${what}`).not.toBeNull();
      return m![1]!.replace(/\s+/g, ' ').trim();
    };
    const handClamp = clampOf(/\.gd-card--hand\s*\{[^}]*\}/, '.gd-card--hand');
    const stackClamp = clampOf(/^\.gd-seatstack\s*\{[^}]*\}/m, '.gd-seatstack');
    expect(stackClamp).toBe(handClamp);
    // Review hardening: the pinned clamp must be the ONLY --gd-cardw
    // declaration across ALL .gd-seatstack rules — a divergent re-clamp
    // inside a media-query block cannot hide from an unanchored scan.
    const declarations = seatstackRules(tableCss)
      .join('\n')
      .match(/--gd-cardw:/g);
    expect(declarations).toHaveLength(1);
  });

  it('the stack geometry reads the theme aspect from an inline var, never a hardcoded 1.45', () => {
    // The container calcs consume --gd-stack-aspect (set from the ACTIVE
    // theme's DeckThemeMetrics.aspect at render); the stylesheet's stack
    // rules never re-type the ratio.
    const stackRules = seatstackRules(tableCss).join('\n');
    expect(stackRules).toContain('var(--gd-stack-aspect)');
    expect(stackRules).not.toContain('1.45');
    expect(stripTsComments(seatStackSrc)).toContain('useDeckTheme().metrics.aspect');
    expect(stripTsComments(seatStackSrc)).not.toContain('1.45');
  });
});

// ---------------------------------------------------------------------------
// T6 — deal wiring source pins (brittle to refactors BY DESIGN, like the
// marker--flying pin: anyone restructuring the landing paths must
// consciously re-satisfy these). The runtime growth is eyes/browser-gated.
// ---------------------------------------------------------------------------

describe('one-by-one deal wiring source pins (T6)', () => {
  const overlay = stripTsComments(dealOverlaySrc);
  const table = stripTsComments(gameTableSrc);

  it('DealOverlay: BOTH landing paths route through onCardLanded(tick), whose non-south branch fires the onRemoteLanded ref', () => {
    // The flyBack land callback (the removed back) and the marker land
    // callback both hand the FULL tick to onCardLanded…
    expect(overlay).toMatch(/node\.remove\(\);\s*onCardLanded\(tick\);/);
    expect(overlay).toMatch(
      /flyNode\(markerEl, target, tick\.delayMs, MARKER_FLY_MS, \(\) => \{\s*onCardLanded\(tick\);/,
    );
    // …and onCardLanded's non-south branch is exactly the remote callback.
    expect(overlay).toMatch(/else \{\s*onRemoteLandedRef\.current\?\.\(tick\.target\);\s*\}/);
    // The ref idiom mirrors onOwnLanded (a mounted-once effect reads props
    // through refs so late renders never bind stale callbacks).
    expect(overlay).toContain('onRemoteLandedRef.current = onRemoteLanded');
  });

  it('GameTable: the counters are deal-KEYED — landings go through landRemoteDealt, and NO reset effect exists', () => {
    // The landing callback re-keys/increments under the ACTIVE deal's number…
    expect(table).toMatch(
      /onRemoteLanded=\{\(dir\) => setDealtRemote\(\(prev\) => landRemoteDealt\(prev, derived\.dealNo, dir\)\)\}/,
    );
    // …and it is the ONLY setter call besides the useState declaration: the
    // old post-paint reset effect (which painted one frame of the previous
    // deal's full stacks on hands 2+, and let DealOverlay's mount effect
    // measure its flight rects against that stale layout) must never return.
    expect([...table.matchAll(/setDealtRemote/g)]).toHaveLength(2);
    expect(table).not.toContain('setDealtRemote({ east: 0, north: 0, west: 0 })');
  });

  it('GameTable: a hidden count (null) wins over the deal, then dealing ? deal-keyed counts : holdFan ? 0 : settled', () => {
    expect(table).toContain(
      'const remoteCounts = remoteDealtCounts(dealtRemote, derived.dealNo);',
    );
    // Codex audit (HIGH): the null check must come FIRST — a hidden-count
    // room must never render the growing mid-deal stack/label (the config's
    // visibility contract beats the choreography). The pinned shape reads
    // the settled count, returns null before consulting `dealing` at all.
    expect(table).toMatch(
      /const settledCount = view\.cardCounts\[seat\] \?\? null;\s*\n\s*if \(settledCount === null\) return null;\s*\n\s*return dealing \? remoteCounts\[dir\] : holdFan \? 0 : settledCount;/,
    );
  });
});

// ---------------------------------------------------------------------------
// Review fix — the counters' PURE core: keyed by dealNo, so "a new deal
// starts from zero" is a property of the read (first render, no reset
// effect, no flash frame) and a transient active-seat dealNo dip (seat-tab
// switch to a lagging seat) cannot destroy a running deal's counters.
// ---------------------------------------------------------------------------

describe('deal-keyed remote counters (review fix: reset-effect flash + tab-switch zeroing)', () => {
  it('a NEW deal reads all-zero from stale counters in its very first render', () => {
    // Deal 1 ended with full stacks (27/27/27) still stored…
    const settled = { dealNo: 1, counts: { east: 27, north: 27, west: 27 } };
    // …and deal 2's first read is ZERO — the stale 27s can never paint, and
    // DealOverlay (mounted in that same render) measures a zero-stack layout.
    expect(remoteDealtCounts(settled, 2)).toEqual({ east: 0, north: 0, west: 0 });
    // The stored state itself is untouched (pure read).
    expect(settled.counts.north).toBe(27);
  });

  it('landing re-keys stale counters from zero and increments ONLY its direction', () => {
    const settled = { dealNo: 1, counts: { east: 27, north: 27, west: 27 } };
    const first = landRemoteDealt(settled, 2, 'north');
    expect(first).toEqual({ dealNo: 2, counts: { east: 0, north: 1, west: 0 } });
    const second = landRemoteDealt(first, 2, 'north');
    expect(second.counts).toEqual({ east: 0, north: 2, west: 0 });
    expect(landRemoteDealt(second, 2, 'east').counts).toEqual({ east: 1, north: 2, west: 0 });
  });

  it('a lagging seat (older dealNo) reads zeros WITHOUT zeroing the running deal', () => {
    const running = landRemoteDealt(NO_REMOTE_DEALT, 3, 'west');
    // Tab-switched to a seat whose fold still says deal 2: displayed zeros…
    expect(remoteDealtCounts(running, 2)).toEqual({ east: 0, north: 0, west: 0 });
    // …but switching back finds the running deal's landings intact.
    expect(remoteDealtCounts(running, 3)).toEqual({ east: 0, north: 0, west: 1 });
  });

  it('the initial state belongs to deal 0 (pre-first-deal renders read zeros)', () => {
    expect(NO_REMOTE_DEALT.dealNo).toBe(0);
    expect(remoteDealtCounts(NO_REMOTE_DEALT, 0)).toEqual({ east: 0, north: 0, west: 0 });
    expect(remoteDealtCounts(NO_REMOTE_DEALT, 1)).toEqual({ east: 0, north: 0, west: 0 });
  });
});

// ---------------------------------------------------------------------------
// Review fix — deal-time layout reservation: DealOverlay measures its flight
// rects ONCE at mount, so the ring must not reflow while cards land. During
// the deal the strip is SIZED for the final count from the first frame
// (--gd-stack-n carries the reservation, not the landed count), the counting
// label holds its line from 0 up, and tier escalation is suppressed so the
// label's metrics never jitter the reserved layout.
// ---------------------------------------------------------------------------

describe('deal-time layout reservation (review fix: flights vs once-measured rects)', () => {
  function renderReserved(dir: SeatStackDir, count: number, reserve: number): string {
    return renderToStaticMarkup(createElement(SeatStack, { dir, count, reserve }));
  }

  it('a reserved strip is SIZED for the final count while rendering only the landed backs', () => {
    for (const dir of ['north', 'east', 'west'] as const) {
      const html = renderReserved(dir, 3, 27);
      expect(backCount(html), `${dir}: landed backs`).toBe(3);
      expect(html, `${dir}: container sized for the reservation`).toContain('--gd-stack-n:27');
    }
  });

  it('at ZERO landed cards the reserved strip and its counting label already hold their space', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderReserved('east', 0, 27);
      expect(backCount(html)).toBe(0);
      expect(html).toContain('--gd-stack-n:27');
      // The label renders from frame one (its later appearance would shift
      // the zone column mid-deal) and counts up from zero.
      expect(html).toContain('0 cards');
    } finally {
      setLocale(original);
    }
  });

  it('reservation suppresses tier escalation — the label must not swell/recolor mid-deal', () => {
    // Unreserved, 2 cards IS critical (T2 pins it); reserved, the same count
    // is just deal progress.
    const html = renderReserved('west', 2, 27);
    expect(html).not.toContain('gd-seatstack__count--low');
    expect(html).not.toContain('gd-seatstack__count--critical');
  });

  it('a reservation can never CLIP landed cards (max of count and reserve wins)', () => {
    const html = renderReserved('north', 27, 26);
    expect(backCount(html)).toBe(27);
    expect(html).toContain('--gd-stack-n:27');
  });

  it('without a reservation nothing changes: count sizes the strip, 0 renders nothing (T1 ratchet)', () => {
    expect(renderStack('north', 5)).toContain('--gd-stack-n:5');
    expect(renderStack('north', 0)).toBe('');
  });

  it('GameTable reserves exactly while dealing, at the per-seat deal size (source pin)', () => {
    const table = stripTsComments(gameTableSrc);
    expect(table).toMatch(/reserve=\{dealing \? HAND_SIZE : undefined\}/);
  });
});

// ---------------------------------------------------------------------------
// Review follow-up — narrow-width chrome compression: at 390px the pre-table
// stack (shell header + seat tabs + level banner) pushed the player's own
// hand a full swipe below the fold once the real 27-card strips landed. The
// fix shaves the CHROME, never the stacks — pinned as strict inequalities
// against the base rules so the compression can't silently regress.
// ---------------------------------------------------------------------------

describe('narrow-width chrome compression (review follow-up: hand above the fold)', () => {
  /** The single ≤719px block of a stylesheet (complements the 720px
   *  desktop-air breakpoint), comment-stripped. */
  function narrowBlock(css: string, name: string): string {
    const m = stripCssComments(css).match(/@media \(max-width: 719px\) \{([\s\S]*?)\n\}/);
    expect(m, `${name}: @media (max-width: 719px) block missing`).not.toBeNull();
    return m![1]!;
  }
  function fontSizeRem(block: string, selector: string): number {
    const m = block.match(
      new RegExp(`${selector.replace(/[.\\-]/g, '\\$&')}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem`),
    );
    expect(m, `font-size not found for ${selector}`).not.toBeNull();
    return Number(m![1]);
  }

  it('app.css compresses the shell header below 720px: wordmark strictly smaller, header/main air trimmed', () => {
    const block = narrowBlock(appCss, 'app.css');
    const base = fontSizeRem(stripCssComments(appCss), '.app-wordmark');
    const narrow = fontSizeRem(block, '.app-wordmark');
    expect(narrow).toBeLessThan(base);
    expect(block).toContain('.app-header');
    expect(block).toContain('.app-main');
  });

  it('table.css compresses the pre-ring chrome below 720px: level numeral strictly smaller, tabs tightened', () => {
    const block = narrowBlock(tableCss, 'table.css');
    const base = fontSizeRem(stripCssComments(tableCss), '.gd-headline__rank');
    const narrow = fontSizeRem(block, '.gd-headline__rank');
    expect(narrow).toBeLessThan(base);
    expect(block).toContain('.gd-tabs');
    expect(block).toContain('.gd-headline {');
  });

  it('the compression never touches the stacks: no .gd-seatstack rule inside the narrow block (R5 stays whole)', () => {
    expect(narrowBlock(tableCss, 'table.css')).not.toContain('.gd-seatstack');
  });
});

// ---------------------------------------------------------------------------
// T8 — locale coverage for the new key (the parity suite in i18n.test.ts
// enforces identical key SETS; this pins the key's presence and that every
// locale's template interpolates the count).
// ---------------------------------------------------------------------------

describe('game.stack.cards locale coverage (T8)', () => {
  it('the key exists in all three locales and every template interpolates {count}', () => {
    const locales: Record<string, Record<string, string>> = {
      en: en as Record<string, string>,
      'zh-Hant': zhHant as Record<string, string>,
      'zh-Hans': zhHans as Record<string, string>,
    };
    for (const [name, resource] of Object.entries(locales)) {
      const template = resource['game.stack.cards'];
      expect(template, `${name}: game.stack.cards missing`).toBeTypeOf('string');
      expect(template, `${name}: template must interpolate the count`).toContain('{count}');
      // The unit is real text beyond the number itself.
      expect(template!.replace('{count}', '').trim().length, `${name}: unit present`).toBeGreaterThan(0);
    }
    expect(locales['en']!['game.stack.cards']).toBe('{count} cards');
  });
});
