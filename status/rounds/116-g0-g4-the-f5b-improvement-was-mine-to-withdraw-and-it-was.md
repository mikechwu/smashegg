> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## G0-G4: the F5b improvement was mine to withdraw, and it was a practice-31 violation

### 1. [G0 — WITHDRAWN] The fix contributes ZERO to that gate

| 390x664 panel, timed+staged | infeasible | worst slack |
|---|---|---|
| before the fix (recorded) | 1/24 | -7px |
| after the fix (n=24, fresh deals) | 0/24 | +14.3px |
| **the fix's own effect, SAME hand, n=12** | — | **0px** |
| the lattice step, for comparison | — | 21.3px |

**The arithmetic gave it away and I did not check it.** The -7 to +14.3 difference is
exactly one lattice step (table above), while the fix removes at most 5px. Measured by intervention — the
practice written one section above the claim — same page, same hand, toggle
`vertical-align`, re-probe: **span delta 0px on 12 of 12 deals.**

**Cause:** the gate stages `document.querySelector('.gd-fan__card')`, the FIRST card in
DOM order, under **ascending** sort — the LOWEST value class, never a joker. Measured:
**staged card was a joker on 0/12.** The governing quantity was never P(hand contains a
joker); it is P(the STAGED card is a joker), which is 0 for this driver. And 1/24 to 0/24
is Fisher p = 1.0, so practice 25 forbids the claim independently.

The whole difference is the new sample's worst hand being one bin shallower. **The fix is
still correct and still removes 5px wherever a joker IS staged — it simply has no effect
on this cell**, which is a fine result. I claimed an improvement it did not produce, in
the entry that introduced the practice against exactly that.

### 2. [G1] The selection rule was boundary-seeking for the third time

"best point" walked downhill to a tooth's low end; "largest qualifying" lands ON the
constraint. Both fail the same way: **the gate measures margin in fanH-space and nothing
measured setback in cardW-space.** Verified: the brief's qualifying interval and setbacks reproduce exactly (last row of the
table below; the brief's stated width differs from the computed one in the last decimal).

The sweep now reports the interval with each endpoint attributed, the distance to the
nearest discontinuity in w, and a setback-respecting pick:

| gate | interval | width | high endpoint setback | robust pick |
|---|---|---|---|---|
| R(10)<=1.0%, margin>=5px | [44.00, 46.70] | 2.70px | 0.13px — inside | **45.95** |
| R(10)<=0.1%, margin>=10px | [44.00, 46.45] | 2.45px | 0.38px — inside | **45.95** |
| R(10)<=0.1%, margin>=15px | [45.70, 45.95] | 0.25px | 0.88px | **NO ROBUST CHOICE** |
| R(0)<=0.1%, margin>=10px (the brief's gate) | (45.52, 46.51] | 1.00px | 0.24px at 46.45 | none — interval too narrow |

**45.95, at 0.88px of setback**, replaces 46.45. And at the tightest gate it now says no
robust choice exists rather than returning an endpoint.

### 3. [G3] The three-line detector, built before the design answer

Added to the containment probe, so it runs in CI at every covered viewport: the fan may
not render more than two lines, counted by distinct stack BOTTOMS. Mutant-verified — at
inner width 240 it fails with the mechanism in the message. Silent degradation was the
worst property here; it is no longer silent.

The design question past the ~310px crossing is **not** taken to a lineage yet.

### 4. [G4] Two small ones

- **The prose-figure allowlist has a non-growth ratchet** — a stated ceiling, with the
  message saying that raising it is a deliberate act. The axis registry's justification
  string started as a good idea and became the escape hatch; this one is capped.
- **METHODOLOGY practice 32**: a cheap convention can earn its keep outside its stated
  purpose. The English-only sweep exists for code consistency and caught a **locale
  coupling** — matching a joker by its localised label would have gone silently vacuous in
  another locale. Recorded because the cost of such rules is visible and their benefit is
  not, which biases every conversation about them toward removal.

### 5. Open

- **G2: 320 and 430 not swept.** The whole selection was made at 390, and the curve passes
  through three capacities (8 at 320, 10 at 390, 10-11 at 430). 320 is where the floor
  binds and capacity is 8 — one step from three lines.
- **F5b at `1366x681` and `390x748`** — still not re-run, now with the same-hand method.
- **G3's design question**, **E5**, **D5**, **D7**, **C2 parked**.
