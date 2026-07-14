// CardFace — ivory face, rosewood border, serif corner index (design
// system). Sizes: 'hand' (large, the fan) / 'trick' (medium, the well).
// The current-level HEART wild carries a small cinnabar corner ribbon.

import { isJoker, isWild, rankOf, suitOf, type Card, type Rank } from '../../engine/guandan/cards';
import { isRedSuit, rankText, suitGlyph } from './helpers';
import { t } from '../i18n';

export interface CardFaceProps {
  card: Card;
  /** Current level — determines the wild ribbon. */
  level: Rank;
  size: 'hand' | 'trick';
}

/** Localized accessible name of a card (buttons wrapping a CardFace use
 *  this as their aria-label). */
export function cardLabel(card: Card, level: Rank): string {
  if (card === 'SJ') return t('game.card.sj');
  if (card === 'BJ') return t('game.card.bj');
  const base = t('game.card.label', {
    suit: t(`game.suit.${suitOf(card)!}` as const),
    rank: rankText(rankOf(card)!),
  });
  return isWild(card, level) ? `${base} (${t('game.card.wild')})` : base;
}

export function CardFace({ card, level, size }: CardFaceProps) {
  const classes = [`gd-card`, `gd-card--${size}`];
  if (isJoker(card)) {
    classes.push('gd-card--joker', card === 'BJ' ? 'gd-card--red' : 'gd-card--black');
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        <span className="gd-card__joker">{card === 'BJ' ? t('game.card.bj') : t('game.card.sj')}</span>
      </span>
    );
  }
  const suit = suitOf(card)!;
  const rank = rankOf(card)!;
  classes.push(isRedSuit(suit) ? 'gd-card--red' : 'gd-card--black');
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      <span className="gd-card__index">
        <span className="gd-card__rank">{rankText(rank)}</span>
        <span className="gd-card__suit">{suitGlyph(suit)}</span>
      </span>
      {isWild(card, level) && <span className="gd-card__ribbon" />}
    </span>
  );
}
