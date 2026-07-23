// ARCHIVED joker figure — the jester-on-a-motorcycle illustration (joker
// round, 2026-07-22). Kept reusable in the pool after the owner swapped the
// active figure to the bombs: re-point ACTIVE_JOKER_FIGURE in ./index.ts to
// bring it back. This module reproduces the ORIGINAL rendering exactly — the
// verbatim JOKER_FIGURE paths (still in ../../joker-art-data) recoloured per
// variant, with the big joker's flat colour patches painted UNDER the open
// black linework (screen-print idiom). The paths themselves are untouched.

import type { ReactElement } from 'react';
import { JOKER_FIGURE } from '../../joker-art-data';
import type { JokerFigure, JokerPalette } from './types';

/** Flat colour underlays for the big joker, in the figure's 0 0 563 600
 *  space, painted UNDER the black linework (the trace is open line art, so
 *  patches read as fills; edges hide beneath the drawn lines). */
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

function JesterBody({ big, palette }: { big: boolean; palette: JokerPalette }): ReactElement {
  return (
    <>
      {big && (
        <g>
          {COLOR_PATCHES.map(({ d, color }, i) => (
            <path key={i} d={d} fill={palette[color]} />
          ))}
        </g>
      )}
      <g transform={JOKER_FIGURE.transform} fill={big ? palette.ink : 'currentColor'}>
        {JOKER_FIGURE.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </>
  );
}

export const JESTER_FIGURE: JokerFigure = {
  name: 'jester',
  viewBox: JOKER_FIGURE.viewBox,
  Body: JesterBody,
};
