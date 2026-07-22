# The end-of-hand → next-hand beat (post-M5 playtest item 1) — design plan

Status: PROPOSED — awaiting owner sign-off before any build (the round's
stated process: research → plan → sign-off → build).

## The finding

First real-human playtest: between hands the game jumps straight into the
next deal. Who won, the finishing order, the level advance, and the level
the next hand is played at all land as one feed line while the deal is
already running. The owner's framing (adopted here as the design axiom):
this is a missing STATE, not a missing animation — a beat of information
currently compressed to zero seconds. Design the beat, then animate it.

## The architecture fact that decides everything

`finishHand` (src/engine/guandan/index.ts) commits the whole transition
atomically: one applied action yields `played` → `playerFinished`× →
`handEnded {result, newLevels, aAttempts, aAttemptsExhausted}` → the next
hand's setup events (or `matchEnded`), all in one batch. There is no
server-side inter-hand phase, so the beat is CLIENT-SIDE FRAMING over an
already-committed result — each client paces its own copy, the away player
stalls nobody, and the timeout/deadlock surface is untouched. (If a real
phase were ever wanted instead, that is a scope change to stop and flag —
not this round.)

Consequence to design around: the next hand's server clocks are already
running during the beat. The standard preset's 90s opening planning window
absorbs a ~5s beat comfortably, but the beat must stay modest and
skippable.

## Provenance

Two independent design proposals (Codex and Grok CLIs, isolated clones,
identical brief `BRIEF-INTERLUDE.md`, no cross-visibility) plus a web
research pass (Chinese card-app settlement screens; Hearthstone/Balatro/
Wingspan settlement craft; skip-convention evidence). The proposals
CONVERGED on every load-bearing choice below; divergences and the picks
are noted inline. Research patterns backing the shape: verdict first and
alone; the "why" revealed sequentially (sequential reveal doubles as rules
pedagogy); progression animated on the durable rail; tap-to-skip
mandatory (unskippable sequences are a top complaint genre-wide); and the
genre-specific two-tier rule — a LIGHT per-hand settlement distinct from
the HEAVY per-match ceremony.

## The sequence (staged sub-beats in one overlay plate)

The interlude is one overlay in the ceremony/result family: a partial
lacquer dim with a single rosewood plate, staged content inside it. The
table stays the stage throughout — the winning final play is HELD IN THE
TRICK WELL, in place, never lifted into the plate (both designers,
independently, with the same reasoning: the well is the "what's on the
table" truth surface, and lifting cards into chrome turns a card-table
moment into an app screen).

| Stage | Content | Duration |
|---|---|---|
| A · Hold | Dim rises; final play alone with a quiet line: who played it / went out | ~800ms |
| B · Standings | 頭游/二游/三游/末游 with names; the partnership verdict + level delta as a verb (我隊勝 · 升 2 級) | ~1600ms |
| C · Level transition | Before → after for both teams; the HEADLINE badges themselves crossfade from old to new levels (frozen at fold, animated here) — the beat teaches the always-present rail rather than inventing a second scoring UI. Conditional A-attempt/suspension insert lands here | ~1400ms (+600–900ms when the insert fires) |
| D · Curtain | 第 N 局 · 本局打 X (+ one-line suspension subtitle when the next hand plays under suspension) | ~900ms |
| E · Release | Plate fades; the existing deal animation begins | ~200ms |

Total ~4.9s normal; ~5.7–5.8s with the A-story insert; HARD CAP 6.5s
(if a branch would exceed it, condense C and shorten D — never run past
the cap on auto).

Divergence resolved: Codex proposed place-badges appearing AT the four
seats before collecting into the center list — rejected as a flourish that
fights 390px flank geometry and the research's "verdict first, alone"
finding. Grok's lower-third plate anchor at 390 is adopted so the plate
never covers the well.

## Pacing and control

Auto-advance always; ONE TAP ANYWHERE SKIPS THE WHOLE BEAT and releases
the deal (both designers; per-step skipping rejected as four taps for a
five-second beat). A quiet "點一下跳過 / tap to skip" caption under the
plate. Reduced motion: no timed chain — one static plate carrying all of
B+C+D's text with a dismiss control.

## The suspension story (the beat's hardest copy)

- Attempt burned, not exhausted: one added line + the attempt dots on the
  badge. 「我隊攻A未成（第 2 次）· 仍打A · 還有 1 次機會」.
- Attempts exhausted (the confusing one — gets the dedicated insert):
  「攻A三次未成 · 我隊暫停攻A · 下局改打對方級數」, and stage C's
  transition renders 我隊 A（暫停） · 對方 7 → 本局打7.
- Every later hand under suspension: only the one-line curtain subtitle
  (第 N 局 · 本局打7 · 我隊攻A暫停) — the big explanation fires once, at
  exhaustion.
- Codex's sharp catch, adopted: never surface the internal
  track-demotion mechanism in this copy — the player-facing model is
  "suspended, plays at opponents' level," matching what the headline
  already shows (the playingLevelTeam redirect).

## Composition

- **matchEnded in the batch**: no full interlude — a shortened beat (hold
  + finish order + 我隊/對方勝出比賽, ~2.5s) dissolving into the existing
  ResultOverlay, which owns the match ceremony. Two full endings back to
  back is the failure mode both designers flagged.
- **Hand-1 ceremony**: disjoint by construction (the interlude exists only
  between hands); the beat hands off into the hand-2+ deal exactly where
  the ceremony hands off on hand 1.
- **Reconnect honesty**: a snapshot resync carries no events → the
  interlude simply does not fire; the table renders the new hand and the
  headline already tells the durable truth. Never synthesize a "just
  happened" ceremony from state (both designers, verbatim agreement).

## Implementation shape (for the build round, after sign-off)

Pure client, the established transient-fx discipline:

1. Fold-time snapshot (the playFx/topCards pattern): when the batch holds
   `handEnded`, capture {final play cards+seat, result, OLD levels (the
   pre-fold view), newLevels, aAttempts before/after, exhausted flags,
   next handNo, next currentLevel, matchEnded flag} into an `interlude`
   state stamped with wall-clock `at` — remount/replay immune.
2. A pure stage function `interludeStage(elapsed, branch)` returning
   A|B|C|D|E — the DOM-free-suite pin surface (the isCeremonyShowing
   precedent), covering ordering, branch durations, the 6.5s cap, and the
   skip collapse.
3. The deal gate composes: DealOverlay (and the new-hand fan reveal)
   waits for interlude completion the same way it waits for the ceremony.
4. No engine, protocol, redaction, or timing change — the gate for this
   round; if the build discovers otherwise, stop and flag.

## Locale note

zh-Hant copy above is the primary surface (the family default); en and
zh-Hans keys land with the build. All identifiers/comments stay English;
the quoted UI strings live in the locale JSON files.
