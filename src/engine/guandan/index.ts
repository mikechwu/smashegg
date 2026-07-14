// GuandanGame — the GameDefinition implementation (PLAN.md §3). This file
// owns phase dispatch and the hand lifecycle; every rule lives in a sibling
// module. The load-bearing invariant (obligation 5): there are NO actorless
// phases — the applyAction that ends hand N atomically scores it, deals
// hand N+1 from the PRNG state carried inside S, and lands in the next
// hand's first acting phase.

import type { ApplyResult, GameDefinition, GameResult, RuleError, Seat } from '../core/game';
import { nextInt, seedPrng, shuffle, type PrngState } from '../core/prng';
import { buildDeck, rankOf, sortCards, type Card } from './cards';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from './config';
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
import { teamOf, type GuandanAction, type GuandanEvent, type GuandanState, type GuandanView, type Phase } from './types';

export { JIANGSU_OFFICIAL_ONLINE };

/** Suggested per-phase deadlines (room layer may clamp/override). */
const TIMEOUT_MS: Record<Phase, number | null> = {
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

/** Start hand `handNo`, dealing from the carried PRNG state and entering
 *  the hand's first acting phase. prevFinishOrder === null ⇔ hand 1. */
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

  const deal = dealHands(state.prng);
  let prng = deal.prng;
  const hands = deal.hands;

  const events: GuandanEvent[] = [
    {
      type: 'handStarted',
      handNo,
      currentLevel: level,
      declarerTeam,
      suspensionApplied,
      hands: [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()],
    },
  ];

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
    finishOrder: [],
    trick: null,
    tribute: null,
    prevFinishOrder,
    antiTributePending: null,
    firstFinisherAllAces: null,
    matchWinner: null,
  };

  if (prevFinishOrder === null) {
    // Hand 1: no tribute. firstLeadMethod 'drawCard' is the offline
    // draw-a-card procedure — its outcome distribution is a uniform seat
    // pick, so the engine implements it exactly like 'random' (documented
    // equivalence, spec §5.1); 'fixedSeat' pins seat 0.
    let leader: Seat = 0;
    if (config.firstLeadMethod !== 'fixedSeat') {
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
    if (config.equalTributeAssignment === 'winnersChoose') {
      // Documented M1 limitation (STATUS): needs an extra decision action.
      // Failing at init beats failing mid-match.
      throw new Error("config.notImplemented: equalTributeAssignment='winnersChoose'");
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

  applyAction(state, seat, action): ApplyResult<GuandanState, GuandanEvent> {
    if (state.phase === 'matchEnd') return err('match.ended');
    if (seat < 0 || seat > 3) return err('action.invalidSeat', { seat });

    switch (state.phase) {
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
  },

  defaultAction(state, seat) {
    if (!actorsFor(state).includes(seat)) return null;
    switch (state.phase) {
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
        const hands = event.hands.map((hand, s) => (s === seat ? hand : [])) as typeof event.hands;
        return { ...event, hands };
      }
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
