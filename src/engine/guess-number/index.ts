// GuessNumberGame — the M2 dummy GameDefinition (PLAN.md §3/§9). Its sole
// purpose is to exist as a second, structurally-independent implementation
// of the platform's Game interface: the GameRoom Durable Object is proven
// against this game so that "the room layer never imports engine/guandan"
// is a compile-time fact, not a promise. Deliberately does NOT import
// anything from ../guandan.
//
// Rules: a secret integer in [1, config.rangeMax] is drawn once per round
// from the PRNG state carried inside S (the PLAN §3 randomness idiom).
// Seats guess in rotation; each guess yields a public verdict ('higher' |
// 'lower' | 'correct'). suddenDeath=true ends the match on the first
// correct guess; suddenDeath=false plays best-of-3 rounds (first seat to 2
// round wins takes the match), with the next round dealt atomically inside
// the applyAction that wins the previous round — no actorless phases
// (obligation 5).

import type { ApplyResult, GameDefinition, GameResult, RuleError, Seat } from '../core/game';
import { nextInt, seedPrng, type PrngState } from '../core/prng';

export interface GNConfig {
  /** Secret is drawn uniformly from [1, rangeMax]. Kept to two sizes so the
   *  M2 lobby has a meaningful toggle to exercise, not a free-form number. */
  rangeMax: 100 | 1000;
  /** true: match ends on the first correct guess. false: best-of-3 rounds
   *  (first seat to 2 round wins takes the match). */
  suddenDeath: boolean;
}

export type GNVerdict = 'higher' | 'lower' | 'correct';

export interface GNGuess {
  round: number;
  seat: Seat;
  value: number;
  verdict: GNVerdict;
}

export interface GNState {
  readonly config: GNConfig;
  readonly seats: number;
  /** PRNG state — never surfaced via playerView/viewEvent (obligation 3). */
  readonly prng: PrngState;
  /** Never surfaced via playerView/viewEvent (obligation 3). */
  readonly secret: number;
  /** Tightest range consistent with this round's public verdicts so far;
   *  used only to pick a representative/default guess, not to validate. */
  readonly lo: number;
  readonly hi: number;
  readonly round: number;                // 1-based, current round number
  readonly toAct: Seat;
  readonly startSeat: Seat;              // seat that opened the current round
  readonly guesses: GNGuess[];           // full match history (all rounds)
  readonly roundWins: number[];          // per-seat count, index = seat
  readonly secretHistory: number[];      // revealed secrets of ENDED rounds
  readonly phase: 'guessing' | 'matchEnd';
  readonly winner: Seat | null;          // set once phase === 'matchEnd'
}

export type GNAction = { type: 'guess'; value: number };

export type GNEvent =
  | { type: 'matchStarted'; config: GNConfig; seats: number }
  | { type: 'roundStarted'; round: number; startSeat: Seat }
  | { type: 'guessed'; round: number; seat: Seat; value: number; verdict: GNVerdict }
  | { type: 'roundEnded'; round: number; winner: Seat; secret: number; roundWins: number[] }
  | { type: 'matchEnded'; winner: Seat; roundWins: number[] };

export interface GNView {
  seat: Seat;
  seats: number;
  config: GNConfig;
  phase: 'guessing' | 'matchEnd';
  round: number;
  toAct: Seat;
  roundWins: number[];
  guesses: GNGuess[];
  winner: Seat | null;
}

function err(code: string, params?: Record<string, unknown>): { ok: false; error: RuleError } {
  return { ok: false, error: { code, params } };
}

/** Representative binary-search midpoint of the remaining consistent range.
 *  Deterministic, integer, always in [lo, hi]. */
function midpoint(lo: number, hi: number): number {
  return Math.floor((lo + hi) / 2);
}

/** Draw a fresh secret in [1, rangeMax] from the carried PRNG state,
 *  returning the advanced state alongside it (PLAN §3 randomness idiom). */
function drawSecret(prng: PrngState, rangeMax: number): { secret: number; prng: PrngState } {
  const r = nextInt(prng, rangeMax);
  return { secret: r.value + 1, prng: r.state };
}

/** Rank standings by round wins, descending; ties share a rank
 *  (rank = 1 + number of seats with strictly more wins). */
function standingsFor(roundWins: number[]): GameResult['standings'] {
  const bySeat = roundWins.map((wins, seat) => ({ seat, wins }));
  const byWinsDesc = [...bySeat].sort((a, b) => b.wins - a.wins);
  const rankFor = (wins: number): number => 1 + bySeat.filter((s) => s.wins > wins).length;
  const groups = new Map<number, Seat[]>();
  for (const { seat, wins } of byWinsDesc) {
    const rank = rankFor(wins);
    const group = groups.get(rank) ?? [];
    group.push(seat);
    groups.set(rank, group);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, seats]) => ({ rank, seats }));
}

export const GuessNumberGame: GameDefinition<GNState, GNAction, GNEvent, GNView, GNConfig> = {
  gameId: 'guess-number',
  minSeats: 2,
  maxSeats: 4,

  init(config, seats, seed) {
    if (seats < 2 || seats > 4) {
      throw new Error(`guess-number requires 2-4 seats, got ${seats}`);
    }
    if (config.rangeMax !== 100 && config.rangeMax !== 1000) {
      throw new Error(`config.invalidRangeMax: ${String(config.rangeMax)}`);
    }
    if (typeof config.suddenDeath !== 'boolean') {
      throw new Error('config.invalidSuddenDeath');
    }

    const initialPrng = seedPrng(seed);
    const { secret, prng } = drawSecret(initialPrng, config.rangeMax);

    const state: GNState = {
      config,
      seats,
      prng,
      secret,
      lo: 1,
      hi: config.rangeMax,
      round: 1,
      toAct: 0,
      startSeat: 0,
      guesses: [],
      roundWins: new Array(seats).fill(0),
      secretHistory: [],
      phase: 'guessing',
      winner: null,
    };

    return {
      state,
      events: [
        { type: 'matchStarted', config, seats },
        { type: 'roundStarted', round: 1, startSeat: 0 },
      ],
    };
  },

  expectedActors(state) {
    return state.phase === 'matchEnd' ? [] : [state.toAct];
  },

  legalActions(state, seat) {
    if (state.phase === 'matchEnd' || seat !== state.toAct) return [];
    // Representative set, NOT every in-range integer: the current
    // binary-search midpoint plus the remaining range's bounds.
    // Completeness-up-to-canonical-form (obligation 4) is trivially
    // satisfied here — there is only one canonical form ("an in-range
    // integer"), and applyAction validates+accepts any such integer, so
    // every legal move is reachable even though not every one is listed.
    const values = new Set<number>([midpoint(state.lo, state.hi), state.lo, state.hi]);
    return [...values].map((value) => ({ type: 'guess', value }) as const);
  },

  applyAction(state, seat, action): ApplyResult<GNState, GNEvent> {
    if (state.phase === 'matchEnd') return err('match.ended');
    if (seat < 0 || seat >= state.seats) return err('action.invalidSeat', { seat });
    if (seat !== state.toAct) return err('action.notYourTurn', { seat, toAct: state.toAct });
    if (action.type !== 'guess') return err('action.unknownType', { type: (action as { type: unknown }).type });

    const { value } = action;
    if (!Number.isInteger(value)) return err('guess.notInteger', { value });
    if (value < 1 || value > state.config.rangeMax) {
      return err('guess.outOfRange', { value, rangeMax: state.config.rangeMax });
    }

    const verdict: GNVerdict = value === state.secret ? 'correct' : value < state.secret ? 'higher' : 'lower';
    const guessEvent: GNEvent = { type: 'guessed', round: state.round, seat, value, verdict };
    const guesses = [...state.guesses, { round: state.round, seat, value, verdict }];

    if (verdict !== 'correct') {
      const lo = verdict === 'higher' ? Math.max(state.lo, value + 1) : state.lo;
      const hi = verdict === 'lower' ? Math.min(state.hi, value - 1) : state.hi;
      const nextSeat = ((seat + 1) % state.seats) as Seat;
      return {
        ok: true,
        state: { ...state, lo, hi, toAct: nextSeat, guesses },
        events: [guessEvent],
      };
    }

    // Correct guess: the round ends. Score it and either end the match or
    // atomically deal the next round — no actorless phases (obligation 5).
    const roundWins = state.roundWins.slice();
    roundWins[seat] = (roundWins[seat] ?? 0) + 1;
    const secretHistory = [...state.secretHistory, state.secret];
    const roundEndedEvent: GNEvent = {
      type: 'roundEnded',
      round: state.round,
      winner: seat,
      secret: state.secret,
      roundWins,
    };

    const matchOver = state.config.suddenDeath || (roundWins[seat] ?? 0) >= 2;
    if (matchOver) {
      return {
        ok: true,
        state: {
          ...state,
          guesses,
          roundWins,
          secretHistory,
          phase: 'matchEnd',
          winner: seat,
        },
        events: [guessEvent, roundEndedEvent, { type: 'matchEnded', winner: seat, roundWins }],
      };
    }

    // Best-of-3, no winner yet: deal round N+1 from the carried PRNG state.
    const nextRound = state.round + 1;
    const nextStartSeat = ((state.startSeat + 1) % state.seats) as Seat;
    const { secret, prng } = drawSecret(state.prng, state.config.rangeMax);
    return {
      ok: true,
      state: {
        ...state,
        prng,
        secret,
        lo: 1,
        hi: state.config.rangeMax,
        round: nextRound,
        toAct: nextStartSeat,
        startSeat: nextStartSeat,
        guesses,
        roundWins,
        secretHistory,
      },
      events: [
        guessEvent,
        roundEndedEvent,
        { type: 'roundStarted', round: nextRound, startSeat: nextStartSeat },
      ],
    };
  },

  defaultAction(state, seat) {
    if (state.phase === 'matchEnd' || seat !== state.toAct) return null;
    return { type: 'guess', value: midpoint(state.lo, state.hi) };
  },

  actionTimeoutMs(state) {
    return state.phase === 'matchEnd' ? null : 15_000;
  },

  isTerminal(state) {
    return state.phase === 'matchEnd';
  },

  result(state): GameResult | null {
    if (state.phase !== 'matchEnd') return null;
    return {
      standings: standingsFor(state.roundWins),
      summary: { rounds: state.secretHistory.length, secretHistory: state.secretHistory.slice() },
    };
  },

  playerView(state, seat): GNView {
    // Hides `secret` and `prng` entirely (obligation 3) — everything else
    // here is already public (guess history + verdicts, round wins, whose
    // turn, match/round phase).
    return {
      seat,
      seats: state.seats,
      config: state.config,
      phase: state.phase,
      round: state.round,
      toAct: state.toAct,
      roundWins: state.roundWins.slice(),
      guesses: state.guesses.slice(),
      winner: state.winner,
    };
  },

  viewEvent(event) {
    // No hidden info in this game beyond the secret, and the secret never
    // appears in an event until 'roundEnded' — which is meant to be public
    // to every seat once a round is decided. Everything is public.
    return event;
  },
};
