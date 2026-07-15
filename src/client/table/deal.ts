// The physical deal's PURE decisions (item 4) — extracted so the DOM-free
// client suite pins the schedule, the budget and the depletion tiers while
// the WAAPI choreography (DealOverlay.tsx) stays a thin renderer of these
// numbers. Research-pinned spine: 36ms stagger per card, 320ms flight,
// strict 4-seat round-robin → 108 cards land in 36×107+320 ≈ 4.2s, inside
// the ≤4.5s budget the 90s per-seat planning window absorbs (>95% intact).
// The deal is CLIENT-ONLY presentation over an already-received view: the
// server armed the deadlines at the state transition and is never asked to
// wait; skipping is purely local.

export const DEAL_STAGGER_MS = 36;
export const DEAL_FLIGHT_MS = 320;
export const DECK_SIZE = 108;
export const HAND_SIZE = 27;
/** The marker fly-in beat after the last landing (hand 1). */
export const MARKER_FLY_MS = 500;

/** Total deal duration — the stated budget pin (≤ 4.5s). */
export function dealDurationMs(cards: number = DECK_SIZE): number {
  if (cards <= 0) return 0;
  return (cards - 1) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS;
}

export interface DealTick {
  /** Flight start, ms from the deal's t0. */
  delayMs: number;
  /** Ring direction the card flies to. 'south' is the viewer. */
  target: 'south' | 'east' | 'north' | 'west';
  /** For south (own) cards: the sorted-fan slot revealed on landing
   *  (0-based, left to right in DISPLAY order); null for remote cards.
   *  NOTE the arrival order of one's own cards is NOT derivable from the
   *  view (the deck order is hidden info — by design), so the fan reveals
   *  its SORTED slots left-to-right, one per own tick: "auto-arrange as
   *  they land", never a claim about true deck order. */
  ownSlot: number | null;
}

/** The full 108-tick schedule: round-robin south→east→north→west (the ring's
 *  turn direction as displayed), one card per seat per 4 ticks. */
export function dealSchedule(): DealTick[] {
  const order: DealTick['target'][] = ['south', 'east', 'north', 'west'];
  const out: DealTick[] = [];
  let ownLanded = 0;
  for (let i = 0; i < DECK_SIZE; i++) {
    const target = order[i % 4]!;
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
