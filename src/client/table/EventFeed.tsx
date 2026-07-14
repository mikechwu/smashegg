// EventFeed — a compact localized log of the last few redacted events.
// Lines are pre-localized FeedLine records built by GameTable's event fold
// (the store keeps only each seat's latest batch, so accumulation lives in
// the component layer).

import { t, type TranslationKey, type TranslationParams } from '../i18n';

export interface FeedLine {
  /** Monotonic id for React keys (assigned by the fold). */
  id: number;
  key: TranslationKey;
  params?: TranslationParams;
}

export const FEED_LIMIT = 6;

export function EventFeed({ lines }: { lines: readonly FeedLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ol className="gd-feed" aria-label={t('game.feed.label')}>
      {lines.map((line) => (
        <li key={line.id}>{t(line.key, line.params)}</li>
      ))}
    </ol>
  );
}
