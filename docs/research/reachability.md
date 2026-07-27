# Reachability — what replaces the phone fold metric

**Date: 2026-07-27.** Supersedes the phone half of the fold metric; the desktop half of G-FOLD stands.

**Status: D1 RULED (§8); the span is derived (§9); §9's RATES ARE WITHDRAWN and corrected in §10.**

> **READ §10 FIRST.** Sections 9.2–9.4 contain numbers that later measurement
> refuted: the 13.14% rate, the whole modelled distribution table, the desktop rows,
> and the claim that "the 20.3px cannot be found in spacing". They are kept, struck,
> for provenance — decisions were taken against them — but none of them should be
> quoted. Sections 1–7 are round 1 and
are kept as written. **Read §8 before quoting any number from §4 or §5: the round-1 figures were
measured with no cards staged, which is not the state a player decides in, and the corrected staged
figures change the verdict at 390×664 from +55.0px of slack to −20.3px.**

## 1. Why the old metric died, in one paragraph

The fold gate asked *"on what fraction of deals is Play/Pass below the fold at scrollY=0?"* and read
~8.3% (n=48). It was measured at inner **390×844**, which is a phone **screen** size — a browser with
its toolbars presents ~664, ~748 minimized. At both real heights the rate is **100% at every pile
depth**, because the fan alone needs more than the budget: at 664 the layout admits `fanH ≤ 127.8`
against a structurally smallest-possible fan of **209.5px** (`d₁+d₂ = 4`; the 252.1px figure first
recorded here was a sampled minimum, corrected 2026-07-27 — see §9 and W5c). `ScrollActionsIntoView` has absorbed that 100% all along. A metric that scores every
candidate layout at 100% ranks nothing, so it cannot gate.

**What it was protecting was never "no scrolling".** The auto-scroll guarantees the control is
*reached*. It guarantees nothing about what leaves the screen to make room. That is the property with
a gradient left in it, and it is what the replacement measures.

## 2. The definition question, and why it went to a panel

"What must the player see?" is a design choice, not a measurement, and it decides the verdict almost
entirely (§4). Two external lineages were each given the code, the situation and the question — and
**never the in-house answer** (METHODOLOGY practice 6). Briefs and full reports:
`proposals/reachable-brief.md`, `proposals/reachable-A-codex.md`, `proposals/reachable-B-grok.md`.

Where they landed:

| fact | selector | in-house | Codex | Grok |
|---|---|---|---|---|
| trick well | `.gd-well` | critical | tier 1 | tier 1 |
| play desk | `.gd-desk` | **missing** | tier 0 | tier 1 |
| hand fan | `.gd-fan` | critical | tier 1 | tier 2 |
| Play / Pass | `.gd-actionsRow__bar` | critical | tier 0 | tier 1 |
| team level badges | `.gd-headline` | critical | **tier 2** | **excluded** |
| opponents' card counts | `.gd-seatcount` | critical | **excluded** | **excluded** |

Three material disagreements, all in the same direction: **the in-house set was too greedy at the top
of the column and had a hole in the middle.**

- **The hole.** Neither the staged cards nor "does this beat the table" appeared in the in-house set at
  all. Both lineages put the desk at their top tier: it is where a selection becomes a legal reading.
- **The over-inclusions.** Grok's argument is the one that generalises: `.gd-headline` sits at the very
  top of the column, so a must-see set containing it drags the required span back to *everything above
  the fold* and **silently rebuilds the metric being replaced**. Its counter to "the level rank is the
  wild" is that the level is constant for a whole hand and the wild carries its own seal on the card.
  Seat counts were excluded by both as match-scale rather than turn-local.

This is METHODOLOGY practice 28: the instrument now computes **all three definitions from one run**
and prints them side by side, rather than picking one.

## 3. The instrument

`scripts/simultaneity.mjs` (probe + report) and `scripts/measure-simultaneity.mjs` (driver).

**Structural first (practice 14).** Whether *any* scroll offset shows the whole decision is not
sampled and not scroll-dependent:

```
span  = max(document bottom of any must-see fact) − min(document top of any must-see fact)
slack = innerH − span          negative slack ⇒ NO offset exists, at any scroll position
```

Sampling then answers only *how often* and *by how much*, which is what a sample can answer. Grok
derived the same test independently, which is the strongest evidence available that it is the right
shape.

**Three readings per run**, because they are different claims: the structural verdict; what is
actually visible at the **settled** scroll (what the player experiences); and the paired
scrollY=0-vs-settled **trade**, which is the owner's property 4 in its literal wording — *nothing else
the player must see scrolls out as Play scrolls in*.

**Practice compliance built in, not remembered.** `SIM_W`/`SIM_H` are required with no default (26);
inner dimensions and the chrome assumption are printed (15); a floor property reports worst case and
violation rate with a Wilson interval, never a median (16); the run refuses to conclude below
`SIM_MIN_DEALS` (12); the scope is printed and every critical selector must match a rendered element
(24); the power statement is **derived from n** rather than asserted (25); the compensating auto-scroll
is the subject rather than an error, and `scrollY` is recorded alongside every reading (11).

**One distinction the probe makes on purpose:** a selector that matches *nothing* is an error, while a
selector matching a box rendered at 0×0 is a legitimate empty state. The trick well has no
`min-height`, so on a deal where the viewer **leads** it renders at 0×0 — nothing to beat, nothing to
clip. Those are reported as a rate (`trick 4/24`) rather than silently dropped.

## 4. Measurements

lacquer, zh-Hant, deal the only varied axis, INNER dimensions with browser chrome excluded.
Figures are **worst case over the sample**, in px of slack; negative = infeasible at any scroll.

### Base layout, no shelf

| inner | in-house | panel | minimal | n |
|---|---|---|---|---|
| **390×664** (toolbars) | **−113.2px**, infeasible 87.5% [69.0, 95.7] | **+55.0px**, 0% [0, 13.8] | +513.5px, 0% | 24 |
| **390×748** (minimized) | **−50.5px**, infeasible 33.3% [18.0, 53.3] | **+117.7px**, 0% | +597.5px, 0% | 24 |
| **1366×681** (maximized 1366×768 laptop) | **+26.3px**, 0% [0, 19.4] | +179.1px, 0% | +530.5px, 0% | 16 |
| **1440×813** (maximized 1440×900) | +158.3px, 0% | +311.1px, 0% | +662.5px, 0% | 16 |
| 1280×800 | +145.3px, 0% | +298.1px, 0% | +649.5px, 0% | 16 |

### With one set-aside shelf open, 390×664

| profile | worst slack | infeasible | not all visible at settled scroll |
|---|---|---|---|
| in-house | −250.7px | 100% [86.2, 100] | 100% |
| **panel** | **−82.5px** | **58.3% [38.8, 75.5]** | **70.8%** |
| minimal | +513.5px | 0% | 0% |

### Property 4 literally, 390×664, 24 paired deals

- **Gained** by the auto-scroll: `actions` 24/24, `desk` 24/24, `hand` 4/24.
- **Lost**: `levels` 24/24, `counts` 12/24.
- Traded away a fact the profile requires: in-house **100%**, panel **0%**, minimal **0%**.

## 5. What the numbers say

**(a) The base layout is FINE, under the definition both external lineages converged on.** This
reverses the reading an early 3-deal in-house run suggested. At 390×664 the panel set fits with
**55px to spare on the worst of 24 deals**, and nothing it requires is traded away by the auto-scroll.
The owner's [VERIFY FIRST] concern — that the ring and well are cut off in the base layout — is
**not** what happens: the well and desk are pulled *into* view by the scroll. What leaves is the
headline (100%) and some seat counts (50%), which is exactly the pair both lineages had already
excluded. So under the in-house set the base fails 87.5%; under the panel set it passes cleanly.

**(b) The SHELF is the real casualty, and this is where the metric earns its place.** One open
set-aside shelf costs ~137px of span, against 55px of slack — so at 390×664 the shelf state is
infeasible on **58.3%** of deals under the panel definition, and 70.8% of deals cannot show the
decision at the settled scroll. The fold metric could not see this: it scored base and shelf alike at
100%.

**(c) Rung 0 survives the corrected yardstick.** At **1366×681** — a maximized window on a 1366×768
laptop, the realistic floor the owner named, and *worse* than the 1024×768 rung 0 was validated at —
the layout passes under **every** definition including the strictest, 0/16. The desktop conclusion was
carried as "likely survives"; it is now measured. **Flagging the margin honestly:** +26.3px under the
in-house set is thin, it is a worst-observed value over n=16 and **not a structural minimum**, and a
thin margin against a rare hand is the shape that fails in the field (practice 14's corollary).

**(d) Height dominates, and the phone's two states are genuinely different products.** 664 vs 748 —
84px of browser chrome the user controls by scrolling — moves the in-house infeasible rate from 87.5%
to 33.3%. Any phone claim that does not name which of the two it means is under-specified.

## 6. The decision, put to the owner

**D1 — which must-see set is G-SIM gated on?** The gate currently fails only on `minimal`, because
that is the reading nobody can dispute; the other two are printed. The live question is whether the
**panel** set is adopted, which means accepting that a player may make a decision without the team
level badges on screen. Both external lineages say yes, on the grounds that the level is constant for
a hand and the wild carries its own seal. The in-house instinct was no. This is a design ruling and
it is not mine to make — it changes the base layout's verdict from *passes with 55px* to *fails 87.5%*.

**D2 — the collapsed indicator height, retaken (practice 27).** *"Collapsed-44 is free"* was derived
from the void metric and is withdrawn. Under the replacement the 24→44px cost is **exactly +20px of
span, structurally, not sampled** — the indicator sits inside the span, so it adds its own height.
Against the base layout's 55px of panel-profile slack at 664, 44px still fits (35px left). Against the
**shelf** state, which is already −82.5px, it makes a failing state worse. So: **44px is affordable in
the base layout and unaffordable with a shelf open**, and the honest form of the decision is that it
depends on the shelf work, not on the indicator.

**D3 — overlay vs collapsed** is now genuinely comparable, as the owner observed: both subtract from
the same budget. **One qualification from the panel, which I did not have before:** they share a
currency only while the overlay leaves Play/Pass live underneath. An overlay that *suspends* the turn
is a different interaction state and this metric does not rank it — it would need the occlusion
instrument instead.

## 7. What this does not catch

Headless geometry cannot settle: whether the player *notices* the view moved; whether a scroll under a
finger is disorienting; whether an elder can read a badge at a given size; whether remembering a
just-seen trick is acceptable; tap accuracy and motor comfort; real browser chrome behaviour as
toolbars collapse on scroll (the 664↔748 transition is itself an unmeasured moving-target hazard).
Both lineages independently listed the same class. **These are exactly the elder-session items**, and
the session has therefore moved from blocking one decision to blocking three of the four replacement
properties.

It also does not catch horizontal problems (containment does, and rides along on every run), nor
anything about whether the visible facts are *correct*.

---

## 8. Round 2 (2026-07-27, later) — the staged state, the derivation, and the D1 ruling

### 8.1 The un-staged measurement was the wrong state, and it flattered the layout

Every figure in §4 was taken with **no cards staged**. But a player stages, then decides — so the
un-staged state is one they pass *through*, and the decision moment is the one after. Staging opens
`.gd-desk__stage`, a card row worth **+54.0px** of desk height, and the span is additive in desk
height, so the whole 54px lands on the budget.

It **saturates at the first card**: the stage is a flex row with no wrap, capped at
`DESK_STAGE_MAX_FACES = 10` (`helpers.ts:898`) and then a `+N` pill. Measured 0..12 staged cards, the
desk reaches 148.5px at k=1 and never moves again. So one card is the worst case, not a sample of it.

Re-measured with one card staged (lacquer, no shelf, worst over the sample):

| inner | in-house | **panel** | minimal | n |
|---|---|---|---|---|
| 390×664 | −188.5px (100%) | **−20.3px, infeasible 4.2% [0.7, 20.2]; 12.5% not all visible at settle** | +459.5px (0%) | 24 |
| 390×748 | −83.2px (100%) | **+85.0px (0%)** | +543.5px (0%) | 24 |
| 1366×681 | −81.4px (81.3%) | **+71.4px (0%)** | +451.4px (0%) | 16 |

**Correction to §5(a) and §5(c).** The base layout does **not** clear the panel bar at 390×664 in the
decision state: the +55.0px of slack reported there was un-staged, and staged it is **−20.3px**. And
§5(c)'s "rung 0 passes under *every* definition at 1366×681" is narrowed: it passes under the panel
set (+71.4px) but fails the in-house set on 81.3% of deals once staging is included.

### 8.2 The span is derived, not sampled (`scripts/derive-span.mjs`)

    span = fanHeight + deskHeight + K       K = 198.5px (well renders) | 66.0px (viewer leads)

Each K constant to **0.1px across 78 measured states** (6–24 deals × 0–12 staged cards). The 132.5px
difference is the trick well: `.gd-well` has no `min-height`, so on a lead it renders 0×0, drops out
of the profile, and the span's top jumps from the well down to the fan. The bound uses the larger.

So **the span's bound reduces to the bounds of its two variable terms**:
- `deskHeight ≤ 148.5px` — **structural**, per the saturation above;
- `fanHeight` — **not yet bounded**. Observed 230.8..316px, and every observed value lies on the known
  21.3px lattice (230.8 + 21.3·j, j = 0..4). Bounding it is what would convert every worst case here
  from sampled to proved, and it is the single remaining piece.

The first version of this script reported "NOT ADDITIVE: K moves over 0.1px" — a verdict its own
number refuted, because the check demanded exact equality of independently-rounded terms. Fixed with a
stated 1px tolerance; a threshold that calls 0.1px a structural term is an instrument defect.

### 8.3 The level chip fits for free — which is what makes the D1 fix work

The owner's D1 ruling adopts the panel set for the metric but treats the level's absence as a design
defect with a named fix: put a level indicator **inside `.gd-desk`**, which the panel set already
requires visible. Measured before building, at inner 390×664:

- The title row is **27px tall, set by the TITLE, not the clock** (the clock is 24px). So any chip
  ≤27px tall adds **zero** height — confirmed by injecting three candidates (`--fs-sm`/`--fs-md`,
  with and without a suit glyph, 34.5–51.8px wide × 20.2–21.6px tall): desk height unchanged, **0px**,
  in two different desk states (43px and 94.5px).
- Horizontally, with the **longest** own-turn title in the default locale (`請快出牌 · 還剩 30 秒`,
  180.6px) and a clock present, **84.4px** of free space remains.

**So a level chip up to ~84px × 27px costs zero span.** Both properties, no trade — as the ruling
predicted.

**One limitation, stated rather than buried.** The clock was **injected** with its real class, not
rendered naturally: a driven room never presented one at the probe moment. Diagnosed — in the timed
run seat 0's turn was the forced-pass window, where `GameTable.tsx:1166` deliberately suppresses the
clock (`forcedPassWindow ? null : dueSeconds`). The layout measurement is real; the assumption that a
server-rendered clock renders identically is an assumption.

### 8.4 The 664↔748 toolbar transition: the moving-target hazard does NOT materialise

Promoted from §7 at the owner's instruction. iOS Safari collapses its toolbar on scroll, and the
auto-scroll *is* a scroll — so the feared sequence is turn → auto-scroll → toolbar collapses →
viewport grows 84px → layout reflows → targets move, which practice 20 forbids.

**What headless can and cannot settle**, stated up front: it *cannot* decide whether Safari collapses
on a **programmatic** `scrollIntoView` — Chromium has no such toolbar, and that is a real-device
question. It *can* decide everything downstream, because that is the page's behaviour, not Safari's.

Measured over 6 deals, transitioning 664→748 and back:

- **Largest press-target movement: 0.0px.** Action bar, both buttons, first/middle/last hand card,
  well and desk — none moved, in viewport coordinates.
- **Round-trip residual: 0.0px.** `scrollY` identical before, during and after (176/176/176, …).
- **No oscillation.** `ScrollActionsIntoView`'s deps are `[loud, stagedCount, targetRef]`; a resize
  touches none of them, so the auto-scroll cannot re-fire and drive a feedback loop.

The reason is the property verified last round: the layout is **height-independent** (the 536.2px
offset held across nine heights). Growing the viewport reveals more below without moving anything.
This also disposes of the iOS `100vh` subtlety — on iOS Safari `100vh` is the large viewport and does
not shrink on collapse, but since nothing in the layout depends on viewport height, neither behaviour
matters.

**So the hazard splits in two, and only one half survives:**
- *Moving target* — **refuted**, 0px worst case, conditional on the trigger being real (practice 17:
  a refutation carries its conditions).
- *Simultaneity cost* — **confirmed and large**: 84px between the two states, against a panel slack of
  −20.3px at 664. The owner's sharpest case stands: a player who scrolls up to check the level
  re-expands the toolbar, shrinking the viewport to 664 and losing 84px, so consulting an excluded
  fact makes the remaining must-see facts *less* likely to fit. Relocating the level into the desk
  (§8.3) removes that pathway entirely.

### 8.5 Ranking the shelf options needs BOTH instruments — stated before comparing

The panel's qualification is load-bearing and the owner's point sharpens it: **an overlay is
absolutely positioned, so it does not add to the span at all — it OCCLUDES.** Simultaneity measures
document extent; it is structurally blind to a surface painted over the top. So:

- a **collapsed inline strip** costs span, and G-SIM sees all of it;
- an **overlay** costs zero span and an amount of occlusion G-SIM cannot see;
- ranking them on span alone would declare the overlay free, which is exactly the error of measuring
  one option with an instrument that only sees the other's cost.

**The composition rule: an option is ranked only when both instruments have run against it** — the
simultaneity span *and* the occlusion probe — and the overlay is comparable at all only while it
leaves Play/Pass live underneath. An overlay that suspends the turn is a different interaction state
and neither instrument ranks it.

**And the arithmetic rhymes.** The shelf costs ~137px against 55px of un-staged slack — an **82px**
deficit, against the **81.9px** fold deficit the original phone-shelf arc was chasing. Same quantity,
same source (the shelf's vertical footprint), new currency. The currency change did not shrink the
problem; it made it measurable.

### 8.6 D2 and D3, restated on the corrected numbers

**D2 — collapsed indicator height.** The 24→44px change costs **exactly +20px of span**, structurally
(the indicator sits inside the span; the span is additive). Last round this was priced against +55px
of slack and called affordable in the base layout. **On the staged numbers it is not: the panel slack
at 390×664 is −20.3px before the indicator exists.** There is no 20px to spend at that height; there
is at 748 (+85.0px) and on desktop (+71.4px). So the honest form is that 44px is affordable everywhere
*except* the tighter phone state, which is the one that matters most.

**D3 — overlay vs collapsed** cannot be ruled until §8.5's composition has run. What is now settled is
the *rule* for ranking them, not the ranking.

---

## 9. Round 3 (2026-07-27, later still) — every term of the span is now proved

### 9.1 fanHeight's structural bound — the last sampled term, closed

`scripts/derive-fan-bound.mjs`. Measured at inner 390 wide, lacquer:

    fanHeight = 13.9 + lineHeight(d₁) + 6 + lineHeight(d₂),   lineHeight(d) = 73.5 + 21.3(d−1)

additive to 0.2px across 8 deals. The pieces, each proved rather than assumed:

- **Lines are exactly 2.** A line holds `floor(rowContentWidth / pitch) = floor(326.8 / 35.5) = 9`
  columns, and there are ≤15 value classes, so 15 columns need 2 lines and never 3. **Every hand
  measured renders on two lines** — the earlier probe reported "1 row" for all of them because it
  counted `.gd-fan__stackRow` ELEMENTS, and the settled fan is a single element with `flex-wrap:
  wrap` that wraps internally. Lines are now counted by distinct stack BOTTOMS.
- **The 21.3px step is `stackOffsetW(n, 0.42) × cardW = 0.42 × 50.7`**, and it holds for every depth
  up to 8 because the 2.95w spread budget only binds from 9 copies (`HandFan.tsx:180`), which two
  decks cannot reach.
- **The maximiser is 10 columns with depth 8 on each line** (8 + 8 + 8 singletons = 24 ≤ 27 cards).
  Since `fanH` depends only on `d₁ + d₂`, *fewer* columns is worse — every extra column spends a card
  that could have gone into a pile. Two lines need ≥10 columns; at 10 the depth cap binds, not the
  card budget.

**fanHeight ≤ 465.1px** — against an observed maximum of 294.7px over the 8 measured deals, i.e. the
structural case is **170.4px** taller than anything the sample reached.

### 9.2 …and its frequency, because a bound without one is not a decision input

`scripts/fan-height-distribution.mjs`, 200,000 simulated deals. No browser and no engine import:
`fanHeight` depends on the hand only through per-class card counts, and the deal is a uniform 27-card
subset of the 108-card shoe (12 non-level ranks × 8, level class × 8, SJ × 2, BJ × 2 = 15 classes).
Each deal is scored at its **taller sort ordering**, since the player controls that.

> **THIS TABLE IS WITHDRAWN** (see §10.1). Every share below is the max-over-sort-orderings
> figure, which is right for a bound and wrong for a rate; the measured shares are in §10.3.

| fanHeight | share | P(≥) |
|---|---|---|
| 252.1px | 16.97% | 99.27% |
| 273.4px | 38.68% | 82.30% |
| 294.7px | 30.48% | 43.62% |
| 316.0px | 10.65% | 13.14% |
| 337.3px | 2.21% | 2.50% |
| 358.6px | 0.27% | 0.29% |
| 379.9px | 0.02% | 0.02% |
| 401.2px | 0.003% | 0.003% |

The structural 465.1px case is **63.9px above anything 200,000 deals produced**, so it arrives less
often than 1 in 200,000. The analytic model and the browser measurement agree: it predicts 2.50%
infeasible at 390×664 untimed, against 4.2% [0.7, 20.2] measured at n=24.

### 9.3 The rate splits by population — and by an axis nobody had varied

**Leading vs following.** K is 198.6px when the trick well renders and 66.0px when the viewer leads
and it is empty, so **a leading turn carries 132.5px more slack and essentially never fails**. A
pooled rate averages a population that cannot fail with the one that can.

**Room timing — never varied by any gate in this repo.** Every driver creates an UNTIMED room while
the product default is `TIMING_PRESETS.standard` (45s/90s). A timed room renders the desk's countdown
bar: **+8.0px of desk** (deskHeight ≤ **156.5px**, not 148.5px). That 8px moves the threshold across
a lattice step.

> **THIS TABLE IS WITHDRAWN** (see §10.1) and is kept only for provenance. Its rates are the
> max-over-sort-orderings ones; its desktop row uses 390-width geometry; and its
> `structural worst slack` column is deleted outright — the 465.1px case it reported needs two
> value classes at all 8 copies in one 27-card hand, **1 in 5.0 billion**, and sitting beside
> the rates it anchored the remedy sizing twice. Corrected figures: §10.2 and §10.3.

| inner | FOLLOWING, timed (default) | FOLLOWING, untimed | LEADING |
|---|---|---|---|
| **390×664** | ~~13.14%~~ → **measured 9.17% [5.2%, 15.7%]** | 2.50% (1 in 40) | 0% |
| 390×748 | <0.01% (1 in 33,333) | <0.01% | 0% |
| 1366×681 | withdrawn (390-width geometry) | withdrawn | 0% |

### 9.4 There is no cheap 20px

K's 66.0px residual decomposes as **10px** (fan→desk) + **15px** (desk→actions) + **41px** (the action
bar itself, which is content). And the 132.5px well difference is **73.5px** of well plus a **59px**
band — but that band is **not empty**: the west/east seat plates and stacks reach document 367.7
against a fan top of 375.7, so only ~**8px** of it is free.

**Total pure recoverable spacing in the entire span is ~33px**, and taking all of it would collapse
Play/Pass onto the desk and the fan onto the ring. The 20.3px cannot be found in spacing; closing the
gap needs a different arrangement or less content.

### 9.5 The level chip's limitation is closed

The clock is now measured **as the server renders it**, not injected. Driving to a turn with a
non-pass hint available (the forced-pass window is where `GameTable.tsx:1166` suppresses the clock)
gives a real `.gd-desk__clock` at **36 × 24px — identical to the injected element**. With the longest
own-turn title, free horizontal space is **84.4px**, exactly the injected-clock figure, and all three
candidate chips still grow the desk by **0px**. The assumption is now a measurement.

### 9.6 Corrections to earlier sections

- **§8.5's 82px shelf deficit is stale.** It compared ~137px of shelf against 55px of *un-staged*
  slack. Against the staged, timed follow-state figures the deficit is larger; the "same quantity,
  new currency" observation stands but the number should not be quoted at 82px.
- **§8.1's 1366×681 note** used the untimed desk. The timed follow-state rate there is 2.50%.

---

## 10. Round 4 (2026-07-27, W9–W15) — what §9 got wrong

### 10.1 WITHDRAWN from §9

| withdrawn | why | replacement |
|---|---|---|
| **13.14%** infeasible at 390×664 | the model scored each deal at the **taller of its two sort orderings** — right for a bound, wrong for a rate | **measured 9.17% [5.2%, 15.7%]**, n=120 |
| §9.2's whole distribution table | same cause: every bin share is the max-over-orderings one | measured shares in §10.3 |
| the **desktop rows** of §9.3 | computed with 390-width geometry (card 73.5, step 21.3, capacity 9) applied to 1366×681, where capacity is actually **18** | withdrawn pending re-measurement |
| the **`structural worst slack`** column | anchored remedy sizing twice; the 465.1px case needs two value classes at all 8 copies in one 27-card hand — **1 in 5.0 billion** (2.0×10⁻¹⁰), not the "<1 in 200,000" the simulation could bound | deleted; use the marginal bin |
| **"the 20.3px cannot be found in spacing"** (§9.4) | 20.3px was the deficit of the WORST OBSERVED hand at n=24 — a rare event. The deficit that carries the failure mass is **7.1px** | §10.2 |

### 10.2 The failure is one lattice bin, and it is 7.1px deep

With deskH = 156.5 (timed, staged) and K = 198.6 (following), `slack = 308.9 − fanH`:

| bin | slack | share of deals | failures observed |
|---|---|---|---|
| 294.7 | **+14.2** | 20.0% | feasible |
| **316.0** | **−7.1** | 8.3% | **10 of 11** |
| 337.3 | −28.4 | 0.8% | 1 of 11 |

Verified against the raw log: all 11 infeasible deals are exactly the deals at fanH
316.0 (ten, slack −7) and 337.3 (one, slack −28.3). So **7.1px removes 91% of the
failure mass and 28.4px removes all of it** — against §9.4's framing, which priced the
remedy against a 1-in-120 hand. That was the same bound-versus-rate error the model
made, applied to the remedy side.

### 10.3 The remedy, priced against the marginal bin

**The lattice makes intermediate recovery worthless.** Between step boundaries extra
pixels buy nothing: 25px of spacing scores exactly what 8px scores, because the next
bin is not reached until 337.3.

| recovery | threshold | infeasible (model) | margin to the nearest bin |
|---|---|---|---|
| none | 308.9 | 7.74% | — |
| seat-plate band, ~8px | 316.9 | **1.35%** | **0.9px** |
| fan→desk 10px + desk→actions 15px | 333.9 | 1.35% | 17.9px, but collapses Play/Pass onto the desk |
| both, 33px | 341.9 | 0.16% | 4.6px |
| **card scale to the 2.75rem floor (cardW 44)** | **318.6** | **0.01%** | **4.8px** |

**Card scale is the only lever with margin that does not remove anything.** `fanH` is
linear in `cardW` with coefficient `2·aspect + 0.42·(d₁+d₂−2)` — 4.58 px/px at the
252.1 bin, 5.84 at 316.0 — so the 6.7px of travel to the floor saves **30.7px** and
**39.1px** respectively. It also shrinks the desk's staged card row (threshold
+9.7px) and raises per-line capacity from 9 to **10**, which changes the distribution
rather than just shifting it. **cardW 47 — a 7.3% reduction — already reaches 0.16%**,
beating the full 33px of spacing recovery.

**The 8px band alone is not enough**, despite removing 91% of failures: 0.9px of
margin is less than ordinary text-metric variation, and an en-locale title that wraps
costs 27px outright.

### 10.4 Sort order is a population, not a parameter

The product default is **ascending** (`readHandSortDescending` returns true only when
localStorage holds `'desc'` — `GameTable.tsx:201`), and the driver rendered that. The
axis registry recorded `descending`, and **every driver copied the error**, so each
one matched the wrong default and the justification rule never fired. A registry with
a wrong default silently excuses every driver that shares it.

Modelled: ascending **7.65%**, descending **9.28%**. The withdrawn 13.14% is not
meaningless once corrected — it is P(at least one ordering fails), i.e. the share of
deals where the player's sort choice *decides* feasibility. That is **~5.5% of deals**, and whether the toggle is a
discoverable recovery affordance or an accident is a design question, not a
measurement.

### 10.5 Corrections to the round-3 wording

"7.65% is consistent with the measured 9.17%" rested on an interval, [5.2%, 15.7%],
wide enough to also accept the 13.14% that was rejected. **The defensible claim is the
distribution match, not the rate match** — and the distribution match is on the
discovery sample, so it is a fit, not a validation. A held-out test is required before
the single-ordering model is treated as confirmed.

The residual after any remedy must be reported as a bound: at n=120, 1 failure has a
95% upper bound near **4.6%**, so "0.83%" is not a resolved number.
