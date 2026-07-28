> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Cut by hand (2026-07-17) — owner refinement — local, unpushed

Owner directive (screenshot of the cut panel): the cards themselves are the slide
control — no separate visible sliding bar; users cut with mouse or finger directly on the
deck.

Built: CutRibbon gains value/onChange/sliderLabel — the CUTTER gets an INVISIBLE native
range input overlaying the cards (absolute inset-0, opacity 0, z-index 30 ABOVE the
slivers' 0..23 split-order z — a live find: the first overlay sat under them and the
cards swallowed the drag), so dragging the deck IS the native slider drag while keyboard
arrows/Home/End and the aria slider semantics survive untouched; the visible bar is
REMOVED; spectators keep the bare ribbon. cursor: ew-resize + touch-action: none on the
live ribbon; keyboard focus stays visible via :has(:focus-visible) framing the ribbon in
goldleaf. The §leak doctrine note unchanged (same input, same documented partial
mitigation).

Live-verified (390 en): press at 25% dragged to 80% moved the split 12 → 20 slivers with
no visible bar anywhere; Home snapped to 0; the overlay measures invisible and exactly
covering the ribbon; Cut proceeds (one run hit a legitimate re-cut flip).

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-CUTDRAG.md;
producer≠auditor): see docs/audits/cutdrag-panel.md. Gate 932/932; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.
