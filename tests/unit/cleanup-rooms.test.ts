// Pure-helper tests for scripts/cleanup-rooms.ts (the §4 cleanup CLI). The
// token-gated purge ROUTE integration is covered by retention.e2e.test.ts; here
// we pin the informational rows-written cost estimate.

import { describe, expect, it } from 'vitest';
import { estimatedPurgeRows, fmtAge } from '../../scripts/cleanup-rooms';

const dump = (over: Partial<Record<'events' | 'actions' | 'actionsSeen' | 'deadlines' | 'seats', number>>) =>
  ({
    events: Array(over.events ?? 0).fill(0),
    actions: Array(over.actions ?? 0).fill(0),
    actionsSeen: Array(over.actionsSeen ?? 0).fill(0),
    deadlines: Array(over.deadlines ?? 0).fill(0),
    seats: Array(over.seats ?? 0).fill(0),
  }) as unknown as Parameters<typeof estimatedPurgeRows>[0];

describe('estimatedPurgeRows — rows-written cost of a per-row deleteAll()', () => {
  it('an empty (just-created) room costs only the fixed singletons', () => {
    // snapshot + room + hello_state = 3.
    expect(estimatedPurgeRows(dump({}))).toBe(3);
  });

  it('counts actions_seen DOUBLE (its TEXT-PK auto-index is billed too)', () => {
    // 100 events + 100 actions + 2×100 seen + 1 deadline + 4 seats + 3
    expect(estimatedPurgeRows(dump({ events: 100, actions: 100, actionsSeen: 100, deadlines: 1, seats: 4 }))).toBe(
      100 + 100 + 200 + 1 + 4 + 3,
    );
  });

  it('scales with match length (a full match ≈ thousands of rows)', () => {
    const big = estimatedPurgeRows(dump({ events: 1500, actions: 1500, actionsSeen: 1500, deadlines: 2, seats: 4 }));
    expect(big).toBeGreaterThan(4000);
  });
});

describe('fmtAge', () => {
  it('null → n/a', () => {
    expect(fmtAge(null)).toBe('n/a');
  });
  it('renders a coarse relative age', () => {
    expect(fmtAge(Date.now() - 5_000)).toMatch(/s ago$/);
    expect(fmtAge(Date.now() - 10 * 60_000)).toMatch(/m ago$/);
    expect(fmtAge(Date.now() - 3 * 3_600_000)).toMatch(/h ago$/);
  });
});
