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
    for (const s of [1, 2, 3] as Seat[]) {
      expect(GuandanGame.timingClass!(state, s), `seat ${s} keeps its window`).toBe('planning');
    }
    // Seat 1 acts (its first action = its planning action); seat 2-3 still hold.
    state = actOnce(state, 1);
    expect(GuandanGame.timingClass!(state, 1)).toBe('turn');
    expect(GuandanGame.timingClass!(state, 2)).toBe('planning');
    expect(GuandanGame.timingClass!(state, 3)).toBe('planning');
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
    const legacy = JSON.parse(JSON.stringify(state)) as GuandanState & {
      actedThisHand?: unknown;
    };
    delete legacy.actedThisHand;
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
