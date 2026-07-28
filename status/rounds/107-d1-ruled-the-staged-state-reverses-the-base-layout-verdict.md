> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## D1 ruled; the staged state reverses the base-layout verdict; prose-tests swept (2026-07-27)

### 1. [CATCH accepted] The un-staged measurement was the wrong state

Every simultaneity figure last round was taken with NO cards staged. A player
stages, then decides — so un-staged is a state they pass THROUGH, and the
decision moment is the one after. Staging opens `.gd-desk__stage`, worth
**+54.0px** of desk, and it **saturates at the FIRST card** (a non-wrapping flex
row capped at `DESK_STAGE_MAX_FACES = 10`, verified 0..12). One card is the worst
case, not a sample of it.

Worst-case panel slack, re-measured staged:

| inner | round 1 (un-staged) | **staged (the decision state)** |
|---|---|---|
| 390x664 | +55.0px, 0% infeasible | **-20.3px, 4.2% [0.7, 20.2]; 12.5% not all visible at settle** |
| 390x748 | +117.7px | **+85.0px, 0%** |
| 1366x681 | +179.1px | **+71.4px, 0%** |

**So the base layout does NOT clear the panel bar at 390x664.** And last round's
"rung 0 passes under EVERY definition at 1366x681" is narrowed: it passes under
the panel set (+71.4px) and fails the in-house set on 81.3% of deals once staging
is included. Both corrections are mine, not the owner's catch — but they are the
same class as the catch, found by taking it seriously.

### 2. The span is DERIVED, not sampled (owner item 3)

`scripts/derive-span.mjs`:

    span = fanHeight + deskHeight + K     K = 198.5px (well renders) | 66.0px (viewer leads)

Each K constant to **0.1px across 78 measured states**. The 132.5px difference is
the trick well: `.gd-well` has no `min-height`, so on a lead it renders 0x0, drops
out of the profile, and the span's top jumps from the well down to the fan. Named
as a state variable rather than left as an unexplained term; the bound uses the
larger.

So the span's bound **reduces to its two variable terms**:
- `deskHeight <= 148.5px` — STRUCTURAL (the saturation above);
- `fanHeight` — **not yet bounded**. Observed 230.8..316px, every value on the
  known 21.3px lattice. This is the single remaining piece between "worst
  observed" and "proved", and it is now the only one.

Self-catch: the first version printed "NOT ADDITIVE: K moves over 0.1px" — a
verdict its own number refuted, because it demanded exact equality of
independently-rounded terms. Fixed with a stated 1px tolerance.

### 3. D1 landed — and the level chip costs ZERO span (owner item 1, measured before building)

G-SIM is now stated against the **panel** set, on Grok's structural argument. The
level's absence is recorded as a DESIGN DEFECT with a named fix, not an accepted
cost. Measured at inner 390x664 before building anything:

- the title row is **27px tall, set by the TITLE, not the clock** (clock 24px), so
  any chip <=27px tall adds **0px** — confirmed by injecting three candidates
  (20.2-21.6px tall, 34.5-51.8px wide) in two different desk states: **0px growth**;
- with the LONGEST own-turn title (`請快出牌 · 還剩 30 秒`, 180.6px) and a clock
  present, **84.4px** of horizontal room remains.

**A chip up to ~84x27px is free.** Both properties, no trade, as the ruling predicted.

**Limitation stated, not buried:** the clock was INJECTED with its real class. A
driven room never presented one — diagnosed: in the timed run seat 0's turn was
the forced-pass window, where `GameTable.tsx:1166` deliberately suppresses the
clock. The layout measurement is real; "a server-rendered clock renders the same"
is an assumption.

### 4. [PROMOTED] The 664<->748 transition: the moving-target hazard does NOT materialise

Stated up front: headless CANNOT decide whether Safari collapses on a PROGRAMMATIC
scroll — Chromium has no such toolbar, and that stays a real-device question. It
CAN decide everything downstream. Over 6 deals, 664->748 and back:

- **largest press-target movement: 0.0px** (action bar, both buttons, first/mid/last
  card, well, desk);
- **round-trip residual: 0.0px**; `scrollY` identical throughout;
- **no oscillation** — `ScrollActionsIntoView`'s deps are `[loud, stagedCount,
  targetRef]` and a resize touches none of them.

The reason is last round's verified property: the layout is height-independent, so
growing the viewport reveals more without moving anything. That also disposes of
the iOS `100vh` subtlety, since nothing depends on viewport height.

**The hazard splits and only one half survives.** Moving target: REFUTED, 0px,
conditional on the trigger. Simultaneity cost: CONFIRMED and large — 84px between
the states against a panel slack of -20.3px at 664. The owner's sharpest case
stands: scrolling up to check the level re-expands the toolbar and costs 84px, so
consulting an excluded fact makes the rest less likely to fit. The desk chip
removes that pathway.

### 5. [SIBLING SWEEP] String-presence assertions check prose, not behaviour

The owner's second diagnostic — *"where else does this pattern exist?"* — run as
two sweeps, 14 agents, every finding mutant-verified. **Two HIGH, both confirmed:**

- **`fan-tap-targets.test.ts:73` was vacuous TODAY, no mutation needed.**
  `toContain('ZERO VICTIMS')` against raw script text; that phrase occurs exactly
  once in the repo — in the script's HEADER COMMENT. The real enforcement is
  spelled `process.exit(victims === 0 …)`. Deleting the entire victim counter and
  the non-zero exit — gutting the required fan gate to a no-op — left it green.
  Its own title said it: *"the enforced end-to-end check EXISTS"*.
- **`straight-flush-finder.test.ts:846`, in the ENGINE.** `toContain('bombTier')`
  where the finder's header comment contains the token. The verifier BUILT AND RAN
  the mutation — import removed, drifted local `tierOf` ladder added, all six call
  sites rewritten — and the test stayed green.

**And the sweep caught the tests I wrote LAST TURN.** Both viewport rules read as
absolute and neither was:
- `viewport: { width: N, height: N }` matches one spelling — defeated by hoisting
  into a named constant. I had created that escape hatch myself as
  `DRIVER_VIEWPORT` and called it "a hole with a label on it". The label is not a lock.
- `process.env.X ?? <number>` misses a default LIST — and `check-containment.mjs`
  defaulted to a list **beginning `390x844`**, so the CI gate was measuring the
  void height while the rule read as absolute.

**Fixed by moving up the ladder from text to behaviour.** Every gate script's
playwright import is now DYNAMIC and below its guard, so the guard is observable
from outside; `check-containment.mjs` and `measure-setaside.mjs` now REQUIRE their
viewport lists (exit 2); CI names its ten viewports explicitly. The test now
SPAWNS each gate with no viewport env and asserts a non-zero exit — plus a paired
test that the failure is ours and not `ERR_MODULE_NOT_FOUND`, because a missing
module also exits non-zero (practice 11, inside the check written to close a
practice-11 failure). Mutant-verified: the named-constant trick that defeated the
regex now turns it red.

### 6. METHODOLOGY 26 gains the sibling question; 29 records the prose class

Practice 26's diagnostic is now **two** questions, the second being the owner's:
*where else does this pattern exist?* — with the rule that **a sibling sweep is
part of the fix, not follow-up work**. Practice 29 records the escalation ladder
(substring on raw text < substring on stripped text < syntax a comment cannot
supply < RUN THE THING) and the point that rungs 1-3 all fail by SPELLING.

### 7. The shelf composition rule, stated BEFORE comparing (owner item 5)

An overlay is absolutely positioned, so **it does not add to the span at all — it
OCCLUDES**. Ranking overlay against collapsed on span alone would declare the
overlay free, which is measuring one option with an instrument that only sees the
other's cost. **The rule: an option is ranked only when BOTH instruments have run
against it**, and the overlay is comparable at all only while Play/Pass stays live
underneath.

Noted: the shelf's ~137px against 55px of slack is an **82px** deficit, against the
**81.9px** fold deficit the original shelf arc was chasing. Same quantity, same
source, new currency — the currency change made it measurable, not smaller.

### 8. D2 restated on the corrected numbers

24->44px costs **exactly +20px of span**, structurally. Last round, priced against
+55px, that was "affordable in the base layout". **On the staged numbers there is
no 20px to spend at 390x664** (slack -20.3px before the indicator exists). It is
affordable at 748 (+85.0px) and on desktop (+71.4px). So 44px is affordable
everywhere except the tighter phone state, which is the one that matters most.

### 9. Open

- **fanHeight's structural bound** — the last thing between sampled and proved.
- **D3 overlay-vs-collapsed** — the ranking RULE is settled, the ranking is not.
- **The elder session** leads with the toolbar-transition trigger (the one thing
  headless cannot settle), then the level-chip legibility and the three
  device-only replacement properties.
- The collapsed indicator must answer *"N cards set aside"* — open six rounds.
- The level chip itself is measured but NOT BUILT: if its placement in the desk's
  hierarchy is a design question, it goes to both lineages first.
