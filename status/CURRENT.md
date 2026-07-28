# CURRENT

> **Answers:** what is decided, what is open, and what blocks what — right now. One page,
> always true. **The values:** `MODEL.md`. **Whether to trust them, with n and
> configuration:** `VALIDATED.md`. **What was retracted:** `WITHDRAWN.md`. **Why a past
> decision went the way it did:** `rounds/INDEX.md`, then the round it names.

Last updated: 2026-07-28, round L0-L2. **Every rate on this page is a `lacquer` figure
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

## Open — the second deck theme, which every figure in this arc excluded

`stackStripW` is a per-theme metric: `lacquer` leaves 0.42 of each covered card visible in a
stacked column and `cinnabar-court` leaves 0.841. It multiplies into the lattice step, so
cinnabar's fan grows about twice as fast with depth. The theme is reachable from a `<select>`
in the app header, on every screen, one tap.

| at the shipped 46.51px card | lacquer | cinnabar-court |
|---|---|---|
| deepest hand that fits | 10 | **6** |
| share of hands that do not fit, modelled | 0.1% | **51.3%** |
| card width it would need to fit depth 10 | 47.60px | **34.81px** |
| strip it would need to fit depth 10 at this card | 0.42 | **<= 0.447** |

**Measured, same hand, only the theme toggled through the picker** — control drift 0px on
every deal:

| | lacquer -> cinnabar-court |
|---|---|
| panel span growth | 59px to 118px |
| deals going feasible -> infeasible | **6 of 12** |
| the same rate, modelled | 51.3% |

Two methods at one configuration, agreeing. See `VALIDATED.md`.

**This is structural, not tuning.** The strip cinnabar would need to fit the depth floor is
essentially lacquer's, and the tall strip is what its vertical rank-over-suit index requires.

The options, with the external design review's ranking (`docs/research/proposals/second-theme-grok.md`):

| option | call | why |
|---|---|---|
| **withdraw from the picker** | **recommended, and reversible** | Broken since it shipped with no report. Silence licenses removal, not neglect. |
| its own ~35px card | **reject** | Card width is one root constant the whole table hangs off; two theme-local widths are two products to gate, and one player's staged king would be physically larger than another's at the same table. |
| set its strip to ~0.42 | **not a fix as stated** | A 0.42 strip at this card is 19.5px against a vertical index that wants 30px, so the suit hides under the next card on every stack. Trades a fold failure for unreadable stacks. Only viable WITH a redesigned covered mark. |
| its own fan layout | too expensive | The right investment in a validated theme, not the way to clear an unreported ship defect. |

**And the review names a repair the four options skip:** `stackStripW` is declared as art
freedom over `[0.3, 1.0]` while it spends a shared vertical budget. The theme should
*request* a strip and the framework should *own* the cap. That is the durable fix whatever
happens to this theme.

**Nothing was built this round.** The decision is the owner's.

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

Nothing blocks. The card decision is closed. The second theme is broken for anyone who
picks it and has been since it shipped; that is a live product defect awaiting a ruling, not
a regression this arc introduced.
