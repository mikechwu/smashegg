# End-of-hand interlude build — cross-model panel (2026-07-22)

Scope: the uncommitted diff implementing docs/research/hand-interlude.md
(the beat between hands — fold-time snapshot, staged overlay, render gates)
plus the two new files (InterludeOverlay.tsx, interlude.test.tsx). Producer:
Claude. Auditors: Codex + Grok, isolated clones re-cloned fresh at the true
base 39258e3 (both prior clones' .git had rotted; node_modules symlinks
preserved, no git clean), identical patch + file assembly. Honesty note:
both models had served as DESIGN consultants for this feature (the owner's
design-panel round), so they audited code-vs-plan conformance rather than
re-litigating the design — the anchoring is disclosed, not hidden. Both
verified live before the panel: the beat recorded end-to-end in zh-Hant and
en (docs/local/videos/, gitignored).

## Codex — no HIGH; 1 MED + 1 LOW, both fixed

- **MED (fixed):** the parent's 60s stale guard reads `now`, but the tick
  effect tracked only passedAt/playFx stamps — an untimed room arms no
  deadline at hand end, so `now` froze and the guard behind a frozen overlay
  timer chain could never trip (the same frozen-`now` class as the pass-fade
  fix). Fixed: per-stamp freshness horizons, the interlude stamp carrying
  its own 61s leg. Pinned.
- **LOW (fixed):** under unlimited A-attempts (aMaxAttempts null) the burn
  LINE is suppressed but the 900ms dwell EXTENSION still fired — dead air.
  Fixed: the insert condition now equals the render condition. Pinned.
- Checked clean: snapshot-before-wipe ordering, tracker seeds (hand-1 +
  first-observed-view with the race guard), all render gates, remount
  catch-up + finished-beat null render, the shortened match-end variant,
  exhausted-beats-burned, locale key presence. Sandbox EPERM on vitest/build
  as every round (reasoned-only).

## Grok — 1 HIGH + (the same) MED + 4 LOW; gate run in ITS clone green

- **HIGH (fixed):** `interludeDone`/`interludeLate` were SCALARS while
  per-seat folds mint DISTINCT ids for the same hand end — in multi-seat
  self-play, completing seat B's beat un-marked seat A's, resurrecting a
  finished beat on the next pill switch inside the 60s window. Grok proved
  the sequence concretely. Fixed: both are now ReadonlySet<number> with
  add-on-complete; pinned (set types, .has gates, the add calls).
- **MED:** the 60s-guard tick — same finding as Codex, same fix.
- **LOW (fixed):** the match-end beat left the ended hand's fan visible
  under the vignette (no next deal to hold it) — the fan now also hides
  behind `interludeShowing`. Pinned.
- **LOW (acknowledged, kept):** the plan's ~200ms stage-E plate fade is not
  implemented (unmount is instant) — the deal's own mount motion carries
  the transition; deliberate simplicity over a lingering overlay.
- **LOW (acknowledged, kept):** the zh-Hant burn line is tighter than the
  plan's sketch (no 「第 N 次 · 仍打A」) — the remaining-attempts count
  carries the same information; wording choice recorded here.
- Confirmed clean with the suite run in its own clone (exit 0): snapshot
  ordering, seeds + race guard, every gate, all onDone liveness paths
  (timer chain / tap / reduced-motion release / catch-up / ref idiom vs the
  parent's 500ms tick), match-end single-ending, A-logic precedence, i18n
  parity, no CJK outside locale JSONs.

## Post-fix state

Gate 958/958 (40 files) + typecheck + lint:hooks + build. Both locales
re-recorded on the FIXED code (the shipped demos show the shipped build).

## Verdict

**Clean after fixes.** The one genuine HIGH (multi-seat resurrection) was
exactly the kind of cross-seat bookkeeping slip the panel exists to catch —
found by the auditor that ran the code, fixed and pinned the same hour.
