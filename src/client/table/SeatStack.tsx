// SeatStack — a remote seat's hand, rendered REAL (seat-zone round): exactly
// `count` theme card backs (the framework CardBack — the SAME art the deal
// flights and the deck pile use) at hand size under heavy overlap. This
// SUPERSEDES the old plate-internal mini-fan (MiniFan / FAN_CAP /
// .gd-plate__fan*, all deleted): the stack length IS the count, 1:1, so the
// F11 "2 must look unlike 27" doctrine holds structurally with no cap. A pure
// presenter — GameTable computes the displayed count (the deal-time one-by-one
// growth and the pre-deal hold). The block is DECORATIVE end to end
// (aria-hidden): the number itself rides the standalone SeatCount chip
// (below) on the side of the cards OPPOSITE the name pill (flank round),
// which is where the accessible name lives. Hidden-count configs (count
// null) render NOTHING here — a stack's length would leak the count;
// SeatCount shows the "—" chip.
//
// Geometry contract: ALL layout arithmetic lives in table.css off inline vars
// set here — --gd-stack-aspect (the ACTIVE theme's DeckThemeMetrics.aspect,
// read never hardcoded, HandFan's discipline), the per-block wrap shape
// --gd-stack-rows / --gd-stack-perrow, and per slot its --gd-stack-pos
// (lay-axis position in its row) and --gd-stack-row (cross-axis row) — against
// the stylesheet constants --gd-stack-exposure (lay-axis step),
// --gd-stack-linefrac (cross-axis row step = the sliver of the covered inner
// row left showing) and --gd-stack-peek (how much of the front row's height
// survives the boundary clip). (--gd-stack-n, the SIZED count, is set too but
// is NOT read by any layout calc — it is the reserve/deal signal the tests
// pin.)
//
// Wrap realism (owner refinement round): a wrapped block is a top-view of two
// lapped rows — row 0 is the FRONT row, painted OVER row 1 (z-index flips the
// rows; DOM order still resolves within a row) and clipped past the block's
// outer boundary so only --gd-stack-peek of its height shows
// (.gd-seatstack--wrapped overflow). Which backs sit where comes from
// helpers.seatStackSlot: while DEALING cards alternate rows column by column
// (1st card row 0, 2nd row 1, 3rd row 0 of the next column — the way a person
// actually lays them), settled blocks are row-major so play-time shrinkage
// peels the mostly-hidden inner row and the lay extent never moves. The two
// mappings occupy identical slots at the deal's final count, so the flip is
// invisible. Placement direction (R10) is unchanged: within a row north/east
// index straight while west reverses (its newest sits at the strip top), and
// rows grow inward toward the centre from the seat's own edge.
//
// Deal stability (review fix): DealOverlay measures its flight-target rects
// ONCE at mount, so the ring layout must not move while cards land. During
// the deal GameTable passes `reserve` (the final per-seat count): the strip
// container is sized for THAT count from the first frame — cards fill a
// fixed-extent strip one by one instead of growing it.

import { memo, type CSSProperties } from 'react';
import { CardBack } from './CardFace';
import { handSizeTier, seatStackRows, seatStackPerRow, seatStackSlot } from './helpers';
import { useDeckTheme } from './useDeckTheme';
import { t } from '../i18n';

export type SeatStackDir = 'east' | 'north' | 'west';

export interface SeatCountProps {
  /** Cards remaining. null = hidden from this viewer (spec §8) — the "—"
   *  chip; undefined = no chip at all (finished seats, the pre-deal hold). */
  count: number | null | undefined;
  /** True while the deal counts the chip up from 0 — tier escalation is
   *  suppressed (a hand mid-deal is not a low-hand alarm). */
  dealing: boolean;
}

/** The count chip, with its unit (R6) — a standalone zone element on the
 *  side of the cards OPPOSITE the name pill (flank round, owner item 2:
 *  "show the card count on the other side of the cards, not in the name
 *  overlay"). Carries the handSizeTier escalation and the accessible number
 *  (the stack itself is decorative). */
export function SeatCount({ count, dealing }: SeatCountProps) {
  if (count === undefined) return null;
  if (count === null) {
    return (
      <span className="gd-seatcount gd-seatcount--hidden" aria-label={t('game.plate.hiddenCount')}>
        —
      </span>
    );
  }
  const tier = dealing ? 'normal' : handSizeTier(count);
  const classes = ['gd-seatcount'];
  if (tier === 'low' || tier === 'critical') classes.push('gd-seatcount--low');
  if (tier === 'critical') classes.push('gd-seatcount--critical');
  return (
    <span
      className={classes.join(' ')}
      aria-label={tier === 'critical' ? t('game.plate.cardsLow', { count }) : undefined}
    >
      {t('game.stack.cards', { count })}
    </span>
  );
}

export interface SeatStackProps {
  dir: SeatStackDir;
  /** Cards remaining at this seat. null = hidden from this viewer (spec §8
   *  card-count visibility): render NOTHING — a stack's length would state
   *  the number (the pill's "—" chip is the visible signal). 0 (the pre-deal
   *  hold, or a deal that has not reached this seat yet) renders nothing —
   *  unless `reserve` holds the strip's extent open. */
  count: number | null;
  /** Deal-time layout reservation: size the strip for this FINAL count while
   *  only `count` backs have landed, so mid-deal landings never reflow the
   *  ring against DealOverlay's once-measured rects. Also selects the
   *  alternating-row deal mapping (seatStackSlot). Omit outside the deal
   *  choreography. */
  reserve?: number;
}

// Memoized (review note): three settled 27-card stacks are 81 theme-SVG
// CardBack subtrees, and GameTable re-renders on every 500ms countdown tick —
// primitive props make the shallow compare exact and skip all of it.
export const SeatStack = memo(function SeatStack({ dir, count, reserve }: SeatStackProps) {
  const aspect = useDeckTheme().metrics.aspect;

  if (count === null) return null;

  const reserving = reserve !== undefined;
  // The strip is sized for the reservation when one is active (deal-time),
  // for the real count otherwise; max() also keeps a stale reservation from
  // ever clipping cards that already landed.
  const sized = Math.max(count, reserve ?? 0);
  if (sized === 0) return null;

  const rows = seatStackRows(sized);
  const perRow = seatStackPerRow(sized);
  const classes = ['gd-seatstack', `gd-seatstack--${dir}`];
  // Only a WRAPPED block clips (the front row's outer half rides past the
  // boundary); a single-line block still shows whole cards, exactly as the
  // pre-wrap build did.
  if (rows > 1) classes.push('gd-seatstack--wrapped');

  return (
    <span
      className={classes.join(' ')}
      aria-hidden="true"
      style={
        {
          '--gd-stack-n': sized,
          '--gd-stack-aspect': aspect,
          '--gd-stack-rows': rows,
          '--gd-stack-perrow': perRow,
        } as CSSProperties
      }
    >
      {Array.from({ length: count }, (_, i) => {
        const { row, pos } = seatStackSlot(i, sized, reserving);
        return (
          <span
            key={i}
            className="gd-seatstack__slot"
            style={
              {
                '--gd-stack-i': i,
                '--gd-stack-pos': pos,
                '--gd-stack-row': row,
              } as CSSProperties
            }
          >
            <CardBack size="hand" />
          </span>
        );
      })}
    </span>
  );
});
