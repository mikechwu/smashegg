# Define "reachable" for a scrolling phone card table

You are one of two independent proposers on a **definition** question. You are NOT reviewing
anyone's answer — no answer exists yet in this brief, deliberately. Produce your own framing from
the code and the situation below.

**No web research.** Firecrawl is disabled in this project (credit limit reached 2026-07-13) and you
do not need the web for this. Work from the repository you have been given. Do not modify it.

## The product

A four-player online Guandan (掼蛋) table. React + TypeScript client. Phone-first: the primary
target is a 390px-wide phone. Start with these files:

- `src/client/GameTable.tsx` — the table screen. Note `ScrollActionsIntoView` near line 134.
- `src/client/table/TableHeadline.tsx` — the top bar
- `src/client/table/TrickWell.tsx` — the cards on the table
- `src/client/table/HandFan.tsx` — the player's hand
- `src/client/table/PlayDesk.tsx`, `src/client/table/ActionBar.tsx` — the play controls
- `src/client/table/table.css` — layout
- `docs/research/METHODOLOGY.md` — this project's measurement discipline. Practices 11, 12, 14, 15,
  16, 24 and 26 are the ones most likely to constrain your answer. Read them; a proposal that
  violates them will be discarded.

Vertical order on a phone, top to bottom: a headline bar carrying both teams' level badges and the
turn sentence; a ring with the three other players around a centre; the centre holds the trick well
(the cards you must beat); below the ring, the player's own hand as a fan; below that a "play desk"
and an action row with Play / Pass.

## The situation

1. The column is TALLER than a phone viewport. At a real inner height the action row is below the
   fold. `ScrollActionsIntoView` fires `scrollIntoView({block:'nearest'})` when it becomes the
   player's turn, so the action row is scrolled into view automatically.

2. The metric this project used to gate layout changes was: *"on what fraction of deals is the
   Play/Pass row below the fold at scroll position 0?"* That metric is now **void for the phone**.
   It had been measured at an inner viewport of 390x844. 844 is a phone SCREEN size; a browser with
   its toolbars presents about **664** of inner height (about 748 with toolbars minimized). At those
   real heights the answer is 100% on every deal for every candidate layout — so the metric has no
   discriminating power left. It cannot rank two designs.

3. Several pending design decisions were being ranked by that dead metric and now have no basis:
   - a "cards set aside" indicator that could be 24px or 44px tall (44px is the platform's minimum
     press-target size; 24px is smaller but takes less vertical space);
   - whether a secondary surface should be a modal OVERLAY covering the table, or an inline
     COLLAPSED strip that pushes the rest of the layout.

## The question

**What property should replace it?**

Concretely: on a layout that is taller than the viewport and that auto-scrolls a control into view,
what does it mean for the interface to be adequate? An auto-scroll guarantees the control is
*reached*. It guarantees nothing about the rest. Say what else has to be true and why.

## Deliverable — use exactly these headings

### 1. THE DEFINITION
One paragraph. The property, stated so that it is falsifiable.

### 2. THE SET
The concrete UI facts your definition covers, as a list. For each: the CSS selector or component,
one sentence on why a player who cannot see it cannot decide correctly, and — if your definition
uses tiers — which tier and why. Justify EXCLUSIONS too: name at least two things a reader might
expect on this list that you deliberately left off, and say why.

### 3. THE MEASUREMENT
How to measure it headlessly with playwright against a real dealt hand. Be specific: what you
query, in which coordinate space, at what moment relative to the auto-scroll, and what statistic
you print. This project has been burned by viewport-vs-document coordinates and by medians used for
floor properties — say which you use and why.

### 4. WHAT MAKES IT FAIL
The pass/fail condition, as an inequality or a predicate. State whether it is a structural property
(derivable, no sampling needed) or a sampled rate (and then: what n, answering which question).

### 5. WHAT IT DOES NOT CATCH
Be honest and specific. Every metric has a blind side; name this one's. Also name anything that
genuinely requires a real device and a real person, which a headless run can never settle.

### 6. HOW IT RANKS THE PENDING DECISIONS
Apply your property to the two decisions in "the situation" item 3. Does it separate 24px from 44px?
Does it put an overlay and a collapsed strip in the same currency, or are they still incomparable?
If your property cannot rank them, say so plainly — that is a real finding, not a failure.

End your report with a single literal line:

    PROPOSAL COMPLETE: <N> sections
