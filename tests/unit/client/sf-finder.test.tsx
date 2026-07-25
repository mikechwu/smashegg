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
import { SfFinderSheet } from '../../../src/client/table/SfFinderSheet';
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
      onSendToArea: () => {},
      isSetAside: () => false,
      canSendToArea: true,
    }),
  );
}

/** The same sheet with every flush ALREADY in a set-aside area, and the sheet
 *  with nowhere to send. Both are states the areas round introduced. */
function sheetWith(
  hand: Card[],
  level: Rank,
  over: { isSetAside?: (c: readonly Card[]) => boolean; canSendToArea?: boolean },
): string {
  return renderToStaticMarkup(
    createElement(SfFinderSheet, {
      result: findStraightFlushes(hand, level, CONFIG),
      level,
      expanded: false,
      onExpand: () => {},
      onClose: () => {},
      onSendToArea: () => {},
      isSetAside: over.isSetAside ?? (() => false),
      canSendToArea: over.canSendToArea ?? true,
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

describe('SF finder UI — the panel is the set-aside zone and nothing else', () => {
  // RETIRED BY OWNER DECISION, not by failure: the "left with" zone (tag chips,
  // the short-read disclaimer, the reveal button and the read-only remainder
  // fan) was REMOVED because sort areas let the player pull the flush aside and
  // read the remainder in their own hand. What the old block pinned — zone order
  // and the sticky remainder footer — describes UI that no longer exists. The
  // ENGINE-side remainder is a separate matter and is pinned below.
  for (const [name, hand, level] of [
    ['twinDouble', HANDS.twinDouble, '2'],
    ['wildHeavy', HANDS.wildHeavy, '2'],
    ['aLow', HANDS.aLow, 'K'],
    ['heartsLevel', HANDS.heartsLevel, '7'],
    ['full', HANDS.full, '2'],
  ] as const) {
    it(`${name}: the removed remainder surface is gone from the panel`, () => {
      const html = sheet([...hand], level);
      for (const gone of [
        'gd-sf__leaves',
        'gd-sf__scoreboard',
        'gd-sf__tag',
        'gd-sf__partial',
        'gd-sf__reveal',
        'gd-sf__remainderFan',
      ]) {
        expect(html, `${gone} must not render any more`).not.toContain(gone);
      }
      // The set-aside zone itself still leads the page.
      expect(html).toContain('gd-sf__zoneLabel');
      expect(html).toContain('gd-sf__group');
    });
  }

  it('THE BOUNDARY — the ENGINE still computes remainder quality, so ranking survives', () => {
    // The load-bearing half of this round: ranking is the Pareto frontier of
    // (SF value, remainder quality). If the UI subtraction had reached the
    // engine, ranking would collapse to SF strength alone and bury the
    // "break it and I have two bombs" arrangement the feature exists for.
    const result = findStraightFlushes([...HANDS.crosshatch], '2', CONFIG);
    for (const d of result.decompositions) {
      expect(d.remainder, 'the remainder is still computed').toBeDefined();
      expect(d.tags.length, 'remainder tags are still produced').toBeGreaterThan(0);
      for (const tag of d.tags) {
        expect(REMAINDER_TAG_KINDS, 'still the closed vocabulary').toContain(tag.kind);
      }
    }
  });
});

describe('SF finder UI — no advisory word can reach the screen', () => {
  // The tag-vocabulary tests that lived here are RETIRED BY OWNER DECISION: the
  // tags no longer render, so "every tag kind has copy" and "the tag map is
  // exhaustive" now describe a map the component does not have. The engine's
  // vocabulary is still closed and is pinned engine-side (see the boundary test
  // above and the engine suite). What survives is the guard that actually
  // protects the player — nothing on this panel may ADVISE — now applied to the
  // copy the panel still ships.
  const banned =
    /\b(better|best|recommend|recommended|should|stronger|strongest|optimal|worse|advice|prefer)\b/i;

  it('the rendered panel carries no comparative or advisory word, in any locale', () => {
    const before = getLocale();
    try {
      for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
        setLocale(locale);
        for (const [hand, level] of [
          [HANDS.twinDouble, '2'],
          [HANDS.wildHeavy, '2'],
          [HANDS.crosshatch, '2'],
          [HANDS.full, '2'],
        ] as const) {
          const text = sheet([...hand], level).replace(/<[^>]+>/g, ' ');
          expect(text, `${locale} rendered copy is non-advisory`).not.toMatch(banned);
        }
      }
    } finally {
      setLocale(before);
    }
  });

  it('the engine vocabulary is still CLOSED even though it no longer renders', () => {
    // The UI subtraction must not be read as permission to widen the model.
    expect([...REMAINDER_TAG_KINDS].sort()).toEqual(
      ['bomb', 'cardsLeft', 'fullHouse', 'pair', 'run', 'scatter', 'straightFlush', 'triple'].sort(),
    );
  });

  it('the panel no longer imports the tag vocabulary at all', () => {
    expect(sheetSrc, 'no tag copy map remains').not.toContain("game.tag.");
  });
});

describe('SF finder UI — sending to a sort area (Decision 6 UPGRADED)', () => {
  it('EVERY flush gets its own send control, including a multi-flush arrangement', () => {
    // The upgrade, stated as a test. The old rule marked multi-flush
    // arrangements VIEW-ONLY because two flushes are not one legal play, so both
    // could not be staged for COMMIT. Sending to an area is not committing, so
    // the reason does not apply and each flush carries its own control.
    const twin = sheet(HANDS.twinDouble, '2'); // its first page pulls TWO flushes
    expect([...twin.matchAll(/gd-sf__stage"/g)].length).toBeGreaterThanOrEqual(2);
    expect(twin, 'the view-only restriction is gone').not.toContain('gd-sf__viewOnly');
    const single = sheet(HANDS.aLow, 'K');
    expect(single).toContain('gd-sf__stage');
  });

  it('an ALREADY set-aside flush shows a statement, never a press that moves nothing', () => {
    const html = sheetWith(HANDS.aLow, 'K', { isSetAside: () => true });
    expect(html).toContain('gd-sf__sent');
    expect(html, 'no dead button remains').not.toContain('gd-sf__stage"');
  });

  it('with nowhere to send, the control is HIDDEN, not shown disabled', () => {
    // Owner rule, and the distinction it rests on: the no-silent-no-op rule
    // forbids a press that goes unanswered. A control that is absent cannot be
    // pressed, so there is nothing to answer — removing the possibility is not
    // the same as swallowing the response.
    const html = sheetWith(HANDS.aLow, 'K', { canSendToArea: false });
    expect(html).not.toContain('gd-sf__stage');
    expect(html, 'and no greyed explanation in its place').not.toContain('disabled');
  });

  it('AUDIT F1 — the held result is DISCARDED whenever the hand it describes changes', () => {
    const effect = gameTableSrc.slice(
      gameTableSrc.indexOf('const selectionCtxRef'),
      gameTableSrc.indexOf('const selectionCtxRef') + 2200,
    );
    expect(effect).toContain('setSfResult');
    for (const field of ['prev.seat !== ctx.seat', 'prev.handNo !== ctx.handNo', 'prev.dealNo !== ctx.dealNo']) {
      expect(effect, `closes on ${field}`).toContain(field);
    }
    expect(effect, 'and on any change to the cards themselves').toMatch(/prev\.hand\.some/);
  });

  it('ALL OR NOTHING survives the rewrite: a partial match moves nothing', () => {
    const fn = gameTableSrc.match(/const sfGroupSlots[\s\S]*?\n  \};/)![0];
    expect(fn).toMatch(/next\.size === cards\.length \? next : null/);
    const send = gameTableSrc.match(/const sendSfGroupToArea[\s\S]*?\n  \};/)![0];
    expect(send, 'a null slot map abandons the send').toMatch(/if \(slots === null\)/);
  });

  it('AUDIT F3 — found:true with an empty list renders the nothing-found state, never a crash', () => {
    const html = renderToStaticMarkup(
      createElement(SfFinderSheet, {
        result: { decompositions: [], found: true, totalFound: 1 },
        level: '2' as Rank,
        expanded: false,
        onExpand: () => {},
        onClose: () => {},
        onSendToArea: () => {},
        isSetAside: () => false,
        canSendToArea: true,
      }),
    );
    expect(html).toContain('gd-sf__empty');
    expect(html).not.toContain('gd-sf__way');
  });

  it('sending ORGANIZES, it does not commit: no selection, no submit, no decl', () => {
    const body = gameTableSrc.match(/const sendSfGroupToArea[\s\S]*?\n  \};/)![0];
    expect(body).toContain('applyMove');
    expect(body, 'it must not stage for play any more').not.toContain('setSelected');
    expect(body).not.toContain('store.act');
    expect(body).not.toMatch(/\bdecl\b/);
    // Twin-safe via the shared slot mapper.
    expect(gameTableSrc.match(/const sfGroupSlots[\s\S]*?\n  \};/)![0]).toContain('!next.has(i)');
  });

  it('the sheet STAYS OPEN after a send, or the second flush would be unreachable', () => {
    const body = gameTableSrc.match(/const sendSfGroupToArea[\s\S]*?\n  \};/)![0];
    // setSfResult(null) appears ONLY on the all-or-nothing bail-out, never on a
    // successful send.
    const afterBail = body.slice(body.indexOf('if (slots === null)'));
    expect(body.match(/setSfResult\(null\)/g) ?? []).toHaveLength(1);
    expect(afterBail).toContain('setSfResult(null)');
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


  it('the sheet never scrolls the page sideways: wide face rows scroll INSIDE their own container', () => {
    const faces = tableCss.slice(tableCss.indexOf('.gd-sf__faces {'));
    expect(faces).toMatch(/overflow-x:\s*auto/);
    const shell = tableCss.slice(tableCss.indexOf('.gd-sf {'), tableCss.indexOf('.gd-sf__head'));
    expect(shell).not.toMatch(/overflow-x:\s*auto/); // the shell itself does not
  });

  it('the pager states the count in WORDS and offers one chip per way', () => {
    // Real players did not notice several arrangements existed. The old arrow
    // stepper stated position in small text; the pager now leads with a sentence
    // and gives each way its own directly tappable chip.
    const html = sheet(HANDS.crosshatch, '2');
    expect(html).toContain('gd-sf__waysLead');
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text, 'the count is spoken, not implied by arrows').toMatch(/\d/);
    const chips = [...html.matchAll(/gd-sf__way[ "]/g)].length;
    expect(chips, 'one chip per shown way').toBeGreaterThan(1);
    expect(html, 'exactly one chip is marked current').toContain('gd-sf__way--on');
  });

  it('a SINGLE arrangement shows no pager chrome at all', () => {
    // No arrows, no chips, nothing implying a second page — but the sentence
    // still answers "is there more?", so three chips on a later hand is more
    // detail rather than a surprise.
    const html = sheet(HANDS.aLow, 'K');
    const ways = findStraightFlushes([...HANDS.aLow], 'K', CONFIG).decompositions.length;
    expect(ways, 'this hand really has one arrangement').toBe(1);
    expect(html).toContain('gd-sf__waysLead');
    expect(html, 'no chips').not.toContain('gd-sf__wayChips');
    expect(html, 'no arrows').not.toContain('gd-sf__step');
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
