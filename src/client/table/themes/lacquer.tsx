// The 'lacquer' deck theme — today's normative look, refactored behind the
// DeckTheme contract (item 5): ivory face, rosewood border, serif corner
// index; joker faces carry a wordless SVG emblem in the left column (the
// fan overlaps each card's right side) — a filled star vs. a hollow
// lozenge, distinct by SILHOUETTE (never colour alone). Replaces a verified
// live defect: the previous vertical CJK strip used writing-mode:
// vertical-rl + text-orientation: upright, which letter-stacked the
// ENGLISH 'Joker'/'Big Joker' into overflowing single-glyph columns — that
// styling only ever worked for single CJK characters. NOTE the theme
// renders NO game-state indicator: the wild marker is framework-drawn over
// this face by CardFace.tsx — by design, a theme cannot touch it.
//
// Back art (research recipe): a flat rosewood field with a 1px goldleaf
// hairline inset — 1 element + pseudo-elements, no gradient stacks, cheap
// enough for 100+ concurrent nodes during the deal.

import { isJoker, rankOf, suitOf } from '../../../engine/guandan/cards';
import { isRedSuit, rankText, suitGlyph } from '../helpers';
import { registerDeckTheme, type DeckTheme, type DeckThemeFaceProps } from '../theme';

/** Big joker: a FILLED five-point star above two short parallel stem
 *  strokes — cinnabar, matching the joker's .gd-card--red. Nothing painted
 *  right of the 0.40 * cardw fan-visible column: the box itself (table.css
 *  .gd-card__jokerMark) is positioned+sized off --gd-cardw so its right edge
 *  never crosses 0.36 * cardw, and xMinYMid pins the drawn star/stems to the
 *  box's own left edge (the default 'meet' behaviour CENTERS a non-square
 *  viewBox in a square box, which would otherwise push the ink rightward
 *  even though the box stayed in bounds). */
function BigJokerMark() {
  return (
    <svg
      className="gd-card__jokerMark"
      viewBox="0 0 24 30"
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 1.5 14.35 7.86 21 7.86 15.7 11.77 17.86 18.13 12 14.22 6.14 18.13 8.3 11.77 3 7.86 9.65 7.86Z"
        fill="var(--cinnabar)"
      />
      <line x1="9" y1="21.5" x2="9" y2="28" stroke="var(--cinnabar)" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="21.5" x2="15" y2="28" stroke="var(--cinnabar)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Small joker: a HOLLOW stroke-only diamond/lozenge above a single stem —
 *  ink, matching the joker's .gd-card--black. Distinct from the big joker
 *  by silhouette (hollow vs. filled) as well as stem count (one vs. two),
 *  so the pair is never told apart by colour alone. Same xMinYMid left-pin
 *  as the big joker (see its comment) — kept consistent so neither mark
 *  drifts right of the other inside the shared .gd-card__jokerMark box. */
function SmallJokerMark() {
  return (
    <svg
      className="gd-card__jokerMark"
      viewBox="0 0 24 30"
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2 20 12 12 22 4 12Z" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <line x1="12" y1="24" x2="12" y2="28" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LacquerFace({ card, size }: DeckThemeFaceProps) {
  const classes = [`gd-card`, `gd-card--${size}`];
  if (isJoker(card)) {
    classes.push('gd-card--joker', card === 'BJ' ? 'gd-card--red' : 'gd-card--black');
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        {card === 'BJ' ? <BigJokerMark /> : <SmallJokerMark />}
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
        <span className="gd-card__suit">{suitGlyph(suit)}</span>
      </span>
      {/* Owner reference (mainstream Guandan look): ONE large body suit pip,
       *  the same font glyph as the corner index — never at 'mini' (a
       *  dormant size; the game UI ships hand faces everywhere, and mini's
       *  metrics stay untouched for the theme contract),
       *  so the growing hand card reads as a real face, not just
       *  a bigger index. table.css sizes it entirely off --gd-cardw and
       *  offsets it (NOT centered — see .gd-card__pip's own comment) into
       *  the card's right portion, clear of both the corner index and the
       *  framework's bottom-left wild seal (verified with real
       *  getBoundingClientRect measurements, not just arithmetic). */}
      {size !== 'mini' && <span className="gd-card__pip">{suitGlyph(suit)}</span>}
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
