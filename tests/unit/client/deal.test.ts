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
  type DealDir,
  dealChoreographyMs,
  dealDirOrder,
  dealDurationMs,
  dealSchedule,
  deckDepthTier,
  markerDealBeat,
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

describe('markerDealBeat (obs 2)', () => {
  it('is flips.length - 1 (the counted flip is the last-dealt-first card)', () => {
    expect(markerDealBeat(1)).toBe(0);
    expect(markerDealBeat(2)).toBe(1);
    expect(markerDealBeat(5)).toBe(4);
    expect(markerDealBeat(13)).toBe(12);
  });

  it('never goes negative for a defensive empty flips list', () => {
    expect(markerDealBeat(0)).toBe(0);
  });

  it('the marker beat lands at the leader in a first-drawer-first schedule, EITHER direction', () => {
    // For every first drawer, every plausible flips length, and BOTH turn
    // directions, the tick at the marker beat targets the seat (flips.length-1)
    // steps in that direction from the drawer — exactly the engine's markerSeat
    // = stepSeats(firstDrawer, (L-1)%4, config). Under clockwise the step is +3
    // in the display cycle (the engine's seat+3); pinning both closes the
    // Codex catch that a fixed-CCW client flew the marker to the wrong seat.
    for (const cw of [false, true]) {
      const step = cw ? 3 : 1;
      for (const start of DIRS) {
        const order = dealDirOrder(start, cw);
        const schedule = dealSchedule(order);
        const startIdx = DIRS.indexOf(start);
        for (let L = 1; L <= 13; L++) {
          const beat = markerDealBeat(L);
          const expected = DIRS[(startIdx + ((L - 1) % 4) * step) % 4];
          expect(schedule[beat]!.target).toBe(expected);
        }
      }
    }
  });
});

describe('deal budget (item 4 + obs 2, honestly re-derived)', () => {
  it('card landings ≤ 4.5s (the 90s planning window absorbs them)', () => {
    expect(dealDurationMs()).toBe((DECK_SIZE - 1) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS);
    expect(dealDurationMs()).toBeLessThanOrEqual(4_500);
  });

  it('the FULL choreography is now just landings + a settle — the marker no longer tails it', () => {
    // Obs 2 moved the marker fly INTO the deal (at markerDealBeat), so the
    // choreography ends at the last landing plus a settle, NOT landings +
    // MARKER_FLY + 200 as before. It got shorter; pin the honest number.
    expect(dealChoreographyMs()).toBe(dealDurationMs() + FINISH_SETTLE_MS);
    expect(dealChoreographyMs()).toBeLessThanOrEqual(4_500);
  });

  it('the marker flight overlaps the deal and never extends it (worst-case beat)', () => {
    // Even the deepest realistic marker beat (a double deck allows ≤12
    // re-flips, so flips.length ≤ 13) finishes well before the last landing.
    const worstBeat = markerDealBeat(13);
    expect(worstBeat * DEAL_STAGGER_MS + MARKER_FLY_MS).toBeLessThan(dealDurationMs());
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
