> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## End-of-hand interlude (2026-07-22) — BUILT as designed + demo videos — local, unpushed

Owner sign-off arrived as the demo-video request ("show it is implemented as
designed"): the beat from docs/research/hand-interlude.md is now real. One
lower-third plate over a vignette, the winning final play HELD in the trick
well; hold → standings (頭游…末游 + goldleaf verdict) → level transition (the
HEADLINE badges tick old → new) → curtain (第 N 局 · 本局打 X); ~4.9s auto,
one-tap whole-beat skip, 6.5s cap; A-burn/suspension insert; matchEnded runs
the shortened beat into ResultOverlay; reduced-motion static plate. Fold-time
snapshot on the transient-fx discipline (before-side trackers seeded at hand 1
AND lazily from the first observed view on mid-match adoption, guarded against
the same-tick handEnded race); every surface gates behind the beat (deal, fan
hold, tribute center, action bar, clocks, turn sentence, actor rings, in-play
tag, ResultOverlay). Two visual-round finds fixed before recording: the
overlay went viewport-FIXED (the pre-deal hold collapses the table section —
an in-section overlay covered the held play), and the next hand's turn
sentence + actor rings leaked through the dim.

Ratchet: tests/unit/client/interlude.test.tsx (23 pins: step machine, fold
capture incl. batch-order survival + tracker seeds + burn/suspension
precedence + mid-match degradation, stage-conditional render, wiring/CSS,
audit fixes). Cross-model panel (Codex + Grok, fresh clones at the true
base, both disclosed as design-anchored): Grok found the one HIGH —
multi-seat done-id bookkeeping was scalar, resurrecting a finished beat on
pill switch (→ ReadonlySet fix, pinned); both found the frozen-`now` 60s
guard MED (→ per-stamp tick horizons); LOWs fixed (unlimited-attempts dead
air, match-end fan under the vignette) or acknowledged (stage-E fade, burn
copy wording) — docs/audits/interlude-panel.md. Videos re-recorded on the
FIXED code. Gate 958/958 (40 files) + typecheck + lint:hooks + build.

**Demo videos (owner request): docs/local/videos/interlude-{zh-Hant,en}.{mp4,webm}**
— gitignored (docs/local/), NEVER pushed. Each records a REAL driven test
game at 390×844: live timeout endgame → the final play → the full beat (both
locales verified reading their proper copy, zh-Hant 打2 → 打5 with the badge
tick) → the deal into hand 2 → the tribute flow (item 2's hand-size cards
visible). mp4 = the last 45s (trimmed for clarity); webm = the full capture.
