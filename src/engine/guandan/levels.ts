// Hand scoring, level upgrades, A-win / A-attempt accounting, and the
// owner's house rule aFailConsequence='suspendPlayOpponentLevel'
// (spec docs/rules/guandan.md §6 and the §1.5 level-selection refinement).
//
// Everything here is a pure function over plain data: inputs are never
// mutated, outputs are fresh values. No PRNG, no IO, no prose errors —
// this module's inputs come from the engine's own state machine, so bad
// inputs are engine bugs, not player-facing rule errors.

import type { Seat } from '../core/game';
import type { Rank } from './cards';
import { RANKS } from './cards';
import type { RuleVariant } from './config';
import { STARTING_LEVEL, demoteTarget } from './config';
import type { HandResult } from './types';
import { partnerOf, teamOf } from './types';

// ---------------------------------------------------------------------------
// Scoring (spec §6.1)
// ---------------------------------------------------------------------------

/** Score a finished hand from its finishing order (first element = 头游).
 *  The order may be TRUNCATED (spec §5.8): a hand ends the moment the
 *  result is determined — after the 2nd finisher on a 双上, otherwise after
 *  the 3rd — so a seat absent from finishOrder simply never got out and
 *  occupies the next place(s). In particular the 头游's partner missing
 *  from the list means the partner finished 4th. */
export function scoreHand(finishOrder: readonly Seat[]): HandResult {
  const first = finishOrder[0]!;
  const winnerTeam = teamOf(first);
  const partnerIdx = finishOrder.indexOf(partnerOf(first));
  const partnerPlace = partnerIdx >= 0 ? partnerIdx + 1 : 4;
  // spec §6.1: partner 2nd (双上) → +3; partner 3rd → +2; partner 4th → +1.
  const levelDelta = partnerPlace === 2 ? 3 : partnerPlace === 3 ? 2 : 1;
  return { finishOrder: [...finishOrder], winnerTeam, levelDelta };
}

// ---------------------------------------------------------------------------
// Level arithmetic (spec §6.3)
// ---------------------------------------------------------------------------

/** Position of a rank on the 2..A level ladder (0 = '2', 12 = 'A'). */
export function levelIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export interface LevelUpgrade {
  level: Rank;
  /** True when the raw upgrade would land PAST A. Landing exactly on A is
   *  not an overshoot (K+1 → A, overshot=false; K+3 → overshot=true). */
  overshot: boolean;
}

/** Apply a level upgrade with the A clamp (spec §6.3): upgrades that would
 *  overshoot A stop AT A. Whether an overshoot instead wins the match
 *  outright is the caller's decision via config.overshootWinsGame — this
 *  helper only reports the fact. */
export function addLevels(level: Rank, delta: number): LevelUpgrade {
  const aIndex = RANKS.length - 1; // 'A'
  const target = levelIndex(level) + delta;
  return { level: RANKS[Math.min(target, aIndex)]!, overshot: target > aIndex };
}

// ---------------------------------------------------------------------------
// Hand-end bookkeeping (spec §6.3–§6.4, §1.5 refinement)
// ---------------------------------------------------------------------------

export interface ApplyHandResultInput {
  config: RuleVariant;
  /** Team levels at hand START (before this result is applied). */
  levels: [Rank, Rank];
  /** Failed A-attempt counters at hand start. */
  aAttempts: [number, number];
  /** Suspension flags at hand start (owner rule, spec §6.4). */
  aAttemptsExhausted: [boolean, boolean];
  /** The level this hand was actually played at (may be the opponents'
   *  level under suspension — spec §1.5 refinement). */
  currentLevel: Rank;
  /** Team whose member was 头游 of the previous hand; null for hand 1. */
  declarerTeam: 0 | 1 | null;
  result: HandResult;
  /** True iff the hand-winning team's opponent-facing final play consisted
   *  entirely of Aces — only consulted under aceFinishDemotes (spec §6.4). */
  finalPlayAllAces: boolean;
}

export interface ApplyHandResultOutput {
  levels: [Rank, Rank];
  aAttempts: [number, number];
  aAttemptsExhausted: [boolean, boolean];
  matchWinner: 0 | 1 | null;
}

/** Apply a hand result to the match-level ladder state, in spec order:
 *  (1) A-win check → (2) level upgrades → (3) attempt accounting →
 *  (4) exhaustion consequence → (5) suspension clear → (6) aceFinishDemotes.
 *
 *  levelTrack='shared' reading (spec §6.2, casual variant): one ladder both
 *  teams sit on, moved by the winner — implemented by writing the winner's
 *  upgraded level to BOTH team entries, preserving levels[0] === levels[1].
 *  All downstream logic (A checks, selectCurrentLevel) reads per-team
 *  entries and needs no special casing. The shared ladder governs UPGRADES
 *  only; demotion/suspension under the (unspecified, casual-on-casual)
 *  combination with 'demote'/'suspend' remains per-team. */
export function applyHandResult(input: ApplyHandResultInput): ApplyHandResultOutput {
  const { config, declarerTeam, currentLevel, result, finalPlayAllAces } = input;
  const { winnerTeam, levelDelta } = result;
  // Levels/flags at hand start — the hand's rules facts are judged against
  // these; the mutable copies below accumulate the outcome.
  const startLevels = input.levels;
  const wasSuspended = input.aAttemptsExhausted;
  const levels: [Rank, Rank] = [...input.levels];
  const aAttempts: [number, number] = [...input.aAttempts];
  const aAttemptsExhausted: [boolean, boolean] = [...input.aAttemptsExhausted];
  const loserTeam = (1 - winnerTeam) as 0 | 1;

  // (1) A-win check (spec §6.4). The match is won only when the hand was a
  // genuine A attempt: the winner was the declarer AND their level is A AND
  // they were not suspended (a suspended team's declared hand is played at
  // the OPPONENTS' level — spec §1.5 refinement — so even in the both-at-A
  // corner where currentLevel is 'A', it is the opponents' A, not an
  // attempt; winning it clears the suspension in step 5 instead).
  const playedAtOwnA =
    declarerTeam === winnerTeam &&
    startLevels[winnerTeam] === 'A' &&
    currentLevel === 'A' &&
    !wasSuspended[winnerTeam];
  // spec §6.4: default win condition is 1-2 or 1-3 (partner not last, i.e.
  // levelDelta >= 2); the casual aWinPartnerNotLast=false variant accepts
  // any 头游 at A, including 1-4.
  if (playedAtOwnA && (!config.aWinPartnerNotLast || levelDelta >= 2)) {
    return { levels, aAttempts, aAttemptsExhausted, matchWinner: winnerTeam };
  }

  // (2) Level upgrades with the A clamp (spec §6.1/§6.3). A team already at
  // A gains no further levels — being AT A is never an overshoot; they must
  // pass A via the win condition above (spec §6.3/§6.4).
  if (startLevels[winnerTeam] !== 'A') {
    const up = addLevels(startLevels[winnerTeam], levelDelta);
    if (up.overshot && config.overshootWinsGame) {
      // spec §6.3 variant: an upgrade that would pass A wins outright.
      levels[winnerTeam] = up.level; // clamped 'A' — cosmetic, match is over
      return { levels, aAttempts, aAttemptsExhausted, matchWinner: winnerTeam };
    }
    levels[winnerTeam] = up.level;
    if (config.levelTrack === 'shared') {
      // Shared ladder: the winner's move drags both entries (reading above).
      levels[loserTeam] = up.level;
    }
  }

  // (3) Attempt accounting + (4) exhaustion consequence (spec §6.4). An
  // attempt is consumed by a team that was at level A, was NOT suspended
  // (suspension means the attempt machinery is parked), and failed: this
  // includes the declarer winning the hand 1-4 (no match win, no level —
  // step 1 already returned on genuine wins) and outright losses. With
  // aAttemptOnlyAsDeclarer=false, a team at A also consumes an attempt in
  // hands the opponents declared and it LOST; winning a hand as
  // non-declarer never consumes — nothing was attempted, and that win is
  // precisely what earns the declarer seat for a real attempt next hand
  // (documented reading of the spec §6.4 default-clause inversion).
  for (const team of [0, 1] as const) {
    if (startLevels[team] !== 'A') continue;
    if (wasSuspended[team]) continue; // spec §6.4: suspended ⇒ not attempting
    if (config.aAttemptOnlyAsDeclarer && declarerTeam !== team) continue;
    if (winnerTeam === team && declarerTeam !== team) continue; // non-declarer hand win
    aAttempts[team] += 1;

    // (4) On reaching aMaxAttempts (null = never), apply the consequence.
    // The check is >= so that under aAttemptCounterReset='cumulative' a
    // cleared suspension re-triggers immediately on the NEXT failed attempt
    // (the counter was left at the max — documented reading, spec §6.4).
    if (config.aMaxAttempts !== null && aAttempts[team] >= config.aMaxAttempts) {
      switch (config.aFailConsequence) {
        case 'suspendPlayOpponentLevel':
          // Owner house rule: NEVER demote — levels untouched, only the
          // flag is set; level selection does the rest (spec §1.5/§6.4).
          aAttemptsExhausted[team] = true;
          break;
        case 'demote':
          // Classic variant: demote per aFailDemoteTo and restart the
          // counter for the (eventual) next stint at A (spec §6.4).
          levels[team] = demoteTarget(config, levels[team]);
          aAttempts[team] = 0;
          break;
        case 'none':
          // Counted but consequence-free; the counter just keeps growing.
          break;
      }
    }
  }

  // (5) Suspension clear (spec §6.4): the flag clears at the end of the
  // first hand the exhausted team WINS after the exhausting hand. A team
  // that becomes exhausted THIS hand (even via a 1-4 hand-win) does not
  // clear it here — wasSuspended is the hand-START flag, which is exactly
  // the owner rule's distinctive declared-hand override after a 1-4-style
  // exhaustion. Counter reset per aAttemptCounterReset: 'fresh' restarts
  // at 0; 'cumulative' leaves the count (≥ aMaxAttempts), so exhaustion
  // re-triggers on the very next failed attempt (documented reading).
  if (wasSuspended[winnerTeam]) {
    aAttemptsExhausted[winnerTeam] = false;
    if (config.aAttemptCounterReset === 'fresh') aAttempts[winnerTeam] = 0;
  }

  // (6) aceFinishDemotes (spec §6.4, obscure pagat variant, default off):
  // declarers at A lose the hand to a final play made entirely of Aces →
  // immediate demotion to '2'. Only applies when the hand was genuinely
  // played at the declarer's A (a suspended declarer's hand was played at
  // the opponents' level, and the owner suspension rule never demotes).
  // The attempt counter and any just-set exhaustion flag are reset with the
  // demotion — both are meaningless below A, and stale values would poison
  // a future return to A (engine reading; the variant's source is silent).
  if (
    config.aceFinishDemotes &&
    declarerTeam !== null &&
    declarerTeam !== winnerTeam &&
    startLevels[declarerTeam] === 'A' &&
    !wasSuspended[declarerTeam] &&
    finalPlayAllAces
  ) {
    levels[declarerTeam] = '2';
    aAttempts[declarerTeam] = 0;
    aAttemptsExhausted[declarerTeam] = false;
  }

  return { levels, aAttempts, aAttemptsExhausted, matchWinner: null };
}

// ---------------------------------------------------------------------------
// Current-level selection (spec §1.5 + refinement)
// ---------------------------------------------------------------------------

export interface SelectCurrentLevelInput {
  config: RuleVariant;
  levels: [Rank, Rank];
  /** Previous hand's 头游 team; null for the first hand of the match. */
  declarerTeam: 0 | 1 | null;
  aAttemptsExhausted: [boolean, boolean];
}

/** Which level (and therefore which wild) the upcoming hand is played at.
 *
 *  Plain spec §1.5: the declarer team's level; STARTING_LEVEL ('2') for the
 *  first hand (declarerTeam === null). Refinement (owner rule, §1.5/§6.4):
 *  a suspended declarer's hand is played at the OPPONENTS' current level,
 *  reported via suspensionApplied so the handStarted event can surface it.
 *  Both-at-A corner: returns 'A' with suspensionApplied=true — harmless,
 *  since applyHandResult independently refuses the A-win for a suspended
 *  winner. levelTrack='shared' needs no special case: both entries are kept
 *  equal by applyHandResult, so declarer's and opponents' reads coincide. */
export function selectCurrentLevel(input: SelectCurrentLevelInput): {
  level: Rank;
  suspensionApplied: boolean;
} {
  const { config, levels, declarerTeam, aAttemptsExhausted } = input;
  if (declarerTeam === null) {
    // spec §1.5: the first hand is played at 2.
    return { level: STARTING_LEVEL, suspensionApplied: false };
  }
  // The flag is only ever set under 'suspendPlayOpponentLevel', but guard on
  // the config too: under other consequences plain §1.5 always applies.
  if (config.aFailConsequence === 'suspendPlayOpponentLevel' && aAttemptsExhausted[declarerTeam]) {
    return { level: levels[(1 - declarerTeam) as 0 | 1], suspensionApplied: true };
  }
  return { level: levels[declarerTeam], suspensionApplied: false };
}
