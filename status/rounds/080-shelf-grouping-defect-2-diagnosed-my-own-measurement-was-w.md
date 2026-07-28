> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Shelf grouping — DEFECT 2 DIAGNOSED (my own measurement was wrong), DEFECT 1 FIXED (2026-07-24)

### DEFECT 2 — NOT A REGRESSION. The earlier "within the fold" readings were an artifact.
Decomposed the measurement per band instead of staring at the total, and ran
BOTH shelf constructions in the SAME session so the comparison is like-for-like.

| construction | main | shelf | fan | desk | Play (viewport) | scrollY | **Play (document)** |
|---|---|---|---|---|---|---|---|
| desk-made (3 cards) | 24c/2ln | 3c/1ln/87.5 | 410.9 | 94.5 | 835.1 | **112** | **947.1** |
| finder-made (flush) | 22c/2ln | 5c/1ln/87.5 | 389.6 | 94.5 | 925.9 | **0** | **904.6** |

**`getBoundingClientRect()` is VIEWPORT-relative.** The desk-made cases only
looked comfortable because `ScrollActionsIntoView` had already scrolled the page
112px; in DOCUMENT terms they are 947.1 — **42px WORSE than the finder-made
904.6**. So the finder layout is not a regression, it is slightly better, and
the 121px spread was construction (and scroll), not a wrap.

**I have to correct my own prior report.** Last round I told the owner "Play
stayed above the fold 8/8 (834.6-835.4)". That number was measured under scroll,
so it recorded the SAFETY NET working, not the layout fitting. The honest
statement is the one below.

**THE REAL, LOCALIZED FACT** (new gate, 6 deals): **without a shelf Play fits in
6/6** (doc 809.6-830.9 vs an 844 fold). **With ANY shelf it needs scrolling in
6/6** (doc 925.9-968.4). This belongs to the SORT-AREAS feature — a shelf costs
~87-137px — not to this round's grouping, which was my hypothesis and is now
measured rather than assumed. **Whether an opt-in shelf may rely on scrolling is
an OWNER DECISION**, not something to ratify silently: the standing position is
that below-fold Play/Pass is a defect class, not something scrolling excuses.

### NEW STANDING GATE: `scripts/measure-fold.mjs`
The fold has decided three rounds running, so it now has a scripted check beside
the tap-target sweep. It records `scrollY` and the DOCUMENT position precisely
so the safety net can never again be mistaken for a fit. It fails on the BASE
layout only; the shelf's cost is reported for the owner rather than ratified.

### DEFECT 1 — FIXED. The two 44px sibling controls WERE the overflow.
Folded the control into the group's own footprint: a BAR SPANNING THE RUN
instead of a sibling pill. That reclaims all 88px, and satisfies the tap floor by
AREA rather than min-width — measured **131.8x26 = 3427px^2** and
**111.5x26 = 2899px^2**, both above a 44x44 target's 1936px^2 (WCAG 2.5.8 AA
minimum is 24px). It also answers "how do I select just this flush" with the
affordance sitting ON the thing it selects, and it is a distinct strip, not the
card faces, so tapping a card still means that card.
MEASURED AFTER: every two-run shelf now reports **lines=1**, including the 5+4
case that previously wrapped. Cost: the shelf band grows 87.5 -> 115.5px (+28px),
which is cheaper than the 79.5px wrap it replaces.

### VERIFICATION CLOSED THIS ROUND
  • **Fan tap-target sweep re-run** after the final CSS (ratchet-mandated, and it
    had not been run since): `700/1000/3750` baseline UNCHANGED, seam 0 stolen
    points, zero victims.
  • Gate: typecheck (4 tsconfigs) + unit **1225/1225 (51 files)** + lint:hooks +
    build.

### STILL NOT DONE (named, not implied)
The panel, desktop verification, and the elder session (now carrying "can they
see which cards form which flush without explanation"). I ran out of room before
these; they are the remaining blockers, along with the owner call on the shelf's
fold cost.
