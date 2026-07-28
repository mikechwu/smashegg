# Pre-registration — the HELD-OUT test of the single-ordering fan model (C1)

**Written 2026-07-27, BEFORE the measuring script existed.** Committed before
`scripts/validate-fan-model.mjs` gained a sort knob. A threshold chosen after seeing
the data is not a gate — and, this time specifically, **a diagnosis is not covered by
the pre-registration of the test that produced it.**

## Why this exists

The previous round's pre-registered test rejected H0 (2.50%) and, via its distribution
criterion, rejected H1 (13.14%). The **diagnosis** that followed — that the model had
scored every deal at the taller of its two sort orderings, right for a bound and wrong
for a rate — was arrived at *after* seeing the data, and the single-ordering refit
reproduced the measured distribution at chi-square ≈ 1.4 on 4 df.

**That is what fitting looks like on the discovery sample.** Every figure now resting on
the corrected model — 7.65%, 9.23%, 6.39%, 1.32%, and every rate in the cardW sawtooth —
inherits that status. None of them is validated.

**Descending is the natural held-out configuration**: it was not used to motivate the
diagnosis, it is a population that has never been measured in a browser, and one
experiment validates the model and measures the population at the same time.

## Configuration, pinned and declared

Real timed room (`perTurnMs: 45000, planningMs: 90000, autoPassNoPlay: true`), lacquer,
zh-Hant, no shelf, one card staged, **following** state only (trick well non-empty),
**`pref:handSort = 'desc'`**, inner **390×664**, browser chrome excluded. Turns with a
real choice only (a non-pass hint available), as before.

**Unit:** per deal, at the viewer's first decision — the deal's maximum, since the hand
only shrinks and fanHeight is monotone in it.

**n ≥ 110 following deals.**

## The predictions, fixed now

Threshold: `fanH > 664 − 156.5 (deskH timed+staged) − 198.6 (K following) = 308.9`.

**Predicted infeasible rate under descending: 9.23%.**

| bin | predicted share | expected count at n=110 | 95% binomial interval |
|---|---|---|---|
| 230.8 | 2.68% | 2.9 | [0, 6] |
| 252.1 | 23.66% | 26.0 | [17, 35] |
| 273.4 | 39.91% | 43.9 | [34, 54] |
| 294.7 | 24.36% | 26.8 | [18, 36] |
| 316.0 | 7.60% | 8.4 | [3, 14] |
| 337.3 | 1.43% | 1.6 | [0, 4] |

## Agreement criteria — the same three as `prereg-fan-model.md`

The model is CONFIRMED on held-out data iff all three hold:

1. Every bin with expected count **≥ 5** (252.1, 273.4, 294.7, 316.0) has an observed
   count inside its **95% binomial interval** above.
2. No bin with predicted proportion **≥ 5%** has an observed count of **0**.
3. No observed fanHeight falls **off the 21.3px lattice** by more than **1.0px**.

## The rate test, stated separately and honestly

The rate is a weaker check than the distribution and is reported as such. At n=110 a
true 9.23% gives an expected 10.2 failures with SD 3.0, so the 95% band is roughly
**[4, 16]**. An observed count in that band is *consistent with* the prediction; it does
**not** discriminate 9.23% from, say, 7.65%, and no claim of the form "X% agrees with
Y%" may be made from it. **The distribution criteria decide.**

## What each outcome means

- **All three criteria pass** → the single-ordering model is validated out of sample.
  C2–C4's figures may drop the unvalidated caveat, and descending's rate becomes
  measured rather than modelled.
- **Any criterion fails** → **C2, C3 and C4's pricing are void**, and that is the
  round's headline. The failure pattern says which term is wrong: a shift in the mass
  between adjacent bins implicates the line-assignment rule (capacity 9, greedy fill);
  an off-lattice value implicates the height formula itself.
- **Rate consistent but distribution failing** → the same as "criterion fails". The
  previous round established that the rate test cannot separate models that the
  distribution test can.

## What this does NOT establish

Nothing about cinnabar-court, about widths other than 390, about locales other than
zh-Hant, or about the wrap-policy variants in C2 — those change the line-assignment
rule, so a validated greedy model says nothing about them.
