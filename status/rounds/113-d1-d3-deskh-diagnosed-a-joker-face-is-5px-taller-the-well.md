> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## D1-D3: deskH diagnosed (a joker face is 5px taller), the well scales, and the plateau moves

### 1. [D1 DIAGNOSED] `deskHeight <= 156.5px, structural` is WITHDRAWN — the worst case is 161.5

Diagnosed by DECOMPOSING the desk into its child rows rather than correlating against
attributes, which localises the difference inside the element:

| child | 156.5 state | 161.5 state |
|---|---|---|
| titleRow | 27 | 27 |
| bar | 4 | 4 |
| **stage** | **73.5** | **78.5** |
| status | 24 | 24 |

**A joker card face is 5px taller than every other card** — its own aspect is 1.548
against the 1.45 `calc(var(--gd-cardw) * 1.45)` gives everything else. Confirmed by the
staged card's own label: 小王 / 大王 ⟺ 161.5, 黑桃2 ⟺ 156.5, with no exceptions in 32
deals.

**The frequency matches exactly.** P(a 27-card hand contains at least one joker) =
**69.0%**; the held-out run measured 16/23 = **69.6%**.

**On the brief's steer.** It said the 16/7 split matched no rare card type, so joker
hypotheses were probably wrong. That is right for joker CARD frequency (4/108 = 3.7%)
but the quantity that governs here is P(hand CONTAINS one) = 69%, and my instrument
always staged `cards[0]` — which under descending is the highest value class, hence a
joker whenever the hand has one. The steer was reasonable and the arithmetic behind it
was applied to the wrong quantity.

**It is CONTENT-dependent (practice 18), not session-dependent**: the player chooses what
to stage, so both states are reachable at will and the term needs a proved worst case.
Ascending measured 156.5 on 20/20 only because staging `cards[0]` there is never a joker.

### 2. [D2 ANSWERED] The trick well DOES scale with the card

From source: `TrickWell.tsx:60,67` renders `<CardFace size="hand">`, which selects
`.gd-card--hand { --gd-cardw: clamp(2.75rem, 13vw, 4.25rem) }` — the same clamp as the
fan. `.gd-card--trick` (2.25rem) carries a comment saying it is dormant, "a single card
size everywhere now". Measured: **well card 50.7x73.5, fan card 50.7x73.5.**

So `K = 125.1 + 1.45*cardW`, and a card-scale change to 44.95 removes a further **8.3px**
from K — the brief's estimate, confirmed. Also confirmed from source: `.gd-card` sets
`height: calc(var(--gd-cardw) * 1.45)`, a fixed multiplier with no separate clamp, and
the clamp bounds cardW only. Every card-scale figure in this arc rests on that ratio and
it had never been read out of the code until now.

### 3. [D3] The plateau re-computed — and today's layout is worse than it looked

With the joker worst case and the scaling well folded in:

| cardW | cap | deskH | T | R(0) | R(5) | R(10) | R(21.3) | margin |
|---|---|---|---|---|---|---|---|---|
| **50.70 (today)** | 9 | 161.5 | 303.9 | 7.65% | 7.65% | **28.83%** | 28.83% | 9.20px |
| 45.95 | 10 | 154.1 | 318.1 | 0.08% | 0.08% | 0.08% | 0.74% | 10.64px |
| **45.20** | 10 | 153.0 | 320.4 | **0.08%** | **0.08%** | **0.08%** | 0.74% | **17.59px** |
| 44.95 | 10 | 152.6 | 321.1 | 0.01% | 0.08% | 0.08% | 0.74% | 1.04px |
| 44.00 | 10 | 151.1 | 324.0 | 0.01% | 0.01% | 0.01% | 0.08% | 10.19px |

**Today's R(10) is 28.83%, not 7.65%** — the deskH worst case moves today's layout across
a lattice step under 10px of drift, and D1 makes that 5px a MEASURED drift source rather
than a hypothetical one.

**Recommendation moves from 44.95 to cardW ~45.20**: same R at every delta, and 17.59px
of margin against 44.95's 1.04px. 44.95 sits in a sawtooth dip — the same trap as
cardW 47 last round, one plateau over.

**The width generalisation, which the brief was right to flag:**

| coefficient | 320 | 360 | 375 | 390 | 430 | all in plateau? |
|---|---|---|---|---|---|---|
| 13vw (today) | 44.0 | 46.8 | 48.8 | 50.7 | 55.9 | no |
| 11.5vw | 44.0 | 44.0 | 44.0 | 44.9 | **49.5** | **no — overshoots at 430** |
| **10.6vw** | 44.0 | 44.0 | 44.0 | 44.0 | 45.6 | **yes** |

**A plateau computed at 390 cannot be implemented as a width-proportional rule without
this check**, exactly as stated: the naive 11.5vw read lands outside the plateau on an
iPhone Pro Max. `clamp(2.75rem, 10.6vw, 4.25rem)` puts every phone width inside it, and
desktop is untouched (the 68px ceiling still binds).

**CAVEAT, not yet closed:** the plateau bounds are derived at 390's content width. At 430
the content width is ~366.8 and capacity becomes **11** — a different distribution. 430
needs its own plateau before the coefficient is adopted.

### 4. Not implemented

The card-scale change is NOT made. It needs D4's legibility answer.

### 5. Open

- **D4** the elder session (legibility at cardW ~45.2 vs today's 50.7; LINE/WeChat inner
  heights; Display Zoom) — planned, not run.
- **D5** the en-locale string set and the row-width gate.
- **D7** the distribution-power addition to the prereg template.
- 430's own plateau (item 3's caveat).
- **C2 is PARKED** per D6, with the resumption notes recorded in the brief.
