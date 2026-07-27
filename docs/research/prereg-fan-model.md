# Pre-registration — validating the fan-height model (W1)

**Written 2026-07-27, BEFORE the measurement was run.** Every threshold below was
fixed in this file and committed before `scripts/validate-fan-model.mjs` produced a
single number. A threshold chosen after seeing the data is not a gate.

## What is under test

`scripts/fan-height-distribution.mjs` predicts, for the panel must-see set, staged
desk, **following** state, at inner **390×664**:

| room timing | predicted infeasible rate |
|---|---|
| untimed (what every gate had measured) | **2.50%** |
| timed, `TIMING_PRESETS.standard` — the product default | **13.14%** |

The 13.14% figure has **never been observed in a browser**. Its only validation is
that the untimed 2.50% prediction sits inside a measured 4.2% [0.7%, 20.2%] at n=24 —
an interval wide enough to also accept a model wrong by 6×. That check has almost no
power and is therefore not evidence.

## W1a — the rate test

**Configuration, pinned and declared:** real timed room (`perTurnMs: 45000,
planningMs: 90000, autoPassNoPlay: true`), lacquer, zh-Hant, no shelf, one card
staged, following state only (trick well non-empty), inner 390×664, chrome excluded.

**Unit (W1d):** *per deal, at the viewer's first decision*. This is the deal's
**maximum**, because the hand only shrinks as cards are played and fanHeight is
monotone in the hand — so the per-turn rate is strictly lower and this is the
conservative direction. A subsample measures later turns to confirm monotonicity
rather than assume it.

- **H0:** true rate = 2.50% (the untimed prediction — i.e. the timing correction is spurious)
- **H1:** true rate = 13.14% (the timed prediction)
- **n = 120 following deals.**

**Decision rule, fixed now:**

| observed failures out of 120 | conclusion |
|---|---|
| **≥ 8** | reject H0; consistent with H1 (13.14%) |
| **≤ 7** | reject H1; consistent with H0 (2.50%) |
| **> 27** | reject BOTH — the model is wrong in a way neither branch captures |

Error rates at the cut: α = P(X ≥ 8 \| H0) = **1.08%**; β = P(X ≤ 7 \| H1) = **0.78%**.
The ">27" band is above H1's 3σ upper bound (26.9). A count of 0–4 sits inside H0's 3σ
band and is therefore "H0", not "model wrong".

**"The model is right" vs "the model is right by luck":** the rate test alone cannot
distinguish them, which is why W1b is the load-bearing test.

## W1b — the distribution test (higher power)

The rate is a tail of a distribution; agreeing on a tail is weak. So the empirical
`fanHeight` distribution is compared to the 200k-sample model **per lattice bin**.

**Bins:** the 21.3px lattice — 209.5, 230.8, 252.1, 273.4, 294.7, 316.0, 337.3, 358.6, …

**Predicted counts at n = 120:**

| bin | model share | expected count |
|---|---|---|
| 252.1 | 16.97% | 20.4 |
| 273.4 | 38.68% | 46.4 |
| 294.7 | 30.48% | 36.6 |
| 316.0 | 10.65% | 12.8 |
| 337.3 | 2.21% | 2.7 |
| 230.8 | 0.56% | 0.7 |

**Agreement criteria, fixed now.** The model AGREES iff all three hold:
1. Every bin with expected count **≥ 5** (i.e. 252.1, 273.4, 294.7, 316.0) has an
   observed count inside the **95% binomial interval** around its predicted
   proportion at n = 120.
2. No bin with predicted proportion **≥ 5%** has an observed count of **0**.
3. No observed fanHeight falls **off the lattice** by more than **1.0px** — an
   off-lattice value would mean the height formula itself is wrong, not just its
   weights.

Any failure of 1–3 is the round's headline finding, and the effort moves to W1c.

## W1c — verify the bound rather than re-derive it

Construct the claimed maximiser **in page**: 10 columns, depth 8 on each of the two
lines (8 + 8 + 8 singletons = 24 ≤ 27 cards). Render and measure.

- **Gate: measured fanHeight = 465.1 ± 1.0px.** If it does not match, the derivation
  in PLAN.md §9 is wrong and must be **corrected, not explained**.
- While that hand is rendered, also measure **per-line column capacity** and **column
  pitch at depth 8**. Capacity 9 was measured only on ordinary deals whose max depth
  is 3–4; it has never been checked in the regime the bound depends on.

## W1d — the unit, stated

Reported as **per deal at the first decision**. Also reported: the **per-turn** rate
over a subsample, and the monotonicity check that makes the first decision the deal's
worst case. These are materially different claims about the player's experience and
the report names which one each number is.

## What would falsify the round's larger claim

The lattice-boundary framing (W8.3) says one 21.3px step is a ~5.3× change in failure
rate. If the measured distribution's mass sits far from the 316.0/337.3 boundary, or
the lattice is not 21.3px in the timed configuration, that framing is wrong
independently of the rate.
