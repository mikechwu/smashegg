> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Compact headline (2026-07-17) — owner refinement — local, unpushed

Owner directive (screenshot of the bar): remove the big LEVEL numeral and the ♥-wild chip
— just "Us level 2 / Them level 2" (good Chinese wording) — and redesign with best
practice.

Built: TableHeadline's __level block and __wild chip GONE (currentLevel prop removed; keys
game.level.playPrefix / game.wild.tag / game.rail.playing removed ×3 locales). The two
TeamBadges are the level story: label + connective word + goldleaf rank — en "Us level 2",
zh 我隊打2/對方打2 (new key game.rail.teamLevel; the guandan 打X idiom); A-dots +
suspension unchanged. Best-practice bar: badges lead left, the turn sentence + clock
anchor right (margin-left:auto), sharing one row when it fits and wrapping under when not;
badges gained presence (0.875rem, rank 1.05rem goldleaf — F7's bold move at badge scale).
F6 ("wild stated always") is SUPERSEDED by the owner's directive — the wild's own seal
still marks it in play. Narrow block dropped the dead __rank compression.

Live-verified: 390 zh-Hant single row 35px (「我隊 打2 · 對方 打2 ─ 輪到你 45」); 390 en
wraps to a right-anchored second line (64px); 1456 en one row; __level/__wild absent from
the DOM everywhere (was ~90px with the numeral + forced second line).

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-HEADLINE.md;
producer≠auditor): see docs/audits/headline-panel.md. Gate 925/925; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.
