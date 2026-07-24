// Room timing picker (M4, docs/research/room-timing.md §5): four preset
// pills over the setTiming transport, mounted beside the rule-picker in the
// lobby. Presets only — no raw ms fields (free numbers invite planning <
// turn nonsense); the four labeled intents come verbatim from
// src/shared/timing.ts, so the picker can never drift from what the DO
// validates and applies.
//
// Fully controlled: the active pill is a VALUE match of room.timing against
// TIMING_PRESETS (same defensive-read spirit as RulePicker.picksFromConfig).
// room.timing === null (legacy pre-M4 room) or a non-preset value (e.g. a
// custom timing written over the wire) presses no pill and shows the
// legacy hint instead of guessing.

import type { RoomTiming, TimingPresetId } from '../shared/timing';
import { TIMING_PRESETS } from '../shared/timing';
import { t, type TranslationKey } from './i18n';

interface PresetOption {
  id: TimingPresetId;
  timing: RoomTiming;
  label: TranslationKey;
  hint: TranslationKey;
}

const PRESET_OPTIONS = [
  {
    id: 'fast',
    timing: TIMING_PRESETS.fast,
    label: 'lobby.timing.preset.fast.label',
    hint: 'lobby.timing.preset.fast.hint',
  },
  {
    id: 'standard',
    timing: TIMING_PRESETS.standard,
    label: 'lobby.timing.preset.standard.label',
    hint: 'lobby.timing.preset.standard.hint',
  },
  {
    id: 'relaxed',
    timing: TIMING_PRESETS.relaxed,
    label: 'lobby.timing.preset.relaxed.label',
    hint: 'lobby.timing.preset.relaxed.hint',
  },
  {
    id: 'untimed',
    timing: TIMING_PRESETS.untimed,
    label: 'lobby.timing.preset.untimed.label',
    hint: 'lobby.timing.preset.untimed.hint',
  },
] as const satisfies readonly PresetOption[];

/** The preset whose values match `timing` field-for-field, or null for a
 *  legacy room (timing null) / a non-preset custom value — either way the
 *  picker presses no pill and shows the legacy hint. Pure and exported for
 *  the unit test (tests/unit/client/timing-picker.test.ts). */
export function presetIdFor(timing: RoomTiming | null): TimingPresetId | null {
  if (timing === null) return null;
  for (const option of PRESET_OPTIONS) {
    if (
      option.timing.perTurnMs === timing.perTurnMs &&
      option.timing.planningMs === timing.planningMs
    ) {
      return option.id;
    }
  }
  return null;
}

export interface TimingPickerProps {
  /** room.timing straight off RoomInfo; null = legacy pre-M4 room. */
  timing: RoomTiming | null;
  /** True once room.status !== 'lobby' (timing is frozen at start). */
  disabled: boolean;
  /** Fires the FULL preset RoomTiming; caller wires this to
   *  store.setTiming (any seated player may edit, same rule as setConfig). */
  onChange: (timing: RoomTiming) => void;
}

export function TimingPicker({ timing, disabled, onChange }: TimingPickerProps) {
  const activeId = presetIdFor(timing);
  const active = PRESET_OPTIONS.find((option) => option.id === activeId);
  const legend = t('lobby.timing.label');

  const select = (option: PresetOption): void => {
    if (disabled) return;
    onChange(option.timing);
  };

  return (
    <div className="timing-picker">
      <style>{TIMING_PICKER_CSS}</style>
      <fieldset className="timing-picker__group" disabled={disabled}>
        <legend className="timing-picker__label">{legend}</legend>
        <p className="timing-picker__hint">{t('lobby.timing.hint')}</p>
        <div className="timing-picker__segmented" role="group" aria-label={legend}>
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="timing-picker__option"
              aria-pressed={option.id === activeId}
              disabled={disabled}
              onClick={() => select(option)}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
        <p className="timing-picker__hint timing-picker__hint--option">
          {active !== undefined ? t(active.hint) : t('lobby.timing.legacyHint')}
        </p>
      </fieldset>
    </div>
  );
}

// Same design system as RulePicker: rosewood panel, ivory text, quiet
// segmented controls, cinnabar only for the active option, no goldleaf.
const TIMING_PICKER_CSS = `
.timing-picker {
  background: var(--rosewood);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  color: var(--ivory);
  font-family: var(--font-ui);
}
.timing-picker__group {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.timing-picker__group[disabled] {
  opacity: 0.55;
}
.timing-picker__label {
  padding: 0;
  font-weight: var(--weight-medium);
  font-size: var(--fs-lg);
  color: var(--ivory);
}
.timing-picker__hint {
  margin: var(--space-3xs) 0 var(--space-sm);
  font-size: var(--fs-sm);
  line-height: 1.4;
  color: rgba(245, 239, 227, 0.72);
}
.timing-picker__hint--option {
  margin: var(--space-xs) 0 0;
}
.timing-picker__segmented {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
.timing-picker__option {
  border: 1px solid rgba(245, 239, 227, 0.3);
  background: rgba(245, 239, 227, 0.06);
  color: var(--ivory);
  border-radius: var(--radius-pill);
  padding: var(--space-xs) var(--space-lg);
  font-size: var(--fs-md);
  font-family: inherit;
  cursor: pointer;
}
.timing-picker__option:hover:not(:disabled) {
  background: rgba(245, 239, 227, 0.14);
}
.timing-picker__option[aria-pressed='true'] {
  background: var(--cinnabar);
  border-color: var(--cinnabar);
  color: var(--ivory);
  font-weight: var(--weight-medium);
}
.timing-picker__option:disabled {
  cursor: not-allowed;
}
.timing-picker__option:focus-visible {
  outline: 2px solid var(--ivory);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .timing-picker__option {
    transition: background-color 120ms ease, border-color 120ms ease;
  }
}
`;
