// RulePicker config-assembly tests (M3): pure-function coverage only — no
// React rendering. Per the task brief: untouched RuleVariant keys must keep
// the owner's JIANGSU_OFFICIAL_ONLINE defaults, and the guarded values
// (winnersChoose, previousLevel, shared+demote, fixedSeat) must never be
// reachable through this curated surface. assembleConfig(CURATED_DEFAULT_
// PICKS) is also the create-room config HomePage sends, so it is pinned
// here: owner profile + the drawCard PRODUCT default.

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
      firstLeadMethod: 'random',
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

  it('the curated defaults assemble the create-room config: owner profile + drawCard ceremony', () => {
    // This IS the config HomePage sends on POST /api/rooms: a FULL
    // RuleVariant (GuandanGame.init rejects null), equal to the owner
    // profile except the one PRODUCT default — the visible 翻牌定先
    // opening ceremony. The engine-spec default stays 'random'.
    expect(assembleConfig(CURATED_DEFAULT_PICKS)).toEqual({
      ...JIANGSU_OFFICIAL_ONLINE,
      firstLeadMethod: 'drawCard',
    });
    expect(JIANGSU_OFFICIAL_ONLINE.firstLeadMethod).toBe('random');
    expect(CURATED_DEFAULT_PICKS.firstLeadMethod).toBe('drawCard');
  });

  it('never offers a path to the guarded values', () => {
    // The picker's own type surface can only ever produce these 3 values for
    // aFailConsequence, cardCountVisibility and returnTributeMaxRank — so
    // 'demote' is offered, but it is impossible to also request
    // levelTrack='shared' (a guarded combination) through this function:
    // levelTrack is never a curated key, so it always stays 'perTeam'.
    // firstLeadMethod='fixedSeat' is likewise never offered.
    const config = assembleConfig({ ...CURATED_DEFAULT_PICKS, aFailConsequence: 'demote' });
    expect(config.levelTrack).toBe('perTeam');
    expect(config.equalTributeAssignment).not.toBe('winnersChoose');
    expect(config.tributeLevelBasis).not.toBe('previousLevel');
    expect(config.firstLeadMethod).not.toBe('fixedSeat');
    expect(config.equalTributeAssignment).toBe(JIANGSU_OFFICIAL_ONLINE.equalTributeAssignment);
    expect(config.tributeLevelBasis).toBe(JIANGSU_OFFICIAL_ONLINE.tributeLevelBasis);
  });

  it('the curated RulePickerPicks type has exactly these 6 keys', () => {
    expect(Object.keys(CURATED_DEFAULT_PICKS).sort()).toEqual(
      [
        'aFailConsequence',
        'cardCountVisibility',
        'firstLeadMethod',
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
      firstLeadMethod: 'random',
      aFailConsequence: 'none',
      overshootWinsGame: true,
      returnTributeMaxRank: null,
      cardCountVisibility: 'onRequestLE10',
      jokerBombSupreme: false,
    };
    expect(picksFromConfig(assembleConfig(picks))).toEqual(picks);
  });

  it("reads both curated firstLeadMethod values faithfully off the actual config", () => {
    // What is DISPLAYED must be what is SENT: a room created with the
    // drawCard product default keeps it across unrelated edits, and a room
    // explicitly set to 'random' stays random.
    expect(picksFromConfig(assembleConfig(CURATED_DEFAULT_PICKS)).firstLeadMethod).toBe(
      'drawCard',
    );
    expect(picksFromConfig(JIANGSU_OFFICIAL_ONLINE).firstLeadMethod).toBe('random');
  });

  it('defaults per-field when a value is outside the curated set', () => {
    // e.g. a config someone hand-crafted with a non-curated cardCountVisibility
    // value ('onRequestLE6' is a real RuleVariant value, just not curated).
    const config = { ...JIANGSU_OFFICIAL_ONLINE, cardCountVisibility: 'onRequestLE6' };
    expect(picksFromConfig(config).cardCountVisibility).toBe(
      CURATED_DEFAULT_PICKS.cardCountVisibility,
    );
    // 'fixedSeat' is a real RuleVariant value but guarded here: it degrades
    // to the drawCard default.
    const fixedSeat = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'fixedSeat' };
    expect(picksFromConfig(fixedSeat).firstLeadMethod).toBe('drawCard');
  });
});
