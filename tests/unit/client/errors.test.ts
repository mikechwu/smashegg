// F3 ratchet (pre-M5): no rejection code the server can send may EVER appear
// on screen. describeError must return human copy in all three locales, and
// an unknown code falls back to a generic human line — never the raw code.
// This test is the regression that keeps `動作被拒絕(room.notSeated)` from
// coming back.

import { afterAll, describe, expect, it } from 'vitest';
import { describeError } from '../../../src/client/errors';
import { getLocale, setLocale, t } from '../../../src/client/i18n';
import type { Locale } from '../../../src/client/config';

// The COMPLETE Guandan-reachable RuleError inventory (grepped from src/engine +
// src/server, 2026-07-15; guess-number's guess.* excluded — never rendered by
// this Guandan client). Leak-safety is STRUCTURAL: describeError's fallback is a
// static human key, so it can never return the input code — a leak is impossible
// for ANY code, listed or not (the forged-code test proves it). This list makes
// that concrete AND asserts DEDICATED copy for every non-GENERIC_OK code, so a
// new user-actionable code without a mapping fails the dedicated-copy test.
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
  'action.invalidSeat',
  'action.unknownType',
  'tribute.alreadyCommitted',
  'tribute.alreadyPaid',
  'tribute.alreadyReturned',
  'tribute.noPairingForSeat',
  'tribute.notAPayer',
  'tribute.notAReceiver',
  'tribute.notPaidYet',
  'config.invalidSuddenDeath',
  'config.notImplemented',
  'protocol.malformed',
  'protocol.missingActionId',
  'protocol.tooLarge',
  'protocol.unknownType',
  'config.invalid: turnDirection',
  'config.unknownKey: bogusKey',
];

const LOCALES: readonly Locale[] = ['zh-Hant', 'zh-Hans', 'en'];

// Codes allowed to fall to the generic human line — unexpected/internal (forged
// or engine-threw) and rare double-submit / wrong-role tribute edges the UI
// prevents. "Try again" is the right copy for these; every OTHER emitted code
// must map to dedicated copy. (config.* / protocol.* get dedicated copy via the
// prefix rules; guess.* codes belong to the guess-number dummy game and never
// reach this Guandan client, so they are out of scope.)
const GENERIC_OK = new Set([
  'action.applyThrew',
  'action.reservedActionId',
  'action.invalidSeat',
  'action.unknownType',
  'tribute.alreadyCommitted',
  'tribute.alreadyPaid',
  'tribute.alreadyReturned',
  'tribute.noPairingForSeat',
  'tribute.notAPayer',
  'tribute.notAReceiver',
  'tribute.notPaidYet',
]);

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

  it('leak-safe by construction: ANY forged/future code → generic human, never the code', () => {
    setLocale('en');
    const generic = t('error.generic');
    for (const code of ['brand.new.unmapped.code', 'engine.someFutureError', 'FORGEDCODE']) {
      const msg = describeError(code);
      expect(msg).toBe(generic); // static human key — no path returns the input
      expect(msg).not.toContain(code);
    }
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
