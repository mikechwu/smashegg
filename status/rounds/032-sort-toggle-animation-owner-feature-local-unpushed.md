> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Sort-toggle animation (2026-07-16) — owner feature — local, unpushed

Owner feature: the asc/desc sort toggle should play the SAME cards-fly-to-their-new-slots
animation as the post-deal sort beat, for consistency.

Built inline (small, contained — the FLIP machinery already measures every card's rect each
render; the change widens its gate): the useLayoutEffect now animates on TWO re-lays — the
deal->sorted transition (unchanged) and a descending-prop flip (new wasDescending ref) —
with the same SORT_BEAT_MS duration/easing. Selection, reveal, and play-shrink renders stay
instant (the original design decision, restated in the updated comment). prevRects being
refreshed every render means a toggle spammed mid-flight starts from the mid-flight rects —
graceful by construction. Reduced-motion path unchanged (no animation).

Visual verification (locale stated with width): desktop 1466 [zh-Hant], animate-only
slow-motion x6. Captured MID-FLIGHT: cards visibly in transit between their ascending and
descending pile positions on toggle; settled state correct both directions with the toggle
label consistent (label shows the CURRENT order). Suite 828/828; typecheck clean;
lint:hooks clean. No new pin: the behavior is WAAPI-runtime (eyes-gated like the deal sort
beat it mirrors); the grouping logic it rides on is already pinned.

Committed locally; push only on the owner's word.
