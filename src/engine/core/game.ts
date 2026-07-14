// This is the game-agnostic contract of the platform (PLAN.md §3): the
// GameRoom Durable Object and the wire protocol are written against this
// interface only, never against a specific game's types. S, A, E, V, and
// C must all be plain JSON-serializable data.

export type Seat = number;                 // 0-based seat index

/** Semantic error — a key + params. UI localizes; engine never emits prose. */
export interface RuleError { code: string; params?: Record<string, unknown> }

export type ApplyResult<S, E> =
  | { ok: true; state: S; events: E[] }
  | { ok: false; error: RuleError };

/** Game-agnostic outcome, so the room layer can record results (post-MVP
 *  D1 match history) without importing any game's types. rank 1 = best;
 *  teammates share a standings entry. */
export interface GameResult {
  standings: { rank: number; seats: Seat[] }[];
  summary?: Record<string, unknown>;       // opaque game-specific details
}

/**
 * A pure, deterministic, locale-free rules engine.
 * S = full authoritative state, A = action, E = event, V = per-seat view,
 * C = rule-variant config. All five MUST be plain JSON-serializable data.
 * Every method is pure: no IO, no clocks, no global RNG.
 *
 * Randomness idiom: init receives a seed and derives a SERIALIZABLE PRNG
 * state (plain numbers; engine/core ships xoshiro128**) stored inside S.
 * All later randomness — e.g. dealing hand N+1 of an unbounded-length
 * match — draws from and advances that stored state inside applyAction.
 * Purity and replayability are preserved; games with draw piles or
 * mid-game reshuffles fit the same idiom.
 */
export interface GameDefinition<S, A, E, V, C> {
  readonly gameId: string;                 // e.g. 'guandan'
  readonly minSeats: number;
  readonly maxSeats: number;

  /** Start a new match. seed is the only randomness for the whole match. */
  init(config: C, seats: number, seed: string): { state: S; events: E[] };

  /** Seats currently allowed to act. Usually one; Guandan's double-tribute
   *  phase has two payers (then two returners) acting concurrently.
   *  Non-empty whenever !isTerminal — there are NO actorless resting
   *  phases; transitions needing no human decision (e.g. dealing the next
   *  hand) happen atomically inside the applyAction that triggers them. */
  expectedActors(state: S): Seat[];

  /** Legal action set for a seat. For combination plays: complete up to
   *  canonical-form equivalence (see obligation 4) — one representative
   *  per distinct canonical form, not every concrete card realization.
   *  For choice phases (tribute / return tribute): the EXACT eligible
   *  card set, one action per concrete card, so the UI can highlight
   *  precisely which cards are playable (sets are small). */
  legalActions(state: S, seat: Seat): A[];

  /** Validate + apply. Returns new state + semantic events, or a RuleError.
   *  MUST be a pure function of (state, seat, action). */
  applyAction(state: S, seat: Seat, action: A): ApplyResult<S, E>;

  /** The action applied on timeout/disconnect for this seat. Guandan:
   *  playing → pass, or lowest legal single when leading (pass illegal);
   *  tribute → the forced highest card; return tribute → lowest qualifying
   *  card. null = seat cannot act right now. */
  defaultAction(state: S, seat: Seat): A | null;

  /** Suggested per-action deadline for the current phase, in ms;
   *  null = untimed phase (connected seats only — see §4 deadline rule).
   *  The room layer may clamp/override via room config. */
  actionTimeoutMs(state: S): number | null;

  isTerminal(state: S): boolean;

  /** Non-null exactly when isTerminal(state). */
  result(state: S): GameResult | null;

  /** Redacted view for one seat — NEVER includes other seats' hidden info
   *  nor the PRNG state. This is the only game data the room layer ever
   *  sends to a client. */
  playerView(state: S, seat: Seat): V;

  /** Per-seat event redaction (e.g. a deal event shows only your cards;
   *  tribute visibility per variant config — hence config is a parameter).
   *  null = hide entirely. Also used to re-redact stored events on resync. */
  viewEvent(event: E, seat: Seat, config: C): E | null;
}
