// PlayOverlay — a played hand's flight (owner: "like the dealing process").
// The pile already dropped its count in this same commit (the settled
// mapping peels the hidden inner row), and this overlay flies the played
// cards FACE UP from that pile to the table: each starts 100% HIDDEN behind
// the pile (opacity 0 at t0), slips out of the pile's table-facing edge
// (opacity arrives over the first ~18% of flight, so the card reads as
// emerging from the back of the pile), flies UNSORTED — per-index jitter and
// tilt, a small stagger — and lands on ITS OWN card in the trick well. The
// well's fresh cards stay hidden until their flight arrives, so the landing
// IS the reveal (the fan's undealt-slot discipline, applied to the well).
//
// DealOverlay's idioms, miniaturized: one batched rect read, WAAPI flights,
// reduced-motion replaced whole (the well simply shows — this overlay does
// nothing at all), unmount cleanup that can NEVER leave the well hidden.
// The flight nodes are React-rendered (no clones), so a finished flight is
// display:none'd, never .remove()d out from under React.
//
// Lifecycle: GameTable mounts this per play (keyed by the fold's fx id) and
// unmounts it by wall clock (the same tick that expires the pass fade) — the
// overlay itself needs no callback. If the table changes underneath it (a
// sweep re-keys the well, a mismatched card count) it bails to the settled
// layout instead of flying stale rects.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CardFace } from './CardFace';

// LAYOUT effect (panel MED, Grok): the well's fresh cards commit VISIBLE in
// the same render that mounts this overlay — a post-paint useEffect would let
// them flash for a frame before the flight hides them ("landing is the
// reveal" must hold from the first paint). Same isomorphic guard the deal
// gate uses (react-dom/server warns on bare useLayoutEffect).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type PlayFlightDir = 'south' | 'east' | 'north' | 'west';

export interface PlayOverlayProps {
  /** The playing seat's direction from the viewer (seatLayout). */
  dir: PlayFlightDir;
  cards: Card[];
  level: Rank;
}

/** Flight timing: fast enough that back-to-back turns never overlap a
 *  living flight (GameTable's freshness gate allows 2000ms — the widest
 *  bomb's staggered flight plus the covered underlay's 600ms fade). */
export const PLAY_FLIGHT_MS = 420;
export const PLAY_FLIGHT_STAGGER_MS = 70;

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The pile's table-facing edge midpoint — where a card slipping out from
 *  UNDER the pile would first show. South has no pile; its cards rise from
 *  the hand zone's top edge. Queries scope to THIS overlay's own table
 *  (DealOverlay's closest('.gd-ring') discipline), never the whole page. */
function originPoint(scope: ParentNode, dir: PlayFlightDir): { x: number; y: number } | null {
  const el =
    dir === 'south'
      ? scope.querySelector('.gd-handzone')
      : (scope.querySelector(`.gd-seatzone--${dir} .gd-seatstack`) ??
        scope.querySelector(`.gd-seatzone--${dir}`) ??
        scope.querySelector(`.gd-ring__seat--${dir}`));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  switch (dir) {
    case 'north':
      return { x: r.left + r.width / 2, y: r.bottom };
    case 'south':
      return { x: r.left + r.width / 2, y: r.top };
    case 'east':
      return { x: r.left, y: r.top + r.height / 2 };
    case 'west':
      return { x: r.right, y: r.top + r.height / 2 };
  }
}

export function PlayOverlay({ dir, cards, level }: PlayOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return; // the settled well is the whole story

    // No ring, no flight (DealOverlay's discipline — never fall back to a
    // page-global query that could hide an unrelated well).
    const scope = root.closest('.gd-ring');
    if (scope === null) return;
    // The TOP row only — the covered underlay's cards are scenery (they stay
    // visible under the flight; matching them here would skew the count and
    // bail every covering play).
    const targets = [
      ...scope.querySelectorAll('.gd-well__cards:not(.gd-well__cards--covered) .gd-cardframe'),
    ] as HTMLElement[];
    const origin = originPoint(scope, dir);
    const nodes = [...root.querySelectorAll('.gd-playfx__card')] as HTMLElement[];
    // The well must exactly hold this play (a same-batch sweep, a re-render
    // race, anything else — bail to the settled layout, never stale flights).
    if (origin === null || targets.length !== nodes.length || targets.length === 0) return;

    const animations: Animation[] = [];
    const restore = () => {
      for (const t of targets) t.style.visibility = '';
    };
    for (const t of targets) t.style.visibility = 'hidden';
    let airborne = targets.length;

    nodes.forEach((node, i) => {
      const rect = targets[i]!.getBoundingClientRect();
      // Deterministic per-index "tossed from the back" scatter — never
      // sorted-looking, never random (stable under re-render/resume).
      const jx = ((i * 47) % 21) - 10;
      const jy = ((i * 31) % 15) - 7;
      const tilt = ((i * 53) % 19) - 9;
      node.style.left = `${origin.x - rect.width / 2}px`;
      node.style.top = `${origin.y - rect.height / 2}px`;
      const dx = rect.left + rect.width / 2 - origin.x;
      const dy = rect.top + rect.height / 2 - origin.y;
      const anim = node.animate(
        [
          { transform: `translate(${jx}px, ${jy}px) rotate(${tilt}deg)`, opacity: 0 },
          { offset: 0.18, opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, opacity: 1 },
        ],
        {
          duration: PLAY_FLIGHT_MS,
          delay: i * PLAY_FLIGHT_STAGGER_MS,
          easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
          fill: 'both',
        },
      );
      anim.onfinish = () => {
        // The landing reveals the well's own card; the flight node ducks
        // under it (display, not removal — React owns the node). The LAST
        // landing starts the covered underlay's fade (owner physics, panel
        // MED: the old play stays until the new cards have FULLY covered
        // it, then lets go — its protruding cards are what the fade
        // visibly removes).
        targets[i]!.style.visibility = '';
        node.style.display = 'none';
        airborne--;
        if (airborne === 0) {
          scope
            .querySelector('.gd-well__cards--covered')
            ?.classList.add('gd-well__cards--fading');
        }
      };
      animations.push(anim);
    });

    return () => {
      // Whatever happens, the well is never left hidden.
      for (const a of animations) a.cancel();
      restore();
    };
  }, [dir, cards, level]);

  return (
    <div ref={rootRef} className="gd-playfx" aria-hidden="true">
      {cards.map((card, i) => (
        <span key={i} className="gd-playfx__card">
          <CardFace card={card} level={level} size="hand" />
        </span>
      ))}
    </div>
  );
}
