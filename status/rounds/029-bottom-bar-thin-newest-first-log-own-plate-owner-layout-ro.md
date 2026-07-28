> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Bottom bar: thin newest-first log + own plate (2026-07-16) — owner layout round — local, unpushed

Owner's annotated screenshot: the event log moves to the page BOTTOM and gets thin (newest
2 lines always visible, scroll for history), the OWN seat plate joins it on the same line,
and the hand rises toward the table; mobile must get better, not worse.

Built (Sonnet workflow + three-lens review; 816/816 green, typecheck + lint:hooks clean):
- GameTable: the ring's south slot is GONE (grid collapsed — the ring is genuinely shorter);
  .gd-handzone order is sortrow -> HandFan -> ActionBar -> .gd-bottombar [own SeatPlate +
  EventFeed], the plate keeping identical props (timer, pass tag, active ring, badges).
- EventFeed: renders newest-FIRST (render-layer reverse; the fold stays oldest-first so no
  test semantics changed), no scripted scrolling (newest is at the top by construction),
  FEED_LIMIT 6 -> 20 for real scrollback, aria-live=polite kept and role="log" deliberately
  NOT used (it implies additions at the reading end — a comment records the choice).
- CSS: .gd-bottombar flex row (plate flex:none, feed flex:1 min-width:0); .gd-feed
  max-height = exactly 2 lines + padding, overflow-y auto.

Review finding (MED, found by two lenses from different angles, fixed): the feed max-height
calc assumed border-box but the element was content-box, so the "exactly 2 lines" box
actually showed 3 (measured live pre-fix: 58.4px vs the documented 46.4px) — fixed with
box-sizing: border-box; post-fix computed maxHeight == rendered height == 46.4px.

Visual verification (locale stated with width): desktop 1422 [zh-Hant] + true 390 iframe
[zh-Hant]. Verified: ring 3-plates only, hand visibly adjacent to the table; bottom bar
top-aligned plate+feed on one line; feed NEWEST-FIRST live (the hand-start line rendered
above the older cut line; a fresh session's play event prepended); feed box exactly 2 lines
(46.4px border-box, measured); zero horizontal overflow at 390 (scrollWidth 375); the
bottom-bar plate carries the cut-phase timer + active ring (verified as the cutter seat).
Note observed, not a defect: a second same-origin tab/iframe takes over seat delivery
(token takeover by the newest hello), freezing the older tab's feed — pre-existing
documented multi-tab behavior.

Suite 816/816; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.
