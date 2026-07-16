// The cut ribbon's PURE geometry (obs 1) — the face-down deck spreads to the
// slider's full width and splits into two packets at the chosen point, live
// as the slider moves. Extracted so the DOM-free client suite pins the split
// decisions; CutPanel's DOM is a thin renderer of these numbers.
//
// NO numeric cut index is ever shown. The investigation (both lineages,
// headless) confirmed the exact position leaks nothing — the deck is hidden
// and the first leader is uniform over seats — so the number is unusable
// information that would only imply the choice of index matters. It doesn't;
// cutting has no numeric analogue at a physical table. The ribbon shows
// WHERE, spatially, not a count.

import { CUT_MIN, CUT_MAX } from '../../engine/guandan';

/** How many card-back slivers the ribbon draws. Deliberately coarser than
 *  the 97 legal positions: the exact index is meaningless (hidden + uniform),
 *  so the ribbon shows "roughly here", and this many slivers stays legible as
 *  a split at TRUE 390px. Purely a rendering constant — the legal cut range
 *  (engine CUT_MIN..CUT_MAX) is untouched, so legalActions/defaultAction stay
 *  exactly as they were. */
export const CUT_RIBBON_SLIVERS = 24;

/** The slider position mapped to a split fraction in [0, 1]. Monotonic in
 *  position; CUT_MIN → 0 (the whole ribbon is the right packet), CUT_MAX → 1
 *  (the whole ribbon is the left packet). Positions outside the legal band
 *  clamp (the slider never emits them, but the predicate is total). */
export function cutSplitFraction(position: number): number {
  const clamped = Math.max(CUT_MIN, Math.min(CUT_MAX, position));
  return (clamped - CUT_MIN) / (CUT_MAX - CUT_MIN);
}

/** The number of slivers in the LEFT packet at `position`; the gap opens
 *  after this many. Range 0..slivers, monotonic non-decreasing in position,
 *  and left + right === slivers for every position (conservation — the deck
 *  only ever splits, never gains or loses a card). */
export function cutLeftCount(position: number, slivers: number = CUT_RIBBON_SLIVERS): number {
  return Math.round(cutSplitFraction(position) * slivers);
}
