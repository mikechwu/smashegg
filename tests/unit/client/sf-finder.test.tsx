// Straight-flush finder UI (docs/research/straight-flush-finder.md, owner
// Decisions 5 + 6). DOM-free per the suite's idiom: static renders + pure
// helpers + comment-stripped source/CSS pins; the moving parts are browser-gated.
//
// The hands here are deliberately NASTY — the point is to break the UI, not to
// demo it: a twin double-pull, a wild-heavy hand opening several windows, a
// crosshatch that produces more arrangements than the display cap, an A-low run,
// a hearts window through the level rank (the wild plays as ITSELF), a
// zero-flush hand, and a near-full 27-card hand in the longest locale.
//
// What is pinned:
//  • the press ALWAYS answers — zero flushes still renders a spoken result
//    (the no-silent-no-op class: sit-with-no-name, play-becomes-pass);
//  • the two zones exist in a FIXED order on every page (set-aside above
//    left-with) so stepping reads as one quantity changing in place;
//  • the remainder read is labelled a SHORT read and the real cards are one tap
//    away (Grok's UI-phase caveat — it names only the strongest structure);
//  • the tag vocabulary rendered is EXACTLY the engine's closed factual set, and
//    no advisory word can reach the screen;
//  • a multi-SF arrangement is view-only, a single SF is stageable (Decision 6);
//  • the display cap NEVER truncates silently;
//  • staging is twin-safe and non-destructive (it only populates the ordinary
//    selection, so the desk + one-tap clear keep working);
//  • no colour-only meaning, no infinite animation, tap targets are elder-sized.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { SfFinderSheet, tagText } from '../../../src/client/table/SfFinderSheet';
import {
  findStraightFlushes,
  REMAINDER_TAG_KINDS,
  SF_FINDER_PRIMARY_SHOWN,
  type RemainderTagKind,
} from '../../../src/engine/guandan/straight-flush-finder';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { Card, Rank } from '../../../src/engine/guandan/cards';
import { getLocale, setLocale } from '../../../src/client/i18n';

const read = (rel: string) => readFileSync(join(__dirname, '../../../', rel), 'utf8');
const stripTs = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const stripCss = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '');
const sheetSrc = stripTs(read('src/client/table/SfFinderSheet.tsx'));
const gameTableSrc = stripTs(read('src/client/GameTable.tsx'));
const tableCss = stripCss(read('src/client/table/table.css'));

const CONFIG = JIANGSU_OFFICIAL_ONLINE;

function sheet(hand: Card[], level: Rank, expanded = false): string {
  return renderToStaticMarkup(
    createElement(SfFinderSheet, {
      result: findStraightFlushes(hand, level, CONFIG),
      level,
      expanded,
      onExpand: () => {},
      onClose: () => {},
      onStage: () => {},
    }),
  );
}

// --- the nasty hands ------------------------------------------------------
const HANDS = {
  /** Nothing to find — the COMMON case (most hands hold 0-1 flushes). */
  none: ['2S', '5D', '8C', 'JH', 'AS', '3D', '9C'] as Card[],
  /** Two IDENTICAL top-9 spade flushes from twins; remainder empty. */
  twinDouble: ['5S', '5S', '6S', '6S', '7S', '7S', '8S', '8S', '9S', '9S'] as Card[],
  /** Two wilds opening several windows at once. */
  wildHeavy: ['5S', '6S', '7S', '2H', '2H', 'AC', 'AD', 'KC', 'KD'] as Card[],
  /** A-low: the boundary window (A,2,3,4,5). */
  aLow: ['AS', '2S', '3S', '4S', '5S', 'TD', '9C', '9H'] as Card[],
  /** Hearts window THROUGH the level rank — the wild plays as ITSELF. */
  heartsLevel: ['5H', '6H', '8H', '9H', '7H', '2C', 'KD', 'KC'] as Card[],
  /** More arrangements than the display cap can show. */
  crosshatch: [
    '5S','6S','7S','8S','9S','5C','6C','7C','8C','9C','5D','6D','7D','8D','9D',
  ] as Card[],
  /** A near-full 27-card hand — the real shipping size. */
  full: [
    '5S','6S','7S','8S','9S','TS','JS','QS','KS','AS','2H','2H','3C','4C','5C',
    '6C','7D','8D','9D','TD','JH','QH','KH','AH','SJ','BJ','2C',
  ] as Card[],
};

describe('SF finder UI — the press always answers', () => {
  it('a hand with NO straight flush still renders a spoken result, not an empty panel', () => {
    const html = sheet(HANDS.none, '2');
    expect(html).toContain('gd-sf__empty');
    expect(html).toContain('role="status"'); // announced, not silent
    expect(html).toContain('Looked'); // the "we looked" sentence, not blankness
    // No stepper / no arrangement chrome when there is nothing to step through.
    expect(html).not.toContain('gd-sf__stepper');
    expect(html).not.toContain('gd-sf__scoreboard');
  });

  it('the trigger button is NOT hidden when the hand has no flush (a button that only appears when it would succeed reads as flaky)', () => {
    // The gate is the settled hand, never "found something".
    const trigger = gameTableSrc.match(/gd-sfOpen[\s\S]{0,400}?<\/button>/);
    expect(trigger, 'the trigger renders').not.toBeNull();
    expect(trigger![0]).not.toMatch(/found/i);
    expect(gameTableSrc).toMatch(/!holdFan && !dealing && settled[\s\S]{0,200}gd-sfOpen/);
  });
});

describe('SF finder UI — the two zones are fixed and in order', () => {
  for (const [name, hand, level] of [
    ['twinDouble', HANDS.twinDouble, '2'],
    ['wildHeavy', HANDS.wildHeavy, '2'],
    ['aLow', HANDS.aLow, 'K'],
    ['heartsLevel', HANDS.heartsLevel, '7'],
    ['full', HANDS.full, '2'],
  ] as const) {
    it(`${name}: set-aside zone comes BEFORE the left-with zone, both present`, () => {
      const html = sheet([...hand], level);
      const labels = [...html.matchAll(/gd-sf__zoneLabel">([^<]*)</g)].map((m) => m[1]);
      expect(labels.length, 'both zone labels render').toBeGreaterThanOrEqual(2);
      // The scoreboard always follows the faces — the fixed reading order.
      expect(html.indexOf('gd-sf__group')).toBeLessThan(html.indexOf('gd-sf__scoreboard'));
      // The remainder block is always present and STICKY, so its screen position
      // does not move with the number of flush rows above it.
      expect(html).toContain('gd-sf__leaves');
      const result = findStraightFlushes([...hand], level, CONFIG);
      const empty = result.decompositions[0]!.remainder.length === 0;
      if (empty) {
        // Nothing left to reveal — offering the press would open nothing.
        expect(html).not.toContain('gd-sf__reveal');
      } else {
        // Flagged as a SHORT read, with the real cards one tap away (Grok's
        // caveat: only the strongest structure is named).
        expect(html).toContain('gd-sf__partial');
        expect(html).toContain('gd-sf__reveal');
      }
    });
  }
});

describe('SF finder UI — the vocabulary that reaches the screen is closed and factual', () => {
  it('every tag kind renders a real localized phrase in all three locales', () => {
    const before = getLocale();
    try {
      for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
        setLocale(locale);
        for (const kind of REMAINDER_TAG_KINDS) {
          const text = tagText({ kind, count: 2 });
          expect(text.length, `${locale}/${kind} has copy`).toBeGreaterThan(0);
          expect(text, `${locale}/${kind} is not a raw key`).not.toContain('game.tag.');
          expect(text, `${locale}/${kind} has no unresolved placeholder`).not.toContain('{');
        }
      }
    } finally {
      setLocale(before);
    }
  });

  it('no advisory or comparative word can reach the screen', () => {
    const before = getLocale();
    const banned = /\b(better|best|recommend|recommended|should|stronger|strongest|optimal|worse|advice|prefer)\b/i;
    try {
      for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
        setLocale(locale);
        for (const kind of REMAINDER_TAG_KINDS) {
          expect(tagText({ kind, count: 2 }), `${locale}/${kind}`).not.toMatch(banned);
        }
        for (const [hand, level] of [
          [HANDS.twinDouble, '2'],
          [HANDS.wildHeavy, '2'],
          [HANDS.full, '2'],
        ] as const) {
          const html = sheet([...hand], level);
          const text = html.replace(/<[^>]+>/g, ' ');
          expect(text, `${locale} rendered copy is non-advisory`).not.toMatch(banned);
        }
      }
    } finally {
      setLocale(before);
    }
  });

  it('the tag map is EXHAUSTIVE over the engine vocabulary — a new kind is a compile error, and none is missing at runtime', () => {
    // Structural: the map is typed Record<RemainderTag['kind'], TranslationKey>,
    // so adding an engine kind without copy fails typecheck. Runtime belt:
    for (const kind of REMAINDER_TAG_KINDS) {
      expect(sheetSrc, `${kind} has a copy entry`).toContain(`${kind}: 'game.tag.`);
    }
    const mapped = [...sheetSrc.matchAll(/^\s{2}(\w+): 'game\.tag\./gm)].map((m) => m[1]);
    expect(mapped.sort()).toEqual([...(REMAINDER_TAG_KINDS as readonly RemainderTagKind[])].sort());
  });
});

describe('SF finder UI — staging (owner Decision 6)', () => {
  it('a SINGLE-flush arrangement offers "pick this", a MULTI-flush arrangement is marked view-only', () => {
    const twin = sheet(HANDS.twinDouble, '2'); // its first page pulls TWO flushes
    expect(twin).toContain('gd-sf__viewOnly');
    const single = sheet(HANDS.aLow, 'K'); // one flush only
    expect(single).not.toContain('gd-sf__viewOnly');
    expect(single).toContain('gd-sf__stage');
  });

  it('every flush row is INDEPENDENTLY stageable, including inside a multi-flush arrangement', () => {
    const twin = sheet(HANDS.twinDouble, '2');
    const stageButtons = [...twin.matchAll(/gd-sf__stage"/g)].length;
    expect(stageButtons, 'one stage button per flush row').toBeGreaterThanOrEqual(2);
  });

  it('AUDIT F1 — the held result is DISCARDED whenever the hand it describes changes', () => {
    // A stale sheet describes cards the player may no longer hold; staging it
    // would match those IDENTITIES against the NEW hand and lift the WRONG cards
    // (seat switch, fresh deal, a play/tribute leaving). The sheet is closed by
    // the SAME context comparison the selection reconciliation uses, so the two
    // can never disagree about what "this hand" means.
    const effect = gameTableSrc.slice(
      gameTableSrc.indexOf('const selectionCtxRef'),
      gameTableSrc.indexOf('const selectionCtxRef') + 1800,
    );
    expect(effect).toContain('setSfResult');
    for (const field of ['prev.seat !== ctx.seat', 'prev.handNo !== ctx.handNo', 'prev.dealNo !== ctx.dealNo']) {
      expect(effect, `closes on ${field}`).toContain(field);
    }
    expect(effect, 'and on any change to the cards themselves').toMatch(/prev\.hand\.some/);
  });

  it('AUDIT F2 — staging is ALL OR NOTHING: a partial match commits nothing', () => {
    // A card no longer in hand used to be skipped and the partial selection
    // committed — pressing "put in the play area" would silently stage four of
    // five cards, which is worse than doing nothing.
    const fn = gameTableSrc.match(/const stageSfGroup[\s\S]*?\n  \};/)![0];
    expect(fn).toMatch(/if \(next\.size !== cards\.length\)/);
    // The bail-out returns BEFORE the selection is written.
    expect(fn.indexOf('next.size !== cards.length')).toBeLessThan(fn.indexOf('setSelected(next)'));
  });

  it('AUDIT F3 — found:true with an empty list renders the nothing-found state, never a crash', () => {
    const html = renderToStaticMarkup(
      createElement(SfFinderSheet, {
        result: { decompositions: [], found: true, totalFound: 1 },
        level: '2' as Rank,
        expanded: false,
        onExpand: () => {},
        onClose: () => {},
        onStage: () => {},
      }),
    );
    expect(html).toContain('gd-sf__empty');
    expect(html).not.toContain('gd-sf__stepper');
  });

  it('staging is NON-DESTRUCTIVE and twin-safe: it only populates the ordinary selection set', () => {
    const fn = gameTableSrc.match(/const stageSfGroup[\s\S]*?\n  \};/);
    expect(fn, 'stageSfGroup exists').not.toBeNull();
    const body = fn![0];
    // Twin-safe: first UNCLAIMED matching slot (the remapSelectionByIdentity idiom).
    expect(body).toContain('!next.has(i)');
    // It sets the ordinary selection — nothing is submitted, no decl is sent.
    expect(body).toContain('setSelected(next)');
    expect(body).not.toContain('store.act');
    expect(body).not.toMatch(/\bdecl\b/);
  });
});

describe('SF finder UI — the display cap never truncates silently', () => {
  it('a hand with more arrangements than the primary cap says so and offers the rest', () => {
    const result = findStraightFlushes(HANDS.crosshatch, '2', CONFIG);
    expect(result.decompositions.length, 'this hand overflows the primary cap').toBeGreaterThan(
      SF_FINDER_PRIMARY_SHOWN,
    );
    const html = sheet(HANDS.crosshatch, '2');
    expect(html).toContain('gd-sf__more'); // the honest count line
    expect(html).toContain('gd-sf__expand'); // and a way to see the rest
  });

  it('the header states how many ways exist, so alternatives are never invisible', () => {
    const html = sheet(HANDS.crosshatch, '2');
    expect(html).toContain('gd-sf__count');
    const result = findStraightFlushes(HANDS.crosshatch, '2', CONFIG);
    expect(html).toContain(String(result.totalFound));
  });

  it('VISUAL-QA REGRESSION — the "showing N of M" line quotes the SAME total as the header', () => {
    // Quoting the engine's internal return cap put THREE numbers on screen at
    // once (header "7 ways", line "of 6", stepper "of 4") — broken arithmetic
    // from the player's side.
    const src = read('src/client/table/SfFinderSheet.tsx');
    expect(src).toMatch(/moreExist',\s*\{\s*shown:[^}]*total:\s*result\.totalFound/);
    expect(src).not.toMatch(/moreExist[\s\S]{0,120}result\.decompositions\.length/);
  });

  it('VISUAL-QA REGRESSION — the "showing N of M" line sits under the stepper, not below the fold', () => {
    const html = sheet(HANDS.crosshatch, '2');
    expect(html.indexOf('gd-sf__moreRow')).toBeLessThan(html.indexOf('gd-sf__page'));
  });

  it('expanded mode shows every frontier row the engine returned (bounded by the engine cap)', () => {
    const html = sheet(HANDS.crosshatch, '2', true);
    expect(html).not.toContain('gd-sf__expand');
    const result = findStraightFlushes(HANDS.crosshatch, '2', CONFIG);
    // The engine returns the WHOLE frontier, so "show more" can really show all.
    expect(result.totalFound).toBe(result.decompositions.length);
  });
});

describe('SF finder UI — wilds read as the card they stand for', () => {
  it('a wild-completed flush renders a GHOST face for the substituted identity, never a bare wild', () => {
    // 5S6S7S8S + wild with NO natural 9S/4S in hand: every arrangement must spend
    // the wild on a substituted identity, so the first page is guaranteed to show
    // a ghost (the wild drawn as the card it stands for — the chooser's own
    // convention, so the player meets ONE idiom in both places).
    const hand: Card[] = ['5S', '6S', '7S', '8S', '2H', 'KC', 'QD'];
    const result = findStraightFlushes(hand, '2', CONFIG);
    expect(result.decompositions[0]!.groups[0]!.wildsUsed).toBe(1);
    const html = sheet(hand, '2');
    expect(html).toContain('gd-card--ghost');
  });

  it('the hearts-through-level window shows the wild as ITSELF (it is played as its own card)', () => {
    // level 7 => the wild is 7H and it fills its own 7H slot: a real face.
    const result = findStraightFlushes(HANDS.heartsLevel, '7', CONFIG);
    expect(result.found).toBe(true);
    const group = result.decompositions.flatMap((d) => d.groups).find((g) => g.suit === 'H');
    expect(group?.wildsUsed).toBe(1);
    const html = sheet(HANDS.heartsLevel, '7');
    expect(html).toContain('gd-sf__faces');
  });

  it('the end-position pair is ONE row carrying both tops, never two arrangements', () => {
    // 5S6S7S8S + wild reads as top-9 or top-8: same five cards, same remainder.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '2H', 'KC', 'QD'];
    const result = findStraightFlushes(hand, '2', CONFIG);
    const group = result.decompositions.flatMap((d) => d.groups).find((g) => g.cards.includes('2H'));
    expect(group!.forms.length, 'both tops on ONE group').toBeGreaterThan(1);
    const html = sheet(hand, '2');
    expect(html).toContain('gd-sf__alt'); // shown as a footnote on the same row
  });
});

describe('SF finder UI — elder/mobile non-negotiables', () => {
  it('no colour-only meaning: the loud tags also carry WEIGHT', () => {
    const block = tableCss.slice(tableCss.indexOf('.gd-sf__tag--bomb'));
    expect(block).toMatch(/font-weight:\s*var\(--weight-bold\)/);
  });

  it('no infinite animation anywhere in the finder CSS (the no-blink rule)', () => {
    const sf = tableCss.split('\n').filter((l) => l.includes('gd-sf')).join('\n');
    expect(sf).not.toMatch(/infinite/);
    expect(sf).not.toMatch(/animation:/);
  });

  it('VISUAL-QA REGRESSION — EVERY press in the sheet is at least 44px tall (elder tap targets)', () => {
    // Caught at true 390px in the browser, not by any unit test: close was 28px,
    // "pick this" 40px, "see the cards" 36px. WCAG 2.5.5 / elder finger precision
    // wants >= 44px, and the stepper already had it — the rest now match.
    for (const selector of [
      '.gd-sf__step {',
      '.gd-sf__close {',
      '.gd-sf__stage {',
      '.gd-sf__reveal {',
      '.gd-sf__expand {',
    ]) {
      const block = tableCss.slice(tableCss.indexOf(selector));
      const decl = block.slice(0, block.indexOf('}'));
      expect(decl, `${selector} is elder-sized`).toMatch(/min-height:\s*2\.75rem/);
    }
    const step = tableCss.slice(tableCss.indexOf('.gd-sf__step {'));
    expect(step).toMatch(/min-width:\s*2\.75rem/);
  });

  it('VISUAL-QA REGRESSION — the sheet can never be wider than the viewport (100vw counts the scrollbar)', () => {
    // At a true 390px viewport `width: min(26rem, 100vw)` overflowed by the
    // scrollbar width and the sheet CLIPPED ITS OWN LEFT EDGE (the title and the
    // zone labels lost their first glyph). Insetting to 0 with auto margins
    // cannot exceed the available width.
    const shell = tableCss.slice(tableCss.indexOf('.gd-sf {'), tableCss.indexOf('.gd-sf__head'));
    expect(shell).toMatch(/inset-inline:\s*0/);
    expect(shell).toMatch(/margin-inline:\s*auto/);
    expect(shell).toMatch(/max-width:\s*26rem/);
    expect(shell, 'no 100vw width — it includes the scrollbar').not.toMatch(/width:\s*min\([^)]*vw/);
    expect(shell, 'no translateX centring, which cannot clamp').not.toMatch(/translateX/);
  });

  it('VISUAL-QA REGRESSION — the remainder block is STICKY, so its position never moves with the flush count', () => {
    // A four-suit crosshatch stacks THREE flush rows and pushed the scoreboard
    // below the fold, so its screen position depended on the arrangement — which
    // destroys the promise that stepping moves one quantity in the same place.
    const block = tableCss.slice(tableCss.indexOf('.gd-sf__leaves {'));
    const decl = block.slice(0, block.indexOf('}'));
    expect(decl).toMatch(/position:\s*sticky/);
    expect(decl).toMatch(/bottom:\s*0/);
    expect(decl, 'an opaque ground so scrolling faces do not bleed through').toMatch(/background:/);
  });

  it('VISUAL-QA REGRESSION — an EMPTY remainder offers no "see the cards" press', () => {
    const html = sheet(HANDS.twinDouble, '2'); // both flushes pulled, nothing left
    expect(html).toContain('gd-sf__scoreboard'); // it still says "0 left"
    expect(html).not.toContain('gd-sf__reveal'); // but nothing to open
  });

  it('the staging button is SECONDARY — cinnabar stays reserved for the real play', () => {
    // Three solid-red CTAs stacked in a helper sheet out-shouted the table's own
    // Play button (visual QA). The finder only moves cards to the play area.
    const block = tableCss.slice(tableCss.indexOf('.gd-sf__stage {'));
    const decl = block.slice(0, block.indexOf('}'));
    expect(decl).toMatch(/background:\s*transparent/);
    expect(decl).toMatch(/border:\s*1px solid var\(--cinnabar\)/);
  });

  it('OWNER — the panel frame is CONSTANT across ways: its top edge must not move when stepping', () => {
    // The sheet is bottom-anchored, so a content-sized height made a 2-flush way
    // TALLER and a 1-flush way SHORTER — the whole panel, header and stepper
    // included, jumped as the player paged.
    const paged = tableCss.slice(tableCss.indexOf('.gd-sf--paged {'));
    expect(paged.slice(0, paged.indexOf('}'))).toMatch(/height:\s*min\(/);
    // Every paged state carries the modifier...
    const oneFlush = sheet(HANDS.aLow, 'K');
    const twoFlush = sheet(HANDS.twinDouble, '2');
    const many = sheet(HANDS.crosshatch, '2');
    for (const html of [oneFlush, twoFlush, many]) {
      expect(html).toContain('gd-sf gd-sf--paged');
    }
    // ...and the empty state does NOT (a tall frame with nothing to page is a hole).
    expect(sheet(HANDS.none, '2')).not.toContain('gd-sf--paged');
  });

  it('OWNER — the remainder is drawn by the HAND FAN itself, so it reads exactly like the hand', () => {
    // A wrapped grid of loose cards was a second card layout to learn. The
    // remainder now reuses HandFan (read-only), inheriting the same-value column
    // grouping and overlap the player already reads their own hand with.
    expect(sheetSrc).toContain('<HandFan');
    expect(sheetSrc).toContain('readOnly');
    // It is a PICTURE, not a control: no press target that would do nothing —
    // and that holds in BOTH layout branches (pre-deploy audit LOW: honouring
    // readOnly only in the settled branch left a future readOnly+dealing caller
    // with press targets back).
    const fan = stripTs(read('src/client/table/HandFan.tsx'));
    expect([...fan.matchAll(/readOnly \?/g)].length, 'both branches honour readOnly').toBe(2);
    expect([...fan.matchAll(/role="img"/g)].length).toBe(2);
    // "No selection affordance" must also mean it PAINTS none, even if a caller
    // hands it non-empty sets (pre-deploy audit: the contract was half-true).
    expect([...fan.matchAll(/!readOnly && isSelected/g)].length).toBe(2);
    expect([...fan.matchAll(/!readOnly && glow\.has/g)].length).toBe(2);
    // And it is sorted like the hand, so the order matches too.
    expect(sheetSrc).toMatch(/sortCards\(decomposition\.remainder, level\)/);
  });

  it('the sheet never scrolls the page sideways: wide face rows scroll INSIDE their own container', () => {
    const faces = tableCss.slice(tableCss.indexOf('.gd-sf__faces {'));
    expect(faces).toMatch(/overflow-x:\s*auto/);
    const shell = tableCss.slice(tableCss.indexOf('.gd-sf {'), tableCss.indexOf('.gd-sf__head'));
    expect(shell).not.toMatch(/overflow-x:\s*auto/); // the shell itself does not
  });

  it('the position is stated in WORDS, not arrows alone', () => {
    const html = sheet(HANDS.crosshatch, '2');
    expect(html).toContain('gd-sf__position');
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text).toMatch(/\d/); // a spoken "1 of N"
  });

  it('renders in zh-Hant (the default locale, longest glyphs) without unresolved keys', () => {
    const before = getLocale();
    try {
      setLocale('zh-Hant');
      const html = sheet(HANDS.full, '2');
      expect(html).not.toContain('game.sf.');
      expect(html).not.toContain('game.tag.');
      expect(html).not.toContain('{count}');
    } finally {
      setLocale(before);
    }
  });
});

describe('SF finder UI — the finder is never on the render path', () => {
  it('GameTable calls findStraightFlushes ONLY in the open handler, and holds the result', () => {
    const calls = [...gameTableSrc.matchAll(/findStraightFlushes\(/g)].length;
    expect(calls, 'exactly one call site').toBe(1);
    // It lives in the press handler, not a useMemo/useEffect/render expression.
    expect(gameTableSrc).toMatch(/const openSfFinder = \(\) => \{[\s\S]{0,200}findStraightFlushes\(/);
    expect(gameTableSrc).not.toMatch(/useMemo\([^)]*findStraightFlushes/);
  });

  it('the sheet renders from the HELD result — it never recomputes while open', () => {
    expect(sheetSrc).not.toContain('findStraightFlushes');
  });
});
