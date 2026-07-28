# CURRENT

> **Answers:** what is decided, what is open, and what blocks what — right now. One page,
> always true. **The values:** `MODEL.md`. **Whether to trust them, with n and
> configuration:** `VALIDATED.md`. **What was retracted:** `WITHDRAWN.md`. **Why a past
> decision went the way it did:** `rounds/INDEX.md`, then the round it names.

Last updated: 2026-07-28, round N0-N3. **Every rate on this page is a `lacquer` figure
unless it says otherwise** — see the second-theme section, which is why that sentence is
now written down.

## Decided, and shipped

| decision | what shipped | round |
|---|---|---|
| The hand card box is a **constant**, not a clamp | `--gd-handcardw`, one declaration per regime | J0 |
| The card **box** and the card **ink** are separate quantities | `--gd-handglyphw` — the box cannot be scaled by the user, the ink still can, up to a measured cap | J0b |
| A **floor** below the crossover | `@media (max-width: 332px) { --gd-handcardw: 44px }` — exactly what shipped at 320 before this arc | K2 |
| The gate's vertical term is a **fixed depth floor**, not the marginal bin's own slack | `margin(K=10, w) >= 0`, a directional tooth setback, and `capacity >= 8` | K0 |
| **The card is 46.51px** | option D — the only option that makes no width worse than before the arc | L0 |
| **`cinnabar-court` is withdrawn from the picker** | the registration import in `CardFace.tsx`, commented with the bar for putting it back. A stored preference for it falls back to lacquer. | M2 |
| **The covered-card reveal is a framework budget** | `stripCeilingFor(cardW, depthFloor)` in `theme.ts`, derived not stored, pinned by `strip-ceiling.test.ts` over the registry | M2 |

Provenance for every figure below — measured or modelled, n, configuration, validity
range — is one row per quantity in `VALIDATED.md`. This page carries decisions and what
they cost.

### The card-size regimes in force

| viewport | card | why |
|---|---|---|
| <= 332px | 44px | below the crossover a larger card fits 7 columns a line, and 15 value classes then need three lines |
| 333-719px | **46.51px** | the depth floor admits up to 47.60; this keeps the tolerance the old gate bought |
| >= 720px | `clamp(2.75rem, 13vw, 4.25rem)` | the desktop layout, untouched |

### What the depth floor K claims, as a percentile

`K = 10` is a **product policy**, not a validation result: the held-out test earns `K = 9`.
Stated so it can be ruled on — modelled, at `lacquer`, over the hand distribution:

| K | the claim | share of hands it covers |
|---|---|---|
| 9 | depth <= 9 must fit | 98.2% to 99.3% |
| 10 | depth <= 10 must fit | 99.8% to 99.9% |

The range across each row is the spread over per-line capacities 8 to 10. See `MODEL.md`.

### Setback, in a unit that can be reasoned about

A tooth sits at `w = 436.0 / c(s)` and 436.0 is the span budget, so a card setback
multiplied by `c(s)` is the **span growth the card tolerates** before it loses a depth bin.
That product is algebraically `margin(s*, w)` — the quantity K0 removed from the gate — and
using it here is not a contradiction but the distinction K0 drew: it is a valid measure of
robustness to span growth and an invalid measure of the failure rate. All `lacquer`:

| card | bin | setback | span growth tolerated | and then the rate becomes |
|---|---|---|---|---|
| 48.15 (what J0 shipped) | 9 | 1.74px | 15.2px | 7.65% |
| 46.10 | 10 | 1.50px | 13.8px | 0.74% |
| **46.51 (shipped)** | 10 | 1.09px | **10.0px** | 0.74% |
| 47.10 | 10 | 0.50px | 4.6px | 0.74% |

For scale, the span additions this project has actually made:

| feature added | span it cost |
|---|---|
| the timed room's countdown bar | 8.0px |
| the joker baseline descender (a defect, since fixed) | 5.0px |

So 10px of tolerance is about one UI feature. **And a setback is only half a risk** — 48.15 tolerates the most
span and lands in the worst place when it runs out. The shipped card's degraded state is
48.15's current state.

## Decided — the second deck theme is withdrawn

`stackStripW` is a per-theme metric: `lacquer` leaves 0.42 of each covered card visible in a
stacked column and `cinnabar-court` left 0.841. It multiplies into the fan's height, so
cinnabar's fan grew about twice as fast with depth.

At the shipped card, modelled:

| | lacquer | cinnabar-court |
|---|---|---|
| card width these rows are stated at | 46.51px | 46.51px |
| deals whose fan does not fit, inner 390 wide | 0.1% | **50.3%** |
| the same, inner 360 wide | 0.1% | **66.6%** |
| card it would need to fit depth 10 | 47.60px | **34.81px** |
| reveal it would need at this card | 0.42 | **<= 0.447** |

The width row is there because the rate moves with it: capacity is 10 at inner 390 and 9 at
inner 360, which changes how columns split across the two lines. The deepest fitting depth
does not move; the mass above it does.

**Measured, same hand, only the theme toggled through the picker**, inner 390x664, at the
shipped card — and this is where the strong evidence is:

| | |
|---|---|
| per-deal point prediction, worst error over 16 deals | **0.10px** |
| the same under the model as it stood before round M0 | 19.20px |
| deals going feasible -> infeasible | 5 of 16 |

The flip count is *consistent with* the modelled rate at this n and settles nothing on its
own — 5 of 16 admits anything from roughly a fifth to a half. **The extension rests on the
point predictions**, which match every deal to a tenth of a pixel. See `VALIDATED.md`.

**Why withdrawn rather than fixed.** Reversible, client-local, no protocol or room state, no
design work. Giving it the far smaller card it would need (the table above) was rejected —
one root constant drives the fan pitch, staged card, seat stacks and cut geometry, and theme
switching would become a layout reflow rather than a repaint. Setting its reveal to lacquer's
is not a fix as specified either — the strip that buys, against the height its vertical index
needs, is:

| at the shipped card | |
|---|---|
| strip a 0.42 reveal gives | 19.5px |
| height cinnabar's vertical rank-over-suit index needs | 30px or more |

so the suit hides under the next card on every stack. Its own fan layout is the right
investment in a validated theme and the wrong way to clear an unreported defect.

**What "broken" means here, precisely.** The metric is `span > innerH`: on roughly half of
deals a cinnabar player could not see the must-see set at any one scroll position. **They
could still act** — `ScrollActionsIntoView` reaches the action row. That is a real defect and
a smaller one than "unusable", and the distinction matters because the inference from
silence is weak either way: nobody reporting it is equally consistent with nobody choosing
it and with people choosing it, disliking it, and switching back. The ruling rests on the
measured defect and the cheapness of reversal, not on a usage claim the evidence cannot
support.

The bar for putting it back is in `docs/research/proposals/second-theme-revival.md`, which
also records an assumption all four costed options shared and which may be false.

## Open — work, not decisions

Nothing here is a measurement; where one is referenced its row is in `VALIDATED.md`.

| item | state | note |
|---|---|---|
| Compact mode below 332 | not built, and should stay unbuilt | K2 makes 320 supported, so there is nothing left to learn there. |
| Width telemetry | **not to be built** | The capacity detector is a build-time gate, not client telemetry. With K2 landed there is no open question it would answer. |
| E5, the elder session | **downgraded, not a gate** | Feedback on a shipped change, not a precondition for one. |
| C2, the wrap policy | **parked** | A wrap policy cannot create horizontal capacity. |
| `PLAN.md` | **stale in content** | Accurate as architecture, not a status document; `README.md` no longer routes to it for project state. |
| `aspect` disagreement | recorded, not resolved | CSS 1.45 against the gate scripts' 1.44970. |
| `kMinusCard` residual | recorded, not resolved | Parts sum to 125.0 against 125.1. |

## Blocking

Nothing. The card decision is closed and the second theme is withdrawn; both appear under
Decided above and neither is open.
