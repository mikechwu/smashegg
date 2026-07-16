// DealOverlay (item 4 + obs 2) — the physical deal: a depth-stacked deck at
// the ring centre deals one card at a time to all four seats concurrently,
// round-robin FROM THE FIRST DRAWER (hand 1) so the order matches the physical
// table; the viewer's fan reveals its SORTED slots left-to-right as own cards
// land (deal.ts explains why true arrival order is unknowable — by redaction);
// remote flights despawn into the plates. The face-up marker card flies at its
// TRUE beat (flips.length − 1), not as a tail after the deal — everyone watches
// the deal wondering whether it's coming to them, and sees it land at the
// leader.
//
// Purely presentational over the already-received view: WAAPI animations with
// one shared t0; tap anywhere = .finish() everything (local only — touches no
// state and no clock); prefers-reduced-motion = instant.

import { useEffect, useRef } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CardBack, CardFace } from './CardFace';
import {
  DEAL_FLIGHT_MS,
  DECK_SIZE,
  MARKER_FLY_MS,
  type DealDir,
  dealChoreographyMs,
  dealSchedule,
  deckDepthTier,
} from './deal';
import { t } from '../i18n';

export interface DealOverlayProps {
  /** Deal order of ring directions. Hand 1 passes dealDirOrder(firstDrawerDir)
   *  so the marker lands at its true beat; hands 2+ omit it (south-first). */
  dirOrder?: DealDir[];
  /** The face-up marker card and its true deal beat (hand 1 only). Its landing
   *  seat is schedule[beat].target — the marker replaces the back at that
   *  beat, so accounting stays exact (leader gets 26 backs + 1 marker). */
  marker: { card: Card; beat: number } | null;
  level: Rank;
  /** Called as own (south) cards land: reveal the fan's first N slots. */
  onOwnLanded: (count: number) => void;
  onDone: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Rects {
  origin: DOMRect;
  slots: DOMRect[];
  seats: Record<'east' | 'north' | 'west' | 'south', DOMRect | null>;
}

/** ONE batched read pass before t0 (research: never interleave reads and
 *  writes mid-deal): the deck origin, the 27 fan slot rects, the three remote
 *  seat anchors. */
function readRects(overlay: HTMLElement): Rects | null {
  const table = overlay.closest('.gd-ring');
  const deck = overlay.querySelector('.gd-deal__deck');
  if (!table || !deck) return null;
  const slots = [...table.querySelectorAll('.gd-fan__card')].map((el) => el.getBoundingClientRect());
  const seat = (dir: string) =>
    table.querySelector(`.gd-ring__seat--${dir}`)?.getBoundingClientRect() ?? null;
  return {
    origin: deck.getBoundingClientRect(),
    slots,
    seats: { east: seat('east'), north: seat('north'), west: seat('west'), south: seat('south') },
  };
}

export function DealOverlay({ dirOrder, marker, level, onOwnLanded, onDone }: DealOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onOwnLandedRef = useRef(onOwnLanded);
  onOwnLandedRef.current = onOwnLanded;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) {
      // Instant final layout — the flight choreography is replaced whole.
      onOwnLandedRef.current(27);
      onDoneRef.current();
      return;
    }
    const rects = readRects(root);
    if (!rects || rects.slots.length === 0) {
      onOwnLandedRef.current(27);
      onDoneRef.current();
      return;
    }

    const layer = root.querySelector('.gd-deal__flights') as HTMLElement;
    const deckEl = root.querySelector('.gd-deal__deck') as HTMLElement;
    const backTemplate = root.querySelector('.gd-deal__backTemplate') as HTMLElement;
    const markerEl = root.querySelector('.gd-deal__marker') as HTMLElement | null;
    const animations: Animation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let landedOwn = 0;
    let dealt = 0;
    let finished = false;

    const originX = rects.origin.left + rects.origin.width / 2;
    const originY = rects.origin.top + rects.origin.height / 2;

    const onCardLanded = (ownSlot: number | null): void => {
      dealt++;
      deckEl.dataset.depthTier = String(deckDepthTier(DECK_SIZE - dealt));
      if (ownSlot !== null) {
        landedOwn = Math.max(landedOwn, ownSlot + 1);
        onOwnLandedRef.current(landedOwn);
      }
    };

    // Fly `node` from the deck to `target`; the node is already positioned at
    // the deck origin (its corner) so center-to-center deltas line up.
    const flyNode = (
      node: HTMLElement,
      target: DOMRect,
      delayMs: number,
      durationMs: number,
      onLand: () => void,
    ): void => {
      const dx = target.left + target.width / 2 - originX;
      const dy = target.top + target.height / 2 - originY;
      const anim = node.animate(
        [
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${(dx % 17) - 8}deg)`, opacity: 1 },
        ],
        { duration: durationMs, delay: delayMs, easing: 'cubic-bezier(0.22,0.61,0.36,1)', fill: 'backwards' },
      );
      anim.onfinish = onLand;
      animations.push(anim);
    };

    const flyBack = (target: DOMRect, delayMs: number, ownSlot: number | null): void => {
      const node = backTemplate.cloneNode(true) as HTMLElement;
      node.classList.remove('gd-deal__backTemplate');
      node.classList.add('gd-deal__flight');
      node.style.left = `${rects.origin.left}px`;
      node.style.top = `${rects.origin.top}px`;
      layer.appendChild(node);
      flyNode(node, target, delayMs, DEAL_FLIGHT_MS, () => {
        node.remove();
        onCardLanded(ownSlot);
      });
    };

    const targetFor = (tick: { target: DealDir; ownSlot: number | null }): DOMRect =>
      tick.target === 'south'
        ? rects.slots[Math.min(tick.ownSlot ?? 0, rects.slots.length - 1)]!
        : (rects.seats[tick.target] ?? rects.origin);

    // The schedule (deal.ts) is the single source of the choreography. At the
    // marker's beat the face-up marker card flies instead of a back. Because
    // dirOrder is built with the CONFIGURED turn direction, schedule[beat]'s
    // target IS the leader's seat, so the marker replaces the leader's own
    // back and everyone still receives exactly 27 cards.
    for (const [i, tick] of dealSchedule(dirOrder).entries()) {
      const target = targetFor(tick);
      if (marker !== null && i === marker.beat && markerEl) {
        // The marker sits at the deck centre already (absolute, inset:0), so —
        // unlike the fixed-position back flights — it needs no left/top; the
        // translate delta (origin→target) alone carries it to the leader.
        markerEl.classList.add('gd-deal__marker--flying');
        flyNode(markerEl, target, tick.delayMs, MARKER_FLY_MS, () => onCardLanded(tick.ownSlot));
      } else {
        flyBack(target, tick.delayMs, tick.ownSlot);
      }
    }

    const finish = (): void => {
      if (finished) return;
      finished = true;
      onOwnLandedRef.current(27);
      onDoneRef.current();
    };
    // The marker flies AT its beat (mid-deal), so the honest end of the
    // choreography is just the last landing plus a settle (deal.ts).
    timers.push(setTimeout(finish, dealChoreographyMs()));

    // Tap-to-skip: finish every retained animation — purely local; the
    // schedule/state/clock are untouched (deal.ts contract).
    const skip = (): void => {
      for (const a of animations) a.finish();
      for (const timer of timers) clearTimeout(timer);
      finish();
    };
    root.addEventListener('pointerdown', skip);

    return () => {
      root.removeEventListener('pointerdown', skip);
      for (const a of animations) a.cancel();
      for (const timer of timers) clearTimeout(timer);
    };
    // The overlay mounts once per deal (keyed by the parent); the deal data is
    // frozen at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="gd-deal" role="status" aria-label={t('game.deal.label')}>
      <div className="gd-deal__flights" />
      <div className="gd-deal__deck" data-depth-tier="3">
        <CardBack size="trick" />
        {marker !== null && (
          <span className="gd-deal__marker">
            <CardFace card={marker.card} level={level} size="trick" />
          </span>
        )}
      </div>
      <span className="gd-deal__backTemplate">
        <CardBack size="trick" />
      </span>
      <p className="gd-deal__skip">{t('game.ceremony.skipHint')}</p>
    </div>
  );
}
