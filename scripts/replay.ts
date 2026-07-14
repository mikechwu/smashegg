// Deterministic replay harness (PLAN.md §6 — required M1 deliverable,
// generalized to any registered GameDefinition at M2).
//
// Because every engine is a pure, deterministic, seeded GameDefinition
// (PLAN §3), the tuple (gameId, seed, config, ordered action log)
// reconstructs any match bit for bit. This module is the one place that
// turns that fact into a reusable tool: a library API (`replayMatch`,
// `recordPlayout`) for tests and postmortem tooling, plus a thin CLI
// wrapper.
//
// ---------------------------------------------------------------------------
// Artifact format (the exact shape the obligations property suite emits on
// failure, the shape scripts/dump-room.ts derives from a room dump, and the
// shape the replay CLI consumes):
//
//   {
//     "gameId": "guandan",                                        // optional
//     "seed": "some-seed-string",
//     "config": { ...game-defined config... },
//     "seats": 4,                                                 // optional
//     "actions": [ { "seat": 0, "action": { "type": "play", "cards": [...] } }, ... ],
//     "snapshots": [ { "seq": 0, "state": { ... } }, ... ]        // optional
//   }
//
// - `gameId` names the GameDefinition to replay through, resolved via the
//   shared registry (src/shared/games.ts). BACK-COMPAT RULE: when absent it
//   defaults to 'guandan', so M1-era artifacts — emitted before the field
//   existed — keep replaying unchanged.
// - `seed` + `config` are exactly game.init's third/first args.
// - `seats` is game.init's second arg; when absent it defaults to
//   game.maxSeats (for guandan that is 4 — exactly the M1 behavior).
// - `actions` is the ordered action log. Index i (0-based) in this array is
//   applied to produce the state at seq i+1.
// - `seq` numbering: seq 0 = the state returned by init() (before any
//   action). seq N (N >= 1) = the state after applying actions[N-1].
//   (Room-layer seqs also count lobby mutations, so a dump's action rows
//   carry room seqs — scripts/dump-room.ts drops them and keeps order.)
// - `snapshots` is optional: a sparse or dense list of { seq, state } pairs
//   to deep-compare the replay against. When present, replayMatch reports
//   the FIRST seq at which the recorded state disagrees with the replayed
//   state, and stops there (never crashes on a mismatch).
//
// This is plain JSON — no functions, no PRNG state hiding, nothing
// engine-internal that isn't already JSON-serializable (obligation 2).
// ---------------------------------------------------------------------------

import type { ApplyResult, RuleError, Seat } from '../src/engine/core/game';
import { nextInt, seedPrng, type PrngState } from '../src/engine/core/prng';
import { GuandanGame } from '../src/engine/guandan';
import type { RuleVariant } from '../src/engine/guandan/config';
import type { GuandanAction, GuandanEvent, GuandanState } from '../src/engine/guandan/types';
import { getGame, type AnyGameDefinition } from '../src/shared/games';

// ---------------------------------------------------------------------------
// Core API — imports ONLY engine code (src/engine/** plus the registry in
// src/shared/games.ts, which itself imports only src/engine/**). No
// process/console reference below this line until the CLI section at the
// bottom of the file.
// ---------------------------------------------------------------------------

/** The artifact's default game when `gameId` is absent — see the
 *  BACK-COMPAT RULE in the artifact-format comment above. */
export const DEFAULT_REPLAY_GAME_ID = 'guandan';

// gameId resolution goes purely through the shared registry (getGame) —
// guandan has been registered since M3, so the M1/M2-era direct-import
// fallback this file used to carry is gone. (GuandanGame is still imported
// directly below, but only as recordPlayout's concrete driver.)

/** One logged action. `action` is deliberately loose (game-defined JSON) —
 *  the same deliberate type erasure as the server's AnyGameDefinition. */
export interface ReplayActionEntry {
  seat: Seat;
  action: unknown;
}

export interface ReplaySnapshot {
  seq: number;
  state: unknown;
}

export interface ReplayInput {
  /** Absent = 'guandan' (back-compat with M1 artifacts). */
  gameId?: string;
  seed: string;
  config: unknown;
  /** Absent = game.maxSeats (guandan: 4 — the M1 behavior). */
  seats?: number;
  actions: ReplayActionEntry[];
}

/** The guandan-typed artifact recordPlayout emits — same wire shape as
 *  ReplayInput, with the concrete engine types for test ergonomics. */
export interface GuandanReplayInput extends ReplayInput {
  gameId: 'guandan';
  config: RuleVariant;
  actions: { seat: Seat; action: GuandanAction }[];
}

export interface ReplayOpts {
  snapshots?: ReplaySnapshot[];
}

export interface ReplayDivergence {
  seq: number;
  expected: unknown;
  actual: unknown;
}

/** A rejected action or a thrown error while applying one — always captured
 *  structurally (never a bare throw out of replayMatch). */
export interface ReplayRejection {
  seq: number;
  seat: Seat;
  action: unknown;
  error: RuleError | { message: string };
}

export interface ReplayResult {
  states: unknown[];
  events: unknown[][];
  finalState: unknown;
  ok: boolean;
  /** First snapshot mismatch, if opts.snapshots was given and one was found. */
  divergence?: ReplayDivergence;
  /** Set when an action in the log was rejected by applyAction, or threw,
   *  before any snapshot comparison could even run for that seq. */
  rejection?: ReplayRejection;
}

/** Structural deep-equal over plain JSON-shaped data (objects/arrays/
 *  primitives) — exactly what every game state is required to be
 *  (obligation 2), so this is sufficient without a general-purpose equality
 *  library. Exported so scripts/dump-room.ts verifies its roundtrip with
 *  the very same comparison the harness uses. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

function toStructuredError(e: unknown): { message: string } {
  return { message: e instanceof Error ? e.message : String(e) };
}

/** Replay a recorded (gameId, seed, config, action log) through the
 *  resolved game's init + applyAction, optionally deep-comparing against
 *  recorded snapshots at each seq. Never throws: an unknown gameId, a
 *  rejected action, a thrown error, or a snapshot mismatch all come back as
 *  a structured, seq-tagged result. */
export function replayMatch(input: ReplayInput, opts?: ReplayOpts): ReplayResult {
  const { seed, config, actions } = input;
  const gameId = input.gameId ?? DEFAULT_REPLAY_GAME_ID;
  const snapshotBySeq = new Map<number, unknown>();
  for (const s of opts?.snapshots ?? []) snapshotBySeq.set(s.seq, s.state);

  const checkSnapshot = (seq: number, state: unknown): ReplayDivergence | null => {
    if (!snapshotBySeq.has(seq)) return null;
    const expected = snapshotBySeq.get(seq);
    if (deepEqual(expected, state)) return null;
    return { seq, expected, actual: state };
  };

  const states: unknown[] = [];
  const events: unknown[][] = [];

  const game = getGame(gameId);
  if (!game) {
    return {
      states,
      events,
      finalState: undefined,
      ok: false,
      rejection: { seq: 0, seat: -1, action: null, error: { code: 'replay.unknownGame', params: { gameId } } },
    };
  }
  const seats = input.seats ?? game.maxSeats;

  let initResult: { state: unknown; events: unknown[] };
  try {
    initResult = game.init(config, seats, seed) as { state: unknown; events: unknown[] };
  } catch (e) {
    return {
      states,
      events,
      finalState: undefined,
      ok: false,
      rejection: { seq: 0, seat: -1, action: null, error: toStructuredError(e) },
    };
  }

  let state = initResult.state;
  states.push(state);
  events.push(initResult.events);

  const initDivergence = checkSnapshot(0, state);
  if (initDivergence) {
    return { states, events, finalState: state, ok: false, divergence: initDivergence };
  }

  for (let i = 0; i < actions.length; i++) {
    const seq = i + 1;
    const { seat, action } = actions[i]!;

    let applied: ApplyResult<unknown, unknown>;
    try {
      applied = game.applyAction(state, seat, action) as ApplyResult<unknown, unknown>;
    } catch (e) {
      return {
        states,
        events,
        finalState: state,
        ok: false,
        rejection: { seq, seat, action, error: toStructuredError(e) },
      };
    }

    if (!applied.ok) {
      return {
        states,
        events,
        finalState: state,
        ok: false,
        rejection: { seq, seat, action, error: applied.error },
      };
    }

    state = applied.state;
    states.push(state);
    events.push(applied.events);

    const divergence = checkSnapshot(seq, state);
    if (divergence) {
      return { states, events, finalState: state, ok: false, divergence };
    }
  }

  return { states, events, finalState: state, ok: true };
}

// ---------------------------------------------------------------------------
// recordPlayout — the artifact-generating counterpart. Drives GuandanGame
// with a seeded default policy (or a caller-supplied one) purely through the
// public GameDefinition surface, exactly like tests/unit/engine/
// integration.test.ts's bot loop, and records the full action log + every
// per-seq state/events so callers can freeze a real playout as a golden
// artifact or feed it straight into replayMatch's snapshots.
// ---------------------------------------------------------------------------

export interface PolicyCtx {
  state: GuandanState;
  seat: Seat;
  legal: GuandanAction[];
  fallback: GuandanAction | null;
}

export type ReplayPolicy = (ctx: PolicyCtx) => GuandanAction;

export interface RecordPlayoutOpts {
  maxActions?: number;
  stopAfterHands?: number;
}

export interface RecordPlayoutResult {
  artifact: GuandanReplayInput;
  states: GuandanState[];
  events: GuandanEvent[][];
}

/** Default policy: seeded (from `bot:${seed}`) uniform pick among legal
 *  non-pass actions when available (bias toward playing, so hands actually
 *  finish), falling back to defaultAction otherwise. Mirrors the
 *  integration-test bot exactly, so recordings are reproducible run to run. */
function makeDefaultPolicy(seed: string): ReplayPolicy {
  let bot: PrngState = seedPrng(`bot:${seed}`);
  return ({ legal, fallback }) => {
    if (legal.length === 0) return fallback!;
    const plays = legal.filter((a) => a.type !== 'pass');
    const pool = plays.length > 0 ? plays : legal;
    const pick = nextInt(bot, pool.length);
    bot = pick.state;
    return pool[pick.value]!;
  };
}

export function recordPlayout(
  seed: string,
  config: RuleVariant,
  policy?: ReplayPolicy,
  opts?: RecordPlayoutOpts,
): RecordPlayoutResult {
  const pol = policy ?? makeDefaultPolicy(seed);
  const maxActions = opts?.maxActions ?? 50_000;
  const stopAfterHands = opts?.stopAfterHands;

  const init = GuandanGame.init(config, 4, seed);
  let state = init.state;
  const states: GuandanState[] = [state];
  const events: GuandanEvent[][] = [init.events];
  const actionsLog: { seat: Seat; action: GuandanAction }[] = [];

  let handsCompleted = 0;
  let steps = 0;

  while (!GuandanGame.isTerminal(state) && steps < maxActions) {
    const actors = GuandanGame.expectedActors(state);
    if (actors.length === 0) break; // liveness invariant violated — stop, don't loop forever
    const seat = actors[0]!;
    const legal = GuandanGame.legalActions(state, seat);
    const fallback = GuandanGame.defaultAction(state, seat);
    const action = pol({ state, seat, legal, fallback });

    const before = state.handNo;
    const res = GuandanGame.applyAction(state, seat, action);
    if (!res.ok) {
      throw new Error(`recordPlayout: policy produced an illegal action at step ${steps}: ${res.error.code}`);
    }
    state = res.state;
    states.push(state);
    events.push(res.events);
    actionsLog.push({ seat, action });
    steps++;
    if (state.handNo > before || GuandanGame.isTerminal(state)) handsCompleted++;

    if (stopAfterHands !== undefined && handsCompleted >= stopAfterHands) break;
  }

  // Recorded artifacts are self-describing (explicit gameId + seats) even
  // though replayMatch would default both identically for guandan.
  return { artifact: { gameId: 'guandan', seed, config, seats: 4, actions: actionsLog }, states, events };
}
