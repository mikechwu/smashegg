// The 'cinnabar-court' deck theme (the alternate deck — 'lacquer' is
// DEFAULT_DECK_THEME_ID, theme.ts): wires the FROZEN hand-drawn geometry in
// art.tsx/pips.ts (design-lead master record, not to be edited here) behind
// the DeckTheme contract, following lacquer.tsx's idiom — index structure,
// joker wordlessness, registration.
//
// Unlike lacquer (font-glyph suits + no body art), this theme draws its OWN
// suit glyphs from SUIT_PATHS (suits must separate by SHAPE, not whatever
// ♥/♦ a platform's font ships) and paints a full body illustration (court
// bust / pip field / joker figure) under the corner index at 'hand'/'trick'
// sizes — 'mini' stays index-only, matching lacquer's own size discipline
// (the decl-chooser chips need the compact form). As with
// lacquer, NO game-state indicator is rendered here: the wild marker is
// framework-drawn over this face by CardFace.tsx.

import { isJoker, rankOf, suitOf, type Rank } from '../../../../engine/guandan/cards';
import { isRedSuit, rankText } from '../../helpers';
import { registerDeckTheme, type DeckTheme, type DeckThemeFaceProps } from '../../theme';
import {
  BigJokerEmblem,
  BigJokerFigure,
  CourtFigure,
  SmallJokerEmblem,
  SmallJokerFigure,
  SUIT_FILL,
  SUIT_GLYPH_VIEWBOX,
  SUIT_PATHS,
  type CourtChar,
  type SuitChar,
} from './art';
import { PIP_LAYOUTS, type PipSpot } from './pips';

function isCourtRank(rank: Rank): rank is CourtChar {
  return rank === 'K' || rank === 'Q' || rank === 'J';
}

/** One pip: SUIT_PATHS' 24x28 box is centered at (spot.x, spot.y) by
 *  translating to the spot, scaling, THEN translating back by the box's
 *  own center (12,14) — in that order, so the center lands exactly on the
 *  spot regardless of scale (translate-scale-translate commutes the anchor,
 *  not the geometry). A flip wraps the same group in a further 180° turn
 *  about that same (x,y) — a real double-ended card, not a mirrored path. */
function Pip({ spot, suit }: { spot: PipSpot; suit: SuitChar }) {
  const scale = (spot.scale ?? 1) * 1.35;
  const glyph = (
    <g transform={`translate(${spot.x} ${spot.y}) scale(${scale}) translate(-12 -14)`}>
      <path d={SUIT_PATHS[suit]} fill={SUIT_FILL[suit]} />
    </g>
  );
  return spot.flip ? <g transform={`rotate(180 ${spot.x} ${spot.y})`}>{glyph}</g> : glyph;
}

/** Number-card body: the classic French pip field (pips.ts), scaled up
 *  1.35x from the raw path units so a single ace pip still reads as a
 *  suit mark at ship sizes, not a speck lost in the 200x290 card space. */
function PipField({ suit, rank }: { suit: SuitChar; rank: string }) {
  const layout = PIP_LAYOUTS[rank] ?? [];
  return (
    <svg className="gd-ccourt__pips" viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      {layout.map((spot, i) => (
        <Pip key={i} spot={spot} suit={suit} />
      ))}
    </svg>
  );
}

function CinnabarCourtFace({ card, size }: DeckThemeFaceProps) {
  if (isJoker(card)) {
    const big = card === 'BJ';
    const classes = ['gd-card', `gd-card--${size}`, 'gd-ccourt', 'gd-card--joker', big ? 'gd-card--red' : 'gd-card--black'];
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        {/* DOM order matters, not just z-index: .gd-ccourt__body and
            .gd-ccourt__jokerEmblem are both position: absolute with no
            explicit z-index, so within their shared stacking bucket the
            LATER one paints on top — body first keeps the emblem legible
            over the full figure. */}
        {size !== 'mini' && (
          <span className="gd-ccourt__body">{big ? <BigJokerFigure /> : <SmallJokerFigure />}</span>
        )}
        <span className="gd-ccourt__jokerEmblem">{big ? <BigJokerEmblem /> : <SmallJokerEmblem />}</span>
      </span>
    );
  }

  const suit = suitOf(card)!;
  const rank = rankOf(card)!;
  const classes = ['gd-card', `gd-card--${size}`, 'gd-ccourt', isRedSuit(suit) ? 'gd-card--red' : 'gd-card--black'];
  const rankClasses = rank === 'T' ? ['gd-card__rank', 'gd-ccourt__rank--ten'] : ['gd-card__rank'];

  return (
    <span className={classes.join(' ')} aria-hidden="true">
      {/* Same DOM-before-index ordering as the joker branch above — see
          .gd-card__index's `position: relative` in table.css, which is
          what promotes it into the same paint-order bucket as this
          absolutely-positioned body so tree order (index after body)
          decides who's on top. */}
      {size !== 'mini' && (
        <span className="gd-ccourt__body">
          {isCourtRank(rank) ? <CourtFigure figure={rank} suit={suit} /> : <PipField suit={suit} rank={rank} />}
        </span>
      )}
      <span className="gd-card__index">
        <span className={rankClasses.join(' ')}>{rankText(rank)}</span>
        <span className="gd-card__suit">
          <svg
            className="gd-ccourt__suitGlyph"
            viewBox={SUIT_GLYPH_VIEWBOX}
            aria-hidden="true"
            focusable="false"
          >
            <path d={SUIT_PATHS[suit]} fill={SUIT_FILL[suit]} />
          </svg>
        </span>
      </span>
    </span>
  );
}

/** Cinnabar Court's back: a flat DEEP-cinnabar field (cinnabar mixed toward
 *  the table's lacquer dark) — same cheap recipe as lacquer's back (one
 *  flat fill + a hairline inset pseudo-element, no gradient stacks, the
 *  deal renders 100+ of these) — plus a small centered goldleaf motif. The
 *  motif is deliberately ANGULAR (diamond petals) and gold-ON-deep-red:
 *  the framework's cinnabar wild seal is round (ivory petals on a cinnabar
 *  disc) and means GAME STATE, so this back must never share its silhouette
 *  or palette or a player could mistake a face-down deck card for a wild. */
function CinnabarCourtBack({ size }: { size: 'hand' | 'trick' | 'mini' }) {
  return <span className={`gd-card gd-card--${size} gd-cardback--ccourt`} aria-hidden="true" />;
}

export const CINNABAR_COURT_THEME: DeckTheme = {
  id: 'cinnabar-court',
  name: 'theme.cinnabarCourt.name',
  Face: CinnabarCourtFace,
  Back: CinnabarCourtBack,
  metrics: {
    aspect: 1.45,
    cornerIndexMinPx: 10,
    // Unchanged (its own design round): the vertical rank+suit column needs
    // the taller strip a one-line horizontal index (lacquer) does not.
    stackStripW: 0.841,
    // Distinct hue family from lacquer's ivory-edge/rosewood-brown pair —
    // contract-retained back tokens (see DeckThemeMetrics.backEdge).
    backEdge: 'rgba(201, 162, 39, 0.45)',
    backGradient: 'linear-gradient(160deg, #8a2b21, #3a0f0a)',
  },
};

registerDeckTheme(CINNABAR_COURT_THEME);
