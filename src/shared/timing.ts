// Room-layer timing vocabulary (M4, docs/research/room-timing.md): the
// class → milliseconds map that the GameRoom DO applies to the engine's
// TimingClass labels. Lives in src/shared — the client renders the picker
// from the same presets, and the engine NEVER imports this file (a class
// is a label, not a clock; engine time-freedom holds).

import type { TimingClass } from '../engine/core/game';

/** Room timing config: one budget per timing class. null = untimed for
 *  CONNECTED seats in that class; a disconnected expected actor always
 *  keeps the 60s disconnect-grace deadline (PLAN §4 null-timeout rule), so
 *  liveness never depends on these values. Stored as room.timing_json; a
 *  NULL column = legacy room governed by the game's actionTimeoutMs. */
export interface RoomTiming {
  perTurnMs: number | null;   // class 'turn'
  planningMs: number | null;  // class 'planning'
}

/** Bounds every non-null RoomTiming value must satisfy — the same clamp
 *  the DO applies when arming a deadline (room-helpers re-exports these),
 *  so a validated config can never be silently clamped later. */
export const ACTION_TIMEOUT_MIN_MS = 5_000;
export const ACTION_TIMEOUT_MAX_MS = 120_000;

/** The four picker intents (docs/research/room-timing.md §5 — original
 *  values, no published platform convention exists to copy). planning may
 *  exceed perTurn (it always does here); both sit inside the clamp. */
export const TIMING_PRESETS = {
  fast:     { perTurnMs: 20_000, planningMs: 45_000 },
  standard: { perTurnMs: 45_000, planningMs: 90_000 },
  relaxed:  { perTurnMs: 60_000, planningMs: 120_000 },
  untimed:  { perTurnMs: null,   planningMs: null },
} as const satisfies Record<string, RoomTiming>;

export type TimingPresetId = keyof typeof TIMING_PRESETS;

/** Applied whenever room creation omits timing — 45s per turn is the value
 *  proven through every M3 visual round; 90s planning ≈ 2× turn covers
 *  reading a fresh 27-card hand and absorbs the hand-1 ceremony. */
export const DEFAULT_ROOM_TIMING: RoomTiming = TIMING_PRESETS.standard;

function validTimingValue(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= ACTION_TIMEOUT_MIN_MS &&
      value <= ACTION_TIMEOUT_MAX_MS)
  );
}

/** Validate an untrusted timing object, throwing `timing.invalid` on any
 *  bad shape or out-of-range value (same throw idiom as
 *  validateRuleVariant). Each field: null or an integer in [5s, 120s].
 *  Unknown extra keys are rejected so a typo'd key can never silently
 *  no-op. */
export function validateRoomTiming(raw: unknown): RoomTiming {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('timing.invalid');
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'perTurnMs' && key !== 'planningMs') throw new Error('timing.invalid');
  }
  if (!validTimingValue(obj.perTurnMs) || !validTimingValue(obj.planningMs)) {
    throw new Error('timing.invalid');
  }
  return { perTurnMs: obj.perTurnMs, planningMs: obj.planningMs };
}

/** The class → budget lookup. Total over the closed TimingClass union. */
export function timeoutMsFor(timing: RoomTiming, cls: TimingClass): number | null {
  return cls === 'planning' ? timing.planningMs : timing.perTurnMs;
}
