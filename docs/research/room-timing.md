# Room timing: classes, deadlines, and recompute semantics (M4)

Dated 2026-07-14. Decision record for the M4 timing mechanism — synthesized
from three independently produced designs (room-layer-minimal /
engine-semantic-hook / deadline-policy-object; all three converged on the
same core) plus a timing-conventions research pass. Per METHODOLOGY: claims
about the current code are VERIFIED against the source at the cited lines;
external-convention claims are covered by the null result in §5.

## 1. The mechanism (decision)

- **Engine hook:** `GameDefinition.timingClass?(state): TimingClass` — a new
  OPTIONAL, pure, state→label method, sibling of `actionTimeoutMs(state)`
  (src/engine/core/game.ts). `TimingClass = 'turn' | 'planning'` is a CLOSED
  union: classes are platform vocabulary (each needs a picker label, i18n
  strings, and a RoomTiming field), so adding one is a deliberate cross-layer
  act. Omitted method ⇒ every state is `'turn'` (guess-number omits it,
  proving the default path in production). The engine never sees
  milliseconds; a class is a label, not a clock — engine time-freedom holds.
- **Room config:** `RoomTiming { perTurnMs, planningMs }` (each
  `number | null`; null = untimed for CONNECTED seats) in
  `src/shared/timing.ts`, stored as a `room.timing_json` column, set at room
  creation, editable in the lobby via `setTiming` (same authority rule as
  `setConfig`), frozen at start. NOT a RuleVariant key — timing is not a game
  rule; `validateRuleVariant` would rightly reject it as `config.unknownKey`.
- **Resolution** at the single deadline-arming site (game-room.ts):
  `timing === null` (legacy room) → `game.actionTimeoutMs(state)` verbatim;
  else if `game.actionTimeoutMs(state) === null` → null (an engine-declared
  intrinsically-untimed state always wins); else
  `timingClass?.(state) ?? 'turn'` mapped through RoomTiming.
- **Wire:** `RoomInfo.timing: RoomTiming | null`; `WireDeadline` gains
  optional `timingClass` so the client can label a planning countdown;
  `setTiming` broadcasts via the existing `roomChanged` (RoomInfo carries the
  new value — no new ServerMessage variant).

**Guandan's 'planning' state** is the hand's opening lead, derived from
existing state with NO schema change:
`phase === 'playing' && trick !== null && trick.top === null && Σ|hands| === 108`.
Deal produces 108 held cards and tribute/return/anti-tribute only MOVE cards
between hands (verified: tribute.ts staged commits and moveCards), so the
total stays 108 until the first card is played; every mid-hand trick lead
follows at least one play. All three hand-opening paths (hand 1, tribute
'none'/'anti', post-return resolution) are covered by one predicate.
*Rejected alternative:* an explicit `handOpening` flag on TrickState — more
explicit, but it churns every persisted snapshot and breaks replay
verification of pre-M4 dumps for zero present-day semantic gain. The
derivation's fragility (a future variant that removes cards from the deal
would misclassify) is pinned loudly: the obligations property test asserts
`timingClass === 'planning'` ⇔ an independently tracked
"no play yet this hand" flag, across the config matrix.

Tribute/return/anti-tribute decisions class as `'turn'` deliberately: they
are forced choices from small eligible sets, and the real planning moment —
your FINAL post-exchange hand — is the opening lead the predicate tags.
Consequence to note: in timing-configured rooms those phases move from the
engine's old 30s/20s suggestions to perTurnMs (45s default) — longer, never
tighter. `actionTimeoutMs` is KEPT: it is the legacy-room fallback and the
"intrinsically untimed state" signal.

## 2. Deadline recompute semantics (the M2 fresh-clock fix)

**Core rule: a deadline is a property of a DECISION POINT, not of
connectivity.** New column `deadlines.base_due_at` records the budget armed
when the decision became the seat's; presence events may only CLAMP DOWN
toward the disconnect grace or RESTORE UP to base — never beyond base, never
re-arm, and never touch uninvolved seats. Today's code deletes the whole
table and re-arms `now + timeout` on EVERY recompute — including the
presence paths — which is exactly the tracked M2 bug (a reconnect handed the
actor a fresh full clock, and ANY seat's presence blip restarted EVERYONE's
timers).

Decision table (pure function `nextDeadlines` in room-helpers.ts; grace =
now + 60s; budget = now + clamp(ms, [5s, 120s])):

| Reason | Seat situation | Row action |
|---|---|---|
| decision | not an expected actor | delete row |
| decision | actor, timed, row exists (remained an actor across a co-actor's action, e.g. second tribute payer) | PRESERVE base; due = connected ? base : min(prev due, grace) |
| decision | actor, timed, no row (newly acting) | insert base = budget; due = connected ? base : min(base, grace) |
| decision | actor, untimed, connected | no row |
| decision | actor, untimed, disconnected | keep existing grace row, else insert base = NULL, due = grace |
| presence | disconnects, actor, row exists | due = min(due, grace); base unchanged |
| presence | disconnects, actor, no row (untimed) | insert base = NULL, due = grace |
| presence | reconnects, actor, base ≠ NULL | due = base ← THE FIX (only the remainder comes back) |
| presence | reconnects, actor, base = NULL | delete row (untimed again) |
| presence | seat not an expected actor | no-op |

The one legitimate timer RESTART is a new decision point (rows re-armed on
an applied action) — that is now the ONLY restart path. Invariants, each a
unit assertion: (I1) due ≤ base when base ≠ NULL; (I2) no presence sequence
can push due ABOVE BASE within one decision point — i.e. no fresh budget;
a reconnect legitimately raises a grace-clamped due back UP to base
(restoring the remainder is the point of the fix), so I2 is a
never-above-base bound, not literal monotonicity (wording fixed per Codex
M4 audit); (I3) seat X's presence never changes seat Y's row; (I4) a
disconnected actor's grace is anchored at first disconnect and survives
co-actor actions.

## 3. Deadlock freedom (PLAN §4/§5 property)

With A = expectedActors(state) ≠ ∅ (engine obligation), C = connected seats,
T = resolved timeout: (DL1) every a ∈ A is either connected-and-untimed
(no row, by design) or has a row due within max(clamp(T), 60s) — in
particular every DISCONNECTED expected actor ALWAYS has a row due ≤
disconnect + 60s, including when T = null; (DL2) rows ≠ ∅ ⇒ the alarm is
armed at min(due); (DL3) an alarm firing either applies `defaultAction`
(seq strictly advances) or deletes a stale row — it terminates and cannot
spin. Corollary: "all actors connected AND T = null with no deadline" is
live, not deadlocked — the instant any expected actor disconnects, the same
handler inserts its grace row before returning. The property test drives
`nextDeadlines` + a virtual clock over random event interleavings
(action/disconnect/reconnect/advance/fire) for both games × all presets ×
legacy-null, asserting DL1–DL3 and I1–I4 after every event.

## 4. Ceremony interaction (decision: absorb)

The hand-1 drawCard ceremony (~4.6s expected, tap-skippable) plays INSIDE
the planning window; the opening deadline is armed at the start mutation
like every other deadline. Starting the clock "after the ceremony" was
rejected on boundary grounds: the room layer would need to know Guandan
hand-1 has a ceremony (agnosticism violation), the engine cannot report a
duration (time-freedom), and a client "ceremony done" signal is
non-authoritative and non-deterministic (four clients finish at different
times; free-time abuse lever). Absorption keeps the deadline a pure function
of (state, room config, wall clock at mutation) — replay-explainable — and
costs ≤5% of the 90s standard window, once per match. Client-only polish:
the countdown ring is de-emphasized while the ceremony overlay is up.

## 5. Defaults and presets (research: honest null result)

A research pass over Chinese card-game platforms (JJ competition, 91y, Happy Dou Dizhu,
Guandan titles) found that NO surveyed platform publishes its timer values —
help pages document timeout CONSEQUENCES (auto-play/auto-play), not seconds;
forum numbers (15–30s per turn) could not be traced to a primary source. No
platform documents a hand-start planning window or a no-timer mode.
Diagnosis: timer values are internal tuning parameters, not rules. So the
defaults below are ORIGINAL, justified by this product's goals (family
table, hot-seat self-play), not a copied convention:

- **standard 45s turn / 90s planning (DEFAULT)** — 45s is the value that has
  survived every M3 visual round including hot-seat; 90s ≈ 2× turn covers
  reading a fresh 27-card double-deck hand and absorbs the ceremony.
- **fast 20s / 45s** — experienced tables.
- **relaxed 60s / 120s** — teaching/chatty tables; planning pinned at the
  existing 120s clamp ceiling.
- **untimed (null/null)** — the PLAN §4 no-timer mode, first-class for
  family/hot-seat play; the 60s disconnect grace carries liveness, and the
  picker hint says so honestly.

Presets only in the picker (no raw ms fields): four labeled intents read
instantly; free numbers invite planning < turn nonsense and validation UX.

## 6. Boundaries held

Engine: pure state→label method, no wall clock, no ms. GameRoom DO: never
learns what a Guandan hand start is — it maps an opaque class label through
room config (grep+compile agnosticism proof unchanged). RuleVariant: 25 keys
untouched. Wire: additive-only; protocol stays v1; legacy rooms
(timing_json NULL) behave bit-identically to pre-M4.
