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
 *  deal beat — the one beat the whole ceremony builds to (owner: slower than
 *  the 2× window alone), so it floats while the backs snap. It starts
 *  mid-deal at its beat; for DEEP cuts its landing can now outlast the last
 *  back's, which dealDurationMs accounts for honestly. */
export const MARKER_FLY_MS = 900;
/** The 2× slow window around the marker's beat (owner: "it's the moment the
 *  ceremony exists for, and it should read"): this many consecutive ticks —
 *  starting 2 before the marker's — get DOUBLE stagger, then the deal resumes
 *  normal speed. Total added time = MARKER_SLOW_TICKS × DEAL_STAGGER_MS. */
export const MARKER_SLOW_TICKS = 6;
/** The settle beat after the last card lands, before the fan takes over. */
export const FINISH_SETTLE_MS = 150;
/** Obs 3: the ONE sort beat — after the deal completes, the fan re-lays from
 *  arrival (deal) order into sorted order and every card FLIP-slides to its
 *  slot. A single reflow, not 27 chained inserts. HandFan owns the animation;
 *  this constant keeps the honest end-to-end budget in one place. */
export const SORT_BEAT_MS = 420;

export type DealDir = 'south' | 'east' | 'north' | 'west';

/** The ring's four directions in DISPLAY seat order (south = viewer, then
 *  seat+1, +2, +3 around the ring — see seatLayout). This is the seat INDEX
 *  order, not a turn direction: dealDirOrder walks it forward (CCW nextSeat =
 *  seat+1) or backward (clockwise nextSeat = seat+3) to match the engine. */
const RING_CYCLE: DealDir[] = ['south', 'east', 'north', 'west'];

/** The 2× slow ticks that actually apply for a marker at `markerBeat`: the
 *  window starts 2 ticks before the beat and clips at the deck's end (the
 *  one-card form can put the marker near index 107). null = no marker. */
export function markerSlowTicks(markerBeat: number | null, cards: number = DECK_SIZE): number {
  if (markerBeat === null) return 0;
  const slowStart = Math.max(0, markerBeat - 2);
  return Math.max(0, Math.min(slowStart + MARKER_SLOW_TICKS, cards) - slowStart);
}

/** The marker tick's start delay: its base stagger plus the slow-window
 *  ticks at or before it (the window opens 2 ticks earlier, so an interior
 *  beat carries 3 slow ticks by its own start). */
export function markerDelayMs(markerBeat: number, cards: number = DECK_SIZE): number {
  const slowStart = Math.max(0, markerBeat - 2);
  const slowAtOrBefore = Math.max(0, Math.min(markerBeat - slowStart + 1, MARKER_SLOW_TICKS));
  void cards;
  return markerBeat * DEAL_STAGGER_MS + slowAtOrBefore * DEAL_STAGGER_MS;
}

/** Total deal duration — EVERY card has landed by this time, the slow
 *  window and the marker's own (slower, 900ms) flight included: a deep cut's
 *  marker can outlast the final back, so the honest number is the max of the
 *  two (the panel caught a stale budget once; never again). Hands 2+
 *  (markerBeat null) are the plain landings. */
export function dealDurationMs(cards: number = DECK_SIZE, markerBeat: number | null = null): number {
  if (cards <= 0) return 0;
  const backs =
    (cards - 1) * DEAL_STAGGER_MS + markerSlowTicks(markerBeat, cards) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS;
  if (markerBeat === null) return backs;
  return Math.max(backs, markerDelayMs(markerBeat, cards) + MARKER_FLY_MS);
}

/** The FULL choreography, end to end. The marker flies AT its true beat
 *  (mid-deal) inside the slow window, so the honest total is the landings
 *  plus a settle. */
export function dealChoreographyMs(cards: number = DECK_SIZE, markerBeat: number | null = null): number {
  return dealDurationMs(cards, markerBeat) + FINISH_SETTLE_MS;
}

/** The FULL obs-3 experience: the deal choreography plus the one sort beat
 *  that follows it (the sort starts at dealChoreographyMs, when the overlay
 *  hands off to the fan). Pinned honestly — the sort is a real added beat, not
 *  free — and still inside the 90s planning window. */
export function dealWithSortMs(cards: number = DECK_SIZE, markerBeat: number | null = null): number {
  return dealChoreographyMs(cards, markerBeat) + SORT_BEAT_MS;
}

/** The marker's deal beat comes STRAIGHT from the public ceremony payload
 *  (handStarted.ceremony.markerDealIndex — the marker's deck index, which IS
 *  its 0-indexed deal beat over the unrotated deck). The old derivation
 *  `flips.length − 1` was the 2026-07-15 DEFECT: it pinned the marker to the
 *  first drawer and made the ceremony deterministic ~89% of the time. This
 *  clamp is purely defensive against a malformed payload. */
export function markerDealBeat(markerDealIndex: number): number {
  return Math.max(0, Math.min(DECK_SIZE - 1, Math.floor(markerDealIndex)));
}

/** The four ring directions in DEAL order, starting from the first drawer and
 *  walking the ring in the CONFIGURED turn direction (obs 2). firstDrawer is
 *  public (handStarted.ceremony), so dealing in true seat order leaks nothing
 *  and matches the physical table. `clockwise` mirrors the engine's nextSeat
 *  (CCW = seat+1, clockwise = seat+3 ≡ seat−1), so the marker's beat lands at
 *  the ENGINE's markerSeat under either config — not just the CCW default
 *  (Codex panel catch). Only which SEAT gets each successive card is ordered
 *  here; which CARD a hidden seat receives stays redacted. */
export function dealDirOrder(firstDrawerDir: DealDir, clockwise = false): DealDir[] {
  const start = RING_CYCLE.indexOf(firstDrawerDir);
  const step = clockwise ? 3 : 1;
  return RING_CYCLE.map((_, k) => RING_CYCLE[(start + k * step) % 4]!);
}

export interface DealTick {
  /** Flight start, ms from the deal's t0. */
  delayMs: number;
  /** Ring direction the card flies to. 'south' is the viewer. */
  target: DealDir;
  /** For south (own) cards: the display slot uncovered on landing (0-based,
   *  left to right); null for remote cards. Obs 3: during the deal the fan is
   *  laid out in ARRIVAL (deal) order, so the j-th own tick uncovers the j-th
   *  arriving card — the REAL order, taken from handStarted.hands (which the
   *  server already delivers per-seat; there is no "unknowable by redaction"
   *  here). One sort beat re-lays the fan when the deal completes. */
  ownSlot: number | null;
}

/** The full 108-tick schedule, round-robin over `dirOrder` (one card per seat
 *  per 4 ticks). Defaults to the south-first display order (hands 2+, which
 *  have no ceremony); hand 1 passes dealDirOrder(firstDrawerDir) so the marker
 *  lands at its true beat. When `markerBeat` is set, the MARKER_SLOW_TICKS
 *  ticks starting 2 before it get DOUBLE stagger (the 2× slow beat the
 *  ceremony exists for), then the deal resumes normal speed — delays stay
 *  strictly monotonic. South fills its slots in the order it is dealt. */
export function dealSchedule(
  dirOrder: DealDir[] = RING_CYCLE,
  markerBeat: number | null = null,
): DealTick[] {
  const slowStart = markerBeat === null ? Infinity : Math.max(0, markerBeat - 2);
  const slowEnd = slowStart + MARKER_SLOW_TICKS; // exclusive
  const out: DealTick[] = [];
  let ownLanded = 0;
  let extraMs = 0;
  for (let i = 0; i < DECK_SIZE; i++) {
    if (i >= slowStart && i < slowEnd) extraMs += DEAL_STAGGER_MS;
    const target = dirOrder[i % 4]!;
    out.push({
      delayMs: i * DEAL_STAGGER_MS + extraMs,
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
