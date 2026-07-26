// Item 2 (design-refinement round): the per-seat planning window, named
// cases through the REAL engine (model = product; the obligations property
// suite additionally pins the semantics at every step of every seeded
// playout across the config grid). The owner scenario, verbatim: "seat 1
// plays fast while seats 2-4 are still sorting 27 fresh cards" — each
// seat's FIRST action of a hand classes 'planning'; later actions 'turn'.

import { describe, expect, it } from 'vitest';
import { GuandanGame } from '../../../src/engine/guandan';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { GuandanState } from '../../../src/engine/guandan/types';
import type { Seat } from '../../../src/engine/core/game';

const CFG = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'fixedSeat' as const };

function initHand1(): GuandanState {
  // fixedSeat pins the leader to seat 0, so the scenario is deterministic
  // without ceremony plumbing.
  return GuandanGame.init(CFG, 4, 'timing-class-named').state;
}

/** Apply the seat's first legal action (a play if leading, else pass). */
function actOnce(state: GuandanState, seat: Seat): GuandanState {
  const legal = GuandanGame.legalActions(state, seat);
  const pass = legal.find((a) => a.type === 'pass');
  const action = pass ?? legal[0]!;
  const res = GuandanGame.applyAction(state, seat, action);
  expect(res.ok, `apply ${action.type} by seat ${seat}`).toBe(true);
  return res.ok ? res.state : state;
}

describe('timingClass — the per-seat planning window (item 2)', () => {
  it("the owner scenario: the leader's fast play must NOT consume the others' windows", () => {
    let state = initHand1();
    // Fresh deal: everyone is planning.
    for (const s of [0, 1, 2, 3] as Seat[]) {
      expect(GuandanGame.timingClass!(state, s)).toBe('planning');
    }
    // Seat 0 (leader) plays fast.
    state = actOnce(state, 0);
    expect(GuandanGame.timingClass!(state, 0)).toBe('turn');
    // Seats 1-3 are still sorting: their windows are intact.
    //
    // A NOTE ON WHAT THIS LINE IS AND IS NOT. "everyone who has not acted is
    // 'planning'" is NOT a property of the engine, and asserting it as one is
    // the same mistake that made tests/e2e/timing.e2e.test.ts a 0.9% CI red:
    // timingClass checks isForcedPass BEFORE the planning branch, so the
    // ACTING follower (trick.toAct) classes 'forcedPass' whenever its only
    // legal action is pass. Measured over 30,000 fresh seeds with this exact
    // scenario: the assertion below fails on 289 of them (0.963%) — every
    // failure seat 1, never seats 2 or 3.
    //
    // It cannot fail HERE only because the seed is a literal and this deal
    // happens to leave seat 1 a play. That is a defused mine, not a fixed one:
    // touch the seed string, the shuffle, or the deal order and it re-arms for
    // reasons unrelated to whatever was being changed. So the distinction is
    // made explicit instead of relying on the literal.
    //
    // Seats 2 and 3 are NOT exposed and are asserted plainly: the forcedPass
    // branch is gated on `state.trick.toAct === seat`, so a non-actor can
    // never take it. That asymmetry is the actual rule.
    for (const s of [2, 3] as Seat[]) {
      expect(
        GuandanGame.timingClass!(state, s),
        `seat ${s} is not the actor, so it keeps its window unconditionally`,
      ).toBe('planning');
    }
    // Seat 1 IS the actor. On this deal it holds a play, which is what makes
    // 'planning' the right answer — asserted together so the precondition is
    // visible rather than assumed.
    expect(
      GuandanGame.legalActions(state, 1).some((a) => a.type === 'play'),
      'seat 1 has a legal play on this seed, so it is not a forced pass',
    ).toBe(true);
    expect(GuandanGame.timingClass!(state, 1), 'seat 1 keeps its window').toBe('planning');
    // Seat 1 acts (its first action = its planning action); seat 2-3 still hold.
    state = actOnce(state, 1);
    expect(GuandanGame.timingClass!(state, 1)).toBe('turn');
    expect(GuandanGame.timingClass!(state, 2)).toBe('planning');
    expect(GuandanGame.timingClass!(state, 3)).toBe('planning');
  });

  it("the ACTING seat's class is forcedPass-first, and that is why the rule above is asymmetric", () => {
    // The discriminating companion to the test above: it pins the precedence
    // that makes "not yet acted => planning" false, so the caveat in that test
    // is a checked claim rather than a comment. Constructed rather than hunted
    // — a hand whose only legal answer to the trick top is a pass.
    const state = initHand1();
    const lead = GuandanGame.legalActions(state, 0).find((a) => a.type === 'play')!;
    const afterLead = GuandanGame.applyAction(state, 0, lead);
    expect(afterLead.ok).toBe(true);
    if (!afterLead.ok) return;
    // Seat 1 is the actor. Strip its hand to a single card that cannot beat
    // the lead, so pass is its only legal action.
    const forced = {
      ...afterLead.state,
      hands: afterLead.state.hands.map((h, i) => (i === 1 ? ['3C' as const] : h)),
    } as typeof afterLead.state;
    const legal = GuandanGame.legalActions(forced, 1);
    expect(legal.every((a) => a.type === 'pass'), 'the setup really is pass-only').toBe(true);
    expect(forced.trick!.toAct, 'seat 1 really is the actor').toBe(1);
    // Not yet acted this hand — and STILL not 'planning'.
    expect((forced.actedThisHand ?? [])[1] ?? false).toBe(false);
    expect(GuandanGame.timingClass!(forced, 1)).toBe('forcedPass');
    // A NON-actor with the same untouched flag keeps its window, which is the
    // asymmetry itself.
    expect(GuandanGame.timingClass!(forced, 2)).toBe('planning');
  });

  it("a seat's SECOND action the same hand classes 'turn' (window consumed)", () => {
    let state = initHand1();
    // Full first trick: 0 plays, 1-3 pass → trick returns to 0 for trick 2.
    for (const s of [0, 1, 2, 3] as Seat[]) state = actOnce(state, s);
    expect(state.trick!.toAct).toBe(0);
    expect(GuandanGame.timingClass!(state, 0)).toBe('turn');
  });

  it('a state persisted BEFORE the field existed reads as not-yet-acted (live-room migration)', () => {
    const state = initHand1();
    // Simulate a pre-item-2 persisted state: the field is absent entirely.
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete raw.actedThisHand;
    const legacy = raw as unknown as GuandanState;
    expect(GuandanGame.timingClass!(legacy as GuandanState, 2)).toBe('planning');
    // ...and applying an action on the legacy state neither crashes nor
    // loses the mark.
    const res = GuandanGame.applyAction(legacy as GuandanState, 0, {
      ...(GuandanGame.legalActions(legacy as GuandanState, 0)[0] as object),
    } as never);
    expect(res.ok).toBe(true);
    if (res.ok) expect(GuandanGame.timingClass!(res.state, 0)).toBe('turn');
  });
});
