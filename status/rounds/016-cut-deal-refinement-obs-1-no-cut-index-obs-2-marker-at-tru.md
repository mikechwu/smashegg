> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Cut & deal refinement (2026-07-15) — obs 1 (no cut index) + obs 2 (marker at true beat)

Owner brief: two observations, verify-first. **Obs 1** — hide the cut index, spread the deck to
the slider's width and split it live into two packets. Owner's stated reason (the index leaks
who gets the marker) needed VERIFYING: leak-real ⇒ fairness bug + named regression; no-leak ⇒
remove the number for DESIGN reasons. **Obs 2** — the marker card must fly DURING the deal at its
true beat, not tacked on at the end.

**Investigation FIRST (the gate).** Adversarial workflow, four diverse-lens skeptics all trying
to REFUTE "no leak" + a marker-index verifier — unanimous **NO-LEAK** (high confidence, concrete
file:line each): during `ceremonyCut` every view carries only the public `ceremonyCutter`; the
committed deck lives solely in `state.ceremonyCut.deck`, never in any view/event; the outcome
(firstDrawer/markerSeat) is a function of the HIDDEN deck computed only at the `cutDeck` commit;
the cutter's client lacks the deck to predict anything, and the displayed number was the raw
index only. So the number comes off for DESIGN reasons (no physical analogue, meaningless, breaks
the metaphor), CONFIRMING the owner's own reading — no conflict, proceeded to build. (One note:
skeptics flagged a `debugAuthorized`-gated `/dump` dev endpoint that can egress the deck — a
pre-existing debug tool, not a player-reachable path; out of scope.)

**Obs 2 redaction decision: NO new server field.** The marker is `flips[last]` and lands at deal
index `flips.length - 1`; `flips`/`firstDrawer`/`markerSeat` are ALL already public in
`handStarted.ceremony`, so the beat is derived client-side. No new field, no new redaction
surface, grammar pins unchanged.

**BUILD (12ff7bf) — all client presentation + pure predicates; engine/protocol/DO untouched:**
- **Obs 1:** removed the numeric index (all three locales; `game.cut.position` deleted).
  `CutRibbon` draws CUT_RIBBON_SLIVERS overlapping backs spread to the slider width; each sliver
  past the split shifts by a gap (> pitch), so dragging slides the split along the ribbon — the
  deck visibly parting. Pure split geometry (`cut.ts`: cutSplitFraction + cutLeftCount) pinned
  (monotonic, conservation, endpoints). Legal cut range CUT_MIN..CUT_MAX untouched (slider
  min/max pinned) — legalActions/defaultAction cannot drift.
- **Obs 2:** the deal now runs FROM the first drawer (public) so the marker lands at its true
  beat; the face-up marker replaces the back at `markerDealBeat(flips.length)`, leader still gets
  exactly 27. Honest budget re-derivation: choreography = landings + settle (≤4.5s); the old
  landings + MARKER_FLY + 200 tail is GONE — it got shorter and more faithful.
- Regressions: named engine leak guard (cutter's `ceremonyCut` view carries no
  firstDrawer/markerSeat/flips/cutPosition); CutPanel shows no numeric index + spectator parity;
  marker beat lands at the leader in a first-drawer-first schedule; re-pinned budgets.
  **737 unit + 40 e2e + 4 typechecks green.**

**Visual verification (state-driver bot + Chrome).**
- Obs 1 at DESKTOP and TRUE 390px (iframe recipe, innerWidth=390, no H-overflow): the split
  tracks the slider across the whole range (min → all-right, mid → centred, max → all-left),
  gap clearly exceeds card pitch, no number, legible at phone width; spectator sees the spread
  with no slider/number.
- Obs 2 at DESKTOP: froze the deal mid-flight (8× WAAPI slow-mo) — the face-up marker card flies
  to the leader CONCURRENT with the back flights, not after. Runtime probe confirmed
  `markerDelayMs === 0` (true beat for flips.length=1) and `reducedMotion=false` (real
  animation). The deal flights are rect-derived / width-independent, so the beat behaviour holds
  at 390 by construction (flights verified at desktop; cut UI verified at true 390).

**Owner decision to raise (not smuggled):** the CeremonyOverlay pre-announces the leader
(「that seat leads」) BEFORE the deal, which softens obs 2's "watch it come to you" suspense. Trimming the
overlay to end at the count (letting the deal reveal the marker landing) is a connected design
change to a DIFFERENT component than obs 2 named — flagged for the owner, left unchanged.

**PANEL EXECUTED (both lineages, headless scratch clones).** Grok: all 6 claims CONFIRMED, no
findings, 737 unit + 40 e2e green — CLEAN. Codex: confirmed 5/6 and caught ONE real Medium — the
deal order was built from a fixed CCW display cycle, so under `turnDirection:'clockwise'` (which
the engine supports and tests) the marker — the load-bearing who-leads card — would fly to the
WRONG seat. Both independently confirmed: no pre-commit leak, obs 2 adds NO server/view field
(`git show HEAD -- src/engine src/server src/shared` empty), both uniformity sweeps pass, legal
cut range byte-identical, honest budget, no engine/timing/DO smuggled in.

**Fix (3cf08ed):** `dealDirOrder(dir, clockwise)` now mirrors the engine's nextSeat (CCW seat+1,
clockwise seat+3), and GameTable passes `variant.turnDirection` (the client already holds the
config — no new data). schedule[beat].target is now the engine's markerSeat under EITHER config;
DealOverlay comment corrected. Regression pins both directions, closing the loop with the
engine's own clockwise counting test. **738 unit + 40 e2e + 4 typechecks green.** Fix re-audit
(Codex, fresh clone): all 4 points CONFIRMED, no new issue — CLEAN (default CCW unchanged;
clockwise bug closed; both directions pinned; DealOverlay comment now accurate).

**Visual note (honest):** the CCW default is verified in the browser (desktop + true 390 for the
cut UI; desktop for the deal marker). The clockwise fix is UNIT-verified only — clockwise is not
exposed in the lobby UI (reachable solely via direct API room creation), so the marker-at-right-
seat guarantee under CW rests on the property pins + the engine's clockwise test, not the eyes.

**Last updated:** 2026-07-15 (prior: refinement round)
