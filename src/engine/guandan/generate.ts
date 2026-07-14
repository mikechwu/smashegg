// Legal-move generation (Problem G, spec §4.4.3 with the v1.1 corrections).
// Strategy: TEMPLATE ENUMERATION, never subset enumeration — for each combo
// family we iterate its small template space (13 rank groups × sizes, 10
// straight windows, 10×4 SF windows, 12 tube / 13 plate windows, 13 full-
// house triple ranks), test feasibility by count arithmetic (deficit ≤ held
// wilds), and only then materialize ONE wild-frugal concrete realization.
// Output is complete up to canonical-form equivalence (PLAN.md §3
// obligation 4): one play per distinct suit-blind projection
// (type, size, keyRank, isSF — plus the jokerRank extra, which
// distinguishes joker singles/pairs from the rank-'A' forms they share a
// keyRank spelling with).
//
// When following (toBeat ≠ null) every template's form is filtered through
// beats() BEFORE any realization work — that prunes most templates
// (spec §4.4.3 "filter by the beats-relation first").

import type { Card, Rank, Suit } from './cards';
import { RANKS, SUITS, rankOf, sortCards, suitOf } from './cards';
import type { RuleVariant } from './config';
import type { CanonicalForm, GuandanAction } from './types';
import { beats, sequenceWindow } from './combos';
import type { ComboForm } from './combos';

export interface GeneratedPlay {
  cards: Card[];
  decl: CanonicalForm;
}

// ---------------------------------------------------------------------------
// Hand pools. Wilds are held as a separate pool that may fill ANY non-joker
// slot — including level-rank slots (spec §4.4.3: "pool wilds separately");
// c(r) below always means NATURAL (non-wild) copies.
// ---------------------------------------------------------------------------

interface Pools {
  /** Natural (non-wild, non-joker) cards per rank, deterministically
   *  sorted — realization picks are stable regardless of hand order. */
  byRank: Map<Rank, Card[]>;
  /** Natural copies per (rank,suit) identity, keyed 'RS' — SF feasibility. */
  identity: Map<string, number>;
  wilds: number;
  sj: number;
  bj: number;
}

function buildPools(hand: readonly Card[], level: Rank): Pools {
  const pools: Pools = { byRank: new Map(), identity: new Map(), wilds: 0, sj: 0, bj: 0 };
  const wild: Card = `${level}H`;
  for (const card of hand) {
    if (card === 'SJ') pools.sj++;
    else if (card === 'BJ') pools.bj++;
    else if (card === wild) pools.wilds++; // spec §4.1: the wild IS ♥level
    else {
      const rank = rankOf(card)!;
      const list = pools.byRank.get(rank);
      if (list) list.push(card);
      else pools.byRank.set(rank, [card]);
      pools.identity.set(card, (pools.identity.get(card) ?? 0) + 1);
    }
  }
  for (const list of pools.byRank.values()) list.sort();
  return pools;
}

function countOf(pools: Pools, rank: Rank): number {
  return pools.byRank.get(rank)?.length ?? 0;
}

/** First `n` natural copies of `rank` (caller guarantees n ≤ c(rank);
 *  n = 0 for ranks with no naturals — e.g. an all-wild level single). */
function takeNaturals(pools: Pools, rank: Rank, n: number): Card[] {
  if (n <= 0) return [];
  return pools.byRank.get(rank)!.slice(0, n);
}

/** Candidate window tops per sequence type — the top rank fully identifies
 *  the window (spec §4.4.3: straights 10 windows A-low..10-A, tubes 12,
 *  plates 13; A counts at both ends, no wrap). */
const STRAIGHT_TOPS: readonly Rank[] = RANKS.slice(3); // '5'..'A'
const TUBE_TOPS: readonly Rank[] = RANKS.slice(1); // '3'..'A'
const PLATE_TOPS: readonly Rank[] = RANKS; // '2'..'A'

// ---------------------------------------------------------------------------
// legalPlays — Problem G.
// ---------------------------------------------------------------------------

export function legalPlays(
  hand: Card[],
  toBeat: CanonicalForm | null,
  level: Rank,
  config: RuleVariant,
): GeneratedPlay[] {
  const pools = buildPools(hand, level);
  const w = pools.wilds;
  const wild: Card = `${level}H`;
  const out: GeneratedPlay[] = [];

  // beats-filter first (spec §4.4.3) — leading (toBeat=null) admits all.
  const passes = (form: CanonicalForm): boolean =>
    toBeat === null || beats(form, toBeat, level, config);
  const emit = (cards: Card[], decl: CanonicalForm): void => {
    out.push({ cards, decl });
  };

  // ---- Rank groups: singles / pairs / triples / bombs (spec §4.4.3) ----
  // For each rank r and needed size k: feasible iff max(0, k − c(r)) ≤ w.
  // A play may use any SUB-multiset of the copies held — c(K)=3 yields the
  // triple, the pair, AND the single — so k runs over every size, not just
  // the maximum. Bomb caps need no special code (spec §9.14): only 8
  // naturals of a rank exist (6 for the level rank — two of its copies ARE
  // the wilds), so counts alone cap bombs at 10 / level-rank bombs at 8.
  for (const rank of RANKS) {
    const c = countOf(pools, rank);
    const maxSize = Math.min(10, c + w);
    for (let k = 1; k <= maxSize; k++) {
      if (k <= 2 && c === 0 && rank !== level && !config.allowWildUnderDeclare) {
        // §4.2: an ALL-wild single/pair is deterministically the level
        // rank; declaring it as any other rank is under-declaration,
        // disallowed by default. (k=3 all-wild is impossible: 3 > 2 wilds.)
        continue;
      }
      const decl: ComboForm =
        k === 1
          ? { type: 'single', size: 1, keyRank: rank }
          : k === 2
            ? { type: 'pair', size: 2, keyRank: rank }
            : k === 3
              ? { type: 'triple', size: 3, keyRank: rank }
              : { type: 'bomb', size: k, keyRank: rank };
      if (!passes(decl)) continue;
      // Wild-frugal realization: naturals first, wilds only for the deficit.
      const naturals = takeNaturals(pools, rank, Math.min(k, c));
      const cards = naturals.concat(new Array<Card>(Math.max(0, k - c)).fill(wild));
      emit(cards, decl);
    }
  }

  // ---- Joker singles/pairs (spec §2.2: SJ+SJ / BJ+BJ only; w_r = 0 —
  // wilds never represent jokers, §4.1). keyRank 'A' + jokerRank extra is
  // the combos.ts convention for joker-keyed forms. ----
  for (const jr of ['SJ', 'BJ'] as const) {
    const held = jr === 'SJ' ? pools.sj : pools.bj;
    if (held >= 1) {
      const decl: ComboForm = { type: 'single', size: 1, keyRank: 'A', jokerRank: jr };
      if (passes(decl)) emit([jr], decl);
    }
    if (held >= 2) {
      const decl: ComboForm = { type: 'pair', size: 2, keyRank: 'A', jokerRank: jr };
      if (passes(decl)) emit([jr, jr], decl);
    }
  }

  // ---- Joker bomb: iff the hand holds all four jokers (spec §4.4.3;
  // wilds never contribute, §4.1). ----
  if (pools.sj >= 2 && pools.bj >= 2) {
    const decl: ComboForm = { type: 'jokerBomb', size: 4, keyRank: 'A' };
    if (passes(decl)) emit(['SJ', 'SJ', 'BJ', 'BJ'], decl);
  }

  // ---- Full houses (spec §4.4.3): triple rank t, pair rank p ≠ t,
  // feasible iff max(0,3−c(t)) + max(0,2−c(p)) ≤ w. The canonical form
  // carries ONLY t (the pair never compares, §3 row 4), so all pair
  // choices collapse to one projection — emit one realization per t. ----
  for (const t of RANKS) {
    const tripleDeficit = Math.max(0, 3 - countOf(pools, t));
    if (tripleDeficit > w) continue;
    const decl: ComboForm = { type: 'fullHouse', size: 5, keyRank: t };
    if (!passes(decl)) continue;
    const pairCards = chooseFullHousePair(pools, t, w - tripleDeficit, wild, config);
    if (pairCards === null) continue;
    const cards = takeNaturals(pools, t, Math.min(3, countOf(pools, t)))
      .concat(new Array<Card>(tripleDeficit).fill(wild))
      .concat(pairCards);
    emit(cards, decl);
  }

  // ---- Straights: 10 windows, need 1 per rank, wild-fill deficit ≤ w. ----
  for (const top of STRAIGHT_TOPS) {
    const window = sequenceWindow(top, 5)!;
    let deficit = 0;
    for (const rank of window) if (countOf(pools, rank) === 0) deficit++;
    if (deficit > w) continue;
    const decl: ComboForm = { type: 'straight', size: 5, keyRank: top };
    if (!passes(decl)) continue;
    const cards = realizeStraight(pools, window, deficit, wild, config);
    // null = §3.8 forced case (every realization would be natural-all-one-
    // suit): the set is inherently a straight flush and may not be under-
    // declared — only the SF form (emitted below) exists for this window.
    if (cards !== null) emit(cards, decl);
  }

  // ---- Straight flushes: 10 windows × 4 suits over (rank,suit)
  // IDENTITIES; wilds fill missing identities, incl. the level rank's own
  // heart slot (spec §9.13 — every physical ♥level IS a wild, so a hearts
  // window through the level rank always wild-fills that slot, and that
  // wild plays AS ITSELF, §4.1/§9.11). Dedupe by the suit-blind projection:
  // one emission per window (spec §4.4.3). ----
  for (const top of STRAIGHT_TOPS) {
    const window = sequenceWindow(top, 5)!;
    let best: { decl: ComboForm; suit: Suit; need: number; demoted: boolean } | null = null;
    for (const suit of SUITS) {
      let need = 0;
      for (const rank of window) {
        if ((pools.identity.get(`${rank}${suit}`) ?? 0) === 0) need++;
      }
      if (need > w) continue;
      // §3.7 demotion bookkeeping mirrors combos.validateStraightFlush: the
      // hearts-window level slot is wild-as-itself, not substitution.
      const naturalSlotWild = suit === 'H' && window.includes(level);
      const demoted = !config.wildStraightFlushIsBomb && need - (naturalSlotWild ? 1 : 0) > 0;
      const decl: ComboForm = demoted
        ? { type: 'straightFlush', size: 5, keyRank: top, suit, demoted: true }
        : { type: 'straightFlush', size: 5, keyRank: top, suit };
      if (!passes(decl)) continue;
      // Pick per window: bomb status first (a demoted SF beats only like a
      // plain straight — strictly weaker, spec §3.7 variant), then wild-
      // frugal, then SUITS order for determinism. Under the default config
      // demoted never occurs and this is pure wild-frugality.
      if (
        best === null ||
        (best.demoted && !demoted) ||
        (best.demoted === demoted && need < best.need)
      ) {
        best = { decl, suit, need, demoted };
      }
    }
    if (best !== null) {
      const { suit, decl } = best;
      const cards: Card[] = window.map((rank) => {
        const id = `${rank}${suit}` as Card;
        return (pools.identity.get(id) ?? 0) > 0 ? id : wild;
      });
      emit(cards, decl);
    }
  }

  // ---- Tubes (12 windows × need 2) and plates (13 windows × need 3),
  // spec §4.4.3. No jokers ever (spec §2.2); all-wild sets impossible
  // (6 cards > 2 wilds), so no §4.2-style guard is needed. ----
  const sequenceGroups: { type: 'tube' | 'plate'; tops: readonly Rank[]; length: number; copies: number }[] = [
    { type: 'tube', tops: TUBE_TOPS, length: 3, copies: 2 },
    { type: 'plate', tops: PLATE_TOPS, length: 2, copies: 3 },
  ];
  for (const group of sequenceGroups) {
    for (const top of group.tops) {
      const window = sequenceWindow(top, group.length)!;
      let deficit = 0;
      for (const rank of window) deficit += Math.max(0, group.copies - countOf(pools, rank));
      if (deficit > w) continue;
      const decl: ComboForm = { type: group.type, size: 6, keyRank: top };
      if (!passes(decl)) continue;
      const cards: Card[] = [];
      for (const rank of window) {
        const use = Math.min(group.copies, countOf(pools, rank));
        cards.push(...takeNaturals(pools, rank, use));
        for (let i = use; i < group.copies; i++) cards.push(wild);
      }
      emit(cards, decl);
    }
  }

  return out;
}

/** Full-house pair realization for triple rank `t`, given `wRem` wilds left
 *  after the triple's deficit. Preference order (wild-frugal, then joker-
 *  thrifty): natural rank pair → joker pair (0 wilds but spends jokers;
 *  §3.5, config-gated, requires c ≥ 2 OUTRIGHT — wilds never complete a
 *  joker pair, §4.1) → one-wild pair → two leftover wilds standing as a
 *  pair of some other rank (always valid per combos.validateFullHouse).
 *  Returns null when no pair exists — then no full house of t exists. */
function chooseFullHousePair(
  pools: Pools,
  t: Rank,
  wRem: number,
  wild: Card,
  config: RuleVariant,
): Card[] | null {
  for (const p of RANKS) {
    if (p !== t && countOf(pools, p) >= 2) return takeNaturals(pools, p, 2);
  }
  if (config.fullHouseJokerPair) {
    if (pools.sj >= 2) return ['SJ', 'SJ'];
    if (pools.bj >= 2) return ['BJ', 'BJ'];
  }
  if (wRem >= 1) {
    for (const p of RANKS) {
      if (p !== t && countOf(pools, p) === 1) return [...takeNaturals(pools, p, 1), wild];
    }
  }
  if (wRem >= 2) return [wild, wild];
  return null;
}

/** Concrete cards for a plain-straight window, honoring the owner-extended
 *  §3.8 guard (spec v1.4 / R4c): a realization's NATURAL cards must not be
 *  all one suit under the default allowUnderDeclareStraightFlush=false —
 *  such a selection is inherently a straight flush and must be declared as
 *  one, and wilds do NOT open an off-suit escape. The generator's predicate
 *  (docs/research/wild-disambiguation.md §4.4): emit straight-V iff the
 *  hand's in-window naturals span ≥ 2 suits — then some mixed-suit
 *  realization exists (swap in any off-suit copy); a singleton suit-union
 *  forces one-suit naturals in EVERY realization, so we return null and
 *  only the SF form of the window survives (never orphaned, §1.3 lemma).
 *  The check applies to BOTH the deficit-0 and deficit≥1 paths — wild-fill
 *  never mixes the naturals. */
function realizeStraight(
  pools: Pools,
  window: readonly Rank[],
  deficit: number,
  wild: Card,
  config: RuleVariant,
): Card[] | null {
  const picks: Card[] = [];
  for (const rank of window) {
    if (countOf(pools, rank) > 0) picks.push(takeNaturals(pools, rank, 1)[0]!);
  }
  if (!config.allowUnderDeclareStraightFlush) {
    const pickedSuits = new Set(picks.map((card) => suitOf(card)));
    if (pickedSuits.size === 1) {
      // Default picks are one-suit; look for ANY alternative identity of a
      // different suit to swap in.
      const suit = suitOf(picks[0]!);
      let swapped = false;
      for (let i = 0; i < picks.length && !swapped; i++) {
        for (const alt of pools.byRank.get(rankOf(picks[i]!)!)!) {
          if (suitOf(alt) !== suit) {
            picks[i] = alt;
            swapped = true;
            break;
          }
        }
      }
      // No natural off-suit copy anywhere in the window pool ⇒ the suit
      // union is a singleton ⇒ every realization would have one-suit
      // naturals and be rejected by validateStraight (v1.4). Spending a
      // wild on an off-suit identity is exactly the laundering R4c forbids
      // — suppress the form instead (only the SF emission remains).
      if (!swapped) return null;
    }
  }
  for (let i = 0; i < deficit; i++) picks.push(wild);
  return picks;
}

// ---------------------------------------------------------------------------
// Action wrappers.
// ---------------------------------------------------------------------------

/** Legal GuandanActions for the playing phase. `mustLead` = this seat holds
 *  the lead: passing is illegal (spec §5.2), so 'pass' is appended only for
 *  followers (spec §5.3 — passing is always allowed when not leading, even
 *  if able to beat). */
export function legalActionsFor(
  hand: Card[],
  toBeat: CanonicalForm | null,
  mustLead: boolean,
  level: Rank,
  config: RuleVariant,
): GuandanAction[] {
  const actions: GuandanAction[] = legalPlays(hand, toBeat, level, config).map((play) => ({
    type: 'play',
    cards: play.cards,
    decl: play.decl,
  }));
  if (!mustLead) actions.push({ type: 'pass' });
  return actions;
}

/** Timeout/disconnect fallback (game.ts defaultAction contract): pass when
 *  allowed; when leading (pass illegal, spec §5.2) play the LOWEST legal
 *  single by levelValue — guaranteed to exist because any held card is a
 *  legal single lead. toBeat is unused: mustLead implies no top play. */
export function defaultPlayAction(
  hand: Card[],
  _toBeat: CanonicalForm | null,
  mustLead: boolean,
  level: Rank,
  _config: RuleVariant,
): GuandanAction {
  if (!mustLead) return { type: 'pass' };
  // sortCards orders by levelValue (wilds sit at the level slot, jokers on
  // top), so index 0 is the lowest single.
  const card = sortCards(hand, level)[0];
  if (card === undefined) return { type: 'pass' }; // defensive: a leader always holds cards
  const decl: ComboForm =
    card === 'SJ' || card === 'BJ'
      ? { type: 'single', size: 1, keyRank: 'A', jokerRank: card }
      : card === `${level}H`
        ? // §4.2: a standalone wild IS a level card.
          { type: 'single', size: 1, keyRank: level }
        : { type: 'single', size: 1, keyRank: rankOf(card)! };
  return { type: 'play', cards: [card], decl };
}
