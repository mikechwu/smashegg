// The 'lacquer' deck theme — today's normative look, refactored behind the
// DeckTheme contract (item 5): ivory face, rosewood border, serif corner
// index; joker names as a vertical CJK strip in the left column (the fan
// overlaps each card's right side). NOTE the theme renders NO game-state
// indicator: the wild wild marker is framework-drawn over this face by
// CardFace.tsx — by design, a theme cannot touch it.
//
// Back art (research recipe): a flat rosewood field with a 1px goldleaf
// hairline inset — 1 element + pseudo-elements, no gradient stacks, cheap
// enough for 100+ concurrent nodes during the deal.

import { isJoker, rankOf, suitOf } from '../../../engine/guandan/cards';
import { isRedSuit, rankText, suitGlyph } from '../helpers';
import { t } from '../../i18n';
import { registerDeckTheme, type DeckTheme, type DeckThemeFaceProps } from '../theme';

function LacquerFace({ card, size }: DeckThemeFaceProps) {
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
    </span>
  );
}

function LacquerBack({ size }: { size: 'hand' | 'trick' | 'mini' }) {
  return <span className={`gd-card gd-card--${size} gd-cardback--lacquer`} aria-hidden="true" />;
}

export const LACQUER_THEME: DeckTheme = {
  id: 'lacquer',
  name: 'theme.lacquer.name',
  Face: LacquerFace,
  Back: LacquerBack,
  metrics: {
    aspect: 1.45,
    cornerIndexMinPx: 10,
    backEdge: 'rgba(245, 239, 227, 0.32)',
    backGradient: 'linear-gradient(160deg, #5a3a33, #35211d)',
  },
};

registerDeckTheme(LACQUER_THEME);
