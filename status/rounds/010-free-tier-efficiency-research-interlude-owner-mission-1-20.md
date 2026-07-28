> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Free-tier efficiency research interlude (owner mission §1, 2026-07-14) — PROPOSE, awaiting sign-off

Question-first research pass on a batch of free-tier proposals; deliverable
[docs/research/free-tier-efficiency.md](docs/research/free-tier-efficiency.md).
Research-only — **no efficiency code has landed; the action set awaits owner
sign-off** (§0 M4 close-out changes below did land). Method: framing before
findings (METHODOLOGY practice 5), 5 Cloudflare-docs verifiers (VERIFIED with
source URLs + 2026-07-14 fetch dates), 1 empirical rows/match measurement, and
2 Opus adversarial skeptics — **both the load-bearing Q3 design and the Q2
arithmetic were found wrong on first pass and corrected** (the value of the
adversarial pass). Two of the owner's premises were contradicted by the source
and reported plainly.

- **Q1 (auto-response): ALREADY DONE.** `setWebSocketAutoResponse('ping','pong')`
  is live (game-room.ts:195); VERIFIED it answers without waking the DO / no
  duration; presence is close-event-driven so the no-wake behavior can't touch
  liveness. No action.
- **Q2 (zombie/TTL): NO TTL exists; the real risk is bigger than estimated.** The
  binding meter is **rows-written**, not requests: an abandoned mid-match room
  auto-plays the *entire* remaining match at ~1 wake/60s ≈ **~11.5k rows/day per
  room** for possibly multiple days; **~8–9 concurrent abandoned rooms approach
  the 100k rows/day cap** (corrects the request-axis "dozens" estimate). Rows/
  action corrected to ~8 (missed the `actions_seen` TEXT-PK auto-index; DELETE
  and setAlarm both count). Measured ~9–23k rows/match (degenerate defaultAction
  baseline — real play differs).
- **Q3 (pause on connected==0): right direction, first design BROKEN, corrected.**
  Skeptic found a timer-dodge (HIGH) + a permanent-stall (HIGH) + 2 medium. Fix:
  preserve *remaining* budget as a duration at pause, re-arm *all* actors on
  resume (not the changedSeats path), guard `alarm()` with connected==0 — M4/I2/
  I4-consistent. Load-bearing → property-test + wire e2e + Codex/Grok audit at
  implementation. Strictly better than the pre-rejected purge (preserves room +
  replay).
- **Q4 (rate limiting): cheap easy-yes, low urgency.** Vector confirmed
  (unauthenticated `POST /api/rooms`); zone WAF/rate-limit rules don't apply to
  `*.workers.dev`; the fit is the native Workers `ratelimits` binding (~10 lines,
  $0) + a client retry-loop guard — pending a Free-plan availability smoke test.
- **Q5 (rejections): both UPHELD (verified).** Hibernation discards in-memory
  state after ~10s idle → batching unsafe under 45s clocks; static-asset requests
  are already free/unlimited off the Worker meter → caching saves nothing and
  would reintroduce the skew bug. The one safe row-reduction kept: merge the two
  per-action snapshot UPDATEs (−1 row/action).
- **Recommended sequence:** (1) trivial snapshot-UPDATE merge; (2) Q3 corrected
  design, gated; (3) Q4 binding after a smoke test; no-ops Q1/Q5-batch/Q5-cache;
  defer a SQLite retention sweep to M5+.

### Sign-off + expansion (owner, 2026-07-15) — APPROVED + retention/TTL + cleanup script

All three approved (Q3 pause corrected / Q5-merge / Q4 ratelimits). Owner pulled
retention/TTL forward from M5+ (it is the other half of Q3 — Q3 makes abandoned
rooms *inert but immortal*, so it removes the burn and creates accumulation;
design+gate them together) and added an owner-facing cleanup/inspection script.

**§1 live-burn check — CONFIRMED, and it validates Q2's arithmetic.** The likely
zombie generator is our own dev process, not the family. Direct per-room probe
(GET /api/rooms/CODE, no auth) found THREE M4-drill rooms still auto-playing,
0 connected: **P2FFYD (seq 109→110), YM2C72 (133→134), M74D3N (105→107)** over
81s — the ~1 action/60s disconnect-grace cadence, i.e. ~11.5k rows/day EACH
(~34.5k/day for all three, ~⅓ of the 100k/day cap) and climbing until each match
auto-completes (~1–2 more days at seq ~110). This is the live-data validation the
owner wanted — the model was right. NULL result: the account-wide rows-written
aggregate could not be pulled programmatically (wrangler's OAuth token is
rejected by the GraphQL analytics API, 9106); the per-room probe is the direct
evidence instead. These 3 rooms are to be stopped via the §4 cleanup script once
it lands (burn is slow — ~24 rows/min total — so no hasty destructive purge).

**Q5-merge: LANDED.** applyGameAction now writes seq+state_json in ONE combined
UPDATE (was bumpSeq's seq UPDATE + a separate state UPDATE) — −1 row-write/action
(~12%). Behavior-preserving (609 unit + 25 e2e green; e2e covers seq advancement
+ resync). game-room.ts ~1197.

**Gating research landed (read-only workflow):**
- **Delete-metering (the §3 gotcha) — MIXED, one decision-critical UNCERTAIN.**
  Row-wise DELETE is billed per row (+ index entries), so purging a 10–20k-row
  match row-by-row costs a comparable chunk of the 100k/day cap — the disease is
  real. `ctx.storage.deleteAll()` is the ONLY op that reclaims a DO's storage,
  and is a Storage-API primitive (not a SQL query) so it MIGHT be flat-billed —
  but Cloudflare documents no carve-out, so its cost is genuinely UNKNOWN and
  **must be measured on the live Free account.** DROP TABLE doesn't reclaim
  storage; a DO never self-deletes. **Reframe:** Q3 stops the URGENT compute burn;
  retention only reclaims ALREADY-accumulated STORAGE (abundant 5GB, tiny/room) —
  purging spends the SCARCE meter to save the ABUNDANT one, so if `deleteAll()`
  is per-row, retention should be LAZY/storage-pressure-gated, not eager. The
  design forks on the `deleteAll()` measurement; the conservative (lazy) branch is
  safe either way and is the default until measured.
- **PLAN documentation-drift sweep — 7 findings (the process win the owner asked
  for).** The known one is worse than thought: "A room-TTL alarm also self-purges
  abandoned rooms" appears in **§4, §1.6 AND §8** (a reader hits the false claim
  three times) — and STATUS already recorded the gap under Q2 but PLAN was never
  corrected (exactly the drift-survives-audit failure mode). Five more are
  descriptive text that fell behind a MORE-capable implementation: §4 hibernation
  (claims seat-tagged sockets + `{seat,tokenHash}` attachment → really no tags +
  `{seats: Seat[]}`), §6 dump route (`/api/debug/rooms/:code/dump` + `players` →
  really `/api/rooms/:code/dump` + `seats` + an `actions` array), §5 reconnection
  step 4 ("returns the recorded event" → really sends `resync`, never re-applies),
  §4 deadline recompute (still describes the pre-M4 fresh-clock mechanism = the
  M2 bug the code was redesigned to kill), §5 hello (`token` → `tokens[]`, action
  missing `seat`), §4 schema (`players` w/ connected/last_seen_seq → really
  `seats` w/o them). Everything load-bearing else CHECKED-CLEAN (dump gating,
  redaction, idempotency ledger + reserved namespace, single-writer, advisory
  expectedSeq, version-skew, agnosticism, ping-pong). **Correction plan:** fold
  the TTL-claim fix into the §3 TTL implementation (so PLAN describes the real new
  mechanism, not just "none"); correct the 6 descriptive drifts in the same PLAN
  pass. METHODOLOGY self-correction: a design doc that asserts an unbuilt
  mitigation lets a real gap survive audits — the PLAN sweep is now a standing
  check when a milestone claims a mechanism.
- **DO enumeration — REFUTED for code-driven purge (re-run gave real data; first
  run was junk).** The namespace-objects LIST API
  (`GET .../durable_objects/namespaces/{id}/objects`) exists and returns hex `id`
  + `hasStoredData`, but NOT the name — and `idFromName` is one-way (`ctx.id.name`
  is `undefined` when rebuilt via `idFromString`, the only thing a listed hex ID
  gives you). So enumeration can't recover room codes → it's only a coarse audit
  ("does orphan storage exist my registry doesn't know?"). **§4 script model:**
  explicit room codes (owner-supplied / STATUS-recorded) as primary input,
  re-derived via `idFromName(code)`; the per-room self-purge TTL (§3) needs no
  enumeration; an optional future "list all rooms" capability uses a
  **write-once-at-creation KV registry** (1 KV write/create — the idle 1,000/day
  KV meter, NOT the scarce rows-written meter; `expirationTtl` doubles as registry
  retention). Registry is deferrable — the 3 known zombies + on-demand cleanup
  need only explicit codes.

**Then:** §3 TTL + Q3 designed+gated together (`scheduleAlarm` = min(TTL,
seat-deadlines-when-connected>0, probe); Q3's `alarm()` guard scoped so a TTL wake
still fires; conservative/lazy purge via `deleteAll()`+`deleteAlarm()`, replay
preserved by a retention window) → property test w/ connected-count dimension +
wire e2e + Codex resync/liveness + Grok invariant sweep + live drill → §4 script
(dump-then-delete, token-gated, dry-run default) + PLAN corrections folded in →
Q4 last (after a Free-plan smoke test of the binding). `deleteAll()` billing
measured with owner meter-access to optionally unlock eager purge; the 3 live
zombie rooms stopped once the §4 purge path exists.

### Path A approved + two owner catches folded in (owner, 2026-07-15)

Owner approved **Path A**: implement Q3+TTL now; the `smashegg-analytics` token +
`deleteAll()` measurement are non-blocking (SETUP.md §2.5 always marked token
creation `[HUMAN]` — M0's browser automation was the deviation, not my refusing to
mint credentials via automation). Two of the owner's earlier arguments withdrawn
and recorded: (1) "purge now, 20× cheaper" assumed we'd ever purge — under the
lazy/storage-pressure-gated policy we probably never pay that bill (storage
abundant); (2) the `deleteAll()` measurement was never on the critical path. The
3 zombies are left to burn (~34.5k rows/day, ~⅓ cap, $0) — Q3 freezes them at
~1k rows or they auto-complete first; no detour.

Two real gaps the owner caught (neither the research nor my reframe found them),
now folded into [pause-and-retention.md](docs/research/pause-and-retention.md)
§3.1/§3.2/§5-P4/§7 and the audit brief:
- **Deploy-transition `pause_started_at`-NULL bug.** A room already at
  `connected==0` when Q3 deploys never hit the 1→0 stamp → resume computes a
  NULL offset (garbage shift). The clean-state property tests are structurally
  blind to it. Fix: constructor lazy-stamps `pause_started_at=now` when it wakes a
  playing room with 0 sockets and NULL stamp (before any resume math); + a named
  migration-case test (invariant P4).
- **TTL lazy-branch was self-contradictory.** "TTL reclaims after the window,
  automatically" IS eager reclamation — spending the SCARCE rows-written meter to
  reclaim ABUNDANT storage if `deleteAll()` is per-row. Resolved (§3.1): in the
  default lazy mode, auto-purge **lobby-abandoned only** (a few rows, cheap);
  finished/paused rooms arm NO TTL alarm and are reclaimed **manually via §4** (or
  auto once `RETENTION_MODE='eager'` after the measurement proves `deleteAll()`
  flat). PLAN must describe THIS — the unconditional "self-purges abandoned rooms"
  is exactly the drift that survived four audits.
