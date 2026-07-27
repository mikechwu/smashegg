# Reachability — what replaces the phone fold metric

**Date: 2026-07-27.** Supersedes the phone half of the fold metric; the desktop half of G-FOLD stands.

**Status: D1 is RULED — G-SIM is stated against the `panel` set (§8).** Sections 1–7 are round 1 and
are kept as written. **Read §8 before quoting any number from §4 or §5: the round-1 figures were
measured with no cards staged, which is not the state a player decides in, and the corrected staged
figures change the verdict at 390×664 from +55.0px of slack to −20.3px.**

## 1. Why the old metric died, in one paragraph

The fold gate asked *"on what fraction of deals is Play/Pass below the fold at scrollY=0?"* and read
~8.3% (n=48). It was measured at inner **390×844**, which is a phone **screen** size — a browser with
its toolbars presents ~664, ~748 minimized. At both real heights the rate is **100% at every pile
depth**, because the fan alone needs more than the budget: at 664 the layout admits `fanH ≤ 127.8`
against a smallest-possible fan of 252.1px, so deleting the fan's entire second line still leaves it
2.3px short. `ScrollActionsIntoView` has absorbed that 100% all along. A metric that scores every
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
