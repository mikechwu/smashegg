// CardFace — ivory face, rosewood border, serif corner index (design
// system). Sizes: 'hand' (large, the fan) / 'trick' (medium, the well) /
// 'mini' (the decl chooser's chips and result rows).
// The current-level HEART wild carries a solid cinnabar corner triangle
// with a 配 glyph at the BOTTOM-LEFT — the fan overlaps each card's right
// side, so only the left strip is reliably visible; the joker's vertical
// name sits in that same strip (left-anchored, not centered) for the same
// reason. 小王 is ink, 大王 cinnabar.

import { isJoker, isWild, rankOf, suitOf, type Card, type Rank, type Suit } from '../../engine/guandan/cards';
import type { JokerRank } from '../../engine/guandan/combos';
import type { CanonicalForm } from '../../engine/guandan/types';
import { declJokerRank, isRedSuit, rankText, suitGlyph } from './helpers';
import { t } from '../i18n';

export type CardFaceSize = 'hand' | 'trick' | 'mini';

export interface CardFaceProps {
  card: Card;
  /** Current level — determines the wild ribbon. */
  level: Rank;
  size: CardFaceSize;
}

/** Localized joker name (小王/大王, Joker/Big Joker) — level-independent
 *  (jokers are never wild), so it needs no card/level context. Factored out
 *  of {@link cardLabel} so combo labels can name a joker-keyed single/pair
 *  (bug: playing a lone BJ rendered as "單張 A" — the FROZEN-TYPES keyRank
 *  'A' placeholder leaking into the label instead of jokerRank, the real
 *  identity — see {@link comboRankLabel}) without needing a Card/level. */
export function jokerLabel(rank: JokerRank): string {
  return rank === 'BJ' ? t('game.card.bj') : t('game.card.sj');
}

/** Localized accessible name of a card (buttons wrapping a CardFace use
 *  this as their aria-label). */
export function cardLabel(card: Card, level: Rank): string {
  if (isJoker(card)) return jokerLabel(card);
  const base = t('game.card.label', {
    suit: t(`game.suit.${suitOf(card)!}` as const),
    rank: rankText(rankOf(card)!),
  });
  return isWild(card, level) ? `${base} (${t('game.card.wild')})` : base;
}

/** The combo label's "rank" segment: every call site that renders a decl as
 *  `${t(comboKey(decl))} ${<rank segment>}` (TrickWell caption, ActionBar's
 *  chooser + its aria label) must route the rank segment through here so a
 *  joker-keyed single/pair (decl.jokerRank set, FROZEN-TYPES NOTE in
 *  combos.ts) names the joker instead of printing the never-compared
 *  keyRank 'A' placeholder. Total over every CanonicalForm shape — the
 *  chooser never actually offers a jokerRank decl (jokers take no wild
 *  substitutions), but this still resolves correctly if one ever reached
 *  it. */
export function comboRankLabel(decl: CanonicalForm): string {
  const jokerRank = declJokerRank(decl);
  return jokerRank !== undefined ? jokerLabel(jokerRank) : rankText(decl.keyRank);
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

export interface GhostFaceProps {
  rank: Rank;
  /** null ⇒ suit-blind target: rank only, no suit glyph, ink-colored —
   *  the engine never picks a suit for it (wild-chooser-ux.md §2.5). */
  suit: Suit | null;
  size: CardFaceSize;
}

/** The identity a wild plays as (the chooser's substituted faces). Always
 *  carries the same cinnabar 配 corner marker the wild's own face uses —
 *  one convention, one meaning: the wild is at work on this card (§2.3). */
export function GhostFace({ rank, suit, size }: GhostFaceProps) {
  const classes = ['gd-card', `gd-card--${size}`, 'gd-card--ghost'];
  if (suit !== null) classes.push(isRedSuit(suit) ? 'gd-card--red' : 'gd-card--black');
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      <span className="gd-card__index">
        <span className="gd-card__rank">{rankText(rank)}</span>
        {suit !== null && <span className="gd-card__suit">{suitGlyph(suit)}</span>}
      </span>
      <span className="gd-card__wild">
        <span className="gd-card__wildGlyph">{t('game.card.wildBadge')}</span>
      </span>
    </span>
  );
}
