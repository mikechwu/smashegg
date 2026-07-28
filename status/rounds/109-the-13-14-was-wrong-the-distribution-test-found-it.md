> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The 13.14% was wrong; the distribution test found it (2026-07-27, W1-W5)

### 1. [HEADLINE] The model failed the test it was given

Pre-registered in `docs/research/prereg-fan-model.md` and **committed at 38d6844
before `validate-fan-model.mjs` existed**. Measured: real timed room (45s/90s
standard preset), following, staged, lacquer, zh-Hant, inner 390x664, **n=120**.

**W1a — the rate.** 11/120 = **9.17% [5.2%, 15.7%]**. Pre-registered cut was 8.
- H0 (the untimed 2.50%): **REJECTED**. The timing correction is real.
- H1 (13.14%): inside the interval, so the rate test alone could not reject it.
- Leading, for contrast: **0/55 = 0%** — the population split holds exactly.

**W1b — the distribution, and this is what caught it.** DISAGREES:

| bin | model predicted | measured |
|---|---|---|
| 230.8px | 0.6% | **5.0%** |
| 252.1px | 17.0% | **30.8%** |
| 273.4px | 38.7% | 35.0% |
| 294.7px | 30.5% | **20.0%** |
| 316.0px | 10.7% | 8.3% |

**DIAGNOSIS.** The model scored every deal at the **taller of the two sort
orderings**. That is correct for a BOUND — the player can toggle — and wrong for a
RATE, because the browser renders one ordering at a time. Re-running single-ordering
reproduces the measured distribution bin for bin (ascending: 5.0 / 28.0 / 37.8 /
21.3 / 6.4 against measured 5.0 / 30.8 / 35.0 / 20.0 / 8.3) and gives **7.65%**,
consistent with the measured 9.17%.

**The owner's framing was right: the agreement check had no power.** 13.14% sits
inside the measured interval, so only the distribution test could reject it.

**What survives:** the timing correction (H0 rejected), leading turns never failing,
the span decomposition, and the structural bound — the error was in the WEIGHTS, not
the geometry. **What does not: any quotation of 13.14%.**

### 2. [WITHDRAWN] The desktop rows were computed with phone geometry

`fan-height-distribution.mjs` hardcoded card height 73.5, step 21.3 and capacity 9 —
all measured at 390 — and applied them to 1366x681. Measured across widths
(`scripts/fan-geometry-sweep.mjs`, one hand reused so width is the only varied axis):

| inner width | cardW | pitch | capacity | lines for 15 cols | structural fanH(8,8) |
|---|---|---|---|---|---|
| 320 | 44 | 30.8 | **8** | 2 | 406.3 |
| 390 | 50.7 | 35.5 | 9 | 2 | 465.1 |
| 768 | 68 | 47.6 | 14 | 2 | **617.0** |
| 1366 | 68 | 47.6 | **18** | **1** | **312.5** |

- **W3: "lines are exactly 2" HOLDS at every width >= 320.** The estimate that it
  breaks near 320 is **refuted** — capacity is 8, not below it. But the margin is
  thin: the card stops shrinking at its 2.75rem floor, so below inner **~308px**
  capacity drops to 7 and 15 columns need a THIRD line.
- **768 is worse than the phone** (617.0px structural max): the card is at its 68px
  ceiling while the width still forces two lines.
- Desktop rows in PLAN section 9 are **void** until re-measured with the desk and K
  terms at desktop width.

### 3. [W5a CORRECTION] The bombTier fix IS in place — I overstated it

`straight-flush-finder.ts:32` imports `bombTier` from `./combos` and all six call
sites use it (:424, :428, :437, :441, :466, :470). There is no local ladder.

Last round's wording — *"the original defect was never closed, only recorded as
closed"* — was **wrong and would have read as a live engine correctness bug**. The
evidence supports only: **the defect is UNPROTECTED, not unfixed.** The ratchet
guarding against a copy returning is vacuous; the fix it guards is present.

### 4. [W4 SHIPPED] Max-coverage scroll target

`src/client/table/decision-scroll.ts`. The old call asked "is the action ROW on
screen" and answered with the least scrolling that made it so — targeting the ROW,
whose height is the taller of the bar and the sort cell, and never considering what
LEAVES. The new target maximises visible decision-set extent subject to Play/Pass
being wholly visible. **The trigger is untouched** (same condition, deps, and
instant behaviour): practice 20 is about WHEN a scroll fires, not where it lands.

**A standing invariant fired, correctly, and the fix was structural.**
`hand-areas-ui.test.ts` bans `getBoundingClientRect` from GameTable.tsx under "NO
VIEWPORT MEASUREMENT GATES AN AFFORDANCE". Written inline, this violated it. Rather
than carve an exemption, the geometry moved to its own module — nothing there gates
an affordance, and the tripwire stays absolute. A new test pins
`DECISION_SELECTORS` against the gate's own `panel` profile, so the product cannot
optimise for a set the metric no longer scores.

**Not yet verified end-to-end:** the pre-registered W4 gate (feasible-but-not-shown
-> 0) has NOT been re-measured. Shipped on unit pins and typecheck only.

### 5. [W2a] The axis registry

`scripts/axes.mjs` registers 14 axes; all nine gate drivers declare a value for each,
and any deviation from the product default carries a justification.
`tests/unit/client/gate-axes.test.ts` enforces both. Mutant-verified: deleting an
axis declaration goes red, and pinning locale to `en` without a justification goes
red. It immediately caught two of my own undeclared deviations.

Three known gaps are now VISIBLE rather than hidden — measure-simultaneity,
measure-fold, measure-setaside and check-containment all still pin `roomTiming` to
UNTIMED, each with a justification saying so.

### 6. [W5c CORRECTION] A sampled minimum phrased as structural

"The smallest fan the layout can produce is 252.1px" was a SAMPLED minimum
(`d1+d2 = 6`). The structural minimum is **209.5px** (`d1+d2 = 4`: 12 pairs + 3
singles = 27 cards over 15 classes); `d1+d2 = 3` is impossible because 9 columns at
depth 2 plus 6 singletons is only 24 cards. Owner's arithmetic verified. The
conclusion is unchanged (664 admits 127.8), so this is wording, not a reversal.

### 7. NOT REACHED this round — stated rather than silently dropped

- **W1c** the maximiser construction (10 columns, depth 8 per line). The bound
  465.1px remains DERIVED but unverified by direct render.
- **W2b** cinnabar-court and one-shelf G-SIM cells.
- **W2c** the en-locale desk title, so the level chip's "84.4px free" is still
  zh-Hant-only.
- **W5b** the shared additive-tolerance helper.
- **W6** symbolic re-derivation from live tokens (the width/theme sweep does part of
  it, but derive-fan-bound.mjs still hardcodes lacquer's 0.42).
- **W7** the device-session restructure. **W8** the decision package.
- The W4 gate re-measurement (item 4).
