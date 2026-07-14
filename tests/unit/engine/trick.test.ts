import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { RuleVariant } from '../../../src/engine/guandan/config';
import {
  applyPass,
  applyPlay,
  nextActiveSeat,
  startTrick,
} from '../../../src/engine/guandan/trick';
import type { CanonicalForm, Play, TrickState } from '../../../src/engine/guandan/types';

type Hands = [Card[], Card[], Card[], Card[]];

// Card contents are irrelevant to trick.ts (it never inspects rank/suit or
// validates beats()) — only hand *length* (empty vs non-empty) matters, so
// tests use tiny placeholder hands.
function hands(...counts: number[]): Hands {
  return counts.map((n) => Array.from({ length: n }, (_, i) => `${i}S` as Card)) as Hands;
}

function decl(keyRank: CanonicalForm['keyRank'] = '5'): CanonicalForm {
  return { type: 'single', size: 1, keyRank };
}

function play(seat: number, keyRank: CanonicalForm['keyRank'] = '5'): Play {
  return { seat, cards: ['5S'], decl: decl(keyRank) };
}

const cfg = JIANGSU_OFFICIAL_ONLINE;
const cfgClockwise: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, turnDirection: 'clockwise' };
const cfgNextPlayer: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, jiefengRecipient: 'nextPlayer' };

describe('nextActiveSeat (spec §5.4 — a skip is not a pass)', () => {
  it('4-active rotation: simply the next seat in turn direction', () => {
    const h = hands(3, 3, 3, 3);
    expect(nextActiveSeat(0, h, cfg)).toBe(1);
    expect(nextActiveSeat(3, h, cfg)).toBe(0);
  });

  it('skips a single finished seat', () => {
    const h = hands(3, 0, 3, 3);
    expect(nextActiveSeat(0, h, cfg)).toBe(2); // seat 1 finished, skipped
  });

  it('skips two finished seats in a row', () => {
    const h = hands(3, 0, 0, 3);
    expect(nextActiveSeat(0, h, cfg)).toBe(3); // seats 1 and 2 finished
  });

  it('clockwise turnDirection inverts rotation (types.ts nextSeat)', () => {
    const h = hands(3, 3, 3, 3);
    expect(nextActiveSeat(0, h, cfgClockwise)).toBe(3);
  });

  it('degenerate case: only one active seat returns itself (spec §9.22)', () => {
    const h = hands(3, 0, 0, 0);
    expect(nextActiveSeat(0, h, cfg)).toBe(0);
  });
});

describe('startTrick', () => {
  it('sets toAct=leader, top=null, jiefengTo=null for an active leader', () => {
    const h = hands(3, 3, 3, 3);
    const t = startTrick(2, h, cfg);
    expect(t).toEqual<TrickState>({ leader: 2, toAct: 2, top: null, jiefengTo: null });
  });

  it('throws if the named leader has an empty hand (engine bug guard)', () => {
    const h = hands(3, 0, 3, 3);
    expect(() => startTrick(1, h, cfg)).toThrow();
  });
});

describe('applyPlay — rotation and trick end with 4 active players', () => {
  it('recording a play advances toAct to the next active seat and keeps the trick open', () => {
    const t = startTrick(0, hands(3, 3, 3, 3), cfg);
    const h = hands(2, 3, 3, 3); // seat 0 played one card, still active
    const res = applyPlay(t, play(0), h, cfg, []);
    expect(res.handEnded).toBe(false);
    expect(res.trick).toEqual<TrickState>({ leader: 0, toAct: 1, top: play(0), jiefengTo: null });
    expect(res.events.map((e) => e.type)).toEqual(['played']);
    expect(res.finishOrder).toEqual([]);
  });

  it('emits playerFinished with 1-based place when the play empties the hand', () => {
    const t = startTrick(0, hands(3, 3, 3, 3), cfg);
    const h = hands(0, 3, 3, 3); // seat 0 emptied — but others remain, no trick end yet
    const res = applyPlay(t, play(0), h, cfg, []);
    expect(res.events).toContainEqual({ type: 'playerFinished', seat: 0, place: 1 });
    expect(res.finishOrder).toEqual([0]);
    expect(res.handEnded).toBe(false);
  });
});

describe('trick end down to fewer active players (spec §9.22)', () => {
  it('3 active players: trick closes after both others pass', () => {
    // Seat 3 already finished in an earlier trick.
    const h = hands(3, 3, 3, 0);
    let t = startTrick(0, h, cfg);
    const playRes = applyPlay(t, play(0), h, cfg, [3]);
    t = playRes.trick!;
    expect(t.toAct).toBe(1);

    const pass1 = applyPass(t, 1, h, cfg);
    expect(pass1.trickWon).toBe(false);
    t = pass1.trick;
    expect(t.toAct).toBe(2);

    const pass2 = applyPass(t, 2, h, cfg);
    expect(pass2.trickWon).toBe(true);
    expect(pass2.events).toContainEqual({ type: 'trickWon', seat: 0 });
    // Winner (seat 0) still has cards — leads the next trick directly, no jiefeng.
    expect(pass2.trick).toEqual<TrickState>({ leader: 0, toAct: 0, top: null, jiefengTo: null });
  });

  it('2 active players: a single pass closes the trick', () => {
    // Seats 1 and 3 already finished in earlier tricks; seats 0 and 2 remain
    // (deliberately same team here — hand-end depends only on the recorded
    // finishOrder passed in, which we leave empty since nobody finishes on
    // this particular play).
    const h = hands(3, 0, 3, 0);
    const t = startTrick(0, h, cfg);
    const res = applyPlay(t, play(0), h, cfg, []);
    const trick = res.trick!;
    expect(trick.toAct).toBe(2);

    const pass = applyPass(trick, 2, h, cfg);
    expect(pass.trickWon).toBe(true);
    expect(pass.trick).toEqual<TrickState>({ leader: 0, toAct: 0, top: null, jiefengTo: null });
  });
});

describe('接风 (jiefeng) — spec §5.6 exact condition, both branches', () => {
  it('unbeaten final play: partner leads the next trick, jiefeng event emitted', () => {
    // Seat 0 plays its last card; seats 1,2,3 all pass without beating it.
    const h = hands(0, 3, 3, 3); // seat 0 now empty
    const t = startTrick(0, hands(1, 3, 3, 3), cfg);
    const playRes = applyPlay(t, play(0), h, cfg, []);
    expect(playRes.handEnded).toBe(false);
    expect(playRes.finishOrder).toEqual([0]);
    let trick = playRes.trick!;
    expect(trick.toAct).toBe(1); // trick still open — others may yet beat it

    const p1 = applyPass(trick, 1, h, cfg);
    expect(p1.trickWon).toBe(false);
    trick = p1.trick;
    const p2 = applyPass(trick, 2, h, cfg);
    expect(p2.trickWon).toBe(false);
    trick = p2.trick;
    const p3 = applyPass(trick, 3, h, cfg);
    expect(p3.trickWon).toBe(true);
    expect(p3.events).toContainEqual({ type: 'trickWon', seat: 0 });
    // partnerOf(0) === 2 (types.ts: (seat+2)%4)
    expect(p3.events).toContainEqual({ type: 'jiefeng', finisher: 0, leader: 2 });
    expect(p3.trick).toEqual<TrickState>({ leader: 2, toAct: 2, top: null, jiefengTo: null });
  });

  it('beaten final play: no jiefeng — the beater wins the trick and leads', () => {
    // Seat 0 plays its last card; seat 1 beats it instead of passing.
    const afterSeat0 = hands(0, 3, 3, 3);
    const t0 = startTrick(0, hands(1, 3, 3, 3), cfg);
    const r0 = applyPlay(t0, play(0), afterSeat0, cfg, []);
    expect(r0.finishOrder).toEqual([0]);
    const afterFirst = r0.trick!;
    expect(afterFirst.toAct).toBe(1);

    // Seat 1 beats seat 0's card (still has cards after, e.g. played one of three).
    const afterSeat1 = hands(0, 2, 3, 3);
    const r1 = applyPlay(afterFirst, play(1, '6'), afterSeat1, cfg, r0.finishOrder);
    expect(r1.handEnded).toBe(false);
    const afterBeat = r1.trick!;
    expect(afterBeat.top?.seat).toBe(1);
    expect(afterBeat.toAct).toBe(2);

    const p2 = applyPass(afterBeat, 2, afterSeat1, cfg);
    expect(p2.trickWon).toBe(false);
    const p3 = applyPass(p2.trick, 3, afterSeat1, cfg);
    expect(p3.trickWon).toBe(true);
    expect(p3.events).toContainEqual({ type: 'trickWon', seat: 1 });
    expect(p3.events.some((e) => e.type === 'jiefeng')).toBe(false);
    // Beater (seat 1) leads directly — not seat 0's partner.
    expect(p3.trick).toEqual<TrickState>({ leader: 1, toAct: 1, top: null, jiefengTo: null });
  });

  it('jiefengRecipient=nextPlayer: next active seat leads instead of partner', () => {
    const h = hands(0, 3, 3, 3);
    const t = startTrick(0, hands(1, 3, 3, 3), cfgNextPlayer);
    const r0 = applyPlay(t, play(0), h, cfgNextPlayer, []);
    let trick = r0.trick!;
    const p1 = applyPass(trick, 1, h, cfgNextPlayer);
    trick = p1.trick;
    const p2 = applyPass(trick, 2, h, cfgNextPlayer);
    trick = p2.trick;
    const p3 = applyPass(trick, 3, h, cfgNextPlayer);
    expect(p3.trickWon).toBe(true);
    // nextActiveSeat(0, h, cfg) === 1 (counterclockwise: seat+1)
    expect(p3.events).toContainEqual({ type: 'jiefeng', finisher: 0, leader: 1 });
    expect(p3.trick.leader).toBe(1);
  });

  it('asserts the §5.6/§9.4 invariant: throws if the jiefeng recipient is not active', () => {
    // Partner (seat 2) already finished in an earlier trick — this should
    // never happen per the spec proof (it would have ended the hand first),
    // so trick.ts treats it as an engine bug and throws rather than silently
    // handing the lead to a finished seat.
    const h = hands(0, 3, 0, 3); // seat 0 and seat 2 (partner) both empty
    const t = startTrick(0, hands(1, 3, 0, 3), cfg);
    const r0 = applyPlay(t, play(0), h, cfg, []); // finishOrder=[] pretends seat 2 finished "silently" for this test
    let trick = r0.trick!;
    const p1 = applyPass(trick, 1, h, cfg);
    trick = p1.trick;
    expect(() => applyPass(trick, 3, h, cfg)).toThrow();
  });
});

describe('hand end mid-trick (spec §5.8/§9.3) — both patterns', () => {
  it('双上: teammates finish 1st and 2nd — hand ends immediately, trick aborted', () => {
    // Seat 2 (partner of seat 0) finishes as the 2nd finisher; it's seat 2's
    // turn to act in an in-progress trick led by seat 1.
    const trick: TrickState = { leader: 1, toAct: 2, top: play(1), jiefengTo: null };
    const h = hands(3, 3, 0, 3); // seat 2 just emptied its hand with this play
    const res = applyPlay(trick, play(2, '9'), h, cfg, [0]); // seat 0 already finished 1st
    expect(res.handEnded).toBe(true);
    expect(res.trick).toBeNull();
    expect(res.finishOrder).toEqual([0, 2]);
    expect(res.events).toContainEqual({ type: 'playerFinished', seat: 2, place: 2 });
    // No trickWon/jiefeng bookkeeping — the trick was aborted, not resolved.
    expect(res.events.some((e) => e.type === 'trickWon')).toBe(false);
  });

  it('non-teammate 1st+2nd does NOT end the hand — trick continues normally', () => {
    const trick: TrickState = { leader: 0, toAct: 1, top: play(0), jiefengTo: null };
    const h = hands(3, 0, 3, 3); // seat 1 finishes 2nd, not seat 0's partner
    const res = applyPlay(trick, play(1, '9'), h, cfg, [0]);
    expect(res.handEnded).toBe(false);
    expect(res.finishOrder).toEqual([0, 1]);
  });

  it('3rd finisher ends the hand regardless of team pairing', () => {
    const trick: TrickState = { leader: 0, toAct: 2, top: play(0), jiefengTo: null };
    const h = hands(0, 0, 0, 3); // this play makes seat 2 the 3rd finisher
    const res = applyPlay(trick, play(2, '9'), h, cfg, [1, 3]);
    expect(res.handEnded).toBe(true);
    expect(res.trick).toBeNull();
    expect(res.finishOrder).toEqual([1, 3, 2]);
  });
});

describe('passed-then-play-later-in-same-trick legality (spec §5.3/§9.17)', () => {
  it('a player who passed may still play when the turn returns to them', () => {
    const h = hands(3, 3, 3, 3);
    const t = startTrick(0, h, cfg);
    const r0 = applyPlay(t, play(0), hands(2, 3, 3, 3), cfg, []);
    let trick = r0.trick!;
    expect(trick.toAct).toBe(1);
    const p1 = applyPass(trick, 1, hands(2, 3, 3, 3), cfg);
    expect(p1.trickWon).toBe(false);
    trick = p1.trick;
    expect(trick.toAct).toBe(2);

    // seat 2 beats seat 0's play instead of passing — top owner changes to 2.
    const r2 = applyPlay(trick, play(2, '7'), hands(2, 3, 2, 3), cfg, []);
    trick = r2.trick!;
    expect(trick.top?.seat).toBe(2);
    expect(trick.toAct).toBe(3);

    // Seat 3 passes to the new top (owned by seat 2) — not yet closed,
    // since seat 1 (who passed earlier, to the OLD top) still hasn't had a
    // chance to respond to seat 2's play.
    const p3 = applyPass(trick, 3, hands(2, 3, 2, 3), cfg);
    expect(p3.trickWon).toBe(false);
    trick = p3.trick;
    expect(trick.toAct).toBe(0);

    const p0 = applyPass(trick, 0, hands(2, 3, 2, 3), cfg);
    expect(p0.trickWon).toBe(false);
    trick = p0.trick;
    expect(trick.toAct).toBe(1);

    // Turn returns to seat 1, who passed earlier in this very trick — spec
    // §5.3/§9.17 says they may still play now that it's come back around,
    // including beating a play (seat 2's) that isn't their partner's.
    const replay = applyPlay(trick, play(1, '8'), hands(2, 2, 2, 3), cfg, []);
    expect(replay.handEnded).toBe(false);
    expect(replay.trick?.top).toEqual(play(1, '8'));
    expect(replay.trick?.toAct).toBe(2);

    // Everyone now passes around to the new top owner (seat 1) to confirm
    // the trick still closes correctly after this mid-trick replay.
    let closing = replay.trick!;
    const q2 = applyPass(closing, 2, hands(2, 2, 2, 3), cfg);
    expect(q2.trickWon).toBe(false);
    closing = q2.trick;
    const q3 = applyPass(closing, 3, hands(2, 2, 2, 3), cfg);
    expect(q3.trickWon).toBe(false);
    closing = q3.trick;
    const q0 = applyPass(closing, 0, hands(2, 2, 2, 3), cfg);
    expect(q0.trickWon).toBe(true);
    expect(q0.events).toContainEqual({ type: 'trickWon', seat: 1 });
  });
});

describe('applyPass validation (assert-only; index.ts owns real validation)', () => {
  it('throws when passing while holding the lead (top === null)', () => {
    const h = hands(3, 3, 3, 3);
    const t = startTrick(0, h, cfg);
    expect(() => applyPass(t, 0, h, cfg)).toThrow();
  });

  it('throws when the passing seat is not trick.toAct', () => {
    const h = hands(2, 3, 3, 3);
    const t = startTrick(0, hands(3, 3, 3, 3), cfg);
    const r = applyPlay(t, play(0), h, cfg, []);
    const trick = r.trick!;
    expect(() => applyPass(trick, 2, h, cfg)).toThrow();
  });
});

describe('applyPlay validation (assert-only)', () => {
  it('throws when play.seat is not trick.toAct', () => {
    const h = hands(3, 3, 3, 3);
    const t = startTrick(0, h, cfg);
    expect(() => applyPlay(t, play(2), h, cfg, [])).toThrow();
  });
});
