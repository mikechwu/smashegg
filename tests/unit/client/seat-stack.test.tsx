// Seat-zone round ratchet (remote seats: realistic hands, name-only overlay;
// refinement round: lapped rows + the pill as the zone's one text surface).
// R1 the pill wraps identity/state — WITH the count chip since the refinement
// round (item 5) — and laps the stack it sits over, R2 one REAL theme
// CardBack per card (the stack length IS the count — F11 with no cap), R3
// one-by-one growth during the deal (alternating rows, item 1), R4 the ±90°
// top-view side strips, R5 the single exposure constant, R6 the count with
// its unit + tier escalation (in the pill now). The DOM-free suite
// (environment: 'node') pins the component markup, the GameTable zone
// structure on an effect-free static render, and the CSS/source-text geometry
// the same way the stacking-trap and --gd-cardw lockstep pins do — the
// moving-picture half (flights landing, stacks growing) stays
// eyes/browser-gated.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeatCount, SeatStack, type SeatStackDir } from '../../../src/client/table/SeatStack';
import { SeatPlate, type SeatPlateProps } from '../../../src/client/table/SeatPlate';
import {
  EMPTY_DERIVED,
  foldEvents,
  GameTable,
  type SeatDerived,
} from '../../../src/client/GameTable';
import {
  landRemoteDealt,
  NO_REMOTE_DEALT,
  remoteDealtCounts,
  seatStackRows,
  seatStackPerRow,
  seatStackSlot,
  SEAT_STACK_ROW_CAP,
  SEAT_STACK_MAX_ROWS,
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

/** The pill, with the identity fields a remote seat carries by default —
 *  tests override what they exercise. Identity ONLY since the flank round:
 *  no count, no pass, no clock props exist at all. */
function renderPlate(over: Partial<SeatPlateProps> = {}): string {
  return renderToStaticMarkup(
    createElement(SeatPlate, {
      seat: 1,
      name: '阿美',
      connected: true,
      isViewer: false,
      partner: false,
      place: null,
      active: false,
      committed: false,
      ...over,
    }),
  );
}

/** The standalone count chip (flank round: the cards' OTHER side). */
function renderCount(count: number | null | undefined, dealing = false): string {
  return renderToStaticMarkup(createElement(SeatCount, { count, dealing }));
}

/** Every CardBack the framework renders is one `gd-cardframe gd-card--hand`
 *  span (CardFace.tsx co-classes frame + size on ONE element), so counting
 *  that exact class attribute counts real hand-size backs and nothing else. */
function backCount(html: string): number {
  return [...html.matchAll(/class="gd-cardframe gd-card--hand"/g)].length;
}

// ---------------------------------------------------------------------------
// T1 — the stack is real and exact: N backs for count N, nothing at 0 and
// nothing AT ALL at null (a stack's length would leak the number; the pill's
// "—" chip — T2 — is the visible signal).
// ---------------------------------------------------------------------------

describe('SeatStack backs are 1:1 with the count (T1)', () => {
  it('count N renders exactly N hand-size framework CardBacks, all inside one aria-hidden stack', () => {
    for (const n of [1, 2, 5, 27]) {
      const html = renderStack('north', n);
      expect(backCount(html), `count ${n}`).toBe(n);
      expect([...html.matchAll(/gd-seatstack__slot/g)], `count ${n} slots`).toHaveLength(n);
    }
    // Decorative: the WHOLE stack container is aria-hidden (the pill's count
    // chip is the accessible source of the number).
    expect(renderStack('north', 3)).toMatch(/class="gd-seatstack gd-seatstack--north" aria-hidden="true"/);
  });

  it('count 0 renders no stack markup at all (the pre-deal hold shows a bare pill)', () => {
    expect(renderStack('north', 0)).toBe('');
    expect(renderStack('east', 0)).toBe('');
  });

  it('count null (hidden-count config) renders NOTHING — zero backs, zero markup', () => {
    expect(renderStack('west', null)).toBe('');
  });

  it('count null beats a deal-time reservation: still nothing, no reserved strip (Codex audit)', () => {
    // The visibility contract wins over the choreography: even mid-deal
    // (reserve set), a hidden count must never render a stack — the null
    // branch precedes every reserve read.
    expect(
      renderToStaticMarkup(createElement(SeatStack, { dir: 'west', count: null, reserve: 27 })),
    ).toBe('');
  });
});

// ---------------------------------------------------------------------------
// T2 — the count is a STANDALONE chip (flank round item 2: the cards' other
// side, never inside the name pill): unit as visible text, tier classes
// flipping exactly at the handSizeTier boundaries, the "—" chip for hidden
// counts, NO chip when count is undefined (finished seats, pre-deal hold) —
// and the pill itself is identity-only by construction.
// ---------------------------------------------------------------------------

describe('SeatCount chip: unit + tier escalation (T2)', () => {
  it('the visible chip text is t(game.stack.cards) — unit present in en ("27 cards") and zh-Hant ("27 張")', () => {
    const original = getLocale();
    try {
      setLocale('en');
      expect(renderCount(27)).toContain('27 cards');
      setLocale('zh-Hant');
      expect(renderCount(27)).toContain('27 張');
    } finally {
      setLocale(original);
    }
  });

  it('low flips exactly at 11→10 (11 normal, 10 low, neither critical)', () => {
    const at11 = renderCount(11);
    expect(at11).not.toContain('gd-seatcount--low');
    expect(at11).not.toContain('gd-seatcount--critical');
    const at10 = renderCount(10);
    expect(at10).toContain('gd-seatcount--low');
    expect(at10).not.toContain('gd-seatcount--critical');
  });

  it('critical flips exactly at 3→2, and the critical aria reuses game.plate.cardsLow', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const at3 = renderCount(3);
      expect(at3).toContain('gd-seatcount--low');
      expect(at3).not.toContain('gd-seatcount--critical');
      const at2 = renderCount(2);
      expect(at2).toContain('gd-seatcount--critical');
      expect(at2).toContain(`aria-label="${t('game.plate.cardsLow', { count: 2 })}"`);
      // The non-critical chip carries NO aria override — its visible text
      // (unit included) is the accessible name.
      expect(at3).not.toContain(t('game.plate.cardsLow', { count: 3 }));
    } finally {
      setLocale(original);
    }
  });

  it('count null renders the "—" chip with the hiddenCount aria; undefined renders nothing at all', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const hidden = renderCount(null);
      expect(hidden).toContain('gd-seatcount--hidden');
      expect(hidden).toContain('—');
      expect(hidden).toContain(`aria-label="${t('game.plate.hiddenCount')}"`);
      expect(renderCount(undefined)).toBe('');
    } finally {
      setLocale(original);
    }
  });

  it('dealing suppresses tier escalation — the chip must not swell/recolor while counting up', () => {
    // Undealt, 2 cards IS critical (pinned above); mid-deal the same count is
    // just deal progress.
    const html = renderCount(2, true);
    expect(html).toContain('gd-seatcount');
    expect(html).not.toContain('gd-seatcount--low');
    expect(html).not.toContain('gd-seatcount--critical');
  });

  it('the pill is identity-only: no count, no countdown, no pass chip — committed is its one state chip', () => {
    const html = renderPlate({ active: true });
    expect(html).not.toContain('gd-seatcount');
    expect(html).not.toContain('gd-plate__timer');
    expect(html).not.toContain('gd-plate__pass');
    expect(html).not.toContain('gd-plate__chip');
    // The committed-tribute chip (a persistent phase state) still renders.
    const original = getLocale();
    try {
      setLocale('en');
      expect(renderPlate({ committed: true })).toContain('gd-plate__chip');
      expect(renderPlate({ committed: true })).toContain(t('game.tribute.committedChip'));
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

describe('seat-zone structure: name at the seat right hand, count opposite (T3)', () => {
  it('each remote zone renders [pill, cards, count] with NOTHING inside the pill but identity', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));

    for (const dir of ['north', 'east', 'west'] as const) {
      const zone = outerHtmlByClass(html, `gd-seatzone--${dir}`);
      const plate = outerHtmlByClass(zone, 'gd-plate');
      expect(plate, `${dir}: pill must not contain the stack`).not.toContain('gd-seatstack');
      expect(plate, `${dir}: pill must not contain the count`).not.toContain('gd-seatcount');
      expect(zone, `${dir}: zone carries the direction-modified stack`).toContain(
        `gd-seatstack--${dir}`,
      );
      expect(zone, `${dir}: zone carries the standalone count chip`).toContain('gd-seatcount');
      // DOM order is ALWAYS [pill, cards, count] — the CSS flex direction
      // (row / column / column-reverse) turns that into each seat's own
      // handedness; the order itself must never vary per dir.
      const plateAt = zone.indexOf('gd-plate');
      const stackAt = zone.indexOf('gd-seatzone__stackwrap');
      const countAt = zone.indexOf('gd-seatcount');
      expect(plateAt, `${dir}: pill first`).toBeGreaterThan(-1);
      expect(stackAt, `${dir}: wrap second`).toBeGreaterThan(plateAt);
      expect(countAt, `${dir}: count last`).toBeGreaterThan(stackAt);
      // R2 end to end: the settled 27-card seat shows exactly 27 real backs.
      expect(backCount(zone), `${dir}: 1:1 backs`).toBe(27);
      // The lap era is over: nothing advertises an absolute pill.
      expect(zone).not.toContain('gd-seatzone--stacked');
    }
    // The zones live INSIDE the existing ring cells, so DealOverlay's
    // .gd-ring__seat--* rect reads keep working untouched.
    for (const dir of ['north', 'east', 'west'] as const) {
      expect(html).toContain(`gd-ring__seat gd-ring__seat--${dir}`);
    }
  });

  it('the viewer bottom-bar plate is unchanged: no stack, no count chip (R9)', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));
    const bottombar = outerHtmlByClass(html, 'gd-bottombar');
    expect(bottombar).toContain('gd-plate--viewer');
    expect(bottombar).not.toContain('gd-seatstack');
    expect(bottombar).not.toContain('gd-seatcount');
  });

  it('the handedness CSS: north a row, east a column, west a REVERSED column; no lap rules remain', () => {
    const stripped = stripCssComments(tableCss);
    // Base zone = a row (north: pill left = north's right hand, count right).
    const base = stripped.match(/\.gd-seatzone\s*\{[^}]*\}/)?.[0] ?? '';
    expect(base, 'base zone rule not found').not.toBe('');
    expect(base).toContain('display: flex');
    expect(base).not.toContain('flex-direction');
    // East: a column (pill above = east's right hand at its strip top).
    expect(stripped).toMatch(/\.gd-seatzone--east\s*\{[^}]*flex-direction:\s*column\s*;/);
    // West: column-REVERSE — the same [pill, cards, count] DOM flips so the
    // pill lands at the strip's BOTTOM (west's right hand) and the count on
    // top. This is the load-bearing line of the whole mirror.
    expect(stripped).toMatch(/\.gd-seatzone--west\s*\{[^}]*flex-direction:\s*column-reverse/);
    // The lap CSS is gone wholesale (owner item 1: nothing overlays the
    // cards): no --stacked selector, and the ONLY zone-scoped plate rule is
    // north's absolute flank below — which anchors strictly BESIDE the block
    // (right: 100%), never over it. (The transient pass fade is the one
    // deliberate element over the cards; T13 pins it.)
    expect(stripped).not.toContain('gd-seatzone--stacked');
    const platesInZones = [...stripped.matchAll(/\.gd-seatzone[^{,]*\.gd-plate[^{]*\{[^}]*\}/g)].map(
      (m) => m[0],
    );
    expect(platesInZones).toHaveLength(1);
    expect(platesInZones[0]).toContain('.gd-seatzone--north');
  });

  it("north's flanks are absolute BESIDE the block — gated on --flanked, phone-capped (live + panel finds)", () => {
    // Regression pins, three layers deep: (1) 390 live find — sizing the
    // centre track by the [pill, cards, count] row grew the ring past the
    // viewport, and a flex squeeze crushed the pill to a bare dot; the
    // flanks hang absolutely at the block's edges (pill right: 100% =
    // north's right hand, count left: 100%), each with the load-bearing
    // width: max-content (shrink-to-fit against a lone inset is 0 wide —
    // the zh-Hant ellipsis physics). (2) Panel MED (Grok): only a zone WITH
    // a block flanks — the --flanked modifier — so a finished/hidden/held
    // zone never anchors to a collapsed box. (3) Panel MED (Codex): a phone
    // cap keeps a long-name flank inside the overflow-clipped table.
    const stripped = stripCssComments(tableCss);
    const pill =
      stripped.match(/\.gd-seatzone--north\.gd-seatzone--flanked > \.gd-plate\s*\{[^}]*\}/)?.[0] ??
      '';
    const count =
      stripped.match(
        /\.gd-seatzone--north\.gd-seatzone--flanked > \.gd-seatcount\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(pill, 'north pill flank rule not found').not.toBe('');
    expect(count, 'north count flank rule not found').not.toBe('');
    expect(pill).toMatch(/position:\s*absolute/);
    expect(pill).toMatch(/right:\s*100%/);
    expect(pill).toMatch(/width:\s*max-content/);
    expect(pill).toMatch(/max-width:\s*min\(9rem,\s*calc\(50vw - 5rem\)\)/);
    expect(count).toMatch(/position:\s*absolute/);
    expect(count).toMatch(/left:\s*100%/);
    expect(count).toMatch(/width:\s*max-content/);
    // No UNGATED north flank rule may sneak back.
    expect(stripped).not.toMatch(/\.gd-seatzone--north > \.gd-plate/);
  });

  it('a zone renders --flanked exactly when it has a block; a finished seat keeps everything in flow', () => {
    const store = new RoomStore('TESTCODE');
    // Settled 27s everywhere: every remote zone is flanked.
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));
    for (const dir of ['north', 'east', 'west'] as const) {
      expect(outerHtmlByClass(html, `gd-seatzone--${dir}`)).toContain('gd-seatzone--flanked');
    }
    // North seat (viewer 0 → seat 2) finished: badge-only pill, no block, no
    // flank anchor, no count chip.
    const finishedSnap = minimalSnapshot() as unknown as {
      perSeat: Map<number, { view: { finishOrder: number[] }; hints: null; lastEventBatch: null }>;
    };
    finishedSnap.perSeat.get(0)!.view.finishOrder = [2];
    const html2 = renderToStaticMarkup(
      createElement(GameTable, { snapshot: finishedSnap as unknown as RoomSnapshot, store }),
    );
    const north = outerHtmlByClass(html2, 'gd-seatzone--north');
    expect(north).not.toContain('gd-seatzone--flanked');
    expect(north).not.toContain('gd-seatzone__stackwrap');
    expect(north).not.toContain('gd-seatcount');
  });
});

// ---------------------------------------------------------------------------
// T13 — the transient PASS fade (flank round item 2): when a seat passes, the
// word shows IN FRONT of that seat's cards, fades in, holds ~2s, and lets go
// — never a pill chip. DOM-free pins: the GameTable wiring (render gate +
// per-seat key) and the CSS lifecycle (base opacity 0, a forwards run with a
// hold ending back at 0); the moving picture stays eyes/browser-gated.
// ---------------------------------------------------------------------------

describe('pass: a transient fade over the cards, not a pill chip (T13)', () => {
  it('GameTable gates the fade on the fold WALL-CLOCK stamp over a real block (source pins)', () => {
    const table = stripTsComments(gameTableSrc);
    // Panel MED (Codex + Grok concurring): rendering from the durable
    // `passed` set replayed the fade on every zone remount (seat-tab switch)
    // for as long as the trick ran. The gate must be the fold's wall-clock
    // stamp, expiring right after the 2.8s animation — and only over a real
    // block (a hidden-count zone has no cards to fade over; panel MED).
    expect(table).toMatch(/const passedStamp = derived\.passedAt\[seat\];/);
    expect(table).toMatch(
      /const passFresh = hasStack && passedStamp !== undefined && now - passedStamp < 3000;/,
    );
    expect(table).toMatch(/\{passFresh && \(/);
    expect(table).toMatch(/className="gd-seatzone__pass"/);
    // No stale-remount-prone key; the conditional mount IS the lifecycle.
    expect(table).not.toContain('`pass-${seat}`');
    // The unmount clock cannot depend on deadlines alone (panel round 2,
    // Grok: an untimed room would freeze `now` and pin a reduced-motion
    // pass to the table until the sweep): the tick effect runs while any
    // transient-fx stamp (pass fade OR play flight) is fresh and
    // self-expires after.
    expect(table).toMatch(/const latestFxAt = Math\.max\(/);
    expect(table).toMatch(/deadlines\.length === 0 && Date\.now\(\) >= fxFreshUntil/);
    // The pill renders NO pass state at all — SeatPlate has no passed prop.
    const plate = stripTsComments(
      readFileSync(join(__dirname, '../../../src/client/table/SeatPlate.tsx'), 'utf8'),
    );
    expect(plate).not.toContain('passed');
  });

  it('the fold stamps passedAt on a pass and clears it with the trick/hand/play (unit)', () => {
    const nameFor = (s: number) => `S${s}`;
    let id = 0;
    const fold = (prev: SeatDerived, ev: object) =>
      foldEvents(prev, [ev as never], 0, nameFor, () => id++);
    const before = Date.now();
    const passedState = fold(EMPTY_DERIVED, { type: 'passed', seat: 1 });
    expect(passedState.passed).toEqual([1]);
    expect(passedState.passedAt[1]).toBeGreaterThanOrEqual(before);
    expect(passedState.passedAt[1]).toBeLessThanOrEqual(Date.now());
    // The sweep clears both the set and the stamps…
    const swept = fold(passedState, { type: 'trickWon', seat: 2 });
    expect(swept.passed).toEqual([]);
    expect(swept.passedAt).toEqual({});
    // …a later play by the passer (jiefeng continuation) drops its stamp…
    const played = fold(passedState, {
      type: 'played',
      seat: 1,
      decl: { type: 'single', keyRank: '9', size: 1 },
    });
    expect(played.passed).toEqual([]);
    expect(played.passedAt[1]).toBeUndefined();
    // …and a fresh hand starts clean.
    const dealt = fold(passedState, {
      type: 'handStarted',
      handNo: 2,
      currentLevel: '3',
      hands: [[], [], [], []],
    });
    expect(dealt.passedAt).toEqual({});
  });

  it('reduced motion still SHOWS the pass: a static opacity 1 override inside the reduce block (panel HIGH)', () => {
    // Panel HIGH (Grok): base opacity 0 + the blanket animation:none meant a
    // reduced-motion user never saw a pass at all. The reduce block must
    // re-assert full opacity; the wall-clock unmount keeps it transient.
    const stripped = stripCssComments(tableCss);
    const reduceBlock = stripped.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join('\n') ?? '';
    expect(reduceBlock, 'reduced-motion block not found').not.toBe('');
    expect(reduceBlock).toMatch(/\.gd-seatzone__pass\s*\{\s*opacity:\s*1;\s*\}/);
  });

  it('the fade CSS: base opacity 0, a ~2s-hold forwards animation that ends at 0, centred over the block', () => {
    const stripped = stripCssComments(tableCss);
    const rule = stripped.match(/\.gd-seatzone__pass\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule, 'pass rule not found').not.toBe('');
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/opacity:\s*0;/);
    expect(rule).toMatch(/animation:[^;]*gd-passfade[^;]*forwards/);
    expect(rule).toMatch(/pointer-events:\s*none/);
    // The lifecycle: in fast, hold past the 2s mark, out — and the LAST frame
    // is opacity 0, so with fill-forwards nothing lingers over the cards.
    const frames = stripped.match(/@keyframes gd-passfade\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(frames, 'gd-passfade keyframes not found').not.toBe('');
    expect(frames).toMatch(/100%\s*\{\s*opacity:\s*0;\s*\}/);
    // ~2s visible: the animation runs 2.8s with the hold ending ~71% (≈2.0s).
    expect(rule).toMatch(/animation:[^;]*2\.8s/);
    expect(frames).toMatch(/71%\s*\{\s*opacity:\s*1;\s*\}/);
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
// T10 — placement direction (owner follow-up), now through the multi-row wrap.
// Every player lays cards from THEIR OWN right to THEIR OWN left, each new card
// on top. Two axes:
//  · LAY axis (within a row, --gd-stack-pos): north/east cascade straight,
//    west REVERSES (perrow−1−pos), so the sides mirror end-to-end. Within a
//    row paint order is DOM order (arrival order) — newest on top.
//  · WRAP axis (across rows, --gd-stack-row): every side's rows grow INWARD
//    toward the centre from the seat's own edge — east from the right so it
//    reverses the row index (rows−1−row), west from the left straight; north's
//    rows step downward straight. The two sides therefore mirror on BOTH axes.
// ACROSS rows the refinement round flipped the paint order (owner item 3):
// the FRONT row (row 0) paints OVER the inner row via a z-index that carries
// ONLY the row flip — nothing else in the stack rules touches z.
// ---------------------------------------------------------------------------

describe('placement direction — top-view physics, multi-row (T10)', () => {
  const stackRules = seatstackRules(tableCss);

  it('the front row paints over the inner row: one z-index, carrying exactly the row flip (item 3)', () => {
    const slotRule = stackRules.find((r) => r.startsWith('.gd-seatstack__slot'));
    expect(slotRule, 'slot rule not found').toBeDefined();
    // Row 0 (the seat's own edge) wins: z = rows − 1 − row, so 1 vs 0 for a
    // wrapped pair and a harmless 0 for a single line.
    expect(slotRule).toMatch(
      /z-index:\s*calc\(var\(--gd-stack-rows\)\s*-\s*1\s*-\s*var\(--gd-stack-row\)\)/,
    );
    // …and no OTHER stack rule re-orders slots: the only z-index besides the
    // row flip is the BASE container's z-index: 0 — an explicit stacking
    // context that seals the slot z-indexes inside the block, so they can
    // never climb over zone siblings or the transient pass fade. WITHIN a
    // row, DOM order (arrival order) still decides — the newest card lands
    // on top (R10).
    const others = stackRules.filter((r) => r !== slotRule && r.includes('z-index'));
    expect(others).toHaveLength(1);
    expect(others[0]).toMatch(/^\.gd-seatstack\s*\{/);
    expect(others[0]).toMatch(/z-index:\s*0;/);
  });

  it('within a row north/east lay straight with --gd-stack-pos (newest at the screen right / strip bottom)', () => {
    const north = stackRules.find((r) => r.includes('--north') && r.includes('left:'));
    expect(north, 'north slot rule not found').toBeDefined();
    expect(north).toMatch(/left:[^;]*var\(--gd-stack-pos\)\s*\*\s*var\(--gd-stack-exposure\)/);
    expect(north).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-pos\)/);
    const east = stackRules.find((r) => r.startsWith('.gd-seatstack--east >') && r.includes('top:'));
    expect(east, 'east slot rule not found').toBeDefined();
    expect(east).toMatch(/top:[^;]*var\(--gd-stack-pos\)\s*\*\s*var\(--gd-stack-exposure\)/);
    expect(east).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-pos\)/);
  });

  it("within a row west reverses --gd-stack-pos over perrow (newest at the strip's TOP end) — the sides mirror", () => {
    const west = stackRules.find((r) => r.startsWith('.gd-seatstack--west >') && r.includes('top:'));
    expect(west, 'west slot rule not found').toBeDefined();
    expect(west).toMatch(
      /top:[^;]*\(var\(--gd-stack-perrow\)\s*-\s*1\s*-\s*var\(--gd-stack-pos\)\)\s*\*\s*var\(--gd-stack-exposure\)/,
    );
  });

  it('rows grow inward: east reverses the row index (from the right edge), west steps it straight (from the left)', () => {
    const east = stackRules.find((r) => r.startsWith('.gd-seatstack--east >') && r.includes('left:'));
    const west = stackRules.find((r) => r.startsWith('.gd-seatstack--west >') && r.includes('left:'));
    expect(east, 'east slot rule not found').toBeDefined();
    expect(west, 'west slot rule not found').toBeDefined();
    // East hugs the right edge, so its rows count inward as (rows−1−row). The
    // row step MUST carry `* var(--gd-stack-aspect)` (Grok audit): the offset
    // is a fraction of the card's CROSS dimension — drop the aspect factor and
    // the rows stop tiling flush inside the side container even though the
    // coarse `(rows−1−row) * linefrac` fragment still matches.
    expect(east).toMatch(
      /left:[^;]*\(var\(--gd-stack-rows\)\s*-\s*1\s*-\s*var\(--gd-stack-row\)\)\s*\*\s*var\(--gd-stack-linefrac\)\s*\*\s*var\(--gd-stack-aspect\)/,
    );
    // West hugs the left edge, so its rows step straight with the row index —
    // minus the boundary clip (item 4: west's OUTER edge is its left, so its
    // front row hangs negative there), the whole bracket × aspect.
    expect(west).toMatch(
      /left:[^;]*\(var\(--gd-stack-row\)\s*\*\s*var\(--gd-stack-linefrac\)\s*-\s*var\(--gd-stack-clip\)\)\s*\*\s*var\(--gd-stack-aspect\)/,
    );
    expect(west).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-row\)/);
    // Both sides re-centre the rotated box with the SAME ±(aspect−1)/2 term
    // that made the single-column strip flush — the multi-row offset rides on
    // top of it, it does not replace it.
    expect(east).toMatch(/\(var\(--gd-stack-aspect\)\s*-\s*1\)\s*\/\s*2/);
    expect(west).toMatch(/\(var\(--gd-stack-aspect\)\s*-\s*1\)\s*\/\s*2/);
  });

  it('north rows step down straight with --gd-stack-row (the wrap grows toward the centre)', () => {
    const north = stackRules.find((r) => r.includes('--north') && r.includes('top:'));
    expect(north, 'north slot rule not found').toBeDefined();
    // Row step carries the aspect factor here too (cross dimension = the card
    // height for the un-rotated north strip), minus the boundary clip (item 4:
    // north's outer edge is its top, so its front row hangs negative there).
    expect(north).toMatch(
      /top:[^;]*var\(--gd-stack-aspect\)\s*\*\s*\(var\(--gd-stack-row\)\s*\*\s*var\(--gd-stack-linefrac\)\s*-\s*var\(--gd-stack-clip\)\)/,
    );
    expect(north).not.toMatch(/-\s*1\s*-\s*var\(--gd-stack-row\)/);
  });

  it('slots render in arrival order (DOM index IS --gd-stack-i), so the last-arrived card paints on top', () => {
    const html = renderStack('west', 3);
    const indices = [...html.matchAll(/--gd-stack-i:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(indices).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// T11 — the multi-row wrap itself (owner "two or three rows" compaction): the
// row-count policy is pure and capped, the container advertises its wrap
// shape, and each slot carries the row-major (row, pos) its geometry keys off.
// ---------------------------------------------------------------------------

describe('multi-row wrap policy + per-slot mapping (T11)', () => {
  it('seatStackRows: short hands stay one line, a full hand wraps, never past the max', () => {
    // A tiny hand must never look like a multi-row block.
    for (const n of [1, 2, 5, SEAT_STACK_ROW_CAP]) expect(seatStackRows(n), `count ${n}`).toBe(1);
    // Just over the cap wraps to a second row…
    expect(seatStackRows(SEAT_STACK_ROW_CAP + 1)).toBe(2);
    // …and a full 27-card hand is 2 rows (mobile-optimal — 3 would crush the
    // centre trick area at 390px).
    expect(seatStackRows(27)).toBe(SEAT_STACK_MAX_ROWS);
    expect(SEAT_STACK_MAX_ROWS).toBe(2);
    // The cap is a hard ceiling: nothing, however large, exceeds it.
    for (const n of [28, 54, 200]) expect(seatStackRows(n)).toBeLessThanOrEqual(SEAT_STACK_MAX_ROWS);
  });

  it('seatStackPerRow: a single row spans the count; a wrapped block pins perRow at the cap', () => {
    // Single-row hands span their whole count along the lay axis.
    for (const n of [1, 6, SEAT_STACK_ROW_CAP]) expect(seatStackPerRow(n), `count ${n}`).toBe(n);
    // Every wrapped count uses the SAME perRow (= cap), NOT ceil(count/rows):
    // that is what keeps the lay-axis extent constant while a hand is played
    // down through 27…15 (Grok audit — a balanced perRow would reflow it every
    // play and jump it up at the 15→14 unwrap).
    for (const n of [15, 20, 26, 27]) expect(seatStackPerRow(n), `count ${n}`).toBe(SEAT_STACK_ROW_CAP);
    // Continuity across the unwrap: 14 (one row of 14) and 15 (14+1) lay the
    // same width — only the second row appears on the cross axis.
    expect(seatStackPerRow(14)).toBe(seatStackPerRow(15));
  });

  it('the container advertises its wrap shape (rows + perrow), sized off the SIZED count', () => {
    // Settled 27 → 2 rows, perRow pinned at the cap (14).
    const html = renderStack('north', 27);
    expect(html).toContain('--gd-stack-rows:2');
    expect(html).toContain('--gd-stack-perrow:14');
    // A mid-play count still uses the cap perRow (constant lay extent) — a full
    // top row and a short second row, NOT a balanced ceil(20/2)=10 split.
    const mid = renderStack('west', 20);
    expect(mid).toContain('--gd-stack-rows:2');
    expect(mid).toContain('--gd-stack-perrow:14');
    // A short hand stays a single row that spans the whole count.
    const small = renderStack('east', 6);
    expect(small).toContain('--gd-stack-rows:1');
    expect(small).toContain('--gd-stack-perrow:6');
  });

  it('settled slots carry the row-major (row, pos): pos = i mod perrow, row = ⌊i / perrow⌋', () => {
    const html = renderStack('north', 27); // perrow 14, no reserve → settled
    const slots = [...html.matchAll(/--gd-stack-i:\s*(\d+);--gd-stack-pos:\s*(\d+);--gd-stack-row:\s*(\d+)/g)].map(
      (m) => ({ i: Number(m[1]), pos: Number(m[2]), row: Number(m[3]) }),
    );
    expect(slots).toHaveLength(27);
    for (const s of slots) {
      expect(s.pos, `slot ${s.i} pos`).toBe(s.i % 14);
      expect(s.row, `slot ${s.i} row`).toBe(Math.floor(s.i / 14));
    }
    // Row 0 holds the cap (cards 0–13), row 1 the rest (14–26) — so play-time
    // shrinkage (the last index leaving) peels the mostly-hidden inner row
    // first and the lay-axis extent never moves.
    expect(slots.filter((s) => s.row === 0)).toHaveLength(14);
    expect(slots.filter((s) => s.row === 1)).toHaveLength(13);
  });

  it('seatStackSlot: dealing alternates rows column by column (owner item 1); settled is row-major', () => {
    // The owner's exact description: 1st card row 0 col 0, 2nd card row 1
    // col 0, 3rd card row 0 col 1 — row = i mod 2, col = ⌊i / 2⌋.
    expect(seatStackSlot(0, 27, true)).toEqual({ row: 0, pos: 0 });
    expect(seatStackSlot(1, 27, true)).toEqual({ row: 1, pos: 0 });
    expect(seatStackSlot(2, 27, true)).toEqual({ row: 0, pos: 1 });
    expect(seatStackSlot(3, 27, true)).toEqual({ row: 1, pos: 1 });
    expect(seatStackSlot(26, 27, true)).toEqual({ row: 0, pos: 13 });
    // Settled: row-major over the pinned perRow.
    expect(seatStackSlot(13, 27, false)).toEqual({ row: 0, pos: 13 });
    expect(seatStackSlot(14, 27, false)).toEqual({ row: 1, pos: 0 });
    expect(seatStackSlot(26, 27, false)).toEqual({ row: 1, pos: 12 });
    // A single-line block is the identity mapping in BOTH modes (a short hand
    // never alternates — there is only one row to alternate into).
    for (const dealing of [true, false]) {
      expect(seatStackSlot(0, 5, dealing)).toEqual({ row: 0, pos: 0 });
      expect(seatStackSlot(4, 5, dealing)).toEqual({ row: 0, pos: 4 });
    }
  });

  it('the deal-end mapping swap is invisible where it happens — and ONLY there (bounded set equality)', () => {
    // The two mappings occupy the same slot set exactly when every used
    // column is full-height: single-row counts and the full 27. That is the
    // load-bearing invariant — the normal choreography flips `dealing` off at
    // the settled 27, so the swap never repaints (backs indistinguishable).
    // The bound matters too (Grok audit: "invisible at any count" would
    // overclaim): in the wrapped middle the sets DIFFER, and the skip path is
    // safe for a different reason — the same render that flips `dealing`
    // jumps the count source to the settled 27, a fill jump, never a
    // same-count remap.
    const occupancy = (count: number, dealing: boolean) =>
      new Set(
        Array.from({ length: count }, (_, i) => {
          const { row, pos } = seatStackSlot(i, count, dealing);
          return `${row}:${pos}`;
        }),
      );
    for (const n of [1, 5, 14, 27]) {
      expect(occupancy(n, true), `count ${n}`).toEqual(occupancy(n, false));
    }
    // …and the wrapped middle is NOT swap-safe (20: alternating fills 10+10,
    // row-major 14+6) — pinning the boundary keeps anyone from "simplifying"
    // to a mid-hand mapping flip.
    expect(occupancy(20, true)).not.toEqual(occupancy(20, false));
  });

  it('the wrap shape is derived from the reservation mid-deal, so it never reflows as cards land', () => {
    // Only 3 backs landed, but the block is already shaped for the final 27
    // (2 rows, perRow 14) — and the landed backs alternate rows (item 1): the
    // 1st card opens row 0, the 2nd opens row 1 beneath it, the 3rd starts
    // column 1 — assert the tuples, not just the shape/count (Grok audit).
    const html = renderToStaticMarkup(createElement(SeatStack, { dir: 'west', count: 3, reserve: 27 }));
    expect(html).toContain('--gd-stack-rows:2');
    expect(html).toContain('--gd-stack-perrow:14');
    expect(backCount(html)).toBe(3);
    const slots = [...html.matchAll(/--gd-stack-i:\s*(\d+);--gd-stack-pos:\s*(\d+);--gd-stack-row:\s*(\d+)/g)].map(
      (m) => [Number(m[1]), Number(m[2]), Number(m[3])],
    );
    expect(slots).toEqual([
      [0, 0, 0],
      [1, 0, 1],
      [2, 1, 0],
    ]);
  });
});

// ---------------------------------------------------------------------------
// T12 — the boundary clip (owner item 4): a wrapped block's front row rides
// (1 − peek) past its outer edge and is cropped, so the table only pays for
// the peek + the inner row's linefrac sliver. The clip is ONE derived var,
// subtracted from every cross-axis size, and only --wrapped blocks crop.
// ---------------------------------------------------------------------------

describe('boundary clip: front row half outside, cropped (T12)', () => {
  const stackRules = seatstackRules(tableCss);

  it('--gd-stack-clip is derived ONCE, off rows and peek, collapsing to 0 for a single line', () => {
    const stripped = stripCssComments(tableCss);
    expect([...stripped.matchAll(/--gd-stack-clip:/g)]).toHaveLength(1);
    expect(stripped).toMatch(
      /--gd-stack-clip:\s*calc\(\(var\(--gd-stack-rows\)\s*-\s*1\)\s*\*\s*\(1\s*-\s*var\(--gd-stack-peek\)\)\);/,
    );
  });

  it('every cross-axis container size subtracts the clip (north height, east/west width)', () => {
    const north = stackRules.find((r) => r.includes('--north') && r.includes('height:'));
    const sides = stackRules.find(
      (r) => r.includes('--east') && r.includes('--west') && r.includes('width:'),
    );
    expect(north, 'north container rule not found').toBeDefined();
    expect(sides, 'east/west container rule not found').toBeDefined();
    for (const rule of [north!, sides!]) {
      expect(rule).toMatch(
        /\(1\s*\+\s*\(var\(--gd-stack-rows\)\s*-\s*1\)\s*\*\s*var\(--gd-stack-linefrac\)\s*-\s*var\(--gd-stack-clip\)\)/,
      );
    }
  });

  it('only a WRAPPED block crops: overflow rides the --wrapped modifier, not the base rule', () => {
    const stripped = stripCssComments(tableCss);
    expect(stripped).toMatch(/\.gd-seatstack--wrapped\s*\{[^}]*overflow:\s*hidden/);
    // The base container must NOT crop — an unwrapped strip still shows whole
    // cards edge to edge (shadows and all), exactly as the pre-wrap build did.
    const base = stripped.match(/^\.gd-seatstack\s*\{[^}]*\}/m)?.[0] ?? '';
    expect(base, 'base .gd-seatstack rule not found').not.toBe('');
    expect(base).not.toContain('overflow');
  });

  it('the component adds --wrapped exactly when the block wraps (sized count, reserve included)', () => {
    expect(renderStack('north', 27)).toContain('gd-seatstack--wrapped');
    expect(renderStack('east', 15)).toContain('gd-seatstack--wrapped');
    expect(renderStack('east', 14)).not.toContain('gd-seatstack--wrapped');
    expect(renderStack('west', 6)).not.toContain('gd-seatstack--wrapped');
    // Mid-deal, 3 landed backs in a 27-reservation already crop — the block
    // must hold its final cropped extent from frame one.
    expect(
      renderToStaticMarkup(createElement(SeatStack, { dir: 'west', count: 3, reserve: 27 })),
    ).toContain('gd-seatstack--wrapped');
  });

  it('east needs no per-slot clip term: its container narrows at the OUTER (right) edge instead', () => {
    // West/north subtract the clip in their slot offsets (their outer edge is
    // at coordinate 0); east's outer edge is the container's far side, so the
    // width subtraction above IS its crop and its slot offsets stay clip-free.
    const east = stackRules.find((r) => r.startsWith('.gd-seatstack--east >') && r.includes('left:'));
    expect(east, 'east slot rule not found').toBeDefined();
    expect(east).not.toContain('--gd-stack-clip');
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

  it('--gd-stack-linefrac (the cross-axis row step) is declared exactly once (0.36) with no re-typed literal or TS mirror', () => {
    const stripped = stripCssComments(tableCss);
    expect([...stripped.matchAll(/--gd-stack-linefrac:/g)]).toHaveLength(1);
    // 0.36 (refinement item 2, tightened from 0.5): with the front row on top
    // this IS the inner row's visible sliver, so smaller = deeper lap.
    expect(stripped).toMatch(/--gd-stack-linefrac:\s*0\.36\s*;/);
    // The wrap depth is aspect-relative (× --gd-stack-aspect in the calcs), and
    // no STACK rule re-types the fraction as a literal (scoped: unrelated
    // card-face font calcs elsewhere in the sheet legitimately use 0.36).
    expect(seatstackRules(tableCss).join('\n')).not.toMatch(/\*\s*0\.36\b/);
    expect(stripTsComments(seatStackSrc)).not.toContain('0.36');
  });

  it('--gd-stack-peek (the front row’s surviving height) is declared exactly once (0.5) with no re-typed literal or TS mirror', () => {
    const stripped = stripCssComments(tableCss);
    expect([...stripped.matchAll(/--gd-stack-peek:/g)]).toHaveLength(1);
    // Half a card of the front row stays visible (owner item 4: "showing only
    // the half of the height of the 1st row cards").
    expect(stripped).toMatch(/--gd-stack-peek:\s*0\.5\s*;/);
    // Every consumer reads the var (the --gd-stack-clip derivation is the only
    // arithmetic over it); no STACK rule multiplies by a re-typed 0.5 literal.
    expect(seatstackRules(tableCss).join('\n')).not.toMatch(/\*\s*0\.5\b/);
    expect(stripTsComments(seatStackSrc)).not.toContain('0.5');
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
      // The LAYOUT sizes off the wrap shape (rows + perrow), not --gd-stack-n:
      // both must be reserved for the final 27 too, or the block would reflow
      // as cards land even with --gd-stack-n frozen (Grok audit).
      expect(html, `${dir}: rows reserved`).toContain('--gd-stack-rows:2');
      expect(html, `${dir}: perrow reserved`).toContain('--gd-stack-perrow:14');
    }
  });

  it('at ZERO landed cards the reserved strip already holds its space, and the pill chip counts from zero', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderReserved('east', 0, 27);
      expect(backCount(html)).toBe(0);
      expect(html).toContain('--gd-stack-n:27');
      // The standalone chip (the cards' other side since the flank round)
      // renders from frame one — its later appearance would jitter the zone
      // mid-deal — and counts up from zero, tier escalation suppressed (T2
      // pins the suppression boundary).
      expect(renderCount(0, true)).toContain('0 cards');
    } finally {
      setLocale(original);
    }
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
    expect(table).toMatch(/const reserve = dealing \? HAND_SIZE : undefined;/);
    expect(table).toMatch(/reserve=\{reserve\}/);
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

  it('table.css compresses the pre-ring chrome below 720px: headline air + turn line tightened', () => {
    const block = narrowBlock(tableCss, 'table.css');
    expect(block).toContain('.gd-headline {');
    const baseTurn = fontSizeRem(stripCssComments(tableCss), '.gd-headline__turn');
    const narrowTurn = fontSizeRem(block, '.gd-headline__turn');
    expect(narrowTurn).toBeLessThan(baseTurn);
    // The seat-tab bar is gone entirely (owner: pills are the switcher) —
    // nothing may compress what no longer exists. Ditto the big level
    // numeral (compact-bar round: the team badges ARE the level display).
    expect(stripCssComments(tableCss)).not.toContain('.gd-tabs');
    expect(stripCssComments(tableCss)).not.toContain('.gd-headline__rank');
    expect(stripCssComments(tableCss)).not.toContain('.gd-headline__wild');
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

// ---------------------------------------------------------------------------
// T14 — the play flight (owner: "like the dealing process"): the pile's count
// drop and N face-up cards flying from BEHIND the pile to their own trick-well
// slots. DOM-free pins: PlayOverlay's markup + source discipline, the fold
// trigger, the render gate, and the layering CSS; the moving picture stays
// eyes/browser-gated.
// ---------------------------------------------------------------------------

import { PlayOverlay } from '../../../src/client/table/PlayOverlay';
import { TrickWell } from '../../../src/client/table/TrickWell';

describe('play flight: from behind the pile to the table (T14)', () => {
  const playOverlaySrc = readFileSync(
    join(__dirname, '../../../src/client/table/PlayOverlay.tsx'),
    'utf8',
  );

  it('renders one face-up hand-size card per played card, in an aria-hidden fixed layer', () => {
    const html = renderToStaticMarkup(
      createElement(PlayOverlay, { dir: 'east', cards: ['9H', '9S', '9D'], level: '2' }),
    );
    expect(html).toMatch(/class="gd-playfx" aria-hidden="true"/);
    expect(html.match(/gd-playfx__card/g) ?? []).toHaveLength(3);
    expect(html.match(/class="gd-cardframe gd-card--hand"/g) ?? []).toHaveLength(3);
  });

  it("the fold stamps playFx on every 'played' (distinct ids) and a new hand clears it", () => {
    const nameFor = (s: number) => `S${s}`;
    let id = 0;
    const fold = (prev: SeatDerived, ev: object) =>
      foldEvents(prev, [ev as never], 0, nameFor, () => id++);
    const play = {
      type: 'played',
      seat: 2,
      cards: ['9H', '9S'],
      decl: { type: 'pair', keyRank: '9', size: 2 },
    };
    const first = fold(EMPTY_DERIVED, play);
    expect(first.playFx?.seat).toBe(2);
    expect(first.playFx?.cards).toEqual(['9H', '9S']);
    expect(first.playFx?.at).toBeLessThanOrEqual(Date.now());
    // A trick-opening play covers NOTHING; the fold now remembers it as the
    // table's top (owner physics: the next flight lands ON these).
    expect(first.playFx?.covered).toBeNull();
    expect(first.topCards).toEqual(['9H', '9S']);
    const second = fold(first, { ...play, seat: 3, cards: ['TH', 'TS'] });
    expect(second.playFx?.seat).toBe(3);
    expect(second.playFx?.id).not.toBe(first.playFx?.id);
    // The covering play carries the play it covers, and takes the top over.
    expect(second.playFx?.covered).toEqual(['9H', '9S']);
    expect(second.topCards).toEqual(['TH', 'TS']);
    const dealt = fold(second, {
      type: 'handStarted',
      handNo: 2,
      currentLevel: '3',
      hands: [[], [], [], []],
    });
    expect(dealt.playFx).toBeNull();
    expect(dealt.topCards).toBeNull();
    // The sweep kills a flight too (panel MED, Grok: the well re-keys empty
    // and an airborne flight would sail into the cleared centre) — and the
    // remembered top with it (the next trick opens on a bare table).
    const swept = fold(second, { type: 'trickWon', seat: 3 });
    expect(swept.playFx).toBeNull();
    expect(swept.topCards).toBeNull();
  });

  it('GameTable renders the overlay only while fresh, outside the deal/ceremony, keyed by the fold id (source pins)', () => {
    const table = stripTsComments(gameTableSrc);
    expect(table).toMatch(
      /playFx !== null && !dealing && !ceremonyShowing && now - playFx\.at < 2000 \? playFx : null/,
    );
    expect(table).toMatch(/key=\{playFlight\.id\}/);
    expect(table).toMatch(/dir=\{dirFor\(playFlight\.seat\)\}/);
    // The tick's fx leg covers the flight's window too (untimed rooms).
    expect(table).toMatch(/d\.playFx !== null \? \[d\.playFx\.at\] : \[\]/);
  });

  it('PlayOverlay source discipline: reduced-motion bail, mismatch bail, restore-on-cleanup, display-not-remove', () => {
    const src = stripTsComments(playOverlaySrc);
    // LAYOUT effect (panel MED, Grok): the well's fresh cards commit visible
    // in the same render — a post-paint useEffect would flash them for a
    // frame before the flight hides them.
    expect(src).toMatch(/useIsomorphicLayoutEffect\(\(\) => \{/);
    expect(src).toMatch(
      /const useIsomorphicLayoutEffect = typeof window !== 'undefined' \? useLayoutEffect : useEffect;/,
    );
    // Queries scope to THIS overlay's table, and no ring means NO flight —
    // never a page-global fallback (DealOverlay's discipline; panel round-2
    // LOW, Codex).
    expect(src).toMatch(/const scope = root\.closest\('\.gd-ring'\);\s*if \(scope === null\) return;/);
    expect(src).not.toContain('?? document');
    // Reduced motion: the settled well is the whole story — no flights, no
    // well hiding.
    expect(src).toMatch(/if \(prefersReducedMotion\(\)\) return;/);
    // A well that does not exactly hold this play bails to settled layout.
    expect(src).toMatch(/targets\.length !== nodes\.length \|\| targets\.length === 0\) return;/);
    // The unmount cleanup can NEVER leave the well hidden…
    expect(src).toMatch(/for \(const a of animations\) a\.cancel\(\);\s*restore\(\);/);
    // …and React-owned flight nodes are display-hidden, never .remove()d.
    expect(src).toContain("node.style.display = 'none'");
    expect(src).not.toContain('node.remove()');
  });

  it('the layer CSS: fixed OVER the well (z 11 vs 10 — owner physics), cards base opacity 0, pointer-inert', () => {
    const stripped = stripCssComments(tableCss);
    const layer = stripped.match(/\.gd-playfx\s*\{[^}]*\}/)?.[0] ?? '';
    const card = stripped.match(/\.gd-playfx__card\s*\{[^}]*\}/)?.[0] ?? '';
    expect(layer, 'layer rule not found').not.toBe('');
    expect(layer).toMatch(/position:\s*fixed/);
    // Owner physics refinement: while the covered play still sits on the
    // table, the incoming cards must fly ABOVE it — never slide beneath.
    expect(layer).toMatch(/z-index:\s*11/);
    expect(layer).toMatch(/pointer-events:\s*none/);
    expect(card).toMatch(/opacity:\s*0/);
    expect(stripped).toMatch(/\.gd-well\s*\{[^}]*z-index:\s*10/);
  });

  it('the covered underlay GRID-STACKS with the top (panel HIGHs): unpositioned, well sized by the larger row', () => {
    const stripped = stripCssComments(tableCss);
    // The well stacks both rows into one grid cell — the box takes the
    // LARGER row, so a longer old play keeps its exact pixels (an absolute
    // underlay re-laid it inside the NEW top's smaller box — panel HIGH,
    // Codex + Grok converging).
    const well = stripped.match(/\.gd-well\s*\{[^}]*\}/)?.[0] ?? '';
    expect(well).toMatch(/display:\s*grid/);
    expect(stripped).toMatch(/\.gd-well > \.gd-well__cards\s*\{[^}]*grid-area:\s*1 \/ 1/);
    const covered = stripped.match(/\.gd-well__cards--covered\s*\{[^}]*\}/)?.[0] ?? '';
    expect(covered, 'covered rule not found').not.toBe('');
    // NOT positioned (panel MED, Grok): a positioned z-auto "underlay"
    // paints ABOVE its in-flow sibling — DOM order must be the paint order.
    expect(covered).not.toContain('position:');
    expect(covered).not.toContain('inset:');
    expect(covered).toMatch(/pointer-events:\s*none/);
    expect(covered).toMatch(/transition:\s*opacity/);
    expect(stripped).toMatch(/\.gd-well__cards--fading\s*\{\s*opacity:\s*0;\s*\}/);
    const reduceBlocks =
      stripped.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join('\n') ??
      '';
    expect(reduceBlocks).toMatch(/\.gd-well__cards--covered\s*\{\s*display:\s*none;\s*\}/);
  });

  it('TrickWell renders the covered play beneath the top — and only alongside a top', () => {
    const trick = { leader: 1, toAct: 2, top: { seat: 1, cards: ['TH', 'TS'], decl: null }, jiefengTo: null };
    const html = renderToStaticMarkup(
      createElement(TrickWell, {
        trick: trick as never,
        level: '2',
        sweepKey: 0,
        covered: ['9H', '9S', '9D'],
      }),
    );
    const coveredAt = html.indexOf('gd-well__cards--covered');
    const topAt = html.lastIndexOf('<div class="gd-well__cards">');
    expect(coveredAt).toBeGreaterThan(-1);
    expect(topAt).toBeGreaterThan(coveredAt);
    // 3 covered + 2 top faces, all hand-size.
    expect(html.match(/class="gd-cardframe gd-card--hand"/g) ?? []).toHaveLength(5);
    // No top (a swept/bare well) → no underlay either, whatever covered says.
    const bare = renderToStaticMarkup(
      createElement(TrickWell, { trick: null, level: '2', sweepKey: 0, covered: ['9H'] }),
    );
    expect(bare).not.toContain('gd-well__cards--covered');
  });

  it('the flight targets ONLY the top row; the LAST landing starts the fade; the underlay is keyed per flight', () => {
    const src = stripTsComments(playOverlaySrc);
    expect(src).toMatch(/\.gd-well__cards:not\(\.gd-well__cards--covered\) \.gd-cardframe/);
    // Last landing = the moment the new play has FULLY covered the old
    // (panel MED, Grok: a first-landing fade let protruding cards start
    // vanishing while later cards were still airborne).
    expect(src).toMatch(/let airborne = targets\.length;/);
    expect(src).toMatch(/airborne--;\s*if \(airborne === 0\) \{/);
    expect(src).toMatch(/classList\.add\('gd-well__cards--fading'\)/);
    const table = stripTsComments(gameTableSrc);
    expect(table).toMatch(/covered=\{playFlight !== null \? playFlight\.covered : null\}/);
    // Keyed per flight (panel HIGH, Codex + Grok converging): React reuses
    // the underlay element across back-to-back covering plays, and an
    // imperatively-added fade class would survive onto the NEXT play's
    // underlay, starting it invisible.
    expect(table).toMatch(/coveredKey=\{playFlight !== null \? playFlight\.id : undefined\}/);
    const wellSrc = stripTsComments(
      readFileSync(join(__dirname, '../../../src/client/table/TrickWell.tsx'), 'utf8'),
    );
    expect(wellSrc).toMatch(/key=\{`covered-\$\{coveredKey \?\? 0\}`\}/);
  });
});

// ---------------------------------------------------------------------------
// T15 — the seat switcher IS the name pill (owner: the Seat 1-4 tab bar was
// redundant same-user chrome — verified: client-local view switching only,
// nothing rendered for a single held seat).
// ---------------------------------------------------------------------------

describe('seat switching via the name pill; the tab bar is gone (T15)', () => {
  it('a pill WITH onSelect is a real button (switchTo aria, --held); without it, a plain div', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const held = renderPlate({ onSelect: () => {} });
      expect(held).toMatch(/<button type="button" class="gd-plate gd-plate--held"/);
      expect(held).toContain(`aria-label="${t('game.seat.switchTo', { name: '阿美' })}"`);
      const plain = renderPlate();
      expect(plain).toMatch(/<div class="gd-plate"/);
      expect(plain).not.toContain('<button');
    } finally {
      setLocale(original);
    }
  });

  it('single held seat: no switcher pills anywhere and no tab bar markup', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));
    expect(html).not.toContain('gd-plate--held');
    expect(html).not.toContain('gd-tabs');
  });

  it('multi-seat self-play: a HELD remote seat pill is the switcher; the active pill and stranger pills are not', () => {
    const snap = minimalSnapshot() as unknown as { seats: Map<number, { token: string }> };
    snap.seats.set(2, { token: 'tok2' }); // viewer also holds seat 2 (north)
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, { snapshot: snap as unknown as RoomSnapshot, store }),
    );
    const north = outerHtmlByClass(html, 'gd-seatzone--north');
    expect(north).toContain('gd-plate--held');
    // East/west (seats 1 and 3) are NOT held — plain pills.
    for (const dir of ['east', 'west'] as const) {
      expect(outerHtmlByClass(html, `gd-seatzone--${dir}`)).not.toContain('gd-plate--held');
    }
    // The bottombar (the ACTIVE seat) is never a switcher.
    expect(outerHtmlByClass(html, 'gd-bottombar')).not.toContain('gd-plate--held');
  });

  it('the tab component is gone from the source, and the switcher reuses the SAME client state', () => {
    const table = stripTsComments(gameTableSrc);
    expect(table).not.toContain('SeatTabs');
    expect(table).not.toContain('gd-tabs');
    expect(table).toMatch(
      /const selectable = heldSeats\.length > 1 && heldSeats\.includes\(seat\) && seat !== activeSeat;/,
    );
    expect(table).toMatch(/onSelect=\{selectable \? \(\) => setSelectedSeat\(seat\) : undefined\}/);
    // The tabs' one non-redundant power, preserved (panel MED, Grok): a
    // viewless active seat auto-falls back to any held seat whose view has
    // already arrived — the waiting screen renders no switcher pills.
    expect(table).toMatch(/if \(view !== null \|\| activeSeat === undefined\) return;/);
    expect(table).toMatch(
      /heldSeats\.find\(\s*\(s\) => s !== activeSeat && asGuandanView\(snapshot\.perSeat\.get\(s\)\?\.view \?\? null\) !== null,?\s*\)/,
    );
    // The button shell strips its UA chrome (panel LOW, Grok).
    const css = stripCssComments(tableCss).match(/button\.gd-plate\s*\{[^}]*\}/)?.[0] ?? '';
    expect(css).toMatch(/appearance:\s*none/);
    expect(css).toMatch(/margin:\s*0/);
  });
});
