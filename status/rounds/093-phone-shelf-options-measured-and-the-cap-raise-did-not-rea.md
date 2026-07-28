> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Phone shelf options measured, and the cap raise did not reach 1280 (2026-07-27)

### THE PHONE OPTIONS — decomposed first, then measured

Option A recovering only 29.5px of ~137px said the cost is not in the card
faces. Decomposing it per component (n=8, inner 390×844) says where it is:

| component | height |
|---|---|
| shelf band | **87.5px** — of which run cards 73.5 + 14px variant-D lift reserve |
| seam row | **44px** + 6px margin = **50px** — pure control chrome |
| MAIN shrinking (one fewer wrap line) | −21.3px |
| **net** | **+116.2px** |

That explains option A exactly: capping the card faces at 44px attacks only the
73.5px, and 73.5 − 44 = 29.5. **The decomposition predicted the negative result
it was built to explain**, which is the sign it is right.

Options measured against it, n=12 deals, 3-card shelf, inner 390×844:

| option | fan | Play doc | recovered | below fold |
|---|---|---|---|---|
| none (today) | 389.6 | 925.9 | — | 12/12 = 100% [75.8, 100] |
| **A** collapse faces to 44px | 360.1 | 896.4 | 29.5px | 12/12 = 100% |
| **B1** seam beside the runs | 383.6 | 919.9 | 6.0px | 12/12 = 100% |
| A + B1 | 354.1 | 890.4 | 35.5px | 12/12 = 100% |
| **B2** shelf as an OVERLAY | **252.1** | **788.4** | **137.5px** | **0/12 = 0.0%** [0, 24.2] |

**B1 is a NULL RESULT, not a refutation — with a diagnosis.** It recovered only
the 6px margin, because my injection did not actually move the seam beside the
runs: the shelf band and the seam row are siblings in the fan's column, so
making the seam inline does not re-parent it. Properly measuring seam-beside
needs a markup change, and it is worth doing — it is the second-largest item in
the decomposition.

**B2 closes the gap completely and costs something severe.** Play lands at
788.4, *better* than the 809.6 with no shelf at all (MAIN loses a wrap line).
But measured: the overlay covers **131.5px of MAIN's 252.1px and occludes 21 of
24 MAIN cards** while open. You cannot see the hand you are choosing from.

**Recommendation: option C**, accepting the scroll — under the sharpened
condition below, a scroll that follows the player's own deliberate press is safe,
and a scroll is a smaller cost than hiding 21 of 24 cards. B1 deserves its real
measurement before anything is built.

### The 78rem raise did not reach 1280 — the binding term is neither cap

Verified, and the owner's inference was right in conclusion and understated in
degree: at inner 1280 the hand zone is **1180.8px**, bound by the **PARENT
CHAIN** (96vw − 32px `.app-main` padding − 16px `.gd-table` padding), not by
94vw (1203.2) and not by 78rem (1248).

| inner | parent chain | 94vw | 78rem | zone | vs the 1207.2 bound |
|---|---|---|---|---|---|
| 1024 | 935.0 | 962.6 | 1248 | 935.0 | wraps by 272.2px |
| 1280 | 1180.8 | 1203.2 | 1248 | **1180.8** | wraps by 26.4px |
| 1350 | 1248.0 | 1269.0 | 1248 | 1248.0 | clears |
| ≥1400 | — | — | 1248 | 1248.0 | clears |

**So 74rem → 78rem changed nothing below inner 1350.** Lifting the vw term would
not have helped either. Reclaiming `.gd-table`'s own padding would give 1196.8 —
still 10.4px short — and reclaiming `.app-main`'s too would push the zone
outside `.gd-table`, which the containment gate would (correctly) fail.

**Measured wrap rate at inner 1280×800: 0/48 splits = 0.0% [0.0%, 7.4%]** (4
shelf sizes × 12 deals; max ink observed 928.5px against 1180.8 available). So
the worst case is reachable in principle and was not reached in 48 measured
splits. Recorded as a rate, not as "it fits".

**And the fallback preserves correctness, not the benefit.** When wrap fires the
layout falls back to banded — which at 1280×800 is 100% below fold. That is a
distinction worth keeping: the content-responsive fallback stops the overflow, it
does not keep the feature working.

### The bound's dependency is now pinned in both directions

The 1207.2px bound rests on *"a recorded group comes only from the straight-flush
finder, and a straight flush is ≥5 cards"* — **behaviour, not an invariant.**
`GameTable`'s `onSetAside` now carries a note saying that recording a group there
would collapse the run bound and push the maximum to 1389.6px, past the cap; and
the test re-derives the bound from `MIN_GROUP` and **executes** the citation by
asserting the handler still calls `applyMove` and not `applyMoveAsGroup`.

### Two practices, both paid for this round

- **19 — a bound is only proved if its derivation cites a fact that CONSTRAINS
  the system.** "12 cards in 6 groups" is a scenario; "groups come only from the
  finder and a flush is ≥5 cards" is a constraint. A scenario passes review
  precisely because it looks derived.
- **20 — "no moving target" means no movement between COMMITTING to a reach and
  COMPLETING it**, not no movement during a turn. Movement following the
  player's own deliberate press is safe; movement arriving unbidden is not. This
  is what makes option C viable. Confirmed non-A′ for the shelf: set-aside moves
  the whole selection in one `applyMove`, so a send is **one** reflow, never one
  per card.
