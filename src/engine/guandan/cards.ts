// Card model and the TWO orderings (spec docs/rules/guandan.md §0/§2).
// Keeping levelValue and naturalValue as separate named functions is
// deliberate: mixing them up is the classic Guandan engine bug. levelValue
// governs singles/pairs/triples/full-house triples/bomb ranks; naturalValue
// governs ONLY positions inside straights / straight flushes / tubes /
// plates, where the level card sits at its natural spot and A may be low.

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['S', 'H', 'C', 'D'] as const;
export type Suit = (typeof SUITS)[number];

/** 'AS' = ace of spades, 'TH' = ten of hearts. Jokers carry no suit.
 *  Two full decks: every non-joker identity exists exactly twice. */
export type Card = `${Rank}${Suit}` | 'SJ' | 'BJ';

export function isJoker(card: Card): card is 'SJ' | 'BJ' {
  return card === 'SJ' || card === 'BJ';
}

/** Rank of a non-joker card; null for jokers. */
export function rankOf(card: Card): Rank | null {
  return isJoker(card) ? null : (card[0] as Rank);
}

/** Suit of a non-joker card; null for jokers. */
export function suitOf(card: Card): Suit | null {
  return isJoker(card) ? null : (card[1] as Suit);
}

/** The wild (逢人配) is exactly the heart of the current level rank —
 *  two physical copies per match state (spec §4.1). */
export function isWild(card: Card, level: Rank): boolean {
  return card === `${level}H`;
}

/** Natural sequence position, 2..14. A-low (=1) is a property of the
 *  sequence window, not of the card — window logic handles it. */
export function naturalValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}

/** Non-sequence comparison value (spec §0): natural 2..14, but the current
 *  level rank is elevated above A; jokers on top. */
export function levelValue(card: Card, level: Rank): number {
  if (card === 'SJ') return 16;
  if (card === 'BJ') return 17;
  const rank = card[0] as Rank;
  return rank === level ? 15 : naturalValue(rank);
}

/** levelValue for a bare rank (tribute math, bomb-rank comparison). */
export function rankLevelValue(rank: Rank, level: Rank): number {
  return rank === level ? 15 : naturalValue(rank);
}

/** The full 108-card double deck, in a fixed canonical order (shuffling is
 *  the caller's job — determinism lives in the PRNG, not here). */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const rank of RANKS) {
      for (const suit of SUITS) deck.push(`${rank}${suit}` as Card);
    }
    deck.push('SJ', 'BJ');
  }
  return deck;
}

/** Count cards per rank (jokers under 'SJ'/'BJ' keys), with wilds counted
 *  separately when a level is given — the generator treats wilds as a pool
 *  that can fill any non-joker slot (spec §4.4.3). */
export interface HandCounts {
  /** Natural (non-wild) copies per rank. */
  byRank: Partial<Record<Rank, number>>;
  /** Natural (non-wild) copies per (rank,suit) identity, keyed 'RS'. */
  byIdentity: Partial<Record<string, number>>;
  sj: number;
  bj: number;
  /** Wild cards held (hearts of the level rank). */
  wilds: number;
}

export function countHand(cards: readonly Card[], level: Rank): HandCounts {
  const counts: HandCounts = { byRank: {}, byIdentity: {}, sj: 0, bj: 0, wilds: 0 };
  for (const card of cards) {
    if (card === 'SJ') counts.sj++;
    else if (card === 'BJ') counts.bj++;
    else if (isWild(card, level)) counts.wilds++;
    else {
      const rank = card[0] as Rank;
      counts.byRank[rank] = (counts.byRank[rank] ?? 0) + 1;
      counts.byIdentity[card] = (counts.byIdentity[card] ?? 0) + 1;
    }
  }
  return counts;
}

/** Remove an exact multiset of cards; returns null if any card is missing.
 *  Used both for validating a play against a hand and for applying it. */
export function removeCards(hand: readonly Card[], cards: readonly Card[]): Card[] | null {
  const remaining = hand.slice();
  for (const card of cards) {
    const i = remaining.indexOf(card);
    if (i < 0) return null;
    remaining.splice(i, 1);
  }
  return remaining;
}

/** Stable display/sort order for hands and logs: by levelValue, then rank
 *  index, then suit — purely cosmetic, never rules-significant. */
export function sortCards(cards: readonly Card[], level: Rank): Card[] {
  return cards.slice().sort((x, y) => {
    const lv = levelValue(x, level) - levelValue(y, level);
    if (lv !== 0) return lv;
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
