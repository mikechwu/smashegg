// Single source of USER-FACING error copy (pre-M5 UX, F3). Every rejection
// the server can send — room/lobby/seat/timing/config/protocol/action/play/
// tribute/match — maps to a localized human sentence here, and an UNKNOWN
// code falls back to a generic human line, NEVER the raw code. Semantic codes
// are for logs (RoomConnection still logs them), not for players: a family
// member should never read `room.notSeated` on screen.
//
// Both surfaces that show a rejection — the app-shell banner (RoomPage) and
// the in-table toast (GameTable) — call describeError, so the mapping can
// never diverge between them.

import { t, type TranslationKey } from './i18n';

/** Exact code → human i18n key. Codes are the WireError.code values the
 *  server emits (grepped from src/server). Anything not here is handled by
 *  the prefix rules or the generic fallback below. */
const MESSAGE_KEY: Record<string, TranslationKey> = {
  // in-game action rejections (already-human game.error.* copy)
  'action.notYourTurn': 'game.error.notYourTurn',
  'action.wrongPhase': 'game.error.wrongPhase',
  'play.cannotPassLeading': 'game.error.cannotPassLeading',
  'play.cardsNotInHand': 'game.error.cardsNotInHand',
  'play.declRequired': 'game.error.declRequired',
  'play.invalidCombination': 'game.error.invalidCombination',
  'play.cannotBeatTop': 'game.error.cannotBeatTop',
  'tribute.cardNotEligible': 'game.error.tributeCardNotEligible',
  'tribute.cardNotInHand': 'game.error.cardsNotInHand',
  'match.ended': 'game.error.matchEnded',
  // lobby / room / seat / timing rejections
  'room.notSeated': 'error.notSeated',
  'room.startFailed': 'error.startFailed',
  'room.notLobby': 'error.notLobby',
  'room.notPlaying': 'error.notPlaying',
  'room.full': 'error.roomFull',
  'room.notEnoughSeats': 'error.notEnoughSeats',
  'lobby.invalidName': 'error.invalidName',
  'seat.taken': 'error.seatTaken',
  'seat.notHeld': 'error.seatNotHeld',
  'timing.invalid': 'error.timingInvalid',
  // The WS hello path can reject with room.notFound; reuse the existing
  // human copy the RoomPage existence check already shows.
  'room.notFound': 'room.notFound',
};

/** Prefix rules for codes that carry a dynamic suffix (e.g.
 *  `config.invalid: turnDirection`, `config.unknownKey: foo`) or a family we
 *  collapse to one message (`protocol.*`). Checked only after an exact miss. */
function prefixMessageKey(code: string): TranslationKey | null {
  if (code.startsWith('config.')) return 'error.configInvalid';
  if (code.startsWith('protocol.')) return 'error.protocol';
  return null;
}

/** Localized human sentence for a rejection code — never the raw code. */
export function describeError(code: string): string {
  const key = MESSAGE_KEY[code] ?? prefixMessageKey(code) ?? 'error.generic';
  return t(key);
}
