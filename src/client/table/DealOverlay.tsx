// DealOverlay (item 4) — the physical deal: a depth-stacked deck at the ring
// centre deals one card at a time to all four seats concurrently; the
// viewer's fan reveals its SORTED slots left-to-right as own cards land
// (deal.ts explains why true arrival order is unknowable — by redaction);
// remote flights despawn into the plates. Hand 1 ends with the face-up
// marker card flying to the leader's seat, so everyone SEES who leads.
//
// Purely presentational over the already-received view: WAAPI animations
// with one shared t0; tap anywhere = .finish() everything (local only —
// touches no state and no clock); prefers-reduced-motion = instant.

import { useEffect, useRef } from 'react';
import type { Seat } from '../../engine/core/game';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CardBack, CardFace } from './CardFace';
import {
  DEAL_FLIGHT_MS,
  DECK_SIZE,
  MARKER_FLY_MS,
  dealDurationMs,
  dealSchedule,
  deckDepthTier,
} from './deal';
import { t } from '../i18n';

export interface DealOverlayProps {
  /** The marker card + its landing seat direction (hand 1 only). */
  marker: { card: Card; targetDir: 'south' | 'east' | 'north' | 'west' } | null;
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
 *  writes mid-deal): the deck origin, the 27 fan slot rects, the three
 *  remote seat anchors. */
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

export function DealOverlay({ marker, level, onOwnLanded, onDone }: DealOverlayProps) {
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
    const animations: Animation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let landedOwn = 0;
    let finished = false;

    const originX = rects.origin.left + rects.origin.width / 2;
    const originY = rects.origin.top + rects.origin.height / 2;

    const flightTo = (target: DOMRect, delayMs: number, onLand?: () => void): void => {
      const node = backTemplate.cloneNode(true) as HTMLElement;
      node.classList.remove('gd-deal__backTemplate');
      node.classList.add('gd-deal__flight');
      // Start exactly on the deck (same trick-size card, so corner
      // placement + center-to-center deltas line up).
      node.style.left = `${rects.origin.left}px`;
      node.style.top = `${rects.origin.top}px`;
      layer.appendChild(node);
      const dx = target.left + target.width / 2 - originX;
      const dy = target.top + target.height / 2 - originY;
      const anim = node.animate(
        [
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${(dx % 17) - 8}deg)`, opacity: 1 },
        ],
        { duration: DEAL_FLIGHT_MS, delay: delayMs, easing: 'cubic-bezier(0.22,0.61,0.36,1)', fill: 'backwards' },
      );
      anim.onfinish = () => {
        node.remove();
        onLand?.();
      };
      animations.push(anim);
    };

    // The schedule (deal.ts) is the single source of the choreography.
    let dealt = 0;
    for (const tick of dealSchedule()) {
      const target =
        tick.target === 'south'
          ? rects.slots[Math.min(tick.ownSlot ?? 0, rects.slots.length - 1)]!
          : (rects.seats[tick.target] ?? rects.origin);
      flightTo(target, tick.delayMs, () => {
        dealt++;
        deckEl.dataset.depthTier = String(deckDepthTier(DECK_SIZE - dealt));
        if (tick.ownSlot !== null) {
          landedOwn = Math.max(landedOwn, tick.ownSlot + 1);
          onOwnLandedRef.current(landedOwn);
        }
      });
    }

    // The marker beat (hand 1): the face-up counted card flies to the
    // leader's seat — everyone SEES who leads.
    const total = dealDurationMs();
    const finish = (): void => {
      if (finished) return;
      finished = true;
      onOwnLandedRef.current(27);
      onDoneRef.current();
    };
    if (marker !== null) {
      timers.push(
        setTimeout(() => {
          const markerEl = root.querySelector('.gd-deal__marker') as HTMLElement | null;
          const target = rects.seats[marker.targetDir] ?? rects.origin;
          if (markerEl) {
            markerEl.classList.add('gd-deal__marker--flying');
            const dx = target.left + target.width / 2 - originX;
            const dy = target.top + target.height / 2 - originY;
            const anim = markerEl.animate(
              [
                { transform: 'translate(0px, 0px) scale(1.15)' },
                { transform: `translate(${dx}px, ${dy}px) scale(1)` },
              ],
              { duration: MARKER_FLY_MS, easing: 'ease-in-out', fill: 'forwards' },
            );
            animations.push(anim);
          }
        }, total),
      );
      timers.push(setTimeout(finish, total + MARKER_FLY_MS + 200));
    } else {
      timers.push(setTimeout(finish, total + 100));
    }

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
    // The overlay mounts once per deal (keyed by the parent); the deal data
    // is frozen at mount.
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
