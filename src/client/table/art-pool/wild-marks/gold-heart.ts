// The GOLD-HEART wild mark (ACTIVE) — the wild card's suit pips turn goldleaf
// instead of cinnabar (owner: "make the red heart a golden heart"). A wild card
// is always the level rank of HEARTS, so its corner index carries a heart; a
// gold heart in that corner marks the wild in the fan's always-visible left
// sliver, where the old bottom-corner seal was hidden under the next card.
//
// The framework adds the frameClass to the card frame / ghost root when wild;
// table.css recolours every `.gd-suit` under it to var(--goldleaf) — the CORNER
// index heart in BOTH themes (SuitMark carries .gd-suit) plus lacquer's body
// pip; cinnabar-court's number body pips are recoloured by a companion rule.
// The corner heart is the marker that matters (the fan sliver). No overlay —
// nothing to be covered. The rank keeps its colour, so a gold heart beside a
// normal rank reads as "this heart is special".
//
// KNOWN GAP (panel-audit, Codex): a SUIT-BLIND ghost (chooser substitution with
// no suit) has no .gd-suit to recolour, so it carries no visual mark under this
// presentation — the chooser's substitution chip + the aria "(Wild)" carry it
// there. The seal option (an overlay) covers that case if ever needed.

import type { WildMark } from './types';

export const GOLD_HEART_MARK: WildMark = {
  name: 'gold-heart',
  frameClass: 'gd-wild--gold',
};
