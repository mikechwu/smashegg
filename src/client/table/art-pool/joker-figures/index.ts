// The joker-figure POOL registry. Every available body illustration is listed
// in JOKER_FIGURES; ACTIVE_JOKER_FIGURE names the one the joker cards use right
// now. Swapping the joker picture is this ONE line — the others stay archived
// and reusable (that is the whole point of the pool). Adding a figure: drop a
// module exporting a JokerFigure, register it here.

import { BOMB_FIGURE } from './bomb';
import { JESTER_FIGURE } from './jester';
import type { JokerFigure } from './types';

export type { JokerFigure, JokerPalette, FitBox } from './types';
export { JOKER_PALETTE, fitTransform } from './types';

/** Every joker body illustration in the pool, by name. */
export const JOKER_FIGURES: Record<string, JokerFigure> = {
  bomb: BOMB_FIGURE,
  jester: JESTER_FIGURE,
};

/** The figure the joker cards render today. Re-point to swap the picture;
 *  e.g. `JOKER_FIGURES.jester` restores the original illustration. */
export const ACTIVE_JOKER_FIGURE: JokerFigure = JOKER_FIGURES.bomb!;
