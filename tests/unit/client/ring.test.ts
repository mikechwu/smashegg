// Pre-M5 ring restyle: the visual gates extracted as pure predicates. The
// client suite is DOM-free (environment: 'node'), so these decisions are
// pinned here rather than chased with flaky screenshots (owner's rule; the
// isCeremonyShowing extraction is the precedent).

import { describe, expect, it } from 'vitest';
import { beatState, handSizeTier, leadPromptKey } from '../../../src/client/table/helpers';

describe('beatState (F9 binary legal-play cue)', () => {
  const play = { type: 'play' } as const;
  const pass = { type: 'pass' } as const;

  it('leading (no pass offered) is always "lead" — you may play anything', () => {
    expect(beatState([play, play], false)).toBe('lead');
    expect(beatState([], false)).toBe('lead');
  });

  it('following with at least one legal play is "canBeat"', () => {
    expect(beatState([play, pass], true)).toBe('canBeat');
    expect(beatState([pass, play], true)).toBe('canBeat');
  });

  it('following with ONLY pass is "cannotBeat" — the beginner-trap state', () => {
    expect(beatState([pass], true)).toBe('cannotBeat');
    // A hints set that somehow carries no play and no pass while a trick is up
    // still reads as cannotBeat (you certainly can't beat it).
    expect(beatState([], true)).toBe('cannotBeat');
  });
});

describe('handSizeTier (F11 / low-card alert escalation)', () => {
  it('normal above the alert line', () => {
    expect(handSizeTier(27)).toBe('normal');
    expect(handSizeTier(11)).toBe('normal');
  });

  it('low from the ≤10 alert line down to 3', () => {
    expect(handSizeTier(10)).toBe('low');
    expect(handSizeTier(3)).toBe('low');
  });

  it('critical at 1–2 (about to go out) and 0', () => {
    expect(handSizeTier(2)).toBe('critical');
    expect(handSizeTier(1)).toBe('critical');
    expect(handSizeTier(0)).toBe('critical');
  });

  it('pins the exact boundaries at 10 and 2', () => {
    expect(handSizeTier(11)).toBe('normal');
    expect(handSizeTier(10)).toBe('low');
    expect(handSizeTier(3)).toBe('low');
    expect(handSizeTier(2)).toBe('critical');
  });
});

describe('leadPromptKey (F8: the centre well never spectator-phrases YOUR lead)', () => {
  it('your own lead reads "your lead", not "waiting for [your name]"', () => {
    expect(leadPromptKey(2, 2)).toBe('game.trick.yourLead');
  });

  it("another seat's lead reads the waiting-for line", () => {
    expect(leadPromptKey(3, 0)).toBe('game.trick.waitingLead');
    expect(leadPromptKey(1, 2)).toBe('game.trick.waitingLead');
  });
});
