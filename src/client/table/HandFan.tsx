// HandFan — the viewer's own hand as an overlapping fan (~60% overlap).
// Cards are buttons (visible keyboard focus, design-system quality floor);
// tap toggles multi-selection (lift + cinnabar edge). Selection is by
// POSITION, not identity: two copies of the same card are distinct slots.
// Wraps to ≤2 balanced rows so 27 cards fit a 375px phone.
//
// Obs 3 (faithful deal): while `dealOrder` is set the fan lays its cards out
// in TRUE ARRIVAL (deal) order and `revealed` uncovers them left to right as
// they land — never pre-sorted. When the deal finishes and `dealOrder` clears,
// the fan re-lays in sorted order and every card FLIP-slides to its slot in one
// beat (SORT_BEAT_MS). Cards are keyed by their SORTED-hand index, so the same
// element persists across the re-lay and the slide animates even across rows.

import { useLayoutEffect, useRef } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel } from './CardFace';
import { SORT_BEAT_MS } from './deal';
import { t } from '../i18n';

/** Above this the fan splits into two rows (27-card deals → 14+13). */
const MAX_PER_ROW = 14;

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Map each deal-order card to a UNIQUE sorted-hand index, consuming
 *  duplicates left to right (two decks ⇒ duplicate cards). Both arrays are the
 *  same multiset, so this is a bijection deal-position → sorted index. */
export function dealToHandIndices(dealOrder: readonly Card[], hand: readonly Card[]): number[] {
  const used = new Array(hand.length).fill(false);
  return dealOrder.map((card) => {
    let idx = hand.findIndex((c, i) => !used[i] && c === card);
    if (idx === -1) idx = used.findIndex((u) => !u); // defensive: multiset drift
    used[idx] = true;
    return idx;
  });
}

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
   *  `hand`, so reversing display never renumbers a slot. Applies only once
   *  the hand has settled (not during the arrival-order deal). */
  descending?: boolean;
  /** Item 4 (deal animation): how many DISPLAY slots (left to right) are
   *  revealed so far — undealt slots keep their layout (visibility only, so
   *  the deal overlay can measure every slot rect) but show nothing. Applies
   *  only while `dealOrder` is set. undefined = not dealing. */
  revealed?: number;
  /** Obs 3: the seat's own DEAL ORDER. While set (and matching the hand's
   *  size), the fan lays out in this order; when it clears the fan sorts. */
  dealOrder?: readonly Card[] | null;
}

/** Split an index sequence into at most two balanced rows, same arithmetic as
 *  helpers.handRows but generic over the index array rather than the card
 *  array, so it works for both display orders. */
function splitIndexRows(indices: readonly number[], maxPerRow: number): number[][] {
  if (indices.length === 0) return [];
  if (indices.length <= maxPerRow) return [[...indices]];
  const first = Math.ceil(indices.length / 2);
  return [indices.slice(0, first), indices.slice(first)];
}

export function HandFan({
  hand,
  level,
  selected,
  onToggle,
  glow,
  descending = false,
  revealed,
  dealOrder,
}: HandFanProps) {
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const prevRects = useRef(new Map<number, DOMRect>());
  const wasDealing = useRef(false);

  // Display order = sorted-hand indices in display sequence. During the deal it
  // follows arrival order; otherwise ascending (or the descending pref).
  const dealing = dealOrder != null && dealOrder.length === hand.length;
  let order: number[];
  if (dealing) {
    order = dealToHandIndices(dealOrder!, hand);
  } else {
    order = hand.map((_, i) => i);
    if (descending) order.reverse();
  }
  const rows = splitIndexRows(order, MAX_PER_ROW);

  // FLIP, but ONLY on the deal→sorted re-lay (the sanctioned sort beat): the
  // moment `dealing` turns false after having been true, slide every card from
  // its arrival slot to its sorted slot. We keep every OTHER render (reveal,
  // selection, a play that shrinks the hand and remaps indices, the descending
  // toggle) instant — those must not animate, so the fan reflow after a play
  // stays crisp. Cards are keyed by sorted index, so a card that changes ROWS
  // (React remounts it) still slides: cardRefs resolves the key to the CURRENT
  // node. prevRects is refreshed every render so the sort baseline is the last
  // arrival-order layout.
  useLayoutEffect(() => {
    const next = new Map<number, DOMRect>();
    cardRefs.current.forEach((el, key) => next.set(key, el.getBoundingClientRect()));
    const isSortBeat = wasDealing.current && !dealing;
    if (isSortBeat && !prefersReducedMotion()) {
      prevRects.current.forEach((prev, key) => {
        const el = cardRefs.current.get(key);
        const now = next.get(key);
        if (!el || !now) return;
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (dx === 0 && dy === 0) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: SORT_BEAT_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        );
      });
    }
    prevRects.current = next;
    wasDealing.current = dealing;
  });

  let displayIndex = -1;
  return (
    <div className="gd-fan" role="group" aria-label={t('game.hand.label')}>
      {rows.map((row, rowIdx) => (
        <div className="gd-fan__row" key={rowIdx}>
          {row.map((i) => {
            displayIndex++;
            const card = hand[i]!;
            const isSelected = selected.has(i);
            const classes = ['gd-fan__card'];
            if (isSelected) classes.push('gd-fan__card--selected');
            if (glow.has(card)) classes.push('gd-fan__card--glow');
            if (dealing && revealed !== undefined && displayIndex >= revealed) {
              classes.push('gd-fan__card--undealt');
            }
            return (
              <button
                key={i}
                ref={(el) => {
                  if (el) cardRefs.current.set(i, el);
                }}
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
