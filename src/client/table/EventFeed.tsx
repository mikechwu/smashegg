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
 *  name the joker instead of printing keyRank (the M4 "single A" bug). */
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

// Owner round: the feed moved to a thin ~2-line bottom-bar box (table.css
// .gd-feed) that shows the newest lines by default and scrolls DOWN for
// older ones — so the retained scrollback needs to be real history, not
// just enough to fill the old taller box. 20 is folded by GameTable
// (foldEvents, component-layer — the store itself keeps no history).
export const FEED_LIMIT = 20;

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

// Owner round: DOM order is REVERSE chronological (newest line first) so the
// box's default (unscrolled) scroll position — top — already shows the
// latest lines; older history sits below, reached by scrolling down. `lines`
// itself stays in the fold's natural chronological order (foldEvents keeps
// appending; nothing about accumulation changes) — only the render order
// flips, right here, so every other consumer of a FeedLine array (tests
// included) still sees oldest-first.
//
// No scripted scroll-to-bottom: unlike an append-at-the-end log, there is
// nothing to scroll TO on a new line — it renders at the top, already in
// view. role="log" was deliberately NOT added: that role tells assistive
// tech new content arrives at the END of the region, which would misdescribe
// this prepend order. aria-live="polite" alone still announces each new
// line without asserting a reading order screen readers would get wrong.
export function EventFeed({ lines }: { lines: readonly FeedLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ol className="gd-feed" aria-label={t('game.feed.label')} aria-live="polite">
      {[...lines]
        .reverse()
        .map((line) => (
          <li key={line.id}>{t(line.key, resolveFeedParams(line.params))}</li>
        ))}
    </ol>
  );
}
