> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Bound corrected, anchoring refuted, and the pre-ship checklist (2026-07-27)

### PRE-SHIP CHECKLIST — the manual half of the gate decision, written down

Containment now runs in CI on every push. These do NOT, because their questions
are rates over a deal-dependent step function and a CI-sized sample would report
a number too small to mean anything. **Run them before any deploy that touches
layout, and paste the rates into the STATUS entry:**

1. `node scripts/measure-fold.mjs` — at **inner 390×844** (the phone reference)
   and at **every desktop mode representative you changed** (`FOLD_W`/`FOLD_H`),
   `FOLD_DEALS=24` minimum. Report the rate with its Wilson interval, both with
   and without a shelf.
2. `node scripts/measure-fan-tap-targets.mjs` — required for ANY fan or
   selection change. Zero victims, zero stolen seam points.
3. `node scripts/measure-setaside.mjs` — with `SETASIDE_VIEWPORTS` covering the
   phone heights AND the desktop modes.
4. `node scripts/check-containment.mjs` — CI runs this at 1 deal; run it at
   `CONTAIN_DEALS=3+` locally, because CI's sample catches structural violations
   and not ones that need a rare hand.

Each needs `npx wrangler dev` (or vite) up and playwright available; playwright
is deliberately not a repo dependency, so link or install it in a scratch dir.

### The split bound was WRONG — corrected, and now actually proved

I shipped `1143.6px` as "the structural bound". **It was not a maximum.** It
modelled the shelf as ONE run; the shelf is *g separate runs*, each starting at
a full card width with 6px between, so **run count drives the width**. Under
that model the maximum is 1389.6px — 205.6px above the cap I had just derived
from it.

What makes it a real bound is a structural fact I had not used: **a recorded
group comes only from the straight-flush finder** (`GameTable.tsx`'s
`applyMoveAsGroup`; the desk's set-aside uses `applyMove` and records nothing),
**and a straight flush is at least 5 cards.** So groups ≥5 cards, runs ≤
⌊k/5⌋+1, and the proved maximum is **1207.2px** — a 12-card shelf in 3 runs
(2 flushes + 2 loose) beside a 15-column MAIN.

The cap is now **78rem = 1248px**, clearing it by 40.8px. The old 74rem was
23.2px short. The test re-derives the whole space rather than asserting a
literal, so it breaks if the clamp, the pitch, the run overlap or the
minimum-group fact moves.

**The lesson is the owner's, restated:** applying practice 14 once is not
enough. The 906.1px sample was replaced by a figure that *looked* derived, and
it took a second challenge to find that the derivation itself encoded a
plausible configuration.

### Anchoring MAIN — measured, and the hypothesis is REFUTED

"Re-centring is a choice; anchor MAIN and the shift goes to zero" is a good
hypothesis and it is **not what happens.** n=8, displacement of cards that stay
in MAIN when 3 are set aside, split into the two things that were conflated:

| | band edge | interior reflow |
|---|---|---|
| 390×844 centred | **0px** | 63.3px |
| 390×844 anchored | **0px** | 106.4px |
| 1440×900 centred | 93.6px | 207.6px |
| 1440×900 anchored | 176px | 207.6px |

Three findings:

- **On the phone the band edge does not move at all.** The "154.6px shift" I
  reported earlier was interior reflow — cards to the right of a removed card
  sliding left — not re-centring. My earlier metric conflated them, so part of
  that report was an artifact of the measurement.
- **Anchoring does not help and makes it worse**, because the dominant term is
  the interior reflow, which anchoring cannot address: removing a card from the
  middle of a row moves its right neighbours whatever the band is aligned to.
- **Two errors in the first attempt**, both recorded: `row-reverse` inverts
  `justify-content`, so `flex-start` anchored the wrong edge and reported a
  568.7px "shift"; and the single max-over-all-cards metric hid the band term
  entirely.

**Stated limitation:** the desktop band-edge figure is not clean. The shelf's
runs nest inside a `.gd-fan__stackRow`, so the selector reaches both bands and
the 93.6/176px numbers are the leftmost card of *either*, not of MAIN. The
phone rows (single band) are sound. Isolating MAIN on desktop needs a selector
that distinguishes the bands, and that is not yet written.

### Phone shelf gap — first option measured, and it is not enough

Collapsing the shelf to a 44px summary strip recovers only **29.5px** of fan
height (410.9 → 381.4) and leaves the phone at **8/8 below fold**. So option A
alone does not close the gap; the shelf's cost is not concentrated in its card
faces. Options B (overlay) and C (accept scroll under the no-moving-target
condition) are unmeasured, and I am not proposing one until they are.

### Also landed

- **The nine clamp copies must AGREE** — a check, not a consolidation
  (decision 5 stays withdrawn). It asserts all nine are character-identical and
  that there are exactly nine, so a tenth is a deliberate act. Verified by
  drifting one copy: 2 tests red, naming both spellings.
- **`:has()` support baseline stated** at its use site, the way `min()`'s was:
  Chrome 105, Safari 15.4, Firefox 121, plus a live `CSS.supports` check.
- **METHODOLOGY 18** — when a layout decision depends on per-deal content, a
  media query alone cannot be correct; size for a proved worst case or provide a
  content-responsive fallback, and prefer both. This is also the axis that
  decides which gates can run in CI.
