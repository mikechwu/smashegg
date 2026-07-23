// Joker face registry. The card FRAME is fixed and owner-kept — the JOKER
// wordmark across the top (reading on from the top-left corner logo), the
// dollar-J logo repeated bottom-right rotated 180 like a corner index, and
// the big joker's five-point star — all from joker-art-data.ts, verbatim, no
// text nodes (the wordmark is PATHS). The BODY illustration ("main pic") is a
// swappable POOL entry (art-pool/joker-figures): the owner replaced the jester
// with the bombs, and the jester stays archived and one line from returning.
// Consumed as one composed face by both deck themes' joker branches.
//
// Big vs small never differs by colour alone:
//  • the FRAME: the big joker's marks are currentColor (the face's --red class
//    makes that cinnabar) with the star under each corner logo; the small
//    joker is all currentColor (--black → ink), no star. The star's presence
//    is the no-colour cue (elder/grayscale/fan-sliver rule).
//  • the FIGURE carries its own second cue (e.g. the bombs: filled red diamond
//    big vs outline diamond small — survives grayscale).

import type { ReactElement } from 'react';
import { JOKER_LOGO, JOKER_WORDMARK, type JokerArtPart } from './joker-art-data';
import {
  ACTIVE_JOKER_FIGURE,
  fitTransform,
  JOKER_PALETTE,
  type FitBox,
  type JokerPalette,
} from './art-pool/joker-figures';

// Re-exported so the palette override seam and its type keep their old import
// site (jokers.tsx) even though they now live with the figure pool.
export { JOKER_PALETTE, type JokerPalette };

/** The big joker's corner star (the presence-cue glyph) — the codebase's
 *  established five-point big-joker silhouette, in its own 24-unit box. */
export const JOKER_STAR_PATH =
  'M12 1.5 14.35 7.86 21 7.86 15.7 11.77 17.86 18.13 12 14.22 6.14 18.13 8.3 11.77 3 7.86 9.65 7.86Z';

// --- composition constants (card space 0 0 200 290) -------------------------
const LOGO_H = 50;
const LOGO_W = (148 / 284) * LOGO_H;
const CORNER = 8;
const STAR_SIZE = 26;

/** Where the swappable body figure is fit-placed: the card area below the
 *  wordmark/corners, centred. Any figure aspect (the 563×600 jester, the
 *  1254² bombs) fit-contains into this one box — placement is not the
 *  figure's concern. */
const BODY_FIT: FitBox = { x: 14, y: 70, w: 172, h: 206 };

/** The right edge of the corner identity column (logo + star) in the
 *  200-unit card space. The fan shows only each card's LEFT ~40% — the
 *  corner identity must stay inside 80 units or the big/small cue
 *  disappears under the neighbour card (conformance-pinned). */
export const JOKER_CORNER_MAX_X = Math.max(
  CORNER + LOGO_W,
  CORNER + LOGO_W / 2 + STAR_SIZE / 2,
);

function Part({ part }: { part: JokerArtPart }): ReactElement {
  return (
    <g transform={part.transform}>
      {part.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

function CornerMark({ big, rotated }: { big: boolean; rotated: boolean }): ReactElement {
  const mark = (
    <>
      <g transform={`translate(${CORNER} ${CORNER}) scale(${LOGO_H / 284})`}>
        <Part part={JOKER_LOGO} />
      </g>
      {big && (
        <g
          transform={`translate(${CORNER + LOGO_W / 2 - STAR_SIZE / 2} ${CORNER + LOGO_H + 3}) scale(${STAR_SIZE / 24})`}
        >
          <path d={JOKER_STAR_PATH} />
        </g>
      )}
    </>
  );
  // The bottom-right corner is the WHOLE top-left mark turned 180 about
  // the card center — a real corner-index mirror (star inward), exactly
  // like the reference.
  return rotated ? <g transform="rotate(180 100 145)">{mark}</g> : mark;
}

export interface JokerFaceProps {
  big: boolean;
  /** Palette override seam for a future theme — defaults to the deck's.
   *  Passed through to the figure's Body (a self-coloured figure ignores it). */
  palette?: JokerPalette;
}

/** The composed joker face, filling the card box (viewBox matches the
 *  1.45-aspect card space both themes' body art already uses). The frame is
 *  currentColor — the face's red/black class is the recolor path, exactly like
 *  the suit registry — and the body is the active pool figure. */
export function JokerFace({ big, palette = JOKER_PALETTE }: JokerFaceProps): ReactElement {
  const Body = ACTIVE_JOKER_FIGURE.Body;
  return (
    <svg className="gd-joker" viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <g transform={`translate(25 8) scale(${150 / 600})`}>
          <Part part={JOKER_WORDMARK} />
        </g>
        <CornerMark big={big} rotated={false} />
        <CornerMark big={big} rotated={true} />
      </g>
      <g transform={fitTransform(ACTIVE_JOKER_FIGURE.viewBox, BODY_FIT)}>
        <Body big={big} palette={palette} />
      </g>
    </svg>
  );
}
