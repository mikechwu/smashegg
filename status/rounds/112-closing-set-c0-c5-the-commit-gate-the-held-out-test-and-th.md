> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## CLOSING SET C0-C5: the commit gate, the held-out test, and the one thing that ships

**Scope note: W16-W23 were never received and are not being looked for.** This entry
covers C0-C5 only; the parked list in the brief is parked.

**Wording correction the brief asked for:** the previous entry called 9.23% "our
measured" one screen after saying "9.28% is not measured". **Both were MODELLED.** No
descending figure has ever been measured; C1 is the run that changes that.

### 1. [C0 SHIPPED] A red suite is no longer committable

`f29e389` went in with tests failing. "Run the suite first" is the wrong correction —
practice 26 says recording a lapse without a mechanism IS the lapse.

`.githooks/pre-commit` runs typecheck + vitest under `set -e`, armed by
`core.hooksPath` (`npm run hooks`) because `.git/hooks` is untracked and a hook nobody
else receives is not a gate. `commit-gate.test.ts` asserts the hook exists, is
executable, runs the real commands rather than echoing, and that `hooksPath` is set.
**Mutant-verified: a deliberately failing test made `git commit` exit 1 and write no
commit.**

### 2. [C1] Pre-registered and running

`docs/research/prereg-descending-holdout.md`, committed at ac27880 **before** the
script gained a sort knob. Predicted descending shares per bin with 95% intervals at
n=110, the same three agreement criteria, and an explicit statement that **the rate
test cannot discriminate 9.23% from 7.65% so the distribution criteria decide**.

**COMPLETE. ALL THREE CRITERIA PASS — the single-ordering model is CONFIRMED on
held-out data**, so items 3-5's figures are no longer gated:

| bin | expected | observed | 95% interval | |
|---|---|---|---|---|
| 252.1 | 26.0 | 21 | [17, 35] | ok |
| 273.4 | 43.9 | 45 | [34, 54] | ok |
| 294.7 | 26.8 | 30 | [18, 36] | ok |
| 316.0 | 8.4 | 9 | [3, 14] | ok |

Criterion 2 pass; criterion 3 worst off-lattice distance **0.1px** against 1.0px.
**Rate 10/110 = 9.09% [5.0%, 15.9%]** against a predicted 9.23% — stated as
*consistent with*, never as agreement, since the interval cannot discriminate 9.23%
from 7.65%. **The distribution criteria are what confirm it.** Leading 0/32 = 0%.

**So descending is now MEASURED at 9.09%, and ascending's measured 9.17% and modelled
7.65% both stand.** The C1 gate is discharged.

**A third instrument defect, which nearly produced a false headline.** The script first
reported criterion 3 VIOLATED on an observed 358.5px and printed "the HEIGHT FORMULA is
wrong". It was measuring distance to the nearest entry in a BIN TABLE truncated at
337.3; 358.6 is an ordinary lattice point and the observation sits **0.1px** from it.
The criterion as pre-registered is about the LATTICE, so the code now generates the
lattice instead of consulting a table. Three of this round's findings have been my own
instrument bugs — comparator, index-vs-identity, and this — and all three were caught
by a self-check rather than by review.

**Unplanned finding: `deskH` is not a constant.** It read **161.5 on 16 deals and
156.5 on 7**. The measured rate is computed from each deal's actual span so it is
unaffected, but any threshold quoted as "308.9" is quoting one of two values, and the
5px difference is a third of the 316.0 bin's 7.1px deficit. Diagnosis not done.

### 3. [C2] The wrap policy — two of my own bugs, and a conclusion neither lineage had

**Two implementation defects found by the instrument's own self-checks:**
- The lexicographic comparator used `key < best.key` on ARRAYS, which coerces to
  strings. Caught by the asymmetry column, which is 0 BY CONSTRUCTION and read 2.1-2.8%.
- The stability comparison compared line assignment **by index**, and indices shift
  when a column empties. It reported greedy at 0.000 line-changes, which is impossible.
  Now compares by column IDENTITY (value class).

**C2a — the L curve, corrected. This does not reproduce either prior figure.**

| L | P(fail) | mean | asymmetric | shorter line |
|---|---|---|---|---|
| greedy (today) | **7.57%** | 273.2 | **49.6%** | — |
| 1 | 3.79% | 267.9 | 0.0% | 1 col on 1% of deals |
| 2 | 3.99% | 268.2 | 0.0% | — |
| 3 | 4.83% | 269.5 | 0.0% | — |
| **4** | **6.60%** | 272.2 | 0.0% | min 4 cols |
| 5 | 9.03% | 275.8 | 0.0% | min 5 cols |

**The brief's premise — "at any defensible L it costs" — does not hold in my
arithmetic.** L=4 gives 6.60% against today's 7.57%: BETTER, not worse. Grok reported
L=4 at 8.16%. Two lineages disagree and I am not picking; what I can say is that my
asymmetry column now reads 0.0% at every L, which is the property the policy claims,
so the implementation satisfies at least that. **Removing the asymmetry appears free up
to L=4 and to cost only from L=5.**

(L=6 and L=7 are non-monotonic artifacts: when the L constraint is unsatisfiable the
policy drops it to 1, so those rows are not "L=6" in any useful sense.)

**C2b — stability, the cost nobody priced. The brief's concern is confirmed and
quantified:**

| policy | mean line-changes/play | worst | plays moving >=3 columns |
|---|---|---|---|
| greedy | **0.105** | **1** | **0.00%** |
| depth-min L=1 | 0.370 | **9** | 5.88% |
| depth-min L=4 | 0.252 | 6 | 4.47% |
| held-cut (computed once) | 0.179 | 6 | — |

Greedy moves **one** column, ever. Depth-min can re-flow **nine at once**, on ~5% of
plays. **The held-cut variant keeps most of greedy's stability** as the brief expected
— but it measured **30.2% asymmetric**, because a cut held from the DISPLAY order does
not survive a reverse. It needs the canonical-order form (compute on ascending, reverse
only the presentation), which is exactly the equivalent form the proposal gives.

### 4. [C3] The cardW sweep — read the plateau, not the minimum

Capacity crosses 9 -> 10 at **cardW 46.69**, confirmed. R(delta) = P(fanH > T - delta)
is the decision column; margin is supporting detail.

The sawtooth is now visible as a column rather than a footnote: at **cardW 49.70,
R(0) = 1.31% but R(5) = 7.65%** — five pixels of drift sextuples the rate.

**Plateaux (widest run holding R(10) under a ceiling):**
- R(10) <= 0.2%: **cardW 44.00-45.70**, midpoint **44.95**, capacity 10, R(0) 0.08%,
  R(21.3) 0.74%, margin 15.94px.

**Recommendation: cardW ~44.95** — an 11.3% reduction, implemented as the `13vw`
coefficient becoming ~11.5vw, not as a change to the 2.75rem floor. The previous
recommendation of 44.6 is inside the plateau; 47 was not, and neither is the floor
itself (44 falls back to 4.81px of margin).

NOT IMPLEMENTED. It needs the elder legibility answer (C5b).

### 5. [C4 SHIPPED] The desk title cannot wrap, in any locale

`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0` on
`.gd-desk__title`. The `min-width: 0` is load-bearing: a flex item's automatic minimum
is its content size, so without it the item never shrinks and the row overflows instead
of ellipsising.

**Gate, measured at the longest own-turn title in each locale with a clock present:**

| | 390x664 | 320x664 |
|---|---|---|
| zh-Hant | deskH **94.5px** | deskH **94.5px** |
| en | deskH **94.5px** | deskH **94.5px** |

**Identical in every cell.** Containment PASS across 390x664, 320x664, 390x748, 720x900,
1366x681 (10 probes, 705 boxes). A 27px drift is now impossible rather than absorbed.

**AND IT ANSWERS THE LEVEL-CHIP QUESTION, NEGATIVELY.** The chip's "84.4px free" is
zh-Hant only. In en the longest title's intrinsic text is **321.2px** against ~313px of
row, so free space is **-20.2px** without a clock and **-56.2px** with one. The chip
still costs 0px of HEIGHT in en — but its width comes straight out of already-truncated
title text. **Geometry fine, meaning degraded.** The chip's design must change before it
is built: it cannot share the title row in en.

### 6. Open

- **The deskH 156.5/161.5 split** — undiagnosed, and it perturbs every threshold.
- **C5a** (does the trick well scale with the card; is the aspect ratio fixed in source)
  and **C5b** (the device session plan) — not reached.
- The deskH 161.5 discrepancy from item 2.
- The C2 lineage disagreement on L=4.
