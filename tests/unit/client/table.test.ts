// Table-UI pure helper tests (M3): selection→hint matching (the ActionBar
// enabling rule), card grouping for the fan, tribute hint extraction and
// small seat/deadline projections. No DOM, no React — helpers.ts is a
// plain module over engine types.

import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/engine/guandan/cards';
import type { CanonicalForm, GuandanAction, GuandanView } from '../../../src/engine/guandan/types';
import { GuandanGame, JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan';
import {
  activeSeats,
  asGuandanView,
  canPass,
  declSignature,
  errorKeyFor,
  handRows,
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
    // A single of a different rank never matches a hinted single either.
    const single4: CanonicalForm = { type: 'single', size: 1, keyRank: '4' };
    expect(matchSelection(['5D'], [play(['4S'], single4)], '2')).toEqual([]);
  });

  it('accepts a wild-substituted realization of a hinted form', () => {
    // The generator emits ONE wild-frugal realization per form; a player
    // spending the ♥level wild on the same form is still that form — the
    // engine's validatePlay accepts natural+wild as the pair of 9s. (This
    // exact gap made 出牌 refuse legal wild plays in production.)
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
    // ♥2 at level 2 is the level single, not a single of 9s.
    const single9: CanonicalForm = { type: 'single', size: 1, keyRank: '9' };
    expect(matchSelection(['2H'], [play(['9S'], single9)], '2')).toEqual([]);
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

  it('re-anchors a straight-flush decl to the selection suit', () => {
    const sfSpades: CanonicalForm = { type: 'straightFlush', size: 5, keyRank: '9', suit: 'S' };
    const hint = play(['5S', '6S', '7S', '8S', '9S'], sfSpades);
    const matches = matchSelection(['5H', '6H', '7H', '8H', '9H'], [hint], '3');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.decl).toEqual({ ...sfSpades, suit: 'H' });
  });

  it('refuses to under-declare a fully-natural one-suit set as a plain straight (§3.8)', () => {
    const straight: CanonicalForm = { type: 'straight', size: 5, keyRank: '9' };
    const hint = play(['5S', '6H', '7S', '8S', '9S'], straight);
    expect(matchSelection(['5H', '6H', '7H', '8H', '9H'], [hint], '3')).toEqual([]);
    // An off-suit selection of the same ranks IS the plain straight.
    expect(matchSelection(['5D', '6H', '7H', '8H', '9H'], [hint], '3')).toHaveLength(1);
  });

  it('matches jokers only exactly', () => {
    // Shape-faithful hint: generate.ts spells joker singles with the
    // jokerRank extra (keyRank 'A' + jokerRank distinguishes them from
    // rank-A forms).
    const sjSingle = { type: 'single', size: 1, keyRank: 'A', jokerRank: 'SJ' } as CanonicalForm;
    expect(matchSelection(['SJ'], [play(['SJ'], sjSingle)], '2')).toHaveLength(1);
    expect(matchSelection(['BJ'], [play(['SJ'], sjSingle)], '2')).toEqual([]);
    // A natural ace is NOT the joker single (and vice versa).
    expect(matchSelection(['AS'], [play(['SJ'], sjSingle)], '2')).toEqual([]);
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

describe('hand grouping (fan rows)', () => {
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

describe('error localization keys', () => {
  it('maps known codes to dedicated keys and everything else to unknown', () => {
    expect(errorKeyFor('action.notYourTurn')).toBe('game.error.notYourTurn');
    expect(errorKeyFor('play.cannotBeatTop')).toBe('game.error.cannotBeatTop');
    expect(errorKeyFor('protocol.tooLarge')).toBe('game.error.unknown');
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
