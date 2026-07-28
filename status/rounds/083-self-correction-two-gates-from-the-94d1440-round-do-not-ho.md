> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## SELF-CORRECTION: two gates from the 94d1440 round do not hold (2026-07-25)

Fixing the CI flake above, I swept the whole suite for **other** assertions of
the same class — truth that depends on a random draw and holds for most draws
but not all. The engine and client/server unit slices came back clean with
documented checked-file lists. The gate scripts did not. Both findings below
are **pre-existing**, from the 94d1440 round; neither is caused by the CI fix.
Neither is caught by CI, because CI runs typecheck + unit + e2e only — the
`measure-*` scripts are manual gates (playwright is deliberately not a repo
dependency), so each has only ever run when I ran it.

### A. The fold gate FAILS on unchanged code — CONFIRMED EMPIRICALLY

STATUS previously recorded `scripts/measure-fold.mjs (base layout passes)` and
"without a shelf Play fits in 6/6 (doc 809.6-830.9 vs an 844 fold)". **That was
true of that sample and is not a property of the layout.** Re-run today at
`FOLD_DEALS=16` against unchanged HEAD:

```
deal 15
  no shelf : doc 852.2 vs fold 844 (viewport 835.2, scrollY 17, docH 959)  NEEDS SCROLL
WITHOUT a shelf, Play needs scrolling in 1/16 deals.
FAIL: the BASE layout needs scrolling                      (exit 1)
```

The settled fan's height is a **step function of the dealt hand**, not a
constant: every extra copy in a fan line's tallest column costs 21.3px
(0.42 x the 50.7px `--gd-cardw`). Observed base positions across 16 deals were
quantized exactly as that predicts — 758.1 / 788.4 / 809.6 / 830.9 / **852.2**.
The old 6-deal run drew only the middle two buckets, and its recorded spread
(830.9 - 809.6 = 21.3px) is **exactly one quantum** — the tell that the sample
never varied the thing that mattered.

Frequency, recomputed independently over 200,000 real double-deck deals
(`P(S>=9) = 7.31%`, where S is the sum of per-line tallest columns; a separate
300k-deal estimate gave 7.57%): the base layout puts Play below the fold on
**~7% of deals**, so a 6-deal gate reports FAIL on ~37% of runs by chance alone.

**The product consequence, stated plainly:** Play/Pass is below the fold on
roughly one deal in fourteen with **no shelf open** — not only for the opt-in
shelf whose scrolling cost the owner accepted. `ScrollActionsIntoView` still
brings it into view, so the button is reachable; what is false is the claim
that the base layout fits.

#### OWNER DECISION (2026-07-25): ~7% is ACCEPTED, on condition it is noted

The owner accepted the ~7% rate rather than reclaiming height, explicitly
*"while clearly noted"*. So it is noted here, and this is the note:

- **Play/Pass is below the fold on ~7% of deals with no shelf open**, at true
  390x844. It is reachable only because `ScrollActionsIntoView` scrolls to it.
  This is the accepted state of the product, not an outstanding bug.
- **The claim it replaces is retired.** "The base layout puts Play above the
  fold" is false and must not be re-asserted. `scripts/measure-fold.mjs` still
  prints `PASS: the base layout puts Play above the fold` on a clean run and
  exits non-zero otherwise — so **a FAIL from that script is now EXPECTED at a
  rate of ~37% per 6-deal run and does not by itself indicate a regression.**
  Read its per-deal document positions, not its exit code: the signal to watch
  is a base position ABOVE the 852.2 bucket, which would mean the step function
  itself changed.
- **At phone heights this understates it.** At innerHeight 659 Play sits at
  document ~830 against a 659 fold before any shelf exists, so below-the-fold
  is the normal case there, not a 7% case. Same accepted resolution: the page
  scrolls to it.
- Anything that ADDS height above or below the fan spends a budget that is
  already overdrawn on ~7% of deals. That is the number to weigh a future
  layout change against.

### B. The tap-target sweep measures the group bar ZERO times — CONFIRMED

Commit 94d1440 claims "the fan tap-target sweep now also covers the group bar,
so the shorter of the two destructive fan controls is inside measured coverage
instead of argued for on paper." **It is not.** The chain, verified by reading:

  • `scripts/measure-fan-tap-targets.mjs:142` builds its shelf by pressing
    `.gd-desk__setAside` — the only shelf it ever builds.
  • `GameTable.tsx:1576` wires that control to `applyMove`.
  • `areas.ts` `applyMove` carries `groupOf` through unchanged (all `NO_GROUP`);
    only `applyMoveAsGroup` ever assigns a group id, and it is reachable solely
    from the straight-flush finder's send-to-area path, which the script never
    opens.
  • `HandFan.tsx:441` renders a `.gd-fan__runTag` only for
    `groupsIn(areas, band)` — empty for an `applyMove`-built shelf.

So `document.querySelectorAll('.gd-fan__seam, .gd-fan__runTag')` is always
exactly the one seam. The guard at :152 only skips when the count is **zero**,
which the seam alone satisfies, so the script sweeps the seam, prints
`PASS: seam state swept — 0 stolen points` and exits 0 **having taken no sample
against the group bar at all**. The 46px group bar's tap safety is still
argued-on-paper, exactly what that commit said it had stopped being.

Note the trap for the fix: routing the script through the finder is the only
way to create a real group, and ~39% of deals contain no straight flush at all
— so a naive fix would go back to silently measuring nothing on those deals. A
correct fix has to FAIL (or loudly skip) when it finds no group bar, rather
than pass by default.

### Class note
B is compensated-failure practice 11 in its purest form: a gate green because
the thing it was meant to measure was absent, not because it passed. A is the
sibling the practice does not yet name — **an under-powered sample presented as
a property**, where the variable that decides the outcome (the deal) was
neither controlled nor recorded in the gate's output. The fold script already
records `scrollY` and the document position, which is why the compensator could
not hide this time; it does not record the deal shape, which is why the sample
could.
