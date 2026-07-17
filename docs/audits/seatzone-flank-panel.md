# Seat-zone flank round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff moving the seat NAME to each player's
right-hand side (top-view handedness) with the COUNT chip on the cards' other
side, turning PASS into a transient ~2s fade over the passer's cards, seating
the countdown chip directly beside the turn sentence (plus an own-turn twin
above the sort pill), and unifying the ceremony/cut/deal card size+style with
the playing cards (all hand-size).
Producer: Claude. Auditors: Codex + Grok, isolated clones, identical brief
(`BRIEF-FLANK.md`), gate re-run by each. Producer did not audit its own
change.

Live verification before the panel (390/1456 en + 390 zh-Hant, full drive:
cut → ceremony → deal → play → pass): flank rects correct and on-screen on
all seats; pass fade opacity 1 → 0 (~3s) on the passer's block only;
headline chip 8px after the turn sentence; handclock on the actor's own tab;
cut/ceremony/deal/fan card widths equal (50.7px @390, 68px @1456). One live
find, pinned then fixed pre-panel: at 390 the north [pill, cards, count] row
first GREW the ring grid past the viewport (east shoved off-screen), and a
plain min-width:0 squeeze then crushed the pill to a bare dot — resolved by
hanging north's flanks absolutely (right:100% / left:100%, width:max-content)
over the ring's empty corner cells so the centre track only ever sees the
block.

## Round 1

### Grok — 1 HIGH + 5 MED + 4 LOW (gate in its clone: 910/910 + tc/lint/build PASS)

- **H1 — reduced motion made PASS invisible.** Base opacity 0 + the blanket
  `animation: none !important` meant a reduced-motion user never saw a pass
  at all (the old pill chip was static-visible). **ACCEPTED.**
- **M2 — north flanks always absolute:** finished/hidden/held zones anchor
  the pill (and "—") to a collapsed ~0×0 box. **ACCEPTED.**
- **M3 — fade replays on zone remounts** (rendered from durable
  `derived.passed`; a seat-tab switch after the fade has let go replays the
  2.8s run). **ACCEPTED** (== Codex MED 1 — converged).
- **M4 — hidden-count pass floats over an empty box** (no cards to fade
  over). **ACCEPTED.**
- **M5 — east/west in-flow pill+count re-add side-column height vs the lap
  era.** **REJECTED (as designed):** the owner's items 1-2 explicitly place
  the name at the strip ends and the count opposite — in flow beside the
  cards IS that instruction; the lap (name ON the cards) is what he removed.
  Live-verified at 390×844: hand + actions + bottombar still above the fold.
- **M6 — T13 has no rendered pass pin.** **PARTIALLY ACCEPTED:** the fold is
  only reachable through a layout effect (static renders run no effects), so
  the pin splits into foldEvents unit tests + exact render-gate source pins
  + the reduced-motion CSS pin.
- **L7 — ceremony min-height stale for mini** (inert 3.75rem floor).
  **ACCEPTED** (dropped). **L8 — useless pass key.** **ACCEPTED** (removed).
  **L9 — long-name north flank can clip at 390** (escalated by Codex to MED
  — same finding). **ACCEPTED.** **L10 — deck depth shadows fixed-px.**
  **ACKNOWLEDGED, KEPT** (the lacquer slab art is deliberately px-crisp).

Grok verified clean: the handedness table (all three dirs match the owner's
right-hand rule and R10), headline chip beside the sentence, handclock gates
(remote/ceremony/concealed quiet), SeatCount tiers/aria, item-5 lockstep,
ribbon arithmetic at 390, no double-clock beyond the owner's explicit ask.

### Codex — 0 HIGH + 2 MED + 0 LOW (gate: tc + lint pass; vitest/build EPERM
in its read-only sandbox — environment, as every round)

- **MED 1 — the same fade-replay finding** (tab-switch remount replays a
  stale pass), with the sharpened note that RECONNECT was already safe (the
  store drops event batches on resync — so the defect was remount-only).
  **ACCEPTED.**
- **MED 2 — the north flank can start ~10px off-table at 390 with max-width
  names** (long east/west pills widen the side columns, squeezing the centre
  track under the table's overflow-x clip). **ACCEPTED.**

Codex verified clean: the handedness mapping, reconnect fade safety, the
clock gates, and the size unification (including the ribbon token lockstep).

## Fixes applied (producer)

1. **Reduced-motion static pass** (H1): the reduce media block re-asserts
   `.gd-seatzone__pass { opacity: 1 }` — static, no motion; fix 2's
   wall-clock unmount keeps it transient anyway. CSS pin added.
2. **Wall-clock fade gate** (M3/Codex M1): SeatDerived gains
   `passedAt: Partial<Record<Seat, number>>`, stamped `Date.now()` on the
   'passed' fold and cleared on trickWon / handStarted / played; the render
   gate is `hasStack && now − passedAt < 3000` (the 500ms tick unmounts it
   right after the 2.8s run); the per-seat key removed. foldEvents unit
   tests + source pins added.
3. **--flanked gate** (M2 + M4): the zone advertises `gd-seatzone--flanked`
   exactly when it renders a sized block (SeatStack's own gate); north's
   absolute flank selectors require it, and the stackwrap + fade render only
   under it. Integration pin: settled zones flanked; a finished north keeps
   badge-only flow (no wrap, no chip, no flank).
4. **Phone flank cap** (Codex M2/Grok L9): the north flank pill carries
   `max-width: min(9rem, calc(50vw - 5rem))`. Pinned.
5. **L7/L8 fixed** (min-height dropped, key removed); **M5 rejected** and
   **L10 acknowledged** as recorded above.

Post-fix gate: **913/913**, typecheck, lint:hooks, build clean; live re-drive
at 390 [en]: fade opacity 1 fresh and the element fully UNMOUNTED ~3s later
(tighter than round 1's fill-forwards ghost), flanks on-screen, clocks and
card widths unchanged.

## Round 2 (fix re-audit)

Both auditors re-checked every disposition on refreshed clones
(REAUDIT-FLANK.md).

- **Codex — CLEAN: no HIGH, no MED, no LOW.** Confirmed all seven
  dispositions with file:line cites (reduce-block cascade position, the
  passedAt fold + gate + no key, the --flanked gate incl. deal frame-0 via
  the reservation, the phone cap, the as-designed east/west columns, the
  split pass pins, the two fixed LOWs + the kept shadow art). New-defect
  hunt: nothing — "passedAt shape not mutated unsafely, resync batches
  still do not restamp replay state". Gate: typecheck + lint pass;
  vitest/build EPERM in its read-only sandbox (environment, every round).
- **Grok — dispositions 1-7 ALL CONFIRMED (its gate: 913/913 + typecheck +
  lint + build PASS), one RESIDUAL MED + one comment-drift LOW.** The
  residual: the pass fade's ~3s unmount rode the deadline-driven `now`
  tick — in an UNTIMED room no interval runs, `now` freezes, and under
  reduced motion the static PASS stays visible until the trick clears.
  **ACCEPTED + FIXED**: the tick effect gained a pass leg — it runs while
  any passedAt stamp is < 3.5s old and SELF-EXPIRES once deadlines are
  empty and every stamp has aged out (no perpetual idle tick); the
  overclaiming comment corrected; T13 source pins added. Gate re-run
  913/913 + tc/lint/build.

## Round 3 (targeted — finder verifies the tick fix)

- **Grok — CONFIRMED on all four checks, no new defects.** (a) The pass leg
  unmounts the fade ~3s after a fold in a deadline-free room, reduced
  motion included (code-path proof + fold unit + T13 pins; no fake-timer
  mount test — the suite's DOM-free policy). (b) Self-expiry holds: idle
  untimed rooms arm NO interval (latestPassAt 0 → early return), a fresh
  pass runs one interval that clears itself at stamp-age 3.5s, and the deps
  never re-arm it. (c) Deps/closures clean — no stale capture, no leak, no
  double interval (Strict-mode double-mount cleaned), no restart after
  self-clear. (d) Gate: 913/913 + typecheck pass. Benign notes: one final
  setNow may fire in the 3-3.5s slack (intentional), background-tab timer
  throttling can delay the unmount (pre-existing browser behavior).

## Verdict

**Clean.** Three rounds: round 1 converged on the fade-replay defect (Codex +
Grok) plus Grok's reduced-motion HIGH and the flank-gating/clip MEDs — all
fixed and pinned; round 2 confirmed every disposition (Codex fully clean)
and Grok caught one sharp residual in its own accepted fix (the untimed-room
unmount clock); round 3 (finder-verifies-fix) confirmed the tick leg with no
new defects. One rejection stands as designed (east/west in-flow flanks are
the owner's explicit placement; fold verified live). Gate: 913/913 +
typecheck + lint:hooks + build, green locally and in Grok's clone across all
three rounds; live-driven at 390/1456 [en] + 390 [zh-Hant] through cut →
ceremony → deal → play → pass, before and after each fix wave.
