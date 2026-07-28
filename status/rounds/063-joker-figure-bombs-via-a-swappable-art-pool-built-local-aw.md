> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Joker figure → bombs, via a swappable art POOL BUILT local (2026-07-22); awaiting the owner's deploy word

Owner art round: the joker card's BODY illustration is swapped from the jester
to two BOMB illustrations (on-theme — the jokers are Guandan's top bombs), and
card art is now a reusable POOL. The owner's direction: keep the JOKER wordmark
+ the dollar-J logo (the frame), swap ONLY the figure, and recolour the bombs'
white background to the card base so it's consistent.

ART POOL (src/client/table/art-pool/joker-figures/): a JokerFigure is a
swappable body illustration (viewBox + a Body component); index.ts names the
ACTIVE one, so the joker picture is a ONE-LINE swap and old art stays archived
and reusable (README documents it). Entries: bomb (active) + jester (archived —
the original, faithfully reproduced, one line from returning). jokers.tsx
refactored to KEEP the frame (wordmark + dollar-J corners + the big joker's
star, all currentColor) and render the active figure in the body via
fitTransform (fit-contain any figure aspect into the card body — the 563×600
jester, the 1254² bombs — no card-space numbers in a figure).

THE BOMBS (bomb-art-data.ts): GENERATED verbatim from the owner's two SVGs
(verbatim-art-intake discipline — script, never hand: 28/28 real paths per bomb
match the source exactly, confirmed; no id/style/defs leaked). Self-coloured
(baked per-path fills), unlike the mono jester — the big joker is the
full-colour bomb (red/gold diamond + spark), the small joker the monochrome
bomb (OUTLINE diamond, no red). The full-canvas white (1254²) background rect
was DROPPED at intake, so the card's own --card-face cream shows through —
automatically consistent (the owner's "change the bg to the base colour"), and
reusable on any surface. No text nodes (the wordmark is paths).

NO-COLOUR CUE preserved: the frame's star (big joker only) is the structural
guarantee (kept); the bombs add a second cue (filled vs outline diamond, shaded
vs flat body) that also survives grayscale (verified in the standalone render).

Verified live at true 390px zh-Hant in real dealt hands: BOTH jokers compose
correctly — big = red $JOKER + red bomb + star (「即將出:單張 大王」); small =
black $JOKER + black bomb, NO star (「即將出:單張 小王」); both on the cream face
with no white square. Gate 1075/1075 (45 files) + typecheck (4 tsconfigs) +
lint:hooks + build (bundle LEANER — the unused jester tree-shakes out of
production while staying in source for reuse). NOT pushed — no deploy word.
