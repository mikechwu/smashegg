// The 'cinnabar-court' deck theme (the alternate deck — 'lacquer' is
// DEFAULT_DECK_THEME_ID, theme.ts): wires the FROZEN hand-drawn geometry in
// art.tsx/pips.ts (design-lead master record, not to be edited here) behind
// the DeckTheme contract, following lacquer.tsx's idiom — index structure,
// joker wordlessness, registration.
//
// This theme draws suit shapes from the shared registry (suits.tsx —
// since the suit round the SINGLE source of suit shapes for every theme;
// suits must separate by SHAPE, not whatever heart/diamond glyph a
// platform's font ships) and paints a full body illustration (court
// bust / pip field / joker figure) under the corner index at 'hand'/'trick'
// sizes — 'mini' stays index-only, matching lacquer's own size discipline
// (the decl-chooser chips need the compact form). As with
// lacquer, NO game-state indicator is rendered here: the wild marker is
// framework-drawn over this face by CardFace.tsx.

import { isJoker, rankOf, suitOf, type Rank } from '../../../../engine/guandan/cards';
import { isRedSuit, rankText } from '../../helpers';
import { registerDeckTheme, type DeckTheme, type DeckThemeFaceProps } from '../../theme';
import { CourtFigure, SUIT_FILL, type CourtChar, type SuitChar } from './art';
import { JokerFace } from '../../jokers';
import { SUIT_PATHS, SuitMark } from '../../suits';
import { PIP_LAYOUTS, type PipSpot } from './pips';

function isCourtRank(rank: Rank): rank is CourtChar {
  return rank === 'K' || rank === 'Q' || rank === 'J';
}

/** One pip: the registry's 0 0 100 100 box is centered at (spot.x, spot.y)
 *  by translating to the spot, scaling, THEN translating back by the box's
 *  own center (50,50) — in that order, so the center lands exactly on the
 *  spot regardless of scale (translate-scale-translate commutes the anchor,
 *  not the geometry). A flip wraps the same group in a further 180° turn
 *  about that same (x,y) — a real double-ended card, not a mirrored path. */
// The registry family's ink height is ~83 of its 100 box (suits.tsx); the
// old 24x28 paths carried ~25.5-unit ink at base scale 1.35 (~34.4 units on
// the 200x290 card). 0.415 = 34.4 / 83 keeps every pip layout's rendered
// ink size unchanged through the registry migration.
const PIP_BASE_SCALE = 0.415;
function Pip({ spot, suit }: { spot: PipSpot; suit: SuitChar }) {
  const scale = (spot.scale ?? 1) * PIP_BASE_SCALE;
  const glyph = (
    <g transform={`translate(${spot.x} ${spot.y}) scale(${scale}) translate(-50 -50)`}>
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
    // Joker round: the owner's composed parts (jokers.tsx) replaced this
    // theme's own jester figures + emblems — jokers are registry parts
    // consumed by every theme, the same seam as the suits.
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        <JokerFace big={big} />
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
          {/* Registry paths fill with currentColor; the face's own
              .gd-card--red/--black class sets `color` to cinnabar/ink —
              exactly the SUIT_FILL palette the old inline fill carried. */}
          <SuitMark className="gd-ccourt__suitGlyph" suit={suit} />
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
