# Covered-play physics round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff implementing the owner's play-flight
physics refinement — the play being covered stays on the table while the new
cards fly, then gradually fades once covered (its protruding cards being the
visible work when the old play was longer).
Producer: Claude. Auditors: Codex + Grok, isolated clones, identical brief
(`BRIEF-COVER.md`), gate re-run by each. Producer did not audit its own
change.

Verified live before the panel (390 en, a single 3 covered by a single
Joker): mid-flight the underlay present at opacity 1 with the new top hidden
and the flight airborne; post-landing the fade class applied and computed
opacity ~0; post-gate the underlay unmounted, top visible.

## Round 1

### CONVERGED — two HIGHs found by BOTH auditors

- **H1 — the imperative fade class survives element reuse.** The underlay's
  React className never includes --fading, so a back-to-back covering play
  (B covers A, C covers B inside the flight window) reuses the SAME div —
  React sees an unchanged className string and never rewrites it — and the
  imperatively-added class rides onto the next play's underlay, starting it
  INVISIBLE: the opposite of the owner's ask. **ACCEPTED.**
- **H2 — the absolute underlay does not keep a longer old play's pixels.**
  `.gd-well` is a shrink-to-fit flex item sized only by the IN-FLOW top row;
  a 10-card old play covered by a short new play collapses the well box and
  the inset-0 underlay re-wraps/re-centres inside it — precisely the
  longer-than-the-flying-set case the owner called out. **ACCEPTED.**

### Grok — additionally 2 MED + 1 LOW (gate in its clone: 925/925 + tc/lint/build PASS)

- **M1 — paint-order inversion.** A positioned z-auto element paints ABOVE
  in-flow siblings: the "underlay" actually painted OVER the top row —
  masked mid-flight (top hidden) but producing a ghost crossfade after
  landing instead of "new lands on old". **ACCEPTED.**
- **M2 — the first-landing fade is looser than the ask**: protruding old
  cards started vanishing while later staggered cards were still airborne.
  **ACCEPTED.**
- **L — the HIGHs were unpinned by the round's tests.** **ACCEPTED** (the
  fix pins below).

### Codex — the two HIGHs + refuted-suspicion notes (gate: tc + lint pass;
vitest/build EPERM in its read-only sandbox — environment, every round)

Confirmed clean: the target selector correctly excludes the underlay; the
jiefeng fold path (playerFinished keeps topCards, so the next play covers
the finisher's top); reconnect degradation matches the brief; a terminal
match's stale playFx has no well targets and stays inert.

## Fixes applied (producer)

1. **Keyed underlay** (H1): `key=covered-${coveredKey}` with coveredKey =
   the flight's fold id — a fresh element per flight, no inherited class.
2. **Grid-stack** (H2 + M1 in one move): `.gd-well` is a grid; both rows
   take `grid-area: 1/1` (with max-width 100% + min-width 0 so wrapping
   matches the old block behaviour) — the well sizes to the LARGER row, so
   the old play keeps its width/wrap/pixels, and with NEITHER row
   positioned, DOM order is the paint order (underlay genuinely beneath).
3. **Last-landing fade** (M2): an `airborne` counter starts the fade only
   when the final card lands (full coverage); the render gate widened
   1600 → 2000ms (widest bomb ~1050ms + 600ms fade + slack; the tick's
   3500ms fx slack still covers it).
4. All of it pinned (grid/unpositioned CSS, the key chain through GameTable
   → TrickWell, the airborne counter, the 2000ms gate).

Post-fix gate: **925/925**, typecheck, lint:hooks, build clean; live
re-drive of the covering play: underlay at 1 mid-flight, fading (caught at
computed opacity 0.016 mid-transition), unmounted at gate expiry.

## Round 2 (fix re-audit)

- **Grok — CLEAN: no HIGH, no MED; all four dispositions verified; 2 trivial
  LOWs, both then fixed.** Re-derived the fix-risk surface: the grid change
  leaves the empty well/sweep/overlap margins/390-width behaviour intact;
  the per-flight keys interact correctly with the sweep-keyed well;
  cancel() never fires onfinish so an early unmount cannot mis-trigger the
  fade (and the underlay unmounts with it anyway); consecutive plays inside
  the widened gate replace the stamp cleanly. Its LOWs — the handStarted
  unit pin not asserting topCards null, and a stale 1600ms comment — fixed
  immediately (assertion added; comment corrected). Gate in its clone:
  **925/925 + typecheck + lint + build PASS.**
- **Codex — CLEAN: no new runtime defect; all dispositions confirmed; 1 LOW
  (STATUS.md drift — the draft predated the fixes, still describing the
  absolute/1600ms/first-landing design), fixed immediately.** Its gate:
  typecheck + lint pass; vitest/build EPERM in its read-only sandbox
  (environment, every round).

## Verdict

**Clean.** Round 1 was the panel's strongest showing yet: both auditors
independently found the same two HIGHs (the fade class surviving React's
element reuse onto the next play's underlay, and the absolute underlay
collapsing into the new top's box — precisely the longer-play case the
owner named), plus Grok's paint-order inversion and fade-timing MEDs. One
fix set resolved all four (per-flight keys; grid-stacked unpositioned rows;
last-landing fade with a 2000ms gate), round 2 verified every disposition
with only documentation-grade residue, and the live drive confirms the full
lifecycle. Gate 925/925 + typecheck + lint:hooks + build, green locally and
in Grok's clone both rounds.
