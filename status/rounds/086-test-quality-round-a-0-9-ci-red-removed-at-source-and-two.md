> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Test-quality round: a 0.9% CI red removed at source, and two gates re-based (2026-07-26)

### What shipped

**1. The timing e2e flake is gone, by deleting the randomness rather than the
assertion.** `tests/e2e/timing.e2e.test.ts` led with `hints[0]`, which is a
single of `RANKS[0]` = `'2'` — the level rank at hand 1 — on ~91% of deals.
Almost nothing beats it, so the first follower was left with no legal play,
classed `'forcedPass'`, and was armed with the 4s grace instead of the 45s
planning window. The assertion then read `4000 > 40_000`. It now leads its
LOWEST single, chosen from the wire (`playerView.hand` is already
`sortCards`'d, so no engine ordering is re-derived test-side).

Measured, by engine replay over fresh server-format seeds:

| lead | first follower forced |
|---|---|
| `hints[0]` (before) | 178/20,000 = **0.890%** |
| lowest single (now) | **0/20,000** |

The bound is structural, not sampled: a bomb-free 27-card hand spans >= 9
distinct ranks, so a follower can only be forced by a J-or-higher lead, which
needs the leader's whole hand inside {J,Q,K,A,level,SJ,BJ} — ~3e-14.

**The assertion stayed UNCONDITIONAL.** A hints-conditioned form was designed,
measured and rejected: `isForcedPass` IS `legalPlays(...).length === 0` and the
hints come from that same call, so the condition entails the class it guards.
Under a `legalPlays` that drops bombs against a single, the first follower flips
to forced on ~28% of deals and the conditional form is green on all of them.

**2. The unit twin was fixed, not left defused.** `timing-class.test.ts` asserted
"seats 1-3 are all `planning`" after the lead — the same wrong rule, failing on
289/30,000 fresh seeds (0.963%), every failure seat 1. It could not flake only
because the seed is a literal. Non-actors are now asserted plainly (the
`forcedPass` branch is gated on `trick.toAct === seat`, so they are structurally
safe), the actor's precondition is asserted alongside its class, and a new
companion test pins the precedence itself so the caveat is checked rather than
commented.

**3. One assertion was ADDED — the only item here that buys detection rather
than removing flake.** A follower's SECOND decision — a seat whose only prior
action was a PASS — must class `'turn'`. Two mutants motivate it: marking the
acted flag on a PLAY only, and using a card-count proxy for "has acted" — a pass
changes neither. **Verified discriminating:** injecting the play-only mutant
turns this line red with `seat 1 already passed this hand, so its window is
spent: expected 'planning' to be 'turn'`, while every pre-existing assertion in
that file still passes.

**Scope corrected after audit.** The first draft said both mutants sat at "0%
detection". That is true of the E2E FILE and false of the SUITE: the unit twin
`timing-class.test.ts` already catches both at the model level — its
`actOnce(state, 1)` makes seat 1 PASS, so a play-only acted flag leaves it
`'planning'` and the pre-existing line 48 goes red. Confirmed by injecting the
mutant. What the new row actually adds is the WIRE path — that a passer's spent
window survives the DO's per-seat resolution and the broadcast — which no unit
test can see. Still worth its 25 lines, but for a narrower reason than claimed.

**4. The lost detection is now a BIDIRECTIONAL dependency, not a one-way note.**
Leading low gives up this test's ability to notice a `legalPlays` that
under-generates. That is acceptable only if the mutant is owned deterministically
elsewhere — and a comment saying so decays silently if the owner is deleted. So
`generate.test.ts` carries a note naming what it now also covers and pointing at
the e2e, and the e2e points back at it. Whoever deletes it sees the consequence
at the moment of deletion.

**SELF-CORRECTION, caught while verifying this very claim.** The first draft of
that note named `combos.test.ts` ("bombs beat every non-bomb") as a co-owner.
**It is not one.** Injecting a `legalPlays` that drops bombs when answering a
non-bomb leaves `combos.test.ts` fully green at 87/87 — it tests `beats()`, a
pure comparison, which never consults the generator. The tests that DO go red
are both in `generate.test.ts`: the new bomb case and the pre-existing
"following filter: only beating projections are generated".

So a change whose stated purpose was removing a mitigation-that-doesn't-exist
shipped, in draft, a mitigation that didn't exist. It was caught only because
the claim was tested by injecting the mutant instead of being reasoned about —
which is the whole operational content of practices 11 and 12. The pointers now
name `generate.test.ts` alone, and each says the check was run rather than
argued.

Rationale worth keeping: **a detection that will always be read as noise has an
effective rate of zero, not 28%.** The old failure message was `expected
'planning', got 'forcedPass'` — indistinguishable from the 0.9% flake beside it,
so in practice it would have been re-run and dismissed. This round exists
because "flaky, re-run it" buried a deterministic logic error for weeks.

**5. jiefeng KEPT unchanged, with the diagnosis moved to the point of failure.**
The ~1-in-10,000 assertion stays: unlike the timing line it is TRUE of the
product (jiefeng occurs in essentially every completed match), so it is a
coverage sentinel rather than a wrong rule. Narrowing it makes it vacuous;
deleting it removes the only wire witness for that event type. But a diagnosis
filed only in STATUS is useless to whoever meets the red in CI months from now,
so the test now carries the expected rate, the date, the two reproducing
server-format seeds, and the pointer to the deterministic unit coverage —
**reachable from the red, not merely archived.**

Recorded because it bears on the decision's strength: one reviewer's "keep"
position rested on a premise it did not verify — its replay harness deadlocks in
`ceremonyCut`, so it adopted the reported ~1-in-10,000 rather than measuring its
own. The independently verified part is the seed pair, which does reproduce.

**6. Seed hook REJECTED.** The blast radius is a difference in kind: the existing
test-only hooks gate DURATIONS and fail recoverably, while a leaked seed makes
every match in the Worker deal identical cards — a total fairness break in a card
game. Nothing needs it after this change.

### The fold gate is now a RATE, and the old rule is retired

`scripts/measure-fold.mjs` printed PASS/FAIL from a 6-deal run. At a true rate
near 8% a 6-deal run sees nothing on 61% of runs, which is exactly how "the base
layout puts Play above the fold" entered the record. It now reports a rate with a
Wilson 95% interval, refuses to conclude below a `MIN_DEALS` floor, prints the
observed step-function buckets, and exits non-zero only on a base position above
the highest KNOWN bucket — the signal that the step function itself moved.

Default sample size raised 6 -> 40, justified rather than inherited: 40 is the
smallest round n whose miss probability at p=0.08 is under 5%. That increase
immediately hit a real limit — `POST /api/rooms` is capped at 15 creates/60s per
IP (`CREATE_LIMITER`), and a straight 40-deal loop died mid-run with an opaque
WebSocket error. The create now retries on 429; a gate that cannot complete its
own sample size is not a gate.

Latest run, n=40: **below fold without a shelf 1/40 = 2.5%, 95% CI [0.4%,
12.9%]**; with one shelf **40/40 = 100%**. Cumulative across n=16/24/40 runs:
4/80 = 5%, consistent with the 200k-deal model estimate of 7.3%. Buckets seen:
736.9 / 767.1 / 788.4 / 809.6 / 830.9 / 852.2 — two lower than previously
recorded, which is a better draw, not a regression.

### The fold RULE is not settled, and the measurement argues against the lean

The owner's earlier acceptance of shelf scrolling rested on the default keeping
the fold guarantee, so the common case did not pay for the rare one. That premise
is false, so the rule had to be either fixed or restated. **Measured both
candidates on the same 24 deals at 390x844:**

| rule | violated | 95% CI |
|---|---|---|
| R1 base layout puts Play above the fold | 2/24 = 8.3% | [2.3%, 25.8%] |
| R2a Play is REACHABLE during the turn | 0/24 = 0.0% | [0.0%, 13.8%] |
| R2b Play does NOT MOVE during the turn | **22/24 = 91.7%** | [74.2%, 97.7%] |

Viewport drift: min 0, median 25px, **max 76.5px**, and it lands at the moment
the player lifts their FIRST card (T0->T1); later selection changes move it 0px
in every deal. Mechanism: lifting a card makes the desk go loud and therefore
TALLER, pushing the actions row down; `ScrollActionsIntoView` then scrolls to
compensate, and the net is the target moving under the finger. Tell: the only two
deals with zero drift are exactly the two that fail R1 — they start already
scrolled, so the button is pre-positioned.

**So the proposed restatement is not a rule the product satisfies either — it is
violated ~92% of the time against R1's ~8%.** Adopting "never moves" as the hard
line would swap a rule that is false 8% of the time for one that is false 92% of
the time. NOT SETTLED, and deliberately so; it needs its own round, because the
obvious fix has a cost that runs the other way: reserving the loud-desk height
permanently (~54px, the measured loud-vs-quiet delta) removes the reflow and
therefore the drift, but spends 54px against a fold budget already overdrawn —
pushing R1's violation rate from ~8% to roughly half of all deals. **Eliminating
the drift makes the fold worse.** That trade is an owner decision with a real
price on both sides, not an engineering cleanup.

### METHODOLOGY practice 12 added — "a sample is not a property"

Practice 11 is measuring the wrong QUANTITY. Practice 12 is measuring the right
one too few times, or while holding the deciding variable constant, and writing
the result down as a rule. Its instances: "Play fits 6/6" (whose recorded spread
was exactly ONE 21.3px quantum of the fan's step function — the sample never
varied what decided the outcome, and said so at the time); the `markerSeat`
collapse; and this project's own `wrongGuessFor` loop that claimed "both config
sizes" while varying `suddenDeath` (which cannot matter) and holding `rangeMax`
(which is the only axis that does). It also records the diagnosis split the owner
asked for: fixed seeds give a deterministic brittle threshold; a fresh sample
with ±2.3σ bands has ~2% two-tailed false positives BY CONSTRUCTION. Different
defects, different fixes — settle which before choosing a remedy.

### Audit — and the disclosure that goes with it

Codex and Grok both **designed** the previous round's fix, so this is NOT a clean
two-lineage pass and is not claimed as one. Both ran as fresh, stateless
invocations against a brief that attributes no idea to anyone, which is the best
available mitigation, not an equivalent one.

**Codex: 3 findings. Grok: 3 findings.** Two coincide, and one of those is the
`combos.test.ts` error above — found independently by both auditors AND by the
mutation run here, three ways. All accepted and fixed:

| finding | severity | disposition |
|---|---|---|
| `combos.test.ts` does not own the generator mutant | MED (Grok) / LOW (Codex) | fixed; three-way confirmation |
| `measure-fold.mjs` exits 0 when every reading is `null` | MED (both) | fixed — see below |
| "0% detection" was file-scoped, not suite-scoped | LOW (Codex) | fixed above |
| "0/300,000 follower-instances" not reproducible | LOW (Grok) | removed; only the 0/20,000 this round ran is stated |

**The `measure-fold.mjs` hole was real and mine.** `FOLD()` returns `null` when
the action-bar selector matches nothing; the null then flowed onward looking
harmless — `(null?.docBottom ?? 0) > (null?.fold ?? 0)` is `0 > 0` = false, so
the deal counted as "fits", the bucket list came out empty, and the script
printed NO REGRESSION and exited 0 having measured nothing. A selector rename
would have produced a perfectly green run. `MIN_DEALS` floored the number of
ROWS, not the number of MEASUREMENTS. The gate now fails loudly when any reading
is null. **A rewrite whose stated purpose was retiring "green while measuring
nothing" shipped, in draft, a new instance of it** — the second such
self-inflicted case this round, alongside the `combos.test.ts` citation.

The "0/300,000" figure is worth naming as a class: it was produced by a
subagent's analysis and I repeated it in a code comment as measured fact. It was
not reproducible on audit. The comment now states only the 0/20,000 that was
actually run here.

### Gates

typecheck (4 configs) ✓ · unit **1244/1244, 51 files** ✓ · lint:hooks ✓ ·
`timing.e2e` 3/3 ✓ · new assertion verified RED under an injected engine mutant
and the engine restored byte-identical ✓ · fold gate n=40 completes and reports
a rate ✓

### Not done

`ceremony.test.ts:653/667/700` (±2.3σ uniformity bands over fixed seeds) is a
separate round by owner decision — and per practice 12 the first question there
is which defect it is, since the seeds being literals makes it a brittle
threshold rather than a flake.
