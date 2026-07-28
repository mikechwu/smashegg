> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## M0-M2: the point-prediction test found a model defect, and the second theme is withdrawn

**Routing.** No external lineage this round, and that is a statement rather than an omission: M0 is a point-prediction test against data, M1 is arithmetic checked two ways, and M2 is a ruling the previous round already routed to Grok and received. Practice 33's substitute for a second lineage — an independent reconstruction — is the point-prediction test itself, which compares a closed-form prediction against sixteen measurements rather than against a second derivation.

### 1. [M0] The log did not carry `s`, and deriving it would have been circular

The brief expected the per-deal depth to be in the intervention's raw log. It was not — the run recorded deltas and spans only. And `s` could not be recovered from the delta, because the delta is what the model predicts *from* `s`; fitting one to the other would have been the same number twice.

So `s` was instrumented as a **card count** read from the DOM — the number of `.gd-fan__card` elements in the deepest column on each line, lines separated by their shared bottom edge (`align-items: flex-end`, confirmed by inspection). A count of cards cannot be a restatement of a measurement in pixels.

### 2. [M0 — THE FINDING] The linear extension is wrong, and it is wrong for a reason that leaves lacquer untouched

The prediction under test was `dSpan(s) = (0.841 - 0.42) * 46.51 * (s - 2)`. Regressed against 16 deals it gave a fitted slope of 17.94 against 19.58 predicted — and a **worst residual of 19.20px, a full lattice step**, concentrated entirely on the deals holding a column of five or more.

The cause is in `HandFan.tsx` and its own comment says so:

    stackOffsetW(n, stripW) = min(stripW, 2.95 / (n - 1))

A column of `n` reveals `min(stripW*(n - 1), 2.95)` card widths in total — a fixed budget spread across the reveals once the strip would exceed it. **It binds at depth 5 for a 0.841 strip and never for 0.42**, because a value class holds at most 8 copies and `0.42 * 7 = 2.94` against a budget of 2.95. A margin of one hundredth.

| model form | worst error over 16 deals |
|---|---|
| linear in `(s - 2)`, as `model.json` stated it | 19.20px |
| capped by the reveal budget | **0.10px** |

Six of the sixteen deals exercised the budget, so the run can tell the two apart.

**Three consequences, in order of how much they matter:**

1. **Every lacquer figure in this project stands.** The budget never binds at 0.42, so the collapsed form is exact there. The rates, the bands, the gate, the shipped card: unaffected.
2. **The cinnabar rate was overstated** and is corrected below.
3. **Feasibility is not a function of `s = d1 + d2` alone** once the budget binds. `(5,1)` and `(4,2)` are both `s = 6` and can land on opposite sides of the threshold. The whole "marginal bin" framing this arc is built on is a **lacquer property**, not a general one — it holds because the budget never binds there, and it was never stated as conditional.

`model.json` now carries the full form, the `revealBudget` constant, and the condition under which the collapsed form is exact.

**And the reworded claim.** 5 of 16 deals going feasible -> infeasible is *consistent with* the modelled rate and settles nothing on its own at this n — it admits a fifth to a half as readily. The theme extension rests on the point predictions matching every deal to a tenth of a pixel, which is a far stronger statement than two rates being near each other. The brief was right that the strong evidence was already in the table.

### 3. [M1] Rates move with width, and the corrected numbers

Capacity at the shipped card is 9 at inner 360 and 10 at inner 390, which changes how columns split across the two lines and therefore the depth distribution. The deepest fitting depth does not move; the mass above it does.

| cinnabar-court, shipped card | modelled |
|---|---|
| inner 390 wide | **50.3%** |
| inner 360 wide | **66.6%** |

The brief estimated ~74% at 360 from the collapsed form's bin shares; the capped form gives 66.6%. Lacquer is 0.1% at both.

`prose-figures.test.ts` now requires a section quoting a rate to name **both** the theme and the width. Theme was added last round and width this one — one round apart, and the omission appeared immediately in the very table the theme fix produced.

### 4. [M2 SHIPPED] The theme is withdrawn, and the budget is now the framework's

`cinnabar-court` is no longer registered. The face, back, art module and design record stay in tree; re-registering is one commented import in `CardFace.tsx`. Verified in the built app: the picker offers one theme, and **a player whose stored preference is the withdrawn theme falls back to lacquer** rather than breaking, because `activeDeckTheme` already checked registry membership.

Shipped alongside it, and the durable half: `stripCeilingFor(cardW, depthFloor)` in `theme.ts`, **derived rather than stored** so it cannot go stale when the card or the depth floor moves — both have moved twice in four rounds. A theme requests a reveal; the framework owns the ceiling. `strip-ceiling.test.ts` pins it over the **registry** rather than over a list of theme ids, because a list someone must remember to update is exactly what failed here, and uses the withdrawn theme's own 0.841 as the non-vacuity fixture.

Deliberately **not** a silent clamp. A theme rendered at a reveal its designer did not choose is a different design.

### 5. [M2a] Two corrections to the recorded reasoning

1. **The cross-player argument against a per-theme card scale is dropped.** It read "one player's staged king would be physically larger than another's at the same table" — but the theme is client-local, so no player ever observes another's card size. The comparison is unobservable and the argument was wrong. The other two stand on their own and the conclusion is unchanged.
2. **"Broken for anyone who picks it" overstated the metric.** The metric is `span > innerH`: on roughly half of deals no single scroll position shows the whole must-see set. **Play remains reachable** — `ScrollActionsIntoView` exists for exactly that. The accurate sentence is that such a player cannot see the must-see set at one scroll position; they can still act.

   This matters for the inference from silence, which is weak in both directions: nobody reporting it is equally consistent with nobody choosing the theme and with people choosing it, finding it worse, and switching back. The ruling rests on the measured defect and the cheapness of reversal.

### 6. [M2b] Recorded for a revival, not pursued

`docs/research/proposals/second-theme-revival.md`. The four costed options all assumed a covered card's suit must be readable — but a value class is exactly one fan column, so every card in a column is the same rank as the one on top. The covered cards need to convey **how many**, not **which**. That opens a count affordance, or compressing only the deep columns while the first covered card keeps the full strip, and neither needs a per-theme card width or a new fan layout. Speculative; written down because the premise it attacks was never stated as a premise.

### 7. [M2c] Practice 36, and a coverage gap it immediately found

**An instrument built while an effect has one sign will silently lack the other.** The intervention harness counted improving flips, both-feasible and both-infeasible, and had no counter for feasible -> infeasible; it was built across J0 and K0, when every flip went the good way. Non-vacuity checks miss this because the instrument *is* exercised and *is* green. The operational rule is to assert that a classification's categories PARTITION — that the counts sum to n — rather than trusting the categories are complete.

Applying the same eye to the viewport guard found a second instance: `desktop-mode.test.ts` enforces "no gate script hardcodes a viewport" over an explicit list, and three gates written during this arc were never added to it. All three did refuse correctly, which was luck rather than coverage. The list is now nine.

### 8. Open

Nothing on the card, nothing on the theme. The arc is closed.
