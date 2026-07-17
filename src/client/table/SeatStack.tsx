// SeatStack — a remote seat's hand, rendered REAL (seat-zone round): exactly
// `count` theme card backs (the framework CardBack — the SAME art the deal
// flights and the deck pile use), hand-size under heavy overlap, plus the
// count with its unit. This SUPERSEDES the old plate-internal mini-fan
// (MiniFan / FAN_CAP / .gd-plate__fan*, all deleted): the stack length IS the
// count, 1:1, so the F11 "2 must look unlike 27" doctrine now holds
// structurally with no cap. A pure presenter — GameTable computes the
// displayed count (the deal-time one-by-one growth and the pre-deal hold).
//
// Meaning is never colour-only: the exact number rides the visible label
// (unit included, so the accessible name carries it too); the stack itself is
// decorative (whole thing aria-hidden). Low-card escalation reuses
// handSizeTier (≤10 low, ≤2 critical), the critical aria reusing
// game.plate.cardsLow. Hidden-count configs (count null) render NO backs — a
// stack's length would leak the count — only the "—" chip.
//
// Geometry contract: ALL layout arithmetic lives in table.css off inline vars
// set here — --gd-stack-aspect (the ACTIVE theme's DeckThemeMetrics.aspect,
// read never hardcoded, HandFan's discipline), the per-block wrap shape
// --gd-stack-rows / --gd-stack-perrow, and per slot its --gd-stack-pos
// (lay-axis position in its row) and --gd-stack-row (cross-axis row) — against
// the two stylesheet constants --gd-stack-exposure (lay-axis step) and
// --gd-stack-linefrac (cross-axis row step). (--gd-stack-n, the SIZED count,
// is set too but is NOT read by any layout calc — it is the reserve/deal
// signal the tests pin.) Owner compaction (two or three rows): the hand wraps
// into `rows` partially-overlapping rows of `perRow` backs, so a full hand
// runs about HALF its single-line length (2 rows of 14/13). East/west strips
// rotate ±90° (top-view: each hand faces
// its player); north stays horizontal. Placement direction (R10, owner
// follow-up): every player lays cards from THEIR right to THEIR left with the
// newest on top — paint order is DOM order (slots render in arrival order, no
// z-index), and the per-direction cascade lives in the CSS: within a row
// north/east index straight while west reverses (its newest sits at the strip
// top), and each side's ROWS grow inward toward the centre from the seat's own
// edge — the two sides mirror on both axes.
//
// Deal stability (review fix): DealOverlay measures its flight-target rects
// ONCE at mount, so the ring layout must not move while cards land. During
// the deal GameTable passes `reserve` (the final per-seat count): the strip
// container is sized for THAT count from the first frame — cards fill a
// fixed-extent strip one by one instead of growing it — and the count label
// renders from 0 up (tier escalation suppressed: a hand mid-deal is not a
// low-hand alarm, and the critical tier's larger font would jitter the
// reserved layout).

import { memo, type CSSProperties } from 'react';
import { CardBack } from './CardFace';
import { handSizeTier, seatStackRows, seatStackPerRow } from './helpers';
import { useDeckTheme } from './useDeckTheme';
import { t } from '../i18n';

export type SeatStackDir = 'east' | 'north' | 'west';

export interface SeatStackProps {
  dir: SeatStackDir;
  /** Cards remaining at this seat. null = hidden from this viewer (spec §8
   *  card-count visibility): no backs, only the "—" chip. 0 (the pre-deal
   *  hold, or a deal that has not reached this seat yet) renders nothing —
   *  unless `reserve` holds the strip's extent open. */
  count: number | null;
  /** Deal-time layout reservation: size the strip (and render the counting
   *  label) for this FINAL count while only `count` backs have landed, so
   *  mid-deal landings never reflow the ring against DealOverlay's
   *  once-measured rects. Omit outside the deal choreography. */
  reserve?: number;
}

// Memoized (review note): three settled 27-card stacks are 81 theme-SVG
// CardBack subtrees, and GameTable re-renders on every 500ms countdown tick —
// primitive props make the shallow compare exact and skip all of it.
export const SeatStack = memo(function SeatStack({ dir, count, reserve }: SeatStackProps) {
  const aspect = useDeckTheme().metrics.aspect;

  if (count === null) {
    return (
      <span
        className="gd-seatstack__count gd-seatstack__count--hidden"
        aria-label={t('game.plate.hiddenCount')}
      >
        —
      </span>
    );
  }

  const reserving = reserve !== undefined;
  // The strip is sized for the reservation when one is active (deal-time),
  // for the real count otherwise; max() also keeps a stale reservation from
  // ever clipping cards that already landed.
  const sized = Math.max(count, reserve ?? 0);
  if (sized === 0) return null;

  const tier = reserving ? 'normal' : handSizeTier(count);
  const countClasses = ['gd-seatstack__count'];
  if (tier === 'low' || tier === 'critical') countClasses.push('gd-seatstack__count--low');
  if (tier === 'critical') countClasses.push('gd-seatstack__count--critical');

  // Multi-row compaction (owner "two or three rows"): the block wraps into
  // `rows` partially-overlapping rows of `perRow` backs, so a full hand runs
  // about HALF its single-line length (2 rows of 14/13). Both derive from the
  // SIZED count (reserve included), so the block is laid out for its final
  // size from the deal's first frame and cards fill it row by row without
  // reflowing. perRow is pinned at the cap once wrapped (not balanced), so the
  // lay-axis extent stays constant across the whole 15…27 range — see
  // seatStackPerRow. Each slot carries its own row (cross-axis) and in-row
  // position (lay-axis); the CSS owns the per-direction geometry off these.
  const rows = seatStackRows(sized);
  const perRow = seatStackPerRow(sized);

  // A fragment, not a wrapper: the count label and the stack are SIBLINGS of
  // the identity pill inside .gd-seatzone (R1/R3 decoupling — the zone owns
  // the column order: identity → status/count → cards, one scan line).
  return (
    <>
      <span
        className={countClasses.join(' ')}
        aria-label={tier === 'critical' ? t('game.plate.cardsLow', { count }) : undefined}
      >
        {t('game.stack.cards', { count })}
      </span>
      <span
        className={`gd-seatstack gd-seatstack--${dir}`}
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
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="gd-seatstack__slot"
            style={
              {
                '--gd-stack-i': i,
                '--gd-stack-pos': i % perRow,
                '--gd-stack-row': Math.floor(i / perRow),
              } as CSSProperties
            }
          >
            <CardBack size="hand" />
          </span>
        ))}
      </span>
    </>
  );
});
