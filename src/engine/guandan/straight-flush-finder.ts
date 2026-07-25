// Straight-flush finder (docs/research/straight-flush-finder.md) — a PURE
// ASSISTANT over the player's OWN hand. It shows the meaningful ways to pull
// straight flushes out of a hand and, for each, what the hand would have LEFT.
//
// It is assistant-only BY CONSTRUCTION: a pure function over
// (hand, level, config), importing ONLY already-client-legal engine primitives
// (cards.ts, combos.ts classifyPlays/bombTier/isBombForm/
// sequenceWindow, generate.ts legalPlays). It changes NO game state, legality,
// protocol, redaction, timing or generation, reveals nothing about other seats
// (its sole input is the player's own hand), and it REUSES the engine's
// classifiers rather than reimplementing rules — so it can never become a second
// rules oracle that drifts from validatePlay: a 5-set is an SF group iff
// classifyPlays returns a straightFlush form for it.
//
// The UNIT is a complete DECOMPOSITION: a set of pairwise-disjoint SF groups pulled
// from the hand PLUS the induced remainder (the decision-carrying half). Because
// the hand is fixed, the chosen groups determine the remainder exactly
// (the same-groups-⟺-same-remainder theorem, §2.4 of the research doc), under
// natural-first (minimum-wild) materialization.

import type { Card, Rank, Suit } from './cards';
import {
  RANKS,
  SUITS,
  countHand,
  naturalValue,
  removeCards,
  sortCards,
} from './cards';
import type { RuleVariant } from './config';
import type { CanonicalForm } from './types';
import { bombTier, classifyPlays, isBombForm, sequenceWindow } from './combos';
import { legalPlays } from './generate';

// ---------------------------------------------------------------------------
// Public shapes.
// ---------------------------------------------------------------------------

/** A single straight flush the player could pull, as physical cards + the
 *  form(s) it may be declared as. The end-position pair (same 5 cards, two
 *  tops — e.g. {5♠6♠7♠8♠+wild} as top-9♠ or top-8♠) is ONE group carrying
 *  BOTH forms, strongest (larger-top) first: it is one physical set-aside and
 *  one identical remainder, so it must not split the decomposition. */
export interface SfGroup {
  /** The 5 cards set aside for this SF, sorted (wild shown as itself; the UI
   *  resolves it to the identity it stands for via resolveComboFaces). */
  cards: Card[];
  /** The straightFlush form(s), from classifyPlays, strongest first. */
  forms: CanonicalForm[];
  /** The window suit (determined by the naturals, R1). */
  suit: Suit;
  /** The strongest form's window top rank — the group's label. */
  top: Rank;
  /** Wilds consumed by this group (0, 1 or 2). */
  wildsUsed: number;
}

/** The closed, FACTUAL remainder-tag vocabulary (owner strengthen 1). Every
 *  entry states a FACT about the remainder — a count or a presence — NEVER a
 *  comparative or advisory judgement ("better"/"recommended"/"stronger"). The
 *  finder INFORMS the keep-vs-break decision; it must never MAKE it. This set is
 *  CLOSED: nothing outside it may ever render, enforced structurally by
 *  straight-flush-finder.test.ts (adding an advisory kind fails the build). */
export type RemainderTagKind =
  | 'bomb'
  | 'straightFlush'
  | 'run'
  | 'fullHouse'
  | 'triple'
  | 'pair'
  | 'scatter'
  | 'cardsLeft';

export const REMAINDER_TAG_KINDS = [
  'bomb',
  'straightFlush',
  'run',
  'fullHouse',
  'triple',
  'pair',
  'scatter',
  'cardsLeft',
] as const satisfies readonly RemainderTagKind[];

/** EXHAUSTIVENESS PIN (audit finding — the previous `readonly RemainderTagKind[]`
 *  annotation was a SUBSET check, so adding an advisory member to the union while
 *  leaving the array alone still COMPILED and the runtime equality test still
 *  passed). This alias is `never` unless the array covers the union exactly, so
 *  widening the union without widening the array is now a COMPILE error — the
 *  "informs, never advises" rule made structural in the type system, not just in
 *  a runtime test. */
type RemainderTagKindsAreExhaustive =
  Exclude<RemainderTagKind, (typeof REMAINDER_TAG_KINDS)[number]> extends never ? true : never;
const _remainderTagKindsAreExhaustive: RemainderTagKindsAreExhaustive = true;
void _remainderTagKindsAreExhaustive;

export interface RemainderTag {
  kind: RemainderTagKind;
  /** Present for the counted kinds (bomb / straightFlush / cardsLeft); absent
   *  for the presence kinds (run / scatter). */
  count?: number;
}

/** A complete decomposition: the SFs pulled + the exact remainder + a factual
 *  read of the remainder. */
export interface Decomposition {
  /** ≥1 pairwise-disjoint SF groups. */
  groups: SfGroup[];
  /** hand − ⋃groups, sorted. Exact multiset complement (twin-safe). */
  remainder: Card[];
  /** Closed factual vocabulary (see RemainderTagKind). */
  tags: RemainderTag[];
}

export interface SfFinderResult {
  /** The Pareto frontier of decompositions, ranked strongest-SF-then-best-
   *  remainder, capped at SF_FINDER_MAX_SHOWN. Empty iff the hand holds no SF. */
  decompositions: Decomposition[];
  /** True iff ≥1 straight flush exists in the hand — lets the UI tell "looked,
   *  found none" (acknowledge the press) from "did not look" (owner strengthen
   *  2, the no-silent-no-op class). */
  found: boolean;
  /** Distinct frontier decompositions BEFORE the display cap — the UI's
   *  "found N ways" count (the localized string is added in the UI phase). */
  totalFound: number;
}

/** DISPLAY counts (owner Decision 3: a phone eye cannot compare a column of
 *  dozens). These are the UI's, not the engine's — findStraightFlushes returns the
 *  WHOLE Pareto frontier so `totalFound === decompositions.length` and every way
 *  the player is told about is actually reachable. The sheet shows
 *  SF_FINDER_PRIMARY_SHOWN first and "show more" reveals the rest. */
export const SF_FINDER_PRIMARY_SHOWN = 4;

/** Node-budget backstop (owner Decision 7). The structural caps (≤40 candidates,
 *  ≤5 SFs/hand, ≤2 wild-using SFs) bound the search: the worst REALISTIC 27-card
 *  hands measured need ~1.1k leaves against this 4096 budget, so it does not fire
 *  in practice — that headroom, not the constant, is what makes blowup a
 *  non-issue.
 *
 *  HONESTY (audit finding — the earlier comment claimed this was "a DISPLAY cap,
 *  never a completeness compromise", which is FALSE): this budget truncates the
 *  PACKING SEARCH, so if it ever fired it would drop whole decompositions and
 *  under-report totalFound — a completeness compromise, not a display one. It is
 *  a runaway backstop of last resort, kept because an unbounded recursive search
 *  on adversarial input is worse than a bounded one. The display cap is a
 *  separate, deliberate thing (SF_FINDER_MAX_SHOWN). */
export const SF_FINDER_PACKING_BUDGET = 4096;

// ---------------------------------------------------------------------------
// Candidate windows.
// ---------------------------------------------------------------------------

/** SF window tops: '5'..'A' (10 windows, A-low included, no wrap) — the same
 *  space generate.ts enumerates. */
const SF_TOPS: readonly Rank[] = RANKS.slice(3);

interface CandidateWindow {
  top: Rank;
  suit: Suit;
  /** The 5 (rank,suit) identities the window needs, e.g. '5S'..'9S'. */
  identities: Card[];
}

/** Every window whose single-instance wild deficit is affordable (≤ wilds held).
 *  supply(level+'H') is 0 by construction (countHand routes those copies to
 *  `wilds`, never `byIdentity`), so a hearts window through the level rank
 *  spends a wild in that slot — matching generate.ts / spec §9.11. */
function candidateWindows(
  byIdentity: ReadonlyMap<string, number>,
  wilds: number,
): CandidateWindow[] {
  const out: CandidateWindow[] = [];
  for (const top of SF_TOPS) {
    const window = sequenceWindow(top, 5)!; // top ≥ '5' ⇒ never null
    for (const suit of SUITS) {
      const identities = window.map((rank) => `${rank}${suit}` as Card);
      let deficit = 0;
      for (const id of identities) if ((byIdentity.get(id) ?? 0) === 0) deficit++;
      if (deficit <= wilds) out.push({ top, suit, identities });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bounded-multiplicity set packing (research §2). A packing is a list of window
// INSTANCES; taking an instance consumes a natural of each present identity and
// a wild for each absent one (natural-first / minimum-wild materialization),
// which enforces the global feasibility inequality incrementally.
// ---------------------------------------------------------------------------

type Supply = Map<string, number>;

/** The wilds an instance of `cand` needs against `supply` (its absent
 *  identities), or null if unaffordable. Never mutates. */
function instanceDeficit(cand: CandidateWindow, supply: Supply): number {
  let deficit = 0;
  for (const id of cand.identities) if ((supply.get(id) ?? 0) === 0) deficit++;
  return deficit;
}

/** Consume one instance of `cand` from `supply` (mutates: naturals-first). PRE:
 *  its deficit ≤ the wild budget the caller tracks separately. */
function consumeInstance(cand: CandidateWindow, supply: Supply): void {
  for (const id of cand.identities) {
    const have = supply.get(id) ?? 0;
    if (have > 0) supply.set(id, have - 1);
  }
}

/** Enumerate every FEASIBLE packing (multiset of window instances, k ≥ 0) as a
 *  list of instance index-lists over `candidates`. Depth-first over candidates
 *  in fixed order, trying multiplicity 0,1,2,… at each; the wild budget and
 *  per-identity supply prune it hard. Bounded by SF_FINDER_PACKING_BUDGET. */
function enumeratePackings(
  candidates: CandidateWindow[],
  supply0: Supply,
  wilds: number,
): number[][] {
  const packings: number[][] = [];
  let budgetLeft = SF_FINDER_PACKING_BUDGET;

  const search = (i: number, supply: Supply, wildsLeft: number, current: number[]): void => {
    if (budgetLeft <= 0) return;
    if (i === candidates.length) {
      budgetLeft--;
      packings.push(current);
      return;
    }
    // m = 0: skip this candidate.
    search(i + 1, supply, wildsLeft, current);
    // m ≥ 1: take instances one at a time, cloning supply so siblings are
    // independent; a wild is spent exactly when a natural is unavailable.
    const localSupply: Supply = new Map(supply);
    let localWilds = wildsLeft;
    let localCurrent = current;
    for (;;) {
      const deficit = instanceDeficit(candidates[i]!, localSupply);
      if (deficit > localWilds) break;
      consumeInstance(candidates[i]!, localSupply);
      localWilds -= deficit;
      localCurrent = [...localCurrent, i];
      search(i + 1, localSupply, localWilds, localCurrent);
      if (budgetLeft <= 0) break;
    }
  };

  search(0, supply0, wilds, []);
  return packings;
}

// ---------------------------------------------------------------------------
// Materialization: a packing (instance index list) → physical SF groups + the
// exact remainder. Determined by the packing (the theorem), so the decomposition
// signature dedups equivalent allocations.
// ---------------------------------------------------------------------------

function cardsKey(cards: readonly Card[]): string {
  return [...cards].sort().join(',');
}

/** The physical 5-card groups of a packing, allocating naturals first across
 *  instances (a running supply copy), wilds for the rest. */
function materializeGroups(
  instances: number[],
  candidates: CandidateWindow[],
  byIdentity: ReadonlyMap<string, number>,
  wild: Card,
  level: Rank,
  config: RuleVariant,
): SfGroup[] {
  const supply: Supply = new Map(byIdentity);
  const groups: SfGroup[] = [];
  for (const idx of instances) {
    const cand = candidates[idx]!;
    const cards: Card[] = [];
    let wildsUsed = 0;
    for (const id of cand.identities) {
      const have = supply.get(id) ?? 0;
      if (have > 0) {
        supply.set(id, have - 1);
        cards.push(id);
      } else {
        cards.push(wild);
        wildsUsed++;
      }
    }
    const sorted = sortCards(cards, level);
    // The group's declarable form(s): classifyPlays over the concrete cards, SF
    // forms only, strongest first (end-position pair larger-top-first — it
    // already sorts by compareComboStrength). Cannot disagree with validatePlay.
    const forms = classifyPlays([...sorted], level, config).filter(
      (form) => form.type === 'straightFlush',
    );
    // A materialized SF window always classifies as ≥1 straightFlush; guard
    // defensively so a future rule change surfaces as a dropped group, not a
    // crash.
    if (forms.length === 0) continue;
    groups.push({ cards: sorted, forms, suit: cand.suit, top: forms[0]!.keyRank, wildsUsed });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Remainder annotation — the CLOSED, FACTUAL vocabulary (research §4).
//
// TWO DIFFERENT QUESTIONS, deliberately answered by two different mechanisms
// (audit finding — conflating them was a category error):
//   • PRESENCE ("is there a run / full house / triple / pair in here?") comes
//     from legalPlays, the same generator that validates plays, so it can never
//     drift from the rules. Its per-projection dedupe is harmless here: it can
//     hide a DUPLICATE, never the existence of one.
//   • COUNTS ("how many disjoint bombs / straight flushes?") must NOT come from
//     legalPlays. It is a MOVE generator and emits ONE realization per canonical
//     projection — for straight flushes the projection is SUIT-BLIND, so
//     5♠6♠7♠8♠9♠ + 5♣6♣7♣8♣9♣ (two genuinely disjoint SFs) emitted only ONE, and
//     twins collapsed the same way. Counting off that list systematically
//     UNDERCOUNTED exactly the "break it and I have two bombs" signal this
//     feature exists to surface. Counts therefore come from a multiplicity-aware
//     greedy over enumerated candidates (below).
// The count stays a constructive, deterministic LOWER BOUND — the exhibited
// holdings really are pairwise disjoint, so it can never OVERCLAIM.
// ---------------------------------------------------------------------------

interface RemainderRead {
  tags: RemainderTag[];
  /** Ranking proxy (research §3): higher is better. */
  bombPower: number;
  coverage: number; // fraction of R in some multi-card play, 0..1
  orphans: number; // cards in no multi-card play
}

const SEQUENCE_TYPES: ReadonlySet<CanonicalForm['type']> = new Set([
  'straight',
  'tube',
  'plate',
  'straightFlush',
]);

/** Disjoint notable holdings of a card set. EXPORTED for the ranking property
 *  test, which imports it so the test MODEL and the product cannot disagree about
 *  the quality definition — the same idiom as the deadline-liveness model
 *  importing clampBudgetMs. Independence for the COUNTS lives where it belongs:
 *  the tag-truth checks bound them with their own brute-force enumeration. */
export interface Holdings {
  bombs: number;
  straightFlushes: number;
  power: number;
}

/** Natural (non-wild) copies of `rank` across all suits in `supply`. */
function naturalsOfRank(supply: Supply, rank: Rank): number {
  let n = 0;
  for (const suit of SUITS) n += supply.get(`${rank}${suit}`) ?? 0;
  return n;
}

/** Take `n` naturals of `rank` out of `supply` (highest-supply suits first for
 *  determinism); returns how many wilds were still needed. */
function takeRankNaturals(supply: Supply, rank: Rank, want: number): number {
  let left = want;
  for (const suit of SUITS) {
    const id = `${rank}${suit}`;
    while (left > 0 && (supply.get(id) ?? 0) > 0) {
      supply.set(id, supply.get(id)! - 1);
      left--;
    }
  }
  return left; // remaining deficit → wilds
}

/** A STRONGEST-FIRST DISJOINT extraction of the notable holdings of a card set,
 *  WITH multiplicity. Reuses the engine's own ladder (combos.bombTier) for
 *  strength, so it cannot drift from the rules; the enumeration (not the
 *  classification) is what legalPlays cannot give us. Deterministic: candidates
 *  are scanned in a fixed order and the strongest takeable one wins each round.
 *
 *  IT IS NOT MAXIMUM-CARDINALITY, and must not be described as such (audit
 *  finding — this comment used to say "Max DISJOINT", which is false). The greedy
 *  maximises STRENGTH, not count: for `5-9 in all four suits` it takes FOUR
 *  straight flushes (4 x tier 55 = 220) where FIVE disjoint rank bombs also exist
 *  (5 x tier 40 = 200). Both readings are true of the same cards; the stronger
 *  one is the better thing to tell a player, since each straight flush beats a
 *  4-bomb. The contract the tags rely on is therefore: every reported holding is
 *  REAL and they are pairwise DISJOINT, so a count is a constructive LOWER BOUND
 *  that can never overclaim — never a maximum. */
/** The published remainder-QUALITY tuple `[bombPower, coverage, −orphans]`,
 *  compared lexicographically, higher is better (research §3). EXPORTED for the
 *  ranking property test, which imports it so the test MODEL and the product
 *  cannot disagree about the DEFINITION — the clampBudgetMs idiom. Independence
 *  lives where it belongs: assertTagsTruthful bounds the counts with its own
 *  brute-force enumeration, and the ranking test verifies FRONTIER + ORDER. */
export function remainderQuality(
  cards: readonly Card[],
  level: Rank,
  config: RuleVariant,
): [number, number, number] {
  const read = annotateRemainder(sortCards([...cards], level), level, config);
  return [read.bombPower, read.coverage, -read.orphans];
}

export function countHoldings(cards: readonly Card[], level: Rank, config: RuleVariant): Holdings {
  const counts = countHand(cards, level);
  const supply: Supply = new Map();
  for (const [id, n] of Object.entries(counts.byIdentity)) supply.set(id, n ?? 0);
  let wilds = counts.wilds;
  let sj = counts.sj;
  let bj = counts.bj;
  const held: Holdings = { bombs: 0, straightFlushes: 0, power: 0 };

  const windows = candidateWindows(supply, wilds);

  for (;;) {
    // Score every takeable candidate against the CURRENT supply; take the
    // strongest. A candidate may be taken repeatedly (the multiplicity the
    // projection-deduped generator cannot express).
    let best: { tier: number; take: () => void } | null = null;
    const offer = (tier: number, take: () => void): void => {
      if (best === null || tier > best.tier) best = { tier, take };
    };

    if (sj >= 2 && bj >= 2) {
      offer(bombTier({ type: 'jokerBomb', size: 4, keyRank: 'A' }, config), () => {
        sj -= 2;
        bj -= 2;
        held.bombs++;
        held.power += bombTier({ type: 'jokerBomb', size: 4, keyRank: 'A' }, config);
      });
    }

    for (const rank of RANKS) {
      const nat = naturalsOfRank(supply, rank);
      const size = Math.min(10, nat + wilds);
      if (size < 4) continue;
      const form: CanonicalForm = { type: 'bomb', size, keyRank: rank };
      offer(bombTier(form, config), () => {
        const deficit = takeRankNaturals(supply, rank, Math.min(size, nat));
        wilds -= Math.max(0, size - Math.min(size, nat)) + deficit;
        held.bombs++;
        held.power += bombTier(form, config);
      });
    }

    for (const window of windows) {
      const deficit = instanceDeficit(window, supply);
      if (deficit > wilds) continue;
      // Bomb status of this straight flush. Under the DEFAULT config every SF is
      // a bomb (isBombForm short-circuits on wildStraightFlushIsBomb), so the
      // plain form suffices. Only the §3.7 VARIANT can demote a wild-substituted
      // SF, and only there do we pay classifyPlays to let the ENGINE decide the
      // demoted flag — never a local re-derivation of the rule. (Calling it on
      // every window every round cost ~60-80ms on a 27-card hand.)
      let form: CanonicalForm = { type: 'straightFlush', size: 5, keyRank: window.top, suit: window.suit };
      if (!config.wildStraightFlushIsBomb) {
        const exhibit: Card[] = window.identities.map((id) =>
          (supply.get(id) ?? 0) > 0 ? id : (`${level}H` as Card),
        );
        const classified = classifyPlays([...exhibit], level, config).find(
          (f) => f.type === 'straightFlush',
        );
        if (classified === undefined) continue;
        form = classified;
      }
      const isBomb = isBombForm(form, config);
      offer(isBomb ? bombTier(form, config) : 0, () => {
        consumeInstance(window, supply);
        wilds -= deficit;
        held.straightFlushes++;
        if (isBomb) held.power += bombTier(form, config);
      });
    }

    if (best === null) break;
    (best as { tier: number; take: () => void }).take();
  }
  return held;
}

function annotateRemainder(remainder: readonly Card[], level: Rank, config: RuleVariant): RemainderRead {
  const cardsLeft: RemainderTag = { kind: 'cardsLeft', count: remainder.length };
  if (remainder.length === 0) {
    return { tags: [cardsLeft], bombPower: 0, coverage: 0, orphans: 0 };
  }
  const plays = legalPlays([...remainder], null, level, config);

  // COUNTS: multiplicity-aware (see the section header — legalPlays cannot
  // express "two disjoint straight flushes" because its SF projection is
  // suit-blind). Constructive and disjoint, so still a lower bound that never
  // overclaims.
  const held = countHoldings(remainder, level, config);
  const bombCount = held.bombs;
  const sfCount = held.straightFlushes;
  const bombPower = held.power;

  // Coverage / orphans, MULTIPLICITY-AWARE (audit finding — this was a `Set<Card>`
  // keyed on identity, so for remainder 5S,5S,6S,7S,8S,9S a straight flush covering
  // ONE 5S marked BOTH copies covered and reported orphans=0. Same class of bug as
  // counting off the projection-deduped generator: a twin is a physically distinct
  // card.) Greedy DISJOINT cover: repeatedly take any multi-card play that still
  // fits the pool. Constructive, so coverage is a true lower bound and orphans a
  // true upper bound — it can never flatter a twin-heavy remainder into dominating
  // a genuinely cleaner one.
  const pool = new Map<Card, number>();
  for (const card of remainder) pool.set(card, (pool.get(card) ?? 0) + 1);
  // LARGEST play first: taking whatever happened to come first made coverage
  // depend on legalPlays' emission order and understated it badly (a lone pair
  // was taken ahead of the 5-card straight flush that covered far more). Sorting
  // by size makes the cover deterministic and a much tighter lower bound.
  const multi = plays.filter((p) => p.cards.length >= 2).sort((a, b) => b.cards.length - a.cards.length);
  let coveredCount = 0;
  for (;;) {
    const fit = multi.find((p) => {
      const need = new Map<Card, number>();
      for (const c of p.cards) need.set(c, (need.get(c) ?? 0) + 1);
      for (const [c, n] of need) if ((pool.get(c) ?? 0) < n) return false;
      return true;
    });
    if (fit === undefined) break;
    for (const c of fit.cards) pool.set(c, (pool.get(c) ?? 0) - 1);
    coveredCount += fit.cards.length;
  }
  const orphans = remainder.length - coveredCount;
  const coverage = coveredCount / remainder.length;

  // PRESENCE of the weaker structures, from legalPlays (dedupe can hide a
  // duplicate, never an existence — so presence is exactly what it is good for).
  const hasRun = plays.some((p) => SEQUENCE_TYPES.has(p.decl.type) && !isBombForm(p.decl, config));
  const hasFullHouse = plays.some((p) => p.decl.type === 'fullHouse');
  const hasTriple = plays.some((p) => p.decl.type === 'triple');
  const hasPair = plays.some((p) => p.decl.type === 'pair');

  const tags: RemainderTag[] = [];
  if (bombCount > 0) tags.push({ kind: 'bomb', count: bombCount });
  if (sfCount > 0) tags.push({ kind: 'straightFlush', count: sfCount });
  // ONE presence word for the strongest remaining structure, so a phone row stays
  // readable. Ladder: run > fullHouse > triple > pair. Added because fixing the
  // old scatter overreach had traded a WRONG tag for SILENCE — 56.8% of non-empty
  // remainders were left with only a card count although they really held a
  // pair/triple/full house, which blunts the whole point of the annotation
  // (compare what is left at a glance). Every one of these is a FACT about the
  // cards — a presence, never a judgement — so the "informs, never advises" rule
  // is untouched.
  if (bombCount === 0 && sfCount === 0) {
    if (hasRun) tags.push({ kind: 'run' });
    else if (hasFullHouse) tags.push({ kind: 'fullHouse' });
    else if (hasTriple) tags.push({ kind: 'triple' });
    else if (hasPair) tags.push({ kind: 'pair' });
    // SCATTER means literally "loose cards": nothing in the remainder combines at
    // all (a leftover PAIR used to be called scatter, which misreads the cards).
    else if (orphans === remainder.length) tags.push({ kind: 'scatter' });
  }
  tags.push(cardsLeft);

  return { tags, bombPower, coverage, orphans };
}

// ---------------------------------------------------------------------------
// Ranking — the Pareto frontier of (SFValue, RemainderQuality) (research §3).
// ---------------------------------------------------------------------------

/** A group's SF strength as a numeric consistent with compareComboStrength for
 *  SF-vs-SF: a non-demoted SF (a bomb) sits above any demoted SF, and within
 *  each, larger window top wins. Uses the group's strongest declarable form. */
function sfScore(group: SfGroup, config: RuleVariant): number {
  const form = group.forms[0]!;
  const top = naturalValue(form.keyRank);
  return isBombForm(form, config) ? 1000 + top : top;
}

interface Scored {
  decomposition: Decomposition;
  /** Group SF scores, sorted descending — the SFValue partial-order vector. */
  sfValue: number[];
  quality: [number, number, number]; // [bombPower, coverage, −orphans], total-ordered
  key: string; // stable tiebreak (signature) for total determinism
}

/** SFValue partial order: pad the shorter vector with −∞ and compare pointwise.
 *  a ≥ b iff every position of a is ≥ b's. So "2 weak SFs" and "1 strong SF"
 *  stay incomparable (both kept); "1 strong SF, ≥-good remainder" dominates
 *  "1 weak SF". */
function sfValueGE(a: readonly number[], b: readonly number[]): boolean {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av < bv) return false;
  }
  return true;
}

function sfValueEQ(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** RemainderQuality total order (lexicographic): bombPower, then coverage, then
 *  fewer orphans. Positive ⇒ a is better. */
function qualityCmp(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

/** Dominance: d1 dominates d2 iff SFValue(d1) ≥ SFValue(d2) AND
 *  RemainderQuality(d1) ≥ RemainderQuality(d2), strict in at least one. */
function dominates(d1: Scored, d2: Scored): boolean {
  if (!sfValueGE(d1.sfValue, d2.sfValue)) return false;
  if (qualityCmp(d1.quality, d2.quality) < 0) return false;
  const strictSf = !sfValueEQ(d1.sfValue, d2.sfValue);
  const strictQ = qualityCmp(d1.quality, d2.quality) > 0;
  return strictSf || strictQ;
}

/** Display order (total, deterministic): stronger SFValue first (lexicographic
 *  on the sorted-descending vector, longer-and-stronger wins), then better
 *  remainder, then the stable signature tiebreak. */
function displayCmp(a: Scored, b: Scored): number {
  const n = Math.max(a.sfValue.length, b.sfValue.length);
  for (let i = 0; i < n; i++) {
    const av = a.sfValue[i] ?? -Infinity;
    const bv = b.sfValue[i] ?? -Infinity;
    if (av !== bv) return bv - av;
  }
  const q = qualityCmp(b.quality, a.quality);
  if (q !== 0) return q;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

// ---------------------------------------------------------------------------
// The public finder + the raw enumerator (exported for the completeness oracle,
// which compares its independent brute-force set against the RAW output before
// ranking/pruning).
// ---------------------------------------------------------------------------

/** Every DISTINCT decomposition (k ≥ 1) of the hand, deduped by arrangement
 *  identity (§1: the remainder), BEFORE Pareto pruning or ranking. This is the
 *  completeness oracle's comparison target. */
export function enumerateDecompositions(
  hand: readonly Card[],
  level: Rank,
  config: RuleVariant,
): Decomposition[] {
  return enumerateScored(hand, level, config).map((x) => x.decomposition);
}

/** The enumeration WITH each remainder's read attached. The read is the expensive
 *  part (a legalPlays scan per decomposition) and both the tags and the ranking
 *  need it, so it is computed ONCE here and threaded — it used to be recomputed
 *  in findStraightFlushes, roughly doubling the cost of the whole call (audit
 *  finding). Kept internal, and threaded rather than memoized in module state, so
 *  the finder stays a pure function with no cross-call contamination. */
function enumerateScored(
  hand: readonly Card[],
  level: Rank,
  config: RuleVariant,
): { decomposition: Decomposition; read: RemainderRead }[] {
  const counts = countHand(hand, level);
  const byIdentity = new Map<string, number>();
  for (const [id, n] of Object.entries(counts.byIdentity)) byIdentity.set(id, n ?? 0);
  const wild: Card = `${level}H`;
  const candidates = candidateWindows(byIdentity, counts.wilds);
  if (candidates.length === 0) return [];

  const packings = enumeratePackings(candidates, new Map(byIdentity), counts.wilds);
  const bySignature = new Map<string, { decomposition: Decomposition; read: RemainderRead }>();
  for (const instances of packings) {
    if (instances.length === 0) continue; // the empty decomposition is not rendered
    const groups = materializeGroups(instances, candidates, byIdentity, wild, level, config);
    if (groups.length === 0) continue;
    const used: Card[] = [];
    for (const g of groups) used.push(...g.cards);
    const remainder = removeCards(hand, used);
    // The theorem guarantees this fold succeeds for a feasible packing; guard
    // so a would-be twin over-removal surfaces as a dropped decomposition, not
    // a wrong remainder.
    if (remainder === null) continue;
    const sortedRemainder = sortCards(remainder, level);
    // Distinctness (research §1, owner Decision 6): an arrangement is identified
    // by its REMAINDER — equivalently the committed-card set, since the hand is
    // fixed. "The same five cards pulled are one arrangement regardless of label
    // (end-position collapses; the group carries both tops); a different suit is
    // a genuinely different pull (different committed cards ⇒ different
    // remainder)." This is exactly π-coarser-in-end-position and π-finer-in-suit,
    // and it dissolves the DFS-order / wild-redistribution artifacts that a
    // physical-card or per-group-form key produced (the oracle caught both). The
    // groups shown are one representative partition of the committed cards
    // (natural-first); the tops are a play-time choice carried on the forms.
    const signature = cardsKey(sortedRemainder);
    if (bySignature.has(signature)) continue;
    const read = annotateRemainder(sortedRemainder, level, config);
    bySignature.set(signature, {
      decomposition: { groups, remainder: sortedRemainder, tags: read.tags },
      read,
    });
  }
  return [...bySignature.values()];
}

/** Find the meaningful straight-flush arrangements of the player's own hand:
 *  the Pareto frontier of complete decompositions, ranked strongest-SF-then-
 *  best-remainder, capped for display.
 *
 *  COST (measured on this machine, audit finding — an earlier comment wrongly
 *  said "safe to call every render"): a full 27-card hand costs ~100-160ms, the
 *  remainder scan (a legalPlays call per decomposition) dominating; a phone is
 *  several times slower. That suits the ON-DEMAND press this feature is (the
 *  player taps "find", the sheet opens) but it must NOT sit in a render path or a
 *  per-keystroke effect — the UI calls it once per press and holds the result.
 *  Pure and deterministic, so the result is freely cacheable per (hand, level). */
export function findStraightFlushes(
  hand: readonly Card[],
  level: Rank,
  config: RuleVariant,
): SfFinderResult {
  const enumerated = enumerateScored(hand, level, config);
  if (enumerated.length === 0) {
    return { decompositions: [], found: false, totalFound: 0 };
  }

  const scored: Scored[] = enumerated.map(({ decomposition, read }) => {
    const sfValue = decomposition.groups
      .map((g) => sfScore(g, config))
      .sort((a, b) => b - a);
    return {
      decomposition,
      sfValue,
      quality: [read.bombPower, read.coverage, -read.orphans],
      // Stable tiebreak for FULLY tied rows (e.g. the same run in ♥ and in ♠:
      // identical SF strength, identical remainder quality). It must be the
      // arrangement's IDENTITY — the remainder (§1) — so ordering and dedup agree;
      // an older group-cards key survived the identity refinement and made the
      // order disagree with the arrangement identity for exact ties.
      key: cardsKey(decomposition.remainder),
    };
  });

  // Pareto frontier: keep only NON-DOMINATED decompositions. Precisely what this
  // does and does not drop (audit finding — the earlier comment said "NEVER a
  // filter that hides an alternative", which overclaimed):
  //   • DROPPED: strictly-dominated arrangements — another keeps SFs at least as
  //     strong AND leaves a remainder at least as good. These are strictly-worse
  //     duplicates, never a genuine trade (owner Decision 3 signs this off), and
  //     the drop is large (a 27-card hand can go ~290 raw → ~13 frontier).
  //   • KEPT: every genuine trade. "One strong SF" and "two weaker SFs" are
  //     INCOMPARABLE under the SFValue partial order, so both survive — that is
  //     what makes the keep-vs-break tension visible rather than sorted away.
  //   • The display cap (SF_FINDER_MAX_SHOWN) is a SEPARATE, deliberate limit and
  //     CAN hide non-dominated rows; totalFound reports the full frontier size so
  //     the UI can say how many exist. Never silently truncate without that count.
  // Ranking itself is judgement, not truth — verified as a deterministic property
  // (frontier + order), never as an optimality claim.
  const frontier = scored.filter((d) => !scored.some((other) => other !== d && dominates(other, d)));
  frontier.sort(displayCmp);

  // Return the WHOLE frontier and let the UI decide how much to show. The engine
  // used to slice to SF_FINDER_MAX_SHOWN while still reporting the full
  // totalFound, so a hand with 7 real arrangements advertised "7 ways" and could
  // only ever reach 6 — a permanent silent truncation that survived even "show
  // more" (UX audit). Now totalFound === decompositions.length always: the count
  // the player is shown is exactly the count they can reach.
  return {
    decompositions: frontier.map((s) => s.decomposition),
    found: true,
    totalFound: frontier.length,
  };
}
