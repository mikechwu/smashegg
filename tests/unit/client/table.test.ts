// Table-UI pure helper tests (M3): selection→hint matching (the ActionBar
// enabling rule), card grouping for the fan, tribute hint extraction and
// small seat/deadline projections. No DOM, no React — helpers.ts is a
// plain module over engine types.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrickWell } from '../../../src/client/table/TrickWell';
import { sortCards, type Card, type Rank } from '../../../src/engine/guandan/cards';
import type { CanonicalForm, GuandanAction, GuandanEvent, GuandanView } from '../../../src/engine/guandan/types';
import { GuandanGame, JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan';
import {
  activeSeats,
  asGuandanView,
  canPass,
  comboKey,
  declJokerRank,
  declRunText,
  declSignature,
  handRows,
  concealedLeader,
  isCeremonyShowing,
  matchSelection,
  multisetKey,
  placeOf,
  rankKey,
  remainingSeconds,
  sameMultiset,
  seatLayout,
  tributeEligibleCards,
  tributeKind,
} from '../../../src/client/table/helpers';
import { comboRankLabel } from '../../../src/client/table/CardFace';
import { EMPTY_DERIVED, foldEvents, GameTable } from '../../../src/client/GameTable';
import { EventFeed, FEED_LIMIT, resolveFeedParams, type FeedLine } from '../../../src/client/table/EventFeed';
import { RoomStore, type RoomSnapshot } from '../../../src/client/room/store';
import { getLocale, setLocale, t } from '../../../src/client/i18n';

function play(cards: Card[], decl: CanonicalForm): GuandanAction {
  return { type: 'play', cards, decl };
}

const PASS: GuandanAction = { type: 'pass' };

describe('multiset & rank keys', () => {
  it('multisetKey is order-insensitive', () => {
    expect(multisetKey(['9S', '9C'])).toBe(multisetKey(['9C', '9S']));
    expect(sameMultiset(['9S', '9C'], ['9C', '9S'])).toBe(true);
    expect(sameMultiset(['9S', '9C'], ['9S', '9D'])).toBe(false);
  });

  it('rankKey collapses suits but keeps jokers and wilds distinct', () => {
    expect(rankKey(['9S', '9C'], '2')).toBe(rankKey(['9H', '9D'], '2'));
    // At level 9 the ♥9 is the wild — NOT interchangeable with a natural 9.
    expect(rankKey(['9S', '9C'], '9')).not.toBe(rankKey(['9S', '9H'], '9'));
    expect(rankKey(['SJ'], '2')).not.toBe(rankKey(['AS'], '2'));
  });
});

describe('matchSelection (selection → hint matching)', () => {
  const pairOf9: CanonicalForm = { type: 'pair', size: 2, keyRank: '9' };

  it('empty selection never matches', () => {
    expect(matchSelection([], [play(['9S', '9C'], pairOf9)], '2')).toEqual([]);
  });

  it('matches an exact card multiset and returns the hint decl with the selection cards', () => {
    const matches = matchSelection(['9C', '9S'], [play(['9S', '9C'], pairOf9), PASS], '2');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.decl).toEqual(pairOf9);
    expect(matches[0]!.cards.sort()).toEqual(['9C', '9S']);
  });

  it('matches a rank-equivalent realization (obligation 4: any two of three 9s ARE the pair)', () => {
    // Hint materialized 9S+9C; the player tapped 9H+9D instead.
    const matches = matchSelection(['9H', '9D'], [play(['9S', '9C'], pairOf9)], '2');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.cards).toEqual(['9H', '9D']);
    expect(matches[0]!.decl).toEqual(pairOf9);
  });

  it('matches a suit-equivalent single (hint 4♠, selection 4♦)', () => {
    const single4: CanonicalForm = { type: 'single', size: 1, keyRank: '4' };
    const matches = matchSelection(['4D'], [play(['4S'], single4), PASS], '2');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.cards).toEqual(['4D']);
    expect(matches[0]!.decl).toEqual(single4);
  });

  it('matches a suit-equivalent pair (hint 9♠9♥, selection 9♥9♦)', () => {
    const matches = matchSelection(['9H', '9D'], [play(['9S', '9H'], pairOf9)], '2');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.cards).toEqual(['9H', '9D']);
    expect(matches[0]!.decl).toEqual(pairOf9);
  });

  it('does not match a different multiset (negative case)', () => {
    expect(matchSelection(['9S', '8S'], [play(['9S', '9C'], pairOf9)], '2')).toEqual([]);
    // A single of a different rank never matches a hinted single either:
    // the reading surfaces (full offered set) but is NOT playable.
    const single4: CanonicalForm = { type: 'single', size: 1, keyRank: '4' };
    const readings = matchSelection(['5D'], [play(['4S'], single4)], '2');
    expect(readings).toHaveLength(1);
    expect(readings[0]!.decl).toEqual({ type: 'single', size: 1, keyRank: '5' });
    expect(readings.some((m) => m.playable)).toBe(false);
  });

  it('accepts a wild-substituted realization of a hinted form', () => {
    // The generator emits ONE wild-frugal realization per form; a player
    // spending the ♥level wild on the same form is still that form — the
    // engine's validatePlay accepts natural+wild as the pair of 9s. (This
    // exact gap made Play refuse legal wild plays in production.)
    const matches = matchSelection(['9S', '2H'], [play(['9S', '9C'], pairOf9)], '2');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.cards).toEqual(['9S', '2H']);
    expect(matches[0]!.decl).toEqual(pairOf9);
    // A bare wild IS the level single (§4.2), even when the hint's
    // realization used a natural copy.
    const levelSingle: CanonicalForm = { type: 'single', size: 1, keyRank: '2' };
    expect(matchSelection(['2H'], [play(['2S'], levelSingle)], '2')).toHaveLength(1);
  });

  it('never lets a wild under-declare as another rank (negative case)', () => {
    // ♥2 at level 2 is the level single, not a single of 9s — the ONLY
    // reading offered is the level single (§4.2), and it is not playable
    // against a hinted single of 9s.
    const single9: CanonicalForm = { type: 'single', size: 1, keyRank: '9' };
    const readings = matchSelection(['2H'], [play(['9S'], single9)], '2');
    expect(readings.map((m) => m.decl)).toEqual([{ type: 'single', size: 1, keyRank: '2' }]);
    expect(readings.some((m) => m.playable)).toBe(false);
  });

  it('dedupes hints that share a decl and reports each distinct decl once', () => {
    const dup = [play(['9S', '9C'], pairOf9), play(['9D', '9H'], pairOf9)];
    expect(matchSelection(['9S', '9C'], dup, '2')).toHaveLength(1);
  });

  it('surfaces the wild-ambiguity case as multiple matches (one per decl)', () => {
    // Same concrete cards admit two declared forms — the UI must offer a
    // chooser (spec §4.4.4). Fabricated but shape-faithful hints.
    const cards: Card[] = ['8S', '8C', '8D', '9H', '9H'];
    const asBomb: CanonicalForm = { type: 'bomb', size: 5, keyRank: '8' };
    const asFullHouse: CanonicalForm = { type: 'fullHouse', size: 5, keyRank: '8' };
    const matches = matchSelection(cards, [play(cards, asBomb), play(cards, asFullHouse)], '9');
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((m) => declSignature(m.decl))).size).toBe(2);
  });

  it('returns the FULL offered set strongest-first with playability flags (v1.4 chooser input)', () => {
    // Selection {4♠4♦5♠5♦+W+W} at level 2 offers tube-6, plate-5, tube-5
    // (strength order, R5: key desc, plate above tube at an equal key).
    // Following a tube-4, only the tubes beat — the plate reading stays
    // listed but unplayable (the server remains the arbiter).
    const cards: Card[] = ['4S', '4D', '5S', '5D', '2H', '2H'];
    const tube6: CanonicalForm = { type: 'tube', size: 6, keyRank: '6' };
    const tube5: CanonicalForm = { type: 'tube', size: 6, keyRank: '5' };
    const hints = [play(['4S', '4D', '5S', '5D', '2H', '2H'], tube6), play(cards, tube5), PASS];
    const matches = matchSelection(cards, hints, '2');
    expect(matches.map((m) => `${m.decl.type}-${m.decl.keyRank}`)).toEqual([
      'tube-6',
      'plate-5',
      'tube-5',
    ]);
    expect(matches.map((m) => m.playable)).toEqual([true, false, true]);
  });

  it('orders the SF end-position pair larger-on-top (owner pin, §9.18)', () => {
    const cards: Card[] = ['2S', '3S', '4S', '5S', '6H']; // level 6 ⇒ 6H is the wild
    const sf6: CanonicalForm = { type: 'straightFlush', size: 5, keyRank: '6', suit: 'S' };
    const sf5: CanonicalForm = { type: 'straightFlush', size: 5, keyRank: '5', suit: 'S' };
    // Hint order deliberately SMALLER first — the output must not inherit it.
    const matches = matchSelection(cards, [play(cards, sf5), play(cards, sf6)], '6');
    expect(matches.map((m) => m.decl.keyRank)).toEqual(['6', '5']);
    expect(matches.every((m) => m.playable)).toBe(true);
    // No plain-straight readings for one-suit naturals (v1.4).
    expect(matches.some((m) => m.decl.type === 'straight')).toBe(false);
  });

  it('re-anchors a straight-flush decl to the selection suit', () => {
    const sfSpades: CanonicalForm = { type: 'straightFlush', size: 5, keyRank: '9', suit: 'S' };
    const hint = play(['5S', '6S', '7S', '8S', '9S'], sfSpades);
    const matches = matchSelection(['5H', '6H', '7H', '8H', '9H'], [hint], '3');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.decl).toEqual({ ...sfSpades, suit: 'H' });
  });

  it('refuses to under-declare a one-suit set as a plain straight (§3.8, v1.4 owner-extended)', () => {
    const straight: CanonicalForm = { type: 'straight', size: 5, keyRank: '9' };
    const hint = play(['5S', '6H', '7S', '8S', '9S'], straight);
    // One-suit naturals offer ONLY the SF reading — never the hinted
    // plain straight, so nothing is playable against it.
    const readings = matchSelection(['5H', '6H', '7H', '8H', '9H'], [hint], '3');
    expect(readings.map((m) => m.decl.type)).toEqual(['straightFlush']);
    expect(readings.some((m) => m.playable)).toBe(false);
    // An off-suit selection of the same ranks IS the plain straight.
    const mixed = matchSelection(['5D', '6H', '7H', '8H', '9H'], [hint], '3');
    expect(mixed).toHaveLength(1);
    expect(mixed[0]!.playable).toBe(true);
  });

  it('matches jokers only exactly', () => {
    // Shape-faithful hint: generate.ts spells joker singles with the
    // jokerRank extra (keyRank 'A' + jokerRank distinguishes them from
    // rank-A forms).
    const sjSingle = { type: 'single', size: 1, keyRank: 'A', jokerRank: 'SJ' } as CanonicalForm;
    const sj = matchSelection(['SJ'], [play(['SJ'], sjSingle)], '2');
    expect(sj).toHaveLength(1);
    expect(sj[0]!.playable).toBe(true);
    // A big joker is NOT the small-joker single: its own reading surfaces
    // but nothing is playable against the SJ hint.
    expect(matchSelection(['BJ'], [play(['SJ'], sjSingle)], '2').some((m) => m.playable)).toBe(false);
    // A natural ace is NOT the joker single (and vice versa).
    expect(matchSelection(['AS'], [play(['SJ'], sjSingle)], '2').some((m) => m.playable)).toBe(false);
  });
});

describe('declRunText (chooser SF run labels)', () => {
  it('describes the straight-flush window with rank glyphs and suit symbol', () => {
    expect(declRunText({ type: 'straightFlush', size: 5, keyRank: '9', suit: 'S' })).toBe('5–9♠');
    expect(declRunText({ type: 'straightFlush', size: 5, keyRank: '5', suit: 'H' })).toBe('A–5♥'); // A-low
    expect(declRunText({ type: 'straightFlush', size: 5, keyRank: 'A', suit: 'D' })).toBe('10–A♦');
  });

  it('is null for every non-SF type (combo name + key rank suffices)', () => {
    expect(declRunText({ type: 'straight', size: 5, keyRank: '9' })).toBeNull();
    expect(declRunText({ type: 'fullHouse', size: 5, keyRank: '9' })).toBeNull();
    expect(declRunText({ type: 'bomb', size: 5, keyRank: '9' })).toBeNull();
  });
});

describe('pass & tribute hints', () => {
  it('canPass reflects the presence of a pass hint', () => {
    expect(canPass([PASS])).toBe(true);
    expect(canPass([play(['9S'], { type: 'single', size: 1, keyRank: '9' })])).toBe(false);
  });

  it('tributeKind and tributeEligibleCards surface the exact choice set', () => {
    const hints: GuandanAction[] = [
      { type: 'payTribute', card: 'KS' },
      { type: 'payTribute', card: 'KD' },
    ];
    expect(tributeKind(hints)).toBe('payTribute');
    expect(tributeKind([PASS])).toBeNull();
    expect([...tributeEligibleCards(hints)].sort()).toEqual(['KD', 'KS']);
    expect(tributeKind([{ type: 'returnTribute', card: '5C' }])).toBe('returnTribute');
  });
});

// handRows is the DEALING flat-fan's row split (Obs 3's ≤2-row arrival
// layout, the deal overlay's slot rects) — the SETTLED hand groups into
// same-value columns instead (HandFan.tsx's groupHandColumns/stackOffsetW,
// pinned in hand-fan.test.tsx), never wrapping rows.
describe('hand grouping (fan rows, dealing flat mode)', () => {
  it('keeps a small hand on one row', () => {
    expect(handRows(['2S', '3S', '4S'], 14)).toEqual([['2S', '3S', '4S']]);
  });

  it('splits a 27-card deal into two balanced rows', () => {
    const hand = Array.from({ length: 27 }, () => '2S' as Card);
    const rows = handRows(hand, 14);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(14);
    expect(rows[1]).toHaveLength(13);
  });

  it('handles the empty hand', () => {
    expect(handRows([], 14)).toEqual([]);
  });
});

// The descending hand-sort toggle (owner §3) is display-only: HandFan
// reverses the DISPLAY of the already-sorted `hand` array (reuses
// sortCards's ascending order, then reverses — it never re-sorts by a
// second scheme), and keeps every selection index anchored to the
// ORIGINAL `hand` array so a lifted card's identity never shifts under
// the toggle. These tests pin that contract at the engine-order level
// (no DOM/React needed — helpers.ts's handRows-style index split is
// exercised the same way HandFan.tsx exercises it internally).
describe('descending hand sort (exact reverse of ascending)', () => {
  it('descending is byte-for-byte the reverse of sortCards ascending order', () => {
    const level: Rank = '2';
    const hand: Card[] = ['5S', '2H', 'SJ', 'BJ', 'AS', '3D', '2S', '2C'];
    const ascending = sortCards(hand, level);
    const descending = [...ascending].reverse();
    expect(descending[0]).toBe(ascending[ascending.length - 1]);
    expect(descending[descending.length - 1]).toBe(ascending[0]);
    expect([...descending].reverse()).toEqual(ascending);
  });

  it('wilds, jokers and level naturals keep their mirrored slot (no second sort scheme)', () => {
    const level: Rank = '5';
    // 5H is the wild at level 5 (levelValue 15, tied with the 5-naturals);
    // jokers (16/17) sit above everything. Deliberately mixes all three
    // "special" placements the owner flagged (wild/level-card placement).
    const hand: Card[] = ['2S', '5H', '5S', '5C', 'SJ', 'BJ'];
    const ascending = sortCards(hand, level);
    const descending = [...ascending].reverse();
    // Every slot mirrors: descending[i] === ascending[n-1-i] for ALL i —
    // this is what distinguishes a true reverse from an independent
    // re-sort that happens to agree only at the two extremes.
    for (let i = 0; i < ascending.length; i++) {
      expect(descending[i]).toBe(ascending[ascending.length - 1 - i]);
    }
    const wildAscIdx = ascending.indexOf('5H');
    expect(descending.indexOf('5H')).toBe(ascending.length - 1 - wildAscIdx);
  });

  it('reversing the DISPLAY order preserves original-array indices for selection', () => {
    // Mirrors HandFan.tsx: selection/toggle/glow key off the index into
    // the ORIGINAL (ascending) hand array, not the display position —
    // reversing must renumber nothing.
    const hand: Card[] = ['5S', '2H', 'SJ', 'BJ', 'AS', '3D', '2S'];
    const n = hand.length;
    const ascendingOrder = hand.map((_, i) => i);
    const descendingOrder = [...ascendingOrder].reverse();
    expect(descendingOrder).toEqual(Array.from({ length: n }, (_, i) => n - 1 - i));
    expect(descendingOrder.map((i) => hand[i])).toEqual([...hand].reverse());
    // A card's original index (its true hand slot) is unaffected by which
    // direction it is currently being displayed in.
    expect(descendingOrder.every((i) => hand[i] === hand[i])).toBe(true);
  });
});

describe('seat & deadline projections', () => {
  it('rotates the table so the viewer sits south', () => {
    expect(seatLayout(0)).toEqual({ south: 0, east: 1, north: 2, west: 3 });
    expect(seatLayout(2)).toEqual({ south: 2, east: 3, north: 0, west: 1 });
  });

  it('placeOf maps finishOrder to 1-based places', () => {
    expect(placeOf([2, 0], 2)).toBe(1);
    expect(placeOf([2, 0], 0)).toBe(2);
    expect(placeOf([2, 0], 1)).toBeNull();
  });

  it('remainingSeconds clamps at zero and rounds up', () => {
    expect(remainingSeconds(10_500, 10_000)).toBe(1);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
    expect(remainingSeconds(9_000, 10_000)).toBe(0);
  });

  it('activeSeats follows the phase', () => {
    const base = {
      seat: 0,
      handNo: 1,
      currentLevel: '2',
      declarerTeam: null,
      levels: ['2', '2'],
      aAttempts: [0, 0],
      aAttemptsExhausted: [false, false],
      hand: [],
      cardCounts: [27, 27, 27, 27],
      finishOrder: [],
      matchWinner: null,
    };
    const playing = {
      ...base,
      phase: 'playing',
      trick: { leader: 1, toAct: 3, top: null, jiefengTo: null },
      tribute: null,
    } as unknown as GuandanView;
    expect(activeSeats(playing)).toEqual([3]);

    const tribute = {
      ...base,
      phase: 'tribute',
      trick: null,
      tribute: {
        kind: 'double',
        payers: [1, 2],
        receivers: [0, 3],
        committed: [1],
        ownStaged: null,
        paid: null,
        returned: null,
      },
    } as unknown as GuandanView;
    expect(activeSeats(tribute)).toEqual([2]);
  });
});

describe('solo drivability (UI selection path × engine)', () => {
  it('every hint the engine offers is playable through matchSelection', () => {
    // Simulates how the table drives a 4-seat solo game: for each expected
    // actor, take a hint, "tap" exactly its cards, run the ActionBar's
    // matching, and submit the matched play — the engine must accept it.
    let { state } = GuandanGame.init(JIANGSU_OFFICIAL_ONLINE, 4, 'table-ui-drivability');
    for (let step = 0; step < 400 && !GuandanGame.isTerminal(state); step++) {
      const seat = GuandanGame.expectedActors(state)[0]!;
      const hints = GuandanGame.legalActions(state, seat);
      expect(hints.length).toBeGreaterThan(0);
      const hint = hints[step % hints.length]!;
      let action: GuandanAction = hint;
      if (hint.type === 'play') {
        const matches = matchSelection(hint.cards, hints, state.currentLevel, state.config);
        expect(matches.length).toBeGreaterThan(0);
        const chosen =
          matches.find((m) => declSignature(m.decl) === declSignature(hint.decl!)) ?? matches[0]!;
        action = { type: 'play', cards: chosen.cards, decl: chosen.decl };
      }
      const res = GuandanGame.applyAction(state, seat, action);
      expect(res.ok, `step ${step}: ${JSON.stringify(action)}`).toBe(true);
      if (res.ok) state = res.state;
    }
  });
});

describe('asGuandanView', () => {
  it('accepts a view-shaped object and rejects junk', () => {
    expect(asGuandanView(null)).toBeNull();
    expect(asGuandanView({ some: 'thing' })).toBeNull();
    expect(
      asGuandanView({ phase: 'playing', hand: [], levels: ['2', '2'] }),
    ).not.toBeNull();
  });
});

// m1 fix: foldEvents must store SEMANTIC data (combo type key + rank, place
// index, card code) in a FeedLine's params, never a pre-localized string —
// otherwise a mid-session locale switch leaves earlier feed lines baked in
// the OLD language. These tests fold once, then resolve the SAME FeedLine
// (EventFeed.resolveFeedParams) under two different locales, proving the
// output re-localizes without re-folding.
describe('foldEvents + EventFeed render-time localization (m1)', () => {
  const nameFor = () => 'Alice';
  let nextId = 0;
  const idGen = () => nextId++;

  it('a folded "played" line (combo semantics) re-localizes after a locale switch', () => {
    const original = getLocale();
    try {
      const decl: CanonicalForm = { type: 'pair', size: 2, keyRank: '9' };
      const events: GuandanEvent[] = [{ type: 'played', seat: 0, cards: ['9S', '9C'], decl }];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
      const line = derived.feed[0]!;
      expect(line.key).toBe('game.feed.played');
      // The fold must NOT have baked a translated string into params.
      expect(line.params?.combo).toEqual({ kind: 'combo', comboType: 'pair', keyRank: '9' });

      setLocale('en');
      const en = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hant');
      const zhHant = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hans');
      const zhHans = t(line.key, resolveFeedParams(line.params));

      expect(en).toBe('Alice played Pair 9');
      expect(zhHant).toBe('Alice 出 對子 9');
      expect(zhHans).toBe('Alice 出 对子 9');
      // Same folded line object, three different renders — proof the
      // localization happens at render (resolveFeedParams), not at fold.
      expect(new Set([en, zhHant, zhHans]).size).toBe(3);
    } finally {
      setLocale(original);
    }
  });

  it('a folded "playerFinished" line (place semantics) re-localizes after a locale switch', () => {
    const original = getLocale();
    try {
      const events: GuandanEvent[] = [{ type: 'playerFinished', seat: 1, place: 1 }];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
      const line = derived.feed[0]!;
      expect(line.params?.place).toEqual({ kind: 'place', place: 1 });

      setLocale('en');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice went out (1st out)');
      setLocale('zh-Hant');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice 出完了(頭游)');
    } finally {
      setLocale(original);
    }
  });

  it('a folded "tributePaid" line (card semantics) re-localizes after a locale switch', () => {
    const original = getLocale();
    try {
      const events: GuandanEvent[] = [
        { type: 'tributePaid', pairings: [{ from: 0, to: 1, card: 'KS' }] },
      ];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
      const line = derived.feed[0]!;
      expect(line.params?.card).toEqual({ kind: 'card', card: 'KS', level: EMPTY_DERIVED.level });

      setLocale('en');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice paid K of Spades to Alice');
      setLocale('zh-Hant');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice 進貢 黑桃K 給 Alice');
    } finally {
      setLocale(original);
    }
  });

  // Quiet-table round: the well's own jiefeng goldleaf banner is deleted;
  // its content is UNIFIED into the log by upgrading feed.jiefeng from the
  // old leader-only "{name} takes the jiefeng lead" to the banner's fuller
  // sentence (both finisher and leader) — so the fold must now carry BOTH
  // names, not just the leader's.
  it('a folded "jiefeng" line carries BOTH names and resolves the full sentence in all three locales', () => {
    const original = getLocale();
    const seatName = (s: number) => (s === 0 ? 'Alice' : 'Bob');
    let localNextId = 0;
    const localIdGen = () => localNextId++;
    try {
      const events: GuandanEvent[] = [{ type: 'jiefeng', finisher: 0, leader: 1 }];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, seatName, localIdGen);
      const line = derived.feed[0]!;
      expect(line.key).toBe('game.feed.jiefeng');
      expect(line.params).toEqual({ leader: 'Bob', finisher: 'Alice' });

      setLocale('en');
      const en = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hant');
      const zhHant = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hans');
      const zhHans = t(line.key, resolveFeedParams(line.params));

      expect(en).toBe('Jiefeng — Bob leads for Alice');
      expect(zhHant).toBe('接風:Bob 替 Alice 領出');
      expect(zhHans).toBe('接风:Bob 替 Alice 领出');
    } finally {
      setLocale(original);
    }
  });
});

// REGRESSION (M4 computer-use visual round): playing a lone big joker rendered as
// "Single A" in both the trick-well caption and the event feed. Root cause —
// joker-keyed singles/pairs carry keyRank 'A' as a FROZEN-TYPES placeholder
// (combos.ts: never compared, mirrors jokerBomb's convention) with jokerRank
// as the REAL identity; every label built from `${comboKey} ${keyRank}`
// ignored jokerRank and printed the placeholder instead. Fixed by routing
// the label's rank segment through declJokerRank/comboRankLabel (CardFace.ts)
// and by carrying jokerRank through the feed's SEMANTIC combo descriptor
// (GameTable.foldEvents → EventFeed.resolveFeedParams, m1 render-time-
// localization architecture) instead of baking a string into the fold.
describe('joker-keyed combo labels (regression: BJ/SJ singles & pairs)', () => {
  const bjSingle = { type: 'single', size: 1, keyRank: 'A', jokerRank: 'BJ' } as CanonicalForm;
  const sjPair = { type: 'pair', size: 2, keyRank: 'A', jokerRank: 'SJ' } as CanonicalForm;
  const plainPair: CanonicalForm = { type: 'pair', size: 2, keyRank: '9' };

  it('declJokerRank extracts the FROZEN-TYPES extra, undefined for ordinary forms', () => {
    expect(declJokerRank(bjSingle)).toBe('BJ');
    expect(declJokerRank(sjPair)).toBe('SJ');
    expect(declJokerRank(plainPair)).toBeUndefined();
  });

  // Direct comboKey unit case: comboKey still names the TYPE (single/pair);
  // comboRankLabel is what must diverge from the old `rankText(keyRank)`
  // call for a jokerRank decl. Values read from the locale files, not
  // guessed (game.card.bj/sj, game.combo.single/pair).
  it('comboKey + comboRankLabel compose to the joker name, not the keyRank placeholder', () => {
    const original = getLocale();
    try {
      setLocale('zh-Hant');
      expect(t(comboKey(bjSingle))).toBe('單張');
      expect(comboRankLabel(bjSingle)).toBe('大王');
      expect(comboRankLabel(bjSingle)).not.toBe('A');
      expect(t(comboKey(sjPair))).toBe('對子');
      expect(comboRankLabel(sjPair)).toBe('小王');

      setLocale('en');
      expect(comboRankLabel(bjSingle)).toBe('Big Joker');
      expect(comboRankLabel(sjPair)).toBe('Joker');

      // Non-joker decls are unaffected — comboRankLabel is total.
      expect(comboRankLabel(plainPair)).toBe('9');
    } finally {
      setLocale(original);
    }
  });

  it('a folded "played" line for a BJ single resolves per-locale as the big joker single, never Single A', () => {
    const original = getLocale();
    const nameFor = () => 'Alice';
    let nextId = 0;
    const idGen = () => nextId++;
    try {
      const events: GuandanEvent[] = [{ type: 'played', seat: 0, cards: ['BJ'], decl: bjSingle }];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
      const line = derived.feed[0]!;
      expect(line.key).toBe('game.feed.played');
      // The fold carries jokerRank through the SEMANTIC descriptor — no
      // pre-localized string baked in (m1 architecture).
      expect(line.params?.combo).toEqual({
        kind: 'combo',
        comboType: 'single',
        keyRank: 'A',
        jokerRank: 'BJ',
      });

      setLocale('en');
      const en = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hant');
      const zhHant = t(line.key, resolveFeedParams(line.params));
      setLocale('zh-Hans');
      const zhHans = t(line.key, resolveFeedParams(line.params));

      expect(en).toBe('Alice played Single Big Joker');
      expect(zhHant).toBe('Alice 出 單張 大王');
      expect(zhHans).toBe('Alice 出 单张 大王');
      expect(zhHant).not.toBe('Alice 出 單張 A');
    } finally {
      setLocale(original);
    }
  });

  it('a folded "played" line for a SJ+SJ pair resolves per-locale as the small joker pair, never Pair A', () => {
    const original = getLocale();
    const nameFor = () => 'Alice';
    let nextId = 0;
    const idGen = () => nextId++;
    try {
      const events: GuandanEvent[] = [{ type: 'played', seat: 0, cards: ['SJ', 'SJ'], decl: sjPair }];
      const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
      const line = derived.feed[0]!;
      expect(line.params?.combo).toEqual({
        kind: 'combo',
        comboType: 'pair',
        keyRank: 'A',
        jokerRank: 'SJ',
      });

      setLocale('en');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice played Pair Joker');
      setLocale('zh-Hant');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice 出 對子 小王');
      setLocale('zh-Hans');
      expect(t(line.key, resolveFeedParams(line.params))).toBe('Alice 出 对子 小王');
    } finally {
      setLocale(original);
    }
  });

  it('an ordinary (non-joker) played line is unaffected — no jokerRank leaks in', () => {
    const nameFor = () => 'Alice';
    let nextId = 0;
    const idGen = () => nextId++;
    const events: GuandanEvent[] = [{ type: 'played', seat: 0, cards: ['9S', '9C'], decl: plainPair }];
    const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
    expect(derived.feed[0]!.params?.combo).toEqual({ kind: 'combo', comboType: 'pair', keyRank: '9' });
  });
});

// Quiet-table round: the well's own waiting/lead prompt (and its
// concealLeader gate) is DELETED outright — the headline's turn sentence and
// the active seat plate's ring/timer already carry whose turn it is, so a
// second, well-local copy of that fact had no value to the player. The old
// "renders NO lead prompt while concealed, the normal prompt once revealed"
// pin is replaced by the STRONGER property below: the well never renders any
// leader-naming (or any other) text, in ANY phase, concealed or not — there
// is no more prompt to reveal. The HEADLINE's own suspense gate
// (concealedLeader, pinned separately below) is untouched.
describe('TrickWell (quiet-table round: cards only, no prose)', () => {
  const bombTop = {
    seat: 1 as const,
    cards: ['BJ', 'BJ', 'SJ', 'SJ'] as Card[],
    decl: { type: 'jokerBomb', size: 4, keyRank: 'A' } as CanonicalForm,
  };
  const trick = { leader: 1, toAct: 1, top: bombTop, jiefengTo: null } as unknown as never;

  it('renders no text besides card markup (jokers are wordless, so a tag-strip must be empty) with no jiefeng pending', () => {
    const html = renderToStaticMarkup(
      createElement(TrickWell, { trick, level: '2', sweepKey: 0, jiefeng: null }),
    );
    const textOnly = html.replace(/<[^>]*>/g, '');
    expect(textOnly.trim(), `"${textOnly}"`).toBe('');
  });

  it('renders no text besides card markup with a jiefeng pending — the banner moved into the log, it never re-appears in the well', () => {
    const html = renderToStaticMarkup(
      createElement(TrickWell, { trick, level: '2', sweepKey: 0, jiefeng: { finisher: 0, leader: 1 } }),
    );
    const textOnly = html.replace(/<[^>]*>/g, '');
    expect(textOnly.trim(), `"${textOnly}"`).toBe('');
  });

  it('the played cards render at HAND size, not the old trick size', () => {
    const html = renderToStaticMarkup(
      createElement(TrickWell, { trick, level: '2', sweepKey: 0, jiefeng: null }),
    );
    expect(html).toContain('gd-card--hand');
    expect(html).not.toContain('gd-card--trick');
  });

  it('the empty well (no top play) still renders no text', () => {
    const emptyTrick = { leader: 1, toAct: 1, top: null, jiefengTo: null } as unknown as never;
    const html = renderToStaticMarkup(
      createElement(TrickWell, { trick: emptyTrick, level: '2', sweepKey: 0, jiefeng: null }),
    );
    expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
  });
});

describe('concealedLeader (suspense gate — the visual pass caught the headline leaking)', () => {
  const base = { handNo: 1, markerSeat: 2 as const, markerLanded: false, ceremonyShowing: false, dealing: false };

  it('conceals the leader from the ceremony overlay through the deal, until the marker LANDS', () => {
    expect(concealedLeader({ ...base, ceremonyShowing: true })).toBe(2);
    expect(concealedLeader({ ...base, dealing: true })).toBe(2);
    // The landing IS the reveal: the instant the marker lands, every surface
    // (headline turn sentence, seat ring, countdown chip) may name the leader.
    expect(concealedLeader({ ...base, dealing: true, markerLanded: true })).toBeNull();
  });

  it('never conceals outside hand 1, without a ceremony, or at the settled table', () => {
    expect(concealedLeader({ ...base, handNo: 2, dealing: true })).toBeNull();
    expect(concealedLeader({ ...base, markerSeat: null, dealing: true })).toBeNull();
    expect(concealedLeader(base)).toBeNull(); // neither overlay nor deal showing
  });
});

describe('isCeremonyShowing (hand-1 ceremony overlay + dimTimer gate)', () => {
  const base = { hasCeremony: true, ceremonyDone: false, handNo: 1, matchWinner: null as 0 | 1 | null };

  it('shows during hand 1 with an undismissed ceremony and no match winner', () => {
    expect(isCeremonyShowing(base)).toBe(true);
  });

  it('hides once the viewer dismisses the ceremony (tap-to-skip)', () => {
    expect(isCeremonyShowing({ ...base, ceremonyDone: true })).toBe(false);
  });

  it('hides on any hand past the first — the window is hand-1 only', () => {
    expect(isCeremonyShowing({ ...base, handNo: 2 })).toBe(false);
  });

  it('hides when there is no ceremony payload', () => {
    expect(isCeremonyShowing({ ...base, hasCeremony: false })).toBe(false);
  });

  it('hides the instant the match is decided, even mid-hand-1', () => {
    expect(isCeremonyShowing({ ...base, matchWinner: 0 })).toBe(false);
    expect(isCeremonyShowing({ ...base, matchWinner: 1 })).toBe(false);
  });
});

// Owner round: the log moved to a thin bottom-bar box, newest line first
// (its default, unscrolled position already shows the latest lines — no
// scripted scrolling), and FEED_LIMIT grew from 6 to 20 so scrollback under
// it is real history. foldEvents itself is untouched by the render-order
// flip (component-layer accumulation stays oldest-first, table.test.ts's m1
// tests above keep asserting derived.feed[0] as the FIRST folded line) — only
// EventFeed's render order changes, proven here directly on the component.
describe('EventFeed render order + retention (owner bottom-bar round)', () => {
  // Distinct `hand` numbers make each line's RENDERED TEXT distinguishable
  // ("Hand 0 begins…", "Hand 1 begins…", …) — a stronger proof of DOM order
  // than comparing ids or React keys, neither of which survive into
  // renderToStaticMarkup's output.
  function line(hand: number): FeedLine {
    return { id: hand, key: 'game.feed.handStarted', params: { hand, rank: '2' } };
  }

  it('renders newest-first: the first <li> in the DOM is the LAST pushed line', () => {
    const original = getLocale();
    try {
      setLocale('en'); // pin the locale the expected text below is written in
      const lines = [line(0), line(1), line(2)];
      const html = renderToStaticMarkup(createElement(EventFeed, { lines }));
      const liTexts = [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]);
      expect(liTexts).toHaveLength(3);
      expect(liTexts[0]).toContain('Hand 2');
      expect(liTexts[1]).toContain('Hand 1');
      expect(liTexts[2]).toContain('Hand 0');
    } finally {
      setLocale(original);
    }
  });

  it('FEED_LIMIT is 20 (raised from 6) and foldEvents retains exactly the newest 20', () => {
    expect(FEED_LIMIT).toBe(20);
    const nameFor = (s: number) => `Seat${s}`;
    let nextId = 0;
    const idGen = () => nextId++;
    const events: GuandanEvent[] = Array.from({ length: 25 }, (_, i) => ({
      type: 'playerFinished',
      seat: i % 4,
      place: 1,
    }));
    const derived = foldEvents(EMPTY_DERIVED, events, 0, nameFor, idGen);
    expect(derived.feed).toHaveLength(20);
    // Oldest-first fold order (unchanged): the surviving window is the
    // LAST 20 ids folded (5..24), the first 5 (0..4) fell off the front.
    expect(derived.feed[0]!.id).toBe(5);
    expect(derived.feed[19]!.id).toBe(24);
  });
});

// Own-seat markup: does the plate that used to render in the ring's south
// slot now render inside .gd-bottombar, and has the south slot itself been
// removed from the ring? No existing suite renders <GameTable> (it is the
// one component whose props are a live RoomSnapshot + RoomStore, not a pure
// prop bag), so this constructs the smallest fixture that satisfies
// GameTable's prop contract directly (a plain RoomSnapshot object literal —
// RoomSnapshot has no reducer-only invariants, unlike ServerMessage replay in
// store.test.ts — plus a real, unconnected RoomStore for its method surface)
// rather than driving the full message-reduction pipeline, which nothing
// here needs.
describe('GameTable bottom bar markup (owner round: own seat + log move off the ring)', () => {
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
    };
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
    };
  }

  /** Finds the FIRST element carrying `className` and returns its full outer
   *  HTML (balanced by counting nested <div> opens/closes) so a later assert
   *  can check what's rendered INSIDE it, not just that the class string
   *  appears somewhere in the document. */
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

  // Scoped honestly to what this DOM-free harness can drive (vitest.config.ts
  // pins environment: 'node' — no jsdom, deliberately, per the DeckTheme
  // suite's own comment): EventFeed's lines come from derivedBySeat, which is
  // seeded by an effect keyed on the snapshot (GameTable's fold useEffect),
  // not derivable from props on a first, effect-free renderToStaticMarkup
  // pass — so an empty feed (EventFeed returns null with no lines) is the
  // correct render here, and .gd-feed content is proven separately, directly
  // on <EventFeed>, in the describe block above. What IS provable at this
  // level, and is this test's actual assertion: the own-seat plate now
  // renders inside .gd-bottombar (not the ring's old south slot).
  it('renders the own-seat plate inside .gd-bottombar', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));

    const bottombar = outerHtmlByClass(html, 'gd-bottombar');
    expect(bottombar).toContain('gd-plate--viewer'); // isViewer's own plate
    expect(bottombar).toContain('ViewerName');
  });

  it('no longer renders a south ring slot — the ring is north/west/center/east only', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(createElement(GameTable, { snapshot: minimalSnapshot(), store }));

    expect(html).not.toContain('gd-ring__seat--south');
  });
});
