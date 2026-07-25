// GuessNumberGame tests (PLAN.md §3 obligations, applied to the M2 dummy
// game). Exercises determinism, both config toggles, the liveness story
// (defaultAction convergence), zero-trust views, and the registry.

import { describe, expect, it } from 'vitest';
import type { GNAction, GNConfig, GNEvent, GNState } from '../../../src/engine/guess-number';
import { GuessNumberGame } from '../../../src/engine/guess-number';
import { getGame, GAME_REGISTRY } from '../../../src/shared/games';
// The rule under test lives with the e2e harness that depends on it; that
// module is pure declarations, so importing it here spawns nothing.
import { wrongGuessFor } from '../../e2e/helpers';

const SUDDEN_DEATH: GNConfig = { rangeMax: 100, suddenDeath: true };
const BEST_OF_3: GNConfig = { rangeMax: 100, suddenDeath: false };

function secretOf(state: GNState): number {
  return state.secret;
}

/** Drive a single round to completion by always guessing the engine's own
 *  defaultAction (pure binary search) until a 'correct' verdict lands.
 *  Returns the final ApplyResult (guaranteed ok, asserted by the caller)
 *  and the number of guesses taken. */
function playRoundWithDefaults(state: GNState): { state: GNState; events: GNEvent[]; guessCount: number } {
  let current = state;
  const events: GNEvent[] = [];
  let guessCount = 0;
  for (;;) {
    const seat = GuessNumberGame.expectedActors(current)[0]!;
    const action = GuessNumberGame.defaultAction(current, seat);
    if (!action) throw new Error('expected a defaultAction while guessing');
    const res = GuessNumberGame.applyAction(current, seat, action);
    if (!res.ok) throw new Error(`unexpected rejection: ${res.error.code}`);
    current = res.state;
    events.push(...res.events);
    guessCount++;
    // A round decisively ends the instant a 'roundEnded' event appears,
    // whether or not the SAME applyAction also atomically dealt the next
    // round (best-of-3) or ended the match (suddenDeath / bo3 clincher).
    if (res.events.some((e) => e.type === 'roundEnded')) break;
  }
  return { state: current, events, guessCount };
}

describe('GuessNumberGame', () => {
  it('is deterministic: same seed ⇒ same secret sequence', () => {
    const a = GuessNumberGame.init(BEST_OF_3, 2, 'seed-alpha');
    const b = GuessNumberGame.init(BEST_OF_3, 2, 'seed-alpha');
    expect(secretOf(a.state)).toBe(secretOf(b.state));
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);

    const c = GuessNumberGame.init(BEST_OF_3, 2, 'seed-beta');
    // Overwhelmingly likely to differ; if this ever flakes the PRNG itself
    // regressed to a fixed point.
    expect(secretOf(a.state)).not.toBe(secretOf(c.state));
  });

  it('plays a full suddenDeath match via applyAction (ends the MATCH on first correct guess)', () => {
    const init = GuessNumberGame.init(SUDDEN_DEATH, 3, 'sudden-death-seed');
    expect(GuessNumberGame.isTerminal(init.state)).toBe(false);
    expect(GuessNumberGame.expectedActors(init.state)).toEqual([0]);

    const { state: final, events } = playRoundWithDefaults(init.state);

    expect(GuessNumberGame.isTerminal(final)).toBe(true);
    expect(GuessNumberGame.expectedActors(final)).toEqual([]);
    const matchEnded = events.find((e) => e.type === 'matchEnded');
    expect(matchEnded).toBeDefined();
    expect(final.winner).not.toBeNull();

    const result = GuessNumberGame.result(final)!;
    expect(result).not.toBeNull();
    expect(result.summary).toEqual({ rounds: 1, secretHistory: final.secretHistory });
    const winnerRank = result.standings.find((s) => s.seats.includes(final.winner!))!;
    expect(winnerRank.rank).toBe(1);
    // No more legal/default actions once terminal (liveness is moot post-terminal).
    for (let seat = 0; seat < 3; seat++) {
      expect(GuessNumberGame.defaultAction(final, seat)).toBeNull();
      expect(GuessNumberGame.legalActions(final, seat)).toEqual([]);
    }
  });

  it('plays a full best-of-3 match, including the atomic round rollover', () => {
    let state = GuessNumberGame.init(BEST_OF_3, 2, 'bo3-seed').state;
    let roundsPlayed = 0;
    let sawRoundStartedAfterFirstRound = false;

    while (!GuessNumberGame.isTerminal(state)) {
      const before = state;
      const { state: after, events } = playRoundWithDefaults(state);
      roundsPlayed++;
      state = after;

      const roundEnded = events.find((e) => e.type === 'roundEnded');
      expect(roundEnded).toBeDefined();

      if (!GuessNumberGame.isTerminal(after)) {
        // Atomic rollover: the SAME applyAction that ended the round already
        // dealt the next one and put an actor back on the clock — no
        // actorless phase in between (obligation 5).
        expect(after.round).toBe(before.round + 1);
        expect(GuessNumberGame.expectedActors(after)).toHaveLength(1);
        const roundStarted = events.find((e) => e.type === 'roundStarted');
        expect(roundStarted).toBeDefined();
        sawRoundStartedAfterFirstRound = true;
      } else {
        expect(events.find((e) => e.type === 'matchEnded')).toBeDefined();
      }
    }

    expect(roundsPlayed).toBeGreaterThanOrEqual(2);
    expect(roundsPlayed).toBeLessThanOrEqual(3);
    expect(sawRoundStartedAfterFirstRound).toBe(true);

    const result = GuessNumberGame.result(state)!;
    expect(result.summary!.rounds).toBe(roundsPlayed);
    expect((result.summary!.secretHistory as number[]).length).toBe(roundsPlayed);
    // Best-of-3 winner has exactly 2 round wins.
    expect(state.roundWins[state.winner!]).toBe(2);
    const winnerRank = result.standings.find((s) => s.seats.includes(state.winner!))!;
    expect(winnerRank.rank).toBe(1);
  });

  it('rejects out-of-range, wrong-turn, and non-integer guesses with coded errors', () => {
    const { state } = GuessNumberGame.init(SUDDEN_DEATH, 2, 'validation-seed');

    const outOfRange = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: 101 });
    expect(outOfRange).toEqual({ ok: false, error: { code: 'guess.outOfRange', params: { value: 101, rangeMax: 100 } } });

    const zero = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: 0 });
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error.code).toBe('guess.outOfRange');

    const notInteger = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: 3.5 });
    expect(notInteger.ok).toBe(false);
    if (!notInteger.ok) expect(notInteger.error.code).toBe('guess.notInteger');

    const wrongTurn = GuessNumberGame.applyAction(state, 1, { type: 'guess', value: 50 });
    expect(wrongTurn.ok).toBe(false);
    if (!wrongTurn.ok) expect(wrongTurn.error.code).toBe('action.notYourTurn');

    const invalidSeat = GuessNumberGame.applyAction(state, 7, { type: 'guess', value: 50 });
    expect(invalidSeat.ok).toBe(false);
    if (!invalidSeat.ok) expect(invalidSeat.error.code).toBe('action.invalidSeat');

    const unknownType = GuessNumberGame.applyAction(state, 0, { type: 'nope' } as unknown as GNAction);
    expect(unknownType.ok).toBe(false);
    if (!unknownType.ok) expect(unknownType.error.code).toBe('action.unknownType');

    // A valid in-range integer not present in legalActions' representative
    // set must still be accepted (obligation 4 completeness-up-to-canonical
    // form: every in-range integer shares the one canonical form here).
    const legal = GuessNumberGame.legalActions(state, 0);
    const legalValues = new Set(legal.map((a) => a.value));
    let uncommon = 1;
    while (legalValues.has(uncommon) && uncommon <= 100) uncommon++;
    const accepted = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: uncommon });
    expect(accepted.ok).toBe(true);

    // Match-ended rejection.
    const { state: ended } = playRoundWithDefaults(GuessNumberGame.init(SUDDEN_DEATH, 2, 'end-seed').state);
    const afterEnd = GuessNumberGame.applyAction(ended, 0, { type: 'guess', value: 1 });
    expect(afterEnd.ok).toBe(false);
    if (!afterEnd.ok) expect(afterEnd.error.code).toBe('match.ended');
  });

  it('defaultAction always converges a round in <= ceil(log2(rangeMax)) + 1 guesses (liveness)', () => {
    const maxGuesses = Math.ceil(Math.log2(100)) + 1;
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { state } = GuessNumberGame.init(SUDDEN_DEATH, 4, `liveness-${seed}`);
      const { guessCount } = playRoundWithDefaults(state);
      expect(guessCount).toBeLessThanOrEqual(maxGuesses);
    }

    // Also true for the larger range.
    const maxGuesses1000 = Math.ceil(Math.log2(1000)) + 1;
    for (const seed of ['x', 'y', 'z']) {
      const { state } = GuessNumberGame.init({ rangeMax: 1000, suddenDeath: true }, 2, `liveness-big-${seed}`);
      const { guessCount } = playRoundWithDefaults(state);
      expect(guessCount).toBeLessThanOrEqual(maxGuesses1000);
    }
  });

  it('hides the secret and PRNG state from playerView (obligation 3)', () => {
    const { state } = GuessNumberGame.init(BEST_OF_3, 2, 'redaction-seed');
    // Advance a couple guesses so the view has real content to check too.
    const afterOneGuess = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: 50 });
    expect(afterOneGuess.ok).toBe(true);
    const live = afterOneGuess.ok ? afterOneGuess.state : state;

    for (let seat = 0; seat < 2; seat++) {
      const view = GuessNumberGame.playerView(live, seat);
      const json = JSON.stringify(view);
      expect(json).not.toContain('"secret"');
      expect(json).not.toContain('"prng"');
      // The literal secret value must not leak either.
      expect(json.includes(String(live.secret))).toBe(
        // it's fine if the number coincidentally appears as a guess value;
        // only assert the dedicated keys are absent (checked above). This
        // extra check just documents intent, so keep it loose:
        json.includes(String(live.secret)),
      );
      expect(view).not.toHaveProperty('secret');
      expect(view).not.toHaveProperty('prng');
      // Public info IS present.
      expect(view.guesses.length).toBeGreaterThan(0);
      expect(view.roundWins).toEqual(live.roundWins);
      expect(view.toAct).toBe(live.toAct);
    }
  });

  it('viewEvent never surfaces the secret before roundEnded, and roundEnded is public to all seats', () => {
    const { state } = GuessNumberGame.init(SUDDEN_DEATH, 2, 'view-event-seed');
    const { events } = playRoundWithDefaults(state);
    for (const event of events) {
      if (event.type === 'guessed') {
        expect(JSON.stringify(event)).not.toContain('secret');
      }
      for (let seat = 0; seat < 2; seat++) {
        const redacted = GuessNumberGame.viewEvent(event, seat, BEST_OF_3);
        expect(redacted).toEqual(event);
      }
    }
    const roundEnded = events.find((e) => e.type === 'roundEnded');
    expect(roundEnded).toBeDefined();
    expect((roundEnded as { secret: number }).secret).toBeGreaterThanOrEqual(1);
  });

  it('exercises both config toggles (suddenDeath true/false, rangeMax 100/1000)', () => {
    const sd = GuessNumberGame.init({ rangeMax: 1000, suddenDeath: true }, 2, 'toggle-1');
    expect(sd.state.hi).toBe(1000);
    const { state: sdEnd } = playRoundWithDefaults(sd.state);
    expect(sdEnd.phase).toBe('matchEnd');
    expect(sdEnd.secretHistory).toHaveLength(1);

    const bo3 = GuessNumberGame.init({ rangeMax: 100, suddenDeath: false }, 2, 'toggle-2');
    let s = bo3.state;
    while (!GuessNumberGame.isTerminal(s)) {
      s = playRoundWithDefaults(s).state;
    }
    expect(s.secretHistory.length).toBeGreaterThanOrEqual(2);
    expect(s.secretHistory.length).toBeLessThanOrEqual(3);
  });

  it('rejects an invalid config at init', () => {
    expect(() => GuessNumberGame.init({ rangeMax: 50 as 100, suddenDeath: true }, 2, 's')).toThrow();
    expect(() => GuessNumberGame.init({ rangeMax: 100, suddenDeath: 'yes' as unknown as boolean }, 2, 's')).toThrow();
    expect(() => GuessNumberGame.init(SUDDEN_DEATH, 1, 's')).toThrow();
    expect(() => GuessNumberGame.init(SUDDEN_DEATH, 5, 's')).toThrow();
  });

  it('omits timingClass — the intentional proof of the room-layer default path (M4)', () => {
    // Every guess-number state is an ordinary 'turn'; the optional hook is
    // deliberately NOT implemented, so the room layer's `?? 'turn'` default
    // is exercised in production. This pin makes accidentally adding the
    // method (and silently changing new-room budgets) a test failure.
    expect(GuessNumberGame.timingClass).toBeUndefined();
  });

  it('registry: "guess-number" resolves, unknown id returns null', () => {
    expect(getGame('guess-number')).toBe(GuessNumberGame);
    expect(GAME_REGISTRY['guess-number']).toBe(GuessNumberGame);
    expect(getGame('does-not-exist')).toBeNull();
  });

  it('round-trips state/view/events through JSON without change', () => {
    const { state, events: initEvents } = GuessNumberGame.init(BEST_OF_3, 3, 'json-seed');
    const { state: afterGuess, events } = ((): { state: GNState; events: GNEvent[] } => {
      const res = GuessNumberGame.applyAction(state, 0, { type: 'guess', value: 50 });
      if (!res.ok) throw new Error('unexpected rejection');
      return res;
    })();

    const stateRoundTrip = JSON.parse(JSON.stringify(afterGuess));
    expect(stateRoundTrip).toEqual(afterGuess);

    const view = GuessNumberGame.playerView(afterGuess, 1);
    const viewRoundTrip = JSON.parse(JSON.stringify(view));
    expect(viewRoundTrip).toEqual(view);

    for (const event of [...initEvents, ...events]) {
      const eventRoundTrip = JSON.parse(JSON.stringify(event));
      expect(eventRoundTrip).toEqual(event);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression for a 1-in-rangeMax CI flake (QA ratchet: the finding is pinned
// by a cheap deterministic rung, not by remembering it).
//
// tests/e2e/reconnection.e2e.test.ts plays a deliberately WRONG guess from
// each seat and then acts purely from the resync snapshot's hints, which
// requires the hints to offer some value that is not the secret. The old rule
// "guess 1, unless the secret is 1, in which case guess 2" broke that at
// secret === 1: guessing 2 narrows hi to 1, the consistent range collapses to
// lo === hi === 1, and legalActions degenerates to the single hint {1} — the
// secret itself. Rooms draw their secret from server-side random bytes, so
// that is ~1% of runs: green almost always, and indistinguishable from
// infrastructure noise until someone replays every secret.
//
// The e2e cannot pin this itself (it sees one random secret per run), so the
// invariant is proven HERE by exhaustive replay over every secret, at both
// config sizes.
// ---------------------------------------------------------------------------
describe('wrongGuessFor: the harness rule that keeps the range open', () => {
  /** Replay what the e2e does — the same wrong guess from each of two seats —
   *  and report the state the acting seat would then be asked to act from. */
  function replay(
    config: GNConfig,
    secret: number,
    guess: number,
  ): { state: GNState; hints: GNAction[] } {
    const base = GuessNumberGame.init(config, 2, 'exhaustive-replay').state;
    // Only `secret` is substituted; every other field is the engine's own
    // freshly-initialized round (lo=1, hi=rangeMax, toAct=0). Substituting
    // beats hunting a seed per secret. What is asserted separately below is
    // narrower than this exhaustive sweep: that secret 1 — the ONE value the
    // superseded rule broke on — really is drawable from a real seed, so the
    // failing draw is demonstrated rather than assumed. Reachability of the
    // other secrets is not asserted, and is not needed: `nextInt` draws
    // uniformly from [1, rangeMax], and the rule is proven for all of them.
    let state: GNState = { ...base, secret };
    for (const seat of [0, 1] as const) {
      const res = GuessNumberGame.applyAction(state, seat, { type: 'guess', value: guess });
      if (!res.ok) throw new Error(`guess ${guess} rejected at secret ${secret}: ${res.error.code}`);
      state = res.state;
    }
    return { state, hints: GuessNumberGame.legalActions(state, state.toAct) };
  }

  // Spelled out rather than reusing SUDDEN_DEATH/BEST_OF_3: those differ only
  // in suddenDeath, which cannot matter here (it is consulted solely on a
  // CORRECT guess, and these guesses are never correct). rangeMax is the axis
  // that does matter, so both sizes appear explicitly.
  const RULE_CONFIGS: GNConfig[] = [
    { rangeMax: 100, suddenDeath: true },
    { rangeMax: 100, suddenDeath: false },
    { rangeMax: 1000, suddenDeath: true },
    { rangeMax: 1000, suddenDeath: false },
  ];

  for (const config of RULE_CONFIGS) {
    const { rangeMax } = config;

    it(`offers a non-secret hint for EVERY secret in [1, ${rangeMax}] (suddenDeath=${config.suddenDeath})`, () => {
      const collapsed: number[] = [];
      const noPlayableHint: number[] = [];

      for (let secret = 1; secret <= rangeMax; secret++) {
        const guess = wrongGuessFor(secret, rangeMax);
        expect(guess).not.toBe(secret); // half one: the guess is always wrong
        expect(guess).toBeGreaterThanOrEqual(1);
        expect(guess).toBeLessThanOrEqual(rangeMax);

        const { state, hints } = replay(config, secret, guess);

        // Never terminal: two wrong guesses cannot end the round, so the
        // seq arithmetic the e2e asserts on (applied.seq === seq + 1) holds.
        expect(state.phase).toBe('guessing');
        expect(state.guesses.every((g) => g.verdict !== 'correct')).toBe(true);

        // half two: the range stayed OPEN, which is what makes the hint set
        // more than one value wide.
        if (state.lo >= state.hi) collapsed.push(secret);
        if (!hints.some((h) => h.value !== secret)) noPlayableHint.push(secret);
      }

      expect(collapsed).toEqual([]);
      expect(noPlayableHint).toEqual([]);
    });

    it(`the superseded rule DID collapse at secret 1 (non-vacuity, ${rangeMax}, suddenDeath=${config.suddenDeath})`, () => {
      // Without this the regression above could pass for the wrong reason —
      // it must be able to tell the two rules apart.
      const naive = (secret: number): number => (secret === 1 ? 2 : 1);
      const { state, hints } = replay(config, 1, naive(1));
      expect(state.lo).toBe(1);
      expect(state.hi).toBe(1);
      expect(hints.map((h) => h.value)).toEqual([1]); // the only hint IS the secret
      expect(hints.some((h) => h.value !== 1)).toBe(false);

      // ...and the current rule survives the same secret.
      const fixed = replay(config, 1, wrongGuessFor(1, rangeMax));
      expect(fixed.state.lo).toBeLessThan(fixed.state.hi);
      expect(fixed.hints.some((h) => h.value !== 1)).toBe(true);
    });
  }

  it('secret 1 is genuinely reachable from a real seed (the draw is not hypothetical)', () => {
    let found: string | null = null;
    for (let i = 0; i < 5000 && found === null; i++) {
      const seed = `reachability-${i}`;
      if (GuessNumberGame.init(SUDDEN_DEATH, 2, seed).state.secret === 1) found = seed;
    }
    expect(found).not.toBeNull();
  });
});
