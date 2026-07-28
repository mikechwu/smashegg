> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Sort order is net NEGATIVE; both ends of the timing argument restated (2026-07-27, W24-W26)

**Note on scope: the W16-W23 brief was never received in this session.** The last brief
before this amendment was W9-W15 (committed 604f0de). W24-W26 are self-contained and
are done; W26's stated dependencies (W16c, W17) are not in hand, so the parts of W26
that belong to them are flagged, and the parts that are corrections to my own text are
done regardless.

### 1. [W24 CONFIRMED — and the design conclusion FLIPS] 

Computed directly over 400,000 simulated deals rather than from the three rounded
inputs (agreement with the owner's algebra shown in brackets):

| | share | (algebra) |
|---|---|---|
| both orderings fail | **3.81%** | 3.79% |
| only ascending fails — default fails, toggling would rescue | **3.85%** | 3.86% |
| only descending fails — toggling has COST feasibility | **5.42%** | 5.49% |
| neither | 86.92% | 86.86% |

**Section 10.4 was wrong twice in one sentence.** It called 13.14% the union (correct)
and then gave **~5.5%** as "the share where the sort choice decides feasibility" — which
is the symmetric difference, **9.27%**. 5.42% is the narrower "descending has cost the
player something the default would have given them".

**The sign is the finding: 5.42% > 3.85%, so descending costs feasibility ~1.6pp more
often than it recovers it.** The panel question is restated from "affordance or
accident" to **"keep it, warn on it, or remove the asymmetry"** — and only the third is
structural, because the asymmetry comes from greedy wrap putting the LOWEST 9 value
classes on line 1 ascending and the HIGHEST 9 descending. That is a layout decision, not
a user preference. Grok is running on whether a wrap policy exists that makes both
orderings yield the same (d1, d2).

**Caveat carried on every figure here:** 7.65% and 9.28% are single-ordering MODEL
outputs, fitted to the discovery sample and never validated on held-out data. Descending
is the natural held-out configuration, so W20 validates the model and measures this
population in one experiment. **9.28% is not measured.**

### 2. [W25 CONFIRMED] Both ends of the timing argument now have replacements

2.50% came from the same max-over-orderings model as the rejected 13.14%. Withdrawing
one end and not the other left the effect SIZE quoted from a model corrected halfway.

Identity verified, not assumed: `664 - 148.5 - 198.6 = 316.9`, which is **exactly**
section 10.3's "~8px seat-plate band" threshold, because the timed/untimed desk
difference is exactly the bar's **8.0px**.

> **untimed ascending 1.32% -> timed ascending 7.67% modelled, 9.17% measured.
> The countdown bar multiplies the failure rate by ~5.8x.**

**The clearest sentence available about the remedy: the amount being hunted is the
countdown bar's cost.** One nuance stated so it is not over-read — the band and the bar
are DIFFERENT pixels that happen to be the same size, so the equivalence is exact in
effect and coincidental in origin. It does explain the thin margin: 8px restores a
pre-timer state that was already only 0.9px clear of the 316.0 bin.

### 3. [W26] Two self-contradictions in section 10.3, both mine, both fixed

- **"Between step boundaries extra pixels buy nothing"** contradicted its own margin
  column (0.9px vs 17.9px at the same 1.35%). Corrected: extra pixels buy no RATE
  improvement between lattice steps, but they do buy MARGIN. Different goods.
- **"cardW 47 already reaches 0.16%"** was the only row quoted without a margin, ONE ROW
  after warning that the 8px band's 0.9px was too thin. Verified: its margin is
  **0.16px** with **1.20%** of deals riding on it — the owner's estimate exactly. The
  rate is a SAWTOOTH in cardW, and **cardW ~44.6 gives 18.64px of margin at the same
  rate**. Note the floor itself (44) is NOT best: the sawtooth puts it back to 4.81px.
  Recommendation changed from 47 to ~44.6, with a full margin column added.

### 4. [W26] The mechanism was blind to the class it was built for

`withdrawn-numbers.test.ts` scanned for retracted FIGURES. **A retracted CLAIM often has
no number in it** — "the 20.3px cannot be found in spacing" is a sentence — so the
mechanism could not see prose conclusions. That is the same shape as the finding it was
built to catch, one level up.

Extended to withdrawn PROSE conclusions on the same footing, with a non-vacuity check
that specifically asserts a prose entry is detectable (a number-only scanner would
otherwise pass a doc full of withdrawn sentences). Mutant-verified. It immediately found
the live claim in section 9.4, whose heading carried no withdrawal marker despite being
listed as withdrawn in 10.1 — the correction had landed in the summary table and not in
the section itself.

### 5. [W24 panel] Grok: symmetry is achievable AND is a net improvement

`docs/research/proposals/wrap-symmetry-grok.md`. **Yes, a symmetric wrap policy
exists**, and the crux is the one anticipated: a balanced `ceil(C/2)` split is
direction-symmetric only for EVEN C; odd C needs a tie-break that depends on CONTENT,
not position. Counter-example given: C=11, k=6, depths [8,1,1,1,1,7,1,1,1,1,1] gives
asc {8,1} and desc {8,7}.

**The policy — "depth-minimising sequential wrap":** over legal cuts k, pick the one
minimising `(d1+d2, max(d1,d2), ...)` lexicographically. Because cut k maps to cut C-k
under reverse with the same multiset, the optimised value is reverse-invariant.
Equivalent and easier to test: **compute the cut once on ascending value order, then
reverse only the presentation.**

**And it answers the obvious objection — equalising at the WORSE value.** Simulated on
200k deals:

| policy | mean height | P(fail) | asymmetry |
|---|---|---|---|
| greedy ascending (today's default) | 273.2 | 7.65% | — |
| greedy descending | 276.7 | 9.37% | ~50% of deals |
| balanced split + content tie-break | 279.7 | **11.5%** | 0% |
| **depth-min, L=1** | 269.5 | **6.39%** | 0% |
| depth-min, L=4 (elder floor on line length) | 273.2 | 8.16% | 0% |

**A balanced split equalises at the worse side** — worse than descending — and must be
rejected as the symmetry fix. **Depth-min at L=1 BEATS today's default** on both mean
and failure rate while removing the asymmetry entirely. Grok's independent descending
figure (9.37%) corroborates our measured 9.23%.

**One repo-specific implementation constraint it caught:** do NOT implement as two
sibling `.gd-fan__stackRow` bands — `sort-areas.md` measured that as **+14px** versus
one wrapping row. Use one row with a zero-height flex break before column k.

Not implemented this round; this is a proposal, and it still inherits the
single-ordering model's unvalidated status.

### 6. Open

- **W20 held-out validation** remains the gate on every figure in item 1.
- W16-W23 not received; W16c and W17 not actioned.
- Codex has not audited W24's split or W25's identity; both were verified in-house by
  direct simulation against the owner's algebra rather than by an independent lineage.
