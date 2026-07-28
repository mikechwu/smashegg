> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## E1: the 5px was a CSS defect, not a joker aspect — found, fixed, and it dissolved E2

### 1. [E1a] The contradiction resolves against MY inference, not against the source

The brief was right that the two facts could not both hold. Measuring every layer:

| layer | joker staged | normal staged |
|---|---|---|
| `.gd-desk__stage` (row) | 78.5 | 73.5 |
| `.gd-desk__stagedCard` (button) | **78.5** | **73.5** |
| `.gd-cardframe` | 73.5 | 73.5 |
| `.gd-card` | **73.5** | **73.5** |

**The card is 73.5 in both.** The 5px is on the BUTTON, and no descendant extends past
the card — the joker's SVG is `position: absolute`, 69.5px, with 4px of slack.

**MECHANISM, proved by intervention rather than argued:** `.gd-cardframe` is
`inline-flex` with the default `vertical-align: baseline`, so its parent's line box
reserves the font's DESCENDER below it. A card with no in-flow text has its baseline at
its bottom margin edge, so that descender lands entirely below the card. With in-flow
rank text the baseline sits above the bottom and the descender fits inside the existing
height — which is why it showed on jokers only. Setting `vertical-align: top` took the
button from **78.5 to 73.5**; `display: block` did the same. `line-height: 0` was already
present and does not help: it governs line boxes INSIDE the frame, not the parent's strut.

***My D1 claim "a joker card face is 5px taller, aspect 1.548" is WITHDRAWN.*** The source
read was right and the inference from a ROW height to a CARD aspect was wrong.

### 2. [E1b] Benign — the joker is neither squashed nor cropped

Of the brief's three possibilities it is the third. The card box is 73.5 in fan, well and
stage; the joker SVG is 69.5 inside it (`viewBox="0 0 200 290"`, aspect 1.45, matching the
card) with 4px of slack. No appearance judgement needed, so nothing went to Grok.

### 3. [E1 SHIPPED] Fixed at the class, not the instance

`vertical-align: top` on `.gd-cardframe` — the base rule, not a `.gd-desk__stagedCard`
override — pinned by a test that explains why `line-height: 0` is not the fix.
**Verified: deskH is 156.5 across 28 value classes including 小王 and 大王.** The second
state is gone. Containment green at 390x664, 320x664, 1366x681. 1289 tests pass.

**A false negative caught while writing the pin:** the test's rule selector matched the
FIRST `.gd-cardframe {...}` block, which is a later rule setting only a negative margin —
so it failed while the fix was present. Now it selects the block by `display: inline-flex`.

### 4. [E1c/E1d] The class question, and K is safe

The fan and the well were never affected: the fan's `.gd-fan__card` IS the button (no
extra wrapper), and the well holds frames directly. That is consistent with C1's
criterion 3 measuring a worst off-lattice distance of 0.1px while 69% of hands hold a
joker — the fan was never 5px taller. **K has no joker state**: the well's card measures
73.5 like everything else, so the 78-state constancy is not compromised on this axis.

### 5. [E2 DISSOLVED] There is no second value to bound

The brief asked for all 15 classes to be staged so "the worst case is 161.5" could be
proved or replaced. Post-fix there is one value: **156.5 across 28 distinct cards
reached**, jokers included. The bound question no longer exists, which is a better
outcome than a proved bound.

### 6. [E3] Both prose/table disagreements corrected

- **"same R at every delta" was wrong** — R(0) differs 8x between the candidates. The
  correct argument was one column over: **R(5) is equal, so the R(0) advantage is erased
  by 5px of drift**, and D1 had just made 5px a measured drift source.
- **"today's R(10) is 28.83%, not 7.65%" compared R(10) against R(0).** It was also
  computed at the 161.5 state, which no longer exists. Post-fix today's R(10) is **7.65%**;
  the honest statement is that today's marginal bin is 294.7, carrying ~20% of deals, at
  **14.20px** of margin (item 7's table, cardW 50.70). The figure first written here was
  9.20px — computed at T = 303.9, the withdrawn 161.5 state. The sentence corrected its
  rate and left its margin pre-fix, which is the fourth time a prose figure has
  contradicted the table beside it; F1b builds the scanner rather than restating the rule.

### 7. [E4] The recommendation moves AGAIN, to cardW 44.00

Recomputed with deskH back to 156.5 and the D2 well-scaling term:

| cardW | cap | T | R(0) | R(5) | R(10) | R(21.3) | margin |
|---|---|---|---|---|---|---|---|
| 50.70 (today) | 9 | 308.9 | 7.65% | 7.65% | 7.65% | 28.83% | 14.20px |
| 45.95 | 10 | 322.7 | 0.08% | 0.08% | 0.08% | 0.74% | 15.17px |
| 45.20 | 10 | 324.8 | 0.01% | 0.08% | 0.08% | 0.08% | 3.05px |
| **44.00** | 10 | 328.3 | **0.01%** | **0.01%** | **0.01%** | 0.08% | **14.53px** |

The sawtooth moved when the threshold moved, so 45.20's margin fell from 17.59 to 3.05.
**44.00 is now the best point** — and it is the 2.75rem floor, which matters for E4a.
**The recommendation has now moved three times (47 -> 44.95 -> 45.20 -> 44.00), every time
because a threshold term changed.** That is the argument for choosing on R(delta) and a
plateau rather than on a rate.

### 8. [E4a CONFIRMED, and worse] The rem floor would null the remedy

Under `clamp(2.75rem, 10.6vw, 4.25rem)` the vw term is decorative below ~415px, so
**cardW is `2.75rem` on every phone** — and rem tracks user-adjustable root font-size:

| root | cardW | capacity | R(0) | R(10) |
|---|---|---|---|---|
| 14px | 41.3 | 11 | 0.00% | 0.00% |
| 16px | 44.0 | 10 | 0.00% | 0.00% |
| **18px** | **49.5** | 9 | 1.38% | **7.71%** |
| **20px** | **55.0** | 8 | 35.34% | **75.01%** |

**At root 20 the layout is dramatically WORSE than today**, not merely un-remedied. The
brief predicted a return to today's rate; it is an order worse. **Elders are the
population most likely to enlarge text and the population the remedy is for.**

So the structural answer stands as the brief framed it: **decouple the card BOX from the
card GLYPHS** — size the box so feasibility is not user-controlled, keep glyph and pip
sizes in rem so text scaling still does what accessibility intends. That trade is a
legibility question and belongs in E5.

### 9. Open

- **E5** the elder session (three questions, unchanged) — planned, not run.
- **D5**, **D7**, **430's own plateau**, **C2 parked** per D6.
- METHODOLOGY practice 30 added: decompose before correlating.
