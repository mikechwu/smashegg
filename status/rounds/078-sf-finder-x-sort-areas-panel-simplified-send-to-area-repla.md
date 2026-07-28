> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## SF finder x sort areas — panel SIMPLIFIED, send-to-area replaces staging (2026-07-24)

Owner round after real-player feedback. The through-line: sort areas made half
the finder's UI obsolete. The remainder DESCRIPTION existed because the player
had nowhere to put a flush; now they pull it aside and look at their own hand.

**1. SEND TO A SORT AREA, not the play desk.** `onStage` -> `onSendToArea`;
`stageSfGroup` -> `sendSfGroupToArea`, which runs the SAME `applyMove` every
other area control uses. Nothing is staged, nothing is submitted. The sheet now
STAYS OPEN after a send — each flush has its own control, and closing after the
first would make the second unreachable. A sent flush's row becomes a STATEMENT
(「已放一旁」), not a button, because pressing again would move nothing.
  **DECISION 6 UPGRADED, NOT REVERSED — recorded, not silently contradicted.**
  The old rule (single SF stageable, multi-SF view-only) existed because two
  flushes are not one legal play and so cannot both be staged for COMMIT.
  Sending to an area is organizing, not committing, so the reason does not apply
  to the new action. Nothing about what may be PLAYED changed. `gd-sf__viewOnly`
  is gone and its test is rewritten to pin the upgrade.
  **OVERFLOW DECIDED: multiple flushes SHARE one set-aside area.** With the
  measured cap of MAIN + one shelf, hiding the control for flushes with nowhere
  to go would hide it for EVERY flush after the first — the player could not set
  aside a second flush at all, which defeats the feature. Sharing always
  answers, and "set aside" stays literally true. It also needed no new rule:
  `setAsideDestination` already mints a new shelf while the budget allows and
  joins the existing one at the cap, so "each flush gets its own area" is simply
  what happens when there IS room. One rule for where set-aside sends things.

**2. NO-ROOM CONTROL HIDDEN, not disabled.** `setAsideBlocked` and
「沒有空間再開一組」 are deleted (string removed from all three locales).
DISTINCTION RECORDED so the standing rule is not misread: no-silent-no-op
forbids a press that goes UNANSWERED. A control that is absent cannot be
pressed, so there is nothing to answer — removing the possibility is not the
same as swallowing the response. The rule never required dead controls.

**3. PANEL SIMPLIFIED — UI subtracted, CORRECTNESS NOT.** Removed: the remainder
tag chips, the short-read explainer, the 看剩下的牌 reveal, and the read-only
remainder fan. **The engine-side remainder is untouched** — pinned by a new
boundary test asserting every decomposition still carries a remainder and closed
factual tags, because ranking is the Pareto frontier of (SF value, remainder
quality) and losing it would collapse ranking to SF strength alone and bury the
"break it and I have two bombs" arrangement the feature exists for. The engine
suite and its oracle pass unchanged.
  **PAGER REDESIGNED** (players did not realise several arrangements existed):
  an arrow stepper whose position sat in small text is now a sentence
  (「這手牌有 N 種拆法」) plus one directly tappable chip per way — any
  arrangement is ONE press away instead of up to five, and at most 6 chips ever
  render (the engine's own shown cap), which fits 342px. SINGLE-ARRANGEMENT
  CASE: no chips, no arrows, nothing implying a second page — but the sentence
  still answers "is there more?", so three chips on a later hand is more detail
  rather than a surprise.

**4. FACES OVERLAP**, reusing the fan's OWN measured ratio rather than a new one.
MEASURED at true 390px: card 50.7px, pitch 20.3px, **overlap ratio 0.60** —
exactly `.gd-fan__row`'s -0.6 — 5 cards spanning 131.8px.

**5. RECALL DIRECTION CUE.** 「收回手牌」 -> 「↓ 收回手牌」, with an aria that
spells the destination out (an arrow is a spatial cue a screen reader cannot
convey). The arrow is always correct because `bandOrder` renders MAIN last, so
"back to main" is always downward.

GATE: typecheck (4 tsconfigs) + unit **1219/1219 (51 files)** + lint:hooks +
build + the fan tap-target sweep in BOTH states (`700/1000/3750` baseline
unchanged; seam 0 stolen points). Bundle 442.99 kB / 143.83 kB gzip.
  **The finder is now a source of area edits, so it entered the partition
  invariant's surface**: the seeded playout property now interleaves real
  finder-driven sends (`findStraightFlushes` -> first-unclaimed slots ->
  `setAsideDestination` -> `applyMove`) with the other area operations and
  asserts the invariant after each, with a coverage floor proving sends actually
  occurred.

VISUAL (true 390x844, zh-Hant, 6 real dealt hands): no viewport overflow, no
sideways page scroll, every press >= 44px, and none of the six removed surfaces
present. VERIFIED vs NOT, honestly:
  • Overlap ratio, card width and pitch: MEASURED (above).
  • **The 10-card worst case was NOT observed** — real deals produced 5-card
    groups. It is BOUNDED BY ARITHMETIC FROM THE MEASURED PITCH: 50.7 + 9*20.3 =
    **233.4px**, inside the 346px content box, so it cannot clip. Stated as a
    computed bound, not as an observation.
  • **A multi-flush arrangement was NOT observed at 390px** in these deals
    (every arrangement had one group). It is covered by the component-level
    render test (twin-double renders >= 2 send controls), which is a static
    render, not a 390px visual. Carried as an open visual check.
  • Several ARRANGEMENTS was observed (2 chips rendered).

CARRIED HONESTLY: `HandFan`'s `readOnly` prop is now UNUSED — the finder's
remainder fan was its only consumer. It is kept rather than deleted: it is
audited, tested behaviour and a general fan capability, and this round's mandate
was to subtract the finder's remainder DISPLAY, not to remove a fan feature. It
is flagged so an auditor does not have to discover it.

STILL OPEN: the elder session (now also: does send-to-area read as organizing
rather than playing; is the chip pager understood); drag; the seam
paint-clearance trade-off.
