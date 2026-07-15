# Pause-on-idle + room retention/TTL — combined design (Q3 + the other half)

Dated 2026-07-15. **Design record; implementation gated (see §7).** Q3 (pause
turn-alarms when `connected==0`) and room retention/TTL are two halves of one
change and are designed + gated together: Q3 makes an abandoned room **inert but
immortal**, so it removes the auto-play burn and *creates* an accumulation that
retention must reclaim. Builds on: the corrected Q3 design in
[free-tier-efficiency.md](free-tier-efficiency.md) §4, the deadline decision
table in [room-timing.md](room-timing.md) §2–3, and the delete-metering research
(§6 here). Everything stays game-agnostic and preserves dump→replay.

## 0. The interaction (why together)

Before Q3, an abandoned playing room auto-plays to `finished` (deadlines
deleted, alarm cleared) — bounded burn, then it hibernates but its rows persist
forever (no GC). After Q3, an abandoned room **freezes** at the pause point and
never advances — zero further burn, but its rows persist forever *and* it never
even reaches a "finished" state a purge could key on. So Q3 shifts the problem
from *compute* (urgent: ~11.5k rows/day/room, confirmed live on P2FFYD/YM2C72/
M74D3N) to *storage* (low urgency: 5 GB cap, per-room rows tiny, but unbounded).
Retention closes the second half. **Reframe from the research:** purging spends
the SCARCE meter (rows-written, 100k/day, fail-closed) to reclaim the ABUNDANT
one (storage) — so retention is deliberately LAZY, not eager.

## 1. The unified alarm model

One DO, one alarm slot. Today `scheduleAlarm()` arms `min(hello-probe due,
min(seat-deadline due))`. The combined design makes it:

```
scheduleAlarm() arms MIN of:
  (a) hello-probe due            — if armed & unfired (unchanged; guess-number M0 probe)
  (b) min(seat-deadline due_at)  — ONLY when connectedSeats() is non-empty   ← Q3
  (c) ttlDueAt()                 — last_active_at + retentionWindow(status)  ← TTL
```

`alarm()` on each wake checks all conditions independently (no need to tag the
wake): drain the hello probe; run the seat-deadline auto-play loop **only if
`connected > 0`** (the Q3 guard — a paused room must not auto-play); and check
the TTL purge **regardless of connectivity** (a paused room past its window
purges itself). This scoping is the crux: the Q3 guard wraps the *seat-deadline
loop only*, never the TTL branch, so a paused room's sole remaining alarm
candidate (c) still fires.

## 2. Q3 — pause when `connected == 0` (corrected design)

Full rationale + the four defects of the naive "fresh budget on resume" draft
are in free-tier-efficiency.md §4 (timer-dodge + permanent-stall, both high;
found by an adversarial skeptic). The corrected mechanism:

- **Pause (connected 1→0, room `playing`):** record `pause_started_at`; cancel
  the seat-deadline alarm (scheduleAlarm omits candidate (b) while `connected==0`);
  deadline rows are **frozen** (kept, not advanced). Stamp `last_active_at = now`
  (a disconnect is a human event). The DO's only remaining candidate is (c) the
  TTL, far in the future → it hibernates at ~$0 until a reconnect or the TTL.
- **Resume (connected 0→1):** `offset = now − pause_started_at`; shift every
  frozen deadline's `due_at` and `base_due_at` by `+offset` — this **preserves
  each actor's remaining budget as a duration** (a 2 s remainder stays 2 s; a
  disconnect grace preserves *its* remaining, honoring I4). Then a **bespoke
  `'resume'` recompute re-arms ALL expected actors** (grace for any still-absent),
  and re-arm the alarm. Stamp `last_active_at = now`; clear `pause_started_at`.
  `'resume'` is neither `'decision'` (which grants fresh budgets — the dodge) nor
  `'presence'` (which touches only changed seats — the stall).
- **`alarm()` seat-deadline guard:** an explicit `connected==0` (or
  `pause_started_at != NULL`) guard at the top of the seat-deadline loop, so no
  other wake (probe, TTL, at-least-once re-delivery) drains frozen rows.

M4-consistency: a pause **freezes and conserves** budget, never manufactures it.
I2 generalizes to "no presence/pause sequence grows the remaining budget within a
decision point"; `base_due_at` is re-anchored (wall-clock was frozen while nobody
watched), but the *duration* left is invariant. Deadlock-freedom: vacuous at
`connected==0` (no present player to stall), standard at `connected>0`.

## 3. TTL self-purge

**Per-room, self-driven — no external enumeration.** Each room's own DO decides,
on its own alarm wake, whether it is past its retention window and purges itself.
This sidesteps the "you cannot list DOs / recover codes from `idFromName`"
problem entirely (that only constrains the *manual* §4 script).

- **Activity clock — no write amplification.** New `room.last_active_at INTEGER`
  column (migration-probed like `seed`/`timing_json`), stamped ONLY on
  *human-interaction* events: create, claimSeat/setConfig/setTiming, start,
  hello-connect, disconnect. **NOT on game actions** — so an auto-playing or
  paused room does not keep refreshing its own clock (that would make it immortal
  by construction), and there is no per-action write added. For any abandoned
  room, `last_active_at` = when the last human touched it (the right retention
  anchor). These are all already-writing, infrequent paths.
- **Eligibility:** `now − last_active_at > retentionWindow(status)` AND the room
  is in a purge-eligible state (§4). `ttlDueAt() = last_active_at +
  retentionWindow(status)` feeds scheduleAlarm candidate (c); re-stamped
  `last_active_at` pushes it out automatically.
- **Purge primitive:** `ctx.storage.deleteAll()` + `ctx.storage.deleteAlarm()`
  (the compat date is ≥ 2026-02-24, so deleteAll also clears the alarm, but call
  deleteAlarm explicitly for clarity). `deleteAll()` is the ONLY operation that
  reclaims a DO's storage (§6); row-wise DELETE and DROP TABLE do not (DROP leaves
  metadata). One-DO-per-room means the retention unit is the whole DO's storage —
  a perfect fit for `deleteAll()`.

## 4. Retention defaults (proposed, justified)

Windows are a **floor** (never purge before this), deliberately generous — the
scarce resource is write-budget, not storage, so there is no reason to reclaim
early. All measured from `last_active_at`.

| Room state | Window | Justification |
|---|---|---|
| **lobby-abandoned** (`status='lobby'`, `connected==0`) | **48 h** | Tiny (a few rows) so reclaiming saves ~nothing; the cost is being wrong when family trickles in from a group chat. 48 h covers "made a room last night, everyone joins tomorrow." Not aggressive. |
| **paused mid-match** (`status='playing'`, `connected==0`) | **14 days** | The friendliest case — someone may come back and resume the exact remaining clock (Q3). Err generous: days, not minutes. Two weeks says "we'll keep your game for a fortnight." |
| **finished** (`status='finished'`) | **7 days** | Holds the full match (~10–20k rows — the real storage). A week is ample to dump→replay anything interesting (via the §4 script) before reclaiming. |

Rooms with `connected>0` are **never** TTL-eligible (someone is present). The
windows are constants in `src/shared/` (game-agnostic, like `RoomTiming`), tunable
without touching the engine. **Replay preservation:** the window IS the guarantee —
anything worth keeping is dumped within it (`scripts/dump-room.ts` / the §4
script); after the window an abandoned room is genuinely disposable. No silent
destruction: a purge is logged (`logMutation` actionType `'roomPurged'`) with the
room code, final seq, status, and age, so the audit log records what left even
though the SQLite is gone.

## 5. Composition + liveness (for the property test / audit)

New/undamaged invariants, on top of room-timing.md I1–I4 / DL1–DL3:

- **P1 (pause safety):** `connected==0` ⇒ no seat-deadline alarm candidate and
  `alarm()` never advances game state (no auto-play). `connected>0` ⇒ every
  expected actor has a row due ≤ max(clamp(timeout), 60 s), alarm armed at
  min(due). *(Deadlock-freedom: vacuous when empty, standard when present.)*
- **P2 (budget conservation):** across a 1→0→1 pause/resume, each expected
  actor's *remaining* budget is preserved (no fresh clock, no I4 grace re-anchor
  beyond the frozen offset). A pause never lets a player present at the 0→1 edge
  gain budget (kills the timer-dodge).
- **P3 (resume completeness):** on 0→1, ALL expected actors are re-armed (not just
  the reconnecting seat) — a present non-actor can never be left waiting forever
  on an absent on-turn actor.
- **T1 (TTL liveness/safety):** a paused or finished room past its window is
  purged on its next alarm wake; a room with `connected>0` or within its window is
  never purged; the TTL branch runs regardless of the Q3 seat-deadline guard.
- **T2 (no purge-loop burn):** the TTL alarm is a single far-future wake, not a
  poll; it re-arms only while an active purge is trickling (§6 per-row branch) and
  stops arming once storage is reclaimed — cleanup never becomes a burn source.

The `deadline-liveness.property.test.ts` gains a **connected-count dimension** and
a **wall-clock-advance/TTL dimension**: random interleavings of action / connect /
disconnect / alarm-fire / clock-advance across all presets (incl. untimed) and
hot-seat, asserting P1–P3 + T1–T2 after every event, and specifically the 1→0
freeze, the 0→1 remaining-budget conservation, and "alarm never advances a paused
room."

## 6. `deleteAll()` billing — the one measured unknown (owner-assisted)

The single fact the *eagerness* of retention hinges on: **is `ctx.storage.deleteAll()`
billed flat, or per-row like SQL DELETE?** Cloudflare documents no carve-out
(VERIFIED: the blanket rule is "Deletes are counted as rows written"; sources in
STATUS gating notes, fetched 2026-07-14), and `deleteAll()` is a Storage-API
primitive (not a SQL cursor), so it *might* be flat — but this is genuinely
undocumented and **must be measured on the live Free account.**

- **Default = per-row (conservative, safe).** A one-shot `deleteAll()` of a
  ~10–20k-row finished match would then spike ~10–20 % of the daily cap. Since
  purges are RARE (only rooms past a 7–14 day window, a trickle at family scale)
  and retention is low-urgency, the first cut can still use a single `deleteAll()`
  per eligible room and simply **cap purges per alarm wake to one room** — one
  20k-row purge/day is affordable against 100k with normal gameplay far below cap.
  If real purge volume ever rises, switch to a budgeted trickle: batched row-wise
  `DELETE … LIMIT N` per coarse (minutes) alarm tick under a daily row budget,
  then a final `deleteAll()` (cheap on the emptied DB) to reclaim metadata.
- **If the measurement shows flat:** drop all budgeting — purge = one
  `deleteAll()` at TTL, unconditionally cheap. This is the target.
- **Measurement plan (needs the account rows-written meter, which the
  wrangler OAuth token cannot read — 9106):** create a throwaway room, auto-play
  it to ~10–20k rows, read the meter, `deleteAll()` that DO, read the meter again.
  Options to get the meter delta: (a) owner reads the Cloudflare dashboard
  before/after; (b) owner creates a scoped **Analytics-read API token** so it can
  be queried via GraphQL; (c) approved browser automation reads the dashboard.
  Non-blocking: the conservative default ships without it; a favorable result only
  unlocks the eager (unbudgeted) branch.

## 7. Gates + sequencing

Q3 is the urgent half; retention is the low-urgency half. Both land behind the
full regime the owner mandated (and the doc's own warning: the corrected Q3 came
from a single adversarial lineage — re-audit independently, do not trust it
because it caught the first bug):

1. **Q3 pause** — implement §2; extend the property test (connected-count
   dimension: P1–P3); wire-level e2e (drop all sockets mid-hand → no auto-play
   while paused → reconnect → *remaining* clock, not fresh → game continues).
2. **TTL retention** — implement §3–§4; extend the property test (TTL dimension:
   T1–T2); e2e (fast-clock room past a tiny test window → self-purges → GET /info
   → 404; a `connected>0` room never purges; a within-window room never purges).
3. **Cross-model audit** — Codex on resync/liveness continuity (the 1→0 / 0→1
   transitions, the alarm-guard scoping, purge-vs-replay) + Grok on the invariant
   sweep (I1–I4 / DL1–DL3 / P1–P3 / T1–T2 under pause + TTL). Then a live drill,
   including stopping the three real zombie rooms via the §4 script.
4. **PLAN corrections folded in** — replace the false TTL claim (§4/§1.6/§8) with
   the real mechanism above, and fix the five descriptive drifts R3 found, in one
   PLAN pass.

Boundaries held: engine stays time-free and TTL-unaware (retention windows are
room-layer constants keyed on `status`, not a game rule); the DO never learns
what a Guandan hand is; RuleVariant untouched; wire protocol additive-only.
