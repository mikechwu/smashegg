// The physical deal's PURE decisions (item 4 + obs 2) — extracted so the
// DOM-free client suite pins the schedule, the budget and the depletion tiers
// while the WAAPI choreography (DealOverlay.tsx) stays a thin renderer of
// these numbers. Research-pinned spine: 36ms stagger per card, 320ms flight,
// strict 4-seat round-robin → 108 cards land in 36×107+320 ≈ 4.2s, inside the
// ≤4.5s budget the 90s per-seat planning window absorbs (>95% intact).
// The deal is CLIENT-ONLY presentation over an already-received view: the
// server armed the deadlines at the state transition and is never asked to
// wait; skipping is purely local.

export const DEAL_STAGGER_MS = 36;
export const DEAL_FLIGHT_MS = 320;
export const DECK_SIZE = 108;
export const HAND_SIZE = 27;
/** The marker card's own flight duration when it flies face-up at its true
 *  deal beat (obs 2). It STARTS mid-deal (at its beat), so it overlaps the
 *  round-robin and never extends the choreography — see dealChoreographyMs. */
export const MARKER_FLY_MS = 500;
/** The settle beat after the last card lands, before the fan takes over. */
export const FINISH_SETTLE_MS = 150;

export type DealDir = 'south' | 'east' | 'north' | 'west';

/** The ring's four directions in DISPLAY turn order (south = viewer, then the
 *  default counterclockwise nextSeat = seat+1 around the ring — see
 *  seatLayout/nextSeat). The clockwise-config table would reverse this; the
 *  client has always assumed the default here (as does the marker→seat
 *  mapping), so obs 2 keeps that assumption rather than widening scope. */
const RING_CYCLE: DealDir[] = ['south', 'east', 'north', 'west'];

/** Total deal duration — the last card lands at this time (the landings
 *  budget pin, ≤ 4.5s). */
export function dealDurationMs(cards: number = DECK_SIZE): number {
  if (cards <= 0) return 0;
  return (cards - 1) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS;
}

/** The FULL hand-1 choreography, end to end (obs 2 re-derivation). The marker
 *  now flies AT its true beat (markerDealBeat) rather than as a tail after the
 *  deal, so it finishes at markerBeat×stagger + MARKER_FLY_MS — comfortably
 *  before the last landing — and the honest total is just the landings plus a
 *  settle. The old design's landings + MARKER_FLY + 200 tail is gone; the
 *  choreography got SHORTER and more faithful. */
export function dealChoreographyMs(cards: number = DECK_SIZE): number {
  return dealDurationMs(cards) + FINISH_SETTLE_MS;
}

/** The marker card's true deal beat (0-indexed) — obs 2. The marker is the
 *  counted (last) flip, and the engine deals the SAME rotated deck round-robin
 *  from firstDrawer, so the marker card lands at deal index flips.length − 1
 *  (engine runCutRitual/completeCeremonyCut). This is derived purely from the
 *  already-public `flips` array in handStarted.ceremony — NO new server field,
 *  no new redaction surface. */
export function markerDealBeat(flipsLength: number): number {
  return Math.max(0, flipsLength - 1);
}

/** The four ring directions in DEAL order, starting from the first drawer's
 *  direction (obs 2). firstDrawer is public (handStarted.ceremony), so dealing
 *  in true seat order leaks nothing and matches the physical table: everyone
 *  watches the cards go firstDrawer → CCW and sees the marker land at its true
 *  beat. Only which SEAT gets each successive card is ordered here; which CARD
 *  a hidden seat receives, and in what order within its hand, stays redacted. */
export function dealDirOrder(firstDrawerDir: DealDir): DealDir[] {
  const start = RING_CYCLE.indexOf(firstDrawerDir);
  return RING_CYCLE.map((_, k) => RING_CYCLE[(start + k) % 4]!);
}

export interface DealTick {
  /** Flight start, ms from the deal's t0. */
  delayMs: number;
  /** Ring direction the card flies to. 'south' is the viewer. */
  target: DealDir;
  /** For south (own) cards: the sorted-fan slot revealed on landing (0-based,
   *  left to right in DISPLAY order); null for remote cards. NOTE the arrival
   *  order of one's own cards is NOT derivable from the view (the deck order
   *  is hidden — by design), so the fan reveals its SORTED slots left-to-right,
   *  one per own tick: "auto-arrange as they land", never a claim about true
   *  deck order. */
  ownSlot: number | null;
}

/** The full 108-tick schedule, round-robin over `dirOrder` (one card per seat
 *  per 4 ticks). Defaults to the south-first display order (hands 2+, which
 *  have no ceremony); hand 1 passes dealDirOrder(firstDrawerDir) so the marker
 *  lands at its true beat (obs 2). South fills its sorted slots in the order
 *  it is dealt, whatever the starting seat. */
export function dealSchedule(dirOrder: DealDir[] = RING_CYCLE): DealTick[] {
  const out: DealTick[] = [];
  let ownLanded = 0;
  for (let i = 0; i < DECK_SIZE; i++) {
    const target = dirOrder[i % 4]!;
    out.push({
      delayMs: i * DEAL_STAGGER_MS,
      target,
      ownSlot: target === 'south' ? ownLanded++ : null,
    });
  }
  return out;
}

/** Deck depletion tier (3=full … 0=nearly empty): box-shadow slab counts
 *  cannot interpolate, so the pile thins in 4 discrete steps synced to the
 *  deal clock — that IS the depletion animation (research recipe). */
export function deckDepthTier(remaining: number): 0 | 1 | 2 | 3 {
  if (remaining >= 82) return 3;
  if (remaining >= 55) return 2;
  if (remaining >= 28) return 1;
  return 0;
}
