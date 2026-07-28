> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deal fidelity round (2026-07-15) — 3 deal bugs + the Codex producer≠auditor policy

Owner brief: two visual deal bugs, one load-bearing fidelity fix, and a standing Codex-allocation
rule. All on branch feat/cut-deal-refine (stacked on the cut & deal refinement round below).

**Item 4 — the Codex policy (METHODOLOGY, next to the model ladder).** Whoever PRODUCES a change
cannot be its independent auditor (consultation anchors too). Load-bearing (engine/protocol/
redaction/timing/DO alarm) → Codex stays an AUDITOR, built in-house. Not load-bearing (UI/anim/
tooling/tests) → Codex may implement, audited by Grok + the eyes, never by Codex. Applied THIS
round: item 3 in-house (Codex a clean auditor); items 1-2 Codex-authored (Grok + eyes audit).

**Item 3 (78e11f4) — faithful deal: true arrival order + one sort beat. THE VERIFY-FIRST FINDING:**
the owner's redaction argument is right — publishing per-seat deal order leaks nothing — and
STRONGER, it was ALREADY published. handStarted.hands[X] always carried seat X's cards in the
engine's round-robin deal order; viewEvent redacts to X's own cards and preserves the order; the
client received it and threw it away, animating fake pre-sorted slots. The STATUS "true arrival
order unknowable BY REDACTION" claim was simply WRONG (corrected in place). So CLIENT-ONLY — no
engine/protocol/view change. HandFan now lays cards out in arrival order while dealing (revealed
uncovers the landed prefix) and re-lays sorted in one FLIP beat at the end (cards keyed by sorted
index so the slide animates across the 2-row split; reduced-motion skips it). Honest budget
re-pin: dealWithSortMs = landings + settle + one sort ≤ 5s. Pins: obligation-3 (each seat
delivered EXACTLY its own 27 in unsorted deal order, nothing from the other 81; 16 views, never
pre-sorted); dealToHandIndices bijection incl. duplicates; HandFan deal-order render; sort budget.

**Items 1-2 (57649c3, Codex-authored) — two presentation bugs:**
- Item 1: the deck depth shadow-slab selectors were descendant (`.gd-deal__deck .gd-card`), so the
  marker card inside the deck rendered as a stack. Scoped to `.gd-deal__deck > .gd-cardframe >
  .gd-card` — deck keeps its slabs, marker is a single flat card.
- Item 2: the centre deck (z-9) occluded the trick-well turn prompt. `.gd-well` → position:relative
  z-index:10, prompt paints above. CSS-token pins for both.

**Visual verification (state-driver + Chrome, desktop AND true 390px):**
- Obs 3 at DESKTOP: froze a deal mid-flight — 11 own cards landed in genuine unsorted arrival
  order (clubs4 spades4 heartsJ hearts6 hearts4 clubsJ … — NOT the 11 lowest a pre-sorted deal would show);
  after completion the fan settled fully rank-sorted (3,3,3,4,4,4 … A,A,2,small joker). Sort beat works.
- Item 1: deck back keeps 7 shadow-slab layers; the marker card's computed box-shadow is 'none'
  (single card). Item 2: the "wait for X to lead" prompt is legible above the deck (well z-10).
- TRUE 390px (iframe, innerWidth=390, no H-overflow): the 27-card sorted fan is legible in 2 rows
  and the prompt reads clearly. (The obs-3 sort + items 1-2 fixes are width-independent; the
  mid-deal freeze was captured at desktop, the settled/390 render confirmed via the iframe.)

**PANEL EXECUTED — the new policy in action.** Codex audited ONLY item 3 (it authored items 1-2,
so it cannot self-audit them); Grok audited item 3 + items 1-2. **Both CLEAN, no findings.**
Codex: all 6 item-3 claims CONFIRMED — obs 3 is client-only (`git show 78e11f4 -- src/engine
src/server src/shared` empty), no cross-seat leak, foldEvents own-only, obligation-3 pin real,
honest budget, replay/uniformity intact (its e2e blocked only by sandbox 127.0.0.1 EPERM). Grok:
all 8 CONFIRMED incl. items 1-2 — marker slabs correctly scoped (deck keeps them, marker doesn't),
and the well/deck stacking verified (both under `.gd-table`'s context so z-10>z-9, ceremony
overlay mutually exclusive, toast z-20). Both independently answered the owner's question — does
publishing per-seat deal order leak any other seat? **NO.**

**Self-caught + fixed before ship (5fa44dd):** the HandFan FLIP animated ANY position delta, so a
play (hand shrinks, indices remap) or the sort-direction toggle would have animated too. Gated to
the deal→sorted transition ONLY; every other render stays instant. (A pure-animation refinement;
the panels' redaction verdict is unaffected.)

746 unit + 40 e2e + 4 typechecks green. Round DONE — merge to main + push (production deploy) awaits
the owner; main already carries the two prior unpushed rounds too.

**Last updated (prior below):** 2026-07-15 (cut & deal refinement)
