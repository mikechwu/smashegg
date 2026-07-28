> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Play flight: covered-play physics (2026-07-17) — owner refinement — local, unpushed

Owner directive: while the new cards are flying to the table, the EXISTING cards on the
table must still be present (correct physics), and since the existing play can be LONGER
than the incoming set, the existing cards gradually fade out once the new cards cover
them.

Built: the fold tracks `topCards` (the trick's current top); 'played' stamps
`playFx.covered = topCards` then takes the top over; trickWon/handStarted clear both
(reconnect leaves topCards null → that one flight degrades to the old instant swap).
TrickWell renders `covered` as an underlay GRID-STACKED with the top row (both rows
grid-area 1/1; the well sizes to the LARGER, so a longer old play keeps its exact
width/wrap/pixels; neither row positioned, so DOM order is the paint order), KEYED per
flight (a reused element would inherit the fade class), only alongside a top, alive
exactly as long as the flight (2000ms gate / sweep-clears-playFx). PlayOverlay targets
ONLY the top row (`:not(--covered)`); the LAST landing (an airborne counter) adds
`--fading` (600ms opacity out — the old play's PROTRUDING cards are what the fade visibly
removes); the flight layer moved z 8 → 11 (over the well: with the covered play visible,
incoming cards must fly ABOVE it; the landing hand-off stays one task = one paint).
Reduced motion: no flight, underlay display:none. The grid stacking, the per-flight key,
and the last-landing fade are all panel round-1 fixes — both auditors CONVERGED on the
element-reuse and box-collapse HIGHs.

Live-verified (390 en, before and after the fix wave): single 3 covered by a single
Joker — mid-flight the underlay present at opacity 1, new top hidden, fx airborne;
post-landing --fading applied (caught mid-transition at computed opacity 0.016);
post-gate unmounted, top visible.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-COVER.md;
producer≠auditor): see docs/audits/cover-panel.md. Gate 925/925; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.
