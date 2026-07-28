> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Wild-card marker → a gold heart, via a swappable pool BUILT local (2026-07-23); awaiting the owner's deploy word

Owner: the wild card's red SEAL stamp sat in the lower-left corner and was
easily hidden under the next card in the fan — confusing. Researched the fan
geometry (cards overlap ~60%; only the LEFT sliver + top corner index stay
visible; the seal at top:0.92w is in the coverable zone). Fix per the owner's
direction: the wild card's HEART turns GOLD (goldleaf) in the corner index —
the always-visible sliver — and the presentation is now a flexible POOL.

WILD-MARK POOL (src/client/table/art-pool/wild-marks/): a WildMark is a
frameClass (a class the framework adds when wild → CSS recolours/edges the face)
and/or an Overlay (a stamp). ACTIVE = gold-heart (frameClass 'gd-wild--gold');
the seal is archived and one line from returning (index.ts). CardFace/GhostFace
apply the ACTIVE mark; the inline WildSeal moved to the pool. The framework owns
the class (a theme can't strip it), so the marker stays unremovable (the seal
round's contract).

THE GOLD HEART: table.css `.gd-wild--gold .gd-suit { color: var(--goldleaf) }`.
SuitMark always carries .gd-suit, so the CORNER index heart (both themes) +
lacquer's body pip recolour; targeting the pip directly beats the inherited
.gd-card--red colour, so the wild heart reads gold while its RANK keeps its
colour. The corner is the marker that matters — the fan sliver.

PANEL (Codex): MED — cinnabar-court draws its NUMBER-card body pips as direct
SUIT_FILL paths (not .gd-suit), so a lifted cinnabar-court wild showed a gold
corner but red body pips; FIXED with a companion rule
(`.gd-wild--gold .gd-ccourt__pips path { fill: goldleaf }`). The court-rank
cartouche emblem (frozen art, lifted-only, niche) keeps its suit fill — the gold
corner still marks it. LOW — a suit-blind chooser ghost has no .gd-suit to
recolour, so it leans on the chooser's substitution chip + the aria "(Wild)"
(the seal option covers it if needed); documented. CHECKED clean: no theme CSS
beats the recolour by specificity; the seal option faithfully preserved.

Verified live at 900px in a real dealt hand (both themes): the wild 2♥'s corner
heart computes goldleaf rgb(201,162,39) while its rank stays cinnabar
rgb(195,57,43), standing out from the normal red hearts (A♥/K♥) in the fan. The
seal option's CSS + geometry pins are unchanged (kept for the option). Gate
1078/1078 (45 files) + typecheck + lint:hooks + build. NOT pushed — no deploy
word.
