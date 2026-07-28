> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Straight-flush finder — pure hand-decomposition ENGINE MODEL built + oracle-verified + gated (2026-07-24); UI phase next

PLAN OF RECORD (docs/research/straight-flush-finder.md). Owner signed off six
decisions + three strengthenings; owner sequencing: build the engine model + its
oracle FIRST, THEN bring the UI once the model is settled and pinned. This is that
engine checkpoint — the pure decomposition model, tested against an INDEPENDENT
brute-force oracle, gate green. No UI, no protocol/redaction/timing change.

WHAT IT IS: a PURE assistant (src/engine/guandan/straight-flush-finder.ts) over
the player's OWN hand — findStraightFlushes(hand, level, config). It shows the
meaningful ways to pull straight flushes and what each choice LEAVES. The UNIT is
a complete DECOMPOSITION = pairwise-disjoint SF groups + the induced remainder.

MODEL:
  • DISTINCTNESS: an arrangement is identified by its REMAINDER (= committed-card
    set, the hand fixed) — owner Decision-6 words made exact ("the same five cards
    pulled are one arrangement; a different suit is a different pull"): π-coarser
    in end-position (a wild-completed run carries BOTH tops as one group),
    π-finer in suit. REFINEMENT (oracle-driven, disclosed): the sign-off's
    "physical-group multiset" was proven too fine (spurious splits from wild
    redistribution + natural-first DFS order); remainder-keying dissolves both and
    is the same intent, cleaner — not a scope change.
  • ENUMERATION: BOUNDED-MULTIPLICITY set packing over ≤40 candidate (top,suit)
    windows sharing the ≤2 wilds as one GLOBAL budget (feasibility Σ_id max(0,
    demand−supply) ≤ wilds). The first-pass MIS framing was WRONG (one node per
    window structurally excluded the twin double-pull — two identical top-9♠ bombs
    from a twinned one-suit run); the critic caught it, bounded-multiplicity is the
    fix (the global inequality already supported it — math right, description
    wrong). Structural caps (C≤40, k≤5, wild-using SF ≤2) make blowup impossible;
    materialize natural-first (remainder-optimal), remainder = removeCards fold.
  • RANKING: Pareto frontier of (SFValue partial order, RemainderQuality lex tuple
    [bombPower, coverage, −orphans]) — a SORT/prune, NEVER a filter; every shown
    row renders its FULL remainder; capped SF_FINDER_MAX_SHOWN=6, primary 4.
  • ANNOTATION: a CLOSED, FACTUAL tag vocabulary REMAINDER_TAG_KINDS =
    {bomb, straightFlush, run, scatter, cardsLeft} — counts/presence only, NO
    comparative/advisory kind (owner strengthen 1: informs, never advises),
    structurally pinned. bomb/SF counts are a constructive GREEDY-disjoint lower
    bound (never overclaims).
  • ZERO/ONE-SF: found + totalFound expose "looked, none" vs "did not look" for the
    UI's acknowledge-the-press (owner strengthen 2, the no-silent-no-op class).

ASSISTANT-ONLY (confirmed): pure fn, imports only pure primitives (cards/combos/
generate), sole input the own hand (reveals nothing about other seats), mutates
nothing, deterministic; reuses classifyPlays so it can never be a second rules
oracle. No server/protocol/redaction/timing/generation change.

ORACLE (tests/unit/engine/straight-flush-finder.test.ts): an INDEPENDENT
brute-force check — naturalSfTop recognises SFs DIRECTLY (never shares
sequenceWindow, so A-low/no-wrap is independently tested), enumerates by wild
substitution + physical-position partitioning (twins distinct), FRUGAL-filters to
the natural-first set, and compares by remainder key. (A) soundness per group,
(B) completeness == enumerator raw, (C) complement-exactness under twins via
independent Counter subtraction, (D) ranking as a deterministic Pareto property,
(E) frugal-domination. Named cases: twin double-pull, global-allocation rescue,
end-position two-tops, A-low, hearts-through-level, two-wilds, zero-SF,
bomb-in-remainder, purity. Plus a config-swept random twin/wild-heavy fuzz sweep.
Both real oracle disagreements during the build (frugal-domination, the
remainder-vs-physical distinctness) were forced by the oracle, not assumed.

GATE (green): typecheck (4 tsconfigs) + unit 1126/1126 (48 files) + lint:hooks +
build. (Fixed one PRE-EXISTING unrelated flake: obligations.property default-
profile — 3 full-match playouts brushing the 5s default budget under parallel-
suite CPU contention; proven independent of this change — gave it a realistic 30s
timeout, assertions untouched.)

AUDITS (producer≠auditor — Claude produced the load-bearing engine + oracle, so
both auditors are clean):
  • **Codex on enumeration correctness — SHIP, 0 confirmed findings** across
    completeness (incl. the twin double-pull + global wild allocation), soundness,
    complement-exactness under twins, natural-first determinism, termination/
    bounds, oracle independence. Its inline stress runs: worst realistic 27-card
    shape ~1.1k leaves vs the 4096 backstop. CAVEAT: its sandbox could not execute
    vitest (EPERM), so it is reasoned-from-code; our own run is the execution
    evidence.
  • **Independent adversarial lens — DON'T-SHIP on vocabulary integrity**, with
    FIVE real defects. All confirmed by direct measurement, all fixed, each now a
    named regression PROVEN non-vacuous (reintroduce the bug → the test fails):
      1. FACTUAL LIE: under wildStraightFlushIsBomb=false a wild-substituted SF is
         DEMOTED, so SF counting off the bomb-filtered list tagged a remainder that
         really held a straight flush as 'run'. Now counted BY TYPE.
      2. FACTUAL LIE: 'scatter' fired over a leftover PAIR. Now requires that
         nothing combines at all.
      3. VACUOUS GUARD: `readonly RemainderTagKind[]` was a SUBSET annotation —
         an advisory kind could be added to the UNION alone with the array (and
         the runtime equality test) still green. Now a type-level exhaustiveness
         pin; the union-only attack is a COMPILE error (verified).
      4. DRIFTED SECOND ORACLE: a local bombWeight() copy had drifted from
         combos.bombTier (jokerBomb hard-coded 100, missing the
         jokerBombSupreme=false 75 rung), silently reordering what the player sees.
         combos.bombTier is now EXPORTED and used; a source ratchet forbids a copy.
      5. DOCUMENTED-BUT-ABSENT TEST: the header claimed the shown list was checked
         against an independently-recomputed Pareto frontier — it never was (the
         old assertions would have passed `raw.slice(0,6)` unordered). Now really
         implemented (independent frontier + order + totalFound), which then caught
         a genuine inconsistency: the stable tiebreak still used the OLD group-cards
         key after identity moved to the remainder. Aligned.
    Also corrected TWO false comments: "safe to call every render" (measured
    ~150-350ms on 27-card hands — it is an ON-DEMAND press, never a render path;
    the doc's "sub-ms" claim was wrong too) and the budget-truncation semantics
    (if it fired it WOULD be a completeness compromise, not a display cap; it does
    not fire in practice). Oracle strengthened: group fields (suit/top/forms/
    wildsUsed) now checked, tag VALUES now checked, and the battery now runs on
    realistic 27-card hands (it never exceeded 10 before).
  ASSISTANT-ONLY was independently confirmed to HOLD (purity, no-leak,
  determinism, no-mutation, unwired).
  • **Re-audit of the FIXED tree (same adversarial lens, mutation-tested) — SHIP**
    on both claims. It injected 11 non-equivalent defects and the suite caught
    11/11 (A-low dropped, twin multiplicity capped, wild budget capped, dedupe key
    swapped, display order destroyed, group.top falsified, scatter loosened, the
    SF-by-type filter reverted, cardsLeft falsified, greedy disjointness disabled,
    totalFound capped); cross-checked the independent A-low recognizer against the
    engine over all 5148 (rank-set, suit) combinations with 0 disagreements; and
    re-verified BOTH vocabulary attack vectors are now blocked (union-only widening
    = compile error). It found THREE further items, all addressed:
      6. TAUTOLOGICAL TEST: the (E) frugal-domination test asserted
         `naturals + wildsUsed === 5`, i.e. `5 === 5` — while doc §5(E) claimed a
         real check. Now checks the actual property via the independent frugality
         predicate; proven non-vacuous (a wasteful materialization fails it).
      7. DOUBLE WORK: annotateRemainder ran TWICE per decomposition (tags, then
         ranking). Computed once and threaded — measured 276/352ms → 105/156ms on
         27-card hands. Docs/comments now carry the measured figures.
      8. OPEN, owner decision (UI phase): the scatter fix traded a wrong tag for
         SILENCE — 56.8% of non-empty remainders now carry no descriptive tag
         though they hold a real pair/triple/full house. Options: extend the closed
         set with strictly factual kinds, or state the silence is deliberate. NOT
         decided unilaterally — the vocabulary is owner-signed.
    Trivia fixed: unused isWild import.
  HONEST NOTE: the first adversarial run overlapped my fixes, so its verdict was
  against a moving tree; the re-audit above is against the settled tree.

SECOND AUDIT ROUND (owner asked "are there issues to audit with codex and grok —
if yes deep research to resolve then audit"). TWO issues were found by research
BEFORE the audits, both real, both fixed:
  9. THE COUNTS WERE A CATEGORY ERROR. Notable holdings were counted off
     legalPlays — a MOVE generator that emits ONE realization per canonical
     projection, and whose SF projection is SUIT-BLIND. So 5S6S7S8S9S + 5C6C7C8C9C
     (two genuinely disjoint SFs) reported straightFlush x1, and twins collapsed
     the same way — systematically undercounting the exact "break it and I have
     two bombs" signal the feature exists for, and feeding the ranking. COUNTS now
     come from countHoldings (multiplicity-aware greedy over enumerated
     candidates); PRESENCE still comes from legalPlays, whose dedupe can hide a
     duplicate but never an existence.
 10. THE SILENCE GAP (carried open from round 1) is RESOLVED: the vocabulary is
     extended with three strictly factual PRESENCE kinds (fullHouse / triple /
     pair), one word for the strongest remaining structure. Measured 56.8% silent
     -> 0.0%. This expands an owner-signed artifact, flagged as such; it adds no
     comparative/advisory kind, so "informs, never advises" is untouched.
AUDITS ON THE FIXED TREE:
  • **Grok (vocabulary factuality + assistant-only) — SHIP** on both axes.
    Q1 expanded vocabulary still strictly factual (the ladder causes OMISSION, not
    falsehood — a UI-phase framing note: tag chips are a PARTIAL read when several
    structures coexist). Q3 assistant-only holds (pure, own-hand, engine-only,
    non-authoritative, unwired). Q2 MIXED and correctly so: the RANKING layer is
    advisory BY DESIGN — that is owner Decision 3, the named judgement call, not a
    sneaky bug. It found ONE real defect, fixed:
     11. COVERAGE IGNORED MULTIPLICITY: `Set<Card>` keyed on identity, so an SF
         covering ONE 5S marked BOTH twins covered (orphans=0), flattering
         twin-heavy remainders and corrupting Pareto dominance. Now a greedy
         disjoint cover, LARGEST play first (first-fitting also made it hostage to
         legalPlays emission order and understated coverage badly).
     Plus hygiene: the now-unused compareComboStrength import removed.
  • **Codex (counting correctness) — DON'T-SHIP, 1 confirmed finding**, fixed:
     12. FALSE COMMENT "Max DISJOINT": the greedy is STRONGEST-first, NOT
         maximum-cardinality. For `5-9 in all four suits` it reports FOUR straight
         flushes (4 x 55 = 220) where FIVE disjoint rank bombs exist (5 x 40 =
         200). The ALGORITHM is right (each SF beats a 4-bomb, so the stronger
         reading is the better thing to tell a player); the COMMENT lied. Comment
         and doc corrected to the true contract — real, pairwise disjoint, a LOWER
         BOUND, never a maximum — and pinned by a named crosshatch test.
     Codex's other 7 claims all SURVIVED: termination, wild accounting (incl. the
     cap-10 and level-rank §9.14 cases), no-overclaim, level-rank/wild routing,
     demoted-SF handling, presence-vs-count, and ranking determinism.
     CAVEAT: Codex could not execute vitest (EPERM sandbox) — reasoned-from-code
     plus inline probes; our run is the execution evidence.
  Every fix is a named regression PROVEN non-vacuous (reintroduce → test fails).
  Gate after round 2: typecheck + unit 1129/1129 + lint:hooks + build.

DECISIONS (owner, signed off): 1 distinctness diverging from π; 2 maximal backbone
+ Pareto sub-maximals + reversible keep-one-fewer (log the withheld-sub-maximal
limit); 3 Pareto sort-never-filter; 4 closed factual vocabulary (structural); 5
tabbed 1-at-a-time + fixed remainder scoreboard (UI direction); 6 single-SF stages
a bomb / multi-SF view-only. STRENGTHENINGS: 1 vocabulary closed+factual+
structural; 2 zero/one-SF visible response; 3 same-groups⟺same-remainder pinned by
independent-Counter twin-heavy complement.

UI PHASE (built 2026-07-24, after the model settled — owner sequencing).
SURFACE: a bottom SHEET (SfFinderSheet.tsx) over the lower table, the fan still
visible behind it. Written from the PLAYER's side: it answers three questions in
the same place every time — SET ASIDE (the flush as real faces, a wild drawn as
the card it stands for via resolveComboFaces/GhostFace — the wild-chooser's own
convention) / LEFT WITH (the closed factual tags + the real cards one tap away) /
PICK THIS. One arrangement at a time via a big-target STEPPER (Decision 5): 390px
cannot hold N card fans, and the zones keep their screen position so stepping
reads as ONE quantity changing in place. Trigger 「找同花順」 sits in the SECONDARY
column beside the sort toggle — a helper, never competing with Play/Pass — and is
offered whether or not a flush exists, because the PRESS must always answer
(strengthen 2). Staging populates only the client-only selection Set (twin-safe,
first-unclaimed-slot), so the desk + one-tap clear keep working and any real play
still re-flows through matchSelection → the server's validatePlay.
COMPUTER-USE QA (true 390px iframe + the live table, zh-Hant and en) found FIVE
defects no unit test could see; all fixed and each pinned by a VISUAL-QA
REGRESSION test:
  13. The sheet OVERFLOWED the viewport and clipped its own left edge (「這手牌的
      拆法」 lost its first glyph): `min(26rem, 100vw)` counts the scrollbar. Now
      inset-inline:0 + margin-inline:auto, which cannot exceed the width.
  14. Tap targets under 44px (close 28, pick-this 40, see-cards 36) — all now
      2.75rem. The TRIGGER was 27px; raised to 2rem (see the open item below).
  15. With three flush rows (a four-suit crosshatch) the remainder scoreboard was
      pushed BELOW THE FOLD and its position moved with the flush count — which
      destroys the design's core promise. It is now STICKY to the sheet's foot.
  16. An EMPTY remainder still offered "see the cards left" — a press that opens
      nothing. Now hidden (the no-silent-no-op rule cuts both ways).
  17. THREE different numbers on screen at once (header "7 ways", more-line "of
      6", stepper "of 4") — broken arithmetic from the player's side. The
      more-line now quotes the header's own total.
  Also: the stage button was demoted to SECONDARY (outline) — three solid-cinnabar
  CTAs in a helper sheet out-shouted the table's real Play button (loudness
  hierarchy).
LIVE VERIFIED in a real dev room at the table: the trigger renders in the
secondary column; the sheet opens over the live fan with no horizontal overflow;
a REAL dealt hand produced 同花順 K (9–K♠) with a ghost J♠ for the wild and the
remainder read 炸彈 ×1 · 剩 22 張; pressing 選這個 staged exactly the five physical
cards (the WILD, not the ghost), closed the sheet, and the desk picked it up as
「即將出:同花順 K (9–K)」 with 重選 offered — the full non-destructive round trip.
UI AUDIT ITERATION (both lineages, on the built UI — both returned DON'T-SHIP and
both were right; every finding fixed, each pinned by a non-vacuous regression):
  **Codex (UI code) — 2 confirmed + 1 hypothesis:**
   18. HIGH, F1 — the held sfResult was never invalidated. A sheet left open
       across a SEAT SWITCH or a new deal would, on "pick this", match its old
       card IDENTITIES against the CURRENT hand and stage the WRONG CARDS. Now
       the result is discarded by the SAME context comparison the selection
       reconciliation already uses (seat/handNo/dealNo/hand contents), so the two
       can never disagree about what "this hand" means.
   19. MED, F2 — a group card no longer in hand was silently skipped and the
       PARTIAL selection committed (four of five cards). Staging is now ALL OR
       NOTHING.
   20. LOW, F3 — `found:true` with an empty list would index past the end and
       crash; now renders the nothing-found state.
   Codex SAFE on: twin index mapping, selection/reconcile interaction, hooks,
   the once-per-press perf contract, CSS tokens, sticky container, z-index.
  **Grok (UX, from the player's side) — 3 blockers:**
   21. The claim that the remainder holds a FIXED position was FALSE for the
       common case: `.gd-sf__page` never stretched, so `margin-top:auto` only
       pinned it on tall pages — stepping 1-flush → 3-flush MOVED it. Fixed with
       `flex:1; min-height:0`, and VERIFIED BY MEASUREMENT at true 390px: the
       remainder bottom sits at y=831 for both a 1-flush and a 3-flush page.
   22. 「選這個」 ("pick this one") + the sheet closing read as "I already played".
       The label now says what it does — 放到出牌區 / "Put in play area" — and the
       aria adds "this does not play them".
   23. The short-read disclaimer pointed at the CARDS without naming the RULE.
       It now says "only one holding is named here". (First rewrite used
       "strongest", which our own advisory-word guard rejected — the guard was
       right; the rule is named mechanically instead.)
   Also fixed: the header could advertise more ways than were reachable — the
   engine now returns the WHOLE frontier (the display cap is the UI's), so
   `totalFound === decompositions.length` and "show more" really shows all;
   「先列最清楚的」 ("the clearest") was soft advice → neutral 「先列 N 種」; the
   multi-flush note contradicted per-row staging and peeked out from under the
   sticky footer → reworded and moved to lead the rows it describes; zone labels
   were the quietest text on a panel whose metaphor they carry (10px/0.75) →
   --fs-sm at full opacity.
OWNER UI ROUND (2026-07-24, from screenshots):
  24. THE PANEL FRAME JUMPED between ways. The sheet is bottom-anchored and was
      sized by its content, so a 2-flush way made it TALLER and a 1-flush way
      SHORTER — the whole panel, header and stepper included, moved as the player
      paged. Paged states now carry a CONSTANT height (.gd-sf--paged); the empty
      no-flush state keeps its natural height (a tall frame with nothing to page
      is just a hole). MEASURED at true 390px across all four ways (flush counts
      alternating 3/2/3/2): top edge 126, height 718, stepper and remainder foot
      identical on every one.
  25. THE REMAINDER LOOKED LIKE A DIFFERENT KIND OF OBJECT — a wrapped 5-across
      grid of loose cards, a second card layout to learn. It is now drawn by the
      HAND FAN ITSELF (new `readOnly` prop on HandFan), so "what you'd be left
      with" inherits the hand's own same-value column grouping, overlap and faces:
      one way to read cards, not two. Read-only renders a picture (role="img"),
      not buttons — a tappable card that did nothing would be a silent no-op press.
      Verified live: 17 cards in 10 same-value columns, identical gd-fan markup,
      ZERO press targets.
  Also, while fixing 25: the revealed fan was stranded BELOW the sticky footer
  (the summary pinned while the truth it summarises was pushed out of reach). The
  fan now lives INSIDE the remainder block, and that block is sticky only while
  COLLAPSED — comparison mode pins it, inspection mode releases it so it scrolls
  with the cards it just revealed.
PRE-DEPLOY AUDITS (owner: "after pass audit from codex and grok and everything is
clean, then ready to deploy"):
  • **Grok (UX) — SHIP.** Re-verified all three of its earlier blockers now hold,
    citing the current strings/CSS: staging language is staging not play
    (放到出牌區 + "還沒有出牌"); tags + disclaimer no longer over-claim
    (「這裡只標其中一項;點開看每一張剩牌」); the paged frame is genuinely constant
    and short pages stretch. Judged all four new changes improvements (hand-fan
    remainder, sticky-only-while-collapsed, full-frontier honesty, note moved to
    lead). TWO minor non-blockers, both FIXED: the honesty line was the faintest
    text on the panel though it is what stops the tags over-claiming (now --fs-sm
    at 0.9); and the read-only fan announced itself as 手牌 ("your hand") when it
    is the REMAINDER (HandFan gained an optional `label`, the sheet passes 剩下).
  • **Codex (code) — 0 confirmed regressions**, PASS on all substantive focus
    items: the stale-result guard creates no render loop and preserves the
    existing selection-reconciliation ordering; `readOnly` default is inert so the
    shipped main-hand path keeps its buttons + cardRefs (DealOverlay measurement
    and the FLIP untouched); the `bombTier` export is behaviour-inert; the client
    import graph stays engine-only with no server/DO/node path; assistant-only
    holds. ONE LOW fixed: `readOnly` was honoured only in the SETTLED branch, so a
    future readOnly+dealing caller would silently get press targets back — now
    honoured in BOTH, pinned by a test asserting two occurrences.
    HONEST NOTE: Codex's literal first verdict was DON'T-SHIP, and the stated
    reason was that its read-only sandbox could not execute the gates (EPERM on
    node_modules/.vite-temp) — an ENVIRONMENT limitation, explicitly "not because
    of a confirmed code regression". The gates were run here instead and the
    evidence handed back to it rather than the verdict being reinterpreted
    unilaterally. It also flagged that several UI lifecycle assertions are
    source-text pins rather than behaviour tests — true, and carried honestly;
    the load-bearing ones were separately proven non-vacuous by mutation
    (reintroduce the bug, the test fails).
OPEN (owner call, NOT changed unilaterally): the secondary control column ships
~23px pills (the sort toggle); the finder trigger sits at 32px. Making these a
full 44px is a change to a SHIPPED control and costs vertical space in the zone
where a regression once pushed Play/Pass below the 390px fold — so it is flagged,
not silently redesigned.
Gate: typecheck (4 tsconfigs) + unit 1166/1166 (49 files) + lint:hooks + build.
