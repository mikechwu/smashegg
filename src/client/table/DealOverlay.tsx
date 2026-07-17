// DealOverlay (item 4 + obs 2) — the physical deal: a depth-stacked deck at
// the ring centre deals one card at a time to all four seats concurrently,
// round-robin FROM THE FIRST DRAWER (hand 1) so the order matches the physical
// table; the viewer's fan uncovers its cards in TRUE ARRIVAL order as they land
// (obs 3 — the order the server already delivers in handStarted.hands; one sort
// beat re-lays the fan when the deal completes, see HandFan);
// remote flights despawn into the plates. The face-up marker card flies at its
// TRUE beat (the payload's markerDealIndex — its deck position; the old
// flips-derived beat was the 2026-07-15 defect), inside a 2× slow window so
// the moment reads — everyone watches the deal wondering whether it's coming
// to them, and sees it land at the leader.
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
  type DealTick,
  dealChoreographyMs,
  dealSchedule,
  deckDepthTier,
} from './deal';
import { t } from '../i18n';

export interface DealOverlayProps {
  /** Deal order of ring directions. Hand 1 passes dealDirOrder(firstDrawerDir)
   *  so the marker lands at its true beat; hands 2+ omit it (south-first). */
  dirOrder?: DealDir[];
  /** The face-up marker card and its true deal beat (hand 1 only). The
   *  marker replaces the back at that beat, so accounting stays exact
   *  (leader gets 26 backs + 1 marker). */
  marker: { card: Card; beat: number } | null;
  level: Rank;
  /** Called as own (south) cards land: reveal the fan's first N slots. */
  onOwnLanded: (count: number) => void;
  /** The suspense reveal (owner rule, refined): fired the moment the
   *  face-up marker LANDS at its seat — the concealment gate lifts here and
   *  the leader's seat ring lights up; the landing itself is the whole
   *  announcement (no extra text — the middle is clear enough). UI-level
   *  suspense, not concealment: the payload is public. */
  onMarkerLanded?: () => void;
  /** Seat-zone round (R3): fired as each REMOTE (non-south) card lands —
   *  back flights and the face-up marker alike (both routes go through
   *  onCardLanded) — so the seat's visible back stack grows one real card
   *  per landing, in lockstep with the choreography. Skip (.finish()) still
   *  fires every landing; reduced-motion fires none and relies on onDone
   *  flipping the table to the settled counts. */
  onRemoteLanded?: (dir: 'east' | 'north' | 'west') => void;
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

export function DealOverlay({ dirOrder, marker, level, onOwnLanded, onMarkerLanded, onRemoteLanded, onDone }: DealOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onOwnLandedRef = useRef(onOwnLanded);
  onOwnLandedRef.current = onOwnLanded;
  const onMarkerLandedRef = useRef(onMarkerLanded);
  onMarkerLandedRef.current = onMarkerLanded;
  const onRemoteLandedRef = useRef(onRemoteLanded);
  onRemoteLandedRef.current = onRemoteLanded;
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

    // BOTH landing routes (flyBack's node.remove() callback and the marker's
    // own onfinish) funnel through here, so the R3 remote-stack growth can
    // never miss the marker's landing at the leader's seat.
    const onCardLanded = (tick: DealTick): void => {
      dealt++;
      deckEl.dataset.depthTier = String(deckDepthTier(DECK_SIZE - dealt));
      if (tick.target === 'south') {
        if (tick.ownSlot !== null) {
          landedOwn = Math.max(landedOwn, tick.ownSlot + 1);
          onOwnLandedRef.current(landedOwn);
        }
      } else {
        // R3 (seat-zone round): a non-south landing grows that seat's
        // visible back stack by exactly one — the stack IS the choreography.
        onRemoteLandedRef.current?.(tick.target);
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

    const flyBack = (target: DOMRect, tick: DealTick): void => {
      const node = backTemplate.cloneNode(true) as HTMLElement;
      node.classList.remove('gd-deal__backTemplate');
      node.classList.add('gd-deal__flight');
      node.style.left = `${rects.origin.left}px`;
      node.style.top = `${rects.origin.top}px`;
      layer.appendChild(node);
      flyNode(node, target, tick.delayMs, DEAL_FLIGHT_MS, () => {
        node.remove();
        onCardLanded(tick);
      });
    };

    const targetFor = (tick: { target: DealDir; ownSlot: number | null }): DOMRect =>
      tick.target === 'south'
        ? rects.slots[Math.min(tick.ownSlot ?? 0, rects.slots.length - 1)]!
        : (rects.seats[tick.target] ?? rects.origin);

    // The schedule (deal.ts) is the single source of the choreography — the
    // marker's beat (its deck index, straight from the public ceremony
    // payload) also opens the 2× slow window around itself, the moment the
    // ceremony exists for. At that beat the face-up marker card flies instead
    // of a back. Because dirOrder is built with the CONFIGURED turn
    // direction, schedule[beat]'s target IS the leader's seat, so the marker
    // replaces the leader's own back and everyone still receives exactly 27.
    for (const [i, tick] of dealSchedule(dirOrder, marker?.beat ?? null).entries()) {
      const target = targetFor(tick);
      if (marker !== null && i === marker.beat && markerEl) {
        // The marker sits at the deck centre already (absolute, inset:0), so —
        // unlike the fixed-position back flights — it needs no left/top; the
        // translate delta (origin→target) alone carries it to the leader.
        //
        // Owner bug (slow-motion find): the --flying class (opacity: 1) must
        // land exactly WHEN THE FLIGHT STARTS, not at schedule time — the
        // flight animation idles for tick.delayMs before its beat, and a
        // synchronous class-add left the face-up marker peeking out of the
        // deck pile for that whole pre-beat window. Scheduled via the shared
        // `timers` list, which skip() clears: a skipped deal keeps the marker
        // invisible end to end (its .finish() still fires onfinish, so the
        // reveal + despawn below run as usual).
        timers.push(
          setTimeout(() => markerEl.classList.add('gd-deal__marker--flying'), tick.delayMs),
        );
        flyNode(markerEl, target, tick.delayMs, MARKER_FLY_MS, () => {
          onCardLanded(tick);
          // THE reveal (owner suspense rule, refined): the landing itself is
          // the announcement — the concealment gate lifts here, lighting the
          // leader's seat ring; no extra text (owner: what shows in the
          // middle is clear enough).
          onMarkerLandedRef.current?.();
          // Owner bug: the face-up marker must DESPAWN on landing exactly like
          // a remote back (flyBack's node.remove()) — the seat/fan it landed at
          // owns the card now. Without this it reverts (fill:'backwards') to
          // the deck centre at opacity:1 and lingers as a stray face-up card
          // for the rest of the deal. Removed AFTER the reveal fires, so the
          // suspense timing is unchanged; the skip path (.finish() → onfinish)
          // runs this same callback, so a skipped deal also ends marker-free.
          markerEl.remove();
        });
      } else {
        flyBack(target, tick);
      }
    }

    const finish = (): void => {
      if (finished) return;
      finished = true;
      onOwnLandedRef.current(27);
      onDoneRef.current();
    };
    // The marker flies AT its beat (mid-deal), so the honest end of the
    // choreography is the last landing (slow window included) plus a settle.
    timers.push(setTimeout(finish, dealChoreographyMs(DECK_SIZE, marker?.beat ?? null)));

    // Tap-to-skip: finish every retained animation — purely local; the
    // schedule/state/clock are untouched (deal.ts contract). Finishing the
    // marker's animation fires its onfinish, so the reveal still happens.
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
