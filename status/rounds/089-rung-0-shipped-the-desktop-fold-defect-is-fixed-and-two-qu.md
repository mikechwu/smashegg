> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Rung 0 shipped: the desktop fold defect is fixed, and two questions answered (2026-07-27)

### What shipped

CSS only, all of it inside `@media (min-width: 720px)`. No card metric, no
column pitch, none of the nine clamp sites touched.

| | before | after |
|---|---|---|
| Play/Pass below fold, inner **1280×800** | 95.8% [79.8, 99.3] | **0/24 = 0.0%** [0.0, 13.8] |
| Play/Pass below fold, inner **1024×768** | 100% [86.2, 100] | **0/24 = 0.0%** [0.0, 13.8] |
| Play/Pass below fold, inner **390×844** (phone control) | 12.5% [4.3, 31.0] | **12.5%** [4.3, 31.0] — unchanged |
| west↔east seat span, ≥720 | 608px at every width | 935 / 1181 / 1334 / 1600px @1024/1280/1440/1920 |
| ring centre track | 250.3px at every width | 495.8 / 675.4px @1280/1920 |

All n=24 deals per viewport, `scripts/measure-fold.mjs`, DOCUMENT coordinates.
Tap-target sweep: PASS, zero victims, 0 stolen seam points. Set-aside gate:
PASS across 390×659 / 390×844 / 1280×800 / 1440×900. Suite 1253 passed,
typecheck clean.

### The phone gate is a proof, not a promise

`tests/unit/client/desktop-mode.test.ts` (9 tests) brace-matches every
`@media (min-width: N)` block and asserts that every declaration rung 0 adds
lives inside one. **A media query cannot apply below its breakpoint by
construction**, so "the phone is unchanged" becomes a decidable property of the
stylesheet text rather than something a reviewer must notice. Two of the nine
tests exist only to stop the scanner going vacuous.

**Verified by injection, not by assertion** (practice 13): leaking the widened
cap out of its media query turns 2 tests red; leaking the seat re-siting turns
1 red; both green again on restore.

### A bug I introduced, and the check that caught it

The ring gained `max-width: min(94vw, 100rem)` with `width: 100%` — and this
project has no global `* { box-sizing: border-box }`, so the ring rendered 24px
WIDER than the `.gd-table` containing it. `.gd-table { overflow-x: hidden }`
then **clipped the east seat at 720, 1024, 1280 and 1440**. Silently: no page
scrollbar, no failing test, and the fold gate still read 0/24. It was found by a
probe that asked whether any seat rect fell outside `.gd-table`'s box — a
question no existing gate asks. Fixed with `box-sizing: border-box`; re-checked
clean at all seven viewports.

### The hand cap is derived, not chosen — and a first attempt was wrong

A first build lifted `.gd-handzone` to the ring's own `min(94vw, 100rem)`. The
screenshot showed why that is wrong: `.gd-actionsRow` is a 1fr/auto/1fr grid and
`.gd-bottombar` a full-width row, so a 1600px zone flings the sort pills and the
seat plate to the screen edges while the fan stays ~640px and centred. **Widening
that box spreads the hand's CHROME, not the hand.**

It is now `min(94vw, 56rem)` = 896px, derived from the structural worst case: 15
value columns at today's 0.70 pitch is `(1 + 14 × 0.7) × 68 = 734.4px`. The old
44rem (704px) was BELOW that — **so a 15-column hand wrapped to two lines even at
2478px**, on 3.4% of deals, which an 8-deal sample misses 76% of the time
(practice 14).

### The two questions the owner asked

**1. What did the trick-well defect actually DO? It WRAPPED — it never clipped.**
Constructed rather than waited for (practice 14): ten card frames injected into
`.gd-well__cards`. At the old 250.3px centre track a 10-card bomb laid out as
**2 rows**, ink 231.2px, with nothing outside the table box and no page
overflow. So the well's own comment — "graceful degradation, not a new failure
mode" — was accurate, and this was a **clarity cost, not an
information-correctness defect**: no card was ever hidden. Under rung 0 the same
ten frames are **1 row**, 312.8px, inside a 495.8px track.

**2. Can the pile strip be reached by a media query? YES — and no JS is needed.**
The owner's instinct was right and the answer is better than hoped. Executed in
headless Chromium at pile depths 2–8: CSS reproduces
`stackOffsetW = min(stripW, spread/(n−1))` exactly, including the deep cases
where the spread binds. **And a division-free form works**, which is the one to
use: the component keeps computing the DEPTH-dependent cap (which has nothing to
do with the viewport) and emits it as a plain number, while CSS owns only the
VIEWPORT-dependent term:

```css
margin-top: calc(var(--gd-cardw) * (min(var(--gd-strip-w), var(--gd-stack-cap)) - var(--gd-stack-aspect)));
```

`min()` is supported from Safari 13.1 / iOS 13.4 / Chrome 79 / Firefox 75, so
there is no fallback cliff. **The measured 12.5% → 79.2% phone-leak risk stops
needing a guard**, because a media query cannot apply below its breakpoint.
Rungs 1–2 are therefore CSS-only, like rung 0 — the "first width-reactive JS in
this client" price is withdrawn.

### Honest remaining gaps

- **With a sort-area shelf open, Play is below the fold on 24/24 deals at
  1024×768, 1280×800 AND 390×844.** Rung 0 does not fix that; on desktop it is
  now the only case that scrolls. Pre-existing on the phone.
- The table is top-anchored, so ~350–600px of vertical void remains at tall
  viewports. Unaddressed by rung 0 and by every proposal.
- The 2 gate scripts repaired this round were both broken in ways that produced
  a confident-looking output: the fold gate compared desktop runs against the
  PHONE's bucket baseline and printed "NEW bucket(s) not previously recorded"
  immediately followed by "every base position falls in a known bucket"; the
  tap-target gate had no 429 retry and died with an opaque `ws error` whose
  actual cause was the room-create limiter. Baselines are now keyed by viewport
  and the verdict says only what was checked.
