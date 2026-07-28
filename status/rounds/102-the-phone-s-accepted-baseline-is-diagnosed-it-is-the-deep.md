> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The phone's accepted baseline is DIAGNOSED: it is the deep-pile rate (2026-07-27)

### The thread nobody had pulled

The same three deals failed at every strip cap from 0.42 to 0.46, so strip width
was never what bound them — and those three deals ARE the baseline that G-FOLD's
reframe implicitly made immutable. It is not immutable; it was undiagnosed.

**Diagnosed, and it is a mechanism rather than a statistic.** Measured across
runs, fan height is exactly linear in the deepest pile, in 21.3px steps
(= 0.42 × 50.7, the pile quantum), and Play's document position is a CONSTANT
536.2px below it on every reading:

| deepest pile | fan height | Play doc |
|---|---|---|
| 3 | 252.1 | 788.4 |
| 4 | 273.4 | 809.6 |
| 5 | 294.7 | 830.9 |
| **6** | **316.0** | **852.2** ✗ |

A fold at 844 admits `fanH ≤ 307.8`, i.e. **deepest pile ≤ 5 passes, ≥ 6
fails** — a clean threshold, not a distribution.

And the frequency matches: **P(deepest pile ≥ 6) = 3.89%** over 200k simulated
deals (structural bound 8, provable), against a pooled observed **4/72 = 5.6%**
across three n=24 samples. **The accepted phone below-fold baseline IS the
deep-pile rate.**

**Honest note on this run: it produced 0/24 failures**, with maxPile 3–5 and fan
heights 252.1–294.7 — no failing deal to inspect. The diagnosis therefore rests
on the cross-run relationship (four fan heights, four Play positions, one
constant offset), not on a within-sample contrast. That is weaker than a
controlled comparison and is stated as such; the way to confirm it is to
CONSTRUCT a depth-6 hand rather than wait for one, which is the same move that
settled the trick-well and pile-depth questions.

**What it unlocks:** the baseline stops being a constant to target and becomes a
mechanism with candidate fixes. One falls straight out of the formula —
`stackOffsetW = min(stripW, spread/(n−1))` with spread 2.95. Lowering the spread
to **1.68** leaves depths ≤5 untouched (2.95/4 and 1.68/4 both exceed the 0.42
cap) and compresses only depth 6+, which is exactly the failing set. It would
cost covered-card exposure on deep piles — 14.2px of strip rather than 21.3 — so
it worsens index clipping on precisely the cards the cap work is trying to
protect. **Not proposed; recorded as the candidate the diagnosis produces.**

### Cap 0.46: the owner's change accepted, and why it is right

**Derive lacquer too, even though it resolves to 1.00.** At 0.46 lacquer's
23.25px ink fits a 23.3px strip with **0.05px of margin** — and this project has
learned repeatedly that a thin margin on a variable quantity is not a margin.
Font rendering varies with DPI, browser version and subpixel rounding. But the
fix is not a higher cap; it is **not exempting a theme on a coincidence**.
"Lacquer needs no derivation because it happens to fit" converts a zero-tolerance
structural guarantee into "zero tolerance except lacquer, measured once", and
changing lacquer's ratios later would silently reintroduce clipping with nothing
failing. Applying the derivation uniformly makes "no theme ever clips" hold by
construction, and the 0.05px stops mattering because the derivation absorbs it.

### Computer use: the boundary, stated before it is used

Computer use is the right tool for **ranking** — both themes and both treatments
side by side, iterated on feedback. It **cannot settle absolute legibility**:
15.15px in a true-390px iframe on a desktop monitor is not 15.15px on a phone —
different DPI, different viewing distance, a very different visual angle. Same
class as the iOS-keyboard boundary. Recorded so "verified by computer use" is
never read as "legibility verified"; that needs a real phone in a real hand.

### The elder session should CALIBRATE the floor, not validate one value

`cornerIndexMinPx: 10` is what a theme claims about itself, enforced only as
`≥ 10` (`deck-theme.test.ts:56`), introduced with the original contract
(`f674289`), never validated with a person. So showing a range of covered-card
rank sizes — 12 / 14 / 16 / 18px — and finding where legibility breaks costs
barely more than binary-testing 15.15px and yields a constant every future glyph
decision can cite. It also answers lacquer's shipped 18.25px, which has likewise
never been validated — merely unremarked.

### Not done

The cap + uniform derivation is next and is a real change: theme metrics, a CSS
derivation that must reach `.gd-ccourt__suitGlyph` and not only the type, a
conformance test, and a runtime clamp. It was not rushed at the end of this
round. Then the seam fix, the occlusion re-measurement with the carry-the-fact
strip, and the sibling hit box.
