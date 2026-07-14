// Deterministic replay harness (PLAN.md §6 — required M1 deliverable).
//
// Because GuandanGame is a pure, deterministic, seeded engine (PLAN §3), the
// triple (seed, config, ordered action log) reconstructs any match bit for
// bit. This module is the one place that turns that fact into a reusable
// tool: a library API (`replayMatch`, `recordPlayout`) for tests and
// postmortem tooling, plus a thin CLI wrapper.
//
// ---------------------------------------------------------------------------
// Artifact format (the exact shape the obligations property suite emits on
// failure, and the shape this file's CLI consumes):
//
//   {
//     "seed": "some-seed-string",
//     "config": { ...RuleVariant... },
//     "actions": [ { "seat": 0, "action": { "type": "play", "cards": [...] } }, ... ],
//     "snapshots": [ { "seq": 0, "state": { ...GuandanState... } }, ... ]   // optional
//   }
//
// - `seed` + `config` are exactly GuandanGame.init's second/first args (seats
//   is always 4 for guandan).
// - `actions` is the ordered action log. Index i (0-based) in this array is
//   applied to produce the state at seq i+1.
// - `seq` numbering: seq 0 = the state returned by init() (before any
//   action). seq N (N >= 1) = the state after applying actions[N-1].
// - `snapshots` is optional: a sparse or dense list of { seq, state } pairs
//   to deep-compare the replay against. When present, replayMatch reports
//   the FIRST seq at which the recorded state disagrees with the replayed
//   state, and stops there (never crashes on a mismatch).
//
// This is plain JSON — no functions, no PRNG state hiding, nothing
// engine-internal that isn't already JSON-serializable (obligation 2).
// ---------------------------------------------------------------------------

import type { RuleError, Seat } from '../src/engine/core/game';
import { nextInt, seedPrng, type PrngState } from '../src/engine/core/prng';
import { GuandanGame } from '../src/engine/guandan';
import type { RuleVariant } from '../src/engine/guandan/config';
import type { GuandanAction, GuandanEvent, GuandanState } from '../src/engine/guandan/types';

// ---------------------------------------------------------------------------
// Core API — imports ONLY engine code (src/engine/**). No process/console
// reference below this line until the CLI section at the bottom of the file.
// ---------------------------------------------------------------------------

export interface ReplayActionEntry {
  seat: Seat;
  action: GuandanAction;
}

export interface ReplaySnapshot {
  seq: number;
  state: unknown;
}

export interface ReplayInput {
  seed: string;
  config: RuleVariant;
  actions: ReplayActionEntry[];
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
  action: GuandanAction;
  error: RuleError | { message: string };
}

export interface ReplayResult {
  states: GuandanState[];
  events: GuandanEvent[][];
  finalState: GuandanState | undefined;
  ok: boolean;
  /** First snapshot mismatch, if opts.snapshots was given and one was found. */
  divergence?: ReplayDivergence;
  /** Set when an action in the log was rejected by applyAction, or threw,
   *  before any snapshot comparison could even run for that seq. */
  rejection?: ReplayRejection;
}

/** Structural deep-equal over plain JSON-shaped data (objects/arrays/
 *  primitives) — exactly what GuandanState is (obligation 2), so this is
 *  sufficient without a general-purpose equality library. */
function deepEqual(a: unknown, b: unknown): boolean {
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

/** Replay a recorded (seed, config, action log) through GuandanGame.init +
 *  applyAction, optionally deep-comparing against recorded snapshots at
 *  each seq. Never throws: a rejected action, a thrown error, or a snapshot
 *  mismatch all come back as a structured, seq-tagged result. */
export function replayMatch(input: ReplayInput, opts?: ReplayOpts): ReplayResult {
  const { seed, config, actions } = input;
  const snapshotBySeq = new Map<number, unknown>();
  for (const s of opts?.snapshots ?? []) snapshotBySeq.set(s.seq, s.state);

  const checkSnapshot = (seq: number, state: GuandanState): ReplayDivergence | null => {
    if (!snapshotBySeq.has(seq)) return null;
    const expected = snapshotBySeq.get(seq);
    if (deepEqual(expected, state)) return null;
    return { seq, expected, actual: state };
  };

  const states: GuandanState[] = [];
  const events: GuandanEvent[][] = [];

  let initResult: { state: GuandanState; events: GuandanEvent[] };
  try {
    initResult = GuandanGame.init(config, 4, seed);
  } catch (e) {
    return {
      states,
      events,
      finalState: undefined,
      ok: false,
      rejection: { seq: 0, seat: -1, action: { type: 'pass' }, error: toStructuredError(e) },
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

    let applied: ReturnType<typeof GuandanGame.applyAction>;
    try {
      applied = GuandanGame.applyAction(state, seat, action);
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
  artifact: ReplayInput;
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
  const actionsLog: ReplayActionEntry[] = [];

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

  return { artifact: { seed, config, actions: actionsLog }, states, events };
}
