> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The span is fully derived; the default-timed room fails 1 deal in 8 at 390x664 (2026-07-27)

### 1. fanHeight's structural bound — closed, and it needed the frequency beside it

`scripts/derive-fan-bound.mjs`:

    fanHeight = 13.9 + lineH(d1) + 6 + lineH(d2),   lineH(d) = 73.5 + 21.3(d-1)

additive to 0.2px across 8 deals. Each piece proved rather than assumed:
- **lines are exactly 2** — a line holds `floor(326.8/35.5) = 9` columns and there
  are <=15 value classes. **Every measured hand is two lines**; the old probe said
  "1 row" for all of them because it counted `.gd-fan__stackRow` ELEMENTS and the
  settled fan is ONE element with `flex-wrap: wrap`. Now counted by stack BOTTOMS;
- **the 21.3px step** is `stackOffsetW(n, 0.42) * cardW`, holding to depth 8 because
  the 2.95w spread only binds from 9 copies, which two decks cannot reach;
- **the maximiser is 10 columns, depth 8 on EACH line** (8+8+8 singles = 24 <= 27).
  fanH depends only on d1+d2, so FEWER columns is worse — an extra column spends a
  card that could have been pile depth.

**fanHeight <= 465.1px**, against 294.7px observed: the structural case is **170.4px
taller than anything the sample reached.** Every G-SIM term is now proved.

**And its frequency** (`fan-height-distribution.mjs`, 200k deals, no browser): the
465.1px case is 63.9px above anything 200,000 deals produced, so under 1 in
200,000. Model and measurement agree — it predicts 2.50% infeasible at 390x664
untimed against 4.2% [0.7, 20.2] measured at n=24.

### 2. [CATCH accepted] The rate splits by population — and by an axis nobody varied

**Leading vs following.** K is 198.6px with the well and 66.0px without, so a
LEADING turn carries 132.5px more slack and **essentially never fails**. The pooled
rate averaged a population that cannot fail with the one that can.

**Room timing — held constant, at the NON-DEFAULT value, by every gate in this
repo.** All six drivers create an UNTIMED room; the product default is
`TIMING_PRESETS.standard` (45s/90s). A timed room renders the desk countdown bar:
**+8.0px**, so deskHeight <= **156.5px**, not 148.5. Eight pixels move the
threshold across a lattice step:

| inner | FOLLOWING, timed (default) | FOLLOWING, untimed | LEADING | structural slack |
|---|---|---|---|---|
| **390x664** | **13.14% — 1 deal in 8** | 2.50% (1 in 40) | 0% | -156.2px |
| 390x748 | <0.01% (1 in 33,333) | <0.01% | 0% | -72.2px |
| 1366x681 | 2.50% (1 in 40) | 2.50% | 0% | -139.2px |

Recorded as a fresh instance under METHODOLOGY practice 12. Not merely unvaried —
pinned to the value most rooms are NOT in.

### 3. [CATCH tested and REFUTED] There is no cheap 20px in the spacing

The hypothesis was that K's 66.0px residual, as the only pure inter-element
spacing, is where slack could be found. Measured:
- **66.0 = 10px (fan->desk) + 15px (desk->actions) + 41px (the action bar itself)**
  — so 25px is spacing and 41px is the control;
- the 132.5px well difference = **73.5px of well + a 59px band**, and the band is
  **NOT empty**: the west/east seat plates and stacks reach document 367.7 against
  a fan top of 375.7. Only ~**8px** is free.

**Total recoverable spacing across the whole span is ~33px**, and taking all of it
would collapse Play/Pass onto the desk and the fan onto the ring. The gap cannot
be closed by tightening; it needs a different arrangement or less content.

### 4. The level chip's limitation is CLOSED, and the closing found the timing axis

Driving to a turn with a non-pass hint available (the forced-pass window is where
`GameTable.tsx:1166` suppresses the clock) renders a real server clock at
**36x24px — identical to the injected element**. With the longest own-turn title,
free space is **84.4px**, exactly the injected figure, and all three candidate
chips still grow the desk by **0px**. Assumption -> measurement.

That same run showed the timed desk at 102.5px against the untimed 94.5px, which
is how item 2's axis surfaced. A limitation closed on the owner's instruction
turned out to be the thread that unpicked a wrong baseline.

### 5. [SECOND INCIDENT] The engine's bombTier ratchet was the mitigation for a real bug

Worth separating from the sweep's tally, as the owner asked. The ORIGINAL defect
was a drifted local `bombWeight()` copy of the bomb ladder — a correctness bug.
The fix exported `combos.bombTier` and added "a source ratchet forbidding a copy".
**That ratchet is what proved vacuous**: it matched a token that appears in the
finder's own header comment. So the mitigation for a genuine drift defect was
itself a comment-matching check, and the drift could return with the suite green.
The honest reading is that the original defect was never closed, only recorded as
closed. Recorded in practice 29, with the consequence: **every other mitigation
from that round is suspect until checked.**

### 6. Two instrument self-catches, one of them a repeat

- `derive-fan-bound.mjs` first derived per-line capacity as 8 columns while every
  deal measured 9. The measurement won; the formula had assumed the first column
  costs a full card width, when the row's `padding-left` exists precisely to cancel
  every stack's negative margin including the first. The script now **exits 1** if
  derivation and measurement disagree, rather than printing a bound from a wrong
  formula.
- The **zero-tolerance step check fired again**: after fixing "NOT ADDITIVE: K moves
  over 0.1px" in derive-span.mjs, I wrote the identical mistake into
  derive-fan-bound.mjs, which reported "NOT a single step" for 21.3/21.3/21.2/21.3.
  Same round, new file. Both now carry a stated tolerance.

### 7. Open

- **The base-layout gap is the owner's call**: at inner 390x664 in a DEFAULT timed
  room the follow-state failure is **1 deal in 8**. Fix it, or accept it explicitly
  with the reasoning recorded. D2/D3 cannot be priced against a negative budget.
- **D3 overlay-vs-collapsed** — the ranking RULE is settled (both instruments, and
  only while Play/Pass stays live); the ranking is not.
- **The elder session** leads with the binary question: does Safari collapse the
  toolbar on a PROGRAMMATIC scroll? If it does, the viewport grows to 748 exactly
  when the player needs it and the tight state is the rare one; if not, 664 is the
  common case. That single answer changes 13.14% into <0.01%.
- The level chip is measured but NOT BUILT.
- The collapsed indicator must answer *"N cards set aside"* — open six rounds.
- **The 82px shelf-deficit figure is stale** (it used un-staged slack) and is
  flagged in the doc rather than re-quoted.
