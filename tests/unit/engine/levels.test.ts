// Tests for src/engine/guandan/levels.ts — spec docs/rules/guandan.md §6
// (scoring, upgrades, A-win, attempts) and the §1.5 refinement (owner house
// rule aFailConsequence='suspendPlayOpponentLevel').

import { describe, expect, it } from 'vitest';
import type { Rank } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import {
  addLevels,
  applyHandResult,
  levelIndex,
  scoreHand,
  selectCurrentLevel,
  type ApplyHandResultInput,
} from '../../../src/engine/guandan/levels';
import type { HandResult } from '../../../src/engine/guandan/types';

function cfg(overrides: Partial<RuleVariant> = {}): RuleVariant {
  return { ...JIANGSU_OFFICIAL_ONLINE, ...overrides };
}

/** Hand result shorthand: winner team + delta (finishOrder is opaque here —
 *  applyHandResult only reads winnerTeam/levelDelta). */
function res(winnerTeam: 0 | 1, levelDelta: number): HandResult {
  const finishOrder = winnerTeam === 0 ? [0] : [1];
  return { finishOrder, winnerTeam, levelDelta };
}

function input(overrides: Partial<ApplyHandResultInput> = {}): ApplyHandResultInput {
  return {
    config: cfg(),
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    currentLevel: '2',
    declarerTeam: 0,
    result: res(0, 3),
    finalPlayAllAces: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreHand (spec §6.1)
// ---------------------------------------------------------------------------

describe('scoreHand', () => {
  const cases: { name: string; order: number[]; winnerTeam: 0 | 1; delta: number }[] = [
    { name: '§6.1 partner 2nd (1-2 finish, 1-2) → +3', order: [0, 2, 1, 3], winnerTeam: 0, delta: 3 },
    { name: '§6.1 partner 3rd (1-3) → +2', order: [0, 1, 2, 3], winnerTeam: 0, delta: 2 },
    { name: '§6.1 partner 4th (1-4, single-up finish) → +1', order: [0, 1, 3, 2], winnerTeam: 0, delta: 1 },
    { name: '§6.1 team 1 winner: [1,3,0,2] → +3', order: [1, 3, 0, 2], winnerTeam: 1, delta: 3 },
    { name: '§6.1 team 1 winner: [3,0,1,2] → +2', order: [3, 0, 1, 2], winnerTeam: 1, delta: 2 },
    // spec §5.8: the hand ends the moment the result is known — the order
    // may be truncated; an absent seat never finished (= last place).
    { name: '§5.8 truncated 1-2 finish [0,2] → +3', order: [0, 2], winnerTeam: 0, delta: 3 },
    { name: '§5.8 truncated [1,2,3] partner 3rd → +2', order: [1, 2, 3], winnerTeam: 1, delta: 2 },
    { name: '§5.8 truncated [0,1,3] partner absent = 4th → +1', order: [0, 1, 3], winnerTeam: 0, delta: 1 },
  ];
  it.each(cases)('$name', ({ order, winnerTeam, delta }) => {
    const r = scoreHand(order);
    expect(r.winnerTeam).toBe(winnerTeam);
    expect(r.levelDelta).toBe(delta);
    expect(r.finishOrder).toEqual(order);
  });

  it('does not alias the caller finishOrder array (pure in/out)', () => {
    const order = [0, 2];
    const r = scoreHand(order);
    expect(r.finishOrder).not.toBe(order);
  });
});

// ---------------------------------------------------------------------------
// levelIndex / addLevels (spec §6.3)
// ---------------------------------------------------------------------------

describe('levelIndex / addLevels', () => {
  it('levelIndex spans the 2..A ladder', () => {
    expect(levelIndex('2')).toBe(0);
    expect(levelIndex('T')).toBe(8);
    expect(levelIndex('A')).toBe(12);
  });

  const cases: { name: string; from: Rank; delta: number; level: Rank; overshot: boolean }[] = [
    { name: '§6.1 2+3 → 5', from: '2', delta: 3, level: '5', overshot: false },
    { name: '§6.1 9+2 → J', from: '9', delta: 2, level: 'J', overshot: false },
    { name: '§6.3 K+1 lands exactly on A (not an overshoot)', from: 'K', delta: 1, level: 'A', overshot: false },
    { name: '§6.3 K+3 clamps to A', from: 'K', delta: 3, level: 'A', overshot: true },
    { name: '§6.3 K+2 clamps to A (overshoot fact reported)', from: 'K', delta: 2, level: 'A', overshot: true },
    { name: '§6.3 Q+3 clamps to A (overshoot fact reported)', from: 'Q', delta: 3, level: 'A', overshot: true },
    { name: '§6.3 Q+2 lands exactly on A', from: 'Q', delta: 2, level: 'A', overshot: false },
  ];
  it.each(cases)('$name', ({ from, delta, level, overshot }) => {
    expect(addLevels(from, delta)).toEqual({ level, overshot });
  });
});

// ---------------------------------------------------------------------------
// applyHandResult — upgrades & overshoot (spec §6.1–§6.3)
// ---------------------------------------------------------------------------

describe('applyHandResult: upgrades', () => {
  it('§6.1/§6.2 only the winning team moves; loser unchanged', () => {
    const out = applyHandResult(input({ levels: ['5', '8'], currentLevel: '5', result: res(0, 2) }));
    expect(out.levels).toEqual(['7', '8']);
    expect(out.matchWinner).toBeNull();
  });

  it('§6.3 K+3 clamps to A (overshootWinsGame=false default): no match win', () => {
    const out = applyHandResult(input({ levels: ['K', '4'], currentLevel: 'K', result: res(0, 3) }));
    expect(out.levels).toEqual(['A', '4']);
    expect(out.matchWinner).toBeNull();
  });

  it('§6.3 overshootWinsGame=true: K+3 overshoots and wins the match outright', () => {
    const out = applyHandResult(
      input({ config: cfg({ overshootWinsGame: true }), levels: ['K', '4'], currentLevel: 'K', result: res(0, 3) }),
    );
    expect(out.matchWinner).toBe(0);
    expect(out.levels[0]).toBe('A');
  });

  it('§6.3 overshootWinsGame=true: K+1 lands exactly on A — no outright win', () => {
    const out = applyHandResult(
      input({ config: cfg({ overshootWinsGame: true }), levels: ['K', '4'], currentLevel: 'K', result: res(0, 1) }),
    );
    expect(out.matchWinner).toBeNull();
    expect(out.levels).toEqual(['A', '4']);
  });

  it('§6.2 levelTrack=shared: the winner moves the single shared ladder (both entries)', () => {
    const out = applyHandResult(
      input({ config: cfg({ levelTrack: 'shared' }), levels: ['5', '5'], currentLevel: '5', result: res(1, 2) }),
    );
    expect(out.levels).toEqual(['7', '7']);
  });

  it('inputs are never mutated (pure in/out)', () => {
    const levels: [Rank, Rank] = ['5', '8'];
    const aAttempts: [number, number] = [1, 2];
    const flags: [boolean, boolean] = [false, true];
    applyHandResult(input({ levels, aAttempts, aAttemptsExhausted: flags, currentLevel: '5', result: res(0, 3) }));
    expect(levels).toEqual(['5', '8']);
    expect(aAttempts).toEqual([1, 2]);
    expect(flags).toEqual([false, true]);
  });
});

// ---------------------------------------------------------------------------
// applyHandResult — the A win condition (spec §6.4)
// ---------------------------------------------------------------------------

describe('applyHandResult: winning at A', () => {
  const atA = (result: HandResult, overrides: Partial<ApplyHandResultInput> = {}) =>
    input({ levels: ['A', '9'], currentLevel: 'A', declarerTeam: 0, result, ...overrides });

  it('§6.4 1-2 at A wins', () => {
    const out = applyHandResult(atA(res(0, 3)));
    expect(out.matchWinner).toBe(0);
  });

  it('§6.4 1-3 at A wins', () => {
    const out = applyHandResult(atA(res(0, 2)));
    expect(out.matchWinner).toBe(0);
  });

  it('§6.4 1-4 at A does NOT win and grants no level', () => {
    const out = applyHandResult(atA(res(0, 1)));
    expect(out.matchWinner).toBeNull();
    expect(out.levels).toEqual(['A', '9']); // A is the cap — no level granted
    expect(out.aAttempts).toEqual([1, 0]); // ...and the attempt is consumed
  });

  it('§6.4 aWinPartnerNotLast=false variant: any 1st finisher at A wins, including 1-4', () => {
    const out = applyHandResult(atA(res(0, 1), { config: cfg({ aWinPartnerNotLast: false }) }));
    expect(out.matchWinner).toBe(0);
  });

  it('§6.4 a 1-2 by a team at A that is NOT the declarer does not win the match', () => {
    // spec §6.4 (CORE): attempts happen only in hands played at their A.
    const out = applyHandResult(
      input({ levels: ['A', '9'], currentLevel: '9', declarerTeam: 1, result: res(0, 3) }),
    );
    expect(out.matchWinner).toBeNull();
    expect(out.levels).toEqual(['A', '9']);
  });
});

// ---------------------------------------------------------------------------
// applyHandResult — attempt accounting & consequences (spec §6.4)
// ---------------------------------------------------------------------------

describe('applyHandResult: A-attempt accounting', () => {
  it('§6.4 declarer at A losing the hand outright consumes an attempt', () => {
    const out = applyHandResult(
      input({ levels: ['A', '5'], currentLevel: 'A', declarerTeam: 0, result: res(1, 2) }),
    );
    expect(out.aAttempts).toEqual([1, 0]);
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.levels).toEqual(['A', '7']); // opponents still climb normally
  });

  it('§6.4 default aAttemptOnlyAsDeclarer=true: losing at A as NON-declarer consumes nothing', () => {
    const out = applyHandResult(
      input({ levels: ['A', '5'], currentLevel: '5', declarerTeam: 1, result: res(1, 2) }),
    );
    expect(out.aAttempts).toEqual([0, 0]);
  });

  it('§6.4 aAttemptOnlyAsDeclarer=false variant: losing at A in an opponent-declared hand consumes an attempt', () => {
    const out = applyHandResult(
      input({
        config: cfg({ aAttemptOnlyAsDeclarer: false }),
        levels: ['A', '5'],
        currentLevel: '5',
        declarerTeam: 1,
        result: res(1, 2),
      }),
    );
    expect(out.aAttempts).toEqual([1, 0]);
  });

  it('§6.4 aAttemptOnlyAsDeclarer=false: WINNING a hand at A as non-declarer is not a failed attempt (documented reading)', () => {
    const out = applyHandResult(
      input({
        config: cfg({ aAttemptOnlyAsDeclarer: false }),
        levels: ['A', '5'],
        currentLevel: '5',
        declarerTeam: 1,
        result: res(0, 2),
      }),
    );
    expect(out.aAttempts).toEqual([0, 0]);
  });

  it('§6.4 aMaxAttempts=null: attempts count up forever, no consequence ever fires', () => {
    let state = input({
      config: cfg({ aMaxAttempts: null }),
      levels: ['A', '5'],
      currentLevel: 'A',
      declarerTeam: 0,
      result: res(0, 1), // repeated 1-4 wins keep team 0 declaring at A
    });
    let out = applyHandResult(state);
    for (let i = 0; i < 6; i++) {
      state = input({ ...state, aAttempts: out.aAttempts, aAttemptsExhausted: out.aAttemptsExhausted });
      out = applyHandResult(state);
    }
    expect(out.aAttempts[0]).toBe(7);
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.levels[0]).toBe('A');
  });

  it("§6.4 aFailConsequence='none': counter passes aMaxAttempts and keeps counting; nothing else happens", () => {
    const out = applyHandResult(
      input({
        config: cfg({ aFailConsequence: 'none' }),
        levels: ['A', '5'],
        aAttempts: [3, 0], // already past the max of 3
        currentLevel: 'A',
        declarerTeam: 0,
        result: res(1, 1),
      }),
    );
    expect(out.aAttempts).toEqual([4, 0]);
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.levels[0]).toBe('A');
  });

  it("§6.4 aFailConsequence='demote' to level2: third failure demotes to 2 and resets the counter", () => {
    const out = applyHandResult(
      input({
        config: cfg({ aFailConsequence: 'demote', aFailDemoteTo: 'level2' }),
        levels: ['A', '5'],
        aAttempts: [2, 0],
        currentLevel: 'A',
        declarerTeam: 0,
        result: res(1, 1),
      }),
    );
    expect(out.levels).toEqual(['2', '6']);
    expect(out.aAttempts).toEqual([0, 0]);
    expect(out.aAttemptsExhausted).toEqual([false, false]);
  });

  it("§6.4 aFailConsequence='demote' to levelJ: third failure demotes to J", () => {
    const out = applyHandResult(
      input({
        config: cfg({ aFailConsequence: 'demote', aFailDemoteTo: 'levelJ' }),
        levels: ['A', '5'],
        aAttempts: [2, 0],
        currentLevel: 'A',
        declarerTeam: 0,
        result: res(1, 1),
      }),
    );
    expect(out.levels).toEqual(['J', '6']);
    expect(out.aAttempts).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// The owner house rule: suspendPlayOpponentLevel lifecycle
// (spec §6.4 + §1.5 refinement — owner's personal review focus)
// ---------------------------------------------------------------------------

describe("owner house rule: aFailConsequence='suspendPlayOpponentLevel'", () => {
  it('§6.4/§1.5 full suspension lifecycle: 3 failed attempts → suspended at opponents\' level → hand win reopens the A window fresh', () => {
    const config = cfg(); // defaults: suspend, aMaxAttempts=3, fresh reset
    let levels: [Rank, Rank] = ['A', '5'];
    let aAttempts: [number, number] = [0, 0];
    let aAttemptsExhausted: [boolean, boolean] = [false, false];

    // Attempts 1 and 2: team 0 declares at A and wins 1-4 each time — the
    // hand is won (so team 0 keeps declaring) but the attempt fails (§6.4).
    for (const expectedCount of [1, 2]) {
      const sel = selectCurrentLevel({ config, levels, declarerTeam: 0, aAttemptsExhausted });
      expect(sel).toEqual({ level: 'A', suspensionApplied: false });
      const out = applyHandResult(
        input({ config, levels, aAttempts, aAttemptsExhausted, currentLevel: sel.level, declarerTeam: 0, result: res(0, 1) }),
      );
      expect(out.matchWinner).toBeNull();
      expect(out.aAttempts).toEqual([expectedCount, 0]);
      expect(out.aAttemptsExhausted).toEqual([false, false]);
      ({ levels, aAttempts, aAttemptsExhausted } = out);
    }

    // Attempt 3 (the exhausting hand): third 1-4 → exhausted flag set,
    // level UNTOUCHED (never demoted — the owner rule's defining property).
    // Note team 0 WON this hand, but the hand-start flag was false, so the
    // win does not clear the exhaustion it just caused (§6.4: "first hand
    // the exhausted team wins AFTER the exhausting hand").
    let out = applyHandResult(
      input({ config, levels, aAttempts, aAttemptsExhausted, currentLevel: 'A', declarerTeam: 0, result: res(0, 1) }),
    );
    expect(out.aAttempts).toEqual([3, 0]);
    expect(out.aAttemptsExhausted).toEqual([true, false]);
    expect(out.levels).toEqual(['A', '5']); // still A — never demoted
    ({ levels, aAttempts, aAttemptsExhausted } = out);

    // §1.5 refinement: team 0 declares the next hand (it won), but its
    // attempt is suspended — the hand is played at the OPPONENTS' level.
    const suspended = selectCurrentLevel({ config, levels, declarerTeam: 0, aAttemptsExhausted });
    expect(suspended).toEqual({ level: '5', suspensionApplied: true });

    // The suspended team WINS that hand (1-3 at the opponents' 5): no match
    // win (not an A attempt), no level gain (capped at A), flag cleared,
    // counter restarted fresh (aAttemptCounterReset='fresh').
    out = applyHandResult(
      input({ config, levels, aAttempts, aAttemptsExhausted, currentLevel: suspended.level, declarerTeam: 0, result: res(0, 2) }),
    );
    expect(out.matchWinner).toBeNull();
    expect(out.levels).toEqual(['A', '5']);
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.aAttempts).toEqual([0, 0]); // fresh
    ({ levels, aAttempts, aAttemptsExhausted } = out);

    // Attempt window reopened: plain §1.5 again — team 0 declares at its A.
    const resumed = selectCurrentLevel({ config, levels, declarerTeam: 0, aAttemptsExhausted });
    expect(resumed).toEqual({ level: 'A', suspensionApplied: false });
  });

  it('§6.4 suspended hands consume no attempts, and losing while suspended does not clear the flag', () => {
    const out = applyHandResult(
      input({
        levels: ['A', '5'],
        aAttempts: [3, 0],
        aAttemptsExhausted: [true, false],
        currentLevel: '5', // suspended declarer plays at opponents' level
        declarerTeam: 0,
        result: res(1, 2), // team 0 LOSES the suspended hand
      }),
    );
    expect(out.aAttempts).toEqual([3, 0]); // unchanged — not attempting
    expect(out.aAttemptsExhausted).toEqual([true, false]); // still suspended
    expect(out.levels).toEqual(['A', '7']);
  });

  it("§6.4 aAttemptCounterReset='cumulative': the win clears the flag but keeps the count — the next failed attempt re-exhausts immediately", () => {
    const config = cfg({ aAttemptCounterReset: 'cumulative' });
    // Suspended team 0 wins a hand: flag clears, counter stays at 3.
    let out = applyHandResult(
      input({
        config,
        levels: ['A', '5'],
        aAttempts: [3, 0],
        aAttemptsExhausted: [true, false],
        currentLevel: '5',
        declarerTeam: 0,
        result: res(0, 2),
      }),
    );
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.aAttempts).toEqual([3, 0]); // cumulative: count survives
    // Next hand: team 0 declares at A again and fails (1-4) — the counter
    // hits 4 ≥ 3 and exhaustion re-triggers immediately (documented reading).
    out = applyHandResult(
      input({
        config,
        levels: out.levels,
        aAttempts: out.aAttempts,
        aAttemptsExhausted: out.aAttemptsExhausted,
        currentLevel: 'A',
        declarerTeam: 0,
        result: res(0, 1),
      }),
    );
    expect(out.aAttempts).toEqual([4, 0]);
    expect(out.aAttemptsExhausted).toEqual([true, false]);
    expect(out.levels[0]).toBe('A'); // still never demoted
  });

  it("§1.5/§6.4 both-at-A corner: suspended declarer plays at the opponents' A, and winning 1-2 there clears the flag but does NOT win the match", () => {
    const config = cfg();
    const levels: [Rank, Rank] = ['A', 'A'];
    const aAttemptsExhausted: [boolean, boolean] = [true, false];
    // selectCurrentLevel returns 'A' with suspensionApplied — harmless.
    const sel = selectCurrentLevel({ config, levels, declarerTeam: 0, aAttemptsExhausted });
    expect(sel).toEqual({ level: 'A', suspensionApplied: true });
    // Even though currentLevel is 'A', it is the OPPONENTS' A: the suspended
    // winner gets the suspension-clear, not the match.
    const out = applyHandResult(
      input({
        config,
        levels,
        aAttempts: [3, 0],
        aAttemptsExhausted,
        currentLevel: sel.level,
        declarerTeam: 0,
        result: res(0, 3),
      }),
    );
    expect(out.matchWinner).toBeNull();
    expect(out.aAttemptsExhausted).toEqual([false, false]);
    expect(out.aAttempts).toEqual([0, 0]);
    expect(out.levels).toEqual(['A', 'A']);
  });
});

// ---------------------------------------------------------------------------
// aceFinishDemotes (spec §6.4, obscure variant, default off)
// ---------------------------------------------------------------------------

describe('applyHandResult: aceFinishDemotes', () => {
  const scenario = (config: RuleVariant, finalPlayAllAces: boolean) =>
    input({
      config,
      levels: ['A', '9'],
      currentLevel: 'A',
      declarerTeam: 0,
      result: res(1, 2), // opponents win the hand
      finalPlayAllAces,
    });

  it('§6.4 aceFinishDemotes=false (default): all-Aces finish against declarers at A demotes nothing', () => {
    const out = applyHandResult(scenario(cfg(), true));
    expect(out.levels).toEqual(['A', 'J']);
  });

  it('§6.4 aceFinishDemotes=true: declarers at A lose to an all-Aces final play → immediate demotion to 2', () => {
    const out = applyHandResult(scenario(cfg({ aceFinishDemotes: true }), true));
    expect(out.levels).toEqual(['2', 'J']);
    expect(out.aAttempts).toEqual([0, 0]); // counter reset with the demotion
  });

  it('§6.4 aceFinishDemotes=true: no demotion when the final play was not all Aces', () => {
    const out = applyHandResult(scenario(cfg({ aceFinishDemotes: true }), false));
    expect(out.levels).toEqual(['A', 'J']);
    expect(out.aAttempts).toEqual([1, 0]); // normal failed attempt only
  });

  it('§6.4 aceFinishDemotes=true never fires on a SUSPENDED declarer (hand was not played at their A)', () => {
    const out = applyHandResult(
      input({
        config: cfg({ aceFinishDemotes: true }),
        levels: ['A', '9'],
        aAttempts: [3, 0],
        aAttemptsExhausted: [true, false],
        currentLevel: '9',
        declarerTeam: 0,
        result: res(1, 2),
        finalPlayAllAces: true,
      }),
    );
    expect(out.levels).toEqual(['A', 'J']); // owner rule: never demoted
    expect(out.aAttemptsExhausted).toEqual([true, false]);
  });
});

// ---------------------------------------------------------------------------
// selectCurrentLevel (spec §1.5 + refinement)
// ---------------------------------------------------------------------------

describe('selectCurrentLevel', () => {
  it("§1.5 first hand (declarerTeam=null) is played at '2'", () => {
    const sel = selectCurrentLevel({
      config: cfg(),
      levels: ['2', '2'],
      declarerTeam: null,
      aAttemptsExhausted: [false, false],
    });
    expect(sel).toEqual({ level: '2', suspensionApplied: false });
  });

  it("§1.5 plain case: the declarer team's level", () => {
    const sel = selectCurrentLevel({
      config: cfg(),
      levels: ['7', 'J'],
      declarerTeam: 1,
      aAttemptsExhausted: [false, false],
    });
    expect(sel).toEqual({ level: 'J', suspensionApplied: false });
  });

  it("§1.5 refinement: exhausted declarer plays at the OPPONENTS' level with suspensionApplied", () => {
    const sel = selectCurrentLevel({
      config: cfg(),
      levels: ['A', '8'],
      declarerTeam: 0,
      aAttemptsExhausted: [true, false],
    });
    expect(sel).toEqual({ level: '8', suspensionApplied: true });
  });

  it('§1.5 the OPPONENT of an exhausted team declaring is unaffected (plain rule)', () => {
    const sel = selectCurrentLevel({
      config: cfg(),
      levels: ['A', '8'],
      declarerTeam: 1,
      aAttemptsExhausted: [true, false],
    });
    expect(sel).toEqual({ level: '8', suspensionApplied: false });
  });

  it("§6.4 the refinement is scoped to aFailConsequence='suspendPlayOpponentLevel' (defensive: other modes ignore a stray flag)", () => {
    const sel = selectCurrentLevel({
      config: cfg({ aFailConsequence: 'demote' }),
      levels: ['A', '8'],
      declarerTeam: 0,
      aAttemptsExhausted: [true, false],
    });
    expect(sel).toEqual({ level: 'A', suspensionApplied: false });
  });

  it("§6.2 levelTrack=shared: both entries are equal, so declarer and suspension reads coincide (documented reading)", () => {
    const sel = selectCurrentLevel({
      config: cfg({ levelTrack: 'shared' }),
      levels: ['9', '9'],
      declarerTeam: 0,
      aAttemptsExhausted: [false, false],
    });
    expect(sel).toEqual({ level: '9', suspensionApplied: false });
  });
});
