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
  /** Auto-pass round (room-layer option, default ON): when a seat's only legal
   *  action is pass (a follower who cannot beat the current play, engine class
   *  'forcedPass'), ON grants the short AUTO_PASS_MS grace then the existing
   *  default-on-expiry pass fires; OFF falls the class through to the normal
   *  turn budget (today's behaviour). Lives HERE, not in the engine RuleVariant:
   *  it changes neither legality nor outcome (the pass happens either way) — it
   *  is pacing, and RuleVariant's contract is rules that change legality/outcome.
   *  Required on the interface so no construction site silently omits it; the
   *  trust boundary (validateRoomTiming) defaults a legacy-missing value to ON. */
  autoPassNoPlay: boolean;
}

/** Bounds every non-null RoomTiming value must satisfy — the same clamp
 *  the DO applies when arming a deadline (room-helpers re-exports these),
 *  so a validated config can never be silently clamped later. */
export const ACTION_TIMEOUT_MIN_MS = 5_000;
export const ACTION_TIMEOUT_MAX_MS = 120_000;

/** The auto-pass grace: how long a follower with no legal play sees the pass-button sweep
 *  before the game passes for them (owner: 4s — room for an elder to read the reason line
 *  and grasp it, harmless to miss since pass is the only legal move). A FIXED
 *  constant, NOT a picker value — the option is on/off only. Deliberately BELOW
 *  ACTION_TIMEOUT_MIN_MS (5s): it is a non-decision auto-fire, not a decision
 *  budget, so nextDeadlines exempts the 'forcedPass' class from the [5s,120s]
 *  clamp. The deadline-liveness property MODEL's clamp must apply the identical
 *  exemption, or DL1 flags the mismatch — that agreement is the pin that this
 *  value is really honoured, not silently floored to 5s. */
export const AUTO_PASS_MS = 4_000;

/** The four picker intents (docs/research/room-timing.md §5 — original
 *  values, no published platform convention exists to copy). planning may
 *  exceed perTurn (it always does here); both sit inside the clamp. */
// autoPassNoPlay defaults ON in every preset (incl. untimed — a forced pass is
// not a decision, so applying it in an untimed room is not a fake timer; anyone
// who disagrees flips the option off). The preset pill is chosen by perTurn +
// planning only (presetIdFor), so the toggle is orthogonal to which pill lights.
export const TIMING_PRESETS = {
  fast:     { perTurnMs: 20_000, planningMs: 45_000,  autoPassNoPlay: true },
  standard: { perTurnMs: 45_000, planningMs: 90_000,  autoPassNoPlay: true },
  relaxed:  { perTurnMs: 60_000, planningMs: 120_000, autoPassNoPlay: true },
  untimed:  { perTurnMs: null,   planningMs: null,    autoPassNoPlay: true },
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
    if (key !== 'perTurnMs' && key !== 'planningMs' && key !== 'autoPassNoPlay') {
      throw new Error('timing.invalid');
    }
  }
  if (!validTimingValue(obj.perTurnMs) || !validTimingValue(obj.planningMs)) {
    throw new Error('timing.invalid');
  }
  // Back-compat (auto-pass round): a legacy timing_json predates autoPassNoPlay.
  // A MISSING value defaults to true (ON) rather than throwing — else a running
  // M4 room's stored {perTurnMs, planningMs} would fail here and parseTiming
  // would degrade it to null, silently dropping its configured timers. A PRESENT
  // value must still be a boolean (a typo'd value can never silently no-op).
  // This is the one deliberate exception to the strict-no-default idiom, mirroring
  // timing's existing whole-object-null legacy escape hatch.
  if (obj.autoPassNoPlay !== undefined && typeof obj.autoPassNoPlay !== 'boolean') {
    throw new Error('timing.invalid');
  }
  return {
    perTurnMs: obj.perTurnMs,
    planningMs: obj.planningMs,
    autoPassNoPlay: obj.autoPassNoPlay ?? true,
  };
}

/** The class → budget lookup. EXHAUSTIVE over the closed TimingClass union: an
 *  exhaustive switch (default: assertNever) so a FUTURE class becomes a COMPILE
 *  error here rather than silently mapping to perTurnMs (design-review catch —
 *  the same no-silent-no-op discipline as validateRoomTiming). */
export function timeoutMsFor(timing: RoomTiming, cls: TimingClass): number | null {
  switch (cls) {
    case 'turn':
      return timing.perTurnMs;
    case 'planning':
      return timing.planningMs;
    case 'forcedPass':
      // ON: the short fixed grace (clamp-exempt — see AUTO_PASS_MS). OFF: fall
      // through to the per-turn budget, i.e. today's behaviour (the seat waits
      // its ordinary clock and the existing default-on-expiry pass fires; null
      // in an untimed room = no clock, so OFF+untimed never auto-passes).
      return timing.autoPassNoPlay ? AUTO_PASS_MS : timing.perTurnMs;
    default:
      return assertNever(cls);
  }
}

/** Compile-time exhaustiveness guard: reaching this with a real value means a
 *  new TimingClass member was added without a timeoutMsFor branch. */
function assertNever(x: never): never {
  throw new Error(`unhandled TimingClass: ${String(x)}`);
}
