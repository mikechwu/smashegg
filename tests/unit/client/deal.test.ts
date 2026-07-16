// Item 4 + obs 2 ratchet: the physical deal's PURE decisions (deal.ts). The
// WAAPI choreography is a thin renderer of these numbers; the DOM-free suite
// pins the schedule, the deal-from-first-drawer order, the marker's true beat,
// the honestly re-derived budget, and the depletion tiers.

import { describe, expect, it } from 'vitest';
import {
  DEAL_FLIGHT_MS,
  DEAL_STAGGER_MS,
  DECK_SIZE,
  HAND_SIZE,
  FINISH_SETTLE_MS,
  MARKER_FLY_MS,
  MARKER_SLOW_TICKS,
  SORT_BEAT_MS,
  type DealDir,
  dealChoreographyMs,
  dealDirOrder,
  dealDurationMs,
  dealSchedule,
  dealWithSortMs,
  deckDepthTier,
  markerDealBeat,
  markerSlowTicks,
} from '../../../src/client/table/deal';

const DIRS: DealDir[] = ['south', 'east', 'north', 'west'];

describe('dealSchedule (item 4)', () => {
  it('deals all 108 cards, one per seat per round-robin tick (default south-first)', () => {
    const schedule = dealSchedule();
    expect(schedule).toHaveLength(DECK_SIZE);
    schedule.forEach((tick, i) => {
      expect(tick.target).toBe(DIRS[i % 4]);
      expect(tick.delayMs).toBe(i * DEAL_STAGGER_MS);
    });
  });

  it('own (south) cards reveal the 27 sorted slots left-to-right, exactly once each', () => {
    const schedule = dealSchedule();
    const ownSlots = schedule.filter((t) => t.target === 'south').map((t) => t.ownSlot);
    expect(ownSlots).toEqual(Array.from({ length: HAND_SIZE }, (_, k) => k));
    for (const t of schedule) {
      if (t.target !== 'south') expect(t.ownSlot).toBeNull();
    }
  });
});

describe('dealDirOrder + deal-from-first-drawer (obs 2)', () => {
  it('rotates the ring cycle to START at the first drawer, counterclockwise (default)', () => {
    expect(dealDirOrder('south')).toEqual(['south', 'east', 'north', 'west']);
    expect(dealDirOrder('east')).toEqual(['east', 'north', 'west', 'south']);
    expect(dealDirOrder('north')).toEqual(['north', 'west', 'south', 'east']);
    expect(dealDirOrder('west')).toEqual(['west', 'south', 'east', 'north']);
  });

  it('walks the ring BACKWARD under clockwise (matches engine nextSeat seat+3, Codex catch)', () => {
    // Clockwise nextSeat = seat+3 ≡ seat−1, so the seat after the first drawer
    // is the one DISPLAYED one step earlier in the ring cycle.
    expect(dealDirOrder('south', true)).toEqual(['south', 'west', 'north', 'east']);
    expect(dealDirOrder('east', true)).toEqual(['east', 'south', 'west', 'north']);
    expect(dealDirOrder('north', true)).toEqual(['north', 'east', 'south', 'west']);
    expect(dealDirOrder('west', true)).toEqual(['west', 'north', 'east', 'south']);
  });

  it('every dir still receives exactly 27 cards, whoever leads, either direction', () => {
    for (const cw of [false, true]) {
      for (const start of DIRS) {
        const schedule = dealSchedule(dealDirOrder(start, cw));
        for (const dir of DIRS) {
          expect(schedule.filter((t) => t.target === dir)).toHaveLength(HAND_SIZE);
        }
        const ownSlots = schedule.filter((t) => t.target === 'south').map((t) => t.ownSlot);
        expect(ownSlots).toEqual(Array.from({ length: HAND_SIZE }, (_, k) => k));
      }
    }
  });
});

describe('markerDealBeat (ceremony-marker round: the beat IS the payload deck index)', () => {
  it('passes the public markerDealIndex through (with a defensive clamp)', () => {
    // THE DEFECT REGRESSION (client half): the beat comes straight from
    // handStarted.ceremony.markerDealIndex — the marker's deck index — and is
    // NEVER derived from flips.length (the old formula pinned the marker to
    // the first drawer and made the ceremony deterministic ~89% of the time).
    expect(markerDealBeat(0)).toBe(0);
    expect(markerDealBeat(15)).toBe(15);
    expect(markerDealBeat(102)).toBe(102);
    expect(markerDealBeat(107)).toBe(107);
    // Defensive clamp only — malformed payloads, not a semantic.
    expect(markerDealBeat(-3)).toBe(0);
    expect(markerDealBeat(400)).toBe(DECK_SIZE - 1);
  });

  it('the marker beat lands at stepSeats(firstDrawer, beat % 4), EITHER direction', () => {
    // The engine's markerSeat = stepSeats(firstDrawer, markerDealIndex % 4);
    // the schedule must fly the marker to exactly that seat for every beat
    // residue and both turn directions (the earlier Codex catch, re-pinned
    // for the new beat semantics).
    for (const cw of [false, true]) {
      const step = cw ? 3 : 1;
      for (const start of DIRS) {
        const order = dealDirOrder(start, cw);
        const startIdx = DIRS.indexOf(start);
        for (const beat of [6, 15, 54, 87, 102]) {
          const schedule = dealSchedule(order, beat);
          const expected = DIRS[(startIdx + (beat % 4) * step) % 4];
          expect(schedule[beat]!.target).toBe(expected);
        }
      }
    }
  });
});

describe('the 2× marker slow window (owner: the beat should READ)', () => {
  it('exactly MARKER_SLOW_TICKS ticks get double stagger, starting 2 before the beat', () => {
    const beat = 54;
    const plain = dealSchedule(undefined, null);
    const slowed = dealSchedule(undefined, beat);
    for (let i = 0; i < DECK_SIZE; i++) {
      const extra = slowed[i]!.delayMs - plain[i]!.delayMs;
      const slowTicksAtOrBefore = Math.max(0, Math.min(i - (beat - 2) + 1, MARKER_SLOW_TICKS));
      expect(extra, `tick ${i}`).toBe(slowTicksAtOrBefore * DEAL_STAGGER_MS);
    }
    // Delays stay strictly monotonic (the deal never stalls or reorders).
    for (let i = 1; i < DECK_SIZE; i++) {
      expect(slowed[i]!.delayMs).toBeGreaterThan(slowed[i - 1]!.delayMs);
    }
  });

  it('the window clips at the deck end (one-card form can put the marker near 107)', () => {
    expect(markerSlowTicks(54)).toBe(MARKER_SLOW_TICKS);
    expect(markerSlowTicks(107)).toBe(3); // ticks 105,106,107
    expect(markerSlowTicks(null)).toBe(0);
    const slowed = dealSchedule(undefined, 107);
    expect(slowed[DECK_SIZE - 1]!.delayMs).toBe(
      (DECK_SIZE - 1) * DEAL_STAGGER_MS + 3 * DEAL_STAGGER_MS,
    );
  });
});

describe('deal budget (honestly re-derived for the slow window)', () => {
  it('card landings ≤ 4.5s WITH the marker slow window (the 90s window absorbs them)', () => {
    expect(dealDurationMs()).toBe((DECK_SIZE - 1) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS);
    expect(dealDurationMs(DECK_SIZE, 54)).toBe(
      (DECK_SIZE - 1) * DEAL_STAGGER_MS + MARKER_SLOW_TICKS * DEAL_STAGGER_MS + DEAL_FLIGHT_MS,
    );
    expect(dealDurationMs(DECK_SIZE, 54)).toBeLessThanOrEqual(4_500);
  });

  it('the choreography ends at the last landing + a settle (marker overlaps mid-deal)', () => {
    expect(dealChoreographyMs(DECK_SIZE, 54)).toBe(dealDurationMs(DECK_SIZE, 54) + FINISH_SETTLE_MS);
    expect(dealChoreographyMs(DECK_SIZE, 54)).toBeLessThanOrEqual(4_700);
  });

  it('the slower (900ms) marker flight is counted honestly: duration = max(backs, marker landing)', () => {
    // At a TYPICAL cut the marker lands mid-deal and the backs finish last;
    // at the deepest legal cut (102) the marker's floatier flight makes it
    // the FINAL landing — which is exactly the drama the owner asked for —
    // and the duration owns that instead of leaving a stale number.
    const typical = dealSchedule(undefined, 54);
    expect(typical[54]!.delayMs + MARKER_FLY_MS).toBeLessThan(dealDurationMs(DECK_SIZE, 54));
    const deep = dealSchedule(undefined, 102);
    expect(dealDurationMs(DECK_SIZE, 102)).toBe(deep[102]!.delayMs + MARKER_FLY_MS);
    expect(dealDurationMs(DECK_SIZE, 102)).toBeGreaterThan(dealDurationMs(DECK_SIZE, 54));
  });

  it('obs 3 + slow window + 900ms marker: typical ≤ 5s, worst legal cut ≤ 5.5s (honest re-pin)', () => {
    expect(dealWithSortMs(DECK_SIZE, 54)).toBe(dealChoreographyMs(DECK_SIZE, 54) + SORT_BEAT_MS);
    expect(dealWithSortMs(DECK_SIZE, 54)).toBeLessThanOrEqual(5_000);
    // Deepest two-card marker beat = CUT_MAX = 102: the marker IS the last
    // landing, and the honest end-to-end worst case stays within 5.5s —
    // still under 7% of the 90s planning window.
    expect(dealWithSortMs(DECK_SIZE, 102)).toBeLessThanOrEqual(5_500);
  });
});

describe('deckDepthTier (item 4)', () => {
  it('four discrete tiers with pinned boundaries', () => {
    expect(deckDepthTier(108)).toBe(3);
    expect(deckDepthTier(82)).toBe(3);
    expect(deckDepthTier(81)).toBe(2);
    expect(deckDepthTier(55)).toBe(2);
    expect(deckDepthTier(54)).toBe(1);
    expect(deckDepthTier(28)).toBe(1);
    expect(deckDepthTier(27)).toBe(0);
    expect(deckDepthTier(0)).toBe(0);
  });
});
