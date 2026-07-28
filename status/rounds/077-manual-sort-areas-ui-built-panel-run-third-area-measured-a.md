> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Manual sort areas — UI BUILT, panel run, THIRD AREA MEASURED AWAY (2026-07-24)

The UI on the pinned model. Both audit lineages ran against the built tree and
both found real defects; all are fixed and pinned. Record:
docs/research/sort-areas.md §7b.

WHAT SHIPPED (behind zero-area absence, so a never-user sees almost none of it):
  • **Bands + seam** (HandFan). `areas === null` takes the byte-identical path —
    one `.gd-fan__stackRow`, no wrapper class, no seam. Split mode renders one
    band per area, MAIN LAST (nearest the desk), each shelf closed by a SEAM: a
    full-width 44px button that is the shelf's only control.
  • **The seam's action is a pure total function** (`seamAction`): cards lifted
    outside → moveHere; the whole shelf lifted → putBack; anything else →
    selectAll. The third branch is what makes a PARTIAL shelf selection safe —
    it cannot fall through to a no-op move.
  • **Create control on the desk stage row** beside one-tap clear (the
    measurement-validated home; both actions-row cells were refuted last round).
  • **SF finder unified** onto the same `applyMove` — no second staging path.

### THE THIRD AREA: MEASURED AND REMOVED
End-to-end on the built UI at true 390x844, zh-Hant, driving the real controls
across 8 real dealt hands: **second band reached 8/8, THIRD band reached 0/8**,
refused on every deal at every column count 11-15, with the reason shown. Play
stayed above the fold 8/8 (834.6-835.4) but by only ~9px.
  Also corrected honestly: **a shelf is not the cheap +14px case in practice.**
  §3.3's +14px assumed a split keeping both bands under the 9-column wrap;
  pulling a few cards usually leaves MAIN still over it, so the shelf adds a
  whole line — fan 294.7 -> 432.2, **+137px**. The earlier figure was the best
  case, not the common one.
  **`AREA_HARD_MAX` is now 2**, under the owner's standing authorisation ("if
  the window is rare or erratic, report it and fall back to two"). A rung that
  never opens is worse than an absent one. COSTS STATED, NOT HIDDEN: merge needs
  two shelves, so **merge is unreachable at this cap and the ladder has one
  rung**. `mergeAreas` stays in the model, tested but not UI-reachable.
  NUANCE FOR THE OWNER: the allowance reads `window.innerHeight`, so a desktop
  viewport WOULD open the third. The cap makes the model one thing everywhere
  rather than a feature that exists on desktop and never on the reference
  device — a judgement call, flagged not buried.

### PANEL (owner decision 3 — disclosed split)
Claude produced the model AND the UI, so BOTH external lineages are clean
auditors of it. Codex 3 findings, Grok 6. Every one fixed and pinned:
  • **Codex HIGH — the commit was consumed too early, silently reintroducing the
    twin defect this whole round exists to fix.** The reconciliation effect has
    NO dependency array, so it runs on every render — including the one `act()`
    causes by clearing the selection, BEFORE the server replies. That render
    consumed and nulled the commit; the real hand change then fell back to the
    identity walk. Fixed: the commit is held until `commitIsResolved(prev, ctx)`
    — extracted as a PURE predicate precisely so this is behaviour-tested rather
    than pinned by a comment in a React effect.
  • **Grok HIGH — server-originated removals have no commit at all**, and my own
    property harness could not have caught it: it only ever committed for
    actions it applied itself. An AFK seat's `defaultAction` (auto-played lead,
    timed-out tribute) removes cards with no `act()` call, so the fallback ran —
    and dismantled the shelf. Fixed by SHELF-FIRST tie-breaking in the fallback
    walk: when copies of one value compete for fewer survivors, MAIN gives one
    up before any shelf. Justification, not a hack: the engine removes by
    multiset (`remaining.indexOf`), so which twin left is NOT a fact of the
    matter even server-side; given a free choice, preserve what the player
    deliberately built.
  • **Grok MED — at the cap, a button reading "set aside" did not set aside.**
    With one shelf and `AREA_HARD_MAX = 2` it could not mint a second and had no
    fallback. Fixed with `setAsideDestination`: a new shelf while the budget
    allows, otherwise JOIN the existing shelf; null only when not even one fits,
    which is the single case where refusing (with a visible reason) is honest.
    Same label-vs-effect class as the finder's old MAIN fallback, reached from
    the opposite direction.
  • **Grok MED — progressive disclosure leaked to never-users.** The "no room
    for another group" status could show to someone who never engaged with
    areas. Fixed: gated on `areas !== null`. CARRIED HONESTLY: the create button
    itself still appears for a never-user with a selection. That is the bounded,
    deliberate delta the design study named — a literal zero-new-pixels feature
    is undiscoverable — and it is now stated plainly rather than claimed away.
  • **Codex MED — the allowance could stick at 1 for a whole hand.** Two effects
    disagreed about order: the reconciliation effect's reset landed after the
    allowance effect had already ratcheted. Fixed by moving the ratchet reset
    INTO the allowance effect, keyed on the arrangement context.
  • **Codex LOW — the seam clearance comment overclaimed, and it was right.**
    The seam sits 20px from a card's HIT BOX, but the lifted FACE paints 14px
    above that, so clearance above the visible card is **6px, not 20px**.
    Comment, test and sweep now report the true numbers. Raising it to 20px
    costs another 14px of column, which measurement says pushes Play below the
    fold (~835 today with one shelf) — so it is a FLAGGED TRADE-OFF for the
    owner, not a silent change. What IS fully guaranteed and measured: no point
    inside any card resolves to a seam in any selection state.

### THE SWEEP NOW MEASURES THE SEAM (fix 1's second half)
`scripts/measure-fan-tap-targets.mjs` — the REQUIRED gate — builds a real shelf
through the real controls and sweeps that state too, so the destructive control
cannot hide in unmeasured geometry:
  `baseline px^2 min/median/max: 700 / 1000 / 3750`
  `PASS: seam state swept — 0 stolen points; gap to hit box 20px, clearance above lifted paint 6px`
  `PASS: zero victims across the full sweep`
The baseline spread is IDENTICAL to the documented variant-D baseline
(docs/audits/fan-variant-d.md), i.e. the fan's geometry is unchanged.

### TEST NOTE (honest)
Three existing assertions were REWRITTEN, not merely made green, because the
shelf-first fallback deliberately changed behaviour they pinned. In particular
the old "NON-VACUITY: the identity-blind path dismantles the shelf" no longer
distinguishes the two paths — the fallback is now correct for that case too — so
it was replaced by the case where the commit is still load-bearing: the player
deliberately playing the SHELF's twin, which only the commit can know.
`selection-survival`'s blanket-wipe pin went 2 -> 4 wipes; rather than bump the
count it now MATCHES EACH SITE individually, so a fifth unnamed wipe still fails.

GATE (green): typecheck (4 tsconfigs) + unit **1217/1217 (51 files)** +
lint:hooks + build + the fan tap-target sweep in BOTH states. Bundle 442.86 kB /
143.93 kB gzip (+5.5 kB raw over the pre-UI build).

STILL OPEN (not claimed as done):
  • **The elder session is the real gate for this feature** and has not run. Add
    to the batch: does the two-area model read as intended; is non-drag grouping
    discoverable; does zero-area truly feel unchanged. Batch with the already
    open items (play-desk reflow, dual-render "how many nines", variant-D
    top-of-card unselect, seat-bubble keyboard occlusion).
  • Drag was NOT built. All three design lineages independently found per-card
    drag unworkable at 390px against variant D; the owner's premise asked for
    both paths, so this remains an owner call, not a silent omission.
  • The seam paint-clearance trade-off above.
