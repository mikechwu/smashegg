> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Seat drawer BUILT (2026-07-22) — item 1b per P1–P3 + the guard-4 composite closed — deployed with the round

The sit-then-name ask relocated from the felt disc into a full-width
DRAWER row inserted into the lobby grid adjacent to the pressed seat
(top slot for seat 2, mid slot otherwise — the bottom seat opens ABOVE
itself, P2), with the connector nub ON the pressed chip (correct by
construction; seat 0 points up), the matching cinnabar ring, a pressed
FLANK chip sliding to meet its drawer, the disc keeping the room code
untouched, a 200ms one-shot open (instant under reduced motion), and a
16px input — which fixed a live iOS-zoom bug (the old 14.4px input).
SitAskPanel moved wholesale: claim path, lock, race handling, prefill
all carried (every prior seating pin passed unchanged).

Guard 4's cumulative audit (Codex + Grok, composite call graph as
evidence; Grok ran the suite green): the three-round seat path is
LOAD-BEARING SAFE — exactly one claim funnel, token minted once by the
unchanged DO path — and the whole-path re-look surfaced THREE real
composite holes, all fixed + pinned: the retarget lock leak (a new ask
session resets the claiming lock), the orphan drawer (a direct claim
supersedes any open ask), and Codex's in-flight prefill window (both
claim paths stamp lastClaimAtRef; the ask-open widens holds-a-seat with
a <10s fresh-claim signal, so a just-claimed identity can never prefill
the next ask during the roster echo). docs/audits/seat-drawer.md.

Live (zh-Hant, TRUE 390×844 + desktop + reduced-motion): 7/7 — all four
positions adjacent at a 10px gap with correct nub directions, chip
ringed + on-screen, code visible, 16px focused input, the drawer flow
seating through the same claim path. **Guard-3 boundary stated: iOS
soft-keyboard occlusion is NOT iframe-verifiable — an M5 device check.**
Gate 1043/1043 (43 files) + typecheck + lint:hooks + build.

**The batched M5 elder session (one iPhone sitting answers all):** the
play-desk reflow read; dual-render "how many nines"; variant-D
top-of-lifted-card unselect; the drawer disorientation read (guard 1 —
does the row opening say "type here for THIS seat" or "the seats
moved"); iOS keyboard occlusion (guard 3).
