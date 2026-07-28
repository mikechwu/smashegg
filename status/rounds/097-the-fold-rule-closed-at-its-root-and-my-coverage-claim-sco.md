> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The fold rule closed at its root, and my coverage claim scoped correctly (2026-07-27)

### G-FOLD restated — the rule now describes the product

Open for several rounds, and the downstream cost was visible this round: while
the rule implied zero and reality was 12.5%, every round re-discovered the gap by
arguing over margins too small to mean anything.

**New wording (PLAN §9):** *a change must not raise the below-fold rate above the
measured no-shelf BASELINE for that viewport* — not "Play is never below the
fold", which the product has never satisfied. Paired with practice 20's precise
no-moving-target condition.

**And the comparison is now in the instrument, not in someone's memory.**
`measure-fold.mjs` prints the accepted baseline beside the measured rate:

```
WITHOUT a shelf, Play needs scrolling in k/n = X%   95% CI [...]
    vs ACCEPTED no-shelf baseline 12.5% [4.3%, 31.0%] (n=24, accepted 2026-07-25).
    THE TARGET IS THE BASELINE, NOT ZERO.
```

### My coverage claim was scoped wrong — pile depth is the binding axis

I said the sample "reaches the structural maximum" because MAIN's lines hit 2 of
2. Checked rather than assumed, as instructed:

`stackOffsetW = min(stripW, 2.95/(n−1))`, and **2.95/7 = 0.421 > 0.42, so the cap
binds at every depth from 2 to 8** — the offset never shrinks, and pile height
grows by a flat **21.3px per card** all the way to depth 8.

Two consequences:

- **The 21.3px quantum everyone has been reasoning about IS the pile-depth step**,
  not a wrap step. That unifies observations that were being treated separately.
- **The sample maxed the wrong axis.** Lines were 2 of 2, but pile depth was 6 of
  8 — and depth is what produces the variation. Depth 8 would add **42.6px** over
  the sample's worst. So collapsed-24's −32.2px margin is against a sampled worst
  case, not a structural one; at depth 8 it would be ~918.8 rather than 876.2.
  Depth ≥7 occurs on 0.27% of deals and depth 8 on 0.011%, so this is a tail
  question, but it is not a closed one.

**Scoped claim, stated properly:** the sample reaches the structural maximum on
LINE COUNT; it does not on columns (13 of 15) or pile depth (6 of 8), and pile
depth is the axis that binds fan height. This coverage does not transfer to any
property bound by those axes.

### Two practices from this round's own errors

- **24 — a clean ZERO is the most suspicious result a probe can return.** A zero
  is what you get when nothing is wrong *and* when you are not looking at the
  right thing. The coverage probe measured the shelf BAND and never the SEAM ROW
  — a component instead of the composite — and reported "0/24 MAIN cards
  covered" while the seam sat over MAIN; a second instrument found 121 stolen
  taps. Third confidently-wrong instrument in this project. Print the probe's
  scope in its own output, and prefer overlapping instruments.
- **25 — say which question a sample size can answer: DETECTION or
  EQUIVALENCE.** n=16 giving [3.5%, 36.0%] against a [4.3%, 31.0%] baseline is
  "this sample lacks the power to detect a difference", not "they are the same";
  each interval spans ~30 points. The same n was ample for 12.5% vs 100%.

### Not yet done, and nothing is built on the stale numbers

The seam placement fix, the re-measurement of semantic occlusion, the
carry-the-fact strip and the sibling-route hit box are the next steps in that
order. The pre-fix occlusion numbers are known-wrong and are not a basis for a
decision; the fold numbers for the collapsed variants stand but are scoped to a
sample that does not reach maximum pile depth.
