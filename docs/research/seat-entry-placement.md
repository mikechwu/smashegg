# Seat-anchored name entry — placement research (prefill round, item 1b)

> **SUPERSEDED 2026-07-22 by the seat-bubble overlay round** (METHODOLOGY §9:
> dated + marked, NOT rewritten). The **seat drawer** proposed and adopted
> below (shipped 923bdec) was replaced, on the owner's direction after
> real-player feedback, by a **floating speech-bubble overlay** with a tail
> pointing at the pressed seat. The drawer's one weakness in practice was the
> very thing this doc treated as acceptable — it was inserted into the grid
> flow, so opening it REFLOWED the lobby; the overlay floats above and never
> reflows. Everything below stays VALID as the record of why we got here: the
> hard constraints it establishes are unchanged and the overlay honors them —
> 16px input (no iOS zoom), the ONE claim path untouched, all four positions
> on-screen — and it re-inherits the drawer's two structural wins (the tail is
> the connector-nub idea, now on the bubble; keeping the ask in the scrollable
> document, not `position:fixed`, preserves iOS's scroll-input-into-view for
> the soft keyboard). The one fact this doc got exactly right and the overlay
> leans on: **bottom-anchored `position:fixed` sheets slide under the iOS
> keyboard** — which is why the overlay is `absolute` (in-document), not fixed,
> and opens every seat toward the upper-central band. See
> docs/audits/seat-bubble-overlay.md and STATUS.md for the overlay round.

**Status:** ADOPTED (seat drawer, shipped 923bdec) → SUPERSEDED (seat-bubble
overlay, 2026-07-22 — see the banner above).
**Date:** 2026-07-22
**Constraint honored:** the felt disc keeps the room code, unchanged and
uncovered; the flank seat cells are ~75px at 390px (the fact that produced
the current on-disc dialog); all four seat positions must stay on-screen;
the ONE claim path (takeSeat → store.claim) is untouched — this is UI
relocation only.

## What the research found (sources in the round records)

- **In-place morph (the seat button becomes the input) FAILS the flanks
  on hard numbers:** iOS Safari zooms the page for any input under 16px
  font (CSS-Tricks/Defensive CSS; the meta-viewport workaround violates
  WCAG 1.4.4 and iOS partially ignores it), and CJK glyphs are full-width
  ≈1em — so a 4-character zh-Hant name at the mandatory 16px needs
  ~80–84px inside the field. The ~75px flank cells clip it. Viable only
  for top/bottom, which would make the four seats behave inconsistently.
- **Bottom sheets are the WRONG tool on mobile web:** iOS Safari's layout
  viewport does not shrink for the soft keyboard — fixed bottom-anchored
  elements slide UNDER it (bram.us; the VirtualKeyboard API is
  Chromium-only), and a sheet covers the bottom seat row besides.
- **Proximity beats tethering** (Wickens & Carswell's proximity
  compatibility principle): a tether to a distant centered input mitigates
  but never matches adjacency — and elders suppress irrelevant screen
  regions less well, so the distance costs them more. This is the
  evidence-backed version of the owner's complaint about the disc dialog.
- **The winning idiom has mass-scale precedent:** the Google-Images-style
  INLINE EXPANSION ROW (Codrops expanding preview) — a full-width panel
  inserted into the grid flow adjacent to the tapped item, with a
  connector NUB aligned under the tapped cell plus a shared accent
  (Gestalt connectedness/common-region: static geometry, reduced-motion
  safe). NN/g's accordion guidance adds the two rules: never auto-scroll
  the trigger away, keep the trigger visibly highlighted.

## The proposal: the SEAT DRAWER

Pressing an empty seat without a name opens a full-width entry ROW
inserted into the lobby-table grid **adjacent to the pressed seat**:
directly below the top seat's row, below the disc row for the left/right
seats (nub aligned under the left or right cell respectively), and
directly ABOVE the bottom seat's row (which also keeps the input in the
upper viewport, away from the soft keyboard). The row carries the same
form the disc dialog has today (autofocused 16px input, the
blank-when-ambiguous prefill, inline empty-confirm hint, the claiming
lock, the race-taken message) — the SitAskPanel component relocates
wholesale, so the claim path and every audited behavior carry over
unchanged. Belongs-to is triple-signaled: adjacency + the connector nub
pointing at the pressed cell + the cinnabar ring on the seat matching the
row's cinnabar edge. The disc never changes: the room code stays the
lobby's centerpiece. Rows below shift down ~60px while open (in-flow, so
the browser's native scroll-focused-input behavior handles the keyboard);
reduced motion opens it instantly.

## The decision (recommended default in bold)

**P1 — the mechanic: the seat drawer** (inline adjacent full-width row +
nub + ring), vs in-place morph (fails the flanks; inconsistent), vs
tethered center dialog (weakest per proximity evidence; least change).
P2 — if the drawer: the bottom seat's row opens ABOVE it (**yes** —
keyboard clearance + on-screen guarantee), top/flanks open below.
P3 — motion: a ~200ms one-shot open (**yes**, matching the desk's
entrance idiom; instant under reduced motion) vs none.
