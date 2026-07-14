// Pure, React-free table helpers (M3 table UI). Everything here is a plain
// function over engine types so tests/unit/client/table.test.ts exercises
// selection→hint matching, grouping/sorting and seat math with no DOM.
//
// Engine imports are type-only or pure functions (cards.ts) — client-legal
// per PLAN.md §2's dependency rule (same precedent as RulePicker.tsx).

import { isJoker, isWild, rankOf, suitOf, type Card, type Rank, type Suit } from '../../engine/guandan/cards';
import type { Seat } from '../../engine/core/game';
import type {
  CanonicalForm,
  GuandanAction,
  GuandanEvent,
  GuandanView,
} from '../../engine/guandan/types';
import type { TranslationKey } from '../i18n';

// ---------------------------------------------------------------------------
// Multiset & rank-projection keys.
// ---------------------------------------------------------------------------

/** Order-insensitive identity key of a card multiset. */
export function multisetKey(cards: readonly Card[]): string {
  return [...cards].sort().join(',');
}

export function sameMultiset(a: readonly Card[], b: readonly Card[]): boolean {
  return a.length === b.length && multisetKey(a) === multisetKey(b);
}

/** Suit-blind projection: jokers and wilds keep their identity (a wild can
 *  never be swapped for a natural of the same rank — it fills a different
 *  slot), naturals collapse to their rank. Two card sets with equal rank
 *  keys are interchangeable realizations of every non-suited canonical
 *  form (engine validates plays by multiset inclusion, PLAN §3 ob. 4). */
export function rankKey(cards: readonly Card[], level: Rank): string {
  return cards
    .map((card) => (isJoker(card) ? card : isWild(card, level) ? 'W' : rankOf(card)!))
    .sort()
    .join(',');
}

/** Stable identity of a declared canonical form (decl objects may carry
 *  extra generator fields like jokerRank — keep them, sorted). */
export function declSignature(decl: CanonicalForm): string {
  const entries = Object.entries(decl as unknown as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(entries);
}

// ---------------------------------------------------------------------------
// Selection → hint matching (ActionBar's enabling rule).
// ---------------------------------------------------------------------------

/** A playable interpretation of the current selection: the concrete cards
 *  to submit plus the declared form (the server validates cards ⊨ decl). */
export interface PlayMatch {
  cards: Card[];
  decl: CanonicalForm;
}

/**
 * Match the selected cards against the seat's play hints.
 *
 * Primary rule: the selection's multiset equals some hint's cards. Hints
 * carry ONE concrete realization per canonical form (generate.ts), so a
 * fallback admits rank-equivalent realizations of the same form — holding
 * 9♠9♥9♦, any two of them are the pair of 9s (PLAN §3 obligation 4). For a
 * straight flush the declared suit is recomputed from the selection; a
 * fully-natural one-suit selection is never matched to a plain straight
 * (spec §3.8 — such a set must be declared as the straight flush).
 *
 * Returns one entry per DISTINCT decl. Length 0 = not playable; 1 = play
 * it; ≥2 = the wild-ambiguity case — the UI shows a decl chooser.
 */
export function matchSelection(
  selection: readonly Card[],
  hints: readonly GuandanAction[],
  level: Rank,
): PlayMatch[] {
  if (selection.length === 0) return [];
  const selKey = multisetKey(selection);
  const selRanks = rankKey(selection, level);
  const naturals = selection.filter((card) => !isJoker(card) && !isWild(card, level));
  const naturalSuits = new Set<Suit>(naturals.map((card) => suitOf(card)!));
  const fullyNaturalOneSuit = naturals.length === selection.length && naturalSuits.size === 1;

  const out: PlayMatch[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    if (hint.type !== 'play' || hint.decl === undefined) continue;
    let decl: CanonicalForm | null = null;
    if (multisetKey(hint.cards) === selKey) {
      decl = hint.decl;
    } else if (rankKey(hint.cards, level) === selRanks) {
      if (hint.decl.type === 'straightFlush') {
        // The generator emitted one suit per window; re-anchor the declared
        // suit to the selection's own (all naturals must share it).
        decl =
          naturals.length > 0 && naturalSuits.size === 1
            ? { ...hint.decl, suit: [...naturalSuits][0]! }
            : null;
      } else if (hint.decl.type === 'straight' && fullyNaturalOneSuit) {
        decl = null; // §3.8: inherently a straight flush, not under-declarable
      } else {
        decl = hint.decl;
      }
    }
    if (decl === null) continue;
    const sig = declSignature(decl);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ cards: [...selection], decl });
  }
  return out;
}

/** Whether a pass hint exists (spec §5.2: never when leading). */
export function canPass(hints: readonly GuandanAction[]): boolean {
  return hints.some((hint) => hint.type === 'pass');
}

/** The tribute-phase confirm kind, if this seat's hints are tribute
 *  choices; null in every other phase. */
export function tributeKind(
  hints: readonly GuandanAction[],
): 'payTribute' | 'returnTribute' | null {
  for (const hint of hints) {
    if (hint.type === 'payTribute' || hint.type === 'returnTribute') return hint.type;
  }
  return null;
}

/** The exact eligible card set surfaced by tribute/return hints — these
 *  glow in-hand (PLAN §5 hints power concrete-card highlighting). */
export function tributeEligibleCards(hints: readonly GuandanAction[]): ReadonlySet<Card> {
  const cards = new Set<Card>();
  for (const hint of hints) {
    if (hint.type === 'payTribute' || hint.type === 'returnTribute') cards.add(hint.card);
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Hand grouping (fan rows) & seat geometry.
// ---------------------------------------------------------------------------

/** Split an (already sorted) hand into at most two balanced fan rows so a
 *  27-card hand never overflows a 375px phone (design system: the fan
 *  wraps to ≤2 rows rather than overflowing). */
export function handRows(cards: readonly Card[], maxPerRow: number): Card[][] {
  if (cards.length === 0) return [];
  if (cards.length <= maxPerRow) return [[...cards]];
  const first = Math.ceil(cards.length / 2);
  return [cards.slice(0, first), cards.slice(first)];
}

/** Table rotation: the viewer's active seat always sits south. */
export interface SeatLayout {
  south: Seat;
  east: Seat;
  north: Seat;
  west: Seat;
}

export function seatLayout(viewer: Seat): SeatLayout {
  return {
    south: viewer,
    east: ((viewer + 1) % 4) as Seat,
    north: ((viewer + 2) % 4) as Seat,
    west: ((viewer + 3) % 4) as Seat,
  };
}

/** 1-based finish place of a seat, or null while still playing. */
export function placeOf(finishOrder: readonly Seat[], seat: Seat): number | null {
  const i = finishOrder.indexOf(seat);
  return i < 0 ? null : i + 1;
}

/** Seats currently expected to act, derived from the view (the cinnabar
 *  active-turn ring). antiTributeDecision exposes no pending set in the
 *  view — callers union in the deadline seats for that phase. */
export function activeSeats(view: GuandanView): Seat[] {
  switch (view.phase) {
    case 'playing':
      return view.trick === null ? [] : [view.trick.toAct];
    case 'tribute':
      return view.tribute === null
        ? []
        : view.tribute.payers.filter((seat) => !view.tribute!.committed.includes(seat));
    case 'returnTribute':
      return view.tribute === null
        ? []
        : view.tribute.receivers.filter((seat) => !view.tribute!.committed.includes(seat));
    default:
      return [];
  }
}

/** Whole seconds left until a server-clock deadline (skew is cosmetic —
 *  the DO alarm is what actually enforces it, protocol.ts). */
export function remainingSeconds(dueAt: number, now: number): number {
  return Math.max(0, Math.ceil((dueAt - now) / 1000));
}

// ---------------------------------------------------------------------------
// Display projections (locale-free — components pass keys through t()).
// ---------------------------------------------------------------------------

/** Card-index text: 'T' renders as the two-digit 10; every other rank is
 *  its own glyph (A/K/Q/J are card-face characters, not prose). */
export function rankText(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}

const SUIT_GLYPHS: Record<Suit, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPHS[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

const COMBO_KEYS: Record<CanonicalForm['type'], TranslationKey> = {
  single: 'game.combo.single',
  pair: 'game.combo.pair',
  triple: 'game.combo.triple',
  fullHouse: 'game.combo.fullHouse',
  straight: 'game.combo.straight',
  tube: 'game.combo.tube',
  plate: 'game.combo.plate',
  bomb: 'game.combo.bomb',
  straightFlush: 'game.combo.straightFlush',
  jokerBomb: 'game.combo.jokerBomb',
};

export function comboKey(decl: CanonicalForm): TranslationKey {
  return COMBO_KEYS[decl.type];
}

const PLACE_KEYS: Record<number, TranslationKey> = {
  1: 'game.place.1',
  2: 'game.place.2',
  3: 'game.place.3',
  4: 'game.place.4',
};

export function placeKey(place: number): TranslationKey | null {
  return PLACE_KEYS[place] ?? null;
}

/** Semantic rejection codes with a dedicated localized line; everything
 *  else falls back to game.error.unknown with the raw code as a param. */
const ERROR_KEYS: Record<string, TranslationKey> = {
  'action.notYourTurn': 'game.error.notYourTurn',
  'action.wrongPhase': 'game.error.wrongPhase',
  'play.cannotPassLeading': 'game.error.cannotPassLeading',
  'play.cardsNotInHand': 'game.error.cardsNotInHand',
  'play.declRequired': 'game.error.declRequired',
  'play.invalidCombination': 'game.error.invalidCombination',
  'play.cannotBeatTop': 'game.error.cannotBeatTop',
  'tribute.cardNotEligible': 'game.error.tributeCardNotEligible',
  'tribute.cardNotInHand': 'game.error.cardsNotInHand',
  'match.ended': 'game.error.matchEnded',
};

export function errorKeyFor(code: string): TranslationKey {
  return ERROR_KEYS[code] ?? 'game.error.unknown';
}

// ---------------------------------------------------------------------------
// Loose-cast guards for the opaque wire payloads.
// ---------------------------------------------------------------------------

/** Structural sniff of a GuandanView. The server is trusted (it IS our
 *  engine's redacted view); this only rejects a non-Guandan/absent payload
 *  so a bad message renders as "waiting" instead of crashing. */
export function asGuandanView(view: unknown): GuandanView | null {
  if (typeof view !== 'object' || view === null) return null;
  const v = view as GuandanView;
  return typeof v.phase === 'string' && Array.isArray(v.hand) && Array.isArray(v.levels)
    ? v
    : null;
}

export function asGuandanEvents(batch: readonly unknown[] | null): GuandanEvent[] {
  if (batch === null) return [];
  return batch.filter(
    (e): e is GuandanEvent =>
      typeof e === 'object' && e !== null && typeof (e as GuandanEvent).type === 'string',
  );
}

export type Ceremony = NonNullable<Extract<GuandanEvent, { type: 'handStarted' }>['ceremony']>;
