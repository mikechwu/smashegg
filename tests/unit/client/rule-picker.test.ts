// RulePicker config-assembly tests (M3): pure-function coverage only — no
// React rendering. Per the task brief: untouched RuleVariant keys must keep
// the owner's JIANGSU_OFFICIAL_ONLINE defaults, and the guarded values
// (winnersChoose, previousLevel, shared+demote) must never be reachable
// through this curated surface.

import { describe, expect, it } from 'vitest';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import {
  assembleConfig,
  CURATED_DEFAULT_PICKS,
  picksFromConfig,
  type RulePickerPicks,
} from '../../../src/client/RulePicker';

describe('assembleConfig', () => {
  it('spreads the curated picks over JIANGSU_OFFICIAL_ONLINE', () => {
    const picks: RulePickerPicks = {
      aFailConsequence: 'demote',
      overshootWinsGame: true,
      returnTributeMaxRank: null,
      cardCountVisibility: 'onRequestLE10',
      jokerBombSupreme: false,
    };
    const config = assembleConfig(picks);
    expect(config).toEqual({ ...JIANGSU_OFFICIAL_ONLINE, ...picks });
  });

  it('keeps every untouched key at the owner default', () => {
    const config = assembleConfig(CURATED_DEFAULT_PICKS);
    const untouchedKeys = Object.keys(JIANGSU_OFFICIAL_ONLINE).filter(
      (key) => !(key in CURATED_DEFAULT_PICKS),
    ) as (keyof typeof JIANGSU_OFFICIAL_ONLINE)[];
    expect(untouchedKeys.length).toBeGreaterThan(0);
    for (const key of untouchedKeys) {
      expect(config[key]).toEqual(JIANGSU_OFFICIAL_ONLINE[key]);
    }
  });

  it('the curated defaults reproduce JIANGSU_OFFICIAL_ONLINE unchanged', () => {
    expect(assembleConfig(CURATED_DEFAULT_PICKS)).toEqual(JIANGSU_OFFICIAL_ONLINE);
  });

  it('never offers a path to the guarded values', () => {
    // The picker's own type surface can only ever produce these 3 values for
    // aFailConsequence, cardCountVisibility and returnTributeMaxRank — so
    // 'demote' is offered, but it is impossible to also request
    // levelTrack='shared' (a guarded combination) through this function:
    // levelTrack is never a curated key, so it always stays 'perTeam'.
    const config = assembleConfig({ ...CURATED_DEFAULT_PICKS, aFailConsequence: 'demote' });
    expect(config.levelTrack).toBe('perTeam');
    expect(config.equalTributeAssignment).not.toBe('winnersChoose');
    expect(config.tributeLevelBasis).not.toBe('previousLevel');
    expect(config.equalTributeAssignment).toBe(JIANGSU_OFFICIAL_ONLINE.equalTributeAssignment);
    expect(config.tributeLevelBasis).toBe(JIANGSU_OFFICIAL_ONLINE.tributeLevelBasis);
  });

  it('the curated RulePickerPicks type has exactly these 5 keys', () => {
    expect(Object.keys(CURATED_DEFAULT_PICKS).sort()).toEqual(
      [
        'aFailConsequence',
        'cardCountVisibility',
        'jokerBombSupreme',
        'overshootWinsGame',
        'returnTributeMaxRank',
      ].sort(),
    );
  });
});

describe('picksFromConfig', () => {
  it('falls back to curated defaults for null (no config set yet)', () => {
    expect(picksFromConfig(null)).toEqual(CURATED_DEFAULT_PICKS);
  });

  it('falls back to curated defaults for non-object config', () => {
    expect(picksFromConfig('nonsense')).toEqual(CURATED_DEFAULT_PICKS);
    expect(picksFromConfig(42)).toEqual(CURATED_DEFAULT_PICKS);
  });

  it('reads back a previously assembled config unchanged', () => {
    const picks: RulePickerPicks = {
      aFailConsequence: 'none',
      overshootWinsGame: true,
      returnTributeMaxRank: null,
      cardCountVisibility: 'onRequestLE10',
      jokerBombSupreme: false,
    };
    expect(picksFromConfig(assembleConfig(picks))).toEqual(picks);
  });

  it('defaults per-field when a value is outside the curated set', () => {
    // e.g. a config someone hand-crafted with a non-curated cardCountVisibility
    // value ('onRequestLE6' is a real RuleVariant value, just not curated).
    const config = { ...JIANGSU_OFFICIAL_ONLINE, cardCountVisibility: 'onRequestLE6' };
    expect(picksFromConfig(config).cardCountVisibility).toBe(
      CURATED_DEFAULT_PICKS.cardCountVisibility,
    );
  });
});
