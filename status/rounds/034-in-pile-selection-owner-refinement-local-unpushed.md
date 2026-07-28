> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## In-pile selection (2026-07-16) — owner refinement — local, unpushed

Owner refinement (two reference images): a PICKED card must stay in its pile — partially
covered like any strip — with the cinnabar border marking its visible portion, instead of
painting its whole face over the strips below it.

Built inline (CSS-only): removed the position:relative + z-index:1 promotion from
.gd-fan__card--selected and :hover (added in the packed-stacks round), so pile paint order
stays natural and later strips keep covering the picked card's body; the selection ring's
covered portion hides under the next card exactly like the reference. The lift shrank
-12px -> -6px: a small nudge kept deliberately as the NON-COLOUR selection cue (nothing
encodes meaning in colour alone) that pokes the strip's top edge without uncovering the
pile.

Visual verification (locale stated with width): desktop 1400 [zh-Hant], live room. Picked a
mid-pile strip (6-hearts, second of a 4-pile): it stays buried with the ring on its visible
strip and the -6px nudge applied (computed transform verified); the pile's lower strips stay
fully readable. One stale-CSS false alarm during verification (the browser served the
pre-edit stylesheet until reload) — re-measured on fresh CSS before concluding.

Suite 827/827; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.
