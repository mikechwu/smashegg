// Tribute phase tests (spec docs/rules/guandan.md §7, v1.3).
// Hands here are minimal fixtures — the tribute functions never require the
// full 27 cards, only the multiset semantics.

import { describe, expect, it } from 'vitest';
import { seedPrng } from '../../../src/engine/core/prng';
import type { Card } from '../../../src/engine/guandan/cards';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { Hands } from '../../../src/engine/guandan/tribute';
import {
  applyAntiTributeDecision,
  applyPayTribute,
  applyReturnTribute,
  eligibleReturnCards,
  eligibleTributeCards,
  setupTribute,
} from '../../../src/engine/guandan/tribute';
import type { GuandanEvent, TributeState } from '../../../src/engine/guandan/types';

const cfg = (overrides: Partial<RuleVariant> = {}): RuleVariant => ({
  ...JIANGSU_OFFICIAL_ONLINE,
  ...overrides,
});

const hands4 = (h0: Card[], h1: Card[], h2: Card[], h3: Card[]): Hands => [h0, h1, h2, h3];

/** Unwrap an ok result or fail the test with the error. */
function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return result as Extract<T, { ok: true }>;
}

function errCode<T extends { ok: boolean }>(result: T): string {
  expect(result.ok).toBe(false);
  return (result as { ok: false; error: { code: string } }).error.code;
}

function tributeOf(setup: ReturnType<typeof setupTribute>): TributeState {
  expect(setup.kind).toBe('tribute');
  return (setup as { kind: 'tribute'; tribute: TributeState }).tribute;
}

// ---------------------------------------------------------------------------
// setupTribute: obligations (§7.1)
// ---------------------------------------------------------------------------

describe('setupTribute obligations', () => {
  const plainHands = hands4(['2S'], ['3S'], ['4S'], ['5S']);

  it('§7.1 1-2 double: both losers pay, 头游+二游 receive (payers 末游-first)', () => {
    // Teammates 0 and 2 finished 1st and 2nd; 1 was 三游, 3 was 末游.
    const setup = setupTribute([0, 2, 1, 3], plainHands, '2', cfg());
    const tribute = tributeOf(setup);
    expect(tribute.kind).toBe('double');
    expect(tribute.payers).toEqual([3, 1]);
    expect(tribute.receivers).toEqual([0, 2]);
  });

  it('§7.1 1-3 single: 末游 pays 头游', () => {
    const setup = setupTribute([0, 1, 2, 3], plainHands, '2', cfg());
    const tribute = tributeOf(setup);
    expect(tribute.kind).toBe('single');
    expect(tribute.payers).toEqual([3]);
    expect(tribute.receivers).toEqual([0]);
  });

  it('§7.1 1-4: the 末游 is the 头游 own partner and still pays', () => {
    // 头游 = 0, 末游 = 2 = partner of 0.
    const setup = setupTribute([0, 1, 3, 2], plainHands, '2', cfg());
    const tribute = tributeOf(setup);
    expect(tribute.kind).toBe('single');
    expect(tribute.payers).toEqual([2]);
    expect(tribute.receivers).toEqual([0]);
  });

  it('§5.8 normalizes a truncated finish order (hand ended when 3rd finished)', () => {
    // Only three finishers recorded; the missing seat 3 is the 末游.
    const setup = setupTribute([0, 1, 2], plainHands, '2', cfg());
    const tribute = tributeOf(setup);
    expect(tribute.payers).toEqual([3]);
    expect(tribute.receivers).toEqual([0]);
  });

  it('defensive: degenerate previous order yields kind none', () => {
    expect(setupTribute([], plainHands, '2', cfg()).kind).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// setupTribute: anti-tribute 抗贡 (§7.6, §9.19)
// ---------------------------------------------------------------------------

describe('setupTribute anti-tribute (auto mode)', () => {
  it('§7.6 single tribute: payer holding BOTH big jokers ⇒ 抗贡, 头游 leads', () => {
    const hands = hands4(['AS'], ['KS'], ['QS'], ['BJ', 'BJ', '2S']);
    const setup = setupTribute([0, 1, 2, 3], hands, '2', cfg());
    expect(setup.kind).toBe('anti');
    if (setup.kind !== 'anti') return;
    expect(setup.reveals).toEqual([
      { seat: 3, card: 'BJ' },
      { seat: 3, card: 'BJ' },
    ]);
    // §7.6 effect: no tribute, no return — the setup carries no TributeState
    // at all — and the previous 头游 leads.
    expect(setup.leader).toBe(0);
  });

  it('§7.6 double tribute: big jokers split ACROSS the two payers ⇒ 抗贡 for both', () => {
    const hands = hands4(['AS'], ['BJ', 'KS'], ['QS'], ['BJ', '2S']);
    const setup = setupTribute([0, 2, 1, 3], hands, '2', cfg());
    expect(setup.kind).toBe('anti');
    if (setup.kind !== 'anti') return;
    expect(setup.leader).toBe(0);
    const sorted = setup.reveals.slice().sort((a, b) => a.seat - b.seat);
    expect(sorted).toEqual([
      { seat: 1, card: 'BJ' },
      { seat: 3, card: 'BJ' },
    ]);
  });

  it('§7.6 reveal contains ONLY the two big jokers — nothing else from those hands', () => {
    const hands = hands4(['AS'], ['KS'], ['QS'], ['BJ', 'BJ', 'SJ', 'AS', '2H']);
    const setup = setupTribute([0, 1, 2, 3], hands, '2', cfg());
    expect(setup.kind).toBe('anti');
    if (setup.kind !== 'anti') return;
    expect(setup.reveals).toHaveLength(2);
    for (const reveal of setup.reveals) expect(reveal.card).toBe('BJ');
  });

  it('§7.6 one big joker among the payers is NOT enough — normal tribute', () => {
    // The other BJ sits with a receiver, so the payers do not collectively
    // hold both.
    const hands = hands4(['BJ', 'AS'], ['KS'], ['QS'], ['BJ', '2S']);
    const setup = setupTribute([0, 1, 2, 3], hands, '2', cfg());
    expect(setup.kind).toBe('tribute');
  });

  it('§9.19 the check runs on the NEWLY DEALT hands passed in', () => {
    // Same finish order; whether 抗贡 fires depends solely on the hands
    // argument (the previous hand leftovers are never consulted).
    const withJokers = hands4(['AS'], ['KS'], ['QS'], ['BJ', 'BJ']);
    const without = hands4(['AS'], ['KS'], ['QS'], ['SJ', 'SJ']);
    expect(setupTribute([0, 1, 2, 3], withJokers, '2', cfg()).kind).toBe('anti');
    expect(setupTribute([0, 1, 2, 3], without, '2', cfg()).kind).toBe('tribute');
  });
});

describe('setupTribute anti-tribute (optional mode) + applyAntiTributeDecision', () => {
  const optional = cfg({ antiTributeMode: 'optional' });
  const prevOrder = [0, 2, 1, 3]; // double: payers [3, 1], receivers [0, 2]
  const splitHands = hands4(['AS'], ['BJ', 'KS'], ['QS'], ['BJ', '2S']);
  const soloHands = hands4(['AS'], ['KS'], ['QS'], ['BJ', 'BJ', '2S']);

  it('§7.6 optional mode returns kind decision with the qualifying payers (decide-before-reveal)', () => {
    const setup = setupTribute(prevOrder, splitHands, '2', optional);
    expect(setup.kind).toBe('decision');
    if (setup.kind !== 'decision') return;
    // Both payers hold one BJ each → both must decide.
    expect(setup.payers.slice().sort()).toEqual([1, 3]);
  });

  it('§7.6 a single holder of both jokers decides alone; invoke resolves to anti', () => {
    const setup = setupTribute([0, 1, 2, 3], soloHands, '2', optional);
    expect(setup.kind).toBe('decision');
    if (setup.kind !== 'decision') return;
    expect(setup.payers).toEqual([3]);
    const result = ok(applyAntiTributeDecision(setup, 3, true, [0, 1, 2, 3], soloHands, optional));
    expect(result.outcome.kind).toBe('anti');
    if (result.outcome.kind !== 'anti') return;
    expect(result.outcome.leader).toBe(0);
    expect(result.outcome.reveals).toEqual([
      { seat: 3, card: 'BJ' },
      { seat: 3, card: 'BJ' },
    ]);
  });

  it('§7.6 split pair: unanimity required — first invoke stays pending, second resolves to anti', () => {
    const setup = setupTribute(prevOrder, splitHands, '2', optional);
    if (setup.kind !== 'decision') throw new Error('expected decision');
    const first = ok(applyAntiTributeDecision(setup, 3, true, prevOrder, splitHands, optional));
    expect(first.outcome.kind).toBe('pending');
    if (first.outcome.kind !== 'pending') return;
    const second = ok(
      applyAntiTributeDecision(first.outcome.pending, 1, true, prevOrder, splitHands, optional)
    );
    expect(second.outcome.kind).toBe('anti');
    if (second.outcome.kind !== 'anti') return;
    expect(second.outcome.leader).toBe(0);
    expect(second.outcome.reveals).toHaveLength(2);
  });

  it('§7.6 decline reveals nothing and falls through to the normal tribute flow', () => {
    const setup = setupTribute(prevOrder, splitHands, '2', optional);
    if (setup.kind !== 'decision') throw new Error('expected decision');
    const result = ok(applyAntiTributeDecision(setup, 3, false, prevOrder, splitHands, optional));
    expect(result.outcome.kind).toBe('tribute');
    if (result.outcome.kind !== 'tribute') return;
    expect(result.outcome.tribute.payers).toEqual([3, 1]);
    expect(result.outcome.tribute.receivers).toEqual([0, 2]);
    // Nothing revealed: the outcome carries no reveals at all.
    expect(JSON.stringify(result.outcome)).not.toContain('BJ');
  });

  it('§7.6 split pair: one invokes then the other declines ⇒ tribute (not unanimous)', () => {
    const setup = setupTribute(prevOrder, splitHands, '2', optional);
    if (setup.kind !== 'decision') throw new Error('expected decision');
    const first = ok(applyAntiTributeDecision(setup, 1, true, prevOrder, splitHands, optional));
    if (first.outcome.kind !== 'pending') throw new Error('expected pending');
    const second = ok(
      applyAntiTributeDecision(first.outcome.pending, 3, false, prevOrder, splitHands, optional)
    );
    expect(second.outcome.kind).toBe('tribute');
  });

  it('rejects a non-decider and a repeated decision', () => {
    const setup = setupTribute(prevOrder, splitHands, '2', optional);
    if (setup.kind !== 'decision') throw new Error('expected decision');
    expect(errCode(applyAntiTributeDecision(setup, 0, true, prevOrder, splitHands, optional))).toBe(
      'antiTribute.notADecider'
    );
    const first = ok(applyAntiTributeDecision(setup, 1, true, prevOrder, splitHands, optional));
    if (first.outcome.kind !== 'pending') throw new Error('expected pending');
    expect(
      errCode(applyAntiTributeDecision(first.outcome.pending, 1, true, prevOrder, splitHands, optional))
    ).toBe('antiTribute.alreadyDecided');
  });
});

// ---------------------------------------------------------------------------
// eligibleTributeCards (§7.2, §4.3)
// ---------------------------------------------------------------------------

describe('eligibleTributeCards', () => {
  it('§7.2 highest rank by levelValue, excluding wilds — every copy at that rank', () => {
    expect(eligibleTributeCards(['KS', 'KS', 'KH', 'QD', '3C'], '2')).toEqual(['KS', 'KS', 'KH']);
  });

  it('§7.2/§4.3 non-heart level cards ARE eligible and outrank A', () => {
    // Level 7: 7S has levelValue 15 > A(14); the heart 7 is the wild.
    expect(eligibleTributeCards(['7H', '7S', 'AS', 'AD'], '7')).toEqual(['7S']);
  });

  it('§7.2 a single big joker is the forced tribute card', () => {
    expect(eligibleTributeCards(['BJ', 'AS', '7S'], '2')).toEqual(['BJ']);
  });

  it('§4.3 wilds never set the forced rank nor appear in the set', () => {
    // Both wilds held: the forced rank falls to the best non-wild card.
    expect(eligibleTributeCards(['7H', '7H', '5S', '3D'], '7')).toEqual(['5S']);
  });

  it('§7.2 small joker eligible when it is the highest non-wild', () => {
    expect(eligibleTributeCards(['SJ', 'AS', '2H'], '2')).toEqual(['SJ']);
  });
});

// ---------------------------------------------------------------------------
// eligibleReturnCards (§7.4)
// ---------------------------------------------------------------------------

describe('eligibleReturnCards', () => {
  it('§7.4 the levelValue ≤ 10 set (excludes J/Q/K/A, jokers, level cards)', () => {
    const hand: Card[] = ['2S', '9D', 'TS', 'JC', 'AS', 'SJ'];
    expect(eligibleReturnCards(hand, '5', cfg(), 'AS')).toEqual(['2S', '9D', 'TS']);
  });

  it("§7.4 level='T': no 'T' is returnable (levelValue 15 falls out of ≤10)", () => {
    const hand: Card[] = ['TS', 'TD', '9C', '8H', 'JC'];
    expect(eligibleReturnCards(hand, 'T', cfg(), 'JC')).toEqual(['9C', '8H']);
  });

  it('§7.4 no qualifying card: lowestByLevelValue returns all copies tied at the minimum', () => {
    const hand: Card[] = ['JS', 'JD', 'QH', 'KC', 'AS'];
    expect(eligibleReturnCards(hand, '2', cfg(), 'AS')).toEqual(['JS', 'JD']);
  });

  it('§7.4 no qualifying card: anyCard policy returns the whole hand', () => {
    const hand: Card[] = ['JS', 'QH', 'KC', 'AS'];
    expect(
      eligibleReturnCards(hand, '2', cfg({ returnNoLowCardPolicy: 'anyCard' }), 'AS')
    ).toEqual(hand);
  });

  it('§7.4 returnTributeMaxRank=null: any card except the received tribute card itself', () => {
    const nullCfg = cfg({ returnTributeMaxRank: null });
    expect(eligibleReturnCards(['AS', 'KD', '2C'], '2', nullCfg, 'AS')).toEqual(['KD', '2C']);
    // A duplicate identity from the second deck remains returnable.
    expect(eligibleReturnCards(['AS', 'AS', 'KD'], '2', nullCfg, 'AS')).toEqual(['AS', 'KD']);
  });
});

// ---------------------------------------------------------------------------
// applyPayTribute (§7.2/§7.3): staging, atomic reveal, assignment
// ---------------------------------------------------------------------------

// Double-tribute fixture: previous 1-2 by team {0,2} → payers [3,1],
// receivers [0,2]; hand plays at level 5 (wild = 5H).
const doubleOrder = [0, 2, 1, 3];
const doubleHands = (): Hands =>
  hands4(['9C', '3S', 'JD'], ['AS', 'AD', 'KC'], ['8D', '2H', 'QS'], ['KS', 'QD', '2C']);

function doubleTribute(config: RuleVariant): TributeState {
  return tributeOf(setupTribute(doubleOrder, doubleHands(), '5', config));
}

describe('applyPayTribute', () => {
  it('§7.3 staging leaks nothing: first commit emits only the card-less marker', () => {
    const hands = doubleHands();
    const result = ok(applyPayTribute(doubleTribute(cfg()), 1, 'AS', hands, '5', cfg(), seedPrng('x')));
    expect(result.events).toEqual([{ type: 'tributeCommitted', seat: 1 }]);
    // No card string anywhere in the emitted events.
    expect(JSON.stringify(result.events)).not.toContain('AS');
    expect(result.tribute.paid).toBeNull();
    // Cards do not move until the atomic resolution.
    expect(result.hands).toEqual(hands);
  });

  it('§7.1/§7.3 double resolve: higher card to 头游, lower to 二游, ONE atomic tributePaid', () => {
    const hands = doubleHands();
    const config = cfg();
    const prng = seedPrng('x');
    const first = ok(applyPayTribute(doubleTribute(config), 1, 'AS', hands, '5', config, prng));
    const second = ok(applyPayTribute(first.tribute, 3, 'KS', first.hands, '5', config, first.prng));
    const paidEvents = second.events.filter((e: GuandanEvent) => e.type === 'tributePaid');
    expect(paidEvents).toHaveLength(1);
    // A(14) > K(13): seat 1's ace goes to 头游 0, seat 3's king to 二游 2.
    expect(second.tribute.paid).toEqual([
      { from: 1, to: 0, card: 'AS' },
      { from: 3, to: 2, card: 'KS' },
    ]);
    // Cards moved between hands.
    expect(second.hands[0]).toContain('AS');
    expect(second.hands[1]).toEqual(['AD', 'KC']);
    expect(second.hands[2]).toContain('KS');
    expect(second.hands[3]).toEqual(['QD', '2C']);
  });

  it('§7.1 single tribute resolves on the only commit, to 头游', () => {
    const hands = hands4(['9C', '3S'], ['4S'], ['6S'], ['KS', 'KH', '2C']);
    const tribute = tributeOf(setupTribute([0, 1, 2, 3], hands, '5', cfg()));
    const result = ok(applyPayTribute(tribute, 3, 'KH', hands, '5', cfg(), seedPrng('x')));
    expect(result.tribute.paid).toEqual([{ from: 3, to: 0, card: 'KH' }]);
    expect(result.events.map((e: GuandanEvent) => e.type)).toEqual([
      'tributeCommitted',
      'tributePaid',
    ]);
    expect(result.hands[0]).toContain('KH');
    expect(result.hands[3]).toEqual(['KS', '2C']);
  });

  it('§7.2 payer chooses among copies at the forced rank (set membership, not one card)', () => {
    const config = cfg();
    // Seat 1 holds AS and AD at the forced rank — either commits fine.
    const viaAD = ok(
      applyPayTribute(doubleTribute(config), 1, 'AD', doubleHands(), '5', config, seedPrng('x'))
    );
    expect(viaAD.tribute.staged[1]).toBe('AD');
  });

  const equalHands = (): Hands =>
    hands4(['9C', '3S'], ['AS', 'KC'], ['8D', '2H'], ['AD', 'QD']);

  it('§7.3 equal tribute, seatOrder, counterclockwise: 头游 receives from its 下家 payer', () => {
    const config = cfg({ equalTributeAssignment: 'seatOrder', turnDirection: 'counterclockwise' });
    const tribute = tributeOf(setupTribute(doubleOrder, equalHands(), '5', config));
    const prng = seedPrng('x');
    const first = ok(applyPayTribute(tribute, 1, 'AS', equalHands(), '5', config, prng));
    const second = ok(applyPayTribute(first.tribute, 3, 'AD', first.hands, '5', config, first.prng));
    // 头游 = 0; counterclockwise 下家 chain 1,2,3 → payer 1 reached first.
    expect(second.tribute.paid).toEqual([
      { from: 1, to: 0, card: 'AS' },
      { from: 3, to: 2, card: 'AD' },
    ]);
    // seatOrder consumes no randomness.
    expect(second.prng).toEqual(prng);
  });

  it('§7.3 equal tribute, seatOrder, clockwise: the walk follows turnDirection', () => {
    const config = cfg({ equalTributeAssignment: 'seatOrder', turnDirection: 'clockwise' });
    const tribute = tributeOf(setupTribute(doubleOrder, equalHands(), '5', config));
    const first = ok(applyPayTribute(tribute, 1, 'AS', equalHands(), '5', config, seedPrng('x')));
    const second = ok(applyPayTribute(first.tribute, 3, 'AD', first.hands, '5', config, first.prng));
    // 头游 = 0; clockwise 下家 chain 3,2,1 → payer 3 reached first.
    expect(second.tribute.paid).toEqual([
      { from: 3, to: 0, card: 'AD' },
      { from: 1, to: 2, card: 'AS' },
    ]);
  });

  it('§7.3 equal tribute, random: deterministic under a fixed PrngState and advances it', () => {
    const config = cfg({ equalTributeAssignment: 'random' });
    const prng = seedPrng('equal-tribute');
    const run = () => {
      const tribute = tributeOf(setupTribute(doubleOrder, equalHands(), '5', config));
      const first = ok(applyPayTribute(tribute, 1, 'AS', equalHands(), '5', config, prng));
      return ok(applyPayTribute(first.tribute, 3, 'AD', first.hands, '5', config, first.prng));
    };
    const a = run();
    const b = run();
    expect(a.tribute.paid).toEqual(b.tribute.paid);
    expect(a.prng).toEqual(b.prng);
    // The draw advanced the PRNG state.
    expect(a.prng).not.toEqual(prng);
    // Whatever the draw, 头游 got one card and 二游 the other.
    expect(a.tribute.paid!.map((p) => p.to).sort()).toEqual([0, 2]);
  });

  it('§7.3 equal tribute, winnersChoose: surfaces config.notImplemented (M1 limitation)', () => {
    const config = cfg({ equalTributeAssignment: 'winnersChoose' });
    const tribute = tributeOf(setupTribute(doubleOrder, equalHands(), '5', config));
    const first = ok(applyPayTribute(tribute, 1, 'AS', equalHands(), '5', config, seedPrng('x')));
    const second = applyPayTribute(first.tribute, 3, 'AD', first.hands, '5', config, first.prng);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toEqual({
      code: 'config.notImplemented',
      params: { key: 'equalTributeAssignment', value: 'winnersChoose' },
    });
  });

  it('§7.2 rejects a card outside the eligible set (tribute.cardNotEligible)', () => {
    // KC is not at the forced rank (A) for seat 1.
    const result = applyPayTribute(doubleTribute(cfg()), 1, 'KC', doubleHands(), '5', cfg(), seedPrng('x'));
    expect(errCode(result)).toBe('tribute.cardNotEligible');
  });

  it('§4.3 rejects paying a wild even at the forced rank', () => {
    // Level 5: seat 3 holds the wild 5H plus 5S; forced rank is 5 (via 5S),
    // but the wild itself may never be tributed.
    const hands = hands4(['2C'], ['3C'], ['4C'], ['5H', '5S', '2D']);
    const tribute = tributeOf(setupTribute([0, 1, 2, 3], hands, '5', cfg()));
    expect(errCode(applyPayTribute(tribute, 3, '5H', hands, '5', cfg(), seedPrng('x')))).toBe(
      'tribute.cardNotEligible'
    );
    ok(applyPayTribute(tribute, 3, '5S', hands, '5', cfg(), seedPrng('x')));
  });

  it('rejects a non-payer, a double commit, and a commit after resolution', () => {
    const config = cfg();
    const tribute = doubleTribute(config);
    const hands = doubleHands();
    expect(errCode(applyPayTribute(tribute, 0, '9C', hands, '5', config, seedPrng('x')))).toBe(
      'tribute.notAPayer'
    );
    const first = ok(applyPayTribute(tribute, 1, 'AS', hands, '5', config, seedPrng('x')));
    expect(errCode(applyPayTribute(first.tribute, 1, 'AD', first.hands, '5', config, first.prng))).toBe(
      'tribute.alreadyCommitted'
    );
    const second = ok(applyPayTribute(first.tribute, 3, 'KS', first.hands, '5', config, first.prng));
    expect(
      errCode(applyPayTribute(second.tribute, 3, 'QD', second.hands, '5', config, second.prng))
    ).toBe('tribute.alreadyPaid');
  });
});

// ---------------------------------------------------------------------------
// applyReturnTribute (§7.4/§7.5): staging, 对应 pairing, leader
// ---------------------------------------------------------------------------

/** Run the full double-tribute payment so returns can start. */
function paidDouble(config: RuleVariant): { tribute: TributeState; hands: Hands } {
  const tribute = doubleTribute(config);
  const first = ok(applyPayTribute(tribute, 1, 'AS', doubleHands(), '5', config, seedPrng('x')));
  const second = ok(applyPayTribute(first.tribute, 3, 'KS', first.hands, '5', config, first.prng));
  return { tribute: second.tribute, hands: second.hands };
}

describe('applyReturnTribute', () => {
  it('§7.3 return staging leaks nothing: first commit emits only the card-less marker', () => {
    const config = cfg();
    const { tribute, hands } = paidDouble(config);
    const result = ok(applyReturnTribute(tribute, 0, '3S', hands, '5', config));
    expect(result.events).toEqual([{ type: 'tributeCommitted', seat: 0 }]);
    expect(JSON.stringify(result.events)).not.toContain('3S');
    expect(result.tribute.returned).toBeNull();
    expect(result.hands).toEqual(hands);
  });

  it('§7.4/§7.5 double resolve: 对应 pairing (each receiver returns to their payer), ONE atomic event, leader = payer of 头游 card', () => {
    const config = cfg();
    const { tribute, hands } = paidDouble(config);
    const first = ok(applyReturnTribute(tribute, 0, '3S', hands, '5', config));
    const second = ok(applyReturnTribute(first.tribute, 2, '8D', first.hands, '5', config));
    const returnedEvents = second.events.filter((e: GuandanEvent) => e.type === 'tributeReturned');
    expect(returnedEvents).toHaveLength(1);
    // Paid: 1→0 (AS), 3→2 (KS). 对应 return: 0→1, 2→3.
    expect(second.tribute.returned).toEqual([
      { from: 0, to: 1, card: '3S' },
      { from: 2, to: 3, card: '8D' },
    ]);
    // §7.5: 头游 (seat 0) received seat 1's card ⇒ seat 1 leads.
    expect(second.tribute.leader).toBe(1);
    // Cards moved.
    expect(second.hands[1]).toContain('3S');
    expect(second.hands[0]).not.toContain('3S');
    expect(second.hands[3]).toContain('8D');
    expect(second.hands[2]).not.toContain('8D');
  });

  it('§7.5 single tribute: the payer (末游) leads after the return', () => {
    const config = cfg();
    const hands = hands4(['9C', '3S'], ['4S'], ['6S'], ['KS', 'KH', '2C']);
    const tribute = tributeOf(setupTribute([0, 1, 2, 3], hands, '5', config));
    const paid = ok(applyPayTribute(tribute, 3, 'KS', hands, '5', config, seedPrng('x')));
    const returned = ok(applyReturnTribute(paid.tribute, 0, '3S', paid.hands, '5', config));
    expect(returned.tribute.returned).toEqual([{ from: 0, to: 3, card: '3S' }]);
    expect(returned.tribute.leader).toBe(3);
  });

  it('§7.4 rejects a return card outside the eligible set (e.g. levelValue > 10)', () => {
    const config = cfg();
    const { tribute, hands } = paidDouble(config);
    // Seat 0 now holds 9C, 3S, JD, AS — J and A are not returnable.
    expect(errCode(applyReturnTribute(tribute, 0, 'JD', hands, '5', config))).toBe(
      'tribute.cardNotEligible'
    );
  });

  it('rejects returning before payment resolved, from a non-receiver, twice, or after resolution', () => {
    const config = cfg();
    const unpaid = doubleTribute(config);
    expect(errCode(applyReturnTribute(unpaid, 0, '3S', doubleHands(), '5', config))).toBe(
      'tribute.notPaidYet'
    );
    const { tribute, hands } = paidDouble(config);
    expect(errCode(applyReturnTribute(tribute, 1, 'AD', hands, '5', config))).toBe(
      'tribute.notAReceiver'
    );
    const first = ok(applyReturnTribute(tribute, 0, '3S', hands, '5', config));
    expect(errCode(applyReturnTribute(first.tribute, 0, '9C', first.hands, '5', config))).toBe(
      'tribute.alreadyCommitted'
    );
    const second = ok(applyReturnTribute(first.tribute, 2, '8D', first.hands, '5', config));
    expect(errCode(applyReturnTribute(second.tribute, 2, '2H', second.hands, '5', config))).toBe(
      'tribute.alreadyReturned'
    );
  });

  it('§7.4 fallback: receiver with no ≤10 card returns the lowest by levelValue', () => {
    const config = cfg();
    const hands = hands4(['JS', 'JD', 'QH', 'AS'], ['4S'], ['6S'], ['KS', '2C']);
    const tribute = tributeOf(setupTribute([0, 1, 2, 3], hands, '5', config));
    const paid = ok(applyPayTribute(tribute, 3, 'KS', hands, '5', config, seedPrng('x')));
    // Hand is now JS JD QH AS KS — nothing ≤ 10; lowest is J (both copies).
    expect(errCode(applyReturnTribute(paid.tribute, 0, 'QH', paid.hands, '5', config))).toBe(
      'tribute.cardNotEligible'
    );
    const returned = ok(applyReturnTribute(paid.tribute, 0, 'JD', paid.hands, '5', config));
    expect(returned.tribute.returned).toEqual([{ from: 0, to: 3, card: 'JD' }]);
  });
});

// ---------------------------------------------------------------------------
// Purity: inputs are never mutated.
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('applyPayTribute and applyReturnTribute never mutate their inputs', () => {
    const config = cfg();
    const hands = doubleHands();
    const handsSnapshot = JSON.parse(JSON.stringify(hands));
    const tribute = doubleTribute(config);
    const tributeSnapshot = JSON.parse(JSON.stringify(tribute));
    const prng = seedPrng('x');
    const prngSnapshot = { ...prng };

    const first = ok(applyPayTribute(tribute, 1, 'AS', hands, '5', config, prng));
    const second = ok(applyPayTribute(first.tribute, 3, 'KS', first.hands, '5', config, first.prng));
    ok(applyReturnTribute(second.tribute, 0, '3S', second.hands, '5', config));

    expect(hands).toEqual(handsSnapshot);
    expect(tribute).toEqual(tributeSnapshot);
    expect(prng).toEqual(prngSnapshot);
  });
});
