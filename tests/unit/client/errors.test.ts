// F3 ratchet (pre-M5): no rejection code the server can send may EVER appear
// on screen. describeError must return human copy in all three locales, and
// an unknown code falls back to a generic human line — never the raw code.
// This test is the regression that keeps `動作被拒絕(room.notSeated)` from
// coming back.

import { afterAll, describe, expect, it } from 'vitest';
import { describeError } from '../../../src/client/errors';
import { getLocale, setLocale, t } from '../../../src/client/i18n';
import type { Locale } from '../../../src/client/config';

// Every WireError.code the server can put on the wire (grepped from
// src/server, 2026-07-15). The no-leak assertion holds for ALL of them — an
// unmapped code still falls to error.generic (human, never a code). Separately,
// GENERIC_OK below lists the codes that are ALLOWED to be generic (unexpected /
// internal); every OTHER code must get DEDICATED copy, so a new user-actionable
// code with no mapping fails the dedicated-copy test (that is the real ratchet).
const SERVER_CODES: readonly string[] = [
  'action.notYourTurn',
  'action.wrongPhase',
  'play.cannotPassLeading',
  'play.cardsNotInHand',
  'play.declRequired',
  'play.invalidCombination',
  'play.cannotBeatTop',
  'tribute.cardNotEligible',
  'tribute.cardNotInHand',
  'match.ended',
  'room.notSeated',
  'room.startFailed',
  'room.notLobby',
  'room.notPlaying',
  'room.full',
  'room.notEnoughSeats',
  'room.notFound',
  'lobby.invalidName',
  'seat.notHeld',
  'timing.invalid',
  'action.applyThrew',
  'action.reservedActionId',
  'protocol.malformed',
  'protocol.missingActionId',
  'protocol.tooLarge',
  'protocol.unknownType',
  'config.invalid: turnDirection',
  'config.unknownKey: bogusKey',
];

const LOCALES: readonly Locale[] = ['zh-Hant', 'zh-Hans', 'en'];

// Codes allowed to fall to the generic human line — unexpected / internal, not
// user-actionable. Every OTHER server code must map to dedicated copy.
const GENERIC_OK = new Set(['action.applyThrew', 'action.reservedActionId']);

describe('describeError — F3: never leak a raw code', () => {
  const original = getLocale();
  afterAll(() => setLocale(original));

  for (const locale of LOCALES) {
    it(`${locale}: every server code yields human copy with no code fragment`, () => {
      setLocale(locale);
      for (const code of SERVER_CODES) {
        const msg = describeError(code);
        expect(msg.length).toBeGreaterThan(0);
        // The exact code string must never surface…
        expect(msg).not.toContain(code);
        // …nor any dotted `word.word` identifier fragment (human copy has none).
        expect(msg).not.toMatch(/[a-z][a-zA-Z]*\.[a-z][a-zA-Z]/);
      }
    });
  }

  it('an unknown code falls back to the generic human line, not the code', () => {
    setLocale('en');
    const msg = describeError('brand.new.unmapped.code');
    expect(msg).toBe(t('error.generic'));
    expect(msg).not.toContain('brand');
    expect(msg).not.toContain('unmapped');
  });

  it('known room/lobby codes get DEDICATED copy (not the generic fallback)', () => {
    setLocale('en');
    expect(describeError('room.notSeated')).toBe(t('error.notSeated'));
    expect(describeError('room.notSeated')).not.toBe(t('error.generic'));
    expect(describeError('room.startFailed')).toBe(t('error.startFailed'));
    expect(describeError('lobby.invalidName')).toBe(t('error.invalidName'));
  });

  it('EVERY user-actionable server code gets dedicated copy (the real ratchet)', () => {
    setLocale('en');
    const generic = t('error.generic');
    for (const code of SERVER_CODES) {
      if (GENERIC_OK.has(code)) continue;
      expect(describeError(code), `${code} must have dedicated copy, not the generic fallback`).not.toBe(
        generic,
      );
    }
  });

  it('prefix families map without the dynamic suffix (config.* / protocol.*)', () => {
    setLocale('en');
    expect(describeError('config.invalid: turnDirection')).toBe(t('error.configInvalid'));
    expect(describeError('config.unknownKey: bogusKey')).toBe(t('error.configInvalid'));
    expect(describeError('protocol.tooLarge')).toBe(t('error.protocol'));
  });

  it('in-game action codes keep their existing human copy', () => {
    setLocale('en');
    expect(describeError('play.cannotBeatTop')).toBe(t('game.error.cannotBeatTop'));
    expect(describeError('action.notYourTurn')).toBe(t('game.error.notYourTurn'));
  });
});
