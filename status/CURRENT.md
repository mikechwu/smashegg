# CURRENT

> **Answers:** what is decided, what is open, and what blocks what — right now. One page,
> always true. **The values:** `MODEL.md`. **Whether to trust them:** `VALIDATED.md`.
> **What was retracted:** `WITHDRAWN.md`. **Why a past decision went the way it did:**
> `rounds/INDEX.md`, then the round it names.

Last updated: 2026-07-28, round J0-J3.

## Decided, and shipped

| decision | what shipped | round |
|---|---|---|
| The hand card box is a **constant**, not a clamp | `--gd-cardw: 48.15px` below the 720px layout breakpoint; today's expression unchanged at and above it | J0 |
| The card **box** and the card **ink** are separate quantities | `--gd-glyphw: min(3.009375rem, 58px)` — the box cannot be scaled by the user, the ink still can, up to a measured cap | J0b |
| Minimum **guaranteed** viewport width is **360** | Below 332.1 CSS px the layout has no supported card size | J0 |
| The gate is **purely geometric**, plus a validated-bin term | `margin >= 10px` and `margin(s=9) >= 0` and `capacity >= 8` | H1, I0 |

### What the card constant actually costs and buys, by width

The single most misleading way to state this round is "the card shrinks 5%". That is the
change at width 390 and nowhere else — below 370.4px the constant is **larger** than
today's clamp, and at 430 it is far smaller.

| inner width | card today | card now | change | capacity | R(0) modelled today | R(0) modelled now |
|---|---|---|---|---|---|---|
| 320 | 44.00 | *unsupported* | — | 8 -> **7** | 0.02% | 2.12% |
| 360 | 46.80 | 48.15 | **+2.9%** | 9 -> 8 | 0.15% | 1.78% |
| 375 | 48.75 | 48.15 | -1.2% | 9 -> 9 | 1.31% | 1.31% |
| 390 | 50.70 | 48.15 | -5.0% | 9 -> 9 | **7.65%** | **1.31%** |
| 430 | 55.90 | 48.15 | -13.9% | 9 -> 10 | **66.93%** | **0.74%** |

**430 was the worst cell in this whole arc and had never been swept.** Two independent
methods agree on it: the model says a 66.93% following-state failure rate at today's card,
and a same-hand intervention at n=12 found **8 of 12 deals infeasible before and feasible
after**, with the worst deficit moving from +30.9px to -36.3px.

Measured, same-hand, one card staged, control drift 0px on every deal:

| cell | panel-span change | feasibility | worst deficit (span - innerH) |
|---|---|---|---|
| 390x664 | -20.8px mean (-15.4 to -22.0) | 12/12 feasible in both arms | -14.3px -> -36.3px |
| 430x664 | **-70.4px mean** (-46.8 to -107.7) | **8/12 infeasible -> feasible** | +30.9px -> -36.3px |
| 390x748 | -20.4px mean | 12/12 feasible in both arms | -98.3px -> -120.3px |
| 360x664 | **+19.1px mean — worse** | 12/12 feasible in both arms | -48.1px -> -16.1px |
| 1366x681 | **0.00px on 6/6** | the desktop branch is untouched — this cell is a control on the media query | unchanged |

The 360 row is the honest cost of a single constant: below width 370.4 the constant is
larger than the clamp, so the vertical situation there gets worse. It stays inside the geometric
gate — the marginal bin's margin is a property of the card, not of the width, so it is the
same everywhere — and it stays feasible on every deal measured, but it is a real trade and
not a rounding error.

### One thing this round changed that was not on the brief

The card's width was **nine copies of one clamp literal**, kept in agreement by four tests.
Changing the card changed one copy; the other eight kept computing column overlaps from the
old value, which lays columns out at one width and draws them at another. The pins caught
it, a first set of measurements was taken against the broken state and discarded, and the
nine copies are now one `--gd-handcardw` declaration. METHODOLOGY practice 34.

## Open — for the owner

1. **320 is a withdrawal, not a gap, and there is a one-line alternative.** Today's clamp
   serves 320 through its 2.75rem floor: the card is 44px there, capacity is 8, and it
   works at the default root font-size. The constant takes capacity to 7 and 15 value
   classes then need three lines. A second constant below the crossover —
   `@media (max-width: 332px) { --gd-cardw: 44px; }`, exactly what ships at 320 today —
   would preserve it at the cost of the "no cardW breakpoint" property. The J0 brief ruled
   for the single constant; this note records what that ruling gives up, because the ruling
   was made on the belief that 320 was merely unserved.
2. **The compact-mode feedback loop described in the brief does not exist.** The capacity
   detector is `scripts/containment.mjs`, a build-time gate. It fires at 320 — verified,
   3 violations at n=2 — but it observes *our* gate runs, not users. There is no telemetry
   in the client (no `innerWidth` read anywhere in `src/client`), so shipping and waiting
   for the detector to report who is at 320 will report nothing. Choosing not to build
   compact mode is reasonable; expecting to learn from its absence is not.

## Open — work, not decisions

| item | state | note |
|---|---|---|
| Compact mode | not built | Grok's ranked answer is `docs/research/proposals/gate-composition-grok.md`: horizontal column scroller at the same card size, loud cue, vertical stack preserved. Trigger should be evidence, not speculation — but see open item 2 about where that evidence would come from. |
| E5, the elder session | **downgraded, not a gate** | Owner direction J: elder users are one part of the user base, not the target. If it runs it is feedback on a shipped change, not a precondition. Note that it would now be asked about a card that is *larger* at 360 and *smaller* at 430. |
| C2, the wrap policy | **parked** | Grok: a wrap policy "cannot create horizontal capacity... do not sell it as the sub-310 answer". It cannot be the answer below the crossover, which is what it was being considered for. |
| D5, the `en` string set and row-width gate | done this round | |
| D7, distribution power in the prereg template | done this round | |
| `aspect` disagreement | recorded, not resolved | CSS says 1.45, the gate scripts carry 1.44970. 0.03px of span at the shipped card. Changing the scripts would move every recorded figure for no gain. |
| `kMinusCard` residual | recorded, not resolved | Parts sum to 125.0 against 125.1. 0.1px. The claim of "0px residual" is withdrawn; the constant stands. |

## Blocking

Nothing blocks shipping the card constant. The two open decisions above are about what to
do *next*, not about whether this change is sound.
