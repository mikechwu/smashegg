// Auto-pass dead-press swallow — the NARROW-scope structural pin (owner
// strengthen #2). A race-losing manual pass (the DO's default pass committed the
// identical pass first) must show success, never a confusing error toast — but
// the swallow must be scoped PRECISELY, because swallowing the wrong error hides
// a genuine failure, a worse bug than the toast. Two structural guarantees:
//   1. The rejection-code allowlist is EXACTLY the two "turn already advanced"
//      codes and nothing else (isRedundantPassRejection).
//   2. GameTable gates the swallow on BOTH an actionId it tracked as a local
//      PASS submission AND that allowlist — so a rejected PLAY, or a pass
//      rejected for any other reason, still surfaces.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REDUNDANT_PASS_REJECTION_CODES,
  isRedundantPassRejection,
} from '../../../src/client/table/helpers';

describe('isRedundantPassRejection — the exact, closed allowlist', () => {
  it('the allowlist is EXACTLY the two "turn already advanced past my decision point" codes', () => {
    expect([...REDUNDANT_PASS_REJECTION_CODES].sort()).toEqual(
      ['action.notYourTurn', 'action.wrongPhase'].sort(),
    );
  });

  it('returns true for those two codes', () => {
    expect(isRedundantPassRejection('action.notYourTurn')).toBe(true);
    expect(isRedundantPassRejection('action.wrongPhase')).toBe(true);
  });

  it('returns FALSE for every other rejection code — nothing else is swallowable', () => {
    // A battery of codes a pass (or another action) could plausibly be rejected
    // with: genuine bugs/attacks that MUST stay visible, plus match-end and
    // engine-content rejections. None may be converted to success.
    for (const code of [
      'action.applyThrew',
      'seat.notHeld',
      'protocol.malformed',
      'protocol.missingActionId',
      'action.reservedActionId',
      'room.notPlaying', // match ended — has its own overlay; not this race
      'play.cannotBeatTop',
      'play.cannotPassLeading',
      'action.wrongPhaseXYZ', // near-miss must not match by prefix
      'action.notYourTurnZZ',
      '',
      'anything.else',
    ]) {
      expect(isRedundantPassRejection(code), `must NOT swallow ${code || '<empty>'}`).toBe(false);
    }
  });
});

// The swallow's OTHER gate — an actionId tracked as a local PASS — lives in
// GameTable. A source-structural pin (the DOM-free client suite's idiom) proves
// the two gates are AND-ed and that only pass actionIds ever enter the pending
// set, so a rejected PLAY can never be swallowed even if it somehow shared a code.
describe('GameTable swallow gating (source-structural)', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/client/GameTable.tsx'),
    'utf8',
  );

  it('only PASS actionIds enter the pending-pass set', () => {
    expect(src).toMatch(
      /if \(action\.type === 'pass' && actionId !== undefined\) \{[\s\S]*?pendingPassIds\.current\.add\(actionId\)/,
    );
  });

  it('the swallow requires BOTH the tracked-pass actionId AND the code allowlist', () => {
    // pendingPassIds.current.has(...) AND isRedundantPassRejection(...) — either
    // alone is insufficient.
    expect(src).toMatch(/pendingPassIds\.current\.has\(lastRejection\.actionId\)\s*&&\s*\n?\s*isRedundantPassRejection\(lastRejection\.error\.code\)/);
  });

  it('a swallowed rejection is cleared (never lingers to block a later real toast)', () => {
    expect(src).toMatch(/if \(passRejectionSwallowed\) \{[\s\S]*?store\.clearRejections\(\)/);
  });
});
