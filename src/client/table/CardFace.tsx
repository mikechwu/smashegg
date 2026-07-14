// CardFace — ivory face, rosewood border, serif corner index (design
// system). Sizes: 'hand' (large, the fan) / 'trick' (medium, the well).
// The current-level HEART wild carries a solid cinnabar corner triangle
// with a 配 glyph at the BOTTOM-LEFT — the fan overlaps each card's right
// side, so only the left strip is reliably visible; the joker's vertical
// name sits in that same strip (left-anchored, not centered) for the same
// reason. 小王 is ink, 大王 cinnabar.

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
      {isWild(card, level) && (
        <span className="gd-card__wild">
          <span className="gd-card__wildGlyph">{t('game.card.wildBadge')}</span>
        </span>
      )}
    </span>
  );
}
