// Pure, React-free table helpers (M3 table UI). Everything here is a plain
// function over engine types so tests/unit/client/table.test.ts exercises
// selection→hint matching, grouping/sorting and seat math with no DOM.
//
// Engine imports are type-only or pure functions (cards.ts, combos.ts
// classifyPlays, config.ts constants) — client-legal per PLAN.md §2's
// dependency rule (same precedent as RulePicker.tsx).

import {
  isJoker,
  isWild,
  rankOf,
  sortCards,
  suitOf,
  type Card,
  type Rank,
  type Suit,
} from '../../engine/guandan/cards';
import type { Seat } from '../../engine/core/game';
import { classifyPlays, sequenceWindow, type JokerRank } from '../../engine/guandan/combos';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../engine/guandan/config';
import type {
  CanonicalForm,
  ComboType,
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

/** One meaningful-distinct interpretation of the current selection: the
 *  concrete cards to submit plus the declared form (the server validates
 *  cards ⊨ decl). `playable` = the form appears among the server's hints,
 *  i.e. it beats the table (or leads); unplayable readings are still
 *  surfaced so the chooser can present the FULL offered set (spec v1.4
 *  disambiguation) — picking one submits and the server rejects it with a
 *  localized error, exactly as a raw-protocol client would experience. */
export interface PlayMatch {
  cards: Card[];
  decl: CanonicalForm;
  playable: boolean;
}

/** Suit-blind identity of a canonical form: (type, size, keyRank) plus the
 *  jokerRank / demoted extras. The SF suit is deliberately EXCLUDED — the
 *  generator emits one suit per window, and an equivalent selection in a
 *  different suit realizes the same form (the decl is re-anchored to the
 *  selection's own classification). demoted stays IN: a demoted SF beats
 *  strictly less (spec §3.7), so it is a different form for hint purposes. */
export function formProjectionKey(decl: CanonicalForm): string {
  const d = decl as CanonicalForm & { jokerRank?: string; demoted?: boolean };
  return [d.type, d.size, d.keyRank, d.jokerRank ?? '', d.demoted === true ? 'D' : ''].join('|');
}

/** The rule variant the engine-side classifier needs. room.config is opaque
 *  to the room layer (PLAN §4) — coerce it defensively over the owner
 *  defaults (same degradation contract as RulePicker.picksFromConfig).
 *  A wrong value can never enable an illegal play: matches are still
 *  intersected with the SERVER's hints, which were generated under the
 *  true config. */
export function asRuleVariant(config: unknown): RuleVariant {
  if (typeof config !== 'object' || config === null) return JIANGSU_OFFICIAL_ONLINE;
  return { ...JIANGSU_OFFICIAL_ONLINE, ...(config as Partial<RuleVariant>) };
}

/**
 * The selection's FULL meaningful-distinct offered set (spec v1.4 wild
 * disambiguation), with playability against the seat's hints.
 *
 * Hints carry ONE wild-frugal concrete realization per canonical form
 * (generate.ts), so exact-cards comparison is not enough: any selection
 * that VALIDATES as a hinted form is that form (PLAN §3 obligation 4) —
 * 4♦ is the hinted single of 4s realized as 4♠, 9♥9♦ is the hinted pair
 * of 9s realized as 9♠9♥, and natural+wild realizes the pair the hint
 * spelled with two naturals. Implementation: classify the selection with
 * the ENGINE's own classifyPlays (which runs validatePlay, so matching can
 * never disagree with server validation — the v1.4 one-suit-naturals
 * straight suppression and §4.2's wild under-declaration guard come for
 * free) and mark each form `playable` iff a hint shares its suit-blind
 * projection. The decl sent is the SELECTION's classified form — for a
 * straight flush that re-anchors the suit to the selection's own.
 *
 * Returns one entry per DISTINCT decl, in classifyPlays's strength order
 * (strongest first, R5 — the SF end-position pair larger-on-top). Zero
 * playable entries = not playable; exactly one reading = play it; ≥2
 * readings = the wild-ambiguity case — the UI shows the decl chooser over
 * the whole list.
 */
export function matchSelection(
  selection: readonly Card[],
  hints: readonly GuandanAction[],
  level: Rank,
  config: RuleVariant = JIANGSU_OFFICIAL_ONLINE,
): PlayMatch[] {
  if (selection.length === 0) return [];
  const selectionForms = classifyPlays([...selection], level, config);
  if (selectionForms.length === 0) return [];

  const hinted = new Set<string>();
  for (const hint of hints) {
    if (hint.type === 'play' && hint.decl !== undefined) hinted.add(formProjectionKey(hint.decl));
  }
  // classifyPlays emits one form per projection (suit collapse, R1), so
  // iterating the already-strength-ordered forms yields one entry per
  // distinct decl with no extra dedupe.
  return selectionForms.map((decl) => ({
    cards: [...selection],
    decl,
    playable: hinted.has(formProjectionKey(decl)),
  }));
}

// ---------------------------------------------------------------------------
// Wild-chooser card-face derivation (M4 item A,
// docs/research/wild-chooser-ux.md §1). The engine never materializes a
// wild assignment (combos.ts validates by multiset inclusion), but a
// validated decl pins its REQUIRED multiset exactly — ranks for suit-blind
// types, (rank,suit) identities for straight flushes — and the deficit
// between that multiset and the selection's naturals IS the wilds'
// assignment. Render-only: the submitted action stays {cards, decl},
// server-re-validated, so a derivation bug can never corrupt a play.
// ---------------------------------------------------------------------------

export interface WildSubstitution {
  /** The physical wild card, e.g. '2H' at level 2. */
  wild: Card;
  becomesRank: Rank;
  /** Present iff decl.type === 'straightFlush' — the suit is determined
   *  there and only there (R1); suit-blind targets are rank-only (§2.5). */
  becomesSuit: Suit | null;
  /** true = the wild plays as itself (level-rank slot / R4a / the
   *  full-house free pair) — no arrow chip rendered. */
  asSelf: boolean;
}

export interface ResolvedFace {
  /** Physical card occupying this slot ('2H' even when displayed as a 9). */
  card: Card;
  /** null only for jokers (they have no rank; the face renders the card). */
  displayRank: Rank | null;
  /** null ⇒ suit-blind ghost face (no suit glyph); set for naturals, SF
   *  targets and wilds-as-themselves. */
  displaySuit: Suit | null;
  /** true ⇒ this slot is wild-backed (drives the 配 corner marker). */
  viaWild: boolean;
}

/** The decl's required rank multiset in DISPLAY order (window ascending ×
 *  copies; full house triple-then-pair; keyRank × size otherwise), or null
 *  for the full-house free pair (R3: the pair rank never compares — the
 *  wilds play as themselves). A full house's joker pair covers the pair
 *  part, so only the triple's slots remain. Suit-blind types only — SF is
 *  identity-based. PRE: validatePlay accepted (cards, decl). */
function requiredRankSlots(
  cards: readonly Card[],
  decl: CanonicalForm,
  level: Rank,
): Rank[] | null {
  switch (decl.type) {
    case 'straight':
    case 'tube':
    case 'plate': {
      const copies = decl.type === 'straight' ? 1 : decl.type === 'tube' ? 2 : 3;
      const window = sequenceWindow(decl.keyRank, decl.size / copies) ?? [];
      const slots: Rank[] = [];
      for (const rank of window) {
        for (let i = 0; i < copies; i++) slots.push(rank);
      }
      return slots;
    }
    case 'fullHouse': {
      const triple: Rank[] = [decl.keyRank, decl.keyRank, decl.keyRank];
      if (cards.some((c) => isJoker(c))) return triple;
      let keyCount = 0;
      let otherRank: Rank | null = null;
      for (const card of cards) {
        if (isWild(card, level)) continue;
        const rank = rankOf(card)!;
        if (rank === decl.keyRank) keyCount++;
        else otherRank = rank;
      }
      if (otherRank !== null) return [...triple, otherRank, otherRank];
      // All naturals are keyRank. >3 ⇒ the five-of-kind variant shape: the
      // pair rank IS keyRank; exactly 3 ⇒ the wilds are the free pair.
      if (keyCount > 3) return [...triple, decl.keyRank, decl.keyRank];
      return null;
    }
    default:
      // single / pair / triple / bomb: keyRank × size (joker-keyed forms
      // never contain wilds, so callers return [] before reaching here).
      return Array.from({ length: decl.size }, () => decl.keyRank);
  }
}

/**
 * Per-wild target of a validated (cards, decl) reading — required multiset
 * minus naturals, each level-rank slot consumed as wild-plays-as-itself
 * (mirroring the engine's §9.11 non-demotion arithmetic). Entries follow
 * the required multiset's display order.
 */
export function wildSubstitutions(
  cards: readonly Card[],
  decl: CanonicalForm,
  level: Rank,
): WildSubstitution[] {
  const wild = `${level}H` as Card;
  const wildCount = cards.filter((c) => isWild(c, level)).length;
  // Wilds never join a joker bomb (spec §3 row 10).
  if (wildCount === 0 || decl.type === 'jokerBomb') return [];

  if (decl.type === 'straightFlush') {
    const suit = decl.suit!;
    const window = sequenceWindow(decl.keyRank, decl.size) ?? [];
    const naturalIds = new Set(cards.filter((c) => !isWild(c, level)));
    return window
      .filter((rank) => !naturalIds.has(`${rank}${suit}` as Card))
      .map((rank) => ({
        wild,
        becomesRank: rank,
        becomesSuit: suit,
        // The (level,H) identity slot is the wild's own card (§9.11).
        asSelf: suit === 'H' && rank === level,
      }));
  }

  const slots = requiredRankSlots(cards, decl, level);
  if (slots === null) {
    // Full-house free pair: the wilds ARE a real pair of level hearts.
    return Array.from({ length: wildCount }, () => ({
      wild,
      becomesRank: level,
      becomesSuit: null,
      asSelf: true,
    }));
  }
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    if (isWild(card, level) || isJoker(card)) continue;
    const rank = rankOf(card)!;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const deficit: Rank[] = [];
  for (const rank of slots) {
    const left = counts.get(rank) ?? 0;
    if (left > 0) counts.set(rank, left - 1);
    else deficit.push(rank);
  }
  return deficit.map((rank) => ({
    wild,
    becomesRank: rank,
    becomesSuit: null,
    asSelf: rank === level,
  }));
}

/** Header chips: non-asSelf substitutions collapsed by identical target —
 *  the common two-wild case renders ONE chip with a ×2 badge (§2.4). */
export interface SubstitutionChip {
  wild: Card;
  becomesRank: Rank;
  becomesSuit: Suit | null;
  count: number;
}

export function substitutionChips(subs: readonly WildSubstitution[]): SubstitutionChip[] {
  const chips: SubstitutionChip[] = [];
  for (const sub of subs) {
    if (sub.asSelf) continue;
    const existing = chips.find(
      (c) => c.becomesRank === sub.becomesRank && c.becomesSuit === sub.becomesSuit,
    );
    if (existing !== undefined) existing.count++;
    else chips.push({ wild: sub.wild, becomesRank: sub.becomesRank, becomesSuit: sub.becomesSuit, count: 1 });
  }
  return chips;
}

/**
 * The post-substitution combo, one face per selected card (length ===
 * decl.size): naturals as themselves, wilds at their assigned identity
 * (wilds-as-themselves as the physical wild face). Display order pins
 * (§1.4): sequence types ascending window order, fullHouse triple-then-
 * pair, everything else in the engine's sortCards order.
 */
export function resolveComboFaces(
  cards: readonly Card[],
  decl: CanonicalForm,
  level: Rank,
): ResolvedFace[] {
  const wildCard = `${level}H` as Card;
  const naturalFace = (card: Card): ResolvedFace => ({
    card,
    displayRank: rankOf(card),
    displaySuit: suitOf(card),
    viaWild: false,
  });
  // A wild-backed slot at its own identity (level rank; suit-blind or the
  // hearts SF slot) displays the physical wild face.
  const wildFace = (rank: Rank, suit: Suit | null): ResolvedFace =>
    rank === level && (suit === null || suit === 'H')
      ? { card: wildCard, displayRank: level, displaySuit: 'H', viaWild: true }
      : { card: wildCard, displayRank: rank, displaySuit: suit, viaWild: true };

  switch (decl.type) {
    case 'straightFlush': {
      const suit = decl.suit!;
      const window = sequenceWindow(decl.keyRank, decl.size) ?? [];
      const naturalIds = new Set(cards.filter((c) => !isWild(c, level)));
      return window.map((rank) => {
        const id = `${rank}${suit}` as Card;
        return naturalIds.has(id) ? naturalFace(id) : wildFace(rank, suit);
      });
    }
    case 'straight':
    case 'tube':
    case 'plate': {
      const copies = decl.type === 'straight' ? 1 : decl.type === 'tube' ? 2 : 3;
      const window = sequenceWindow(decl.keyRank, decl.size / copies) ?? [];
      const byRank = new Map<Rank, Card[]>();
      for (const card of sortCards(cards, level)) {
        if (isWild(card, level)) continue;
        const rank = rankOf(card)!;
        byRank.set(rank, [...(byRank.get(rank) ?? []), card]);
      }
      const faces: ResolvedFace[] = [];
      for (const rank of window) {
        const have = byRank.get(rank) ?? [];
        for (let i = 0; i < copies; i++) {
          faces.push(i < have.length ? naturalFace(have[i]!) : wildFace(rank, null));
        }
      }
      return faces;
    }
    case 'fullHouse': {
      const naturals = sortCards(
        cards.filter((c) => !isWild(c, level) && !isJoker(c)),
        level,
      );
      const jokers = cards.filter((c) => isJoker(c));
      const wilds = cards.filter((c) => isWild(c, level));
      const keyNaturals = naturals.filter((c) => rankOf(c) === decl.keyRank);
      const otherNaturals = naturals.filter((c) => rankOf(c) !== decl.keyRank);
      const faces: ResolvedFace[] = [];
      // Triple: keyRank naturals (≤3), wilds fill the deficit.
      const tripleNaturals = keyNaturals.slice(0, 3);
      for (const card of tripleNaturals) faces.push(naturalFace(card));
      for (let i = tripleNaturals.length; i < 3; i++) faces.push(wildFace(decl.keyRank, null));
      // Pair: the jokers, or the other rank (wild-completed), or the
      // surplus keyRank cards (five-of-kind variant), or the free wild
      // pair (R3 — the wilds as themselves).
      if (jokers.length === 2) {
        for (const card of jokers) faces.push(naturalFace(card));
      } else if (otherNaturals.length > 0) {
        const pairRank = rankOf(otherNaturals[0]!)!;
        for (const card of otherNaturals) faces.push(naturalFace(card));
        for (let i = otherNaturals.length; i < 2; i++) faces.push(wildFace(pairRank, null));
      } else if (keyNaturals.length > 3) {
        const surplus = keyNaturals.slice(3);
        for (const card of surplus) faces.push(naturalFace(card));
        for (let i = surplus.length; i < 2; i++) faces.push(wildFace(decl.keyRank, null));
      } else {
        // Free pair — exactly the two wilds, both as themselves.
        for (let i = 0; i < wilds.length; i++) faces.push(wildFace(level, null));
      }
      return faces;
    }
    default:
      // single / pair / triple / bomb / jokerBomb: sortCards order.
      return sortCards(cards, level).map((card) =>
        isWild(card, level) ? wildFace(decl.keyRank, null) : naturalFace(card),
      );
  }
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

/** The hand-1 draw-ceremony overlay is up (and the countdown behind it is
 *  dimmed, room-timing.md §4) iff a ceremony payload exists, the viewer has
 *  not yet dismissed it, we are on the very first hand, and the match is not
 *  already decided. Extracted pure so all four gating conditions are
 *  unit-pinned — this predicate drives BOTH the ceremony overlay and the
 *  dimTimer cosmetic, so a regression here (overlay on hand 2, or lingering
 *  past match end) is a visible bug, not just a cosmetic one. */
export function isCeremonyShowing(args: {
  hasCeremony: boolean;
  ceremonyDone: boolean;
  handNo: number;
  matchWinner: 0 | 1 | null;
}): boolean {
  return args.hasCeremony && !args.ceremonyDone && args.handNo === 1 && args.matchWinner === null;
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

/** Same mapping as {@link comboKey}, keyed on the bare combo type — lets a
 *  caller that only has (type, keyRank) apart (e.g. a folded feed line's
 *  SEMANTIC record, resolved at render time — GameTable/EventFeed, m1 fix)
 *  look up the translation key without reconstructing a full CanonicalForm. */
export function comboKeyForType(type: ComboType): TranslationKey {
  return COMBO_KEYS[type];
}

export function comboKey(decl: CanonicalForm): TranslationKey {
  return comboKeyForType(decl.type);
}

/** Reads the FROZEN-TYPES jokerRank extra (combos.ts's ComboFormExtras,
 *  see the note there) off a decl that is only structurally typed as the
 *  sealed CanonicalForm. This is the one cast site for it on the label
 *  path (mirrors formProjectionKey's identical cast above) — a joker-keyed
 *  single/pair carries keyRank 'A' as a never-compared placeholder (same
 *  convention as jokerBomb) with jokerRank as the REAL identity, so any
 *  label built from keyRank alone is wrong for these two forms (the M4 "單
 *  張 A" bug). Undefined for every other decl, including jokerBomb, which
 *  has no ambiguity to resolve (comboKey alone names it). */
export function declJokerRank(decl: CanonicalForm): JokerRank | undefined {
  return (decl as CanonicalForm & { jokerRank?: JokerRank }).jokerRank;
}

/** Run description for a straight-flush decl ("A–5♠", "5–9♥"): the chooser
 *  labels SF readings with their full window so the end-position pair
 *  (larger-on-top) is unmistakable. Locale-free — rank glyphs and suit
 *  symbols only. Null for every other type (they read fine as combo name +
 *  key rank). */
export function declRunText(decl: CanonicalForm): string | null {
  if (decl.type !== 'straightFlush') return null;
  const window = sequenceWindow(decl.keyRank, decl.size);
  if (window === null) return null;
  const run = `${rankText(window[0]!)}–${rankText(window[window.length - 1]!)}`;
  return decl.suit === undefined ? run : `${run}${suitGlyph(decl.suit)}`;
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

// Rejection-code → human copy moved to src/client/errors.ts (describeError),
// the single user-facing error mapper shared by the lobby banner and the
// in-table toast (pre-M5 F3).

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
