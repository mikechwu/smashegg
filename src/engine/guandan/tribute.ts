// Tribute phase (spec docs/rules/guandan.md §7, v1.3): who pays, the forced
// rank with player CHOICE of concrete card (§7.2), staged commits with an
// ATOMIC reveal (§7.3), the corresponding return pairing (§7.4/§7.5), and anti-tribute
// anti-tribute with its mandatory public reveal (§7.6).
//
// Pure functions in/out: nothing here mutates its inputs; hands and tribute
// state are rebuilt on every transition. Randomness (only the 'random'
// equal-tribute assignment) threads a PrngState through explicitly.

import type { RuleError, Seat } from '../core/game';
import type { PrngState } from '../core/prng';
import { nextInt } from '../core/prng';
import type { Card, Rank } from './cards';
import { isWild, levelValue } from './cards';
import type { RuleVariant } from './config';
import type { GuandanEvent, TributePairing, TributeState } from './types';
import { nextSeat, teamOf } from './types';

export type Hands = [Card[], Card[], Card[], Card[]];

// ---------------------------------------------------------------------------
// Setup: derive obligations from the previous finish order, then check anti-tribute.
// ---------------------------------------------------------------------------

/** Pending `optional`-mode anti-tribute decision (spec §7.6 state machine):
 *  the qualifying payers (holders of ≥1 big joker) decide BEFORE any tribute
 *  is paid; nothing is revealed while deciding. */
export interface AntiTributeDecisionPending {
  kind: 'decision';
  /** The deciders: payers holding at least one big joker. */
  payers: Seat[];
  /** Invoke decisions committed so far, keyed by seat. Only `true` is ever
   *  stored — a decline resolves the machine immediately (unanimity is
   *  already broken), so it never needs recording. */
  decisions: Partial<Record<number, boolean>>;
}

export type TributeSetup =
  | { kind: 'none'; leader: Seat }
  | { kind: 'anti'; reveals: { seat: Seat; card: Card }[]; leader: Seat }
  | AntiTributeDecisionPending
  | { kind: 'tribute'; tribute: TributeState };

/** Tribute obligations derived from a previous finish order (spec §7.1). */
interface Obligations {
  double: boolean;
  /** 4th finisher first, then 3rd finisher for double tribute (matches TributeState docs). */
  payers: Seat[];
  /** 1st finisher first, then 2nd finisher for double tribute. */
  receivers: Seat[];
}

/** A hand can end with only 2 (1-2 finish) or 3 seats recorded (spec §5.8); the
 *  missing seats are appended in ascending seat order. For 1-3 the single
 *  missing seat is exactly the 4th finisher; for 1-2 the order between the two
 *  losers never matters (both pay, assignment is by card rank — §7.1). */
function normalizeFinishOrder(prevFinishOrder: readonly Seat[]): Seat[] {
  const order = prevFinishOrder.slice();
  for (let seat = 0; seat < 4; seat++) {
    if (!order.includes(seat)) order.push(seat);
  }
  return order;
}

function deriveObligations(order: Seat[]): Obligations {
  // spec §7.1: 1-2 (first two finishers are teammates) → both losers pay,
  // 1st finisher and 2nd finisher receive; otherwise (1-3 / 1-4) the 4th finisher pays the 1st finisher —
  // including the 1-4 case where the 4th finisher is the 1st finisher's own partner.
  const double = teamOf(order[0]!) === teamOf(order[1]!);
  return double
    ? { double, payers: [order[3]!, order[2]!], receivers: [order[0]!, order[1]!] }
    : { double, payers: [order[3]!], receivers: [order[0]!] };
}

function buildTributeState(obligations: Obligations): TributeState {
  return {
    kind: obligations.double ? 'double' : 'single',
    payers: obligations.payers,
    receivers: obligations.receivers,
    staged: {},
    paid: null,
    returnsStaged: {},
    returned: null,
    leader: null,
  };
}

/** One entry per big-joker COPY held by a payer (a single payer holding
 *  both yields two entries). This is exactly the §7.6 mandatory reveal set:
 *  the qualifying big jokers with holder attribution, and nothing else. */
function bigJokerReveals(payers: Seat[], hands: Readonly<Hands>): { seat: Seat; card: Card }[] {
  const reveals: { seat: Seat; card: Card }[] = [];
  for (const seat of payers) {
    for (const card of hands[seat]!) {
      if (card === 'BJ') reveals.push({ seat, card });
    }
  }
  return reveals;
}

/**
 * Derive the tribute situation for a new hand from the PREVIOUS hand's
 * finish order and the NEWLY DEALT hands (spec §7.2/§9.19 — leftover cards
 * from the previous hand are never consulted).
 */
export function setupTribute(
  prevFinishOrder: Seat[],
  hands: Readonly<Hands>,
  level: Rank,
  config: RuleVariant
): TributeSetup {
  // Defensive: with fewer than 2 recorded finishers the 1-2 vs 1-3/1-4
  // pattern is undecidable — callers should not reach here for hand 1.
  if (prevFinishOrder.length < 2) {
    return { kind: 'none', leader: prevFinishOrder[0] ?? 0 };
  }
  const order = normalizeFinishOrder(prevFinishOrder);
  const obligations = deriveObligations(order);

  // spec §7.6: anti-tribute when the payers COLLECTIVELY hold both big
  // jokers (one each, or one payer holding both). Exactly two BJ exist in
  // the deck, so "both" ⇔ the payers hold 2 BJ copies between them.
  const reveals = bigJokerReveals(obligations.payers, hands);
  if (reveals.length === 2) {
    if (config.antiTributeMode === 'auto') {
      // spec §7.6 effect: no tribute, no return, previous 1st finisher leads —
      // with the mandatory public reveal of the qualifying jokers.
      return { kind: 'anti', reveals, leader: order[0]! };
    }
    // 'optional' mode (spec §7.6 state machine): the holders decide before
    // anything is revealed; a split pair requires unanimity.
    const deciders = obligations.payers.filter((seat) =>
      hands[seat]!.some((card) => card === 'BJ')
    );
    return { kind: 'decision', payers: deciders, decisions: {} };
  }

  return { kind: 'tribute', tribute: buildTributeState(obligations) };
}

// ---------------------------------------------------------------------------
// Optional-mode anti-tribute decision machine (spec §7.6).
// ---------------------------------------------------------------------------

export type AntiTributeDecisionResult =
  | { ok: false; error: RuleError }
  | {
      ok: true;
      outcome:
        | { kind: 'pending'; pending: AntiTributeDecisionPending }
        | { kind: 'anti'; reveals: { seat: Seat; card: Card }[]; leader: Seat }
        | { kind: 'tribute'; tribute: TributeState };
    };

/**
 * Advance the `optional`-mode machine with one decider's choice.
 * - invoke=false: unanimity is broken the moment anyone declines, so the
 *   machine resolves immediately to the normal tribute flow and NOTHING is
 *   revealed (spec §7.6: "decline reveals nothing").
 * - invoke=true: recorded; when ALL qualifying payers have invoked, the
 *   standard public reveal fires and tribute is cancelled.
 */
export function applyAntiTributeDecision(
  pending: AntiTributeDecisionPending,
  seat: Seat,
  invoke: boolean,
  prevFinishOrder: Seat[],
  hands: Readonly<Hands>,
  config: RuleVariant
): AntiTributeDecisionResult {
  if (!pending.payers.includes(seat)) {
    return { ok: false, error: { code: 'antiTribute.notADecider', params: { seat } } };
  }
  if (pending.decisions[seat] !== undefined) {
    return { ok: false, error: { code: 'antiTribute.alreadyDecided', params: { seat } } };
  }

  const order = normalizeFinishOrder(prevFinishOrder);
  const obligations = deriveObligations(order);

  if (!invoke) {
    // Decline → not unanimous → normal tribute proceeds, nothing revealed.
    return { ok: true, outcome: { kind: 'tribute', tribute: buildTributeState(obligations) } };
  }

  const decisions = { ...pending.decisions, [seat]: true };
  const allInvoked = pending.payers.every((payer) => decisions[payer] === true);
  if (!allInvoked) {
    return {
      ok: true,
      outcome: { kind: 'pending', pending: { kind: 'decision', payers: pending.payers, decisions } },
    };
  }

  // All qualifying payers invoked → the same reveal + effect as auto mode.
  return {
    ok: true,
    outcome: {
      kind: 'anti',
      reveals: bigJokerReveals(obligations.payers, hands),
      leader: order[0]!,
    },
  };
}

// ---------------------------------------------------------------------------
// Eligible sets (spec §7.2 / §7.4): the rank is forced, the card is a choice.
// ---------------------------------------------------------------------------

/**
 * Every held copy at the forced tribute rank: the highest levelValue over
 * the hand EXCLUDING wilds (spec §7.2/§4.3). Non-heart level cards and
 * single jokers ARE eligible ranks; the heart wilds are never tributable
 * and never set the forced rank.
 */
export function eligibleTributeCards(hand: readonly Card[], level: Rank): Card[] {
  let best = -1;
  for (const card of hand) {
    if (isWild(card, level)) continue; // spec §4.3: wilds excluded outright
    const value = levelValue(card, level);
    if (value > best) best = value;
  }
  return hand.filter((card) => !isWild(card, level) && levelValue(card, level) === best);
}

/**
 * Eligible return-tribute cards (spec §7.4):
 * - returnTributeMaxRank=10: the `levelValue ≤ 10` set — this single test
 *   excludes wilds, level cards, jokers and J/Q/K/A by construction (a
 *   level-'T' hand has NO returnable 'T': its levelValue is 15).
 *   When the set is empty, the fallback is per returnNoLowCardPolicy:
 *   'lowestByLevelValue' (official rule: if all cards are above 10, return the lowest card) → all
 *   copies tied at the minimum levelValue; 'anyCard' → the whole hand.
 * - returnTributeMaxRank=null (pagat variant): any card except the received
 *   tribute card itself (one physical copy — a duplicate identity from the
 *   second deck remains returnable).
 */
export function eligibleReturnCards(
  hand: readonly Card[],
  level: Rank,
  config: RuleVariant,
  receivedCard: Card
): Card[] {
  if (config.returnTributeMaxRank === null) {
    const remaining = hand.slice();
    const i = remaining.indexOf(receivedCard);
    if (i >= 0) remaining.splice(i, 1);
    return remaining;
  }

  const qualifying = hand.filter((card) => levelValue(card, level) <= config.returnTributeMaxRank!);
  if (qualifying.length > 0) return qualifying;

  // No qualifying card (spec §7.4 fallback — scoped to this case only).
  if (config.returnNoLowCardPolicy === 'anyCard') return hand.slice();
  let min = Infinity;
  for (const card of hand) min = Math.min(min, levelValue(card, level));
  return hand.filter((card) => levelValue(card, level) === min);
}

// ---------------------------------------------------------------------------
// Paying tribute: staged commits, atomic resolution (spec §7.2/§7.3).
// ---------------------------------------------------------------------------

export type PayTributeResult =
  | { ok: false; error: RuleError }
  | { ok: true; tribute: TributeState; hands: Hands; events: GuandanEvent[]; prng: PrngState };

/** Move each pairing's card from payer to recipient; null if a card is
 *  missing (cannot happen after eligibility validation — defensive only). */
function moveCards(hands: Readonly<Hands>, pairings: TributePairing[]): Hands | null {
  const out: Hands = [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()];
  for (const pairing of pairings) {
    const i = out[pairing.from]!.indexOf(pairing.card);
    if (i < 0) return null;
    out[pairing.from]!.splice(i, 1);
    out[pairing.to]!.push(pairing.card);
  }
  return out;
}

/**
 * One payer commits their tribute card. Commits are STAGED: the emitted
 * event is the card-less 'tributeCommitted' marker only (spec §7.3 — no
 * sequential information leak). When the last payer commits, the assignment
 * resolves atomically: cards move and ONE 'tributePaid' event carries all
 * pairings. Double tribute sends the higher card to 1st finisher; equal cards
 * resolve per equalTributeAssignment.
 */
export function applyPayTribute(
  tribute: TributeState,
  seat: Seat,
  card: Card,
  hands: Readonly<Hands>,
  level: Rank,
  config: RuleVariant,
  prng: PrngState
): PayTributeResult {
  if (tribute.paid !== null) {
    return { ok: false, error: { code: 'tribute.alreadyPaid', params: { seat } } };
  }
  if (!tribute.payers.includes(seat)) {
    return { ok: false, error: { code: 'tribute.notAPayer', params: { seat } } };
  }
  if (tribute.staged[seat] !== undefined) {
    return { ok: false, error: { code: 'tribute.alreadyCommitted', params: { seat } } };
  }
  // spec §7.2: validate membership in the eligible SET, never equality to
  // one precomputed card — the concrete card at the forced rank is a choice.
  if (!eligibleTributeCards(hands[seat]!, level).includes(card)) {
    return {
      ok: false,
      error: { code: 'tribute.cardNotEligible', params: { seat, card, phase: 'pay' } },
    };
  }

  const staged = { ...tribute.staged, [seat]: card };
  const events: GuandanEvent[] = [{ type: 'tributeCommitted', seat }];

  if (!tribute.payers.every((payer) => staged[payer] !== undefined)) {
    // Still waiting on the other payer: stage only, reveal nothing.
    return { ok: true, tribute: { ...tribute, staged }, hands: hands as Hands, events, prng };
  }

  // Last payer just committed → resolve the assignment atomically.
  let pairings: TributePairing[];
  let outPrng = prng;
  if (tribute.kind === 'single') {
    pairings = [{ from: tribute.payers[0]!, to: tribute.receivers[0]!, card: staged[tribute.payers[0]!]! }];
  } else {
    const [payerA, payerB] = tribute.payers as [Seat, Seat];
    const cardA = staged[payerA]!;
    const cardB = staged[payerB]!;
    const valueA = levelValue(cardA, level);
    const valueB = levelValue(cardB, level);
    let headPayer: Seat;
    if (valueA !== valueB) {
      // spec §7.1: 1st finisher receives the HIGHER of the two tribute cards.
      headPayer = valueA > valueB ? payerA : payerB;
    } else {
      switch (config.equalTributeAssignment) {
        case 'seatOrder': {
          // spec §7.3: 1st finisher receives from the payer reached first from 1st finisher
          // via nextSeat — bound to turnDirection, not absolute clockwise.
          let s = nextSeat(tribute.receivers[0]!, config);
          while (!tribute.payers.includes(s)) s = nextSeat(s, config);
          headPayer = s;
          break;
        }
        case 'random': {
          // spec §7.3 (Tangrenyou/JJ): uniform choice, drawn from the engine PRNG.
          const draw = nextInt(prng, 2);
          outPrng = draw.state;
          headPayer = tribute.payers[draw.value]!;
          break;
        }
        case 'winnersChoose':
          // Documented M1 limitation — surfaced honestly, never silently
          // substituted with another policy.
          return {
            ok: false,
            error: {
              code: 'config.notImplemented',
              params: { key: 'equalTributeAssignment', value: 'winnersChoose' },
            },
          };
      }
    }
    const otherPayer = headPayer === payerA ? payerB : payerA;
    pairings = [
      { from: headPayer, to: tribute.receivers[0]!, card: staged[headPayer]! },
      { from: otherPayer, to: tribute.receivers[1]!, card: staged[otherPayer]! },
    ];
  }

  const newHands = moveCards(hands, pairings);
  if (newHands === null) {
    return { ok: false, error: { code: 'tribute.cardNotInHand', params: { seat, card } } };
  }
  // spec §7.3 atomic reveal: ONE event carrying every pairing at once.
  events.push({ type: 'tributePaid', pairings });
  return { ok: true, tribute: { ...tribute, staged, paid: pairings }, hands: newHands, events, prng: outPrng };
}

// ---------------------------------------------------------------------------
// Returning tribute: staged commits, atomic resolution, leader (spec §7.4/§7.5).
// ---------------------------------------------------------------------------

export type ReturnTributeResult =
  | { ok: false; error: RuleError }
  | { ok: true; tribute: TributeState; hands: Hands; events: GuandanEvent[] };

/**
 * One receiver commits their return card. Symmetric to applyPayTribute:
 * staged with a card-less marker; the last commit resolves the corresponding pairing
 * (each receiver returns to the payer they received from — spec §7.4),
 * moves cards, emits ONE 'tributeReturned' event, and resolves the hand's
 * leader = the payer whose card 1st finisher received (spec §7.5 — hard-coded,
 * unanimous across sources; covers single, unequal-double and equal-double
 * in one rule).
 */
export function applyReturnTribute(
  tribute: TributeState,
  seat: Seat,
  card: Card,
  hands: Readonly<Hands>,
  level: Rank,
  config: RuleVariant
): ReturnTributeResult {
  if (tribute.paid === null) {
    return { ok: false, error: { code: 'tribute.notPaidYet', params: { seat } } };
  }
  if (tribute.returned !== null) {
    return { ok: false, error: { code: 'tribute.alreadyReturned', params: { seat } } };
  }
  if (!tribute.receivers.includes(seat)) {
    return { ok: false, error: { code: 'tribute.notAReceiver', params: { seat } } };
  }
  if (tribute.returnsStaged[seat] !== undefined) {
    return { ok: false, error: { code: 'tribute.alreadyCommitted', params: { seat } } };
  }
  const received = tribute.paid.find((pairing) => pairing.to === seat);
  if (received === undefined) {
    // Defensive: every receiver has exactly one paid pairing by construction.
    return { ok: false, error: { code: 'tribute.noPairingForSeat', params: { seat } } };
  }
  if (!eligibleReturnCards(hands[seat]!, level, config, received.card).includes(card)) {
    return {
      ok: false,
      error: { code: 'tribute.cardNotEligible', params: { seat, card, phase: 'return' } },
    };
  }

  const returnsStaged = { ...tribute.returnsStaged, [seat]: card };
  const events: GuandanEvent[] = [{ type: 'tributeCommitted', seat }];

  if (!tribute.receivers.every((receiver) => returnsStaged[receiver] !== undefined)) {
    return { ok: true, tribute: { ...tribute, returnsStaged }, hands: hands as Hands, events };
  }

  // Last receiver committed → resolve the corresponding pairing atomically: invert
  // each paid pairing (receiver → the payer they received from).
  const pairings: TributePairing[] = tribute.paid.map((pairing) => ({
    from: pairing.to,
    to: pairing.from,
    card: returnsStaged[pairing.to]!,
  }));
  const newHands = moveCards(hands, pairings);
  if (newHands === null) {
    return { ok: false, error: { code: 'tribute.cardNotInHand', params: { seat, card } } };
  }
  // spec §7.5: the payer whose tribute card the 1st finisher received leads.
  const headPairing = tribute.paid.find((pairing) => pairing.to === tribute.receivers[0])!;
  events.push({ type: 'tributeReturned', pairings });
  return {
    ok: true,
    tribute: { ...tribute, returnsStaged, returned: pairings, leader: headPairing.from },
    hands: newHands,
    events,
  };
}
