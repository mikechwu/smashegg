# CURRENT

> **Answers:** what is decided, what is open, and what blocks what — right now. One page,
> always true. **The values:** `MODEL.md`. **Whether to trust them, with n and
> configuration:** `VALIDATED.md`. **What was retracted:** `WITHDRAWN.md`. **Why a past
> decision went the way it did:** `rounds/INDEX.md`, then the round it names.

Last updated: 2026-07-28, round K0-K3.

## Decided, and shipped

| decision | what shipped | round |
|---|---|---|
| The hand card box is a **constant**, not a clamp | `--gd-handcardw`, one declaration per regime | J0 |
| The card **box** and the card **ink** are separate quantities | `--gd-handglyphw` — the box cannot be scaled by the user, the ink still can, up to a measured cap | J0b |
| **A floor below the crossover** | `@media (max-width: 332px) { --gd-handcardw: 44px }` — exactly what ships at 320 today, so the constant now withdraws support from no width | K2 |
| The gate's vertical term is a **fixed depth floor**, not the marginal bin's own slack | `margin(K=10, w) >= 0`, a directional tooth setback, and `capacity >= 8` | K0 |

Evidence for all of these — measured or modelled, n, configuration, validity range — is one
row per quantity in `VALIDATED.md`. This page carries decisions and what they cost, never
the provenance.

### The card-size regimes now in force

| viewport | card | why |
|---|---|---|
| <= 332px | 44px | below the crossover a larger card fits 7 columns a line, and 15 value classes then need three lines |
| 333-719px | 48.15px | the J0 constant — **and this is the open decision below** |
| >= 720px | `clamp(2.75rem, 13vw, 4.25rem)` | the desktop layout, untouched |

## Open — the one decision left on the card

**K0 found that the gate rewarded the worse option, and the corrected gate excludes the
shipped card.** The old vertical term was a floor on the *marginal bin's own slack*, which
moves the opposite way from the failure rate across a band edge. At width 360:

| card | marginal bin | old gate's margin | old gate | R(0) modelled |
|---|---|---|---|---|
| 46.80 (previous) | 10 | 7.37px | **fails** | **0.15%** |
| 48.15 (shipped) | 9 | 15.23px | **passes** | **1.78%** |

The two margins are the slacks of *different hands*, so reading one as safer than the other
was a unit error as well as an inversion. Decomposed at fixed capacity, the tooth crossing
carries a factor of 8.7 and the capacity change a factor of 1.4 — so it is the band edge and
not the split. Details in `MODEL.md` under `marginalBinBand`.

The corrected gate admits `w <= 47.60`. The shipped 48.15 is outside it.

| option | 320 | 360 | 375 | 390 | 430 | card at 390 |
|---|---|---|---|---|---|---|
| today's clamp, for reference | 0.02% | 0.15% | 1.31% | 7.65% | 66.93% | — |
| **A** 48.15, no floor (as J0 shipped it) | **three lines** | 1.78% | 1.31% | 1.31% | 0.74% | -5.0% |
| **B** 48.15 + the K2 floor | 0.02% | **1.78%** | 1.31% | 1.31% | 0.74% | -5.0% |
| **C** 46.10, no floor | 0.21% | 0.15% | 0.15% | 0.08% | 0.02% | -9.1% |
| **D** 46.10 + the K2 floor | 0.02% | 0.15% | 0.15% | 0.08% | 0.02% | -9.1% |

All rates modelled, at inner height 664, following state, 200,000 simulated deals each —
provenance and validity range in `VALIDATED.md`, band arithmetic in `MODEL.md`. K2 shipped
the floor, so A and C are no longer live; the choice is **B against D**.

- **B** keeps the larger card, is the only option that makes any width worse than today
  (360, in the table above), and fails the corrected gate.
- **D** has **no regression at any supported width** and passes the gate, on a card two
  millimetres narrower on a phone.

**And D's exact value is not forced.** 46.10 was chosen in J0 as the largest card fitting 8
columns at width 320; the K2 floor serves 320 directly, so that constraint no longer binds
the constant. The gate admits up to 47.60, and inside a band the failure rate is flat, so the
remaining trade is one-dimensional — card size against setback to the degrading cliff:

| cardW | setback to the cliff | vs today at 390 | note |
|---|---|---|---|
| 46.10 | 1.50px | -9.1% | the J0 pick, chosen for a constraint the floor removes |
| 46.51 | 1.09px | -8.3% | keeps exactly the tolerance the old 10px vertical floor bought |
| 47.10 | 0.50px | -7.1% | largest card meeting a 0.5px setback |

**Recommendation: D at 46.51** — the row above that keeps the tolerance the old gate bought,
on a slightly larger card than the J0 pick. But B is shippable: the difference between the
two rates in the option table is not one anybody can observe, so this is a preference, not a
measurement.

## Open — work, not decisions

Nothing in this section is a measurement; where one is referenced its row is in
`VALIDATED.md`.

| item | state | note |
|---|---|---|
| Compact mode below 332 | not built, and should stay unbuilt | K2 makes 320 supported, so there is nothing left to learn there. `docs/research/proposals/gate-composition-grok.md` holds the design if it is ever wanted. |
| Width telemetry | **not to be built** | The capacity detector is a build-time gate, not client telemetry, so J0's "ship and let the detector report who is at 320" would have reported nothing. Recorded. With K2 landed there is no open question it would answer. If width telemetry is ever wanted the minimal form is an `innerWidth` bucket on the room-join message; no new endpoint. |
| E5, the elder session | **downgraded, not a gate** | Elder users are one part of the user base, not the target. Feedback on a shipped change, not a precondition for one. |
| C2, the wrap policy | **parked** | A wrap policy cannot create horizontal capacity, so it cannot be the sub-crossover answer it was being considered for. |
| `PLAN.md` | **stale in content** | Its header still reads "M0 in progress", dated 2026-07-13. It remains accurate as ARCHITECTURE and is not a status document; `README.md` no longer routes to it for project state. |
| `aspect` disagreement | recorded, not resolved | CSS 1.45 against the gate scripts' 1.44970. 0.03px of span at the shipped card. |
| `kMinusCard` residual | recorded, not resolved | Parts sum to 125.0 against 125.1. The claim of "0px residual" is withdrawn; the constant stands. |

## Blocking

Nothing blocks. The K2 floor is shipped and removes the only regression this arc had
introduced. The B-versus-D choice sets a card size; it does not decide whether anything
works.
