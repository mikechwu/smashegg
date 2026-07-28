> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Cut handle icon (2026-07-17) — owner refinement — deployed

Owner directive (screenshot): the handle's chevron glyph rendered as a small confusable
DIAMOND — hide it, or a small pointing hand aligned with the gap, or anything practical
and elegant.

Built: the handle is now an inline SVG (the WildSeal idiom) — a 24px coin badge (lacquer
disc, goldleaf ring, goldleaf pointing-hand path) riding the SAME pixel-exact split
geometry from the previous round (interior formula + data-split-edge overrides,
transition, z-29, pointer-events none all untouched). Three hand candidates were rendered
and eyeballed at 18-72px before choosing; the coin backing is what keeps the hand legible
at handle size. Pins: the handle span contains svg/circle/path and NO chevron/diamond
codepoints; all geometry/stacking pins unchanged.

Live-verified (390 en): drag 12 → 20 slivers, Home/End handle centres at 11.2 /
width−11.2 exactly (no geometry regression), badge clearly legible on the parted gap.

Cross-model panel (Codex + Grok, isolated clones, light single-round brief
BRIEF-HANDICON.md; producer≠auditor): see docs/audits/handicon-panel.md. Gate 932/932;
typecheck, lint:hooks, build clean. Committed locally; push only on the owner's word.
