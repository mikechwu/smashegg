// End-to-end integration smoke: seeded random bots drive GuandanGame
// through the PUBLIC GameDefinition interface only. Catches glue bugs the
// module tests can't (phase transitions, atomic hand rollover, liveness).

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, type PrngState } from '../../../src/engine/core/prng';
import { GuandanGame } from '../../../src/engine/guandan';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import type { GuandanState } from '../../../src/engine/guandan/types';

/** Drive a match with seeded random bots. Returns the final state. */
function playout(
  config: RuleVariant,
  seed: string,
  opts: { maxActions: number; stopAfterHands?: number },
): { state: GuandanState; actions: number; handsCompleted: number } {
  const init = GuandanGame.init(config, 4, seed);
  let state = init.state;
  let bot: PrngState = seedPrng(`bot:${seed}`);
  let actions = 0;
  let handsCompleted = 0;

  while (!GuandanGame.isTerminal(state) && actions < opts.maxActions) {
    const actors = GuandanGame.expectedActors(state);
    expect(actors.length, `liveness: actors in phase ${state.phase}`).toBeGreaterThan(0);

    const seat = actors[0]!;
    const legal = GuandanGame.legalActions(state, seat);
    const fallback = GuandanGame.defaultAction(state, seat);
    expect(legal.length > 0 || fallback !== null, 'obligation 5: some action exists').toBe(true);

    // Bias toward playing over passing so hands actually finish.
    let action = fallback!;
    if (legal.length > 0) {
      const plays = legal.filter((a) => a.type !== 'pass');
      const pool = plays.length > 0 ? plays : legal;
      const pick = nextInt(bot, pool.length);
      bot = pick.state;
      action = pool[pick.value]!;
    }

    const before = state.handNo;
    const res = GuandanGame.applyAction(state, seat, action);
    if (!res.ok) {
      throw new Error(`applyAction rejected a legal action: ${res.error.code} (phase ${state.phase})`);
    }
    state = res.state;
    actions++;
    if (state.handNo > before || GuandanGame.isTerminal(state)) handsCompleted++;

    // Periodic serializability + redaction spot checks (obligations 2, 3).
    if (actions % 500 === 0) {
      const roundTripped = JSON.parse(JSON.stringify(state)) as GuandanState;
      expect(roundTripped).toEqual(state);
      for (let viewer = 0; viewer < 4; viewer++) {
        const view = GuandanGame.playerView(state, viewer);
        const blob = JSON.stringify(view);
        expect(blob.includes('"prng"')).toBe(false);
        expect(view.hand.length).toBe(state.hands[viewer]!.length);
      }
    }

    if (opts.stopAfterHands !== undefined && handsCompleted >= opts.stopAfterHands) break;
  }
  return { state, actions, handsCompleted };
}

describe('GuandanGame integration (seeded bot playouts)', () => {
  it('plays to matchEnd or 25 hands under the default profile without any invariant violation', () => {
    const run = playout(JIANGSU_OFFICIAL_ONLINE, 'integration-default-1', {
      maxActions: 100_000,
      stopAfterHands: 25,
    });
    // A legitimate matchEnd before 25 hands is fine (a team passed A); what
    // must never happen is stalling out the action budget mid-match.
    expect(run.actions).toBeLessThan(100_000);
    expect(GuandanGame.isTerminal(run.state) || run.handsCompleted >= 25).toBe(true);
  });

  it('reaches matchEnd under overshootWinsGame=true and reports a result', () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, overshootWinsGame: true };
    const run = playout(config, 'integration-overshoot-1', { maxActions: 200_000 });
    expect(GuandanGame.isTerminal(run.state)).toBe(true);
    const result = GuandanGame.result(run.state);
    expect(result).not.toBeNull();
    expect(result!.standings[0]!.rank).toBe(1);
    expect(result!.standings[0]!.seats.length).toBe(2);
  });

  it('is deterministic: same seed + same bot policy ⇒ identical final state', () => {
    const a = playout(JIANGSU_OFFICIAL_ONLINE, 'determinism-7', { maxActions: 20_000, stopAfterHands: 5 });
    const b = playout(JIANGSU_OFFICIAL_ONLINE, 'determinism-7', { maxActions: 20_000, stopAfterHands: 5 });
    expect(a.actions).toBe(b.actions);
    expect(a.state).toEqual(b.state);
  });

  it("rejects winnersChoose config at init (documented M1 limitation, not a silent substitute)", () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, equalTributeAssignment: 'winnersChoose' };
    expect(() => GuandanGame.init(config, 4, 'x')).toThrow(/notImplemented/);
  });

  it("rejects tributeLevelBasis='previousLevel' at init (Codex+Grok convergent audit finding: was silently ignored)", () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, tributeLevelBasis: 'previousLevel' };
    expect(() => GuandanGame.init(config, 4, 'x')).toThrow(/notImplemented/);
  });

  it("rejects levelTrack='shared' + aFailConsequence='demote' at init (Grok audit finding: ladder desync)", () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, levelTrack: 'shared', aFailConsequence: 'demote' };
    expect(() => GuandanGame.init(config, 4, 'x')).toThrow(/notImplemented/);
  });

  it('rejects a partial config at init instead of silently defaulting (Grok M3 audit F1)', () => {
    // A missing turnDirection previously fell into the clockwise branch of
    // nextSeat silently — strict validation makes partial configs loud.
    expect(() => GuandanGame.init({} as RuleVariant, 4, 'x')).toThrow(/config\.invalid: turnDirection/);
    const missingOne = { ...JIANGSU_OFFICIAL_ONLINE } as Record<string, unknown>;
    delete missingOne['jiefengRecipient'];
    expect(() => GuandanGame.init(missingOne as unknown as RuleVariant, 4, 'x')).toThrow(
      /config\.invalid: jiefengRecipient/,
    );
  });

  it('rejects unknown config keys at init (typos can never silently no-op)', () => {
    const typod = { ...JIANGSU_OFFICIAL_ONLINE, jokrBombSupreme: true } as unknown as RuleVariant;
    expect(() => GuandanGame.init(typod, 4, 'x')).toThrow(/config\.unknownKey: jokrBombSupreme/);
  });
});
