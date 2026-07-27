# Reachability — what replaces the phone fold metric

**Date: 2026-07-27.** Status: the instrument is built and the base case is measured. **The definition
is not settled and is put to the owner below (§6).** Supersedes the phone half of the fold metric;
the desktop half of G-FOLD stands.

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
