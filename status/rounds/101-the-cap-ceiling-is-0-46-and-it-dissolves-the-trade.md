> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The cap ceiling is 0.46, and it dissolves the trade (2026-07-27)

### A. The fold is FLAT from 0.42 to 0.46, then steps

0.42 was never a proven ceiling — it is lacquer's current value, and nothing
between it and 0.50 had been measured. Measured, phone inner 390×844, n=24, no
shelf, against the canonical 8.3% [3.3%, 19.6%] baseline:

| cap | strip | Play med / worst | below fold |
|---|---|---|---|
| 0.42 | 21.3px | 809.6 / 852.2 | **3/24 = 12.5%** [4.3, 31.0] |
| 0.44 | 22.3px | 814.7 / 859.3 | **3/24 = 12.5%** |
| 0.45 | 22.8px | 817.3 / 862.9 | **3/24 = 12.5%** |
| **0.46** | **23.3px** | 819.8 / 866.4 | **3/24 = 12.5%** |
| 0.48 | 24.3px | 824.9 / 873.5 | **10/24 = 41.7%** [24.5, 61.2] |
| 0.50 | 25.4px | 830.0 / 880.6 | 10/24 = 41.7% |

**The same three deals fail at every cap from 0.42 to 0.46 — raising the cap
that far changes the fold rate not at all.** It steps at 0.48. So the measured
ceiling is **0.46**, and the owner's hypothesis that something above 0.42 would
hold is confirmed at the top of the range suggested.

### B. At cap 0.46 the trade very nearly disappears

Index scale each theme needs at each cap (horizontal index, phone):

| cap | lacquer | cinnabar-court |
|---|---|---|
| 0.42 | 0.88 → 16.06px | 0.72 → 13.14px |
| 0.45 | 0.95 → 17.34px | 0.77 → 14.05px |
| **0.46** | **1.00 → 18.25px (NO CHANGE)** | **0.83 → 15.15px** |
| 0.48 | 1.00 | 0.88 → 16.06px |

**At 0.46, lacquer needs no change at all** — its shipped 23.25px ink fits the
23.3px strip — **and its 1.96px clip disappears too.** Cinnabar derives to 0.83,
a complete 15.15px glyph, against 12.78px at a 0.42 cap and a claimed floor of 10.

So the choice the owner was about to rule on has mostly evaporated:

- **Cap 0.46 + derived index ratios**: fold unchanged (same 3/24 as today);
  **lacquer untouched and no longer clipping**; cinnabar complete at 15.15px
  instead of clipped by 6.23px. Nothing clips, by construction.
- The bounded-tolerance fallback ("no theme may clip more than X") is no longer
  needed to protect lacquer — at 0.46 the tolerance can be **zero** and lacquer
  still costs nothing, which keeps the structural guarantee at its strongest.

**What still needs eyes, and is not dissolved:** whether a complete 15.15px rank
is comfortable for an elder. That is a −17% glyph for cinnabar users, and the
`cornerIndexMinPx: 10` it clears is **a value the THEME CLAIMS about itself**,
enforced only as `≥ 10` by a conformance test (`deck-theme.test.ts:56`) and
introduced with the original theme contract (`f674289`). It has never been
validated with a person. "Clears the floor" is therefore weaker than it reads,
and the rank — not the suit — is the binding question, since digits need more
resolution than a suit silhouette.

### Two corrections accepted

- My own linear estimate was wrong twice over, and the owner's was too: ink
  height is not proportional to the ratio. Both are now measured rather than
  reasoned.
- `cornerIndexMinPx` is a theme's CLAIM, not a measurement — recorded here so
  the next reader does not treat it as a validated floor.
