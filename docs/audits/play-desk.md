# Play desk build — cross-model conformance panel (2026-07-22)

Scope: the uncommitted diff implementing docs/research/state-visibility.md
(owner decisions D1–D7) — PlayDesk.tsx + the desk pure helpers + the
GameTable/ActionBar/HandFan/TableHeadline/table.css/i18n changes and the
play-desk test suite. Producer: Claude. Auditors: Codex + Grok in isolated
clones synced to the built tree. Honesty note: both models served as
INDEPENDENT DESIGN CONSULTANTS for this feature (the proposal round), so
per the producer≠auditor rule they audited CODE-vs-PLAN CONFORMANCE, not
the design — the anchoring is disclosed, not hidden. The owner named the
two conformance questions worth their time: did presentation-only actually
hold, and are the pure helpers reused rather than reimplemented.

## Both lineages, both owner questions: HELD

- **Presentation-only:** patch surface is client UI + i18n + tests only —
  no engine/server/protocol/redaction/timing change; the DO alarm remains
  the sole enforcer; the fraction bar reads the ALREADY-CLIENT-SIDE room
  timing preset (shared timeoutMsFor — no new wire field; Codex verified
  WireDeadline.timingClass pre-existed); the D6 detection is purely
  client-local; the desk can submit nothing ActionBar could not already
  submit (unstage → setSelected is its only write).
- **Reused, not reimplemented:** deskStage's quiet branch is the literal
  classifyPlays call (the engine classifier matchSelection itself wraps),
  its loud branch is matchSelection's matches verbatim; naming flows
  through comboKey/comboRankLabel/declRunText, the verdict through
  beatState; both auditors grepped the new code for parallel rank/combo/
  legality logic and found none. Grok ran the suite in its clone: green.

## Codex — no HIGH; 1 MED (fixed) + 1 LOW (acknowledged)

- **MED (fixed):** the D6 local-pass stamp was never CONSUMED by its
  matching fold — so a REAL server auto-pass on the seat's next turn
  inside the 10s window was suppressed as "local", silently eating the
  teaching notice (a false negative on one of the named questions; Codex
  called it block-or-owner-accept). Fixed: consumeLocalPass deletes the
  stamp on first use — one local act maps to one pass event. Pinned.
- **LOW (acknowledged):** the D6 pins are shape pins and would not catch
  the stale-stamp edge behaviorally; reconnect cases are argued from
  store code (resyncs fold no events → no replay false positive), not
  exercised. Recorded with Grok's matching L5 below.
- Sandbox blocked vitest (network + broken local symlink) — reasoned-only.

## Grok — no HIGH; 3 MED (all fixed) + 5 LOW (1 fixed, 4 acknowledged); suite green in ITS clone

- **MED M1 (fixed):** the planning register was half-built — the plan
  promises goldleaf chrome vs the cinnabar turn register, the code only
  swapped the title copy. Fixed: gd-desk--planning goldleaf edge. Pinned.
- **MED M2 (fixed):** the staged single-reading verdict only spoke the
  negative (cannot-beat) — the plan's copy carries the positive verdict
  too. Fixed: a playable FOLLOWING reading appends the beats-the-table
  suffix (new key ×3 locales); a lead stays suffix-free (nothing to
  beat); quiet stays honest (playability unknowable). Pinned both ways.
- **MED M3 (fixed):** deskMode's tribute branch returned 'tribute' before
  consulting yourTurn — safe today only because tributePhase derives from
  hints. Fixed: explicit conjunction; a tribute phase without hints can
  never hand a non-actor the loud shell. Pinned.
- **LOW (fixed):** the tribute desk ran classifyPlays on readings it
  ignores — the stage computation now skips tribute mode.
- **LOW ×4 (acknowledged, kept):** the scroll effect re-runs per staged
  count while loud (intended: the confirm stays reachable; 'nearest'
  no-ops when already visible); the 10s local-pass window's inherent
  edges (a >10s pass ack could read as auto; a hard reload before the
  batch misses one notice — resyncs fold no events); the notice cap is
  per held seat, not global (per-player in real family use); test gaps
  on D6 races and scroll UX (the live driven rooms cover the happy
  paths; recorded as future follow-ups with Codex's LOW).
- Grok's decision map: D1–D7 each verified implemented; the two pinned
  build deviations (urgent copy in the title slot; the
  ScrollActionsIntoView child) explicitly accepted as conforming.

## Post-fix state

Gate 1010/1010 (42 files) + typecheck + lint:hooks + build. Live re-run on
the FIXED code: 16/16 checks across the four driven zh-Hant rooms (loud/
quiet/untimed/tribute/reduced-motion, both widths for D4).

## Verdict

**Conforming after fixes — zero HIGH from either lineage.** The panel's
one teaching-consequence catch (Codex's unconsumed stamp) and the three
register/defense gaps (Grok) were exactly the plan-vs-code deltas a
conformance audit exists to find; all four fixed and pinned the same hour.
