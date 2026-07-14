// Curated Guandan rule-picker (M3, PLAN.md §4/§9 — "curated subset of the 25
// RuleVariant keys over the opaque setConfig transport"). Mounts into
// Lobby's `data-slot="config-panel"` slot.
//
// Scope is deliberately narrow: exactly 5 house-rules-sensitive keys, each
// with owner-picked defaults pre-selected (JIANGSU_OFFICIAL_ONLINE). Every
// other RuleVariant key — including the guarded ones (`equalTributeAssignment
// ='winnersChoose'`, `tributeLevelBasis='previousLevel'`, `levelTrack=
// 'shared'` combined with `aFailConsequence='demote'`) — is NEVER offered
// here; assembleConfig always spreads picks over the untouched owner
// defaults (tested in tests/unit/client/rule-picker.test.ts).
//
// The room layer treats `config` as opaque (PLAN §4): this component reads
// an `unknown` room.config defensively (picksFromConfig), so a config
// written by a different client/version degrades to curated defaults
// instead of throwing.

import type { RuleVariant } from '../engine/guandan/config';
import { JIANGSU_OFFICIAL_ONLINE } from '../engine/guandan/config';
import { t, type TranslationKey } from './i18n';

export type AFailConsequencePick = 'suspendPlayOpponentLevel' | 'demote' | 'none';
export type ReturnTributeMaxRankPick = 10 | null;
export type CardCountVisibilityPick = 'always' | 'onRequestLE10';

/** Exactly the 5 curated keys — the only ones this picker ever offers. */
export interface RulePickerPicks {
  aFailConsequence: AFailConsequencePick;
  overshootWinsGame: boolean;
  returnTributeMaxRank: ReturnTributeMaxRankPick;
  cardCountVisibility: CardCountVisibilityPick;
  jokerBombSupreme: boolean;
}

/** Owner defaults (pre-selected in the UI), read straight off the profile
 *  so this file never re-states a value docs/rules/guandan.md already
 *  pins — a profile change moves the picker's default automatically. */
export const CURATED_DEFAULT_PICKS: RulePickerPicks = {
  aFailConsequence: JIANGSU_OFFICIAL_ONLINE.aFailConsequence,
  overshootWinsGame: JIANGSU_OFFICIAL_ONLINE.overshootWinsGame,
  returnTributeMaxRank: JIANGSU_OFFICIAL_ONLINE.returnTributeMaxRank,
  cardCountVisibility: JIANGSU_OFFICIAL_ONLINE.cardCountVisibility as CardCountVisibilityPick,
  jokerBombSupreme: JIANGSU_OFFICIAL_ONLINE.jokerBombSupreme,
};

/** The pure config-assembly function (unit-tested): untouched keys always
 *  keep the owner's JIANGSU_OFFICIAL_ONLINE values; picks only ever override
 *  the 5 curated keys. */
export function assembleConfig(picks: RulePickerPicks): RuleVariant {
  return { ...JIANGSU_OFFICIAL_ONLINE, ...picks };
}

function isAFailConsequencePick(value: unknown): value is AFailConsequencePick {
  return value === 'suspendPlayOpponentLevel' || value === 'demote' || value === 'none';
}

function isReturnTributeMaxRankPick(value: unknown): value is ReturnTributeMaxRankPick {
  return value === 10 || value === null;
}

function isCardCountVisibilityPick(value: unknown): value is CardCountVisibilityPick {
  return value === 'always' || value === 'onRequestLE10';
}

/** Reads the 5 curated fields off an opaque room.config, falling back to
 *  the curated defaults per-field when the value is missing or outside the
 *  curated set (e.g. a config written under a non-curated value, or by a
 *  future client version) — never throws on untrusted shape. */
export function picksFromConfig(config: unknown): RulePickerPicks {
  if (typeof config !== 'object' || config === null) return CURATED_DEFAULT_PICKS;
  const c = config as Record<string, unknown>;
  return {
    aFailConsequence: isAFailConsequencePick(c.aFailConsequence)
      ? c.aFailConsequence
      : CURATED_DEFAULT_PICKS.aFailConsequence,
    overshootWinsGame:
      typeof c.overshootWinsGame === 'boolean'
        ? c.overshootWinsGame
        : CURATED_DEFAULT_PICKS.overshootWinsGame,
    returnTributeMaxRank: isReturnTributeMaxRankPick(c.returnTributeMaxRank)
      ? c.returnTributeMaxRank
      : CURATED_DEFAULT_PICKS.returnTributeMaxRank,
    cardCountVisibility: isCardCountVisibilityPick(c.cardCountVisibility)
      ? c.cardCountVisibility
      : CURATED_DEFAULT_PICKS.cardCountVisibility,
    jokerBombSupreme:
      typeof c.jokerBombSupreme === 'boolean'
        ? c.jokerBombSupreme
        : CURATED_DEFAULT_PICKS.jokerBombSupreme,
  };
}

interface Option<T> {
  value: T;
  label: TranslationKey;
  hint: TranslationKey;
}

const A_FAIL_OPTIONS = [
  {
    value: 'suspendPlayOpponentLevel',
    label: 'lobby.rules.aFailConsequence.suspend.label',
    hint: 'lobby.rules.aFailConsequence.suspend.hint',
  },
  {
    value: 'demote',
    label: 'lobby.rules.aFailConsequence.demote.label',
    hint: 'lobby.rules.aFailConsequence.demote.hint',
  },
  {
    value: 'none',
    label: 'lobby.rules.aFailConsequence.none.label',
    hint: 'lobby.rules.aFailConsequence.none.hint',
  },
] as const satisfies readonly Option<AFailConsequencePick>[];

const RETURN_TRIBUTE_OPTIONS = [
  {
    value: 10,
    label: 'lobby.rules.returnTributeMaxRank.max10.label',
    hint: 'lobby.rules.returnTributeMaxRank.max10.hint',
  },
  {
    value: null,
    label: 'lobby.rules.returnTributeMaxRank.unlimited.label',
    hint: 'lobby.rules.returnTributeMaxRank.unlimited.hint',
  },
] as const satisfies readonly Option<ReturnTributeMaxRankPick>[];

const CARD_COUNT_VISIBILITY_OPTIONS = [
  {
    value: 'always',
    label: 'lobby.rules.cardCountVisibility.always.label',
    hint: 'lobby.rules.cardCountVisibility.always.hint',
  },
  {
    value: 'onRequestLE10',
    label: 'lobby.rules.cardCountVisibility.onRequestLE10.label',
    hint: 'lobby.rules.cardCountVisibility.onRequestLE10.hint',
  },
] as const satisfies readonly Option<CardCountVisibilityPick>[];

const BOOL_OPTIONS = [
  { value: true, label: 'lobby.rules.enabled', hint: 'lobby.rules.enabled' },
  { value: false, label: 'lobby.rules.disabled', hint: 'lobby.rules.disabled' },
] as const satisfies readonly Option<boolean>[];

export interface RulePickerProps {
  /** Opaque room.config (PLAN §4) — read defensively via picksFromConfig. */
  config: unknown;
  /** True once room.status !== 'lobby' (match config is frozen, PLAN §4). */
  disabled: boolean;
  /** Fires the FULL assembled RuleVariant; caller wires this to
   *  store.setConfig (any seated player may edit, PLAN §4). */
  onChange: (config: RuleVariant) => void;
}

export function RulePicker({ config, disabled, onChange }: RulePickerProps) {
  const picks = picksFromConfig(config);

  function set<K extends keyof RulePickerPicks>(key: K, value: RulePickerPicks[K]): void {
    if (disabled) return;
    onChange(assembleConfig({ ...picks, [key]: value }));
  }

  return (
    <div className="rule-picker">
      <style>{RULE_PICKER_CSS}</style>

      <SegmentedGroup
        legendKey="lobby.rules.aFailConsequence.label"
        hintKey="lobby.rules.aFailConsequence.hint"
        options={A_FAIL_OPTIONS}
        value={picks.aFailConsequence}
        disabled={disabled}
        onSelect={(value) => set('aFailConsequence', value)}
      />

      <SegmentedGroup
        legendKey="lobby.rules.overshootWinsGame.label"
        hintKey="lobby.rules.overshootWinsGame.hint"
        options={BOOL_OPTIONS}
        value={picks.overshootWinsGame}
        disabled={disabled}
        onSelect={(value) => set('overshootWinsGame', value)}
      />

      <SegmentedGroup
        legendKey="lobby.rules.returnTributeMaxRank.label"
        hintKey="lobby.rules.returnTributeMaxRank.hint"
        options={RETURN_TRIBUTE_OPTIONS}
        value={picks.returnTributeMaxRank}
        disabled={disabled}
        onSelect={(value) => set('returnTributeMaxRank', value)}
      />

      <SegmentedGroup
        legendKey="lobby.rules.cardCountVisibility.label"
        hintKey="lobby.rules.cardCountVisibility.hint"
        options={CARD_COUNT_VISIBILITY_OPTIONS}
        value={picks.cardCountVisibility}
        disabled={disabled}
        onSelect={(value) => set('cardCountVisibility', value)}
      />

      <SegmentedGroup
        legendKey="lobby.rules.jokerBombSupreme.label"
        hintKey="lobby.rules.jokerBombSupreme.hint"
        options={BOOL_OPTIONS}
        value={picks.jokerBombSupreme}
        disabled={disabled}
        onSelect={(value) => set('jokerBombSupreme', value)}
      />
    </div>
  );
}

interface SegmentedGroupProps<T> {
  legendKey: TranslationKey;
  hintKey: TranslationKey;
  options: readonly Option<T>[];
  value: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}

function SegmentedGroup<T>({
  legendKey,
  hintKey,
  options,
  value,
  disabled,
  onSelect,
}: SegmentedGroupProps<T>) {
  const legend = t(legendKey);
  return (
    <fieldset className="rule-picker__group" disabled={disabled}>
      <legend className="rule-picker__label">{legend}</legend>
      <p className="rule-picker__hint">{t(hintKey)}</p>
      <div className="rule-picker__segmented" role="group" aria-label={legend}>
        {options.map((option, i) => (
          <button
            // Values repeat across groups (e.g. true/false) but never within
            // one group's own option list, so the index disambiguates safely.
            key={i}
            type="button"
            className="rule-picker__option"
            aria-pressed={option.value === value}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Design system (normative, task brief): rosewood panel, ivory text, quiet
// segmented controls, cinnabar only for the active/selected option, NO
// goldleaf here (goldleaf is reserved for the level rail / jiefeng / match
// victory elsewhere in the app). CJK-first system sans stack; no webfonts.
const RULE_PICKER_CSS = `
.rule-picker {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #4A2C27;
  border-radius: 10px;
  padding: 0.9rem 1rem 1.1rem;
  color: #F5EFE3;
  font-family: -apple-system, 'PingFang TC', 'Hiragino Sans TC', 'Noto Sans TC',
    'Microsoft JhengHei', sans-serif;
}
.rule-picker__group {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.rule-picker__group[disabled] {
  opacity: 0.55;
}
.rule-picker__label {
  padding: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: #F5EFE3;
}
.rule-picker__hint {
  margin: 0.15rem 0 0.5rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: rgba(245, 239, 227, 0.72);
}
.rule-picker__segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.rule-picker__option {
  border: 1px solid rgba(245, 239, 227, 0.3);
  background: rgba(245, 239, 227, 0.06);
  color: #F5EFE3;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
}
.rule-picker__option:hover:not(:disabled) {
  background: rgba(245, 239, 227, 0.14);
}
.rule-picker__option[aria-pressed='true'] {
  background: #C3392B;
  border-color: #C3392B;
  color: #F5EFE3;
  font-weight: 600;
}
.rule-picker__option:disabled {
  cursor: not-allowed;
}
.rule-picker__option:focus-visible {
  outline: 2px solid #F5EFE3;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .rule-picker__option {
    transition: background-color 120ms ease, border-color 120ms ease;
  }
}
`;
