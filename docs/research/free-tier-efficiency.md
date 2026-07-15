# Free-tier efficiency — question-first research (M4 → M5 interlude)

Dated 2026-07-14. **Research-only: this document proposes; it implements
nothing.** An outside review proposed a set of free-tier risks/optimizations
and the owner reached preliminary verdicts. Per the brief, the owner's analysis
is INPUT TO VERIFY, not a mandate — where evidence contradicts it, that is
reported plainly below.

**Method (METHODOLOGY practice 5).** Each question was framed BEFORE looking
(§1) — what is asked, what would settle it, resolved-vs-ambiguous. Code claims
are VERIFIED first-hand against the source at cited lines. External-platform
claims were re-fetched from Cloudflare docs on 2026-07-14 (WebSearch/WebFetch;
Firecrawl disabled) and carry source URLs + fetch dates (§2). One empirical
measurement (§3, Q2) ran the real engine. The load-bearing Q3 design and the
Q2 arithmetic were each put through an independent adversarial skeptic — and
**both were found wrong on first pass and corrected** (§4 credits the catches).

Provenance: a background workflow — 1 measurement agent (Sonnet) + 5 docs
verifiers (Sonnet) + 2 adversarial skeptics (Opus, high effort). Model dispatch
per the M4 ladder (Standard→Sonnet for research/measurement, Hard→Opus for the
liveness/arithmetic reasoning).

---

## 0. TL;DR — recommended action set (for owner sign-off)

Two of the proposals were **already done or moot** in the current code; one is a
**genuine, bigger-than-estimated risk**; the two rejections **stand**.

| # | Action | Verdict | Value | Risk/effort | Sequence |
|---|---|---|---|---|---|
| Q3 | **Pause turn alarms when `connected==0`** (CORRECTED design — §4) | DO IT | **High** — kills the one real free-tier risk (zombie auto-play burn, ~11.5k rows/day per abandoned room) | Load-bearing: property-test + wire e2e + Codex/Grok audit | **1st** (gated) |
| Q5-merge | Merge the two per-action `snapshot` UPDATEs into one | EASY YES | ~12% fewer row-writes/action, zero downside | Trivial, safe (same data, one statement) | Can land anytime |
| Q4 | Add the Workers `ratelimits` binding to `POST /api/rooms` (+ client retry-loop guard) | EASY YES (low urgency) | Cheap insurance vs. accidental self-DoS | ~10 lines; **pending a Free-plan availability smoke test** | After Q3 |
| Q1 | `setWebSocketAutoResponse` for pings | **ALREADY DONE** | — | none | no-op |
| Q5-batch | In-memory write batching | REJECT (verified) | — | unsafe under hibernation | — |
| Q5-cache | Aggressive edge caching of static assets | REJECT (verified) | — | moot + reintroduces skew bug | — |
| — | SQLite row/room cleanup (retention) | LATER (M5+) | the one genuinely unbounded-but-slow growth | must preserve replay | future milestone |

**The headline:** the real free-tier exposure is NOT request count or duration —
it is **rows-written**, driven by **abandoned rooms auto-playing entire matches**.
Q3 removes that at the source. Everything else is a rounding error by comparison.

---

## 1. Question-first framing (pre-registered, before findings)

### Q1 — `setWebSocketAutoResponse` for pings
- **Asking:** do we already set it? Does it wake the DO / bill duration? Is our
  bare `'ping'` a protocol frame or an app string? Does presence/liveness depend
  on pings waking the DO? Is 25s a good interval?
- **Settles it:** the DO constructor + client `connection.ts` (code); Cloudflare
  docs on the wake/billing + protocol-vs-app distinction (fresh fetch).
- **Resolved:** whether it's implemented. **Ambiguous until fetched:** exact
  billing wording + the protocol-frame auto-reply.

### Q2 — zombie-room burn + the TTL question
- **Asking:** is there a room TTL at all? What does an abandoned/auto-played
  Guandan room cost (requests, rows, GB-s)? How many concurrent zombies to
  matter? Real rows/action for Guandan (guess-number's ~4.4 may not transfer)?
- **Settles it:** the alarm/TTL machinery (code); an empirical measurement of a
  full auto-played match; the Cloudflare rows-written metering definition.
- **Resolved:** no-TTL; per-action write set (code). **Ambiguous until
  measured/fetched:** actions/match; does DELETE count as a write?

### Q3 — pause turn alarms when `connected==0`
- **Asking:** is pausing safe against DL1–DL3 / I1–I4 + the untimed/sole-actor
  case? What are the correct pause/resume semantics? Does it contradict the M4
  fresh-clock fix?
- **Settles it:** invariant reasoning + an independent liveness skeptic trying to
  reach a stalled CONNECTED-player state; the property test extended with a
  connected-count dimension (at implementation).
- **Resolved when:** no reachable state has a connected expected actor with no
  armed alarm AND the resume semantics are pinned. **Ambiguous:** the exact
  re-anchor mechanism until stress-tested.

### Q4 — room-creation rate limiting
- **Asking:** what FREE Cloudflare mechanism guards `POST /api/rooms` cheapest,
  chiefly against an accidental client retry loop (not an attacker)?
- **Settles it:** confirm the endpoint is unauthenticated/unbounded (code); fetch
  current free-tier rate-limiting availability + cost.
- **Resolved:** the vector exists. **Ambiguous until fetched:** what's free.

### Q5 — the two rejected proposals
- **Asking:** does hibernation really discard in-memory state under 45s clocks?
  Are static-asset requests really free/unlimited off the Worker meter? Does
  aggressive `index.html` caching reintroduce the skew bug?
- **Settles it:** Cloudflare docs on hibernation memory-discard + idle threshold
  and on static-asset billing; our own M3/M4 revalidation requirement.
- **Resolved:** the `index.html`-revalidation interaction. **Ambiguous until
  fetched:** the hibernation threshold; the free/unlimited assets claim.

---

## 2. Verified platform facts (Cloudflare docs, fetched 2026-07-14)

| Claim | Verdict | Bottom line | Sources (all fetched 2026-07-14) |
|---|---|---|---|
| **Auto-response semantics** | VERIFIED | `setWebSocketAutoResponse` answers "without waking WebSockets in hibernation and incurring billable duration charges." It is the **application-level** mechanism (Cloudflare's own example labels it so); the runtime *separately* auto-pongs protocol-level ping FRAMES (control frames never call `webSocketMessage`). So our bare text `'ping'` genuinely needs the pair — which we have. `getWebSocketAutoResponseTimestamp` is only a timestamp getter (not a documented staleness detector). | durable-objects/api/state/ ; best-practices/websockets/ ; examples/websocket-hibernation-server/ |
| **Rows-written metering** | VERIFIED | On DO SQLite, **DELETE counts as rows written** (per row deleted), UPDATE counts affected rows each run, **`setAlarm()` = 1 row written**, and a **TEXT PRIMARY KEY's implicit auto-index adds +1 row per insert**. Free limit 100,000 rows/day, fails closed at $0. | durable-objects/platform/pricing/ (upd. Jun 19 2026) ; d1/platform/pricing/ (upd. Apr 21 2026) |
| **Hibernation** | VERIFIED | In-memory JS heap is **discarded on hibernation**, constructor re-runs on wake; only Storage-API data + per-socket `serializeAttachment` (≤16KB) survive. **Idle threshold is documented as "Currently … 10 seconds"** (hedged as current behavior, not an SLA). Non-hibernatable idle eviction 70–140s; outbound connections pin for ≤15min. | durable-objects/concepts/durable-object-lifecycle/ ; best-practices/websockets/ |
| **Static assets free/unlimited** | VERIFIED | "**Requests to static assets are free and unlimited.**" Only Worker-script invocations bill as requests. Two narrow, opt-in exceptions (the Cache-API "Workers Caching" flag; `run_worker_first`) — neither triggered by ordinary edge caching. | workers/static-assets/billing-and-limitations/ (upd. Apr 23 2026) ; workers/platform/pricing/ (upd. Jul 7 2026) |
| **Free rate-limiting** | VERIFIED | Zone Rate-Limiting Rules (1 free) + WAF Custom Rules (5 free) are **zone-level → inapplicable to bare `*.workers.dev`** (our current deploy, no custom domain). Turnstile is the wrong shape for a JSON POST. The fit is the native **Workers `ratelimits` binding** — config-only, ~10 lines, "permissive, eventually consistent," GA 2025-09-19 — designed for exactly this casual-abuse case. | waf/rate-limiting-rules/ ; waf/custom-rules/ ; turnstile/plans/ ; workers/runtime-apis/bindings/rate-limit/ ; changelog 2025-09-19 |

**One honest UNCERTAIN in §2:** the `ratelimits` binding's docs page carries **no
explicit Free-vs-Paid statement** (unlike KV/DO, which do). Availability on Free
is *inferred* from (i) no plan-gate language, (ii) it being config-only, (iii)
billing through ordinary Workers usage. → A one-line smoke test on the live free
account settles it before we rely on it; the existing `GameRoom` DO is the
confirmed-Free fallback if it turns out paid-gated.

---

## 3. Per-question findings

### Q1 — auto-response: **ALREADY IMPLEMENTED (VERIFIED, code + docs)**
Contradicts the framing that this is a pending win.
- `src/server/game-room.ts:195` (constructor): `this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))`.
- `src/client/room/connection.ts:27,136`: client sends the bare string `'ping'`
  every 25s on an open socket; ignores `'pong'`.
- The bare `'ping'` is an **application** message, not a protocol ping frame, so
  it is answered cheaply *only because* of that pair (docs §2). The auto-response
  fires **without waking the DO / no duration** — VERIFIED.
- **Liveness interaction (the owner's watch item):** presence is **close-event
  driven** — `webSocketClose`/`webSocketError` → `handleSocketGone` →
  `reconcileDeadlines` (game-room.ts:1458–1488). Pings never reach
  `webSocketMessage` (the auto-response intercepts them). So the "never wakes the
  DO" behavior **cannot** affect presence/deadlines — VERIFIED by code. Nothing
  server-side depends on pings waking the object.
- **Interval:** 25s > the 10s hibernation-idle threshold, which is *correct* — we
  WANT the DO hibernated between real events while pings are auto-answered at the
  edge. 25s is a client/edge keepalive, not a DO keepalive. No change.
- `getWebSocketAutoResponseTimestamp` — not needed (close events + the onOpen
  resync handshake already cover half-open detection; it's undocumented as a
  staleness signal anyway).
- **Action: none.** The proposed win is already banked.

### Q2 — zombie burn + TTL: **no TTL exists; the burn is real and bigger than estimated**
- **There is NO room-TTL alarm anywhere (VERIFIED, code).** The only alarm
  scheduler is `scheduleAlarm()` = min of (the one-shot M0 hello-probe alarm,
  used only by guess-number, never armed in Guandan gameplay) and (seat-deadline
  due-ats). So Q2's "does the TTL treat auto-play as activity?" is **moot** —
  there is no TTL to treat it either way.
- **What actually happens to an abandoned room:**
  - *Playing:* keeps arming turn-deadline alarms and **auto-plays the entire
    remaining match** to `isTerminal`, then `status='finished'` → deadlines
    deleted → `scheduleAlarm` finds nothing → `deleteAlarm` → hibernate at $0.
  - *Lobby:* no alarm at all → hibernates immediately at $0; leaves orphan rows.
  - Nothing garbage-collects SQLite rows, ever.
- **Per-applied-action write set (VERIFIED against code, corrected upward):**
  ~**8 rows** typical (was estimated 6–8): `UPDATE snapshot(seq)` +
  `UPDATE snapshot(state_json)` + `INSERT events` + `INSERT actions_seen` **(=2:
  the `action_id TEXT PRIMARY KEY` auto-index adds +1)** + `INSERT actions` +
  `DELETE deadlines` + `INSERT deadlines`; **+1 for the `setAlarm()`** in the
  async tail; 9 at a terminal/2-actor-tribute action. The two `snapshot` UPDATEs
  are **mergeable to one** (→ −1 row/action). guess-number's ~4.4 did NOT
  transfer — Guandan writes ~2× more (deadline churn + double snapshot write).
- **Measurement (engine, 8 seeds — VERIFIED empirically, with a loud caveat):**
  7–17 hands/match, **1,325–3,235 applied actions/match**, **~9.3k–22.7k rows/
  match**. *Caveat:* driven by `defaultAction` (leader plays the lowest single,
  everyone else passes → uncontested double-up shutouts, only double-tribute).
  This is a reproducible **engine-faithful baseline**, NOT typical human play —
  real contested play (pairs/bombs, more/fewer hands) will differ, direction
  unclear without live data. Treat the order of magnitude (**~10–20k rows per
  full match**) as solid; treat the exact figure as a baseline.
- **The real finding (corrects the owner's estimate — reported plainly):** the
  binding meter is **rows, not requests.** An abandoned *mid-match* room is
  disconnected on every seat, so each next deadline is grace-clamped to 60s → the
  alarm fires **one action per ~60s** for the match's *entire* remaining length:
  ~1,440 wakes/day × ~8 rows ≈ **~11.5k rows/day per abandoned room**, sustained
  for the (possibly multi-day) time the match takes to auto-finish. **~8–9
  concurrently-abandoned rooms approach the 100,000 rows/day account-wide cap** —
  not the "dozens" the request-axis estimate implied. And match length is **not
  provably bounded** under the default `aFailConsequence='suspendPlayOpponentLevel'`
  (a team at A is never demoted; termination needs the all-default trajectory to
  reach a real A-win — it does for typical seeds, but there's no constant bound).
- **Storage:** the one genuinely **unbounded-but-slow** growth (no row cleanup).
  Per-room rows are tiny vs. the 5GB cap, so it takes an enormous room count to
  matter — but it never self-cleans. Flag for a future retention sweep (must
  preserve replay).
- **Action: Q3 is the fix** (it deletes the auto-play burn at the source). The
  write-set micro-opt (merge snapshot UPDATEs) is a nice ~12% trim but secondary.

### Q3 — pause when `connected==0`: **right direction; my first design was BROKEN — corrected in §4**
Summary here; full design + the four defects in §4. Pausing is safe *only* as
vacuous liveness while a room is genuinely empty; every transition edge needs
care. My initial "fresh full budget on resume" was a **timer-dodge** and the
naive resume path was a **permanent stall**. The corrected design (preserve
*remaining* budget, re-arm *all* actors, guard `alarm()`) is M4-consistent.

### Q4 — rate limiting: **cheap easy-yes via the `ratelimits` binding (low urgency)**
- **Vector confirmed (code):** `POST /api/rooms` (`src/server/index.ts:84–88`)
  is unauthenticated and unbounded; each create mints a code and spins a DO that
  writes room+snapshot rows. The owner's read is right: the likely vector is an
  **accidental client retry loop** (private codes, unadvertised URL, fails closed
  at $0), not an attacker.
- **What's free (VERIFIED §2):** zone Rate-Limiting/WAF rules don't apply to our
  `*.workers.dev` deploy; Turnstile is the wrong shape. The **Workers
  `ratelimits` binding** is the fit — `env.LIMITER.limit({key: clientIp})`,
  `period` 10 or 60s, ~10 lines, $0, explicitly "permissive, eventually
  consistent … not an accurate accounting system," counters local to the PoP
  (fine for one client's retries).
- **Recommendation:** an easy yes as defense-in-depth, but **low priority** and
  **pending a 5-minute Free-plan availability smoke test** (the one §2 UNCERTAIN);
  DO-based fallback if paid-gated. Pair it with a **client-side guard** on the
  create-retry loop (the more likely trigger) — cap retries + backoff, so a bug
  can't hammer the endpoint in the first place.

### Q5 — the two rejections: **both UPHELD (VERIFIED)**
- **(a) In-memory write batching — REJECTED, verified.** Hibernation discards
  in-memory state after 10s idle (VERIFIED §2); with 45s turn clocks — and 60s
  spacing during auto-play — the DO hibernates *between* actions, so a batch
  would be lost almost every turn, not just on crash. It also breaks
  persist-before-fanout, the `actions_seen` exactly-once ledger, and dump→replay.
  The zombie finding *does* satisfy the "real ceiling" precondition the rejection
  attached to its safe variant — **but the right lever is Q3** (attacks
  action *count*), not batching (trims only ~1–2 of ~8 rows/action). The **one
  safe row-reduction worth taking** is the trivial snapshot-UPDATE merge (−1 row/
  action, zero durability/replay impact — the snapshot is derivable and the event
  log stays written every action). Do that; don't batch.
- **(b) Aggressive edge caching of static assets — REJECTED, verified on the
  corrected premise.** Static-asset requests are **already free/unlimited off the
  Worker meter** (VERIFIED §2), so caching them saves **nothing** on the metric
  actually at risk (rows-written, 100% DO-internal). And `index.html` must
  revalidate for the version-skew banner (our own M3/M4 requirement) — aggressive
  caching would reintroduce the bug we just fixed. No action.

---

## 4. The Q3 pause design — corrected (load-bearing)

**This design was wrong on first pass.** An adversarial liveness skeptic (Opus,
high effort) found **four defects (two high)** in the draft below-the-line
"re-anchor to a fresh budget" idea. Recording the breaks and the fix, because
the correction *is* the deliverable.

### 4.1 The four defects in the naive design
1. **[HIGH] Timer-dodge.** `connected==0` does **not** imply hot-seat/single-
   player — a 4-human room routinely transits `connected==0` (all on flaky
   mobile, DO hibernated+woken). Granting a **fresh full budget** on the 0→1
   resume lets whoever is present at that edge convert a 2s remainder into a full
   45s, repeatable by 0→1→0 cycling — dodging their turn timer indefinitely.
   Direct violation of M4's I2 (never-above-base) and the whole point of the
   fresh-clock fix. The "no adversary to protect" premise is **false**.
2. **[HIGH] Permanent stall via the obvious reuse.** The only presence recompute
   (`reconcileDeadlines` → `nextDeadlines(reason='presence')`) touches ONLY
   `changedSeats` (I3). If resume naively reuses it and the first socket back is a
   **non-actor** while the on-turn actor stays absent, no row is armed for the
   absent actor → `scheduleAlarm` arms nothing → the present player waits forever.
3. **[MED] I4 grace re-anchor.** Re-anchoring a still-absent actor's 60s grace to
   `now` on resume violates I4 ("grace anchored at first disconnect") and
   under-charges the absent player.
4. **[MED] Pause leaks through any non-seat-deadline wake.** `alarm()` has **no
   `connected==0` guard**; on *any* wake (a pending probe alarm, an at-least-once
   runtime re-delivery) it drains frozen past-due rows and auto-plays — the exact
   behavior Q3 claims to remove.

### 4.2 The corrected design (M4/I2/I4-consistent)
- **Pause (connected 1→0, room playing):** record a single `pauseStartAt`
  timestamp and **cancel the seat-deadline alarm** (`scheduleAlarm` omits
  seat-deadline candidates while `connectedSeats()` is empty). Deadline rows are
  **frozen** (kept, not advanced). The DO goes inert → hibernates → $0. Wakers:
  a reconnect (inbound WS) or a genuinely-pending probe alarm.
- **Resume (connected 0→1):** compute `offset = now − pauseStartAt` and **shift
  every frozen deadline's `due_at` and `base_due_at` by +offset** — i.e. preserve
  each actor's **remaining budget as a duration** (a 2s remainder stays 2s; a
  disconnect grace preserves *its* remaining, honoring I4). Then run a **bespoke
  `'resume'` recompute that re-arms ALL expected actors** (grace for any still
  absent), and re-arm the alarm. Clear `pauseStartAt`. This is neither the
  `'decision'` path (which would grant fresh budgets — the dodge) nor the
  `'presence'` path (which touches only changed seats — the stall).
- **`alarm()` guard:** add an explicit `connected==0` (or `pauseStartAt!=null`)
  guard at the top of the seat-deadline loop so no other wake can drain frozen
  rows.

### 4.3 Why the correction is M4-consistent (for the audit)
Preserving the remaining budget as a duration means a pause **freezes and
conserves** budget; it never manufactures it. I2 extends cleanly from "never
above base" to "**a presence/pause sequence never grows the remaining budget
within a decision point**" — the absolute `base_due_at` is re-anchored (because
wall-clock was frozen while nobody watched), but the *duration* left is invariant.
This is the same reinterpretation M4 already made for restore-to-base. Deadlock-
freedom holds: **vacuous when `connected==0`** (no present player to stall),
**standard when `connected>0`** (every expected actor has a row due ≤
max(clamp(timeout),60s), alarm at min(due)).

### 4.4 Implementation gates (at §5 sign-off, not before)
Even the corrected design is load-bearing — the fact that the first draft broke
is the argument for the full regime:
- Extend `tests/unit/server/deadline-liveness.property.test.ts` with a
  **connected-count dimension**: assert (i) `connected==0` ⇒ no seat-deadline
  alarm, (ii) `connected>0` ⇒ every expected actor armed, (iii) the 1→0 freeze
  and 0→1 re-anchor conserve remaining budget (no fresh-clock, no I4 violation),
  (iv) `alarm()` never advances a paused room.
- Wire-level e2e: drop all sockets mid-hand → verify no auto-play while paused →
  reconnect → verify resume restores the *remaining* clock (not a fresh one) and
  the game continues.
- **Cross-model audit (the brief mandates it):** Codex on resync/liveness
  continuity (the 1→0 / 0→1 transitions, the `alarm()` guard); Grok on the
  invariant sweep (I1–I4/DL1–DL3 under the pause). Note the corrected design came
  from *one* skeptic lineage — it must be re-audited independently, not trusted
  because it caught the first bug.

### 4.5 Why Q3 beats the rejected purge alternative
The owner pre-rejected a purge policy (10-min lobby purge too aggressive for a
trickle-in family game; deleting SQLite destroys replay). Corrected Q3 needs no
purge: it **preserves the room** (reconnect resumes the exact remaining clock —
better UX than "we auto-finished your game") and **preserves replay** (nothing is
deleted). It is strictly better than a purge on the owner's own priorities.

---

## 5. Sequenced action set + sign-off gates

Nothing below is implemented yet — this is the proposal to approve.

1. **Q5-merge (trivial, immediate on approval):** combine `bumpSeq`'s
   `UPDATE snapshot SET seq=seq+1` with the `UPDATE snapshot SET state_json` into
   a single statement returning the new seq. −1 row/action (~12%), zero risk.
   Guarded by existing tests + a row-count assertion.
2. **Q3 (the real fix, gated):** implement §4.2 behind the §4.4 regime
   (property-test extension → wire e2e → Codex + Grok audit → live drill). This
   is where the effort goes; it removes the ~11.5k rows/day/room zombie burn.
3. **Q4 (defense, low urgency):** smoke-test the `ratelimits` binding on the live
   free account; if available, add `env.LIMITER.limit({key: ip})` to
   `POST /api/rooms` (60s window) + a client-side create-retry cap/backoff; DO
   fallback if paid-gated.
4. **No-ops:** Q1 (done), Q5-batch (rejected), Q5-cache (rejected).
5. **Deferred to M5+:** a SQLite retention/cleanup sweep for finished and
   lobby-abandoned rooms (the one unbounded-but-slow growth), designed to
   preserve dump→replay.

---

## 6. Honest nulls & uncertainties
- **`ratelimits` Free-plan availability** — docs carry no explicit Free/Paid
  statement; inferred available, **needs a live smoke test** (§2). DO fallback is
  confirmed Free.
- **Actions/match for *real* play** — measured only under the degenerate
  `defaultAction` strategy (uncontested shutouts). Order of magnitude solid
  (~10–20k rows/match); the exact distribution for contested human play is
  **unknown** without live telemetry. Direction of change is genuinely ambiguous
  (bigger plays per trick vs. more hands needed).
- **Match-length bound** — not provably bounded under the default no-demote A
  config; terminates for all 8 tested seeds but there is no constant upper bound.
- **Hibernation 10s threshold** — documented but hedged ("Currently …"); not an
  SLA. The Q5(a) rejection is robust regardless (45s ≫ any plausible threshold).
- **Corrected Q3** — came from a single adversarial lineage; treat as a strong
  hypothesis to be re-audited at implementation, not a proven design.
