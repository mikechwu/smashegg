// GuandanGame — the GameDefinition implementation (PLAN.md §3). This file
// owns phase dispatch and the hand lifecycle; every rule lives in a sibling
// module. The load-bearing invariant (obligation 5): there are NO actorless
// phases — the applyAction that ends hand N atomically scores it, deals
// hand N+1 from the PRNG state carried inside S, and lands in the next
// hand's first acting phase.

import type { ApplyResult, GameDefinition, GameResult, RuleError, Seat } from '../core/game';
import { nextInt, seedPrng, shuffle, type PrngState } from '../core/prng';
import { buildDeck, naturalValue, rankOf, RANKS, sortCards, type Card, type Rank } from './cards';
import { JIANGSU_OFFICIAL_ONLINE, validateRuleVariant, type RuleVariant } from './config';
import { beats, inferDecl, validatePlay } from './combos';
import { defaultPlayAction, legalActionsFor } from './generate';
import {
  applyAntiTributeDecision,
  applyPayTribute,
  applyReturnTribute,
  eligibleReturnCards,
  eligibleTributeCards,
  setupTribute,
  type Hands,
} from './tribute';
import { applyHandResult, scoreHand, selectCurrentLevel } from './levels';
import { applyPass, applyPlay, startTrick } from './trick';
import {
  nextSeat,
  teamOf,
  type GuandanAction,
  type GuandanEvent,
  type GuandanState,
  type GuandanView,
  type Phase,
} from './types';

export { JIANGSU_OFFICIAL_ONLINE };

/** Suggested per-phase deadlines (room layer may clamp/override). */
const TIMEOUT_MS: Record<Phase, number | null> = {
  ceremonyCut: 30_000,
  antiTributeDecision: 20_000,
  tribute: 30_000,
  returnTribute: 30_000,
  playing: 45_000,
  matchEnd: null,
};

function err(code: string, params?: Record<string, unknown>): { ok: false; error: RuleError } {
  return { ok: false, error: { code, params } };
}

function dealHands(prng: PrngState): { hands: Hands; prng: PrngState } {
  const { items, state } = shuffle(buildDeck(), prng);
  return {
    hands: [items.slice(0, 27), items.slice(27, 54), items.slice(54, 81), items.slice(81, 108)],
    prng: state,
  };
}

// ---------------------------------------------------------------------------
// 翻牌定先 drawCard ceremony (spec §5.1 `firstLeadMethod='drawCard'`, owner
// counting rule; M3). Hand 1 only. Fully seeded and deterministic — the
// emitted ceremony data is exactly what the UI animates (types.ts
// handStarted contract); the engine computes it once, replay reproduces it
// bit-for-bit, and clients compute nothing.
// ---------------------------------------------------------------------------

type Ceremony = NonNullable<Extract<GuandanEvent, { type: 'handStarted' }>['ceremony']>;

/** Counting value of a flipped rank under the owner rule: A counts 1 (the
 *  cutter themself), 2..10 face value, J=11, Q=12, K=13. Deliberately NOT
 *  levelValue or naturalValue — this is the physical count-around-the-table
 *  number, so A is LOW here (naturalValue would put it at 14). */
function countingValue(rank: Rank): number {
  return rank === 'A' ? 1 : naturalValue(rank);
}

/** Walk `steps` seats from `from`, 下家 by 下家 (types.ts nextSeat), so the
 *  count follows turnDirection: CCW by default, clockwise when configured. */
function stepSeats(from: Seat, steps: number, config: RuleVariant): Seat {
  let seat = from;
  for (let i = 0; i < steps; i++) seat = nextSeat(seat, config);
  return seat;
}

// ---------------------------------------------------------------------------
// 翻牌定先 with a REAL cut (item 3): init commits a shuffled deck and stops
// in phase 'ceremonyCut'; the cutter's cutDeck action rotates the deck at
// the chosen position, the flip/count ritual reads ACTUAL top cards, and
// the SAME rotated deck is then dealt one card at a time from firstDrawer —
// so the face-up marker card genuinely lands at the seat that leads, and
// the cut changes both the flips and every hand. Deterministic from
// (seed, position); the action is logged, so replay reproduces everything.
// ---------------------------------------------------------------------------

/** Interior-cut bounds: a physical cut takes a non-trivial packet from each
 *  end (≥5 cards — the interior-cut convention), and ribbon-edge pixels are
 *  the least touch-reliable anyway; the UI maps a continuous drag onto
 *  exactly this range. */
export const CUT_MIN = 6;
export const CUT_MAX = 102;
/** The indifferent cut — what the deadline's defaultAction plays for an AFK
 *  cutter: split the deck roughly in half, as a human would. */
export const DEFAULT_CUT_POSITION = 54;

/** The count walk skips uncountable cards (jokers and the current-level
 *  rank). A double deck holds at most 4 + 8 = 12 uncountables, so a countable
 *  card always exists; the walks below are total by construction. */
function isCountable(card: Card, level: Rank): boolean {
  const rank = rankOf(card); // null for jokers
  return rank !== null && rank !== level;
}

/** The cut ritual — REVERSED GEOMETRY (owner decision 2026-07-15; supersedes
 *  the rotate-the-deck model): the physical act is "lift a packet, look at
 *  the card(s) at the split, put it back, deal" — THE ORDER IS PRESERVED.
 *  The cut selects WHICH cards are revealed and at what depth the face-up
 *  marker sits; it determines who LEADS, never which cards each seat holds.
 *
 *  Two-card form (ceremonyCardCount=2, the owner's table rule, the default):
 *  count card = the lifted packet's BOTTOM (deck[position-1]); marker = the
 *  table packet's TOP (deck[position]) — adjacent at the split, both PUBLIC
 *  (the ceremony is publicly verifiable: all four seats can independently
 *  derive drawer and leader). If the count card is uncountable the walk
 *  re-flips DEEPER into the lifted packet (position-2, …, 0; defensively
 *  wrapping to position+1, … if the whole packet is uncountable). The marker
 *  may be ANY card — it only marks who leads — and is a specific PHYSICAL
 *  INSTANCE (a deck position), never "the 8♥": two decks mean every rank+suit
 *  has a twin, so identity is positional (the face-up deal makes it visually
 *  unambiguous; no copy may name the marker by rank).
 *
 *  One-card form (ceremonyCardCount=1, official 《竞技掼蛋》): one card does
 *  both jobs — the first COUNTABLE card at/after the split (deck[position],
 *  position+1, …, wrapping defensively) is the count card AND the face-up
 *  marker. (Simplification noted: the official text reinserts the flipped
 *  card at the cut point; we keep every card at its own position — the
 *  ~11% re-flip case would physically reorder by a few indices.)
 *
 *  In both forms: firstDrawer = stepSeats(cutter, (countingValue-1) mod 4);
 *  the deal runs over the UNROTATED deck from firstDrawer, so the marker at
 *  deck index m lands at markerSeat = stepSeats(firstDrawer, m mod 4) — the
 *  cut depth genuinely moves the leader.
 *
 *  Uniformity, stated PRECISELY (the old unqualified claim is superseded):
 *  ABSOLUTE leader uniformity holds (the cutter is PRNG-uniform and the
 *  count offset is independent of the cutter). CONDITIONAL on the cutter it
 *  does NOT: the count offset X=(value-1) mod 4 is skewed at level 2 (hand 1
 *  always runs at level 2) — P(X even)=7/12 — so a cutter choosing the cut
 *  depth's residue class shifts their own team's lead probability to ≈58.3%
 *  vs ≈41.7%. Owner decision: measured and documented (the physical table
 *  has the identical property), deliberately NOT policed. */
function runCutRitual(
  deck: readonly Card[],
  position: number,
  level: Rank,
  config: RuleVariant,
  cutter: Seat,
): { flips: Card[]; marker: Card; markerDealIndex: number; firstDrawer: Seat; markerSeat: Seat } {
  const flips: Card[] = [];
  let counted: Rank | null = null;

  if (config.ceremonyCardCount === 2) {
    // Owner form: walk the lifted packet from its bottom, deeper on re-flip.
    const walk: number[] = [];
    for (let i = position - 1; i >= 0; i--) walk.push(i);
    for (let i = position + 1; i < deck.length; i++) walk.push(i); // defensive wrap
    for (const idx of walk) {
      const card = deck[idx]!;
      flips.push(card);
      if (isCountable(card, level)) {
        counted = rankOf(card)!;
        break;
      }
    }
  } else {
    // Official form: one card at/after the split does both jobs.
    const walk: number[] = [];
    for (let i = position; i < deck.length; i++) walk.push(i);
    for (let i = 0; i < position; i++) walk.push(i); // defensive wrap
    for (const idx of walk) {
      const card = deck[idx]!;
      flips.push(card);
      if (isCountable(card, level)) {
        counted = rankOf(card)!;
        break;
      }
    }
  }
  // A countable card always exists (96 of 108); the walks cover the deck.
  if (counted === null) counted = 'A';

  const firstDrawer = stepSeats(cutter, (countingValue(counted) - 1) % 4, config);
  // The marker: form 2 = the table packet's top (deck[position], any card);
  // form 1 = the counted card itself. Deal index i (over the UNROTATED deck,
  // from firstDrawer) lands at stepSeats(firstDrawer, i % 4).
  const markerDealIndex =
    config.ceremonyCardCount === 2
      ? position
      : (position + flips.length - 1) % deck.length;
  const marker = deck[markerDealIndex]!;
  const markerSeat = stepSeats(firstDrawer, markerDealIndex % 4, config);
  return { flips, marker, markerDealIndex, firstDrawer, markerSeat };
}

/** Apply the cut: run the ritual at the chosen split, deal the UNROTATED
 *  committed deck round-robin from firstDrawer, and enter play with the
 *  marker's landing seat leading. (The deal order is deck order — the cut
 *  never changes which cards each seat holds, only who leads.) */
function completeCeremonyCut(
  state: GuandanState,
  position: number,
): { state: GuandanState; events: GuandanEvent[] } {
  const { cutter, deck } = state.ceremonyCut!;
  const { config } = state;
  const ritual = runCutRitual(deck, position, state.currentLevel, config, cutter);
  const hands: GuandanState['hands'] = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[stepSeats(ritual.firstDrawer, i % 4, config)]!.push(deck[i]!);
  }
  const handStarted: Extract<GuandanEvent, { type: 'handStarted' }> = {
    type: 'handStarted',
    handNo: state.handNo,
    currentLevel: state.currentLevel,
    declarerTeam: state.declarerTeam,
    suspensionApplied: false, // hand 1: no declarer team, no suspension path
    hands: [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()],
    ceremony: {
      cutter,
      cutPosition: position,
      flips: ritual.flips,
      marker: ritual.marker,
      markerDealIndex: ritual.markerDealIndex,
      firstDrawer: ritual.firstDrawer,
      markerSeat: ritual.markerSeat,
    },
  };
  return {
    state: {
      ...state,
      phase: 'playing',
      hands,
      // The DEAL resets the planning windows (item 2) — including the
      // cutter's: the cut itself never consumes a window.
      actedThisHand: [false, false, false, false],
      ceremonyCut: null,
      trick: startTrick(ritual.markerSeat, hands, config),
    },
    events: [handStarted],
  };
}

/** Start hand `handNo`, dealing from the carried PRNG state and entering
 *  the hand's first acting phase. prevFinishOrder === null ⇔ hand 1. */
/** actedThisHand with `seat` flipped true (item 2). Tolerates a short/missing
 *  array from a state persisted before the field existed. */
function withSeatActed(
  acted: readonly boolean[],
  seat: Seat,
): [boolean, boolean, boolean, boolean] {
  const next: [boolean, boolean, boolean, boolean] = [
    acted[0] ?? false,
    acted[1] ?? false,
    acted[2] ?? false,
    acted[3] ?? false,
  ];
  next[seat] = true;
  return next;
}

function startHand(
  state: Pick<GuandanState, 'config' | 'prng' | 'levels' | 'aAttempts' | 'aAttemptsExhausted'>,
  handNo: number,
  declarerTeam: 0 | 1 | null,
  prevFinishOrder: Seat[] | null,
): { state: GuandanState; events: GuandanEvent[] } {
  const { config } = state;
  const { level, suspensionApplied } = selectCurrentLevel({
    config,
    levels: state.levels,
    declarerTeam,
    aAttemptsExhausted: state.aAttemptsExhausted,
  });

  // Item 3: hand 1 under drawCard stops at the CUT — the deck is shuffled
  // and COMMITTED into state (hidden like the PRNG), nothing is dealt, and
  // the cutter (PRNG-uniform) becomes the phase's actor. The deal, the
  // flips and the leader all follow from the cutDeck action.
  if (prevFinishOrder === null && config.firstLeadMethod === 'drawCard') {
    const shuffled = shuffle(buildDeck(), state.prng);
    const cut = nextInt(shuffled.state, 4);
    const cutter = cut.value as Seat;
    const ceremonyState: GuandanState = {
      config,
      prng: cut.state,
      handNo,
      phase: 'ceremonyCut',
      levels: state.levels,
      aAttempts: state.aAttempts,
      aAttemptsExhausted: state.aAttemptsExhausted,
      currentLevel: level,
      declarerTeam,
      hands: [[], [], [], []],
      actedThisHand: [false, false, false, false],
      ceremonyCut: { cutter, deck: shuffled.items },
      finishOrder: [],
      trick: null,
      tribute: null,
      prevFinishOrder,
      antiTributePending: null,
      firstFinisherAllAces: null,
      matchWinner: null,
    };
    return { state: ceremonyState, events: [{ type: 'ceremonyCutStarted', cutter }] };
  }

  const deal = dealHands(state.prng);
  let prng = deal.prng;
  const hands = deal.hands;

  // Named (not inlined into the array) so the hand-1 drawCard branch can
  // attach the ceremony before the event escapes this function.
  const handStarted: Extract<GuandanEvent, { type: 'handStarted' }> = {
    type: 'handStarted',
    handNo,
    currentLevel: level,
    declarerTeam,
    suspensionApplied,
    hands: [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()],
  };
  const events: GuandanEvent[] = [handStarted];

  const base: GuandanState = {
    config,
    prng,
    handNo,
    phase: 'playing',
    levels: state.levels,
    aAttempts: state.aAttempts,
    aAttemptsExhausted: state.aAttemptsExhausted,
    currentLevel: level,
    declarerTeam,
    hands,
    // Item 2: the deal resets every seat's planning window — including for a
    // hand dealt ATOMICALLY inside a hand-ending applyAction (this reset
    // must win over that action's own acted-mark, and does: startHand runs
    // after the mark).
    actedThisHand: [false, false, false, false],
    ceremonyCut: null,
    finishOrder: [],
    trick: null,
    tribute: null,
    prevFinishOrder,
    antiTributePending: null,
    firstFinisherAllAces: null,
    matchWinner: null,
  };

  if (prevFinishOrder === null) {
    // Hand 1: no tribute (spec §5.1). Leader per firstLeadMethod:
    // 'fixedSeat' pins seat 0; 'random' draws a uniform seat. ('drawCard'
    // never reaches here — it returned above in phase ceremonyCut; the
    // cutDeck action deals and leads via completeCeremonyCut.)
    let leader: Seat = 0;
    if (config.firstLeadMethod === 'random') {
      const r = nextInt(prng, 4);
      prng = r.state;
      leader = r.value;
    }
    return {
      state: { ...base, prng, trick: startTrick(leader, hands, config) },
      events,
    };
  }

  const setup = setupTribute(prevFinishOrder, hands, level, config);
  switch (setup.kind) {
    case 'none': // defensive union member — unreachable from hand 2 onward
      return { state: { ...base, trick: startTrick(setup.leader, hands, config) }, events };
    case 'anti':
      events.push({ type: 'antiTribute', reveals: setup.reveals });
      return { state: { ...base, trick: startTrick(setup.leader, hands, config) }, events };
    case 'decision':
      return { state: { ...base, phase: 'antiTributeDecision', antiTributePending: setup }, events };
    case 'tribute':
      return { state: { ...base, phase: 'tribute', tribute: setup.tribute }, events };
  }
}

/** Score the just-ended hand and either end the match or atomically start
 *  the next hand (spec §6, §1.5). */
function finishHand(
  state: GuandanState,
  finishOrder: Seat[],
  events: GuandanEvent[],
): { state: GuandanState; events: GuandanEvent[] } {
  const result = scoreHand(finishOrder);
  const out = applyHandResult({
    config: state.config,
    levels: state.levels,
    aAttempts: state.aAttempts,
    aAttemptsExhausted: state.aAttemptsExhausted,
    currentLevel: state.currentLevel,
    declarerTeam: state.declarerTeam,
    result,
    finalPlayAllAces: state.firstFinisherAllAces ?? false,
  });
  events.push({
    type: 'handEnded',
    result,
    newLevels: out.levels,
    aAttempts: out.aAttempts,
    aAttemptsExhausted: out.aAttemptsExhausted,
  });

  if (out.matchWinner !== null) {
    events.push({ type: 'matchEnded', winnerTeam: out.matchWinner });
    return {
      state: {
        ...state,
        phase: 'matchEnd',
        levels: out.levels,
        aAttempts: out.aAttempts,
        aAttemptsExhausted: out.aAttemptsExhausted,
        finishOrder,
        trick: null,
        tribute: null,
        antiTributePending: null,
        matchWinner: out.matchWinner,
      },
      events,
    };
  }

  // spec §1.5: next hand's declarer is this hand's winning (头游) team.
  const next = startHand(
    {
      config: state.config,
      prng: state.prng,
      levels: out.levels,
      aAttempts: out.aAttempts,
      aAttemptsExhausted: out.aAttemptsExhausted,
    },
    state.handNo + 1,
    result.winnerTeam,
    finishOrder,
  );
  return { state: next.state, events: [...events, ...next.events] };
}

function actorsFor(state: GuandanState): Seat[] {
  switch (state.phase) {
    case 'ceremonyCut':
      return [state.ceremonyCut!.cutter];
    case 'antiTributeDecision': {
      const pending = state.antiTributePending!;
      return pending.payers.filter((seat) => pending.decisions[seat] === undefined);
    }
    case 'tribute': {
      const t = state.tribute!;
      return t.paid === null ? t.payers.filter((seat) => t.staged[seat] === undefined) : [];
    }
    case 'returnTribute': {
      const t = state.tribute!;
      return t.returned === null ? t.receivers.filter((seat) => t.returnsStaged[seat] === undefined) : [];
    }
    case 'playing':
      return [state.trick!.toAct];
    case 'matchEnd':
      return [];
  }
}

/** Distinct eligible cards (two decks ⇒ duplicates) as actions. */
function dedupeCards(cards: Card[]): Card[] {
  return [...new Set(cards)];
}

function receivedCardFor(state: GuandanState, seat: Seat): Card | null {
  const pairing = state.tribute?.paid?.find((p) => p.to === seat);
  return pairing ? pairing.card : null;
}

export const GuandanGame: GameDefinition<GuandanState, GuandanAction, GuandanEvent, GuandanView, RuleVariant> = {
  gameId: 'guandan',
  minSeats: 4,
  maxSeats: 4,

  init(config, seats, seed) {
    if (seats !== 4) throw new Error(`guandan requires exactly 4 seats, got ${seats}`);
    // Grok M3 audit F1: the room passes config through opaquely, so a
    // partial/foreign object lands here as-is. Validate every key loudly
    // (→ room.startFailed, lobby retained) — never guess at defaults.
    config = validateRuleVariant(config);
    if (config.equalTributeAssignment === 'winnersChoose') {
      // Documented M1 limitation (STATUS): needs an extra decision action.
      // Failing at init beats failing mid-match.
      throw new Error("config.notImplemented: equalTributeAssignment='winnersChoose'");
    }
    if (config.tributeLevelBasis === 'previousLevel') {
      // Codex+Grok convergent audit finding (M1 gate): tribute eligibility
      // is currently computed with the upcoming hand's level only — under
      // this variant that would be silently wrong, so reject loudly
      // instead. Full support is tracked as a pre-M3 item. Default profile
      // unaffected.
      throw new Error("config.notImplemented: tributeLevelBasis='previousLevel'");
    }
    if (config.levelTrack === 'shared' && config.aFailConsequence === 'demote') {
      // Grok audit finding (M1 gate): per-team demotion desyncs the shared
      // ladder, and a later shared upgrade would drag the other team DOWN.
      // The spec leaves shared-ladder demotion semantics undefined; reject
      // the combination loudly until the owner defines it. Defaults
      // (perTeam + suspendPlayOpponentLevel) unaffected.
      throw new Error("config.notImplemented: levelTrack='shared' with aFailConsequence='demote'");
    }
    const prng = seedPrng(seed);
    return startHand(
      { config, prng, levels: ['2', '2'], aAttempts: [0, 0], aAttemptsExhausted: [false, false] },
      1,
      null,
      null,
    );
  },

  expectedActors: actorsFor,

  legalActions(state, seat) {
    if (!actorsFor(state).includes(seat)) return [];
    switch (state.phase) {
      case 'ceremonyCut': {
        // Choice phase → the EXACT eligible set (obligation 4): one action
        // per interior cut position.
        const cuts: GuandanAction[] = [];
        for (let p = CUT_MIN; p <= CUT_MAX; p++) cuts.push({ type: 'cutDeck', position: p });
        return cuts;
      }
      case 'antiTributeDecision':
        return [
          { type: 'antiTributeDecision', invoke: true },
          { type: 'antiTributeDecision', invoke: false },
        ];
      case 'tribute':
        return dedupeCards(eligibleTributeCards(state.hands[seat]!, state.currentLevel)).map((card) => ({
          type: 'payTribute',
          card,
        }));
      case 'returnTribute': {
        const received = receivedCardFor(state, seat);
        return dedupeCards(
          eligibleReturnCards(state.hands[seat]!, state.currentLevel, state.config, received!),
        ).map((card) => ({ type: 'returnTribute', card }));
      }
      case 'playing': {
        const trick = state.trick!;
        const mustLead = trick.top === null;
        return legalActionsFor(
          state.hands[seat]!,
          trick.top?.decl ?? null,
          mustLead,
          state.currentLevel,
          state.config,
        );
      }
      case 'matchEnd':
        return [];
    }
  },

  applyAction(input, seat, action): ApplyResult<GuandanState, GuandanEvent> {
    if (input.phase === 'matchEnd') return err('match.ended');
    if (seat < 0 || seat > 3) return err('action.invalidSeat', { seat });

    // Item 2 (per-seat planning window): a seat's FIRST applied action of a
    // hand consumes its planning class, whatever the phase — play, pass,
    // tribute, return, anti-tribute decision alike. Marked on the INPUT
    // state so every ok-path below carries it, while a hand-ending action
    // that atomically deals hand N+1 still gets fresh all-false flags from
    // startHand (the deal's reset must win — and does, it runs later).
    // Rejected actions return err() without state, so they never commit the
    // mark. The ?? guards states persisted before this field existed (live
    // rooms mid-hand at deploy): those seats read as not-yet-acted once,
    // which only grants a generous window — never a crash.
    const acted = input.actedThisHand ?? [false, false, false, false];
    const state: GuandanState = acted[seat]
      ? input
      : { ...input, actedThisHand: withSeatActed(acted, seat) };

    switch (state.phase) {
      case 'ceremonyCut': {
        if (action.type !== 'cutDeck') return err('action.wrongPhase', { phase: state.phase });
        if (seat !== state.ceremonyCut!.cutter) return err('action.notYourTurn', { seat });
        if (
          !Number.isInteger(action.position) ||
          action.position < CUT_MIN ||
          action.position > CUT_MAX
        ) {
          return err('ceremony.invalidCutPosition', { position: action.position });
        }
        return { ok: true, ...completeCeremonyCut(state, action.position) };
      }
      case 'antiTributeDecision': {
        if (action.type !== 'antiTributeDecision') return err('action.wrongPhase', { phase: state.phase });
        const res = applyAntiTributeDecision(
          state.antiTributePending!,
          seat,
          action.invoke,
          state.prevFinishOrder!,
          state.hands,
          state.config,
        );
        if (!res.ok) return res;
        const outcome = res.outcome;
        if (outcome.kind === 'pending') {
          return { ok: true, state: { ...state, antiTributePending: outcome.pending }, events: [] };
        }
        if (outcome.kind === 'anti') {
          const events: GuandanEvent[] = [{ type: 'antiTribute', reveals: outcome.reveals }];
          return {
            ok: true,
            state: {
              ...state,
              phase: 'playing',
              antiTributePending: null,
              trick: startTrick(outcome.leader, state.hands, state.config),
            },
            events,
          };
        }
        return {
          ok: true,
          state: { ...state, phase: 'tribute', antiTributePending: null, tribute: outcome.tribute },
          events: [],
        };
      }

      case 'tribute': {
        if (action.type !== 'payTribute') return err('action.wrongPhase', { phase: state.phase });
        const res = applyPayTribute(
          state.tribute!,
          seat,
          action.card,
          state.hands,
          state.currentLevel,
          state.config,
          state.prng,
        );
        if (!res.ok) return res;
        const phase: Phase = res.tribute.paid !== null ? 'returnTribute' : 'tribute';
        return {
          ok: true,
          state: { ...state, phase, tribute: res.tribute, hands: res.hands, prng: res.prng },
          events: res.events,
        };
      }

      case 'returnTribute': {
        if (action.type !== 'returnTribute') return err('action.wrongPhase', { phase: state.phase });
        const res = applyReturnTribute(
          state.tribute!,
          seat,
          action.card,
          state.hands,
          state.currentLevel,
          state.config,
        );
        if (!res.ok) return res;
        if (res.tribute.returned === null) {
          return { ok: true, state: { ...state, tribute: res.tribute, hands: res.hands }, events: res.events };
        }
        // Returns resolved atomically — the hand's leader is known (§7.5).
        return {
          ok: true,
          state: {
            ...state,
            phase: 'playing',
            tribute: res.tribute,
            hands: res.hands,
            trick: startTrick(res.tribute.leader!, res.hands, state.config),
          },
          events: res.events,
        };
      }

      case 'playing': {
        const trick = state.trick!;
        if (seat !== trick.toAct) return err('action.notYourTurn', { seat, toAct: trick.toAct });

        if (action.type === 'pass') {
          if (trick.top === null) return err('play.cannotPassLeading', { seat });
          const res = applyPass(trick, seat, state.hands, state.config);
          return { ok: true, state: { ...state, trick: res.trick }, events: res.events };
        }

        if (action.type !== 'play') return err('action.wrongPhase', { phase: state.phase });

        // 1. The concrete cards must come from the player's hand.
        const remaining = state.hands[seat]!.slice();
        for (const card of action.cards) {
          const i = remaining.indexOf(card);
          if (i < 0) return err('play.cardsNotInHand', { seat, card });
          remaining.splice(i, 1);
        }

        // 2. Resolve the declared canonical form (spec §4.4.4): explicit
        //    decl, or unique inference; ambiguity requires a declaration.
        let decl = action.decl ?? null;
        if (decl === null) {
          const inferred = inferDecl(action.cards, state.currentLevel, state.config);
          if ('ambiguous' in inferred) return err('play.declRequired', { seat });
          if ('invalid' in inferred) return err('play.invalidCombination', { seat });
          decl = inferred.decl;
        }

        // 3. Validate cards ⊨ decl (Problem V — combos.ts owns the rules).
        const valid = validatePlay(action.cards, decl, state.currentLevel, state.config);
        if (!valid.ok) return valid;

        // 4. Following must strictly beat the top play (spec §3/§5.3).
        if (trick.top !== null && !beats(decl, trick.top.decl, state.currentLevel, state.config)) {
          return err('play.cannotBeatTop', { seat });
        }

        // aceFinishDemotes bookkeeping: remember whether the FIRST
        // finisher emptied their hand with an all-Aces play (spec §6.4).
        let firstFinisherAllAces = state.firstFinisherAllAces;
        if (remaining.length === 0 && state.finishOrder.length === 0) {
          firstFinisherAllAces = action.cards.every((card) => rankOf(card) === 'A');
        }

        const hands: Hands = [...state.hands] as Hands;
        hands[seat] = remaining;
        const res = applyPlay(trick, { seat, cards: action.cards, decl }, hands, state.config, state.finishOrder);

        if (res.handEnded) {
          const finished = finishHand(
            { ...state, hands, firstFinisherAllAces },
            res.finishOrder,
            res.events,
          );
          return { ok: true, state: finished.state, events: finished.events };
        }

        return {
          ok: true,
          state: { ...state, hands, trick: res.trick, finishOrder: res.finishOrder, firstFinisherAllAces },
          events: res.events,
        };
      }
    }
    // Unreachable: matchEnd early-returned above and the switch covers every
    // other phase — kept as a defensive rejection (and the ending return TS
    // requires now that `state` is reconstructed, widening the phase union).
    return err('action.wrongPhase', { phase: state.phase });
  },

  defaultAction(state, seat) {
    if (!actorsFor(state).includes(seat)) return null;
    switch (state.phase) {
      case 'ceremonyCut':
        // An AFK cutter must not deadlock the table before the game even
        // starts (liveness, obligation 5): the indifferent middle cut.
        return { type: 'cutDeck', position: DEFAULT_CUT_POSITION };
      case 'antiTributeDecision':
        // Mirrors 'auto' mode; keeps liveness on timeout (spec §7.6).
        return { type: 'antiTributeDecision', invoke: true };
      case 'tribute': {
        const eligible = sortCards(eligibleTributeCards(state.hands[seat]!, state.currentLevel), state.currentLevel);
        return { type: 'payTribute', card: eligible[0]! };
      }
      case 'returnTribute': {
        const eligible = sortCards(
          eligibleReturnCards(state.hands[seat]!, state.currentLevel, state.config, receivedCardFor(state, seat)!),
          state.currentLevel,
        );
        return { type: 'returnTribute', card: eligible[0]! };
      }
      case 'playing': {
        const trick = state.trick!;
        return defaultPlayAction(
          state.hands[seat]!,
          trick.top?.decl ?? null,
          trick.top === null,
          state.currentLevel,
          state.config,
        );
      }
      case 'matchEnd':
        return null;
    }
  },

  actionTimeoutMs(state) {
    return TIMEOUT_MS[state.phase];
  },

  timingClass(state, seat) {
    // Item 3: the cut precedes the deal — there is no hand to read yet, so
    // it classes 'turn'; and it never consumes anyone's planning window
    // (the acted flags reset AT the deal, which follows the cut).
    if (state.phase === 'ceremonyCut') return 'turn';
    // Item 2: 'planning' ⇔ this SEAT has not yet acted in the current hand.
    // Its first decision — play, pass, tribute, return, anti-tribute alike
    // (owner decision: tribute IS the hand-reading moment) — gets the
    // planning budget; every later decision this hand classes 'turn'. This
    // replaces the M4-era global opening-lead predicate (held===108, whose
    // own comment admitted its fragility): an explicit per-seat flag instead
    // of a derived total, reset at the deal, marked at first apply. The ??
    // guards states persisted before the field existed — those seats read
    // as not-yet-acted, granting one generous mid-hand window, once. Pinned
    // by the obligations property test against an INDEPENDENTLY tracked
    // acted set (model = product).
    return (state.actedThisHand ?? [false, false, false, false])[seat] ? 'turn' : 'planning';
  },

  isTerminal(state) {
    return state.phase === 'matchEnd';
  },

  result(state): GameResult | null {
    if (state.matchWinner === null) return null;
    const winner = state.matchWinner;
    const loser = (1 - winner) as 0 | 1;
    return {
      standings: [
        { rank: 1, seats: [winner, winner + 2] },
        { rank: 2, seats: [loser, loser + 2] },
      ],
      summary: { levels: state.levels, hands: state.handNo },
    };
  },

  playerView(state, seat): GuandanView {
    const { config } = state;
    const cardCounts = state.hands.map((hand, s) => {
      if (s === seat || config.cardCountVisibility === 'always') return hand.length;
      const threshold = config.cardCountVisibility === 'onRequestLE10' ? 10 : 6;
      return hand.length <= threshold ? hand.length : null;
    }) as GuandanView['cardCounts'];

    const t = state.tribute;
    const stagedMap = state.phase === 'tribute' ? t?.staged : t?.returnsStaged;
    return {
      seat,
      phase: state.phase,
      handNo: state.handNo,
      currentLevel: state.currentLevel,
      declarerTeam: state.declarerTeam,
      levels: state.levels,
      aAttempts: state.aAttempts,
      aAttemptsExhausted: state.aAttemptsExhausted,
      hand: sortCards(state.hands[seat]!, state.currentLevel),
      cardCounts,
      // Item 3: the cutter is public; the committed DECK never leaves the
      // state (obligation 3 — it is everyone's future hands).
      ceremonyCutter: state.ceremonyCut?.cutter ?? null,
      finishOrder: state.finishOrder.slice(),
      trick: state.trick,
      tribute: t
        ? {
            kind: t.kind,
            payers: t.payers.slice(),
            receivers: t.receivers.slice(),
            committed: Object.keys(stagedMap ?? {}).map(Number),
            ownStaged: stagedMap?.[seat] ?? null,
            paid: t.paid,
            returned:
              t.returned === null
                ? null
                : config.tributeVisibility === 'returnHidden'
                  ? t.returned.filter((p) => p.from === seat || p.to === seat)
                  : t.returned,
          }
        : null,
      matchWinner: state.matchWinner,
    };
  },

  viewEvent(event, seat, config) {
    switch (event.type) {
      case 'handStarted': {
        // Deal redaction (obligation 3): each seat sees only its own hand.
        // The drawCard ceremony (when present) is deliberately PUBLIC —
        // including the flips, which since item 3 are REAL dealt cards
        // whose landing seats are publicly derivable: that is the physical
        // table's reality (everyone watched them flip), by design. The
        // committed deck itself never appears in any event.
        const hands = event.hands.map((hand, s) => (s === seat ? hand : [])) as typeof event.hands;
        return { ...event, hands };
      }
      // ceremonyCutStarted is public in full via the default arm below:
      // everyone watches one actor cut.
      case 'tributeReturned':
        // spec §7.7 returnHidden variant: uninvolved seats see the marker
        // (returns happened, atomically) but not the cards.
        if (config.tributeVisibility === 'returnHidden') {
          return { ...event, pairings: event.pairings.filter((p) => p.from === seat || p.to === seat) };
        }
        return event;
      default:
        // Everything else is public: plays, passes, tribute payments
        // (owner-pinned public), anti-tribute reveals (always public).
        return event;
    }
  },
};
