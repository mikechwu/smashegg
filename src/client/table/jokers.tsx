// Joker face registry (joker round, 2026-07-22) — the owner's three SVG
// parts (figure illustration / JOKER wordmark / the dollar-J logo,
// joker-art-data.ts, verbatim) composed per the owner's reference: wordmark
// across the top reading on from the top-left corner logo, the logo
// repeated bottom-right rotated 180 like a corner index, the illustration
// filling the body. Consumed as PARTS by both deck themes' joker branches
// (never inline SVG at call sites) — the same registry seam the suits
// established (suits.tsx); court cards are slated to come through this
// door next.
//
// The two variants differ by COLORING and by SHAPE, never color alone:
//  • small joker: every part monochrome (currentColor — the face's
//    .gd-card--black class makes that ink);
//  • big joker: logo + wordmark in currentColor (the face's --red class
//    makes that cinnabar) and the illustration in FULL COLOR — flat
//    palette patches UNDER the open black linework (screen-print idiom;
//    JOKER_PALETTE below is the one place a future theme would swap);
//  • the NO-COLOR cue (elder/grayscale/fan-sliver rule): the big joker
//    carries a solid five-point star under each corner logo — presence of
//    the star, plus the big joker's shaded body masses, distinguish the
//    pair when hue cannot (verified at 50/36px, grayscale, 40% sliver).
// No text nodes anywhere on a joker face (deck contract): the wordmark is
// the owner's PATHS, not lettering.

import type { ReactElement } from 'react';
import { JOKER_FIGURE, JOKER_LOGO, JOKER_WORDMARK, type JokerArtPart } from './joker-art-data';

/** The big joker illustration's flat palette — kept in ONE place so a
 *  future theme can swap it (table tokens where the table already has the
 *  hue; the regal vest purple is the deck's own). The small joker uses
 *  none of this (monochrome currentColor). */
export interface JokerPalette {
  red: string;
  gold: string;
  ink: string;
  purple: string;
}
export const JOKER_PALETTE: JokerPalette = {
  red: 'var(--cinnabar)',
  gold: 'var(--goldleaf)',
  ink: 'var(--ink)',
  purple: '#4a2d68',
};

/** Flat color underlays for the big joker, in the figure's 0 0 563 600
 *  space, painted UNDER the black linework (the trace is open line art, so
 *  patches read as fills; edges hide beneath the drawn lines). Authored
 *  for THIS figure against the owner's reference composition. */
const COLOR_PATCHES: readonly { d: string; color: keyof JokerPalette }[] = [
  // crown
  { d: 'M266 26 A44 20 0 1 0 354 26 A44 20 0 1 0 266 26 Z', color: 'gold' },
  { d: 'M272 28 H348 V44 H272 Z', color: 'gold' },
  // mantle + cape + robe front + sleeves
  { d: 'M252 128 L300 108 L340 108 L440 122 L448 155 L400 165 L350 158 L300 168 L258 156 Z', color: 'red' },
  { d: 'M340 125 L460 135 L515 205 L540 290 L498 325 L432 322 L398 250 L365 175 Z', color: 'red' },
  { d: 'M258 155 L295 162 L295 255 L262 250 Z', color: 'red' },
  { d: 'M165 100 L245 112 L240 155 L160 145 Z', color: 'red' },
  { d: 'M365 102 L450 104 L455 148 L372 158 Z', color: 'red' },
  // vest + pendant
  { d: 'M292 118 H334 V226 H292 Z', color: 'purple' },
  { d: 'M310 132 L324 154 L310 176 L296 154 Z', color: 'gold' },
  // belt + buckle
  { d: 'M290 228 H338 V246 H290 Z', color: 'ink' },
  { d: 'M305 230 H327 V245 H305 Z', color: 'gold' },
  // pants + boot
  { d: 'M285 252 L360 252 L372 350 L300 368 Z', color: 'ink' },
  { d: 'M305 375 L380 360 L398 445 L322 472 Z', color: 'red' },
  // tank + tank diamond + headlight
  { d: 'M222 258 L325 258 L322 328 L228 318 Z', color: 'red' },
  { d: 'M272 275 L302 293 L285 318 L258 298 Z', color: 'gold' },
  { d: 'M135 235 A30 30 0 1 0 195 235 A30 30 0 1 0 135 235 Z', color: 'gold' },
  // front fender + rear fender bar
  { d: 'M78 312 L180 310 L174 346 L82 348 Z', color: 'red' },
  { d: 'M405 360 L505 363 L502 390 L408 388 Z', color: 'red' },
];

/** The big joker's corner star (the presence-cue glyph) — the codebase's
 *  established five-point big-joker silhouette, in its own 24-unit box. */
export const JOKER_STAR_PATH =
  'M12 1.5 14.35 7.86 21 7.86 15.7 11.77 17.86 18.13 12 14.22 6.14 18.13 8.3 11.77 3 7.86 9.65 7.86Z';

// --- composition constants (card space 0 0 200 290) -------------------------
const LOGO_H = 50;
const LOGO_W = (148 / 284) * LOGO_H;
const CORNER = 8;
const STAR_SIZE = 26;

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
  /** Palette override seam for a future theme — defaults to the deck's. */
  palette?: JokerPalette;
}

/** The composed joker face, filling the card box (viewBox matches the
 *  1.45-aspect card space both themes' body art already uses). Single-color
 *  parts (wordmark, corner logos, star; the small joker's whole figure)
 *  fill with currentColor — the face's red/black class is the recolor
 *  path, exactly like the suit registry. */
export function JokerFace({ big, palette = JOKER_PALETTE }: JokerFaceProps): ReactElement {
  return (
    <svg className="gd-joker" viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <g transform={`translate(25 8) scale(${150 / 600})`}>
          <Part part={JOKER_WORDMARK} />
        </g>
        <CornerMark big={big} rotated={false} />
        <CornerMark big={big} rotated={true} />
      </g>
      <g transform="translate(14 72) scale(0.30)">
        {big && (
          <g>
            {COLOR_PATCHES.map(({ d, color }, i) => (
              <path key={i} d={d} fill={palette[color]} />
            ))}
          </g>
        )}
        <g fill={big ? palette.ink : 'currentColor'}>
          <Part part={JOKER_FIGURE} />
        </g>
      </g>
    </svg>
  );
}
