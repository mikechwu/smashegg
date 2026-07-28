> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-17)

Pushed f04dc0e..1d58f80 (13 commits: in-pile selection, lobby round table, seat-zone
realistic hands, two-row wrap, lapped rows + headline clock, flank layout + pass fade +
split clocks + one card size, tabs removed + play flight, covered-play physics, chooser
at hand size, compact headline, cut-by-hand, hand badge, seam fix) and deployed on the
owner's word. Pre-push gate: 932/932 + typecheck + lint:hooks + build. Verified live:
/api/health build == pushed HEAD (1d58f80a3bcff3ab5c7f2c139f8deae8f863dd3e), and a full
production smoke drive at 390 — room built over wss, seats claimed, drag-cut ON the cards
with the badge measured 0px from the DOM seam, settled table with three "27 cards" chips,
zero .gd-tabs, "Us level 2 / Them level 2" badges (numeral + wild chip absent), 3 held
switcher pills, and a play flight airborne with the well card hidden until landing.
Worker version b6eb674e-5cbe-442e-ac6d-fd1b2f1eabdd.
