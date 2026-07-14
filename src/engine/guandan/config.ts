// The 25-key RuleVariant surface — exactly the table in
// docs/rules/guandan.md §10 (v1.3). Every VARIANT/UNCERTAIN rule is a key
// here; the engine hard-codes only CORE rules. A wrong default must always
// be a config change, never an engine change.

import type { Rank } from './cards';

export interface RuleVariant {
  turnDirection: 'counterclockwise' | 'clockwise';
  firstLeadMethod: 'random' | 'drawCard' | 'fixedSeat';
  levelTrack: 'perTeam' | 'shared';
  overshootWinsGame: boolean;
  aWinPartnerNotLast: boolean;
  /** null = unlimited attempts. */
  aMaxAttempts: number | null;
  aFailConsequence: 'suspendPlayOpponentLevel' | 'demote' | 'none';
  /** Only consulted when aFailConsequence === 'demote'. */
  aFailDemoteTo: 'level2' | 'stayAtA' | 'levelJ';
  aAttemptCounterReset: 'fresh' | 'cumulative';
  aceFinishDemotes: boolean;
  aAttemptOnlyAsDeclarer: boolean;
  /** 10 = the official rule, interpreted as levelValue ≤ 10 (spec §7.4);
   *  null = any card other than the received tribute card. */
  returnTributeMaxRank: 10 | null;
  returnNoLowCardPolicy: 'lowestByLevelValue' | 'anyCard';
  tributeLevelBasis: 'upcomingLevel' | 'previousLevel';
  equalTributeAssignment: 'seatOrder' | 'random' | 'winnersChoose';
  antiTributeMode: 'auto' | 'optional';
  tributeVisibility: 'public' | 'returnHidden';
  cardCountVisibility: 'always' | 'onRequestLE10' | 'onRequestLE6';
  jokerBombSupreme: boolean;
  wildStraightFlushIsBomb: boolean;
  allowUnderDeclareStraightFlush: boolean;
  fiveOfKindAsFullHouse: boolean;
  fullHouseJokerPair: boolean;
  allowWildUnderDeclare: boolean;
  jiefengRecipient: 'partner' | 'nextPlayer';
}

/** Default profile (spec §10): Jiangsu/Huai'an official rules where they
 *  speak, common online conventions where they don't, owner round-2/3 pins
 *  applied (public tribute, auto anti-tribute with reveal, suspend-not-
 *  demote A-failure). */
export const JIANGSU_OFFICIAL_ONLINE: RuleVariant = {
  turnDirection: 'counterclockwise',
  firstLeadMethod: 'random',
  levelTrack: 'perTeam',
  overshootWinsGame: false,
  aWinPartnerNotLast: true,
  aMaxAttempts: 3,
  aFailConsequence: 'suspendPlayOpponentLevel',
  aFailDemoteTo: 'level2',
  aAttemptCounterReset: 'fresh',
  aceFinishDemotes: false,
  aAttemptOnlyAsDeclarer: true,
  returnTributeMaxRank: 10,
  returnNoLowCardPolicy: 'lowestByLevelValue',
  tributeLevelBasis: 'upcomingLevel',
  equalTributeAssignment: 'seatOrder',
  antiTributeMode: 'auto',
  tributeVisibility: 'public',
  cardCountVisibility: 'always',
  jokerBombSupreme: true,
  wildStraightFlushIsBomb: true,
  allowUnderDeclareStraightFlush: false,
  fiveOfKindAsFullHouse: false,
  fullHouseJokerPair: true,
  allowWildUnderDeclare: false,
  jiefengRecipient: 'partner',
};

export const STARTING_LEVEL: Rank = '2';

/** Demotion target under aFailConsequence='demote'. */
export function demoteTarget(config: RuleVariant, current: Rank): Rank {
  switch (config.aFailDemoteTo) {
    case 'level2':
      return '2';
    case 'levelJ':
      return 'J';
    case 'stayAtA':
      return current;
  }
}

// ---------------------------------------------------------------------------
// Strict config validation (Grok M3 audit, F1): the room layer passes config
// through OPAQUELY (PLAN §4), so a partial/foreign object reaches init as-is
// — and an absent turnDirection would otherwise silently flip rotation to
// clockwise via nextSeat's ternary. The engine therefore validates EVERY key
// against its allowed values and throws loudly (surfacing as room.startFailed,
// room stays in lobby) instead of ever guessing. No default-merging: a
// partial config is a client bug we want visible, not papered over.
// ---------------------------------------------------------------------------

const RULE_VALUE_SPACES: { [K in keyof RuleVariant]: readonly RuleVariant[K][] | 'boolean' | 'intOrNull' } = {
  turnDirection: ['counterclockwise', 'clockwise'],
  firstLeadMethod: ['random', 'drawCard', 'fixedSeat'],
  levelTrack: ['perTeam', 'shared'],
  overshootWinsGame: 'boolean',
  aWinPartnerNotLast: 'boolean',
  aMaxAttempts: 'intOrNull',
  aFailConsequence: ['suspendPlayOpponentLevel', 'demote', 'none'],
  aFailDemoteTo: ['level2', 'stayAtA', 'levelJ'],
  aAttemptCounterReset: ['fresh', 'cumulative'],
  aceFinishDemotes: 'boolean',
  aAttemptOnlyAsDeclarer: 'boolean',
  returnTributeMaxRank: [10, null],
  returnNoLowCardPolicy: ['lowestByLevelValue', 'anyCard'],
  tributeLevelBasis: ['upcomingLevel', 'previousLevel'],
  equalTributeAssignment: ['seatOrder', 'random', 'winnersChoose'],
  antiTributeMode: ['auto', 'optional'],
  tributeVisibility: ['public', 'returnHidden'],
  cardCountVisibility: ['always', 'onRequestLE10', 'onRequestLE6'],
  jokerBombSupreme: 'boolean',
  wildStraightFlushIsBomb: 'boolean',
  allowUnderDeclareStraightFlush: 'boolean',
  fiveOfKindAsFullHouse: 'boolean',
  fullHouseJokerPair: 'boolean',
  allowWildUnderDeclare: 'boolean',
  jiefengRecipient: ['partner', 'nextPlayer'],
};

/** Validate an opaque config object into a RuleVariant, throwing
 *  `config.invalid: <key>` on the first missing or out-of-range key.
 *  Unknown extra keys are rejected too (`config.unknownKey: <key>`) so a
 *  typo'd key can never silently no-op. */
export function validateRuleVariant(raw: unknown): RuleVariant {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config.invalid: <root>');
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!(key in RULE_VALUE_SPACES)) throw new Error(`config.unknownKey: ${key}`);
  }
  for (const [key, space] of Object.entries(RULE_VALUE_SPACES)) {
    const value = obj[key];
    if (space === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`config.invalid: ${key}`);
    } else if (space === 'intOrNull') {
      if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < 1)) {
        throw new Error(`config.invalid: ${key}`);
      }
    } else if (!(space as readonly unknown[]).includes(value)) {
      throw new Error(`config.invalid: ${key}`);
    }
  }
  return obj as unknown as RuleVariant;
}
