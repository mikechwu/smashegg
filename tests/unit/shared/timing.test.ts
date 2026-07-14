// Unit tests for the room-timing vocabulary (src/shared/timing.ts, M4):
// preset values as documented in docs/research/room-timing.md §5, the
// validateRoomTiming gate (same throw idiom as validateRuleVariant), and
// the class → ms lookup.

import { describe, expect, it } from 'vitest';
import {
  ACTION_TIMEOUT_MAX_MS,
  ACTION_TIMEOUT_MIN_MS,
  DEFAULT_ROOM_TIMING,
  TIMING_PRESETS,
  timeoutMsFor,
  validateRoomTiming,
} from '../../../src/shared/timing';

describe('TIMING_PRESETS / DEFAULT_ROOM_TIMING', () => {
  it('pins the four documented presets exactly (room-timing.md §5)', () => {
    expect(TIMING_PRESETS).toEqual({
      fast: { perTurnMs: 20_000, planningMs: 45_000 },
      standard: { perTurnMs: 45_000, planningMs: 90_000 },
      relaxed: { perTurnMs: 60_000, planningMs: 120_000 },
      untimed: { perTurnMs: null, planningMs: null },
    });
  });

  it('defaults to the standard preset', () => {
    expect(DEFAULT_ROOM_TIMING).toEqual(TIMING_PRESETS.standard);
  });

  it('every preset validates against its own gate (values inside the clamp)', () => {
    for (const preset of Object.values(TIMING_PRESETS)) {
      expect(validateRoomTiming(preset)).toEqual(preset);
    }
  });
});

describe('validateRoomTiming', () => {
  it('accepts custom in-range integer values and returns a clean object', () => {
    expect(validateRoomTiming({ perTurnMs: 5_000, planningMs: 120_000 })).toEqual({
      perTurnMs: 5_000,
      planningMs: 120_000,
    });
    // Boundary values are legal (the DO clamp never has to fire).
    expect(validateRoomTiming({ perTurnMs: ACTION_TIMEOUT_MIN_MS, planningMs: ACTION_TIMEOUT_MAX_MS }))
      .toEqual({ perTurnMs: ACTION_TIMEOUT_MIN_MS, planningMs: ACTION_TIMEOUT_MAX_MS });
  });

  it('accepts null fields independently (untimed per class)', () => {
    expect(validateRoomTiming({ perTurnMs: null, planningMs: 45_000 })).toEqual({
      perTurnMs: null,
      planningMs: 45_000,
    });
    expect(validateRoomTiming({ perTurnMs: 45_000, planningMs: null })).toEqual({
      perTurnMs: 45_000,
      planningMs: null,
    });
  });

  const bad = (raw: unknown, label: string): void => {
    expect(() => validateRoomTiming(raw), label).toThrowError('timing.invalid');
  };

  it('rejects wrong shapes', () => {
    bad(null, 'null');
    bad(undefined, 'undefined');
    bad(42, 'number');
    bad('standard', 'string');
    bad([], 'array');
    bad({}, 'missing both fields');
    bad({ perTurnMs: 45_000 }, 'missing planningMs');
    bad({ planningMs: 90_000 }, 'missing perTurnMs');
    bad({ perTurnMs: 45_000, planningMs: 90_000, extra: 1 }, 'unknown extra key');
  });

  it('rejects out-of-range values', () => {
    bad({ perTurnMs: 4_999, planningMs: 90_000 }, 'below the 5s floor');
    bad({ perTurnMs: 45_000, planningMs: 120_001 }, 'above the 120s ceiling');
    bad({ perTurnMs: 0, planningMs: 90_000 }, 'zero');
    bad({ perTurnMs: -45_000, planningMs: 90_000 }, 'negative');
  });

  it('rejects non-integer values', () => {
    bad({ perTurnMs: 45_000.5, planningMs: 90_000 }, 'fractional');
    bad({ perTurnMs: Number.NaN, planningMs: 90_000 }, 'NaN');
    bad({ perTurnMs: Number.POSITIVE_INFINITY, planningMs: 90_000 }, 'Infinity');
    bad({ perTurnMs: '45000', planningMs: 90_000 }, 'numeric string');
    bad({ perTurnMs: true, planningMs: 90_000 }, 'boolean');
  });
});

describe('timeoutMsFor', () => {
  it("maps 'turn' → perTurnMs and 'planning' → planningMs", () => {
    expect(timeoutMsFor(TIMING_PRESETS.standard, 'turn')).toBe(45_000);
    expect(timeoutMsFor(TIMING_PRESETS.standard, 'planning')).toBe(90_000);
    expect(timeoutMsFor(TIMING_PRESETS.fast, 'turn')).toBe(20_000);
    expect(timeoutMsFor(TIMING_PRESETS.fast, 'planning')).toBe(45_000);
  });

  it('null budgets pass through (untimed class)', () => {
    expect(timeoutMsFor(TIMING_PRESETS.untimed, 'turn')).toBeNull();
    expect(timeoutMsFor(TIMING_PRESETS.untimed, 'planning')).toBeNull();
  });
});
