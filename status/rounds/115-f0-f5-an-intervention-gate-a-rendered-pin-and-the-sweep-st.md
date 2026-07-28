> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## F0-F5: an intervention gate, a rendered pin, and the sweep stops choosing small cards

### 1. [F0] METHODOLOGY practice 31 — a causal claim needs an intervention

Practice 30 (decompose before correlating) is not what went wrong in D1: `aspect 1.548`
WAS a decomposition. It failed because a **causal claim was recorded as fact on a
correlation** — joker <=> 161.5, 32 deals, no exceptions, and a frequency matching
P(hand contains a joker) to a tenth of a point. Perfect, and wrong.

**Practice 31: a causal claim stays a HYPOTHESIS until an intervention on the cause is
shown to change the effect.** Cost here was one render. Its sharper half: prefer the
intervention that would FALSIFY — acting on the *claimed* cause (the card's aspect) and
seeing nothing move is worth more than acting on a suspected fix and seeing an
improvement, because an improvement has many possible causes.

### 2. [F1a] The stale figure inside the corrected sentence

Item 6 of the last entry said today's marginal bin sits at **9.20px** of margin while
item 7's table said **14.20px**. 9.20 was computed at T = 303.9, the withdrawn 161.5
state — the sentence corrected its rate and left its margin pre-fix. Fixed.

### 3. [F1b] The mechanism, since this is the fourth instance

`tests/unit/client/prose-figures.test.ts`: every px/% figure in prose in the CURRENT
STATUS entry must also appear in a table in that entry. Mutant-verified — a sentence
carrying an unbacked "137.7px" goes red.

**Scoped to the top entry only**, because history is immutable here and retro-fitting
tables into old entries would destroy the record. **The allowlist carries a reason per
figure**, the same shape the axis registry uses: five legitimate prose figures on the
first entry (an SVG height, an off-lattice distance, a shoe probability, the withdrawn
value quoted *as* withdrawn, and a derived width). That friction is the design, not a
defect — a new orphan has to be triaged rather than absorbed.

### 4. [F2] The pin moves from rung two to rung four

The CSS text match survived only the exact line being deleted. Replaced with a
**rendered assertion in the containment probe**: no `.gd-cardframe` may make its sole-child
parent taller than itself. It runs at every card render site, at every viewport the gate
covers.

**My first version was vacuous and the mutant caught it.** Reverting the CSS fix left the
gate GREEN, because the defect needs a card with no in-flow text and the gate never
staged a joker. The gate now stages one deliberately and **reports how many probes had
one** — a clean run with zero says so rather than reading as a pass. Re-verified: with the
fix reverted it fails with the mechanism in the message; restored, it passes.

A second self-catch: detecting the joker by its localised aria-label put a CJK literal in
a script file, which the english-only sweep caught. Now detected by `.gd-card--joker`,
which is also locale-proof.

### 5. [F3 VERIFIED] The selection rule was biased toward small cards

The tooth algebra reproduces exactly: `margin(s,w) = 436.0 - (4*aspect + 0.42(s-2))w`,
giving 9.16w for s=10 and 9.58w for s=11 against the brief's figures. s=11 is marginal
while w <= 45.52; above that s=10 is.

| cardW | marginal bin | margin |
|---|---|---|
| 44.00 | s=11 | 14.53px |
| 45.20 | s=11 | 3.04px |
| **45.60** | **s=10** | **18.36px** |
| 50.70 (today) | s=10 | -28.35px |

**45.60 gives more margin than 44.00 with a 3.6% larger card** — brief confirmed. Both
teeth peak at the LOW end of their interval, so "pick the best point" walks downhill and
systematically selects a smaller card, which is the one quantity legibility cares about.

**The sweep now reports the LARGEST cardW meeting a stated R(delta) ceiling and margin
floor**, as a candidate table:

| R(10) ceiling | min margin | largest cardW | R(0) | R(10) | R(21.3) | margin |
|---|---|---|---|---|---|---|
| 1.0% | 5px | 46.70 | 0.08% | 0.74% | 0.74% | 8.30px |
| 0.1% | 10px | **46.45** | 0.08% | 0.08% | 0.74% | 10.62px |
| 0.1% | 15px | 45.95 | 0.08% | 0.08% | 0.74% | 15.17px |

**46.45 is 5.6% larger than the 44.00 the old rule picked, and only 8.4% below today.**
The tiebreak among these is R(21.3), which matters only if a ~21px drift source is real —
and the largest unmeasured one is the LINE/WeChat in-app inner height, so **that
measurement now decides the card size.**

### 6. [F4 VERIFIED] The capacity-8 floor, and it is reachable by page zoom

Measured, same hand at every width:

| width | cardW | pitch | contentW | capacity | lines |
|---|---|---|---|---|---|
| 305 | 44 | 30.8 | 243.8 | **7** | 2 (13 cols) |
| 310 | 44 | 30.8 | 248.8 | **8** | 2 |
| 320 | 44 | 30.8 | 258.8 | 8 | 2 |

**Capacity crosses 7 -> 8 between 305 and 310**, so the STRUCTURAL 15-column case needs
**~310 CSS px** for two lines — the brief's 309.6, confirmed. My closed form gave 307.6
because it used a constant chrome; the measured chrome is `48.0 + 0.3*cardW`, stable to
0.04px across four widths.

**200% page zoom on a 390px phone gives a 195px CSS viewport** — far below either figure,
and the fan silently goes to three lines, at which point every derivation in this arc is
void. The two hazards need stating separately because the fix differs: **font-size-only
scaling** changes rem without the viewport, and px sizing defends against it; **page zoom**
changes both, and px does not.

### 7. [F5a] Both span constants fully decomposed, residual 0px

- **deskH 83.0** = titleRow 27 + bar 4 + status 24 + gaps 12 + padding 14 + border 2.
  Measured sum reconciles to the whole with **0px residual**. The brief is right that
  `bar = 4` is timed-only — removing it and its gap gives 148.5, the measured untimed value.
- **K 125.1** = well->fan band 59 + fan->desk 10 + desk->bar 15 + bar height 41. Also exact.

### 8. [F5c] The level wild

`紅心2 (逢人配)` renders at card height 73.5 with a `position: relative` marker that fills
the card exactly — in flow, unlike the joker's absolute art, but not overflowing. Every
staged class measured 156.5 post-fix.

### 9. Open

- **F5b — the improvement claim is WITHDRAWN. The fix contributes ZERO to this gate.**

  | 390x664 panel, timed+staged | infeasible | worst slack |
  |---|---|---|
  | before the fix (recorded) | 1/24 | -7px |
  | after the fix (n=24, fresh deals) | 0/24 | +14.3px |
  | **the fix's own effect, same hand, n=12** | **-** | **0px** |

  The arithmetic gave it away and I did not check it: -7 to +14.3 is **21.3px, exactly
  one lattice step**, while the fix can remove at most 5px. Measured by intervention
  (practice 31, written one section above this): same page, same hand, toggle
  `vertical-align` and re-probe. **Span delta 0px on 12 of 12 deals.**

  The cause is that this gate stages `document.querySelector('.gd-fan__card')` — the
  FIRST card in DOM order — under **ascending** sort, which is the LOWEST value class and
  therefore never a joker. **Staged card was a joker on 0/12.** The relevant quantity was
  never P(hand contains a joker) = 69%; it is P(the STAGED card is a joker), which is 0
  for this driver. And 1/24 to 0/24 is Fisher p = 1.0 — practice 25 says n=24 cannot
  establish an improvement any more than it can establish a zero.

  **The whole -7 to +14.3 difference is the new sample's worst hand being one bin
  shallower.** The fix is still correct and still removes 5px where a joker IS staged; it
  simply has no effect on this cell, and that is a fine result. Claiming an improvement it
  did not produce is precisely what practice 31 exists to stop, and I did it in the entry
  that introduced practice 31.

  `1366x681` and `390x748` are still not re-run.

- **E5** the elder session — three questions, now with the F3 candidate table.
- **F4's design question** (what happens past the ~310px crossing) — not taken to a lineage.
- **D5**, **D7**, **430's own plateau**, **C2 parked**.
