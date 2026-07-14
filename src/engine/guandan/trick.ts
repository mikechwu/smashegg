// Trick / turn mechanics (spec docs/rules/guandan.md §5). This module owns
// whose turn it is and what a resolved play/pass does to the trick; it does
// NOT compare combinations — index.ts calls beats() (combos.ts) to decide
// whether a candidate play is legal *before* handing it to applyPlay here.
//
// Design note on `hands`: by the time applyPlay/applyPass are called, the
// caller (index.ts) has already removed the played cards from hands[seat]
// (card bookkeeping + combo validation are index.ts's job, per the module
// ownership map in types.ts). trick.ts only reads hands to know who is
// still active (non-empty) and whether the current actor just emptied
// their hand.
//
// Design note on finishOrder: index.ts is the authoritative owner of
// finishOrder (per the task brief), but the §5.8 hand-end check and the
// §9.1 1-based `playerFinished.place` both need the order *as of this
// play*, so applyPlay takes the running finishOrder as a parameter and
// returns the appended array — cleaner than making index.ts re-derive
// "was this a 双上/3rd-finisher moment" from scratch after the fact.

import type { Seat } from '../core/game';
import type { Card } from './cards';
import type { RuleVariant } from './config';
import type { GuandanEvent, Play, TrickState } from './types';
import { nextSeat, partnerOf, teamOf } from './types';

type Hands = [Card[], Card[], Card[], Card[]];

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

/** Next seat in turn direction with empty (finished) hands skipped — spec
 *  §5.4: a skip is not a pass. If `from` is the only active seat, returns
 *  `from` itself (degenerate down-to-one-active case, spec §9.22). Throws
 *  if no active seat exists at all — that would mean every hand is empty,
 *  which can only happen if index.ts called us after the hand should
 *  already have ended (engine bug, never a player-facing error). */
export function nextActiveSeat(from: Seat, hands: Hands, config: RuleVariant): Seat {
  let seat = nextSeat(from, config);
  for (let i = 0; i < 4; i++) {
    if (hands[seat]!.length > 0) return seat;
    seat = nextSeat(seat, config);
  }
  throw new Error('trick.nextActiveSeat: no active seat found — engine bug (spec §5.4)');
}

/** Walk the rotation from `from` looking for either (a) the next seat that
 *  can actually act (non-empty hand), or (b) `topSeat` itself — even if
 *  `topSeat`'s hand is now empty.
 *
 *  Why `topSeat` is special: spec §5.5/§9.22 defines trick end as "the turn
 *  would return to the top-play owner". Normally that owner is still active
 *  and the plain skip-empties rotation naturally lands back on them once
 *  everyone else has passed. But when the owner emptied their hand with the
 *  very play that put them on top (the 接风 precondition, §5.6), they are
 *  no longer in the "real" active rotation at all — yet the trick still
 *  must close once every other active player has had a chance to beat that
 *  final play. Treating `topSeat` as a rotation stop (distinct from "can
 *  act") is what makes a single walk correct in both cases, without a
 *  separate hidden "guard seat" field on TrickState. */
function stepToward(
  from: Seat,
  topSeat: Seat,
  hands: Hands,
  config: RuleVariant,
): { seat: Seat; trickEnds: boolean } {
  let seat = nextSeat(from, config);
  for (let i = 0; i < 4; i++) {
    if (seat === topSeat) return { seat, trickEnds: true };
    if (hands[seat]!.length > 0) return { seat, trickEnds: false };
    seat = nextSeat(seat, config);
  }
  throw new Error('trick.stepToward: rotation did not resolve within 4 steps — engine bug');
}

// ---------------------------------------------------------------------------
// Trick lifecycle
// ---------------------------------------------------------------------------

/** Start a trick with `leader` to act; the leader must be active — index.ts
 *  is responsible for only ever naming an active seat as leader (post-
 *  jiefeng recipients, tribute-resolved leaders, etc. are all checked at
 *  their own call sites); this assertion catches an engine bug, not a rule
 *  violation. */
export function startTrick(leader: Seat, hands: Hands, config: RuleVariant): TrickState {
  if (hands[leader]!.length === 0) {
    throw new Error(`trick.startTrick: leader seat ${leader} has an empty hand — engine bug`);
  }
  void config; // reserved: turn direction doesn't affect trick construction itself
  return { leader, toAct: leader, top: null, jiefengTo: null };
}

/** Hand end (spec §5.8/§9.3): immediately when the 1st and 2nd finishers
 *  are teammates (双上), otherwise immediately when the 3rd player
 *  finishes. Only ever tested right after a new finisher is appended, so
 *  finishOrder.length is 1, 2, or 3 at the call site. */
function handEndsAt(finishOrder: readonly Seat[]): boolean {
  if (finishOrder.length === 2) return teamOf(finishOrder[0]!) === teamOf(finishOrder[1]!);
  return finishOrder.length >= 3;
}

/** Resolve who leads the next trick once a trick winner is known, handling
 *  接风 (spec §5.6): if the winner emptied their hand WITH the winning
 *  play, lead passes to their partner (or next active seat, per
 *  `jiefengRecipient`) instead of the winner themselves. Pushes any
 *  'jiefeng' event onto the shared `events` array (mutation kept local to
 *  this module — callers only ever see the final array). */
function resolveWinnerAndLead(
  winner: Seat,
  hands: Hands,
  config: RuleVariant,
  events: GuandanEvent[],
): TrickState {
  if (hands[winner]!.length === 0) {
    // spec §5.6 exact condition: winner's *final* play stood unbeaten.
    const recipient =
      config.jiefengRecipient === 'partner' ? partnerOf(winner) : nextActiveSeat(winner, hands, config);
    // spec §5.6/§9.4 invariant: the recipient is always still active when
    // 接风 fires — if the partner (or next player) had already finished,
    // this finish would itself have been the 2nd or 3rd finisher and the
    // hand would already have ended above, before any lead was needed.
    // A violation here is an engine bug, not a rule outcome.
    if (hands[recipient]!.length === 0) {
      throw new Error(
        `trick.jiefeng: recipient seat ${recipient} is not active — invariant violated (spec §5.6/§9.4)`,
      );
    }
    events.push({ type: 'jiefeng', finisher: winner, leader: recipient });
    return startTrick(recipient, hands, config);
  }
  // Winner's final play (if it was their last) was beaten before the trick
  // closed on someone else's top play, OR the winner simply isn't out yet
  // (the common case) — either way, no jiefeng: the winner leads directly.
  return startTrick(winner, hands, config);
}

/** Apply a resolved PLAY: record it as the new trick top, handle finishing
 *  and hand-end, then either continue the trick (advance toAct) or close it
 *  (trickWon / jiefeng) and return the next trick's TrickState.
 *
 *  Returns `trick: null` with `handEnded: true` when the hand ends mid-
 *  trick (spec §5.8) — there is no "next trick" to hand back in that case;
 *  index.ts is expected to run scoring/level-selection and start hand N+1
 *  from scratch. `finishOrder` is always returned (see file-header note). */
export function applyPlay(
  trick: TrickState,
  play: Play,
  hands: Hands,
  config: RuleVariant,
  finishOrder: readonly Seat[],
): { trick: TrickState | null; events: GuandanEvent[]; handEnded: boolean; finishOrder: Seat[] } {
  if (play.seat !== trick.toAct) {
    throw new Error(`trick.applyPlay: play.seat ${play.seat} !== trick.toAct ${trick.toAct} — caller bug`);
  }

  const events: GuandanEvent[] = [{ type: 'played', seat: play.seat, cards: play.cards, decl: play.decl }];

  // hands[play.seat] already reflects the play's cards being removed (see
  // file header) — an empty hand here means this WAS the player's last play.
  const justFinished = hands[play.seat]!.length === 0;
  let nextFinishOrder = finishOrder as Seat[];
  if (justFinished) {
    nextFinishOrder = [...finishOrder, play.seat];
    events.push({ type: 'playerFinished', seat: play.seat, place: nextFinishOrder.length });
  }

  // spec §5.8/§9.3: abort mid-trick on 双上 or the 3rd finisher — no trick
  // end / jiefeng bookkeeping happens; the trick itself is moot.
  if (handEndsAt(nextFinishOrder)) {
    return { trick: null, events, handEnded: true, finishOrder: nextFinishOrder };
  }

  const newTop: Play = play;
  // Walk from the new top owner looking for the next responder — or a full
  // lap back to the owner themself, meaning nobody else can respond at all
  // (spec §9.22's degenerate down-to-one-active case).
  const step = stepToward(play.seat, play.seat, hands, config);
  if (!step.trickEnds) {
    const continued: TrickState = { leader: trick.leader, toAct: step.seat, top: newTop, jiefengTo: null };
    return { trick: continued, events, handEnded: false, finishOrder: nextFinishOrder };
  }

  events.push({ type: 'trickWon', seat: play.seat });
  const nextTrick = resolveWinnerAndLead(play.seat, hands, config, events);
  return { trick: nextTrick, events, handEnded: false, finishOrder: nextFinishOrder };
}

/** Apply a resolved PASS: advance rotation, closing the trick (trickWon)
 *  when the turn would return to the top-play owner (spec §5.5/§9.22).
 *  Passing never finishes a player or ends a hand, so there is no
 *  `handEnded`/`finishOrder` bookkeeping here — unlike applyPlay, the
 *  returned `trick` is never null. */
export function applyPass(
  trick: TrickState,
  seat: Seat,
  hands: Hands,
  config: RuleVariant,
): { trick: TrickState; events: GuandanEvent[]; trickWon: boolean } {
  // spec §5.2/§9.2: passing while holding the lead (no top play yet) is
  // illegal. index.ts validates this before calling; assert it here too.
  if (trick.top === null) {
    throw new Error('trick.applyPass: cannot pass while leading — caller bug (spec §5.2/§9.2)');
  }
  if (seat !== trick.toAct) {
    throw new Error(`trick.applyPass: seat ${seat} !== trick.toAct ${trick.toAct} — caller bug`);
  }

  const events: GuandanEvent[] = [{ type: 'passed', seat }];
  const step = stepToward(seat, trick.top.seat, hands, config);
  if (!step.trickEnds) {
    return { trick: { ...trick, toAct: step.seat }, events, trickWon: false };
  }

  const winner = trick.top.seat;
  events.push({ type: 'trickWon', seat: winner });
  const nextTrick = resolveWinnerAndLead(winner, hands, config, events);
  return { trick: nextTrick, events, trickWon: true };
}
