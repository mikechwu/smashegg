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
on its own alarm wake, whether it is past its retention window and *eligible* to
self-purge — but **whether eligibility triggers an actual purge depends on the
§3.1 policy** (lobby-abandoned: yes; played-out: only in eager mode). This
sidesteps the "you cannot list DOs / recover codes from `idFromName`" problem
entirely (that only constrains the *manual* §4 script).

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
  (compat ≥ 2026-02-24, so deleteAll also clears the alarm, but call deleteAlarm
  explicitly for clarity). `deleteAll()` is the ONLY op that reclaims a DO's
  storage (§6); row-wise DELETE and DROP TABLE do not (DROP leaves metadata).
  One-DO-per-room means the retention unit is the whole DO's storage — a perfect
  fit for `deleteAll()`.

### 3.1 What the TTL actually DOES — resolving the eager/lazy contradiction (owner catch)

Auto-purging *any* played-out room on a timer IS eager reclamation, and if
`deleteAll()` is per-row billed (§6, unmeasured) that spends the SCARCE meter
(rows-written, 100k/day, fail-closed) to reclaim the ABUNDANT one (storage, 5 GB,
per-room tiny) — exactly what the research said not to do. So "the TTL purges the
room after the window" is only correct for the CHEAP case. Resolved policy, keyed
on the meter asymmetry (and a `RETENTION_MODE = 'lazy' | 'eager'` room-layer
constant, default `'lazy'` until §6 measures `deleteAll()`):

| Room state | Rows | Lazy branch (default) | Eager branch (deleteAll measured flat) |
|---|---|---|---|
| **lobby-abandoned** | a few | **auto-purge at window** — cheap even per-row; keeps DO clutter bounded | auto-purge at window |
| **finished / paused** | ~1–23k | **NOT auto-purged** — the TTL arms NO alarm for these; they persist (storage is abundant) and are reclaimed **manually via the §4 script** (owner-initiated, dump-first, batched) | auto-purge at window (now cheap) |

So in the default lazy branch the only automatic self-purge is the lobby case; the
expensive rooms are never time-purged (that is the meter-asymmetry trap). A room's
storage growth is therefore genuinely unbounded-but-slow — which is FINE: reaching
5 GB at family scale (~1 MB/room, ~1–23k tiny rows) needs thousands of rooms, so
the owner has years before manual reclamation is even wanted, and the §4 script is
the sanctioned way to do it. `RETENTION_MODE='eager'` is a one-constant flip once
the measurement proves `deleteAll()` flat. **Crucially, PLAN must describe THIS**
(auto-purge lobby-abandoned only in lazy mode; §4-manual for played-out; eager-all
gated on the measurement) — asserting "self-purges abandoned rooms" unconditionally
is precisely the §4/§1.6/§8 false-TTL drift that survived four audits.

### 3.2 Deploy transition — pre-existing paused rooms have no `pause_started_at` (owner catch)

Q3 stamps `pause_started_at` on the 1→0 transition. A room already at
`connected==0` when Q3 deploys (the three zombies; or a family room where everyone's
wifi drops *during* a deploy) never had that transition under the new code, so
`pause_started_at` is NULL — and the `alarm()` guard half is fine (it keys on
`connected==0`), but the resume half computes `offset = now − pause_started_at`
with a NULL → a garbage shift (NaN/immediate-timeout). The clean-state property
tests start every case from a fresh room and are **structurally blind** to this
migration case.

**Resolution — lazy-stamp in the constructor (the single choke point that runs on
every wake, before both `alarm()` and any `hello`/resume):** if
`room.status==='playing' && connectedSeats().isEmpty() && pause_started_at IS NULL`,
set `pause_started_at = now`. At constructor time `this.sessions` is rehydrated
from `getWebSockets()` and does NOT yet include an incoming reconnect (that socket
is accepted later in `fetch`), so a resuming room is still seen as empty here and
gets stamped *before* the resume math runs. Semantics: we cannot recover the true
pause instant for a pre-Q3 room, so we treat "first wake under Q3" as the pause
start — safe (bounded; non-exploitable, since it only applies to rooms that were
*fully* empty at deploy, where there is no present player to dodge) and slightly
generous (the pre-Q3 paused interval is not charged). Resume then always sees a
non-NULL `pause_started_at`. **Why "first observe" is the RIGHT boundary (not
merely non-NULL):** it defines "paused" as the moment the new code first sees
`connected==0`, and deliberately does NOT back-date the real disconnect. That is
correct — the pre-Q3 interval was the *old* code auto-playing, and the frozen
deadlines already reflect that world, so no time should be credited for it.

**Pinned decision — the guard path always freezes at exactly 0 remaining (owner
catch).** There are two ways into pause with different profiles: the normal 1→0
(handleSocketGone) freezes whatever remained (0–45s); the constructor guard fires
only on the deploy transition, and since a pre-Q3 room's alarm fired *because a
deadline was due*, the frozen `due_at ≈ pause_started_at`, so remaining ≈ 0.
Consequence: the first player to reconnect into a guard-paused room has that
0-remaining deadline shifted to ≈now → it auto-plays ONE default action almost
immediately. **This is intended and correct** — it manufactures no budget (the
deadline was already due; it's exactly what the old code would have done) — but it
is a *distinguishable* path, so the named test states it **explicitly** rather than
letting it fall out by accident. **Do NOT add a resume floor / minimum grace to
soften it:** a floor would re-introduce the very 0→1→0 timer-dodge the skeptic
found (cycle a reconnect to refresh budget). Post-Q3 there is no guard-path pause
for normally-paused rooms — the 1→0 path cancels the alarm, so no alarm ever fires
on a 0-connected room.

### 3.3 The TTL must gate on LIVE SOCKETS, not elapsed time (owner catch — Q1 interaction)

Q1's edge auto-response (already live) answers pings WITHOUT waking the DO, so a
player who creates a room and sits in the lobby waiting for family generates ZERO
DO activity — `last_active_at` never moves. On the time axis an *occupied* lobby
and an *abandoned* one are identical, so a purely elapsed-time TTL would
`deleteAll()` a room someone is actively sitting in (the exact trickle-in-from-a-
group-chat scenario; raising the 48h threshold only postpones it). Worse,
`connectedSeats()` counts CLAIMED seats, so a lobby visitor who hasn't claimed a
seat yet has 0 connected seats even with a live socket. **Fix:** the TTL branch
(and its scheduleAlarm candidate) require `ctx.getWebSockets().length === 0` — the
live SOCKET count, not the seat count — so an occupied room is never purged. The
Q3 seat-deadline pause keeps keying on connected *seats* (it protects actors, the
M4 semantics); only the retention TTL keys on live sockets. **INVARIANT (T3, for
Grok's sweep): the TTL never purges a room with a live socket.**

**Known limitation (accepted, recorded so nobody assumes TTL is exhaustive):**
because T3 is unconditional, a **half-open socket** (client gone, edge still
holds the connection) keeps a lobby room immortal — the TTL never fires. The
consequence is trivial: a few rows in the abundant storage meter, and lobby rooms
never auto-play, so there is no burn. Q1's `setWebSocketAutoResponse` + the
client's onOpen resync are the mitigation for half-open detection elsewhere;
here we deliberately prefer "never purge something that might be occupied" over
"reclaim a few rows." If half-open lobby accumulation ever mattered, the §4
manual script reclaims them by explicit code.

**Two-questions/two-predicates, enforced by the type system:** the counts are
BRANDED — `ConnectedSeatCount` ("is there an actor?" → pause/auto-play) and
`LiveSocketCount` ("is anyone here?" → TTL) — so a swap at any binding site is a
compile error, not a silent T3 death (retention.ts). The `as`-cast is confined to
`asSeatCount`/`asLiveSocketCount` at the source; Codex audits those bindings (§7).

## 4. Retention windows (proposed, justified) — ELIGIBILITY floors

Windows are the **floor** before a room is even *eligible*; whether eligibility
then triggers an auto-purge depends on §3.1 (lobby: yes; played-out: only in eager
mode). Deliberately generous — the scarce resource is write-budget, not storage.
All measured from `last_active_at`.

| Room state | Window | Justification |
|---|---|---|
| **lobby-abandoned** (`status='lobby'`, `connected==0`) | **48 h** | Tiny; the cost of being wrong is a family trickling in from a group chat. 48 h covers "made a room last night, everyone joins tomorrow." Auto-purged (cheap). |
| **paused mid-match** (`status='playing'`, `connected==0`) | **14 days** | Friendliest case — someone may resume the exact remaining clock (Q3). Err generous: days, not minutes. Eligibility only; reclaimed manually (§4) in lazy mode. |
| **finished** (`status='finished'`) | **7 days** | Holds the full match (~1–23k rows). A week is ample to dump→replay before reclaiming. Eligibility only; reclaimed manually (§4) in lazy mode. |

Rooms with `connected>0` are **never** TTL-eligible (someone is present). Windows +
`RETENTION_MODE` are constants in `src/shared/` (game-agnostic, like `RoomTiming`),
tunable without touching the engine. **Replay preservation:** the window IS the
guarantee — anything worth keeping is dumped within it; after it an abandoned room
is disposable. No silent destruction: every purge is logged (`logMutation`
actionType `'roomPurged'`) with the code, final seq, status, and age, so the audit
log records what left even though the SQLite is gone.

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
- **P4 (deploy-transition safety — §3.2):** for any state reachable with
  `status='playing' && connected==0 && pause_started_at IS NULL` (a room paused
  before Q3 existed), the constructor stamps `pause_started_at` before any resume
  math runs, so resume never computes a NULL offset — no NaN shift, no fresh clock,
  no mass immediate-timeout, no auto-play burst. *(This is the invariant the
  clean-state tests are blind to; it needs an explicit migration-case test.)*
- **T1 (TTL safety, per §3.1):** a room with `connected>0` or within its window is
  NEVER purged. In lazy mode only **lobby-abandoned** rooms auto-purge at their
  window; **finished/paused** rooms are never auto-purged (reclaimed via §4). In
  eager mode all eligible rooms auto-purge. The TTL branch runs regardless of the
  Q3 seat-deadline guard (a paused lobby... n/a; a paused *playing* room's TTL is
  eligibility-only in lazy mode).
- **T2 (no purge-loop burn):** the TTL alarm is a single far-future wake, not a
  poll; a room arms a TTL candidate ONLY when it has an auto-purge to perform
  (lobby in lazy; any eligible in eager), and stops arming once purged — cleanup
  never becomes a burn source, and a played-out room in lazy mode arms no TTL alarm
  at all (it just persists until §4).
- **T3 (never purge an occupied room — §3.3):** the TTL keys on
  `ctx.getWebSockets().length === 0` (live sockets), NOT on connected seats or
  elapsed time, so a lobby with a live-but-idle/seatless socket — which leaves no
  `last_active_at` trace because Q1's auto-response never wakes the DO — is never
  purged.

The `deadline-liveness.property.test.ts` gains a **connected-count dimension** and
a **wall-clock-advance/TTL dimension**: random interleavings of action / connect /
disconnect / alarm-fire / clock-advance across all presets (incl. untimed) and
hot-seat, asserting P1–P4 + T1–T3 after every event, and specifically the 1→0
freeze, the 0→1 remaining-budget conservation, "alarm never advances a paused
room," a **live-but-seatless socket → TTL never fires** case (T3), and — the case
the clean-state harness cannot generate on its own — a **seeded pre-paused room**
(`pause_started_at` forced NULL with 0 sockets mid-play) that is then reconnected,
asserting P4 **and stating explicitly that exactly one 0-remaining default action
auto-plays on reconnect** (the guard-path pin, §3.2 — not softened by any floor).

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

1. **Q3 pause** — implement §2 + the §3.2 constructor lazy-stamp; extend the
   property test (connected-count dimension: P1–P4, **including the seeded
   pre-paused/deploy-transition case P4**); wire-level e2e (drop all sockets
   mid-hand → no auto-play while paused → reconnect → *remaining* clock, not fresh
   → game continues; **plus a room forced into the pre-Q3 paused state → reconnect
   → sane remainder, no burst**).
2. **TTL retention** — implement §3–§4 with `RETENTION_MODE='lazy'` (auto-purge
   lobby-abandoned only; played-out via §4); extend the property test (TTL
   dimension: T1–T3); e2e (fast-clock lobby room past a tiny test window →
   self-purges → GET /info → 404; a `connected>0` room never purges; a
   within-window room never purges; **a finished room in lazy mode is NOT
   auto-purged**; **a genuinely SEATLESS live socket — a client that connects to a
   lobby and never claims a seat, held past the window — is NOT purged and armed
   no TTL alarm** [the only test that catches a mis-bound count]).
3. **Cross-model audit** — Codex on resync/liveness continuity (the 1→0 / 0→1
   transitions, the alarm-guard scoping, purge-vs-replay, **the §3.2
   deploy-transition stamp — verify no reachable NULL-offset resume — the
   guard-path 0-remaining reconnect behavior — verify exactly one default action
   auto-plays and no fresh budget is manufactured — AND the ARGUMENT-BINDING SEAM:
   the brands make swapping two branded values a compile error, so the ENTIRE
   residual surface is the SOURCE CHOICE at the two construction accessors
   (`seatCount()` / `socketCount()`) — audit that those two lines bind
   seats↔`connectedSeats()` and sockets↔`getWebSockets()`, and that no other site
   re-constructs a brand — AND the fail-safe NULL anchor/status in the purge
   gate**) + Grok on the invariant sweep
   (I1–I4 / DL1–DL3 / P1–P4 / T1–T3 under pause + TTL, **whether §3.1's lazy policy
   ever spends the scarce meter to reclaim abundant storage, stamp≡pause, whether
   any new COMMENT overstates what the code delivers (the eager-flip lesson), and
   T3:
   that no reachable state purges a room with a live socket**). Then a live drill.
   Audit brief MUST call out all owner catches explicitly: (a) the deploy-transition
   `pause_started_at`-NULL case the clean-state tests miss; (b) that no
   time-triggered purge of an expensive room runs in lazy mode; (c) the
   live-socket TTL gate (an idle/seatless-but-connected lobby is never purged);
   (d) the guard-path 0-remaining pin (intended, no floor); (e) the branded-count
   argument-binding seam; (f) the fail-safe NULL anchor (an undeterminable
   retention anchor arms no TTL, never an immediate `deleteAll()`).
4. **PLAN corrections folded in** — replace the false TTL claim (§4/§1.6/§8) with
   the real §3.1 mechanism (lazy: lobby-only auto-purge; played-out manual; eager
   gated on the measurement), and fix the five descriptive drifts R3 found, in one
   PLAN pass. Also correct §4's pre-M4 fresh-clock description (R3 medium) — the
   doc is currently teaching the M2 bug the code already killed.

Boundaries held: engine stays time-free and TTL-unaware (retention windows are
room-layer constants keyed on `status`, not a game rule); the DO never learns
what a Guandan hand is; RuleVariant untouched; wire protocol additive-only.
