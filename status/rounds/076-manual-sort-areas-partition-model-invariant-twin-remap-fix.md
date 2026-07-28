> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Manual sort areas — PARTITION MODEL + INVARIANT + TWIN-REMAP FIX built and gated (2026-07-24)

Owner decisions taken (see the design-study entry below for what they resolve).
Owner sequencing honoured: the model and its invariant are built and pinned
BEFORE any UI. **No UI this round** — the bundle is byte-identical (437.32 kB /
142.02 kB gzip) because nothing imports the module yet, which is itself the
evidence that no shipped behaviour changed.

WHAT IT IS: `src/client/table/areas.ts` — a pure, React-free, DOM-free model of
the hand's client-only visual PARTITION. Area 0 is MAIN (always exists, drawn
nearest the desk); 1..n-1 are SHELVES drawn above it.

THE TWO STRUCTURAL DECISIONS:
  • **`HandAreas | null`, where `null` IS "no areas"** — absence, not
    `singleArea(n)`. This is what makes progressive disclosure real instead of
    nominal: a never-user holds `null` forever, so reconcile returns the same
    value with no allocation, no state commit and no re-render. The pre-build
    critique proved the alternative impossible — a TOTAL `areaOf` map over a hand
    whose LENGTH changes can never return the same instance, so the "never-user
    allocates nothing" claim would have been false on the commonest wire message
    there is (any play that shrinks the hand).
  • **`areaOf: readonly AreaId[]`** — a total function slot → area. DISJOINTNESS
    and COVERAGE are therefore theorems about the TYPE ("a card in two areas" and
    "a card in no area" have no inhabitants), not assertions about a value. Only
    the scalar agreement `areaOf.length === hand.length` stays validated, at the
    single construction site that ever builds against a hand it did not match.

THE TWIN-REMAP FIX (the round's most serious finding, built first per owner):
`remapAreas` does NOT re-derive membership by identity when the client caused the
change. It removes the EXACT slots the client committed — which it knows, from the
selection it submitted — and every surviving slot keeps its area. A `HandCommit`
carries the hand it was made against, so a STALE commit (an action the server
rejected, hand unchanged) is recognised and ignored instead of corrupting the next
real change. Cards with no predecessor (a tribute arriving) land in MAIN.
  The walk is per-VALUE, deliberately NOT via a re-derived comparator: `view.hand`
  is sorted by the engine's own `sortCards`, and re-deriving that ordering here
  would be a second driftable copy of an engine rule — the exact defect class the
  straight-flush round already paid for once (the drifted `bombTier` copy).
  Grouping by value needs only equality, so there is nothing to drift.

EVERY HAND-CHANGE SOURCE VERIFIED (the owner's explicit requirement, not just
plays). Engine mechanism read FIRST, then the remap built to match:
  1. **Own play** — `index.ts:700-706,734`: `remaining.indexOf(card)` removes a
     MULTISET, hand re-sorted for the view. Committed slots known → exact.
  2. **Tribute pay** — `tribute.ts:376` → `moveCards`. Committed slot known →
     exact. (Swept.)
  3. **Tribute return** — `tribute.ts:448` → `moveCards`. Committed slot known →
     exact. (Named case; never fell to the swept seat — see honest note 1.)
  4. **Arrival** (this seat RECEIVES a tribute card) — the same `moveCards`
     pushes to the recipient, so the hand GROWS. No predecessor → MAIN. This is
     why the remap had to handle growth, not only shrinkage.
  5. **Anti-tribute — NULL RESULT, diagnosed:** it does not change the hand at
     all. `moveCards` has exactly TWO callers (`:376`, `:448`), and the
     anti-tribute path only READS hands for the big-joker reveal check
     (`tribute.ts:123-133`) before returning a decision/anti outcome. Nothing to
     remap, so nothing was written for it — verified absence, not an oversight.
  6. **Fresh deal / seat switch** — reset to `null`. (Swept.)

TESTS (tests/unit/client/hand-areas.test.ts, 20 cases) — HOUSE IDIOM, a custom
seeded playout harness driving the real GuandanGame, exactly like
obligations.property.test.ts. **No fast-check**: there is no property-testing
library in this repo and its absence is a stated decision; both external design
proposals sketched `fc.commands` and neither had read that header.
  • **Named twin regression + its NON-VACUITY.** Two 5S, one in MAIN and one
    anchoring a shelved straight flush; play the MAIN one. With the commit the
    shelf survives whole; the sibling test asserts that the identity-blind path
    really does dismantle it (`main:'5S', shelves:['6S,7S,8S,9S']`), so the pin
    cannot silently stop proving anything.
  • Stale-commit rejection, tribute ARRIVAL into MAIN, the atomic
    leave-and-arrive exchange, and twins in the SAME shelf being order-independent.
  • Progressive disclosure at model level: null-in/null-out, same-instance return
    on an unchanged hand, reset on seat switch and fresh deal, and — the exit —
    emptying the last shelf returns to `null`, so getting back to exactly-today is
    always reachable.
  • No-silent-no-op: `moveWouldChange` gates every control; pinned for an empty
    selection, for a refused mint at the cap, for moving cards already in the
    destination, and that the ESCAPE (put it back) is always a real change.
  • **Front-end-only source ratchet**: the module's imports must be exactly
    `['../../engine/guandan/cards', './helpers']` and every one type-only, and the
    source may not contain fetch/WebSocket/store/act(/JSON.stringify/localStorage/
    useState/useEffect/document/window.
  • **THE PROPERTY** over operation SEQUENCES: six seeded playouts interleave
    random area edits (create/move/merge) with real engine steps, asserting the
    invariant after EVERY operation AND a CONSERVATION property — a shelf may
    lose only what was committed OUT OF THAT SHELF, and only MAIN may gain.
    Coverage floor asserts the sweep really exercised it: **293 area edits, 184
    observed twins-split-across-areas**, and the sources `ownPlay`, `tributePay`,
    `arrival`, `freshDeal`.

TWO HONEST NOTES:
  1. **`tributeReturn` was never exercised by the swept seat** across every seed
     tried, so it is deliberately NOT in the coverage floor — claiming it would be
     claiming coverage the run does not have. It is pinned by its own named case
     (the atomic leave-and-arrive exchange) instead.
  2. **The first CONSERVATION model was itself wrong, and the property caught it.**
     It subtracted the committed cards from every shelf, so a card committed out of
     MAIN was also deducted from a shelf holding its twin — the very value-blindness
     the fix exists to remove, reproduced in the checker, which then reported the
     correct implementation as broken. The model is now keyed per SOURCE AREA.
NON-VACUITY PROVEN BY MUTATION: making `remapAreas` ignore the commit (the old
identity-blind path) fails 3 tests including the property, at seed areas-1 step 5.

GATE (green): typecheck (4 tsconfigs) + unit **1188/1188 (50 files)**, up from
1168/49 + lint:hooks + build. Bundle unchanged.

DECISION 1 ANSWER — is the budget-aware third area implementable and predictable?
  • **Implementable: yes, with no model change.** `maxAreas` is already a
    PARAMETER of `applyMove`, not a constant, precisely so the UI computes the
    allowance and the model merely obeys.
  • **Predictable: only in a restricted form, and the naive version is
    pathological.** The two inputs to "does a third band fit" are fan height and
    desk height — and **the desk is loud exactly when a selection exists**, which
    is the precondition for pressing Set aside. A gate that reads desk loudness
    would therefore be most likely to REFUSE precisely at the moment of use.
    Recommended form: compute the allowance from the fan's QUIET-state geometry
    only, never during a selection; within a hand the hand only shrinks, so the
    allowance is MONOTONE — a third shelf can appear but never vanish mid-hand —
    and an existing shelf is never withdrawn. Monotonicity is what makes it
    predictable; a refusal still needs a visible reason (house rule).
  • **Not yet measurable.** Which hands actually admit three bands cannot be
    measured until the UI exists (a band's floor cost is ~87.5px whatever it
    holds, and 3 bands measured 402.2px against a column already at the fold). If
    the window turns out rare or erratic, that is the finding the owner
    pre-authorised — a clean two-area version beats a confusing three.

NEXT (UI phase): create control on the desk stage row beside `.gd-desk__clear`;
the seam OUT of variant D's 14px lift strip and INTO the tap-target sweep's
measured coverage; the SF-finder rewire without the label inversion; then the
panel per owner decision 3.
