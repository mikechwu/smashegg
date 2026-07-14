// Combination classification, wild-card validation (Problem V, spec §4.4.2),
// and the beats relation (spec §3). This is the hardest correctness surface
// in the engine: everything is TEMPLATE MATCHING over declared canonical
// forms — we never enumerate the 52 identities a wild could take (spec §4.4
// "recommended approach"). For every declared form we build the REQUIRED
// multiset (ranks only for suit-blind types; (rank,suit) identities for
// straight flushes), strip the wilds, and test multiset inclusion; the wild
// count then matches by arithmetic (see checkRankMultiset).
//
// FROZEN-TYPES NOTE (flagged for the owner): CanonicalForm.keyRank is a Rank
// ('2'..'A'), which cannot express two things the beats relation needs:
//   (a) joker-keyed singles/pairs — a single SJ compares above the level
//       card and below BJ (spec §2.1), but 'SJ' is not a Rank;
//   (b) under wildStraightFlushIsBomb=false (spec §3.7 variant), a
//       wild-substituted straight flush loses bomb status, so beats() must
//       distinguish it from a natural straight flush of the same window.
// Both are carried in ComboFormExtras — optional fields on a type that is
// structurally compatible with CanonicalForm (still plain JSON data).
// classifyPlays emits them and validatePlay ENFORCES them (a mismatched
// decl is rejected), so any decl that passed validation is trustworthy
// when it later reaches beats().

import type { RuleError } from '../core/game';
import type { Card, Rank, Suit } from './cards';
import { RANKS, SUITS, isJoker, isWild, naturalValue, rankLevelValue, rankOf, suitOf } from './cards';
import type { RuleVariant } from './config';
import type { CanonicalForm, ComboType } from './types';

// ---------------------------------------------------------------------------
// Canonical-form extension (see FROZEN-TYPES NOTE above).
// ---------------------------------------------------------------------------

export type JokerRank = 'SJ' | 'BJ';

export interface ComboFormExtras {
  /** Joker-keyed single/pair (SJ+SJ or BJ+BJ only, spec §2.2). By
   *  convention such forms carry keyRank 'A' (mirroring jokerBomb's
   *  never-compared 'A'); the real comparison key is this field
   *  (SJ = 16, BJ = 17 on the levelValue scale). */
  jokerRank?: JokerRank;
  /** Only under wildStraightFlushIsBomb=false (spec §3.7 variant): a
   *  straight flush completed by a SUBSTITUTING wild is demoted — still a
   *  straightFlush-typed play, but not a bomb; it beats exactly like a
   *  plain straight of its window (the spec's "simplest" reading). A wild
   *  sitting in its own natural slot (hearts SF through the level rank,
   *  spec §9.11) does not demote — that card is played as itself (§4.1). */
  demoted?: boolean;
}

export type ComboForm = CanonicalForm & ComboFormExtras;

export type ValidateResult = { ok: true } | { ok: false; error: RuleError };

const OK: ValidateResult = { ok: true };

function fail(code: string, params?: Record<string, unknown>): { ok: false; error: RuleError } {
  return { ok: false, error: params === undefined ? { code } : { code, params } };
}

// ---------------------------------------------------------------------------
// Shape tables & sequence windows.
// ---------------------------------------------------------------------------

/** Card counts fixed by type (spec §3 table). Bombs are the only variable-
 *  size type (4..10, spec §3.3). */
const FIXED_SIZES: Readonly<Partial<Record<ComboType, number>>> = {
  single: 1,
  pair: 2,
  triple: 3,
  fullHouse: 5,
  straight: 5,
  tube: 6,
  plate: 6,
  straightFlush: 5,
  jokerBomb: 4,
};

/** Sequence-position value → rank; value 1 is the A-low position (spec
 *  §2.5). Only ever called with 1..14. */
function rankAtValue(value: number): Rank {
  return value === 1 ? 'A' : RANKS[value - 2]!;
}

/** The ranks of a sequence window identified by its TOP rank, lowest first.
 *  Returns null when the window would run below the A-low position — that
 *  is the no-wrap rule (spec §2.5): windows live entirely inside 1..14.
 *  The top rank fully identifies the window per type (straights top out at
 *  value 5..14, tubes 3..14, plates 2..14 — each value is a distinct
 *  window), which is why CanonicalForm only needs keyRank. */
export function sequenceWindow(top: Rank, length: number): Rank[] | null {
  const topValue = naturalValue(top);
  const low = topValue - length + 1;
  if (low < 1) return null;
  const ranks: Rank[] = [];
  for (let v = low; v <= topValue; v++) ranks.push(rankAtValue(v));
  return ranks;
}

// ---------------------------------------------------------------------------
// Card splitting & the core multiset-inclusion test (Problem V engine).
// ---------------------------------------------------------------------------

interface SplitCards {
  /** Non-wild, non-joker cards. */
  naturals: Card[];
  wilds: number;
  sj: number;
  bj: number;
}

function splitCards(cards: readonly Card[], level: Rank): SplitCards {
  const split: SplitCards = { naturals: [], wilds: 0, sj: 0, bj: 0 };
  for (const card of cards) {
    if (card === 'SJ') split.sj++;
    else if (card === 'BJ') split.bj++;
    else if (isWild(card, level)) split.wilds++;
    else split.naturals.push(card);
  }
  return split;
}

/** Multiset inclusion for suit-blind types (spec §4.4.2): every natural
 *  card must consume a slot of its rank in the required multiset. The
 *  leftover-slots-equal-wilds check is implicit: callers guarantee
 *  |required| == cards.length and jokers were already rejected, so
 *  |required| - |naturals| == wilds by arithmetic. No missing identity can
 *  be a joker because required is built from Ranks only (spec §4.4.2). */
function checkRankMultiset(naturals: readonly Card[], required: readonly Rank[]): ValidateResult {
  const need = new Map<Rank, number>();
  for (const rank of required) need.set(rank, (need.get(rank) ?? 0) + 1);
  for (const card of naturals) {
    const rank = rankOf(card)!; // naturals are never jokers
    const left = need.get(rank) ?? 0;
    if (left === 0) return fail('play.cardsMismatch', { card });
    need.set(rank, left - 1);
  }
  return OK;
}

// ---------------------------------------------------------------------------
// validatePlay — Problem V (spec §4.4.2).
// ---------------------------------------------------------------------------

export function validatePlay(
  cards: Card[],
  decl: CanonicalForm,
  level: Rank,
  config: RuleVariant,
): { ok: true } | { ok: false; error: RuleError } {
  const d = decl as ComboForm;

  // ---- decl shape: size/type consistency (spec §3 table; bombs §3.3) ----
  const fixedSize = FIXED_SIZES[d.type];
  if (fixedSize !== undefined ? d.size !== fixedSize : d.size < 4 || d.size > 10) {
    return fail('play.declSizeInvalid', { type: d.type, size: d.size });
  }
  if (cards.length !== d.size) {
    return fail('play.cardCountMismatch', { expected: d.size, got: cards.length });
  }
  // suit is present exactly for straight flushes (spec §4.4.3).
  if (d.type === 'straightFlush') {
    if (d.suit === undefined) return fail('play.declSuitRequired');
  } else if (d.suit !== undefined) {
    return fail('play.declSuitUnexpected', { type: d.type });
  }
  if (d.jokerRank !== undefined) {
    if (d.type !== 'single' && d.type !== 'pair') {
      return fail('play.declJokerRankInvalid', { type: d.type });
    }
    // Convention: joker forms carry keyRank 'A' (never compared) — one
    // canonical spelling so form identity is well-defined.
    if (d.keyRank !== 'A') return fail('play.declKeyRankInvalid', { keyRank: d.keyRank });
  }
  if (d.demoted === true && d.type !== 'straightFlush') {
    return fail('play.declDemotedUnexpected', { type: d.type });
  }
  if (d.type === 'jokerBomb' && d.keyRank !== 'A') {
    // keyRank 'A' by convention (types.ts comment) — enforce determinism.
    return fail('play.declKeyRankInvalid', { keyRank: d.keyRank });
  }

  const split = splitCards(cards, level);
  // Only two wilds exist per hand (spec §4.1) — anything more is corrupt
  // input from the caller, worth its own diagnosable code.
  if (split.wilds > 2) return fail('play.tooManyWilds', { wilds: split.wilds });
  const jokers = split.sj + split.bj;

  switch (d.type) {
    case 'single':
      return validateSingle(cards[0]!, d, level, config);
    case 'pair':
      return validatePair(split, d, level, config);
    case 'triple':
      // All-wild triples are impossible (only 2 wilds), so no §4.2 gate.
      if (jokers > 0) return fail('play.jokerNotAllowed', { type: d.type }); // spec §2.2
      return checkRankMultiset(split.naturals, [d.keyRank, d.keyRank, d.keyRank]);
    case 'fullHouse':
      return validateFullHouse(split, d, config);
    case 'straight':
      return validateStraight(split, d, config);
    case 'tube':
      return validateTubeOrPlate(split, d, 3, 2); // 3 consecutive pairs
    case 'plate':
      return validateTubeOrPlate(split, d, 2, 3); // 2 consecutive triples
    case 'bomb': {
      // n cards of one rank, jokers excluded (spec §3 row 8, §2.2). The
      // 10-card cap and the level-rank-caps-at-8 rule (§9.14) need no
      // special code: only 8 naturals of a rank exist, and for the level
      // rank two of them ARE the wilds — counts enforce everything.
      if (jokers > 0) return fail('play.jokerNotAllowed', { type: d.type });
      const required: Rank[] = [];
      for (let i = 0; i < d.size; i++) required.push(d.keyRank);
      return checkRankMultiset(split.naturals, required);
    }
    case 'straightFlush':
      return validateStraightFlush(split, d, level, config);
    case 'jokerBomb':
      // Exactly SJ,SJ,BJ,BJ — wilds never contribute (spec §3 row 10, §4.1).
      if (split.sj === 2 && split.bj === 2) return OK;
      return fail('play.invalidJokerBomb', { sj: split.sj, bj: split.bj, wilds: split.wilds });
  }
}

function validateSingle(card: Card, d: ComboForm, level: Rank, config: RuleVariant): ValidateResult {
  if (isJoker(card)) {
    // Joker singles must be declared with the matching jokerRank key.
    if (d.jokerRank !== card) return fail('play.cardsMismatch', { card });
    return OK;
  }
  if (d.jokerRank !== undefined) {
    // A wild can never be (or represent) a joker (spec §4.1).
    return isWild(card, level) ? fail('play.wildCannotBeJoker') : fail('play.cardsMismatch', { card });
  }
  if (isWild(card, level)) {
    // §4.2: a standalone wild IS a level card; under-declaring it as a
    // lower rank is disallowed unless the (no-known-platform) config is on.
    if (d.keyRank !== level && !config.allowWildUnderDeclare) {
      return fail('play.wildUnderDeclare', { required: level, declared: d.keyRank });
    }
    return OK;
  }
  return rankOf(card) === d.keyRank ? OK : fail('play.cardsMismatch', { card });
}

function validatePair(split: SplitCards, d: ComboForm, level: Rank, config: RuleVariant): ValidateResult {
  const jokers = split.sj + split.bj;
  if (jokers > 0) {
    if (split.sj === 2 || split.bj === 2) {
      // §2.2: a joker pair is only SJ+SJ or BJ+BJ.
      const actual: JokerRank = split.sj === 2 ? 'SJ' : 'BJ';
      return d.jokerRank === actual ? OK : fail('play.cardsMismatch', { expected: actual });
    }
    // §2.2 hard invariant / §9.15: mixed SJ+BJ is NEVER a pair, anywhere.
    if (split.sj === 1 && split.bj === 1) return fail('play.mixedJokerPair');
    // One joker + a wild (wilds never represent jokers, §4.1) or a natural.
    return split.wilds > 0 ? fail('play.wildCannotBeJoker') : fail('play.cardsMismatch');
  }
  if (d.jokerRank !== undefined) {
    return split.wilds > 0 ? fail('play.wildCannotBeJoker') : fail('play.cardsMismatch');
  }
  if (split.wilds === 2) {
    // §4.2: two standalone wilds ARE a level pair (spec §9.7).
    if (d.keyRank !== level && !config.allowWildUnderDeclare) {
      return fail('play.wildUnderDeclare', { required: level, declared: d.keyRank });
    }
    return OK;
  }
  return checkRankMultiset(split.naturals, [d.keyRank, d.keyRank]);
}

function validateFullHouse(split: SplitCards, d: ComboForm, config: RuleVariant): ValidateResult {
  const jokers = split.sj + split.bj;
  if (jokers > 0) {
    // §3.5: the triple can never be jokers (only 2 of each exist and wilds
    // can't be jokers), so >2 jokers can never decompose.
    if (jokers > 2) return fail('play.jokerNotAllowed', { type: 'fullHouse' });
    if (split.sj === 1 && split.bj === 1) return fail('play.mixedJokerPair'); // §2.2 invariant
    // A lone joker can't be half of anything: wilds never complete a joker
    // pair (§4.1) and a joker can't join the triple (§3.5).
    if (jokers === 1) return fail('play.jokerPairIncomplete');
    // Exactly SJ+SJ or BJ+BJ as the pair part — config-gated (§3.5).
    if (!config.fullHouseJokerPair) return fail('play.fullHouseJokerPairDisabled');
    // The remaining 3 cards (naturals + wilds) must form the keyRank triple.
    return checkRankMultiset(split.naturals, [d.keyRank, d.keyRank, d.keyRank]);
  }

  // No jokers: decompose as triple(keyRank) + pair(p). The pair rank is NOT
  // part of the canonical form (comparison uses the triple only, §3 row 4),
  // so validity = "SOME legal decomposition exists".
  let keyCount = 0;
  let otherRank: Rank | null = null;
  let otherCount = 0;
  for (const card of split.naturals) {
    const rank = rankOf(card)!;
    if (rank === d.keyRank) {
      keyCount++;
    } else if (otherRank === null || otherRank === rank) {
      otherRank = rank;
      otherCount++;
    } else {
      // Two distinct non-key ranks can't fit into one pair.
      return fail('play.cardsMismatch', { card });
    }
  }
  if (otherCount > 0) {
    // Triple takes keyRank cards (≤3), pair takes the other rank (≤2);
    // wild deficits then sum to exactly `wilds` because 3+2 == 5 ==
    // keyCount + otherCount + wilds.
    if (keyCount > 3 || otherCount > 2) return fail('play.cardsMismatch', { rank: otherRank });
    return OK;
  }
  // All naturals are keyRank (keyCount = 5 - wilds ∈ {3,4,5} since w ≤ 2).
  if (keyCount <= 3) {
    // Triple = keyRank (wild-completed if short); leftover wilds form a
    // pair of some other rank — always available, so valid.
    return OK;
  }
  // keyCount 4 or 5: the pair would also be keyRank → five-of-a-kind shape.
  // §3.6: five equal cards are a 5-bomb, not a full house (config-gated).
  return config.fiveOfKindAsFullHouse ? OK : fail('play.fiveOfKindNotFullHouse');
}

function validateStraight(split: SplitCards, d: ComboForm, config: RuleVariant): ValidateResult {
  // sequenceWindow is null exactly when the top is below '5' (no-wrap).
  const window = sequenceWindow(d.keyRank, 5);
  if (window === null) return fail('play.declKeyRankInvalid', { keyRank: d.keyRank });
  if (split.sj + split.bj > 0) return fail('play.jokerNotAllowed', { type: 'straight' }); // §2.2
  const inclusion = checkRankMultiset(split.naturals, window);
  if (!inclusion.ok) return inclusion;
  // §3.8 guard (owner-extended, spec v1.4 / R4c): a selection whose NATURAL
  // cards are all one suit is inherently a straight flush and may not be
  // under-declared as a plain straight (default) — wilds do NOT open an
  // off-suit escape (they read into the run's suit; the SF reading always
  // exists, §1.3 non-orphaning lemma in docs/research/wild-disambiguation.md).
  // A straight always has ≥3 naturals (5 cards, ≤2 wilds, no jokers), so
  // the suit census is never empty.
  if (!config.allowUnderDeclareStraightFlush) {
    const suits = new Set(split.naturals.map((card) => suitOf(card)));
    if (suits.size === 1) return fail('play.mustDeclareStraightFlush');
  }
  return OK;
}

/** Shared tube/plate validation (spec §3 rows 6-7): `windowLength`
 *  consecutive ranks × `copies` each; no jokers (§2.2); wilds fill rank
 *  deficits. All-wild sets are impossible (6 cards > 2 wilds). */
function validateTubeOrPlate(
  split: SplitCards,
  d: ComboForm,
  windowLength: number,
  copies: number,
): ValidateResult {
  const window = sequenceWindow(d.keyRank, windowLength);
  if (window === null) return fail('play.declKeyRankInvalid', { keyRank: d.keyRank });
  if (split.sj + split.bj > 0) return fail('play.jokerNotAllowed', { type: d.type });
  const required: Rank[] = [];
  for (const rank of window) {
    for (let i = 0; i < copies; i++) required.push(rank);
  }
  return checkRankMultiset(split.naturals, required);
}

function validateStraightFlush(
  split: SplitCards,
  d: ComboForm,
  level: Rank,
  config: RuleVariant,
): ValidateResult {
  // sequenceWindow is null exactly when the top is below '5' (no-wrap).
  const window = sequenceWindow(d.keyRank, 5);
  if (window === null) return fail('play.declKeyRankInvalid', { keyRank: d.keyRank });
  if (split.sj + split.bj > 0) return fail('play.jokerNotAllowed', { type: 'straightFlush' }); // §2.2
  const suit = d.suit!; // presence checked in validatePlay
  // Required multiset over (rank,suit) IDENTITIES for the declared suit
  // (spec §4.4.2). Each identity is needed exactly once; wilds fill the
  // missing slots and may fill ANY slot (§4.4.2), including the level
  // rank's own heart slot (§9.11/§9.13). No slot is ever a joker because
  // the window is built from Ranks.
  const needed = new Set<string>();
  for (const rank of window) needed.add(`${rank}${suit}`);
  for (const card of split.naturals) {
    if (!needed.has(card)) return fail('play.cardsMismatch', { card });
    needed.delete(card);
  }
  // Remaining slots == wilds by arithmetic (5 == naturals + wilds).

  // §3.7 demotion bookkeeping. A hearts window through the level rank has
  // its (level,H) slot necessarily wild-filled (every physical heart of the
  // level rank IS a wild) — that wild plays AS ITSELF (§4.1/§9.11) and does
  // not demote. Any other wild-filled slot is substitution.
  let substituting = split.wilds;
  if (suit === 'H' && window.includes(level)) substituting -= 1;
  const actualDemoted = !config.wildStraightFlushIsBomb && substituting > 0;
  if ((d.demoted === true) !== actualDemoted) {
    // Enforced (not inferred) so that stored decls are trustworthy in
    // beats(); classifyPlays always emits the correct flag.
    return fail('play.declDemotedMismatch', { expected: actualDemoted });
  }
  return OK;
}

// ---------------------------------------------------------------------------
// classifyPlays / inferDecl — all canonical interpretations of a multiset.
// ---------------------------------------------------------------------------

/** Candidate keyRanks per sequence type: the top rank fully identifies the
 *  window (see sequenceWindow). Straight tops '5'..'A', tube tops '3'..'A',
 *  plate tops '2'..'A' (spec §4.4.3 window counts: 10 / 12 / 13). */
const STRAIGHT_TOPS: readonly Rank[] = RANKS.slice(3);
const TUBE_TOPS: readonly Rank[] = RANKS.slice(1);
const PLATE_TOPS: readonly Rank[] = RANKS;

/** ALL distinct canonical interpretations of the concrete multiset —
 *  distinct by (type, size, keyRank, suit-for-SF, plus the jokerRank /
 *  demoted extras, which are functions of the multiset anyway). Used for
 *  ambiguity detection (§4.4.4) and decl inference. Implementation: run the
 *  tiny per-size template space through validatePlay, so classification can
 *  never disagree with validation.
 *
 *  POST (v1.4 / R5): the result is sorted by compareComboStrength,
 *  STRONGEST FIRST — the SF end-position pair comes larger-on-top
 *  (owner pin, spec §9.18) and the chooser/hints inherit the order. */
export function classifyPlays(cards: Card[], level: Rank, config: RuleVariant): CanonicalForm[] {
  const forms: CanonicalForm[] = [];
  const attempt = (candidate: ComboForm): void => {
    if (validatePlay(cards, candidate, level, config).ok) forms.push(candidate);
  };
  const attemptStraightFlush = (keyRank: Rank, suit: Suit): void => {
    attempt({ type: 'straightFlush', size: 5, keyRank, suit });
    // Under the §3.7 variant a wild-substituted SF must carry demoted:true;
    // exactly one of the two spellings can validate for a given multiset.
    if (!config.wildStraightFlushIsBomb) {
      attempt({ type: 'straightFlush', size: 5, keyRank, suit, demoted: true });
    }
  };

  switch (cards.length) {
    case 1:
      for (const rank of RANKS) attempt({ type: 'single', size: 1, keyRank: rank });
      attempt({ type: 'single', size: 1, keyRank: 'A', jokerRank: 'SJ' });
      attempt({ type: 'single', size: 1, keyRank: 'A', jokerRank: 'BJ' });
      break;
    case 2:
      for (const rank of RANKS) attempt({ type: 'pair', size: 2, keyRank: rank });
      attempt({ type: 'pair', size: 2, keyRank: 'A', jokerRank: 'SJ' });
      attempt({ type: 'pair', size: 2, keyRank: 'A', jokerRank: 'BJ' });
      break;
    case 3:
      for (const rank of RANKS) attempt({ type: 'triple', size: 3, keyRank: rank });
      break;
    case 4:
      for (const rank of RANKS) attempt({ type: 'bomb', size: 4, keyRank: rank });
      attempt({ type: 'jokerBomb', size: 4, keyRank: 'A' });
      break;
    case 5:
      for (const rank of RANKS) attempt({ type: 'fullHouse', size: 5, keyRank: rank });
      for (const rank of RANKS) attempt({ type: 'bomb', size: 5, keyRank: rank });
      for (const top of STRAIGHT_TOPS) attempt({ type: 'straight', size: 5, keyRank: top });
      for (const top of STRAIGHT_TOPS) {
        for (const suit of SUITS) attemptStraightFlush(top, suit);
      }
      break;
    case 6:
      for (const rank of RANKS) attempt({ type: 'bomb', size: 6, keyRank: rank });
      for (const top of TUBE_TOPS) attempt({ type: 'tube', size: 6, keyRank: top });
      for (const top of PLATE_TOPS) attempt({ type: 'plate', size: 6, keyRank: top });
      break;
    default:
      // 7..10 cards can only ever be a bomb (spec §3 table); anything else
      // (0 cards, >10 cards) has no interpretation.
      if (cards.length >= 7 && cards.length <= 10) {
        for (const rank of RANKS) attempt({ type: 'bomb', size: cards.length, keyRank: rank });
      }
      break;
  }
  forms.sort((a, b) => compareComboStrength(b, a, level, config));
  return forms;
}

/** Unique interpretation, or ambiguity (≥2 forms — spec §4.4.4 then
 *  requires an explicit decl on the PLAY), or none. */
export function inferDecl(
  cards: Card[],
  level: Rank,
  config: RuleVariant,
): { decl: CanonicalForm } | { ambiguous: true } | { invalid: true } {
  const forms = classifyPlays(cards, level, config);
  if (forms.length === 0) return { invalid: true };
  if (forms.length === 1) return { decl: forms[0]! };
  return { ambiguous: true };
}

// ---------------------------------------------------------------------------
// beats — spec §3.
// ---------------------------------------------------------------------------

/** Helper for the trick/generate layers: does this form beat non-bombs
 *  outright (§3.10) and rank on the §3.11 ladder? */
export function isBombForm(form: CanonicalForm, config: RuleVariant): boolean {
  const f = form as ComboForm;
  switch (f.type) {
    case 'bomb':
    case 'jokerBomb':
      return true;
    case 'straightFlush':
      // §3.7 variant: a wild-substituted SF is demoted to non-bomb.
      return config.wildStraightFlushIsBomb || f.demoted !== true;
    default:
      return false;
  }
}

const SEQUENCE_TYPES: ReadonlySet<ComboType> = new Set(['straight', 'tube', 'plate', 'straightFlush']);

/** Comparison key of a form. Rank-keyed types use levelValue ordering
 *  (rankLevelValue; jokers 16/17 via jokerRank); sequence types use
 *  naturalValue of the top rank — the level card never elevates inside
 *  sequences (§2.4), and the canonical keyRank already encodes A-duality
 *  (A-low straight tops at '5', §2.5). Suits never contribute (§2.3). */
export function comboKeyValue(form: CanonicalForm, level: Rank): number {
  const f = form as ComboForm;
  if (f.jokerRank !== undefined) return f.jokerRank === 'BJ' ? 17 : 16;
  if (SEQUENCE_TYPES.has(f.type)) return naturalValue(f.keyRank);
  return rankLevelValue(f.keyRank, level);
}

/** For non-bomb comparison a demoted SF (§3.7 variant) behaves exactly like
 *  a plain straight of its window — same "type" and size 5. */
function effectiveType(form: CanonicalForm, config: RuleVariant): ComboType {
  const f = form as ComboForm;
  if (f.type === 'straightFlush' && !config.wildStraightFlushIsBomb && f.demoted === true) {
    return 'straight';
  }
  return f.type;
}

/** Position on the §3.11 bomb ladder. Same tier ⇒ same type & size, so
 *  same-tier comparison falls through to comboKeyValue. Only call for
 *  forms where isBombForm() is true. */
function bombTier(form: CanonicalForm, config: RuleVariant): number {
  switch (form.type) {
    case 'jokerBomb':
      // §3.11: joker bomb beats everything — unless the jokerBombSupreme=
      // false house rule, where 8+-bombs beat it: slot it strictly between
      // the 7-bomb (70) and the 8-bomb (80).
      return config.jokerBombSupreme ? 110 : 75;
    case 'straightFlush':
      // Strictly between 5-card (50) and 6-card (60) bombs (§3.11).
      return 55;
    default:
      // Rank bombs: 4..10 cards → 40..100.
      return form.size * 10;
  }
}

/** Spec §3 table row number — the FINAL presentation tiebreak of the R5
 *  strength order (docs/research/wild-disambiguation.md §4.3). It only ever
 *  fires between non-bombs with equal comboKeyValue and distinct types: the
 *  reachable cases are plate-vs-tube at an equal top (plate above tube — a
 *  pinned presentation convention, not a rules claim: the two are mutually
 *  unbeatable) and, under variants, a demoted SF above the equal-window
 *  plain straight. */
const TYPE_ORDER: Readonly<Record<ComboType, number>> = {
  single: 1,
  pair: 2,
  triple: 3,
  fullHouse: 4,
  straight: 5,
  tube: 6,
  plate: 7,
  bomb: 8,
  straightFlush: 9,
  jokerBomb: 10,
};

/** Total strength order over canonical forms (R5, spec v1.4 disambiguation
 *  ordering): positive ⇒ `a` is stronger than `b`. Sort descending via
 *  `arr.sort((x, y) => compareComboStrength(y, x, level, config))`.
 *
 *  1. Bombs above non-bombs (a demoted SF is a non-bomb and sorts with the
 *     straights it beats like).
 *  2. Within bombs: bombTier (§3.11 ladder), then comboKeyValue — the SF
 *     end-position pair shares tier 55 and orders larger-on-top by its
 *     window top (owner pin).
 *  3. Within non-bombs: comboKeyValue, then TYPE_ORDER (see above).
 *
 *  Antisymmetric and transitive by construction (a chain of numeric
 *  comparisons); total on any offered set — two distinct offered forms of
 *  one selection can only tie through steps 1–2 by being non-bombs with
 *  equal key AND distinct types (equal key + equal type ⇒ same projection
 *  ⇒ same form), which step 3 breaks. */
export function compareComboStrength(
  a: CanonicalForm,
  b: CanonicalForm,
  level: Rank,
  config: RuleVariant,
): number {
  const aBomb = isBombForm(a, config);
  const bBomb = isBombForm(b, config);
  if (aBomb !== bBomb) return aBomb ? 1 : -1;
  if (aBomb) {
    const tier = bombTier(a, config) - bombTier(b, config);
    if (tier !== 0) return tier;
  }
  const key = comboKeyValue(a, level) - comboKeyValue(b, level);
  if (key !== 0) return key;
  return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
}

/** Does `candidate` beat `top`? Spec §3: same type & size with a strictly
 *  higher key, or bomb-beats-non-bomb (§3.10), or the §3.11 bomb ladder.
 *  Equal never beats (§3 preamble, §9.16) — all comparisons are strict. */
export function beats(
  candidate: CanonicalForm,
  top: CanonicalForm,
  level: Rank,
  config: RuleVariant,
): boolean {
  const candidateBomb = isBombForm(candidate, config);
  const topBomb = isBombForm(top, config);

  // §3.9/§3.10: bombs beat every non-bomb; non-bombs never beat bombs.
  if (candidateBomb !== topBomb) return candidateBomb;

  if (!candidateBomb) {
    // Non-bomb vs non-bomb: same (effective) type, same card count,
    // strictly higher key (§3 preamble). effectiveType folds the §3.7
    // demoted SF into 'straight'.
    if (effectiveType(candidate, config) !== effectiveType(top, config)) return false;
    if (candidate.size !== top.size) return false;
    return comboKeyValue(candidate, level) > comboKeyValue(top, level);
  }

  // Bomb vs bomb: the §3.11 ladder, then same-tier key comparison —
  // rankLevelValue for rank bombs (level-rank bombs sit at 15, §3.4),
  // naturalValue of the top card for SF vs SF (suit never breaks ties,
  // §9.16). Joker bombs are all equal (equal never beats).
  const candidateTier = bombTier(candidate, config);
  const topTier = bombTier(top, config);
  if (candidateTier !== topTier) return candidateTier > topTier;
  if (candidate.type === 'jokerBomb') return false;
  return comboKeyValue(candidate, level) > comboKeyValue(top, level);
}
