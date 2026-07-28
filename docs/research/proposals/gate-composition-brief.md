# Two design questions about a card-table layout gate

You are an independent reviewer on two **design/definition** questions. **No web research**
(Firecrawl is disabled here and you do not need it). Work from the repository given. Do not
modify it. Answer both; they are related but separable.

## Background you need

A four-player Guandan card table, phone-first at 390px inner width. The player's hand renders
as COLUMNS (one per value class, at most 15) in a single flex row that wraps. Whether the whole
"decision" fits on screen is governed by

    slack = innerHeight - deskHeight - K - fanHeight

where fanHeight depends only on `d1 + d2` (the deepest column on each of the two wrapped
lines), moving in a lattice of ~21.3px steps. Card width `cardW` is set by
`clamp(2.75rem, 13vw, 4.25rem)` and everything scales with it.

Read `docs/research/reachability.md` §10, `PLAN.md` §9, and `scripts/cardw-sweep.mjs`.

We are choosing a smaller `cardW` to buy margin. The choice is gated on a rule, and this brief
is about what that rule should be made of.

## QUESTION 1 — should the gate include a modelled tail probability?

The gate currently reads: `R(10) <= 0.1%` AND `margin >= 10px`, where

- **margin** is pure geometry: measured constants, decomposed to 0px residual.
- **R(delta)** is `P(fanHeight > threshold - delta)` from a simulation of the 108-card shoe.

The concern: at these magnitudes R is the model's TAIL. The held-out validation
(`docs/research/prereg-descending-holdout.md`) tested only bins with expected count >= 5 —
i.e. shallow, common hands. The gate is discriminating candidates using P = 0.08% against
P = 0.74%, two orders of magnitude below any validated bin.

It is a structural extrapolation from a validated mechanism (the lattice, the shoe
combinatorics), not a fitted parameter, so it is probably about right. But gating on it grants
a precision it has not earned.

**The proposal is to make the gate purely geometric** — `margin >= X`, `two-sided setback >= Y`
from the nearest discontinuity in cardW, and `capacity identical across all supported widths`
— and demote R to an ordinal context column.

Assess. Specifically:
- Is demoting a validated-in-mechanism-but-unvalidated-in-tail quantity to context the right
  call, or does it throw away real information?
- If the gate becomes purely geometric, what is lost? Name a candidate pair the geometric gate
  cannot separate but R can, if one exists.
- How should X and Y be justified? They must come from measured drift sources, not from the
  model. Measured drift sources on record: deskHeight varies by 5px with what is staged; a
  wrapped title costs ~27px (now prevented); the timed countdown bar is 8px.
- Is "capacity identical across all supported widths" a reasonable third term, or too strict?

## QUESTION 2 — what should happen below ~310 CSS px?

Two lines require per-line capacity >= 8 for 15 value classes, which needs roughly **310 CSS
px** of viewport width at a 44px card. Below that the fan silently degrades to THREE lines, and
every derivation in this arc assumes two.

310 CSS px is reachable: **200% page zoom on a 390px phone gives a 195px CSS viewport.** It is
not exotic, and the users most likely to zoom are the elderly players this product is for.

The legibility floor (cards must stay readable) and the feasibility ceiling (the decision must
fit) are genuinely incompatible below ~310px. A clamp can only choose where they cross, not
reconcile them. **Something must yield.** Candidates:

- an internal scroll inside the fan;
- an accepted third line with a reduced must-see set;
- a different wrap policy past the crossing;
- anything you think of that is not listed.

Today the behaviour is "silently degrade", which is the worst option because nothing detects
it (a detector now exists, but it only reports).

Rank the options for an elderly, zh-Hant, phone-first audience who share a room code in a
family chat. Say which you would ship and what it costs. Be concrete about what the player
sees and does.

## Deliverable — use exactly these headings

### 1. GATE COMPOSITION
### 2. WHAT A GEOMETRIC GATE LOSES
### 3. JUSTIFYING X AND Y
### 4. BELOW 310px — THE RANKING
### 5. WHAT I WOULD SHIP
### 6. WHAT I AM UNSURE OF

End with a single literal line:

    REVIEW COMPLETE: <N> sections
