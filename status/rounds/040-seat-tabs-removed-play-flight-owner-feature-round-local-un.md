> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Seat tabs removed + play flight (2026-07-17) — owner feature round — local, unpushed

Owner directive: (1) remove the Seat 1-4 tab bar — verified first that it is PURE
client-local view switching for multi-seat self-play (renders nothing for a single held
seat, calls only setSelectedSeat) — clicking the name overlay selects the seat instead;
(2) playing cards animates like the deal: the pile count drops while the played cards fly
FACE UP from the pile to the table, 100% hidden at t0 behind the pile, appearing from its
back edge, unsorted in flight, each landing at its proper table spot.

Built: SeatTabs deleted whole (component, two render sites, all .gd-tabs CSS, the
seatTabsLabel key ×3 locales); SeatPlate gains optional onSelect — a HELD non-active
seat's pill renders as a real <button> ("Switch to {name}" aria, new i18n key ×3,
--held pointer/hover/focus affordances, PlateBody shared innards) wired to the SAME
setSelectedSeat. New PlayOverlay.tsx: the fold stamps playFx {seat, cards, at, id} on
every 'played' (cards are public), cleared on handStarted; rendered while !dealing ∧
!ceremony ∧ now−at<1600, keyed by fold id; the tick's fx leg (the pass-fade clock) now
covers playFx so untimed rooms expire it. Flight mechanics: origin = the pile's
table-facing edge (south = hand-zone top), targets = the well's fresh card rects; WAAPI
keyframes opacity 0→1 over the first 18% ("emerging from behind the pile"), deterministic
per-index jitter/tilt + 70ms stagger ("unsorted"), well cards visibility:hidden until
THEIR flight lands (the landing is the reveal), fill-both + display:none on finish (React
owns the nodes), unmount cleanup can never leave the well hidden, reduced-motion does
nothing, mismatched well bails. Layering: .gd-playfx fixed z-8 under the well's z-10.

Live-verified (390 en, pills only — no tabs exist): pill switching flips the bottombar
identity; south flight airborne while the well card hides then reveals on landing; REMOTE
flight captured (north pile 27→26, joker mid-air) via a mid-flight viewer switch.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-PLAYFX.md;
producer≠auditor): see docs/audits/playfx-panel.md. Gate 922/922; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.
