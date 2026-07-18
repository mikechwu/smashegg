// TrickWell — the table center during play: ONLY the current top play's
// cards, at hand size (owner "quiet table" round). The combo-name meta line,
// the waiting/lead prompt, and the jiefeng goldleaf banner all duplicated a
// signal the log or the turn indicators already carry — so none of the three
// render here anymore. The sweep animation on trickWon and the empty-well
// state are the only "table talk" left.
//
// Play-flight physics (owner refinement): while a new play is FLYING in,
// the play it covers must still be ON the table — so the well renders the
// covered cards as an UNDERLAY beneath the (still hidden) new top. The two
// rows GRID-STACK into the same cell (panel HIGH, Codex + Grok converging):
// the well's box is therefore sized by the LARGER of the two, so a longer
// old play keeps exactly the width, wrapping and pixels it held as the top
// — an absolute underlay would have re-laid it inside the new, smaller
// row's box. Neither row is positioned, so DOM order IS paint order: the
// underlay first, genuinely beneath (panel MED, Grok — a positioned z-auto
// "underlay" would paint ABOVE its in-flow sibling). The underlay is keyed
// per flight (panel HIGH: React reuses the element across back-to-back
// covering plays, and the imperatively-added fade class would survive onto
// the next play's underlay, starting it invisible). PlayOverlay starts the
// fade at the LAST landing — the moment the new play has fully covered the
// old — and where the old play was LONGER, its protruding cards are what
// the fade visibly removes. Reduced motion never shows the underlay at all
// (no flight, no physics story to tell — CSS hides it).

import type { Card, Rank } from '../../engine/guandan/cards';
import type { TrickState } from '../../engine/guandan/types';
import { CardFace } from './CardFace';

export interface TrickWellProps {
  trick: TrickState | null;
  level: Rank;
  /** Bumped by each trickWon event — keys the sweep animation. */
  sweepKey: number;
  /** The play the incoming flight covers (playFx.covered while a flight is
   *  fresh; null otherwise): rendered beneath the top as the fading
   *  underlay. */
  covered?: Card[] | null;
  /** The flight's fold id — keys the underlay so consecutive covering plays
   *  get a FRESH element (never an inherited fade class). */
  coveredKey?: number;
}

export function TrickWell({ trick, level, sweepKey, covered, coveredKey }: TrickWellProps) {
  const top = trick?.top ?? null;
  return (
    <div className="gd-well" key={sweepKey}>
      {covered != null && covered.length > 0 && top !== null && (
        <div
          key={`covered-${coveredKey ?? 0}`}
          className="gd-well__cards gd-well__cards--covered"
          aria-hidden="true"
        >
          {covered.map((card, i) => (
            <CardFace key={i} card={card} level={level} size="hand" />
          ))}
        </div>
      )}
      {top !== null && (
        <div className="gd-well__cards">
          {top.cards.map((card, i) => (
            <CardFace key={i} card={card} level={level} size="hand" />
          ))}
        </div>
      )}
    </div>
  );
}
