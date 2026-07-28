> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Option 4 works, costs more than estimated, and option 2 is out on rules (2026-07-27)

### Option 2 (0.543) excluded on RULES, not taste — agreed

The phone stripW sweep measured **0.50 → 25% below fold**; the canonical
baseline is **8.3% [3.3%, 19.6%]**. G-FOLD (PLAN §9) reads: a change must not
raise the below-fold rate above the measured baseline for that viewport. 25% is
above the baseline and above its interval, and 0.543 > 0.50 is strictly worse.
**Adopting it would invalidate the rule rewritten two rounds ago.** Excluded on
rules; reopening G-FOLD would be a separate proposal, argued as such.

### Option 4 — size the index to the strip budget — WORKS, at a bigger cost than estimated

Measured by re-declaring each theme's shipped index ratios at a scale k and
reading the ink height on a covered card, phone, against the 21.28px strip a
0.42 cap exposes:

| theme (horizontal index) | scale that FITS | rank glyph | ink height |
|---|---|---|---|
| **lacquer** | **0.85** | 18.25 → **15.51px** (−15%) | 20.66 ≤ 21.28 ✓ |
| **cinnabar-court** | **0.70** | 18.25 → **12.78px** (−30%) | 20.27 ≤ 21.28 ✓ |

**The owner's linear estimate (92% / 77%) was optimistic**: ink height is not
proportional to the ratio, because line boxes and the suit SVG's own box do not
shrink linearly. Measured, it is 85% / 70%.

Both land above this project's 10px type floor and above `cornerIndexMinPx: 10`,
and **nothing clips** — which is option 4's whole point.

**A finding that changes what option 4 costs to build:** cinnabar-court's index
height is NOT type-driven. Scaling only its fonts barely moved its ink (27.52 →
25.8px even at a 6.5px rank), because `.gd-ccourt__suitGlyph` is an SVG sized
`calc(var(--gd-cardw) * 0.38)` — off CARD WIDTH, not off type. So "derive the
index from the strip budget" has to reach that glyph too, not just font sizes.
*(That mis-measurement was mine: the first sweep nested `em` on both the
container and its children, so k=0.95 compounded to a 34% cut. The reading was
of an injection, not of a layout.)*

### The trade, stated for the decision

- **Option 1 — cap 0.42, keep ratios:** full-size 18.25px glyphs; lacquer
  clipped 1.96px (8%, the accepted status quo), cinnabar clipped 6.23px (23%).
- **Option 4 — cap 0.42, derive ratios:** nothing clips; lacquer 15.51px (−15%),
  cinnabar 12.78px (−30%).

The owner's argument favours 4 — a scaled glyph keeps all its information, a
clipped one loses a quarter of its letterform permanently, and 6 vs 8 vs 9
differ in exactly the region a bottom clip removes.

**But option 4 has a cost the owner's framing did not include: it shrinks
LACQUER's glyph by 15% to fix an 8% clip on the default theme that everyone
uses today.** A per-theme derivation (derive for cinnabar, leave lacquer) keeps
the default untouched but gives up the "nothing ever clips" property. That is a
third sub-choice and it belongs to the owner.

**And the owner is right that ink arithmetic cannot answer this.** Whether a 23%
bottom clip is readable, and whether a complete 12.78px glyph beats a clipped
18.25px one, needs eyes. Added to the elder session: *read the rank on a covered
card*, both themes, both treatments.

### The pooled baseline is like-for-like — checked, not assumed

Four commits touched the stylesheets between the two samples. Extracting only
what a PHONE renders — everything outside a `@media (min-width: N)` block — at
both builds and diffing: **byte-identical, 43384 and 17419 chars respectively.**
So the two n=24 samples describe the same product and pooling to n=48 is valid.
