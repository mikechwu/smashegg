> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Silent-no-op round (2026-07-22) — item 2 (sit-then-name) BUILT local; item 1 (fan tap targets) MEASURED, mechanic AWAITING SIGN-OFF

Two playtest items, one root: the UI silently did nothing instead of
saying what it wants. Both presentation-only.

**Item 2 — sit-then-name: BUILT, committed locally.** The take-a-seat
button is never name-disabled (the NN/g anti-pattern was the bug): with a
name it one-taps exactly as before; without one it opens the ask ON THE
FELT DISC (research: poker's seat-first dialog; centered, never a
seat-anchored popover — the flank grid columns are ~75px at 390px) with
the chosen chip ringed, the input autofocused and prefilled from the
last-used name, an empty confirm explaining itself, and the race loser
told explicitly. ONE claim path (takeSeat → store.claim) for both orders
— the seat token mints exactly as before. Cross-lineage audit (Codex +
Grok; Grok ran the suite green): load-bearing question HELD, no HIGH;
the concurring MED (double-tap sent duplicate claimSeat — DO-safe but a
false failure read) fixed with a claiming lock + growth-only unwedge +
disconnect parity; docs/audits/sit-then-name.md. Ratchet: lobby.test.tsx
(the blank-name-never-disables regression, sitIntent routing, single-
claim-path pins, the ask's render states, the lock). Live: 11/11 zh-Hant
checks at TRUE 390×844 incl. all four seat positions and a real
two-client race. Gate 1019/1019 (42 files) + typecheck + lint + build.

**Item 1 — fan lift occlusion: MEASURED, no code shipped.** A Playwright
harness swept all 27 selections × 27 tap-target measurements per variant
at true 390px (docs/research/fan-tap-targets.md). Diagnosis: the −14px
lift halves the tappable strip of the card above it in its pile (700 →
350px²). Variants measured: owner's gap-open A′ (good on area, but moves
the elder's NEXT tap targets — the documented fisheye failure mode);
ring-only B (zero victims, loses the lift); solo −8px C (still −25%);
**hit/paint-decoupled D (recommended): zero victims, targets byte-stable,
the current visual unchanged — the production-DDZ pattern, ~4 CSS lines.**
Owner decision F1–F3 delivered in chat; build on sign-off.
