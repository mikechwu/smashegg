// HandFan — the viewer's own hand. Cards are buttons (visible keyboard
// focus, design-system quality floor); tap toggles multi-selection (lift +
// cinnabar edge). Selection is by POSITION, not identity: two copies of the
// same card are distinct slots.
//
// Obs 3 (faithful deal): while `dealOrder` is set the fan lays its cards out
// FLAT, in TRUE ARRIVAL (deal) order, wrapped to ≤2 balanced rows so 27 cards
// fit a 375px phone, and `revealed` uncovers them left to right as they land
// — never pre-sorted (the deal overlay measures these slot rects, so this
// path stays byte-equivalent regardless of the settled layout below).
//
// Settled layout (owner reference, mainstream Guandan apps): once the deal
// finishes and `dealOrder` clears, the fan groups same-VALUE cards (levelValue
// — naturals collapse by rank, the wild joins its level column, jokers each
// keep their own) into vertical STACKS, one bottom-aligned row of columns.
// Every card FLIP-slides from its arrival slot into its stack in one beat
// (SORT_BEAT_MS). Cards are keyed by their SORTED-hand index in BOTH layouts,
// so the same element persists across the re-lay and the slide animates even
// across rows/columns.

import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { levelValue, type Card, type Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel } from './CardFace';
import { SORT_BEAT_MS } from './deal';
import { useDeckTheme } from './useDeckTheme';
import { t } from '../i18n';

/** Above this the DEALING flat fan splits into two rows (27-card deals →
 *  14+13). The settled/stacked layout below never wraps — its columns fit
 *  one row by construction (table.css's 15-column worst case). */
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
  /** Pre-deal gate (owner bug): while a fresh deal exists but the deal
   *  choreography has not started revealing it — the hand-1 cut/ceremony
   *  window — the fan must show NOTHING (no faces, no backs, no stacks). An
   *  explicit prop (not an empty `hand`, not CSS display:none) so the empty
   *  render returns BEFORE either layout branch: the dealing slot-measurement
   *  path the DealOverlay reads is reached only when NOT hidden, and stays
   *  byte-for-byte untouched. `dealing` and `hidden` are mutually exclusive by
   *  construction (the gate short-circuits on dealing). */
  hidden?: boolean;
}

/** Split an index sequence into at most two balanced rows, same arithmetic as
 *  helpers.handRows but generic over the index array rather than the card
 *  array, so it works for both display orders. DEALING flat mode only — the
 *  settled layout groups into columns instead (groupHandColumns below). */
function splitIndexRows(indices: readonly number[], maxPerRow: number): number[][] {
  if (indices.length === 0) return [];
  if (indices.length <= maxPerRow) return [[...indices]];
  const first = Math.ceil(indices.length / 2);
  return [indices.slice(0, first), indices.slice(first)];
}

/** Group a display-order index sequence into runs of equal levelValue — the
 *  hand is sorted (and a descending display is its full-array reverse), so
 *  cards sharing a value are always adjacent; grouping AFTER the asc/desc
 *  reorder means a descending display reverses COLUMN order for free, with
 *  no separate reversal step. Jokers occupy their own column each (SJ=16 vs
 *  BJ=17 never share a run); every level-rank card — naturals AND the wild —
 *  shares value 15, so the wild lands inside the level column (owner's
 *  reference behavior). Exported so tests exercise the real grouping logic
 *  with no DOM. */
export function groupHandColumns(
  order: readonly number[],
  hand: readonly Card[],
  level: Rank,
): number[][] {
  const columns: number[][] = [];
  for (const index of order) {
    const value = levelValue(hand[index]!, level);
    const current = columns[columns.length - 1];
    if (current !== undefined && levelValue(hand[current[0]!]!, level) === value) {
      current.push(index);
    } else {
      columns.push([index]);
    }
  }
  return columns;
}

/** Visible top-edge fraction (of --gd-cardw) each non-base card in an n-card
 *  column exposes above the card stacked in front of it. Capped at the
 *  theme's OWN stackStripW (DeckThemeMetrics — the height its covered-card
 *  identity mark needs: one horizontal index line for lacquer, a taller
 *  vertical rank+suit column for cinnabar-court) so a short column reads at
 *  full legibility; above 4 copies the cap yields to spreading a fixed 2.95w
 *  budget across the (n-1) reveals — the budget only binds once
 *  2.95 / (n-1) drops below stripW, so an 8-copy lacquer column (stripW
 *  0.42) still gets the full 0.42w line, and only a 9-copy column starts
 *  compressing. Exported so tests pin the curve with no DOM. */
export function stackOffsetW(n: number, stripW: number): number {
  return Math.min(stripW, 2.95 / Math.max(n - 1, 1));
}

function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The inline margin-top that pulls each non-base card up so only
 *  stackOffsetW(n, stripW) of the card behind it stays visible (negative:
 *  the theme's own card aspect — DeckThemeMetrics.aspect — always exceeds
 *  the capped/spread offset). Rounded to 3 decimals for a readable inline
 *  style. */
function stackMarginTopW(n: number, stripW: number, aspect: number): number {
  return roundTo3(stackOffsetW(n, stripW) - aspect);
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
  hidden = false,
}: HandFanProps) {
  const theme = useDeckTheme();
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
  // DEALING: flat rows (Obs 3 slot rects the deal overlay measures). SETTLED:
  // same-value columns (owner reference) — mutually exclusive, so only the
  // active mode's layout is computed.
  const rows = dealing ? splitIndexRows(order, MAX_PER_ROW) : [];
  const columns = dealing ? [] : groupHandColumns(order, hand, level);

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

  // Pre-deal gate: render the empty fan group (keeps the a11y landmark and
  // layout slot stable) with NO cards — returns before either layout branch,
  // so the dealing slot-measurement path stays untouched. Hooks above run
  // unconditionally (this file's rule); only the card render is skipped.
  if (hidden) {
    return <div className="gd-fan" role="group" aria-label={t('game.hand.label')} />;
  }

  let displayIndex = -1;
  return (
    <div className="gd-fan" role="group" aria-label={t('game.hand.label')}>
      {dealing
        ? rows.map((row, rowIdx) => (
            <div className="gd-fan__row" key={rowIdx}>
              {row.map((i) => {
                displayIndex++;
                const card = hand[i]!;
                const isSelected = selected.has(i);
                const classes = ['gd-fan__card'];
                if (isSelected) classes.push('gd-fan__card--selected');
                if (glow.has(card)) classes.push('gd-fan__card--glow');
                if (revealed !== undefined && displayIndex >= revealed) {
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
          ))
        : (
            <div className="gd-fan__stackRow">
              {columns.map((column, colIdx) => {
                // Same offset for every card in THIS column (a function of
                // its own size, not its position) — the first card takes no
                // margin (it is the pile's top, drawn first/underneath); every
                // later DOM sibling paints over it, so only the base (last)
                // card shows its full face.
                const marginTopW = stackMarginTopW(
                  column.length,
                  theme.metrics.stackStripW,
                  theme.metrics.aspect,
                );
                return (
                  <div className="gd-fan__stack" key={colIdx}>
                    {column.map((i, posInColumn) => {
                      const card = hand[i]!;
                      const isSelected = selected.has(i);
                      const classes = ['gd-fan__card'];
                      if (isSelected) classes.push('gd-fan__card--selected');
                      if (glow.has(card)) classes.push('gd-fan__card--glow');
                      const style: CSSProperties | undefined =
                        posInColumn === 0
                          ? undefined
                          : { marginTop: `calc(var(--gd-cardw) * ${marginTopW})` };
                      return (
                        <button
                          key={i}
                          ref={(el) => {
                            if (el) cardRefs.current.set(i, el);
                          }}
                          type="button"
                          className={classes.join(' ')}
                          style={style}
                          aria-pressed={isSelected}
                          aria-label={cardLabel(card, level)}
                          onClick={() => onToggle(i)}
                        >
                          <CardFace card={card} level={level} size="hand" />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}
