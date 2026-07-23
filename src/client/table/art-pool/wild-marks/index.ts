// The wild-mark POOL registry. WILD_MARKS lists every wild-card presentation;
// ACTIVE_WILD_MARK names the one in use now. Swapping the wild presentation is
// this ONE line — the others stay available. Adding a mark: drop a module
// exporting a WildMark (a frameClass for a CSS recolour/edge, and/or an Overlay
// for a stamp), and register it here.

import { GOLD_HEART_MARK } from './gold-heart';
import { SEAL_MARK } from './seal';
import type { WildMark } from './types';

export type { WildMark } from './types';

/** Every wild-card presentation in the pool, by name. */
export const WILD_MARKS: Record<string, WildMark> = {
  'gold-heart': GOLD_HEART_MARK,
  seal: SEAL_MARK,
};

/** The presentation the wild cards use today. Re-point to swap it; e.g.
 *  `WILD_MARKS.seal` restores the cinnabar stamp. */
export const ACTIVE_WILD_MARK: WildMark = WILD_MARKS['gold-heart']!;
