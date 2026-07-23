// The 'lacquer' deck theme — today's normative look, refactored behind the
// DeckTheme contract (item 5): ivory face, rosewood border, serif corner
// index; joker faces are the OWNER's composed parts (joker round —
// jokers.tsx: wordmark + corner logos + figure; the big/small pair
// separates by the corner star and body shading, never colour alone),
// which replaced this theme's earlier emblem marks — and before those, the
// verified live defect of a vertical CJK letter-stacked 'Joker' strip.
// NOTE the theme renders NO game-state indicator: the wild marker is
// framework-drawn over this face by CardFace.tsx — by design, a theme
// cannot touch it.
//
// Back art (research recipe): a flat rosewood field with a 1px goldleaf
// hairline inset — 1 element + pseudo-elements, no gradient stacks, cheap
// enough for 100+ concurrent nodes during the deal.

import { isJoker, rankOf, suitOf } from '../../../engine/guandan/cards';
import { isRedSuit, rankText } from '../helpers';
import { JokerFace } from '../jokers';
import { SuitMark } from '../suits';
import { registerDeckTheme, type DeckTheme, type DeckThemeFaceProps } from '../theme';

function LacquerFace({ card, size }: DeckThemeFaceProps) {
  const classes = [`gd-card`, `gd-card--${size}`];
  if (isJoker(card)) {
    classes.push('gd-card--joker', card === 'BJ' ? 'gd-card--red' : 'gd-card--black');
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        <JokerFace big={card === 'BJ'} />
      </span>
    );
  }
  const suit = suitOf(card)!;
  const rank = rankOf(card)!;
  classes.push(isRedSuit(suit) ? 'gd-card--red' : 'gd-card--black');
  // Owner reference (corner index reads HORIZONTALLY): rank then suit glyph
  // side by side, not stacked. --row is a LACQUER-scoped modifier on the
  // shared .gd-card__index span, not a change to the generic column layout
  // itself — GhostFace and cinnabar-court reuse that generic layout and must
  // stay untouched (both keep rendering a plain .gd-card__index column).
  // NEVER at 'mini' either — the size is DORMANT now (the decl chooser
  // moved to hand-size faces; the game UI ships no mini cards anywhere),
  // but the gate stays so a future mini consumer inherits the plain column
  // layout, not the hand row.
  // rankText('T') is the only two-glyph rank ('10'); at the shared row
  // font-size the extra glyph would push the row past its 0.65w fit budget,
  // so it alone takes the reduced --row10 modifier.
  const indexClasses = ['gd-card__index'];
  if (size !== 'mini') indexClasses.push('gd-card__index--row');
  const rankClasses = ['gd-card__rank'];
  if (size !== 'mini' && rank === 'T') rankClasses.push('gd-card__rank--row10');
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      <span className={indexClasses.join(' ')}>
        <span className={rankClasses.join(' ')}>{rankText(rank)}</span>
        <span className="gd-card__suit">
          <SuitMark suit={suit} />
        </span>
      </span>
      {/* Owner reference (mainstream Guandan look): ONE large body suit pip,
       *  the same shared SuitMark part as the corner index — never at 'mini'
       *  (a dormant size; the game UI ships hand faces everywhere, and
       *  mini's metrics stay untouched for the theme contract),
       *  so the growing hand card reads as a real face, not just
       *  a bigger index. table.css sizes it entirely off --gd-cardw and
       *  offsets it (NOT centered — see .gd-card__pip's own comment) into
       *  the card's right portion, clear of both the corner index and the
       *  framework's bottom-left wild seal (verified with real
       *  getBoundingClientRect measurements, not just arithmetic). */}
      {size !== 'mini' && <SuitMark className="gd-card__pip" suit={suit} />}
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
    // One horizontal index line needs only its own height, not the two-line
    // vertical column cinnabar-court's own metric still claims.
    stackStripW: 0.42,
    backEdge: 'rgba(245, 239, 227, 0.32)',
    backGradient: 'linear-gradient(160deg, #5a3a33, #35211d)',
  },
};

registerDeckTheme(LACQUER_THEME);
