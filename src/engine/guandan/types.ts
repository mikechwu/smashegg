// Shared Guandan engine types: state S, action A, event E, view V.
// Everything is plain JSON-serializable data (PLAN.md §3 obligation 2).
// Module ownership: combos.ts (validate/beats), generate.ts (legal moves),
// tribute.ts (tribute state machine), levels.ts (scoring/A-attempts/level
// selection), trick.ts (turn rotation), index.ts (GameDefinition glue).

import type { Seat } from '../core/game';
import type { PrngState } from '../core/prng';
import type { Card, Rank, Suit } from './cards';
import type { RuleVariant } from './config';

// ---------------------------------------------------------------------------
// Seats & teams. Turn direction: nextSeat models "the next seat (in turn direction)"; the physical
// clockwise/counterclockwise mapping is presentational, but the config flip
// must invert rotation so seat-order tie rules (spec §7.3) follow it.
// ---------------------------------------------------------------------------

export function teamOf(seat: Seat): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

export function partnerOf(seat: Seat): Seat {
  return (seat + 2) % 4;
}

export function nextSeat(seat: Seat, config: RuleVariant): Seat {
  // Explicitly test for 'clockwise' so the spec default (counterclockwise)
  // is also the STRUCTURAL fallback — a malformed turnDirection can never
  // silently invert rotation (Grok M3 audit F1; init validation is the
  // primary guard, this is defense in depth).
  return config.turnDirection === 'clockwise' ? (seat + 3) % 4 : (seat + 1) % 4;
}

// ---------------------------------------------------------------------------
// Combinations (spec §3). CanonicalForm is the declared interpretation of a
// play: what followers must beat. suit is present ONLY for straight flushes
// (validation needs it; beat-comparison ignores it — spec §2.3/§4.4.3).
// ---------------------------------------------------------------------------

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'fullHouse'
  | 'straight'
  | 'tube'
  | 'plate'
  | 'bomb'
  | 'straightFlush'
  | 'jokerBomb';

export interface CanonicalForm {
  type: ComboType;
  /** Card count — meaningful for bombs (4..10); fixed per type otherwise. */
  size: number;
  /** Comparison key: the rank whose value orders same-type plays. For
   *  sequences it is the TOP rank by naturalValue (A-low straight tops at
   *  '5'; AA2233 tube tops at '3'; AAA222 plate tops at '2'). For a full
   *  house it is the triple's rank. For jokerBomb it is 'A' by convention
   *  (never compared). */
  keyRank: Rank;
  /** Straight flush only: the declared suit. */
  suit?: Suit;
}

export interface Play {
  seat: Seat;
  cards: Card[];
  decl: CanonicalForm;
}

// ---------------------------------------------------------------------------
// Trick state (spec §5). Finished seats are skipped by rotation; the trick
// ends when the turn would return to the top-play owner (spec §9.22).
// ---------------------------------------------------------------------------

export interface TrickState {
  /** Seat that led (or will lead) this trick. */
  leader: Seat;
  /** Seat currently expected to act in the playing phase. */
  toAct: Seat;
  /** Highest play so far; null while waiting for the lead. */
  top: Play | null;
  /** Pending jiefeng: set when the trick winner finished with their winning
   *  final play; the recipient leads the next trick (spec §5.6). */
  jiefengTo: Seat | null;
}

// ---------------------------------------------------------------------------
// Tribute state (spec §7, v1.3 semantics): choices over eligible sets,
// staged commits, atomic reveal, corresponding return pairing.
// ---------------------------------------------------------------------------

export interface TributePairing {
  from: Seat;
  to: Seat;
  card: Card;
}

export interface TributeState {
  kind: 'single' | 'double';
  /** 4th finisher [, 3rd finisher] — who owes tribute. */
  payers: Seat[];
  /** 1st finisher [, 2nd finisher] — who receives. */
  receivers: Seat[];
  /** Committed-but-unrevealed tribute cards (staging: no sequential info
   *  leak; spec §7.3). Keyed by payer seat. */
  staged: Partial<Record<number, Card>>;
  /** Set atomically when all payers have committed: assignment resolved
   *  (higher→1st finisher; ties per equalTributeAssignment). */
  paid: TributePairing[] | null;
  /** Committed-but-unrevealed returns, keyed by receiver seat. */
  returnsStaged: Partial<Record<number, Card>>;
  /** Set atomically when all receivers have returned (corresponding pairing). */
  returned: TributePairing[] | null;
  /** Resolved leader for the hand once known (payer of 1st finisher's card, or 1st finisher
   *  on anti-tribute — spec §7.5/§7.6). */
  leader: Seat | null;
}

// ---------------------------------------------------------------------------
// Match/hand state.
// ---------------------------------------------------------------------------

export type Phase =
  | 'ceremonyCut' // hand 1 under firstLeadMethod='drawCard': the cutter picks WHERE to cut (item 3)
  | 'antiTributeDecision' // only under antiTributeMode='optional'
  | 'tribute'
  | 'returnTribute'
  | 'playing'
  | 'matchEnd';

export interface HandResult {
  finishOrder: Seat[];
  winnerTeam: 0 | 1;
  /** +3 / +2 / +1 (before the A clamp). */
  levelDelta: number;
}

export interface GuandanState {
  config: RuleVariant;
  prng: PrngState;
  handNo: number;
  phase: Phase;
  /** Team levels, index = team. */
  levels: [Rank, Rank];
  /** Failed A-attempts per team (spec §6.4). */
  aAttempts: [number, number];
  /** Suspension flags under aFailConsequence='suspendPlayOpponentLevel'. */
  aAttemptsExhausted: [boolean, boolean];
  /** The level this hand is played at (drives levelValue and the wild). */
  currentLevel: Rank;
  /** Team whose level the hand is played at; null only before hand 1 setup
   *  completes (first hand plays at STARTING_LEVEL). */
  declarerTeam: 0 | 1 | null;
  /** 27 cards each at deal; empties as players finish. */
  hands: [Card[], Card[], Card[], Card[]];
  /** Per-seat "has this seat acted in the CURRENT hand" (item 2): reset to
   *  all-false at every deal; a seat's first applied action — play, pass,
   *  tribute, return, anti-tribute decision alike — flips its flag. Drives
   *  the per-seat planning timing class; deterministic and replayable. */
  actedThisHand: [boolean, boolean, boolean, boolean];
  /** The REAL cut (item 3): non-null exactly while phase === 'ceremonyCut'.
   *  `deck` is the full shuffled 108-card order the deal will consume IN
   *  PLACE (the cut preserves order and only selects the revealed cards —
   *  ceremony-marker round) — HIDDEN INFO OF THE STRONGEST KIND (everyone's
   *  future hands): playerView/viewEvent must NEVER expose it, exactly like
   *  the PRNG state (obligation 3; property-pinned). `cutter` is public.
   *  Re-cut round 2026-07-15: an uncountable flip does NOT walk to the next
   *  countable card (that rule is superseded) — the cutter CUTS AGAIN with a
   *  fresh clock. `attempts` counts applied cuts (drives the default
   *  action's varying position, the AFK termination bound); `flips` is the
   *  PUBLIC flip history across attempts (each attempt reveals exactly one
   *  count-card flip; everyone at the table saw them — a deliberate,
   *  stated redaction exception, resync-visible via view.ceremonyFlips). */
  ceremonyCut: { cutter: Seat; deck: Card[]; attempts: number; flips: Card[] } | null;
  finishOrder: Seat[];
  trick: TrickState | null;
  tribute: TributeState | null;
  /** Previous hand's finish order (tribute obligations); null for hand 1. */
  prevFinishOrder: Seat[] | null;
  /** Pending anti-tribute decision machine (antiTributeMode='optional'
   *  only). Structurally matches tribute.ts's AntiTributeDecisionPending —
   *  kept inline here because types.ts cannot import tribute.ts. */
  antiTributePending: {
    kind: 'decision';
    payers: Seat[];
    decisions: Partial<Record<number, boolean>>;
  } | null;
  /** Whether the first finisher's hand-emptying play was entirely Aces —
   *  only consulted under aceFinishDemotes (spec §6.4). */
  firstFinisherAllAces: boolean | null;
  /** Set when phase === 'matchEnd'. */
  matchWinner: 0 | 1 | null;
}

// ---------------------------------------------------------------------------
// Actions (A). payTribute/returnTribute are choices validated by membership
// in the eligible set (spec §7.2/§7.4). decl is required whenever the
// selected cards admit ≥2 canonical interpretations (spec §4.4.4); when
// omitted and unambiguous, the engine infers it.
// ---------------------------------------------------------------------------

export type GuandanAction =
  | { type: 'play'; cards: Card[]; decl?: CanonicalForm }
  | { type: 'pass' }
  | { type: 'payTribute'; card: Card }
  | { type: 'returnTribute'; card: Card }
  | { type: 'antiTributeDecision'; invoke: boolean }
  /** The REAL cut (item 3): the cutter picks WHERE to split the face-down
   *  deck. Interior positions only — CUT_MIN..CUT_MAX (5-card minimum
   *  packet at each end, per the physical interior-cut rule); a CHOICE
   *  phase, so legalActions returns the exact eligible set. Deterministic
   *  and logged: (seed, position) reproduces flips AND the deal. */
  | { type: 'cutDeck'; position: number };

// ---------------------------------------------------------------------------
// Events (E) — semantic, locale-free, redacted per seat by viewEvent.
// ---------------------------------------------------------------------------

export type GuandanEvent =
  | {
      type: 'handStarted';
      handNo: number;
      currentLevel: Rank;
      declarerTeam: 0 | 1 | null;
      /** True when the level came from the opponents because the declarer
       *  team is A-suspended (owner rule, spec §1.5 refinement). */
      suspensionApplied: boolean;
      /** Full deal — viewEvent redacts to the recipient's own hand. */
      hands: [Card[], Card[], Card[], Card[]];
      /** the draw ceremony (flip-to-lead) opening ceremony (hand 1 under firstLeadMethod='drawCard'
       *  ONLY; owner spec M3, made REAL by item 3, geometry corrected in the
       *  ceremony-marker round 2026-07-15). Deterministic from (seed,
       *  cutPosition), replay-identical — the UI animates EXACTLY this data
       *  and computes nothing. The cut PRESERVES deck order (lift, look at
       *  the split, put back): it selects which cards are revealed and where
       *  the marker sits — who LEADS, never which cards each seat holds.
       *  - cutter: the seat that cut the deck (PRNG-uniform);
       *  - cutPosition: WHERE the cutter chose to cut (the logged action);
       *  - flips: ONE count-card flip per applied cut attempt, in attempt
       *    order (re-cut round 2026-07-15, superseding the walk rule: an
       *    uncountable flip — joker or current-level rank — does NOT walk
       *    to the next card; the cutter CUTS AGAIN, so all but the last
       *    flip came from earlier logged cutDeck actions). Under
       *    ceremonyCardCount=2 each attempt flips the lifted packet's
       *    BOTTOM (deck[position-1]); under =1 the split card itself
       *    (deck[position]). The LAST flip is the counted card. All flips
       *    are real deck cards that land in the dealt hands, publicly
       *    known — the table watched them;
       *  - marker / markerDealIndex: the face-up marker card and its DECK
       *    INDEX (= its 0-indexed deal beat) — always the FINAL cut's
       *    position, in both forms. Under ceremonyCardCount=2 the marker is
       *    the table packet's top (deck[cutPosition], any card — it only
       *    marks who leads; a re-cut re-picks it, one physical act); under
       *    =1 it IS the counted card. The marker is a specific PHYSICAL
       *    INSTANCE identified by position — two decks mean every rank+suit
       *    has a twin, so no copy may name it by rank;
       *  - firstDrawer: counting the counted card's rank IN TURN DIRECTION
       *    with the cutter as position 1 (seatOffset=(value-1)%4);
       *  - markerSeat: stepSeats(firstDrawer, markerDealIndex % 4) — the
       *    seat that REALLY draws the marker in the one-card-at-a-time deal
       *    over the unrotated deck = the hand's leader.
       *  PUBLIC-EXCEPTION note (redaction model): exactly flips ∪ {marker}
       *  are public card instances — deliberately, as at a physical table —
       *  and the other ~106 deck cards stay unreachable. Uniformity, stated
       *  precisely: ABSOLUTE leader uniformity holds (PRNG-uniform cutter);
       *  CONDITIONAL on the cutter it does not — the count offset is skewed
       *  at level 2 (P(offset even)=7/12), so the cut depth's residue class
       *  carries a ≈58%/42% own-team lead edge. Owner decision: documented,
       *  not policed (the physical table has the identical property). */
      ceremony?: {
        cutter: Seat;
        cutPosition: number;
        flips: Card[];
        marker: Card;
        markerDealIndex: number;
        firstDrawer: Seat;
        markerSeat: Seat;
      };
    }
  /** Item 3: hand 1 (drawCard) now OPENS with the cut — emitted by init,
   *  before any deal exists. Public in full: everyone watches one actor. */
  | { type: 'ceremonyCutStarted'; cutter: Seat }
  /** Re-cut round: an applied cut whose count-card flip was UNCOUNTABLE (a
   *  joker or the current-level rank) — the flip is shown to the whole
   *  table and the cutter cuts again with a fresh clock. Public in full. */
  | { type: 'ceremonyCutFlipped'; cutter: Seat; position: number; flip: Card }
  | { type: 'antiTribute'; reveals: { seat: Seat; card: Card }[] }
  | { type: 'tributeCommitted'; seat: Seat } // card-less staging marker
  | { type: 'tributePaid'; pairings: TributePairing[] } // atomic reveal
  | { type: 'tributeReturned'; pairings: TributePairing[] } // atomic reveal
  | { type: 'played'; seat: Seat; cards: Card[]; decl: CanonicalForm }
  | { type: 'passed'; seat: Seat }
  | { type: 'trickWon'; seat: Seat }
  | { type: 'jiefeng'; finisher: Seat; leader: Seat }
  | { type: 'playerFinished'; seat: Seat; place: number } // 1-based
  | {
      type: 'handEnded';
      result: HandResult;
      newLevels: [Rank, Rank];
      aAttempts: [number, number];
      aAttemptsExhausted: [boolean, boolean];
    }
  | { type: 'matchEnded'; winnerTeam: 0 | 1 };

// ---------------------------------------------------------------------------
// Per-seat view (V) — the ONLY game data a client ever sees. Never other
// hands, never the PRNG state (obligation 3).
// ---------------------------------------------------------------------------

export interface GuandanView {
  seat: Seat;
  phase: Phase;
  handNo: number;
  currentLevel: Rank;
  declarerTeam: 0 | 1 | null;
  levels: [Rank, Rank];
  aAttempts: [number, number];
  aAttemptsExhausted: [boolean, boolean];
  hand: Card[];
  /** Remaining-card counts per seat, filtered by cardCountVisibility
   *  (null = hidden from this viewer). */
  cardCounts: [number | null, number | null, number | null, number | null];
  /** Item 3: who is cutting, while phase === 'ceremonyCut' (public — the
   *  whole table watches one actor); null in every other phase. The deck
   *  itself NEVER appears in a view. */
  ceremonyCutter: Seat | null;
  /** Re-cut round: the PUBLIC flip history across cut attempts, while
   *  phase === 'ceremonyCut' (everyone at the table saw each uncountable
   *  flip; a rejoining client must too). These are the ONLY card tokens a
   *  ceremonyCut view may carry — a deliberate, stated redaction exception;
   *  the other ~106 cards stay unreachable. Null outside the phase. */
  ceremonyFlips: Card[] | null;
  finishOrder: Seat[];
  trick: TrickState | null;
  /** Public tribute info only (per tributeVisibility); staged cards of
   *  OTHER seats never appear — own staged card does. */
  tribute: {
    kind: 'single' | 'double';
    payers: Seat[];
    receivers: Seat[];
    committed: Seat[];
    ownStaged: Card | null;
    paid: TributePairing[] | null;
    returned: TributePairing[] | null;
  } | null;
  matchWinner: 0 | 1 | null;
}
