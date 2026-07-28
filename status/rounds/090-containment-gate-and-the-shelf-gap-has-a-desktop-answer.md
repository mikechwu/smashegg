> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Containment gate, and the shelf gap has a desktop answer (2026-07-27)

### The containment gate — the round's most valuable artifact, generalized

`scripts/containment.mjs`, riding along inside `measure-fold.mjs` (same
expensive setup; a check nobody runs is not a gate). It asserts that every
element a player must see renders inside `.gd-table` AND inside the viewport.

**Why it is general rather than a fix for one bug.** Rung 0 clipped a whole
player off-screen at four viewports with no scrollbar, no failing test, and the
fold gate reading 0/24. What suppressed every signal was
**`overflow-x: hidden` — the declaration whose job is to prevent horizontal
overflow is exactly what turned a visible layout bug into a symptomless one.**
Same family as ScrollActionsIntoView masking the fold (practice 11), worse in
consequence. Every existing gate measures a defect that already happened —
Play's vertical position, card occlusion, the set-aside control's presence — so
all of them were structurally blind to this class.

**Non-vacuity proven, not asserted.** The gate refuses to pass if it examined
fewer than 10 boxes. And the actual bug was REPLAYED: deleting the
`box-sizing: border-box` line turns it red, naming `.gd-ring__seat--east`,
`.gd-seatstack`, `.gd-seatcount`, `.gd-plate` and the ring itself, and printing
the masking mechanism on every line (*"container overflow-x is 'hidden', which
is what HIDES this"*). **Exit code 1 on the mutant, 0 restored.** 807 element
boxes examined in a 6-deal run.

### The shelf gap has a desktop answer, and it costs zero vertical

The sort-areas study refuted side-by-side areas on measurement: a 50.7px column
against 7.4px of slack. **That refutation was correct at 390px and does not
transfer** — a proposal refuted by one viewport's arithmetic is not refuted at
another's. Re-measured against desktop numbers, n=12 deals, shelf sizes 3 / 5 /
10 (the varied axis is the one that decides the fit — practice 12):

| inner 1280×800 | fan height | Play doc | below fold |
|---|---|---|---|
| no shelf | 198.3 | 693.2 | 0/12 = 0.0% [0.0, 24.2] |
| **shelf as a BAND (today)** | 360.9 | 855.8 | **12/12 = 100%** [75.8, 100] |
| **shelf SIDE BY SIDE** | **198.3** | **693.2** | **0/12 = 0.0%** [0.0, 24.2] |

**Side by side makes a shelf cost exactly zero vertical** — fan height and Play's
document position are identical to having no shelf at all — and closes the
1280×800 shelf gap outright, at every shelf size measured.

**The honest cost, reported by maximum and violation rate rather than median
(practice 16).** Side-by-side ink runs 826.5px median but **906.1px maximum with
a 10-card shelf, against an 896px hand zone** — so it overflows, and 3 card
boxes fell outside the zone across the sweep. At 1280×800 that costs
**1/12 = 8.3% [1.5, 35.4]** below fold on the 10-card case, because an overflow
wraps and the vertical cost comes back. A wider hand cap at the widths where
side-by-side applies would close it; that is a decision, not a fix I have made.

**The phone is explicitly NOT changed, and the measurement says so rather than
implying it.** At 390×844 side-by-side reads identical to banded at every shelf
size (fan 389.6 both, 100% below fold both), because the rule is
`@media (min-width: 720px)`. **The phone's shelf gap is not closed by this.**

**A correction to my own previous statement.** I wrote that with a shelf open
Play is below the fold "at every viewport measured". That was true of the three
the fold gate ran at — 1024×768, 1280×800, 390×844 — but 1440 was not among
them, and at 1440 and 1920 a banded shelf is already **0/12**. The shelf gap is
a ≤1280-width and phone problem, not a universal one.

### The 1400 threshold — practice 15 applied to our own number

The owner asked whether inner 1440 actually admits a 1440-wide laptop, since a
classic scrollbar subtracts from the CSS viewport.

- **VERIFIED (Chromium):** with `scrollbar-gutter: stable` reserving 15px,
  `documentElement.clientWidth` drops to 1425 but `(min-width: 1440px)` still
  MATCHES — so in Chromium the media query is evaluated against a width that
  includes the gutter.
- **UNCERTAIN, with a stated reason:** whether a real classic scrollbar on
  Windows/Linux Chrome or on Firefox subtracts from the media-query width could
  **not be reproduced in this harness** — headless Chromium renders overlay
  scrollbars even with `--disable-features=OverlayScrollbar`. So the owner's
  concern is neither confirmed nor refuted.
- **The response is structural rather than an answer.** Pick a threshold where
  the question cannot matter: at **1400**, a 1440-wide window clears it with
  any scrollbar width (1440 → 1423 at 17px, still ≥1400). Measured, n=24:
  inner **1400×900 behaves identically to 1440×900** at every variant, including
  rung 2's 44px press target at 0/24 = 0.0% [0.0, 13.8]. **Moving the breakpoint
  to 1400 costs nothing and removes a question we cannot close.**

### The fold gate was faulty — what rested on it

Reviewed, as standard practice when an instrument is found broken. **Both
defects were in the regression-check baseline and the verdict wording; neither
touched the RATE arithmetic**, which is what every conclusion actually rested
on. And the bucket baseline could only misfire at a viewport whose true buckets
differ from the 390×844 set: **every fold-gate run before this round used a
390-wide viewport** (390×844 / 659 / 745 / 600 / 400), where that baseline was
correct. So no earlier conclusion is affected, and the ~8% phone acceptance
stands — re-measured post-repair at 12.5% [4.3, 31.0], n=24, no regression.

### Two pre-existing defects, recorded as such

- **The 44rem hand cap (704px) was below the 15-column ink (734.4px)**, so a
  15-column hand wrapped to two lines at EVERY width including 2478px, for the
  project's whole life. Fixed in rung 0, and now pinned by DERIVATION rather
  than by literal: `desktop-mode.test.ts` re-derives the ink from the
  stylesheet's own clamp ceiling and stack pitch and asserts the cap clears it,
  so it also breaks if either input moves.
- **The trick well only ever WRAPPED, never clipped.** The information-correctness
  worry was wrong in the favourable direction. Verified by constructing ten
  frames rather than waiting for a rare bomb. A clarity cost, now resolved by
  rung 0 (one row instead of two).
