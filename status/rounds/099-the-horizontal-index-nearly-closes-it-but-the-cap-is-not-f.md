> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The horizontal index nearly closes it, but the cap is not free — a decision for the owner (2026-07-27)

### The third option, measured

The owner's question: cinnabar-court declares 0.841 because it keeps the GENERIC
VERTICAL index (rank over suit, two lines of height); lacquer's HORIZONTAL index
(`gd-card__index--row`, rank beside suit) is one line and needs only 0.42. If
cinnabar-court took the horizontal index, would the cap cost it nothing?

Measured — index INK height on a covered card, phone, 50.7px card, against the
21.3px strip a 0.42 cap exposes:

| configuration | ink height | stripW it NEEDS | clipped at a 0.42 cap |
|---|---|---|---|
| **lacquer horizontal (SHIPPED)** | 23.25px | **0.459** | **1.96px** |
| **cinnabar horizontal** | **27.52px** | **0.543** | **6.23px** |
| lacquer vertical | 44.88px | 0.885 | 23.59px |
| **cinnabar vertical (SHIPPED)** | 45.56px | **0.899** | 24.27px |

**The horizontal index nearly halves cinnabar-court's need: 45.56 → 27.52px,
i.e. from ~0.90 down to ~0.54.** So the owner's instinct was right in direction
and it removes most of the conflict.

**But it does not make the cap free, and the reason is worth stating: NOTHING
fits 0.42 — including shipped lacquer.** Lacquer's own horizontal index is
clipped by 1.96px today. So "0.42 clips the index" is not a harm the cap
introduces; it is the status quo the product already ships and accepts. What the
cap does to cinnabar-court-with-horizontal-index is widen that accepted clip from
1.96px to 6.23px.

**So this is an honest trade, and per instruction it comes to the owner rather
than being resolved in code:**

- **0.42 + horizontal index for cinnabar-court** — fold fixed; that theme's
  covered-card index clipped 6.23px (23% of its glyph) vs lacquer's 1.96px (8%).
- **0.543 + horizontal index** — both themes' indexes fully legible; fold effect
  unmeasured and 0.543 sits above 0.50, which measured 25% below fold.
- **0.42 + keep the vertical index** — fold fixed, cinnabar's index clipped
  24.27px, which is most of it. Not viable.

**Cap value: 0.42, not 0.48 — agreed, and for the owner's reason.** 0.48
interpolates on a step function whose known points are 0.42 → baseline, 0.50 →
25%, 0.647 → 79.2%, 0.841 → 95.8%. A framework constant gets treated as
authoritative; a guessed one should not be there. Nothing has been implemented.

### The baseline is re-pinned and canonical

Two equally-sized samples gave **12.5% (3/24)** and **4.2% (1/24)** — a
three-fold difference in the point estimate with heavily overlapping intervals.
Since G-FOLD is now stated *against the baseline*, the baseline's own precision
is load-bearing, and n=24 cannot pin it better than ~3× (practice 25).

**Pooled and declared canonical: 8.3% [3.3%, 19.6%], n=48, lacquer.** A baseline
is measured once and re-used every round, so it earns a larger n than any single
comparison does. Recorded in `measure-fold.mjs` and in PLAN §9.

### Per-theme coverage is now STRUCTURAL, not a list

A list someone must remember to update is exactly what failed here.
`desktop-mode.test.ts` now walks `themes/`, finds every module that calls
`registerDeckTheme` (i.e. everything in the picker), extracts its id, and
**fails if the fold gate does not mention that theme** — either with a baseline
or with an explicitly recorded absence. Verified by construction: it went red on
`cinnabar-court` until the deliberate no-baseline note named the key.

**GhostFace checked and cleared:** it is the wild-substitution face used in
ActionBar chooser chips, not a registered deck theme, so it is not selectable and
needs no fold baseline.

### What is still not done

The cap awaits sign-off. Then: the seam placement fix, the occlusion
re-measurement with the carry-the-fact strip, and the sibling-route hit box —
and the owner's framing of *why* the cap goes first is right: once every theme is
clamped to one vertical budget, theme stops being an axis, the per-theme sweep
degrades to an invariant check, and **every collapsed-variant number becomes
theme-independent instead of needing to be redone per theme.**

**Carried, open three rounds:** the collapsed indicator must answer "N cards set
aside", not merely "tappable here" — it is the only on-screen evidence those
cards still exist. Elder-session item.
