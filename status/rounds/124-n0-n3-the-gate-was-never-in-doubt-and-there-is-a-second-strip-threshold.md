> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## N0-N3: the gate was never in doubt, and there is a second strip threshold

**Routing.** No external lineage, and none was needed: N0 and N2 are closed-form claims checked by brute force over their whole domain, N1 adds a derived quantity, and N3 is documentation with tests. Practice 33's substitute for a second opinion — an independent exhaustive reconstruction — is what N0 and N2 are.

### 1. [N0 CONFIRMED, and the previous round over-generalised]

`reveal(d) = min(stripW*(d - 1), 2.95)` is concave in `d`, so at fixed total depth the sum over the two lines is maximised by the **balanced** split — and at that split, if it does not itself reach the budget, the sum is exactly `stripW*(s - 2)`, the collapsed form. **So the collapsed form is the exact MAXIMUM over splits, which is what a bound needs.**

Brute-forced over every achievable `(d1, d2)` with `1 <= di <= 8` at every `s` from 2 to 16, for three strips:

| strip | exact as the max? | first `s` where it is not |
|---|---|---|
| lacquer 0.42 | **yes at every depth the shoe allows** | never — `(8,8)` gives 2.94 against a budget of 2.95 |
| the shipped ceiling 0.447 | yes at the depth floor `(5,5)` | s = 16 |
| cinnabar-court 0.841 | yes at its own marginal bin `(3,3)` | s = 9 |

The balanced split was the maximiser in all 45 cases, with no exceptions.

So round M0's third consequence — "the marginal-bin framing is a lacquer property, not a general one" — **was too strong and is corrected**. The framing is valid wherever the balanced split at the depth floor stays under the budget, which includes lacquer, the shipped strip ceiling, and cinnabar at its own marginal bin. **The GATE was never in doubt.** What genuinely needed the capped form is the **rate**, which depends on the joint distribution of `(d1, d2)` rather than the marginal distribution of `s` — and that is precisely what the 51.3% -> 50.3% and 66.9% -> 66.6% corrections were.

The brief's reason for insisting is the right one: read literally, the over-general sentence casts doubt on a gate that is fine, and a later round would have spent itself re-deriving it.

### 2. [N1] Two strip thresholds, and only one was encoded

| threshold | value at the shipped card | asks | enforced? |
|---|---|---|---|
| `stripCeilingFor(46.51, 10)` | 0.447 | do depth-10 hands still fit? | yes, since M2 |
| `collapsedExactCeilingFor(8)` | 0.4214 | is the simple height formula still exact? | **was absent** |

The second is **lower**, so there is a gap: a theme requesting 0.43 passes the gate and yet its depth-8 columns reach the budget, which makes every rate computed for it from the collapsed form wrong while the gate stays green. A smaller version of the defect M0 found, which the mechanism M2 shipped could not catch.

It is now derived beside the first, and it **detects rather than refuses** — exceeding it is legal and only says which formula that theme's rates need. `maxColumnDepth` is recorded as a `structural` constant with its counting argument: a column is one value class, and a class holds 8 copies, two decks by four suits.

And the margin this rests on is worth stating: **lacquer's 0.42 sits 0.00143 below the line**, 0.34% of its own value. "Every lacquer figure stands" is true and that is the whole of what makes it true.

### 3. [N2] `stripCeilingFor` is exact, not merely conservative — with its domain

A future reader will notice the ceiling was derived from the collapsed form, know that form can fail, and reasonably suspect the ceiling. It cannot fail here, and substituting it into the balanced-split check shows why: for even `K` the load is `(spanBudget/w - 4*aspect)/2`, **independent of K entirely** — 1.79 at the shipped card against a budget of 2.95.

Two qualifications the one-line proof omits, both verified:

- it fails at `K = 3`, where the load equals the full numerator (3.58); `K = 3` is not a depth floor anyone would set;
- it needs `w > 37.27px`. Both shipped cards — 46.51 and the 44px narrow floor — clear it comfortably.

So: exact for every depth floor `K >= 4` at any card wider than 37.27px. Recorded on `stripCeiling` in `model.json`.

### 4. [N3a] The list patch is gone; gates are enumerated

Round M2 drew opposite lessons from one round: `strip-ceiling.test.ts` pinned over the **registry** "because a list someone must remember to update is exactly what failed here", while the viewport guard took a list patch and recorded "the list is now nine". **It was behind by five at the moment it was declared fixed** — this round's enumeration finds fourteen browser gates.

Membership is now behavioural: a script that launches a browser is a gate that renders something, so it joins the moment it is written. The enumeration carries its own non-vacuity floor, because an enumeration that matches nothing is green in a way a list is not.

**It found a real hole immediately.** `fan-geometry-sweep.mjs` demanded its width and **defaulted its height to 900** — the exact defect the guard exists to prevent, one field over, in a script that already had the guard for the other axis. 900 is not an inner height any browser presents.

**And a second, created by this arc's own withdrawal.** The same script verified its deck theme by reading back the value it had just written to `localStorage`, which confirms only that storage works. Since M2 unregistered `cinnabar-court`, the app maps that id to the default — so the sweep would have rendered lacquer, labelled it cinnabar, and passed its own theme assertion. Practice 11 inside the check written to prevent it. Both that script and `measure-simultaneity.mjs` now verify the **rendered** theme by looking for lacquer's horizontal index row, which no other theme draws. The sweep's default theme list also no longer names a theme the app cannot render.

### 5. [N3b] A decided item may not also be blocking

`CURRENT.md`'s Blocking section still described the second theme as "a live product defect awaiting a ruling" a round after it was withdrawn — and after M2a had corrected that exact wording elsewhere on the same page. Both halves stale, in a file whose header says "always true".

**No scanner could see it, because the sentence contains no figure.** The prose-figure and withdrawn-number checks are both figure-shaped. So the new rule is structural: an identifier appearing in the Decided table may not also appear under Blocking. Identifiers rather than prose, because they are the part of a sentence that survives rewording. Mutant-verified through the same function, using the real stale text.

### 6. [N3c] Relative time in a living document

`VALIDATED.md` said "the first same-hand intervention run of **this round**" — which was J0-J3, two rounds earlier. In a document that outlives its round, a relative time reference goes false without anyone editing it. Named, along with one in `CURRENT.md`.

### 7. METHODOLOGY

**Practice 32 gains a second, larger instance.** M0's defect was bounded rather than a crisis because `VALIDATED.md`'s `configuration` field already carried "every span figure in this model is a lacquer figure" — a scoping field added rounds earlier for reporting hygiene, which turned out to be damage control on a modelling error. The corollary: a scoping field is cheap insurance against a defect in the thing it scopes, which is a reason to write one even when the scope feels obvious.

**Practice 37: a weak test confirms, a strong test exposes.** The binary test would have blessed the broken model — 5 of 16 against 50.3% admits a fifth to a half, and the broken and corrected forms both predict rates inside that interval. The point-prediction test put the broken form's worst residual at a full lattice step with nowhere to hide. Before running a comparison, ask what it would say if the claim were wrong; if the answer is "roughly the same thing", it is a formality rather than a test.

### 8. Open

Nothing. The arc is closed.
