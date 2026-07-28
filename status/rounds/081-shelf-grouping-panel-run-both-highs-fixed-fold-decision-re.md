> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Shelf grouping — PANEL RUN, both HIGHs fixed; fold decision recorded (2026-07-24)

### PROCESS: the compensated-failure class is now in METHODOLOGY (practice 11)
The viewport-vs-document error was the FIFTH instance of one shape: **a check
passed because a compensating mechanism hid the failure** (e2e titles; the 606px
clamp behind "390px"; retention==staleness supplying the wake the arming was
meant to; markerSeat collapsed onto a uniform firstDrawer; ScrollActionsIntoView
masking a layout that does not fit). Operational rule recorded: **when measuring
whether X fits, first disable or explicitly account for every mechanism that
compensates when X does not** — and prefer building the compensator's state into
the measurement's OUTPUT over remembering to check for it.

### PANEL (owner split) — Codex 3, Grok 4. They converged INDEPENDENTLY on the same three.
  • **HIGH (both lineages) — a REJECTED action's commit could delete cards later.**
    My previous fix (hold the commit until the hand changes) closed one hole and
    opened another: a rejection leaves the hand unchanged, so the commit stayed
    pending and still matched `prevHand`; when the server later acted for an idle
    seat, that stale commit would be honoured and would remove slots nobody
    played — with twins, preserving the wrong copy and leaving an 'intact' label
    on a group whose real member had departed.
    FIXED by validating against the observed DELTA rather than hand-equality:
    the cards a commit names must be a sub-multiset of what actually departed,
    or it is discarded whole (never applied piecemeal). Three named regressions
    pin it, including the partial-match case.
  • **MED (both lineages) — the 26px group bar was NOT defensible**, and the
    owner's own reading was the same. The area argument (3427px^2 > 1936px^2)
    was WRONG because touch error is DIRECTIONAL: the bar was forgiving
    horizontally and 26px vertically, sitting directly under its run — the
    region where variant D's near-miss is VERTICAL — while controlling a
    destructive action. **Raised to 44px** (measured 131.8x46 and 111.5x46).
    Cost: the shelf band grows 115.5 -> 135.5px. Two-run shelves still measure
    `lines=1`, and the sweep still reports 0 stolen points / zero victims.
  • **MED (both lineages) — THREE recorded groups in one shelf WRAPS, and it is
    reachable.** Three 5-card runs plus two gaps is 131.8*3 + 12 = **407.4px**
    against a 342px box. Reachable via a crosshatch hand (three suits of the same
    five ranks) because at `AREA_HARD_MAX = 2` every flush after the first shares
    the one shelf. This is the pre-authorised NULL RESULT at the top of the
    range, stated rather than left unremarked: **two groups fit on one line,
    three do not.** Not fixed this round; the options (cap recorded groups per
    shelf, or a stacked group layout) are an owner call.

### FOLD DECISION RECORDED — accepted for the opt-in shelf, conditions checked
Base layout keeps the guarantee (Play fits 6/6 without a shelf); any shelf needs
scrolling (6/6). Accepted because the shelf is opt-in and the DEFAULT experience
is untouched — the standing "scrolling doesn't excuse below-fold Play" position
is SCOPED to what a player gets without asking, not waived.
  • **Condition 1 (no moving target) — MEASURED, mostly holds, one violation.**
    `ScrollActionsIntoView`'s deps are `[loud, stagedCount, targetRef]`, and
    `stagedCount` changes on EVERY card tap, so the effect re-runs each time;
    `block:'nearest'` makes it a no-op while the row is already visible. Across
    6 deals x 4 taps: **5/6 settle ONCE on the first selection and hold**
    (scrollY 0 -> 152 -> 152 -> 152 -> 152). **1/6 re-fired on the fourth tap**
    (scrollY 7 -> 54), moving Play ~47px mid-turn — the A' hazard from a
    different source. NOT changed unilaterally: keying the effect to `loud` alone
    is a one-word fix but alters shipped scroll behaviour on the DEFAULT path
    (and risks the desk growing Play back out of view with no recovery), so it is
    an owner call.
  • Conditions 2 (real iPhone: iOS dynamic toolbar makes viewport height
    unstable) and 3 (does the player PERCEIVE the scroll) are recorded for the
    real-device and elder sessions — neither can be closed by the iframe.

### VERIFICATION
  • Fan tap-target sweep re-run and **widened to include `.gd-fan__runTag`**, so
    the group bar is inside measured coverage rather than argued for on paper:
    `700/1000/3750` baseline unchanged, 0 stolen points, zero victims.
  • `scripts/measure-fold.mjs` standing gate: base layout PASSES.
  • Gate: typecheck (4 tsconfigs) + unit **1228/1228 (51 files)** + lint:hooks +
    build.

### ELDER SESSION — items recorded (not run)
Can they see which cards form which flush without explanation; is the 44px group
bar reachable without mis-taps given the vertical near-miss above it; do they
PERCEIVE the auto-scroll or does Play appear from nowhere; does send-to-area read
as organizing rather than playing; is the chip pager understood.

### STILL OPEN
Desktop verification (not run); the real-device session; the three-group wrap
decision; the `stagedCount` scroll-dep decision.
