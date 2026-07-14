// EventFeed — a compact localized log of the last few redacted events.
//
// Lines are folded by GameTable's event fold (the store keeps only each
// seat's latest batch, so accumulation lives in the component layer), but
// the fold stores SEMANTIC data — a combo's (type, keyRank), a 1-based
// place, a card code + the level it was dealt under — not pre-localized
// strings. Localization happens HERE, at render time, via `resolveParams`.
// This is the m1 fix: a mid-session locale switch re-localizes every line
// already in the feed instead of leaving earlier lines baked in the old
// language (t() calls used to run inside the fold itself).
import { cardLabel, jokerLabel } from './CardFace';
import { comboKeyForType, placeKey, rankText } from './helpers';
import { t, type TranslationKey, type TranslationParams } from '../i18n';
import type { Card, Rank } from '../../engine/guandan/cards';
import type { JokerRank } from '../../engine/guandan/combos';
import type { ComboType } from '../../engine/guandan/types';

/** A feed-line param that resolves directly (names, raw numbers, and
 *  already locale-free glyphs like rank text) vs. one that needs a
 *  locale-aware lookup at render time. `jokerRank`, when set, is the REAL
 *  identity of a joker-keyed single/pair (keyRank is the FROZEN-TYPES 'A'
 *  placeholder there, combos.ts) — carried through so resolveFeedParams can
 *  name the joker instead of printing keyRank (the M4 "單張 A" bug). */
export type FeedParamValue =
  | string
  | number
  | { kind: 'combo'; comboType: ComboType; keyRank: Rank; jokerRank?: JokerRank }
  | { kind: 'place'; place: number }
  | { kind: 'card'; card: Card; level: Rank };

export type FeedParams = Record<string, FeedParamValue>;

export interface FeedLine {
  /** Monotonic id for React keys (assigned by the fold). */
  id: number;
  key: TranslationKey;
  params?: FeedParams;
}

export const FEED_LIMIT = 6;

/** Resolve a folded line's semantic params into the plain string/number
 *  params t() interpolates, under the CURRENT locale. Exported so a unit
 *  test can assert the same FeedLine resolves differently after
 *  setLocale() without re-running the fold (tests/unit/client/table.test.ts). */
export function resolveFeedParams(params: FeedParams | undefined): TranslationParams | undefined {
  if (params === undefined) return undefined;
  const resolved: TranslationParams = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      resolved[name] = value;
    } else if (value.kind === 'combo') {
      const rank = value.jokerRank !== undefined ? jokerLabel(value.jokerRank) : rankText(value.keyRank);
      resolved[name] = `${t(comboKeyForType(value.comboType))} ${rank}`;
    } else if (value.kind === 'place') {
      const key = placeKey(value.place);
      resolved[name] = key === null ? String(value.place) : t(key);
    } else {
      resolved[name] = cardLabel(value.card, value.level);
    }
  }
  return resolved;
}

export function EventFeed({ lines }: { lines: readonly FeedLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ol className="gd-feed" aria-label={t('game.feed.label')}>
      {lines.map((line) => (
        <li key={line.id}>{t(line.key, resolveFeedParams(line.params))}</li>
      ))}
    </ol>
  );
}
