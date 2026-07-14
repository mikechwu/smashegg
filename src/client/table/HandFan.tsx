// HandFan — the viewer's own hand as an overlapping fan (~60% overlap).
// Cards are buttons (visible keyboard focus, design-system quality floor);
// tap toggles multi-selection (lift + cinnabar edge). Selection is by
// POSITION, not identity: two copies of the same card are distinct slots.
// Wraps to ≤2 balanced rows so 27 cards fit a 375px phone.

import type { Card, Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel } from './CardFace';
import { handRows } from './helpers';
import { t } from '../i18n';

/** Above this the fan splits into two rows (27-card deals → 14+13). */
const MAX_PER_ROW = 14;

export interface HandFanProps {
  /** Already sorted by the engine's playerView (sortCards). */
  hand: readonly Card[];
  level: Rank;
  selected: ReadonlySet<number>;
  onToggle: (index: number) => void;
  /** Tribute-phase eligible cards glow (PLAN §5 hint highlighting). */
  glow: ReadonlySet<Card>;
}

export function HandFan({ hand, level, selected, onToggle, glow }: HandFanProps) {
  const rows = handRows(hand, MAX_PER_ROW);
  let index = 0;
  return (
    <div className="gd-fan" role="group" aria-label={t('game.hand.label')}>
      {rows.map((row, rowIdx) => (
        <div className="gd-fan__row" key={rowIdx}>
          {row.map((card) => {
            const i = index++;
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
