> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The transient question dissolves the occlusion trade — and one must-see fact IS lost while expanded (2026-07-27)

### Answering the transient question first was right: it changes the design

The shelf's EXISTENCE and the UI showing its cards are separable, and measuring
that separation makes the overlay almost unnecessary. n=12, inner 390×844, fold
844, **with a play actually on the table** so the well has something to occlude:

| | fan | Play med | Play worst | below fold |
|---|---|---|---|---|
| today | 389.6 | 920.9 | 947.1 | 11/12 = 91.7% [64.6, 98.5] |
| overlay UP (expanded) | 252.1 | 783.4 | 809.6 | **0/12 = 0.0%** [0, 24.2] |
| **collapsed 24px, in flow** | 276.1 | 807.4 | **833.6** | **0/12 = 0.0%** [0, 24.2] |
| collapsed 32px, in flow | 284.1 | 815.4 | 841.6 | **0/12 = 0.0%** [0, 24.2] |
| collapsed 44px, in flow | 296.1 | 827.4 | 853.6 | 2/12 = 16.7% [4.7, 44.8] |

**A collapsed in-flow indicator closes the gap with ZERO occlusion.** No overlay
is needed for the fold at all. The overlay is then only for the moment the
player is actively organising — a cost they chose, at a moment they are not
watching the table.

**But the press floor is what costs the fold, and that is the real trade.** The
collapsed indicator has to be pressable to expand:

- **24px**: 0/12, worst 833.6, **10.4px of margin**. Below this project's
  standing "every press ≥44px".
- **32px**: 0/12, worst 841.6, **2.4px of margin** — and this time that is a
  worst case within one sample, not a median across two.
- **44px** (meets the floor): **16.7% [4.7, 44.8] below fold.**

There is a defensible distinction available: the `.gd-fan__runTag` precedent was
raised from 26px to 44px because both audit lineages rejected an area-based
argument **for a destructive control**. "Expand the shelf" is not destructive, so
a full-width 24px bar (≈8200px² at 342px wide, well past WCAG 2.5.8 AA's 24px)
may be acceptable where the seam was not. **That is a decision, not a
measurement, and it is the owner's.**

### Semantic occlusion of the expanded overlay — one must-see fact IS lost

Measured per element as fully-hidden vs partly, not as pixel extents (n=12):

| must-see element | instances | fully hidden | partly | worst coverage |
|---|---|---|---|---|
| trick-well CARDS ("what I must beat") | 4 | **0** | 5 | 39% |
| opponents' card counts | 3 | **1** | 0 | **100%** |
| seat plates | 4 | **1** | 0 | **100%** |
| seat card-back stacks | 3 | 0 | 2 | 50% |
| headline (turn / clock) | 1 | **0** | 0 | **0%** |
| team level badges | 2 | **0** | 0 | **0%** |

- **The cards you must beat stay readable** — no well card is fully hidden, worst
  39% coverage.
- **The loudness spine fully survives** — headline, turn sentence, clock and team
  badges at 0% coverage, as claimed.
- **One opponent's seat plate AND card count are fully hidden.** That is a
  genuine must-see fact: F11 made the counts value-dependent precisely because an
  opponent at 2 cards changes every decision. **Reported rather than waved past**,
  per the instruction to bring the finding if any must-see fact is lost.

It is the ring's BOTTOM edge that gets covered, which on the phone is where the
west/east plates and counts sit. Mitigations exist (shorten the expanded
overlay, or give the ring bottom padding) and are unmeasured.

### Two claims qualified, as asked

- **"On the phone a shelf becomes free"** → *free in VERTICAL BUDGET, paid in
  table occlusion while the overlay is open — and with a collapsed default, paid
  only for the seconds the player chooses to expand it.*
- **Desktop side-by-side + phone collapse/overlay is TWO interaction models for
  one feature.** Measurement forced it (the 390px refutation of side-by-side
  still holds), but it is a deliberate divergence with a standing cost: two
  models to maintain and verify forever, and family members on different devices
  see different things. Elder-session items that now need checking on BOTH: does
  the seam still read as "close this shelf"; are the two areas distinguishable at
  a glance; does recall-to-MAIN read the same; and on the phone additionally
  whether the collapsed state reads as "I have cards set aside" and whether the
  expanded overlay's occlusion is noticed or confusing.

### The seam finding, and why the additive path is rejected for a better reason

`HandFan.tsx:493-501` records that the seam row sits above the next band's lift
headroom **so variant D's near-miss resolves onto inert padding rather than onto
a destructive button.** That 50px is a safety mechanism, not chrome.

**So the additive path's primary rejection is SAFETY, not arithmetic.** Two of
its three components — the 14px lift reserve and the seam row — are load-bearing
for the near-miss property. Recorded that way deliberately: an arithmetic
rejection invites "we're only 9.6px away", a safety one does not.

**Second time a source comment has stopped a plausible simplification** (the
first was the nine clamp sites). Now METHODOLOGY practice 23: check whether the
source records why a thing exists before removing it — and write down why AT THE
SITE when you build something whose purpose is not visible from its shape.
