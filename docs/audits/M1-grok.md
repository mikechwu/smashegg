# M1 Cross-Model Audit — Grok (primary lineage: levels/A-attempt + bomb hierarchy + comparison; spot-check: tribute leader/equal-assign, generate feasibility)

Ran 2026-07-14 (grok 0.2.93 headless) against engine commit (M1 gate). Anchoring-free: Grok received the spec + code only. Relayed verbatim by the orchestration agent.

Grok completed the audit in a single headless run (exit 0, no errors). Its report was complete and unambiguous, so no clarifying follow-up run was needed. Below is grok's report, relayed verbatim with light formatting.

---

# GROK'S AUDIT REPORT (grok 0.2.93, spec `docs/rules/guandan.md` v1.3 vs code only; no files modified)

## (1) FINDINGS — concrete defects only

### M1 — major — `levelTrack: 'shared'` + `aFailConsequence: 'demote'` breaks the shared ladder

- **Spec §6.2:** shared track is *one* ladder both teams sit on, moved by the winner.
- **Code:** upgrades write both entries (`levels.ts` ~146–149); demotion writes **only** the failing team (`levels.ts` ~180–184). Comment admits demotion "remains per-team."

**Failing scenario**
1. `levelTrack: 'shared'`, `aFailConsequence: 'demote'`, `aFailDemoteTo: 'level2'`, `aMaxAttempts: 3`.
2. Both teams climb together to `A` (invariant holds).
3. Team 0 declares at A, fails a third attempt → demoted to `2`; team 1 stays `A` → `levels = ['2','A']` (shared invariant broken).
4. Later team 0 wins +3 from `2` → upgrade sets **both** to `5` → team 1 is pulled **down** from A to 5.

That is not "one shared ladder moved by the winner"; demotion permanently desyncs, and later shared upgrades can demote the other team as a side effect. **Not a default-path bug** (defaults are `perTeam` + `suspendPlayOpponentLevel`), but a real correctness hole for a documented §10 combination.

### M2 — major — `tributeLevelBasis: 'previousLevel'` is dead config (silent wrong behavior)

- **Spec §7.2 / §10:** `tributeLevelBasis: upcomingLevel | previousLevel` (default `upcomingLevel`).
- **Code:** key exists on `RuleVariant` / `JIANGSU_OFFICIAL_ONLINE`; **no read site** under `src/`. `startHand` always passes `selectCurrentLevel(...).level` into tribute (`index.ts` ~59–64, ~118).

**Failing scenario**
1. Hand N played at level `5`; team 0 wins and moves to `8`.
2. Config: `tributeLevelBasis: 'previousLevel'`.
3. Hand N+1 tribute must rank cards with **previous** elevation/wilds (level `5`).
4. Engine evaluates forced rank / wild exclusion at **upcoming** level `8`.

Unlike `equalTributeAssignment: 'winnersChoose'` (hard fail at init), this fails **silently**.

### No blockers found
Default profile (`JIANGSU_OFFICIAL_ONLINE`) and CORE paths for scoring, A-win, suspend lifecycle, and bomb ladder matched the spec in this review.

## (2) CHECKED, NO FINDING

**Scoring / clamp / A-win (`levels.ts`, consumed by `index.ts`):** §6.1 +3/+2/+1 from partner place (incl. truncated finish orders, absent partner = 4th → +1); §6.3 A clamp, overshoot only when target **past** A (`K+1` on A ≠ overshoot; `K+2`/`K+3` overshoot); `overshootWinsGame` true/false; A-win = declarer + own A + `currentLevel === 'A'` + not suspended; `aWinPartnerNotLast` true (1-2/1-3) / false (any 1st finisher); non-declarer at A cannot passing A; at-A 1-4 gives no level gain but consumes the attempt.

**A-attempts / `aFailConsequence` / §1.5 refinement:** attempt = declarer at A, not suspended, failed win (default `aAttemptOnlyAsDeclarer`); non-declarer loss ignored by default, counted when `aAttemptOnlyAsDeclarer=false` (non-declarer **win** never counts); `suspendPlayOpponentLevel` never demotes, sets `aAttemptsExhausted`; `selectCurrentLevel` sends exhausted **declarer** to opponents' level, other cases plain §1.5; flag not cleared on the exhausting hand even if it was a 1-4-style win; flag cleared only on a **later** win; `aAttemptCounterReset` fresh/cumulative; both-at-A + suspension (currentLevel may be A but match win refused; win clears flag); `demote` + `aFailDemoteTo` (level2/levelJ/stayAtA) + counter reset clean under `perTeam`; `none` counts only; `aMaxAttempts: null`; `aceFinishDemotes` clean as isolated variant; shared upgrades alone (no demote) keep both entries equal.

**Hand-boundary lifecycle (`index.ts` finishHand/startHand):** atomic path `scoreHand` → `applyHandResult` → matchEnd or `startHand` with updated levels/flags and `declarerTeam = winnerTeam` → `selectCurrentLevel` → deal → tribute/play. Scenarios checked: K+3 clamp → next hand at A; 3rd A-fail loss → suspend → opponents declare at their level; 3rd A-fail via 1-4 win → winners declare but suspension applied at opponents' level; suspended win → flag clear + fresh counter → following hand at A; match win short-circuits next hand. Matches §1.5 + §6.4 for owner defaults.

**Bomb hierarchy + comparison (`combos.ts`):** §3.11 tiers 4 < 5 < SF(55) < 6…10 < joker(110); same size by `rankLevelValue` (level bomb = 15); SF vs SF by `naturalValue` of top, suits ignored, equal never beats; sequences use natural keys with no level elevation; non-sequences use levelValue / joker 16–17; bomb beats all non-bombs and never the reverse; equal never beats (incl. joker vs joker); `jokerBombSupreme=false` → joker tier 75 (beats ≤7-bomb/SF, loses to 8+); `wildStraightFlushIsBomb=false` → demoted SF not a bomb, `effectiveType` → straight.

**Spot-check, tribute:** single tribute leader = payer (4th finisher); double unequal → higher card to 1st finisher, leader = that payer; double equal `seatOrder` → first payer from 1st finisher via `nextSeat`/`turnDirection`; double equal `random` → PRNG choice; anti-tribute → 1st finisher leads; leader always "payer of 1st finisher's card" after return resolve.

**Spot-check, generate:** rank templates `maxSize = min(10, c + w)`, `k = 1..maxSize` ⇔ `max(0, k−c) ≤ w`, with sub-multisets; jokers separate with `w_r = 0`; level-rank bombs capped at 8 via natural/wild split; §4.2 all-wild under-declare guard present. Clean for the feasibility rule.

## (3) Could not verify (and why)

- Full tribute machine beyond leader/equal-assign (staging, return eligibility, anti-tribute optional machine, visibility) — out of primary/spot-check depth.
- `equalTributeAssignment: 'winnersChoose'` — explicitly unimplemented (`init` throws; pay path errors); a deferred limitation, not a silent logic bug.
- Wild validation / §3.5–§3.8 classify/validate exhaustively — outside primary surface (only `beats`/`comboKeyValue` deep-audited).
- Trick/jiefeng/hand-end mid-trick — not in scope; trusted only as finishOrder producer into scoring.
- Cross-variant `aceFinishDemotes` × `suspendPlayOpponentLevel` on the **same** hand — spec silent; engine applies ace demote after suspend set and can wipe the flag; ambiguous, not scored as a defect.
- Shared × suspend when both at A — level override is a no-op (levels equal); only match-win gating matters; consistent enough but not fully source-backed.
- Concurrent seats / network / PRNG deal fairness; live play vs physical Jiangsu table beyond written v1.3 — outside the spec-and-code charter.

**Grok's summary:** primary default/CORE path (scoring, A-clamp, A-win, suspend lifecycle across finishHand/startHand, bomb ladder + keys) is clean; two majors are config-combination/config-wiring holes (shared ladder vs per-team demote; dead `tributeLevelBasis: 'previousLevel'`); no blockers for owner defaults in §10.

---

**Invocation:** `~/.grok/bin/grok --cwd /Users/mikechwu/Projects/smashegg --prompt-file <audit_prompt.txt> --permission-mode auto --disable-web-search --max-turns 120` (grok 0.2.93 headless single-turn; exit 0, empty stderr, one run — no retries or follow-up needed). Caveats: `--permission-mode auto` was used so grok could read files unattended; the prompt appended "Do not modify any files" and grok's report states no files were modified. All file/line references above (e.g., `levels.ts` ~146–149/~180–184, `index.ts` ~59–64/~118) are grok's own and were not independently verified by me, per the orchestration-only mandate.