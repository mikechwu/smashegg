# Compact headline round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff compacting the table headline per the
owner's directive — the big LEVEL numeral and the ♥-wild chip removed; the
two team badges carry the levels ("Us level 2 / Them level 2", zh with the
guandan 打X idiom); the turn sentence + clock right-anchored on the same
row when it fits.
Producer: Claude. Auditors: Codex + Grok, isolated clones, identical brief
(`BRIEF-HEADLINE.md`), gate re-run by each. Producer did not audit its own
change.

Verified live before the panel (390 en/zh-Hant + 1456 en): __level and
__wild absent from the DOM; badges read as asked in both locales; zh 390 a
single 35px row with the clock beside the badges; en 390 a tidy
right-anchored wrap at 64px (the old bar ran ~90px).

## Round 1

- **Codex — 1 MED + 1 LOW.** The MED (Grok converging via its "revisit a
  minimal cue" follow-up): with the numeral gone, DIVERGENT team levels
  leave the hand's live level — and therefore the wild — unstated in the
  always-visible chrome ("Us level A / Them level 5" doesn't say the hand
  plays at 5; engine cites: currentLevel drives levelValue and the wild;
  suspended hands can play at the opponents' level). **ACCEPTED** — the
  owner ordered the removal, but the attribution gap at diverged levels is
  a real loss worth the minimal cue (below). Its LOW: the badge's flex-gap
  spans read "Uslevel2" under text extraction/AT. **ACCEPTED.** Refuted
  cleanly: no stale keys/classes/prop uses; the zh 打 wording idiomatic
  for BOTH teams; the role=status row stable. Gate: typecheck + lint pass;
  vitest/build EPERM in its read-only sandbox (environment, every round).
- **Grok — no HIGH/MED blockers; wording question RESOLVED** (我隊打X /
  對方打X is standard guandan ladder speech for both teams — not a
  declaring-side-only idiom); confirmed the wiring, i18n parity, wrap
  behaviour, narrow rewrite, and the F6-superseded doctrine note; advised
  accepting the chrome-level loss deliberately with an optional minimal
  cue, plus two follow-ups (pin the badge markup; scrub stale "wild pill"
  comments). Gate in its clone: **925/925 + typecheck + lint + build
  PASS.**

## Fixes applied (producer)

1. **The minimal cue both reports pointed at** (MED): TableHeadline gains
   `playingTeam` (view.declarerTeam); the playing team's badge carries
   `gd-team--playing` — a goldleaf inset underline — plus a small TEXT tag
   (game.rail.playingNow: en "in play", zh 「本局」; text, never colour
   alone) that also joins the badge's aria. Hand 1 (declarer null) tags
   nothing — levels are equal there anyway. The compact bar stays exactly
   as the owner asked; the attribution returns when it matters.
2. **Composed badge aria** (Codex LOW): each badge carries
   aria-label "Us level 2" / "Us level A in play" — real spaces for AT and
   text extraction.
3. **Grok follow-ups**: badge markup + tag + aria + null-case pinned (new
   describe in headline-clock.test.tsx); the stale "wild pill" comment
   references scrubbed from table.css.

Post-fix gate: **927/927**, typecheck, lint:hooks, build clean; live
re-check at 390 en unchanged (hand 1 shows no tag by design).

## Round 2 (fix re-audit)

Both auditors verified dispositions 2-3 (composed aria, pins, comment
scrubs, the null-declarer case) — and BOTH independently caught the same
residual in disposition 1: binding the in-play tag to `view.declarerTeam`
mistags the SUSPENDED-declarer hand. Under suspendPlayOpponentLevel the
engine's selectCurrentLevel plays the hand at the OPPONENTS' level while
declarerTeam stays the suspended team — so the cue would say "Us level A in
play" on a struck-through A badge while the hand (and the wild) actually
runs at Them's 5: a false live-level cue in exactly the divergent case the
cue exists for.

- **Grok** additionally: 3 LOWs — the composed aria omitted the suspension
  text and A-attempt count (an aria-label suppresses the badge's children,
  so the dots/susp spans went unannounced), two stale comment sites, and
  missing zh/suspension pins. Gate in its clone: **927/927 + tc + lint +
  build PASS.**
- **Codex**: the same MED with the concrete example (levels A/5, declarer 0
  exhausted → hand plays 5, badge says A in play); everything else
  confirmed. Gate: tc + lint pass; vitest/build EPERM sandbox
  (environment, every round).

## Fixes applied (producer, round 2)

1. **Live-level attribution** (the converged MED): a pure helper
   `playingLevelTeam(declarerTeam, levels, currentLevel)` — the declarer
   when its ladder rank equals the engine's currentLevel (the tie goes to
   the declarer: both are right at equal levels), else the OTHER team, null
   with no declarer — used at the GameTable pass site. The engine's own
   currentLevel is the truth, so the tag crosses the bar exactly when the
   suspension redirect does. Unit-pinned: normal ownership both ways, the
   suspended redirect, the tie, null; plus a source pin that GameTable
   never passes raw declarerTeam.
2. **Complete badge aria** (Grok LOW): the composed label now carries the
   playing word, the suspension text AND the A-attempt count; pinned in en
   (suspended A badge + redirected in-play partner) and zh.
3. Stale comment sites scrubbed; zh pin added.

Post-fix gate: **930/930**, typecheck, lint:hooks, build clean.

## Round 3 (targeted — finders verify the redirect fix)

- **Grok — CONFIRMED on all three checks; no new defects; two cosmetic
  nits.** (a) The helper's mapping verified against selectCurrentLevel
  across an independent 15-case matrix including double-suspension configs
  — the invariant holds that currentLevel is always one of the two ladder
  entries when a declarer exists, so the else-branch fires only on a real
  suspension redirect. (b) The aria composition complete under the
  suppressed-children rule (playing + suspended + attempts all on the
  label; the redirect pair pinned; zh composition verified). (c) Gate
  930/930 + typecheck clean. Nits — the playingTeam JSDoc still describing
  the old binding (fixed immediately) and the nested dots' aria being dead
  under the parent label (pre-existing pattern, harmless).

## Verdict

**Clean.** The owner's compaction landed exactly as asked — numeral and
wild chip gone, badges as the level story with idiomatic zh wording, a
one-row best-practice bar — and the panel twice sharpened the one real
information loss: round 1 converged on the divergent-levels attribution
gap (answered with the minimal in-play cue), round 2 converged AGAIN on
that cue's suspended-declarer mistag (answered with the engine-truth
helper), and round 3 verified the final mapping against the engine's own
level-selection semantics. Gate 930/930 + typecheck + lint:hooks + build,
green locally and in Grok's clone every round; live-verified at 390 en/zh
and 1456 (zh single row 35px, en tidy wrap 64px, was ~90px).
