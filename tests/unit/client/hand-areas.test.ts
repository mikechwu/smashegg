// Manual sort areas — the PARTITION INVARIANT and the TWIN-REMAP fix.
//
// Owner sequencing: the model and its invariant are built and pinned BEFORE
// any UI. Design record: docs/research/sort-areas.md.
//
// House idiom, deliberately: a custom SEEDED playout harness driving the real
// GuandanGame, exactly like tests/unit/engine/obligations.property.test.ts —
// NOT fast-check. There is no property-testing library in this repo and
// adopting one is a separate argument (design study §8); both external design
// proposals sketched fc.commands and neither had read that header.
//
// The property runs over SEQUENCES of operations against a hand that changes
// underneath from EVERY source the engine actually produces: this seat's own
// play, tribute payment, tribute return, anti-tribute, and a fresh deal. That
// coverage is the owner's explicit requirement — "verify the fix covers EVERY
// source of hand change, not just plays" — and the phase counter at the end
// fails the run if a source was never exercised, so a green pass cannot mean
// "the interesting paths never came up".

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, type PrngState } from '../../../src/engine/core/prng';
import { GuandanGame } from '../../../src/engine/guandan';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import { findStraightFlushes } from '../../../src/engine/guandan/straight-flush-finder';
import type { Card } from '../../../src/engine/guandan/cards';
import type { GuandanAction, GuandanState } from '../../../src/engine/guandan/types';
import type { SelectionContext } from '../../../src/client/table/helpers';
import {
  AREA_HARD_MAX,
  NO_GROUP,
  applyMoveAsGroup,
  groupHealth,
  slotsOfGroup,
  MAIN_AREA,
  NEW_SHELF,
  areaAllowance,
  ratchetAllowance,
  applyMove,
  areaAt,
  setAsideDestination,
  areaCountOf,
  mergeAreas,
  moveWouldChange,
  normalizeAreas,
  reconcileAreas,
  remapAreas,
  sameAreas,
  slotsOf,
  type HandAreas,
} from '../../../src/client/table/areas';

/** Build a HandAreas from just its area map — the recorded-grouping fields
 *  default to "nothing grouped", which is what every pre-grouping test means. */
function A(areaOf: number[], areaCount: number, groupOf?: number[], groupSize?: number[]): HandAreas {
  return {
    areaOf,
    areaCount,
    groupOf: groupOf ?? new Array<number>(areaOf.length).fill(0),
    groupSize: groupSize ?? [0],
  };
}

// ---------------------------------------------------------------------------
// Helpers — all independent of the module under test.
// ---------------------------------------------------------------------------

/** The project's first-unclaimed-slot idiom, re-derived here so the test does
 *  not borrow the implementation's own walk: which SLOTS a client holding
 *  `cards` would have selected out of `hand`. */
function slotsForCards(hand: readonly Card[], cards: readonly Card[]): Set<number> {
  const out = new Set<number>();
  for (const card of cards) {
    for (let i = 0; i < hand.length; i += 1) {
      if (hand[i] === card && !out.has(i)) {
        out.add(i);
        break;
      }
    }
  }
  return out;
}

/** Sorted card multiset of one area — the observable content of a band. */
function contentOf(areas: HandAreas | null, hand: readonly Card[], area: number): string {
  const out: Card[] = [];
  for (let i = 0; i < hand.length; i += 1) {
    if (areaAt(areas, i) === area) out.push(hand[i]!);
  }
  return out.sort().join(',');
}

/** MAIN's content plus the shelf contents as a CANONICAL (sorted) list.
 *  Renumber-invariant on purpose: when a shelf empties the ids compact, and a
 *  check keyed on ids would be re-implementing normalizeAreas — the
 *  "model = product" trap. Comparing the sorted shelf contents is independent
 *  of how the implementation numbers them. */
function shape(areas: HandAreas | null, hand: readonly Card[]): { main: string; shelves: string[] } {
  const main = contentOf(areas, hand, MAIN_AREA);
  const shelves: string[] = [];
  for (let a = 1; a < areaCountOf(areas); a += 1) {
    const content = contentOf(areas, hand, a);
    if (content !== '') shelves.push(content);
  }
  return { main, shelves: shelves.sort() };
}

/** Multiset difference a - b, as a sorted string list. */
function minus(a: readonly Card[], b: readonly Card[]): Card[] {
  const rest = [...b];
  const out: Card[] = [];
  for (const card of a) {
    const i = rest.indexOf(card);
    if (i >= 0) rest.splice(i, 1);
    else out.push(card);
  }
  return out.sort();
}

/** The invariant itself, asserted structurally. Union === hand, pairwise
 *  disjoint, by SLOT (and therefore by card identity, twins included). */
function assertInvariant(areas: HandAreas | null, hand: readonly Card[], where: string): void {
  if (areas === null) return;
  expect(areas.areaOf.length, `${where}: areaOf covers the hand`).toBe(hand.length);
  expect(areas.areaCount, `${where}: a non-null partition has a shelf`).toBeGreaterThanOrEqual(2);

  const seen: number[] = [];
  for (let a = 0; a < areas.areaCount; a += 1) seen.push(...slotsOf(areas, a));
  // Covering AND disjoint in one statement: the concatenation of every area's
  // slots, sorted, must be exactly 0..n-1 with no repeats and nothing missing.
  seen.sort((x, y) => x - y);
  expect(seen, `${where}: union of areas === hand, intersections empty`).toEqual(
    hand.map((_, i) => i),
  );
  for (const id of areas.areaOf) {
    expect(id, `${where}: every area id is in range`).toBeLessThan(areas.areaCount);
    expect(id, `${where}: every area id is in range`).toBeGreaterThanOrEqual(0);
  }
  // Every shelf is non-empty (an empty shelf must have normalized away).
  for (let a = 1; a < areas.areaCount; a += 1) {
    expect(slotsOf(areas, a).length, `${where}: shelf ${a} is non-empty`).toBeGreaterThan(0);
  }
}

// ---------------------------------------------------------------------------
// 1. The twin-remap defect — the round's most serious finding (§6.2).
// ---------------------------------------------------------------------------

describe('TWIN REMAP — a shelf survives a play of its twin from MAIN', () => {
  // Two decks, so 5S appears twice. One 5S anchors a straight flush on a
  // shelf; its twin sits in MAIN. The player plays the MAIN one.
  const prevHand: Card[] = ['5S', '5S', '6S', '7S', '8S', '9S'];
  //                        5S(main) 5S(shelf) 6S 7S 8S 9S
  const shelved: HandAreas = A([MAIN_AREA, 1, 1, 1, 1, 1], 2);
  const nextHand: Card[] = ['5S', '6S', '7S', '8S', '9S'];

  it('keeps the straight flush intact when the committed slot is known', () => {
    const commit = { slots: new Set([0]), hand: prevHand };
    const after = remapAreas(shelved, prevHand, nextHand, commit);
    assertInvariant(after, nextHand, 'after the play');
    expect(shape(after, nextHand)).toEqual({ main: '', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('NON-VACUITY: the commit decides when the player plays the SHELF twin', () => {
    // The fallback now PREFERS shelves (so a server auto-play takes from MAIN),
    // which means the old "fallback dismantles the shelf" demonstration no
    // longer distinguishes the two paths for THIS scenario. The case where the
    // commit is still load-bearing is the mirror image: the player deliberately
    // plays the card that is ON the shelf. Only the commit knows that.
    const commit = { slots: new Set([1]), hand: prevHand };
    expect(shape(remapAreas(shelved, prevHand, nextHand, commit), nextHand)).toEqual({
      main: '5S',
      shelves: ['6S,7S,8S,9S'],
    });
    // Without it, shelf-first wrongly keeps the very card the player just played
    // out of the shelf, and MAIN loses a card it never played.
    expect(shape(remapAreas(shelved, prevHand, nextHand, null), nextHand)).toEqual({
      main: '',
      shelves: ['5S,6S,7S,8S,9S'],
    });
  });

  it('a stale commit (rejected action, hand unchanged) is ignored, not applied', () => {
    const stale = { slots: new Set([0]), hand: ['2C', '3C'] as Card[] };
    const after = remapAreas(shelved, prevHand, nextHand, stale);
    // Falls back to the shelf-preferring walk rather than deleting slot 0 of a
    // hand the commit was never made against. (Compare the test above: with a
    // VALID commit on slot 1 the shelf would have lost its 5S; the stale one is
    // ignored entirely, so it cannot delete anything.)
    expect(shape(after, nextHand)).toEqual({ main: '', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('a card ARRIVING (tribute) lands in MAIN and disturbs no shelf', () => {
    const grown: Card[] = ['5S', '5S', '6S', '7S', '8S', '9S', 'BJ'];
    const after = remapAreas(shelved, prevHand, grown, null);
    assertInvariant(after, grown, 'after the tribute arrives');
    expect(shape(after, grown)).toEqual({ main: '5S,BJ', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('a returned tribute leaves AND arrives in the same change', () => {
    // The tribute exchange resolves atomically (tribute.ts moveCards): a seat
    // can lose its committed card and gain the other seat's card in ONE view
    // change. The seeded sweep never landed a returnTribute on seat 0, so this
    // shape is pinned directly rather than claimed as swept coverage.
    // MAIN commits its 5S; a QD arrives from the other seat.
    const commit = { slots: new Set([0]), hand: prevHand };
    const exchanged: Card[] = ['5S', '6S', '7S', '8S', '9S', 'QD'];
    const after = remapAreas(shelved, prevHand, exchanged, commit);
    assertInvariant(after, exchanged, 'after the exchange');
    // The shelf's straight flush is untouched; the arrival is unorganized.
    expect(shape(after, exchanged)).toEqual({ main: 'QD', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('SERVER-ORIGINATED removal (AFK auto-play) takes from MAIN, not the shelf', () => {
    // The audit finding my own harness could not reach: when the server applies
    // defaultAction for an idle seat, the client never calls act(), so there is
    // NO commit. The engine removes by multiset, so which twin "really" left is
    // not a fact — the tie is broken toward preserving what the player built.
    const after = remapAreas(shelved, prevHand, nextHand, null);
    expect(shape(after, nextHand)).toEqual({ main: '', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('NON-VACUITY: serving MAIN first really would dismantle the shelf', () => {
    // Reintroduce the old order (MAIN served before the shelf) by putting the
    // MAIN twin at the HIGHER slot: if the preference were slot-order rather
    // than shelf-first, this arrangement would lose the shelf's copy.
    const mainHigh: HandAreas = A([1, MAIN_AREA, 1, 1, 1, 1], 2);
    const after = remapAreas(mainHigh, prevHand, nextHand, null);
    expect(shape(after, nextHand)).toEqual({ main: '', shelves: ['5S,6S,7S,8S,9S'] });
  });

  it('twins in the SAME shelf are unaffected by which one is played', () => {
    const both: HandAreas = A([1, 1, 1, 1, 1, MAIN_AREA], 2);
    const a = remapAreas(both, prevHand, nextHand, { slots: new Set([0]), hand: prevHand });
    const b = remapAreas(both, prevHand, nextHand, { slots: new Set([1]), hand: prevHand });
    expect(shape(a, nextHand)).toEqual(shape(b, nextHand));
  });
});

// ---------------------------------------------------------------------------
// 2. Progressive disclosure — the never-user contract, at the model level.
// ---------------------------------------------------------------------------

describe('PROGRESSIVE DISCLOSURE — a never-user allocates nothing', () => {
  const ctx = (hand: Card[], handNo = 1, dealNo = 1): SelectionContext => ({
    seat: 0,
    handNo,
    dealNo,
    hand,
  });

  it('null in, null out — for every hand change there is', () => {
    const a = ctx(['3C', '4C', '5C']);
    const b = ctx(['3C', '5C']);
    expect(reconcileAreas(null, a, b, null)).toBeNull();
    expect(reconcileAreas(null, a, ctx(['3C', '5C'], 2, 2), null)).toBeNull();
    expect(reconcileAreas(null, null, b, null)).toBeNull();
    // The identity assertion, not just equality: nothing is allocated, so
    // setState bails and no re-render happens. This is the leg that a total
    // areaOf map over a changing hand could never satisfy.
    const same = reconcileAreas(null, a, b, null);
    expect(same).toBe(null);
  });

  it('an unchanged hand returns the SAME instance', () => {
    const hand: Card[] = ['3C', '4C', '5C'];
    const areas: HandAreas = A([MAIN_AREA, 1, 1], 2);
    expect(reconcileAreas(areas, ctx(hand), ctx([...hand]), null)).toBe(areas);
  });

  it('a seat switch or a fresh deal returns to the never-user state', () => {
    const hand: Card[] = ['3C', '4C', '5C'];
    const areas: HandAreas = A([MAIN_AREA, 1, 1], 2);
    const seatSwitch: SelectionContext = { seat: 1, handNo: 1, dealNo: 1, hand };
    expect(reconcileAreas(areas, ctx(hand), seatSwitch, null)).toBeNull();
    expect(reconcileAreas(areas, ctx(hand), ctx(hand, 2, 1), null)).toBeNull();
    expect(reconcileAreas(areas, ctx(hand), ctx(hand, 1, 2), null)).toBeNull();
  });

  it('emptying the last shelf returns to null — exiting is always reachable', () => {
    const hand: Card[] = ['3C', '4C', '5C'];
    const areas = applyMove(null, hand.length, new Set([1, 2]), NEW_SHELF, 3);
    expect(areas).not.toBeNull();
    const back = applyMove(areas, hand.length, new Set([1, 2]), MAIN_AREA, 3);
    expect(back).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. No silent no-op — every offered control must change something.
// ---------------------------------------------------------------------------

describe('NO SILENT NO-OP — moveWouldChange gates every control', () => {
  const hand: Card[] = ['3C', '4C', '5C', '6C'];

  it('an empty selection never changes anything', () => {
    expect(moveWouldChange(null, hand.length, new Set(), NEW_SHELF, 3)).toBe(false);
  });

  it('at the cap, minting a new shelf is refused — and reported as no change', () => {
    const one = applyMove(null, hand.length, new Set([0]), NEW_SHELF, 2)!;
    expect(areaCountOf(one)).toBe(2);
    // maxAreas = 2 means MAIN + one shelf; a second shelf is not available.
    expect(moveWouldChange(one, hand.length, new Set([1]), NEW_SHELF, 2)).toBe(false);
    expect(applyMove(one, hand.length, new Set([1]), NEW_SHELF, 2)).toBe(one);
  });

  it('moving cards already in the destination is not a change', () => {
    const one = applyMove(null, hand.length, new Set([0, 1]), NEW_SHELF, 3)!;
    expect(moveWouldChange(one, hand.length, new Set([0]), 1, 3)).toBe(false);
    expect(moveWouldChange(one, hand.length, new Set([2]), 1, 3)).toBe(true);
  });

  it('a strict subset of the last shelf can still move back to MAIN', () => {
    // The critique found "Set aside on a strict subset of the last shelf" is a
    // silent no-op at the cap. The gate above reports it; this pins that the
    // ESCAPE (put it back) is always a real change, so the player is never stuck.
    const one = applyMove(null, hand.length, new Set([0, 1, 2]), NEW_SHELF, 2)!;
    expect(moveWouldChange(one, hand.length, new Set([0]), MAIN_AREA, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Structural invariant unit cases.
// ---------------------------------------------------------------------------

describe('the partition invariant, structurally', () => {
  const hand: Card[] = ['3C', '4C', '5C', '6C', '7C'];

  it('normalize drops empty shelves, compacts ids, and is idempotent', () => {
    const gappy: HandAreas = A([MAIN_AREA, 3, 3, MAIN_AREA, 5], 6);
    const once = normalizeAreas(gappy)!;
    expect(once.areaCount).toBe(3);
    expect(once.areaOf).toEqual([MAIN_AREA, 1, 1, MAIN_AREA, 2]);
    expect(normalizeAreas(once)).toBe(once);
    assertInvariant(once, hand, 'normalized');
  });

  it('merge folds one shelf into another and never dissolves MAIN', () => {
    const two: HandAreas = A([MAIN_AREA, 1, 1, 2, 2], 3);
    const merged = mergeAreas(two, 2, 1)!;
    expect(areaCountOf(merged)).toBe(2);
    expect(shape(merged, hand)).toEqual({ main: '3C', shelves: ['4C,5C,6C,7C'] });
    expect(mergeAreas(two, MAIN_AREA, 1)).toBe(two);
    assertInvariant(merged, hand, 'merged');
  });

  it('sameAreas distinguishes content, count and absence', () => {
    const a: HandAreas = A([MAIN_AREA, 1], 2);
    expect(sameAreas(a, A([MAIN_AREA, 1], 2))).toBe(true);
    expect(sameAreas(a, A([1, MAIN_AREA], 2))).toBe(false);
    expect(sameAreas(a, null)).toBe(false);
    expect(sameAreas(null, null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. THE MONOTONE ALLOWANCE — predictability as a pinned invariant.
// ---------------------------------------------------------------------------

describe('MONOTONE ALLOWANCE — the allowance never decreases within a hand', () => {
  // Measured at true 390x844 on the current build (docs/research/sort-areas.md
  // §3): a band's floor is one card line plus its lift headroom, and 9
  // value-columns fit one line.
  const GEOMETRY = { bandFloorPx: 87.5, columnsPerLine: 9 };

  it('MONOTONICITY: more columns can never buy MORE areas', () => {
    // The property that makes the feature predictable. Swept over every budget
    // and column count that can occur, not spot-checked: a hand only shrinks as
    // it is played, so if the allowance could rise with column count it would
    // FALL as the player plays — an offer vanishing under them.
    for (let budget = 0; budget <= 600; budget += 12.5) {
      let previous = Infinity;
      for (let columns = 1; columns <= 27; columns += 1) {
        const allowed = areaAllowance({ ...GEOMETRY, fanBudgetPx: budget, columns });
        expect(
          allowed,
          `budget ${budget}: allowance rose from ${previous} to ${allowed} at ${columns} columns`,
        ).toBeLessThanOrEqual(previous);
        expect(allowed, 'MAIN always exists').toBeGreaterThanOrEqual(1);
        expect(allowed, 'never exceeds the hard ceiling').toBeLessThanOrEqual(AREA_HARD_MAX);
        previous = allowed;
      }
    }
  });

  it('the RATCHET makes monotonicity hold even when a tribute GROWS the hand', () => {
    // The one case pure geometry cannot cover: a tribute card arriving adds a
    // column mid-hand, so the raw computation can fall. The running maximum is
    // what makes "never withdrawn" true by construction.
    const small = areaAllowance({ ...GEOMETRY, fanBudgetPx: 260, columns: 8 });
    const grown = areaAllowance({ ...GEOMETRY, fanBudgetPx: 260, columns: 26 });
    expect(grown, 'raw geometry really can fall when the hand grows').toBeLessThan(small);
    expect(ratchetAllowance(small, grown), 'the ratchet holds the earlier offer').toBe(small);
  });

  it('the ratchet is a running maximum and never shrinks over a sequence', () => {
    let high = 1;
    for (const columns of [27, 20, 14, 9, 5, 26, 3, 27, 2]) {
      const next = ratchetAllowance(
        high,
        areaAllowance({ ...GEOMETRY, fanBudgetPx: 260, columns }),
      );
      expect(next, 'the ratchet never shrinks').toBeGreaterThanOrEqual(high);
      high = next;
    }
  });

  it('an existing shelf is never WITHDRAWN when the allowance is exceeded', () => {
    // The other half of predictability. The allowance gates MINTING only:
    // applyMove refuses to create a shelf past the cap, but nothing anywhere
    // removes one, so a shelf that exists survives any budget change.
    const hand: Card[] = ['3C', '4C', '5C', '6C'];
    const two = applyMove(null, hand.length, new Set([0, 1]), NEW_SHELF, 3)!;
    const three = applyMove(two, hand.length, new Set([2]), NEW_SHELF, 3)!;
    expect(areaCountOf(three)).toBe(3);
    // The budget collapses to one area; the existing shelves stand.
    expect(applyMove(three, hand.length, new Set([3]), NEW_SHELF, 1)).toBe(three);
    expect(areaCountOf(three), 'no shelf was withdrawn').toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 6. FRONT-END ONLY — a source ratchet, so the claim cannot rot.
// ---------------------------------------------------------------------------

describe('FRONT-END ONLY — areas can never reach the server', () => {
  const source = readFileSync(
    new URL('../../../src/client/table/areas.ts', import.meta.url),
    'utf8',
  );

  it('imports nothing but pure card types — no server, protocol, store or React', () => {
    const imports = [...source.matchAll(/^import[^;]*from '([^']+)';/gm)].map((m) => m[1]!);
    expect(imports.sort()).toEqual(['../../engine/guandan/cards', './helpers']);
    // Both are TYPE-only imports, so the module contributes no runtime edge.
    for (const line of source.split('\n').filter((l) => l.startsWith('import'))) {
      expect(line, 'every import is type-only').toContain('import type');
    }
  });

  it('never mentions the wire: no fetch, no socket, no action, no serialization', () => {
    // Scan CODE, not commentary. The header deliberately discusses the wire it
    // must never touch, and the measurement notes discuss the third-area
    // "window" — a naive substring scan trips on the explanation instead of on
    // a real regression, which would train the next author to delete comments.
    const code = source
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
      })
      .join('\n');
    for (const forbidden of [
      'fetch(',
      'WebSocket',
      'store',
      'act(',
      'JSON.stringify',
      'localStorage',
      'sessionStorage',
      'useState',
      'useEffect',
      'document',
      'window',
    ]) {
      expect(code, `areas.ts must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. THE PROPERTY — operation sequences against a real engine playout.
// ---------------------------------------------------------------------------

type HandChangeSource = 'ownPlay' | 'tributePay' | 'tributeReturn' | 'arrival' | 'freshDeal';

describe('PROPERTY — the invariant holds after every operation, every hand change', () => {
  it('survives seeded playouts with area edits interleaved', () => {
    const config = JIANGSU_OFFICIAL_ONLINE;
    const sourcesSeen = new Set<HandChangeSource>();
    let edits = 0;
    let sfSends = 0;
    let twinsSplitObserved = 0;

    for (const seed of ['areas-1', 'areas-2', 'areas-3', 'areas-4', 'areas-5', 'areas-6']) {
      let state: GuandanState = GuandanGame.init(config, 4, seed).state;
      let bot: PrngState = seedPrng(`${seed}:bot`);
      let edit: PrngState = seedPrng(`${seed}:edit`);

      const VIEWER = 0;
      let areas: HandAreas | null = null;
      let prevCtx: SelectionContext | null = null;
      let pendingCommit: { slots: ReadonlySet<number>; hand: readonly Card[] } | null = null;

      const readCtx = (): SelectionContext => {
        const view = GuandanGame.playerView(state, VIEWER);
        return { seat: VIEWER, handNo: view.handNo, dealNo: 0, hand: view.hand };
      };

      prevCtx = readCtx();

      for (let step = 0; step < 220 && !GuandanGame.isTerminal(state); step += 1) {
        const actors = GuandanGame.expectedActors(state);
        if (actors.length === 0) break;
        const seat = actors[0]!;
        const legal = GuandanGame.legalActions(state, seat);
        const fallback = GuandanGame.defaultAction(state, seat);

        let action: GuandanAction | null = fallback;
        if (legal.length > 0) {
          const plays = legal.filter((a) => a.type !== 'pass');
          const pool = plays.length > 0 ? plays : legal;
          const pick = nextInt(bot, pool.length);
          bot = pick.state;
          action = pool[pick.value]!;
        }
        if (action === null) break;

        // --- the CLIENT side: what would this seat have had selected? ---
        pendingCommit = null;
        if (seat === VIEWER) {
          const cards: Card[] =
            action.type === 'play'
              ? action.cards
              : action.type === 'payTribute' || action.type === 'returnTribute'
                ? [action.card]
                : [];
          if (cards.length > 0) {
            pendingCommit = { slots: slotsForCards(prevCtx.hand, cards), hand: prevCtx.hand };
          }
        }

        // --- randomly edit the areas BEFORE the action lands ---
        const roll = nextInt(edit, 100);
        edit = roll.state;
        const handSize = prevCtx.hand.length;
        if (roll.value < 34 && handSize >= 2) {
          const pickN = nextInt(edit, Math.min(5, handSize));
          edit = pickN.state;
          const startAt = nextInt(edit, handSize);
          edit = startAt.state;
          const sel = new Set<number>();
          for (let k = 0; k <= pickN.value; k += 1) sel.add((startAt.value + k) % handSize);
          const destRoll = nextInt(edit, areaCountOf(areas) + 1);
          edit = destRoll.state;
          const dest = destRoll.value >= areaCountOf(areas) ? NEW_SHELF : destRoll.value;
          const before = areas;
          areas = applyMove(areas, handSize, sel, dest, 3);
          if (!sameAreas(before, areas)) edits += 1;
          assertInvariant(areas, prevCtx.hand, `after an area edit (seed ${seed} step ${step})`);
        } else if (roll.value < 42 && areaCountOf(areas) >= 3) {
          areas = mergeAreas(areas, 2, 1);
          assertInvariant(areas, prevCtx.hand, `after a merge (seed ${seed} step ${step})`);
        } else if (roll.value < 55) {
          // THE FINDER IS NOW A SOURCE OF AREA EDITS. Its "set aside" runs the
          // same applyMove every other area control uses, so it belongs inside
          // this invariant sweep rather than beside it (owner gate).
          const found = findStraightFlushes(prevCtx.hand, state.currentLevel, config);
          const group = found.decompositions[0]?.groups[0];
          if (group !== undefined) {
            const slots = new Set<number>();
            for (const card of group.cards) {
              for (let i = 0; i < prevCtx.hand.length; i += 1) {
                if (prevCtx.hand[i] === card && !slots.has(i)) {
                  slots.add(i);
                  break;
                }
              }
            }
            // All-or-nothing, exactly as the UI path does it.
            if (slots.size === group.cards.length) {
              const target = setAsideDestination(areas, 3);
              if (target !== null) {
                const before = areas;
                areas = applyMove(areas, prevCtx.hand.length, slots, target, 3);
                if (!sameAreas(before, areas)) sfSends += 1;
                assertInvariant(
                  areas,
                  prevCtx.hand,
                  `after an SF send (seed ${seed} step ${step})`,
                );
              }
            }
          }
        }

        // Record whether twins are currently SPLIT across areas — the exact
        // configuration the twin fix exists for. Counted so the run can prove
        // it actually exercised it.
        if (areas !== null) {
          const byValue = new Map<Card, Set<number>>();
          prevCtx.hand.forEach((card, i) => {
            const set = byValue.get(card) ?? new Set<number>();
            set.add(areaAt(areas, i));
            byValue.set(card, set);
          });
          for (const set of byValue.values()) if (set.size > 1) twinsSplitObserved += 1;
        }

        // --- the model's expectation, computed BEFORE the engine moves ---
        // Per-area content and per-area committed cards. Both must be keyed by
        // the area the slot was actually IN: an earlier version of this check
        // subtracted the committed cards from every shelf, which is the very
        // value-blindness the fix exists to remove — the model reproduced the
        // bug and reported the correct implementation as wrong.
        const beforeByArea = new Map<number, Card[]>();
        const committedByArea = new Map<number, Card[]>();
        for (let i = 0; i < prevCtx.hand.length; i += 1) {
          const id = areaAt(areas, i);
          const card = prevCtx.hand[i]!;
          (beforeByArea.get(id) ?? beforeByArea.set(id, []).get(id)!).push(card);
          if (pendingCommit?.slots.has(i) === true) {
            (committedByArea.get(id) ?? committedByArea.set(id, []).get(id)!).push(card);
          }
        }
        const beforeShelfIds = [...beforeByArea.keys()].filter((id) => id !== MAIN_AREA);

        const handNoBefore = state.handNo;
        const res = GuandanGame.applyAction(state, seat, action);
        if (!res.ok) throw new Error(`legal action rejected: ${res.error.code}`);
        state = res.state;

        const nextCtx = readCtx();
        const freshDeal = state.handNo !== handNoBefore;
        if (freshDeal) {
          // A new hand is a new arrangement context; areas reset with selection.
          areas = reconcileAreas(areas, prevCtx, { ...nextCtx, dealNo: 1 }, null);
          expect(areas, 'a fresh deal returns to the never-user state').toBeNull();
          sourcesSeen.add('freshDeal');
          prevCtx = nextCtx;
          continue;
        }

        const handChanged =
          nextCtx.hand.length !== prevCtx.hand.length ||
          nextCtx.hand.some((card, i) => card !== prevCtx!.hand[i]);

        if (handChanged) {
          const gained = minus(nextCtx.hand, prevCtx.hand);
          const lost = minus(prevCtx.hand, nextCtx.hand);
          if (seat === VIEWER && action.type === 'play') sourcesSeen.add('ownPlay');
          else if (seat === VIEWER && action.type === 'payTribute') sourcesSeen.add('tributePay');
          else if (seat === VIEWER && action.type === 'returnTribute') {
            sourcesSeen.add('tributeReturn');
          } else if (gained.length > 0 && lost.length === 0) sourcesSeen.add('arrival');

          areas = reconcileAreas(areas, prevCtx, nextCtx, pendingCommit);
          assertInvariant(areas, nextCtx.hand, `after a hand change (seed ${seed} step ${step})`);

          // CONSERVATION: an area may lose only what this client committed out
          // of it, and only MAIN may gain. This is what catches the twin bug —
          // under the identity-blind walk a shelf silently loses a twin it
          // never committed, and the shelf shapes stop matching.
          if (areas !== null || beforeShelfIds.length > 0) {
            const afterShape = shape(areas, nextCtx.hand);
            const expectedShelves = beforeShelfIds
              .map((id) =>
                minus(beforeByArea.get(id) ?? [], committedByArea.get(id) ?? []).join(','),
              )
              .filter((content) => content !== '')
              .sort();
            expect(
              afterShape.shelves,
              `shelves lose only what was committed OUT OF THEM (seed ${seed} step ${step})`,
            ).toEqual(expectedShelves);
          }
        } else {
          expect(
            reconcileAreas(areas, prevCtx, nextCtx, pendingCommit),
            'an unchanged hand keeps the same instance',
          ).toBe(areas);
        }
        prevCtx = nextCtx;
      }
    }

    // Coverage floor: a green run must actually have exercised the paths.
    // Without this, "the property holds" could mean "nothing interesting ran".
    expect(edits, 'the sweep performed real area edits').toBeGreaterThan(50);
    expect(sfSends, 'the sweep really exercised finder-driven area edits').toBeGreaterThan(0);
    expect(
      twinsSplitObserved,
      'the sweep actually observed twins split across areas (the fix\'s reason to exist)',
    ).toBeGreaterThan(0);
    // COVERAGE FLOOR, stated exactly. A green run must have exercised these
    // four sources; if a future engine or seed change stops producing one, the
    // suite fails rather than quietly narrowing what "the property holds" means.
    // `tributeReturn` is deliberately NOT in this list: across every seed tried
    // it never fell to seat 0, so claiming it here would be claiming coverage
    // the run does not have. It is pinned by its own named case instead
    // ('a returned tribute leaves AND arrives in the same change').
    for (const source of ['ownPlay', 'tributePay', 'arrival', 'freshDeal'] as const) {
      expect(sourcesSeen.has(source), `hand-change source exercised: ${source}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// RECORDED GROUPING — it must degrade, never lie.
// ---------------------------------------------------------------------------

describe('GROUPING — recorded at send, and never a claim that stopped holding', () => {
  const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'KD', 'KH'];
  const flush = new Set([0, 1, 2, 3, 4]);

  it('is RECORDED, not re-derived: exactly the sent slots become the group', () => {
    const a = applyMoveAsGroup(null, hand.length, flush, NEW_SHELF, 2)!;
    expect(slotsOfGroup(a, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(groupHealth(a, 1)).toBe('intact');
  });

  it('losing ONE member drops the combination claim but keeps the group', () => {
    // The honest middle rung: these cards WERE set aside together (still true),
    // but they are no longer the flush the label would have named.
    const a = applyMoveAsGroup(null, hand.length, flush, NEW_SHELF, 2)!;
    const next: Card[] = ['5S', '6S', '7S', '8S', 'KD', 'KH']; // the 9S was played
    const after = remapAreas(a, hand, next, { slots: new Set([4]), hand });
    expect(groupHealth(after, 1), 'no longer intact, so it may not be named').toBe('broken');
    expect(slotsOfGroup(after, 1).length).toBe(4);
  });

  it('falling below two members DISSOLVES the group entirely', () => {
    const a = applyMoveAsGroup(null, hand.length, new Set([0, 1]), NEW_SHELF, 2)!;
    const next: Card[] = ['5S', '7S', '8S', '9S', 'KD', 'KH']; // the 6S left
    const after = remapAreas(a, hand, next, { slots: new Set([1]), hand });
    expect(groupHealth(after, 1), 'a group of one is not a group').toBeNull();
    expect(after!.groupOf.every((g) => g === NO_GROUP), 'the survivor is loose').toBe(true);
  });

  it('splitting a group across bands ends the grouping', () => {
    const a = applyMoveAsGroup(null, hand.length, flush, NEW_SHELF, 2)!;
    // Move two of the five back to MAIN: the set-aside set no longer exists.
    const split = applyMove(a, hand.length, new Set([0, 1]), MAIN_AREA, 2)!;
    expect(groupHealth(split, 1)).toBeNull();
  });

  it('TWIN-SAFE: the group follows the SLOT, not the rank+suit', () => {
    // Two 5S; only the shelf's copy is in the group. Playing the MAIN copy must
    // leave the group's own member in place and still intact.
    const twins: Card[] = ['5S', '5S', '6S', '7S', '8S', '9S'];
    const a = applyMoveAsGroup(null, twins.length, new Set([1, 2, 3, 4, 5]), NEW_SHELF, 2)!;
    expect(groupHealth(a, 1)).toBe('intact');
    const next: Card[] = ['5S', '6S', '7S', '8S', '9S'];
    const after = remapAreas(a, twins, next, { slots: new Set([0]), hand: twins });
    expect(groupHealth(after, 1), 'the shelf keeps a WHOLE flush').toBe('intact');
    expect(slotsOfGroup(after, 1).length).toBe(5);
  });

  it('a group is NEVER authoritative: it carries no cards, only slot labels', () => {
    const a = applyMoveAsGroup(null, hand.length, flush, NEW_SHELF, 2)!;
    // The annotation is a parallel index map — there is no card list in it that
    // could disagree with the hand, which is what keeps it unable to mis-play.
    expect(a.groupOf.length).toBe(hand.length);
    expect(Object.keys(a)).toEqual(['areaOf', 'areaCount', 'groupOf', 'groupSize']);
  });
});

describe('COMMIT VALIDITY — a rejected action cannot delete cards later', () => {
  // Both audit lineages found this independently: holding the commit until the
  // hand changes fixed one hole and opened another. A rejected action leaves the
  // hand unchanged, so the commit stayed pending and still matched prevHand;
  // when the server later acted for an idle seat, the stale commit would be
  // applied and would remove slots nobody played.
  const prevHand: Card[] = ['5S', '5S', '6S', '7S', '8S', '9S'];
  const shelved: HandAreas = A([MAIN_AREA, 1, 1, 1, 1, 1], 2);

  it('a commit whose cards did NOT leave is ignored', () => {
    // The player tried to play the MAIN 5S; the server rejected it. Later the
    // server auto-plays the 9S for the idle seat. The stale commit names slot 0,
    // but 5S did not depart — only 9S did — so it must not be honoured.
    const next: Card[] = ['5S', '5S', '6S', '7S', '8S'];
    const stale = { slots: new Set([0]), hand: prevHand };
    const after = remapAreas(shelved, prevHand, next, stale);
    // Shelf-first fallback: MAIN gives up a 5S, the shelf keeps its four.
    expect(shape(after, next)).toEqual({ main: '5S', shelves: ['5S,6S,7S,8S'] });
  });

  it('a commit whose cards DID leave is still honoured', () => {
    const next: Card[] = ['5S', '6S', '7S', '8S', '9S'];
    const good = { slots: new Set([0]), hand: prevHand };
    expect(shape(remapAreas(shelved, prevHand, next, good), next)).toEqual({
      main: '',
      shelves: ['5S,6S,7S,8S,9S'],
    });
  });

  it('a PARTIALLY matching commit is rejected whole, never applied piecemeal', () => {
    const next: Card[] = ['5S', '5S', '6S', '7S', '8S'];
    const half = { slots: new Set([0, 5]), hand: prevHand }; // 5S stayed, 9S left
    const after = remapAreas(shelved, prevHand, next, half);
    expect(shape(after, next)).toEqual({ main: '5S', shelves: ['5S,6S,7S,8S'] });
  });
});
