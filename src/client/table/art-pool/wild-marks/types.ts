// The WILD-MARK POOL contract (owner wild-presentation round, 2026-07-23). How
// a WILD card is marked is a swappable pool entry — the framework applies the
// ACTIVE mark (art-pool/wild-marks/index.ts) over every wild surface, so the
// presentation can be changed in one line and the old one stays available.
// A theme has no code path to remove it (the framework owns the frame class
// and the overlay), preserving the contract the seal round pinned.
//
// A mark is expressed two ways, either or both:
//  • frameClass — a class the framework adds to the card frame (CardFace) or
//    ghost root (GhostFace) when the card is wild; CSS then recolours/edges the
//    face (e.g. the gold-heart mark turns the heart pips goldleaf). Survives
//    fan overlap because the corner index is the always-visible sliver.
//  • Overlay — an element drawn OVER the face when wild (e.g. the seal stamp).
// The gold-heart mark (frameClass) replaces the seal as ACTIVE because the
// bottom-corner seal was easily hidden under the next card in the fan.

import type { ReactElement } from 'react';

export interface WildMark {
  /** Stable registry key (./index.ts). */
  name: string;
  /** Class added to the card frame / ghost root when the card is wild. */
  frameClass?: string;
  /** Element drawn over the face when the card is wild (a stamp mark). */
  Overlay?: () => ReactElement;
}
