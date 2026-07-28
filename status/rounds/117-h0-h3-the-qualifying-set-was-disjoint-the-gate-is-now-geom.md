> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## H0-H3: the qualifying set was disjoint, the gate is now geometric, and no clamp passes

**Routing.** H1 and G3's design question went to **Grok** (definition and design judgement).
H0/H2/H3 got **no external audit**, stated deliberately: each is closed-form and verifiable
by brute force over the whole domain, which is stronger evidence than a second opinion.

### 1. [H0 CONFIRMED] A disjoint set was reported as an interval

Solving `margin >= 10px` in each marginal-bin regime at width 390:

| segment | width | marginal bin |
|---|---|---|
| [44.00, 44.47] | 0.47px | s=11 |
| [45.52, 46.51] | 0.99px | s=10 |
| [47.61, 48.74] | 1.13px | s=9 |
| [49.90, 51.20] | 1.30px | s=8 |
| GAP (44.47, 45.52) | 1.05px | fails — margin collapses to 4.95px at w=45.00 |
| the old report's single "interval" | 2.45px | max-minus-min of the above, i.e. the bug |

The spot check inside the gap is in the table above, and it sat inside the old report's
single reported interval. **And width is the NO-ROBUST-CHOICE signal**, so two thin
segments far apart read as comfortable — the signal failed exactly where it was needed. The lower segment was also missing from the output
although the implementation produces it, and it is where every phone below ~415px lands.

**H0a.** Setback was one-sided AND its discontinuity list was empty of tooth boundaries: my
scan looked for margin JUMPING UP as cardW fell, but a tooth boundary is margin COLLAPSING
as cardW falls — the sign was wrong, so only capacity crossings were ever found, and only
via a grid midpoint rather than the true crossing, which is where the old figure came from.
Both are now computed in **closed form**, and the corrected setbacks are:

| cardW | down to the tooth at 45.52 | up to capacity at 46.69 | two-sided | previously reported |
|---|---|---|---|---|
| 45.95 | 0.43px | 0.74px | **0.43px** | 0.88px |
| 46.10 | 0.58px | 0.59px | **0.59px** — the optimum | — |

### 2. [H1 ADOPTED] The gate is purely geometric; R is context

Grok, independently: demoting R is right for a *binary* rule, because the held-out test
earned the mechanism and the mass bins, not a tail two orders below any validated bin.

**And the third term is not merely too strict — it is unsatisfiable by any cardW rule.**
`capacity = floor((W - c - 0.3w) / (0.7w))` where `c` is the measured row chrome, and `c`
is a constant rather than a fraction of W, so even a pure `Xvw` (cardW exactly proportional to W) gives different
capacities at different widths: measured **[11,11,12,12,12] at 10vw** and **[8,9,9,9,9] at
13vw**. Grok reached the same conclusion from the structure. Replaced by the term the
derivations actually need: **capacity >= 8 at every width**, the two-line guarantee.

### 3. [H3] No clamp passes the geometric gate

Evaluating `clamp(2.75rem, Xvw, 4.25rem)` against `margin >= 10px AND two-sided setback
>= Y AND capacity >= 8` at widths 320/360/375/390/430:

| requirement | result |
|---|---|
| setback >= 0.5px | **no coefficient passes** |
| setback >= 0.4px | **no coefficient passes** |
| setback >= 0.3px | 7 pass; best 10.7vw |

Root font-size, at setback >= 0.3px:

| root | result |
|---|---|
| 14px | none pass |
| 16px | 7 pass |
| 18px | none pass |
| 20px | none pass |

**And the coefficient that does pass is the one that makes the floor bind on every phone:**

| width | 10.7vw term | floor | cardW |
|---|---|---|---|
| 320 | 34.2px | 44.0px | 44.00 |
| 390 | 41.7px | 44.0px | 44.00 |
| 430 | 46.0px | 44.0px | 46.01 |

So cardW is a constant 2.75rem across 320-390. That is exactly the configuration E4a measured as collapsing under root
font-size scaling. **The clamp form passes the width gate only by adopting the form that
fails the text-scale hazard**, which converges with E4a's conclusion from the other
direction: the card BOX must be sized in a unit the user cannot scale, with glyphs left in
rem.

### 4. [H2] The detector is now a LEADING indicator

Replaced "not more than two lines" with **measured capacity >= 8**, derived from live pitch
and content width. The line count was permanently green across the whole covered set and
only a mutant at 240 ever exercised it.

Verified at inner width 280: it fires with **capacity 7 while the fan is still rendering 2
lines** — precisely the case the trailing check cannot see.

### 5. Open

- **G3's design question** — Grok has answered; not yet read in full or acted on.
- **F5b** at `1366x681` and `390x748`, same-hand method. **E5**. **D5**, **D7**, **C2 parked**.
