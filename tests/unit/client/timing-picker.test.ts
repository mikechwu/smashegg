// TimingPicker value-match tests (M4): pure-function coverage only — no
// React rendering, same policy as rule-picker.test.ts. The picker is fully
// controlled: presetIdFor(room.timing) decides the pressed pill, and null
// (legacy room / non-preset custom value) presses none and shows the
// legacy hint instead of guessing.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_TIMING,
  TIMING_PRESETS,
  type RoomTiming,
} from '../../../src/shared/timing';
import { presetIdFor } from '../../../src/client/TimingPicker';

describe('presetIdFor', () => {
  it('matches every preset by VALUE, not identity', () => {
    for (const [id, timing] of Object.entries(TIMING_PRESETS)) {
      // A fresh object with the same field values — exactly what a
      // roomChanged carries after a JSON round-trip over the wire.
      const wireCopy: RoomTiming = {
        perTurnMs: timing.perTurnMs,
        planningMs: timing.planningMs,
        autoPassNoPlay: timing.autoPassNoPlay,
      };
      expect(presetIdFor(wireCopy)).toBe(id);
    }
  });

  it('auto-pass round: the autoPassNoPlay flag is ORTHOGONAL to the pressed pill (a preset with it flipped still matches)', () => {
    expect(presetIdFor({ ...TIMING_PRESETS.standard, autoPassNoPlay: false })).toBe('standard');
    expect(presetIdFor({ ...TIMING_PRESETS.untimed, autoPassNoPlay: false })).toBe('untimed');
  });

  it('the product default room presses the standard pill', () => {
    expect(presetIdFor({ ...DEFAULT_ROOM_TIMING })).toBe('standard');
  });

  it('legacy room (timing null) presses no pill', () => {
    expect(presetIdFor(null)).toBeNull();
  });

  it('a non-preset custom value presses no pill', () => {
    // Valid per validateRoomTiming (range, not preset membership) but not a
    // preset — the picker must not misattribute it to a nearby pill.
    expect(presetIdFor({ perTurnMs: 5_000, planningMs: 5_000, autoPassNoPlay: true })).toBeNull();
    // Half-matching a preset is still no match: BOTH fields must agree.
    expect(
      presetIdFor({ perTurnMs: TIMING_PRESETS.fast.perTurnMs, planningMs: 90_000, autoPassNoPlay: true }),
    ).toBeNull();
    // Untimed half-match: one null field alone is not the untimed preset.
    expect(presetIdFor({ perTurnMs: null, planningMs: 90_000, autoPassNoPlay: true })).toBeNull();
  });
});
