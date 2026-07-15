// Item 4 ratchet: the physical deal's PURE decisions (deal.ts). The WAAPI
// choreography is a thin renderer of these numbers; the DOM-free suite pins
// the schedule, the stated ≤4.5s budget, and the depletion tiers.

import { describe, expect, it } from 'vitest';
import {
  DEAL_FLIGHT_MS,
  DEAL_STAGGER_MS,
  DECK_SIZE,
  HAND_SIZE,
  dealDurationMs,
  dealSchedule,
  deckDepthTier,
} from '../../../src/client/table/deal';

describe('dealSchedule (item 4)', () => {
  const schedule = dealSchedule();

  it('deals all 108 cards, one per seat per round-robin tick', () => {
    expect(schedule).toHaveLength(DECK_SIZE);
    const order = ['south', 'east', 'north', 'west'] as const;
    schedule.forEach((tick, i) => {
      expect(tick.target).toBe(order[i % 4]);
      expect(tick.delayMs).toBe(i * DEAL_STAGGER_MS);
    });
  });

  it('own (south) cards reveal the 27 sorted slots left-to-right, exactly once each', () => {
    const ownSlots = schedule.filter((t) => t.target === 'south').map((t) => t.ownSlot);
    expect(ownSlots).toEqual(Array.from({ length: HAND_SIZE }, (_, k) => k));
    for (const t of schedule) {
      if (t.target !== 'south') expect(t.ownSlot).toBeNull();
    }
  });

  it('the STATED budget pin: the full deal lands in ≤ 4.5s (planning window absorbs it)', () => {
    expect(dealDurationMs()).toBe((DECK_SIZE - 1) * DEAL_STAGGER_MS + DEAL_FLIGHT_MS);
    expect(dealDurationMs()).toBeLessThanOrEqual(4_500);
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
