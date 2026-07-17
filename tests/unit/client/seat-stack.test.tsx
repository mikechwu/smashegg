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
import { SeatStack, type SeatStackDir } from '../../../src/client/table/SeatStack';
import { SeatPlate, type SeatPlateProps } from '../../../src/client/table/SeatPlate';
import { GameTable } from '../../../src/client/GameTable';
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
 *  tests override what they exercise (cardCount for the chip, dealing for
 *  the deal-time suppression). */
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
      passed: false,
      committed: false,
      ...over,
    }),
  );
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
// T2 — the count chip lives IN the pill (refinement item 5): unit as visible
// text, tier classes flipping exactly at the handSizeTier boundaries, the
// "—" chip for hidden counts, and NO chip at all when cardCount is omitted
// (the viewer's own pill, finished seats).
// ---------------------------------------------------------------------------

describe('SeatPlate count chip: unit + tier escalation (T2)', () => {
  it('the visible chip text is t(game.stack.cards) — unit present in en ("27 cards") and zh-Hant ("27 張")', () => {
    const original = getLocale();
    try {
      setLocale('en');
      expect(renderPlate({ cardCount: 27 })).toContain('27 cards');
      setLocale('zh-Hant');
      expect(renderPlate({ cardCount: 27 })).toContain('27 張');
    } finally {
      setLocale(original);
    }
  });

  it('low flips exactly at 11→10 (11 normal, 10 low, neither critical)', () => {
    const at11 = renderPlate({ cardCount: 11 });
    expect(at11).not.toContain('gd-plate__count--low');
    expect(at11).not.toContain('gd-plate__count--critical');
    const at10 = renderPlate({ cardCount: 10 });
    expect(at10).toContain('gd-plate__count--low');
    expect(at10).not.toContain('gd-plate__count--critical');
  });

  it('critical flips exactly at 3→2, and the critical aria reuses game.plate.cardsLow', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const at3 = renderPlate({ cardCount: 3 });
      expect(at3).toContain('gd-plate__count--low');
      expect(at3).not.toContain('gd-plate__count--critical');
      const at2 = renderPlate({ cardCount: 2 });
      expect(at2).toContain('gd-plate__count--critical');
      expect(at2).toContain(`aria-label="${t('game.plate.cardsLow', { count: 2 })}"`);
      // The non-critical chip carries NO aria override — its visible text
      // (unit included) is the accessible name.
      expect(at3).not.toContain(t('game.plate.cardsLow', { count: 3 }));
    } finally {
      setLocale(original);
    }
  });

  it('cardCount null renders the "—" chip with the hiddenCount aria; omitted renders no chip at all', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const hidden = renderPlate({ cardCount: null });
      expect(hidden).toContain('gd-plate__count--hidden');
      expect(hidden).toContain('—');
      expect(hidden).toContain(`aria-label="${t('game.plate.hiddenCount')}"`);
      const bare = renderPlate();
      expect(bare).not.toContain('gd-plate__count');
    } finally {
      setLocale(original);
    }
  });

  it('dealing suppresses tier escalation — the chip must not swell/recolor while counting up', () => {
    // Undealt, 2 cards IS critical (pinned above); mid-deal the same count is
    // just deal progress.
    const html = renderPlate({ cardCount: 2, dealing: true });
    expect(html).toContain('gd-plate__count');
    expect(html).not.toContain('gd-plate__count--low');
    expect(html).not.toContain('gd-plate__count--critical');
  });

  it('the pill carries NO countdown and no planning note (item 6: timing lives on the headline)', () => {
    const html = renderPlate({ cardCount: 27, active: true });
    expect(html).not.toContain('gd-plate__timer');
    expect(html).not.toContain('gd-plate__timerNote');
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

describe('seat-zone structure: pill (with count chip) lapping the stack (T3)', () => {
  it('each remote zone renders the count chip INSIDE the pill, the stack beside it, and the --stacked lap modifier', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));

    for (const dir of ['north', 'east', 'west'] as const) {
      const zone = outerHtmlByClass(html, `gd-seatzone--${dir}`);
      const plate = outerHtmlByClass(zone, 'gd-plate');
      expect(plate, `${dir}: pill carries the count chip (item 5)`).toContain('gd-plate__count');
      expect(plate, `${dir}: pill must not contain the stack`).not.toContain('gd-seatstack');
      expect(zone, `${dir}: zone carries the direction-modified stack`).toContain(
        `gd-seatstack--${dir}`,
      );
      // The lap: a zone WITH a card block advertises it, so the pill goes
      // absolute over the block's outer edge instead of costing a layout row.
      expect(zone, `${dir}: zone advertises the lap`).toContain('gd-seatzone--stacked');
      // R2 end to end: the settled 27-card seat shows exactly 27 real backs.
      expect(backCount(zone), `${dir}: 1:1 backs`).toBe(27);
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
    expect(bottombar).not.toContain('gd-plate__count');
  });

  it('the pill-lap CSS: the zone is the anchor, the stacked pill sits absolute above a z-sealed stack', () => {
    const stripped = stripCssComments(tableCss);
    expect(stripped).toMatch(/\.gd-seatzone\s*\{[^}]*position:\s*relative/);
    expect(stripped).toMatch(/\.gd-seatzone--stacked > \.gd-plate\s*\{[^}]*position:\s*absolute/);
    expect(stripped).toMatch(/\.gd-seatzone--stacked > \.gd-plate\s*\{[^}]*z-index:\s*1/);
    // The stack's explicit z-index: 0 both layers it under the pill and makes
    // it a stacking context, sealing the per-slot row z-indexes inside.
    expect(stripped).toMatch(/\.gd-seatzone--stacked > \.gd-seatstack\s*\{[^}]*z-index:\s*0/);
    // Regression pin (zh-Hant 390 live find): an absolute pill's shrink-to-fit
    // width is CAPPED at its containing block — the zone, i.e. the card block
    // — so a partner-tagged name squeezed and ellipsized ("阿…") the moment
    // the head row outran the block. The lapping pill must size to its OWN
    // content (the max-width caps still apply; the overhang rides empty felt).
    expect(stripped).toMatch(/\.gd-seatzone--stacked > \.gd-plate\s*\{[^}]*width:\s*max-content/);
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
    // row flip is the zone seal (.gd-seatzone--stacked > .gd-seatstack's
    // z-index: 0, which layers the whole block under the lapping pill and
    // contains the slot z-indexes — T3 pins it). WITHIN a row, DOM order
    // (arrival order) still decides — the newest card lands on top (R10).
    const others = stackRules.filter((r) => r !== slotRule && r.includes('z-index'));
    expect(others).toHaveLength(1);
    // (The scan clips the selector at its .gd-seatstack token, so only the
    // body is visible here; T3 pins the full .gd-seatzone--stacked selector.)
    expect(others[0]).toMatch(/^\.gd-seatstack\s*\{\s*z-index:\s*0;\s*\}$/);
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
      // The chip (in the pill since item 5) renders from frame one — its later
      // appearance would jitter the pill mid-deal — and counts up from zero,
      // tier escalation suppressed (T2 pins the suppression boundary).
      expect(renderPlate({ cardCount: 0, dealing: true })).toContain('0 cards');
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
