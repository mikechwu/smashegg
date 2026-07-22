// Suit artwork registry — the SINGLE SOURCE OF TRUTH for suit shapes (owner
// round, 2026-07-22). Every surface that draws a suit consumes these paths:
// theme corner indices, body pips, the ghost faces, the desk/chooser run
// text. No rendered surface may use a Unicode suit character (U+2660..2667)
// — a font/emoji suit renders as a COLOR EMOJI on some Chinese-brand Android
// builds (the bug this registry removes structurally); the no-suit-codepoint
// scan in tests/unit/client/suit-marks.test.ts enforces it.
//
// The four paths are the owner's, normalized as a family (scratchpad
// normalize-suits.mjs, kept re-runnable): ink centered at (50,50) in the
// 0 0 100 100 box; ink heights S 82 / H 82 / C 84 / D 87 with the heart
// x-squeezed 10% and the diamond +6% — targets derived from measuring a
// mature typeface's suit balance (near-equal height; heart naturally
// heavier than spade; diamond narrow but size-compensated). For size math
// at consumer sites: family ink height ~= 0.83 of the viewBox.
//
// Seam note (owner): jokers and court cards are slated to move behind this
// same registry idiom next — add further part maps/components HERE (keyed
// like SUIT_PATHS), not inline SVG at call sites.
//
// Color is ALWAYS the consumer's: paths fill with currentColor, so the
// red/black card classes — and any future DeckTheme palette — recolor them
// via `color` with no per-theme path copies.

import type { Suit } from '../../engine/guandan/cards';

export const SUIT_VIEWBOX = '0 0 100 100';

export const SUIT_PATHS: Record<Suit, string> = {
  S: 'M50 9 C30.99 29.5 11.98 39.75 11.98 55.13 C11.98 75.62 30.99 80.75 47.15 65.37 C45.25 75.62 38.59 85.87 29.09 91 L70.91 91 C61.41 85.87 54.75 75.62 51.9 65.37 C69.01 80.75 88.02 75.62 88.02 55.13 C88.02 39.75 69.01 29.5 50 9 Z',
  H: 'M50 20.89 C34.81 0.11 11.44 7.9 11.44 33.87 C11.44 52.05 25.46 72.82 50 91 C74.54 72.82 88.56 52.05 88.56 33.87 C88.56 7.9 65.19 0.11 50 20.89 Z',
  D: 'M50 6.5 L82.63 50 L50 93.5 L17.38 50 Z',
  C: 'M34.35 92 C39.24 88.09 44.13 79.28 47.07 68.52 A19.57 19.57 0 1 1 41.2 45.04 A19.57 19.57 0 1 1 58.8 45.04 A19.57 19.57 0 1 1 52.93 68.52 C55.87 79.28 60.76 88.09 65.65 92 Z',
};

export interface SuitMarkProps {
  suit: Suit;
  className?: string;
  /** Accessible name (the localized suit word). Omitted = aria-hidden —
   *  right for card faces, whose wrapping frame is already aria-hidden and
   *  whose accessible identity is the button's cardLabel. Provide it in
   *  TEXT surfaces (the desk status, the chooser label) where the mark
   *  carries information a screen reader would otherwise lose. */
  label?: string;
}

/** The one suit-drawing part. Base size rides the surrounding font
 *  (.gd-suit is 0.84em square, matching the old font glyph's ~0.7em ink);
 *  card-metric sites override with --gd-cardw math via their own class. */
export function SuitMark({ suit, className, label }: SuitMarkProps) {
  return (
    <svg
      className={className !== undefined ? `gd-suit ${className}` : 'gd-suit'}
      viewBox={SUIT_VIEWBOX}
      {...(label !== undefined ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}
