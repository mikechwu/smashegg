# M4 audit — Codex (resync / idempotency / deadline liveness)

Archived 2026-07-14. Prompt: question-first, anchoring-free (surface + questions, no conclusions). Sandbox note: Codex could not execute tests (EPERM on vite temp write) — reasoned-only, recorded honestly; our CI executes the same suites green incl. the same-day strict-mode run.

**Findings**

1. **Minor: I2 is not literally true if “increase” means monotonic `due_at`.**  
   Scenario: a timed actor has `baseDueAt = T+90s`, disconnect clamps `dueAt` to `T+70s`, then reconnect restores `dueAt` back to `baseDueAt`. That is an increase within the same decision point. The implementation does this at [room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:198), and the unit/property tests expect it at [room-helpers.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/room-helpers.test.ts:212) and [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:355).  
   Verdict: not a server bug against the §2 table, because §2 explicitly says reconnect with `base != NULL` restores to base. But §3/I2 wording should be read as “never above base / no fresh budget,” not “never numerically increases.”

2. **Minor: the liveness property test is a faithful model of the pure deadline call pattern, but still a parallel DO implementation.**  
   `VirtualRoom` calls the same `nextDeadlines`, `resolveTimeoutMs`, and engines at [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:82), but it reimplements room mutation, alarm scheduling, and alarm looping in memory at [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:103) and [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:126). It does not execute DO SQL replacement, hello/takeover ordering, socket-close ordering, idempotency, or the fire-and-forget async boundary.  
   Also, DL3 “terminates” is only asserted per iteration as “seq advanced or a row was pruned” at [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:146); it does not fail if `MAX_ALARM_APPLIES` is exhausted with due rows remaining. The literal monotonic version of I2 is also not asserted; the test asserts only `dueAt <= baseDueAt` for timed rows at [deadline-liveness.property.test.ts](/Users/mikechwu/Projects/smashegg/tests/unit/server/deadline-liveness.property.test.ts:210).

**Checked Clean**

1. **Deadline table:** `nextDeadlines` matches the §2 table as implemented. Decision non-actors are dropped by omission; timed existing rows preserve `baseDueAt`; timed new rows clamp budget to `[5s, 120s]`; untimed connected actors have no row; untimed disconnected actors get or keep grace rows. Relevant implementation: [room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:133). I did not find an input where a disconnected expected actor ends with no row.

2. **Presence semantics:** changed non-actors are no-op; disconnected row-less untimed actors get a grace row in the same reconcile; reconnect of `base=NULL` deletes the grace row; reconnect of `base!=NULL` restores base. Relevant implementation: [room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:185).

3. **DO integration:** start awaits decision recompute before event fanout at [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1035). Post-action fire-and-forget is currently safe because `applyNextDeadlines` runs all SQL before the first await; only `scheduleAlarm()` awaits after that boundary at [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1289) and [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1301). Hello reconciles before welcome/resync snapshots at [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:738). Takeover with no net connectivity delta correctly does not reconcile.

4. **Socket close:** close/error uses presence reconcile, not decision recompute. Although presence broadcast is queued before reconcile, there is no await before `applyNextDeadlines` runs synchronously inside `reconcileDeadlines`, so I did not find a stale-table interleaving before the next DO event. See [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1477).

5. **Alarm:** stale rows with no default action are deleted; default actions flow through `applyGameAction`, which recomputes decision deadlines and therefore arms the next actor’s resolved class. The loop is bounded by `MAX_ALARM_APPLIES` and reschedules at the end. See [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1400) and [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1433).

6. **Idempotency across drop:** client-forged `timeout:` ids are rejected at [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1078); synthetic timeout ids remain deterministic at [room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:218). Duplicate `actions_seen` returns resync and does not reapply at [game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1136). The e2e no-dup test’s seq-gap proof is valid for its covered interleaving: first apply witnessed, reconnect, resend same id, then witness’s next action lands at `seqApplied + 1` at [reconnection.e2e.test.ts](/Users/mikechwu/Projects/smashegg/tests/e2e/reconnection.e2e.test.ts:307).

7. **Resync/skew additions:** `welcome.build` is deploy metadata only; `RoomInfo.timing` is room-public config; `WireDeadline.timingClass` is public clock labeling. I found no redaction leak in these fields. Additive JSON fields are old-client ignorable. `deltaCoversGap` behavior is unchanged and still strict contiguous coverage at [room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:275).

I attempted targeted tests, but could not execute them in this read-only environment. Vitest failed before running because Vite tried to write `node_modules/.vite-temp/vitest.config.ts.timestamp-...mjs` and got `EPERM`.

