// HandFan — the viewer's own hand as an overlapping fan (~60% overlap).
// Cards are buttons (visible keyboard focus, design-system quality floor);
// tap toggles multi-selection (lift + cinnabar edge). Selection is by
// POSITION, not identity: two copies of the same card are distinct slots.
// Wraps to ≤2 balanced rows so 27 cards fit a 375px phone.

import type { Card, Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel } from './CardFace';
import { t } from '../i18n';

/** Above this the fan splits into two rows (27-card deals → 14+13). */
const MAX_PER_ROW = 14;

export interface HandFanProps {
  /** Already sorted by the engine's playerView (sortCards), ascending. */
  hand: readonly Card[];
  level: Rank;
  selected: ReadonlySet<number>;
  onToggle: (index: number) => void;
  /** Tribute-phase eligible cards glow (PLAN §5 hint highlighting). */
  glow: ReadonlySet<Card>;
  /** Display-only reversal of the ascending hand order (light UX pref,
   *  owner §3). Selection/toggle/glow all key off the ORIGINAL index into
   *  `hand` — reversing display never renumbers a slot, so a wild or level
   *  card simply lands wherever reversal puts it (never re-sorted by a
   *  second scheme). Defaults to the current ascending display. */
  descending?: boolean;
}

/** Split an index sequence into at most two balanced rows, same arithmetic
 *  as helpers.handRows but generic over the index array rather than the
 *  card array, so it works for both display orders. */
function splitIndexRows(indices: readonly number[], maxPerRow: number): number[][] {
  if (indices.length === 0) return [];
  if (indices.length <= maxPerRow) return [[...indices]];
  const first = Math.ceil(indices.length / 2);
  return [indices.slice(0, first), indices.slice(first)];
}

export function HandFan({ hand, level, selected, onToggle, glow, descending = false }: HandFanProps) {
  const order = hand.map((_, i) => i);
  if (descending) order.reverse();
  const rows = splitIndexRows(order, MAX_PER_ROW);
  return (
    <div className="gd-fan" role="group" aria-label={t('game.hand.label')}>
      {rows.map((row, rowIdx) => (
        <div className="gd-fan__row" key={rowIdx}>
          {row.map((i) => {
            const card = hand[i]!;
            const isSelected = selected.has(i);
            const classes = ['gd-fan__card'];
            if (isSelected) classes.push('gd-fan__card--selected');
            if (glow.has(card)) classes.push('gd-fan__card--glow');
            return (
              <button
                key={i}
                type="button"
                className={classes.join(' ')}
                aria-pressed={isSelected}
                aria-label={cardLabel(card, level)}
                onClick={() => onToggle(i)}
              >
                <CardFace card={card} level={level} size="hand" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
