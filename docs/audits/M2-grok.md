# M2 Cross-Model Audit — Grok (seat-token authority + redaction)

Ran 2026-07-14 (grok 0.2.93 headless). Anchoring-free; relayed verbatim.

Grok completed the audit successfully on the first invocation (exit code 0). Below is its report verbatim, lightly formatted for relay.

---

# Adversarial Audit: Seat-Token Authority + Redaction Model

**Scope:** `game-room.ts`, `room-helpers.ts`, `index.ts`, `protocol.ts`, PLAN §4 / §8
**Property under test:** A connection receives seat X's redacted view / events / hints / tokens **iff** it currently holds seat X's token.
**Out of scope (by design):** collusion, multi-account, one-human-per-seat, client-side retention of previously delivered private data.

---

## FINDINGS

### F1 — `hello` can drop held seats without presence / deadline recompute
**Severity: minor** (correctness / integrity, not a private-data leak)

In `handleHelloMsg`, the held-seat set is **replaced** by token resolution, not merged. Takeover correctly strips seats from other sockets and serializes attachments **before** any resync.

But if the sole holder of seat S sends `hello` with empty/missing tokens:

1. `setSeats(ws, ∅)` removes S from `sessions`
2. S is no longer in `connectedSeats()`
3. **No** `presence{connected:false}` is broadcast (only *newly* connected seats are announced)
4. **No** `recomputeDeadlinesAndAlarm()` (only runs when `newlyConnected.length > 0`)

So delivery of private data stops (property holds: no token ⇒ no further seat-S views), but presence and disconnect-grace deadlines can stay stale until the next state change. A client can "soft-disconnect" without the 60s clamp until something else recomputes deadlines.

**Not a redaction leak.** Relevant as token-lifecycle / presence coupling.

---

### F2 — Dump-token compare is not timing-safe
**Severity: minor**

```
497:503:src/server/game-room.ts
  private handleDump(request: Request): Response {
    const devMode = this.env.ENVIRONMENT === 'dev';
    const configuredToken = this.env.DEBUG_DUMP_TOKEN;
    const presented = request.headers.get('x-debug-dump-token');
    const allowed =
      devMode || (configuredToken !== undefined && configuredToken !== '' && presented === configuredToken);
```

Production gate uses JS `===` on the secret. Empty/unset `DEBUG_DUMP_TOKEN` correctly fails closed; header name is case-insensitive via Fetch `Headers`. Practical network-level timing exploit is weak, but this is not constant-time.

**No logical bypass found** for empty token, unset env, or wrong header casing (see Checked).

---

### F3 — PLAN §5 "close stale socket" vs implemented soft takeover
**Severity: minor** (doc drift, not a leak)

PLAN §4 (authoritative multi-tab rule) matches the code: takeover moves **delivery**, old socket keeps other seats. PLAN §5 reconnection sketch still says "closes any stale socket." Code never closes; it deletes the seat from the old attachment.

**Security effect:** none for the property — old socket immediately loses seat S in `sessions` / attachment under DO single-writer, so subsequent `fanOutEvents` cannot deliver S's view to it. Old client may still *display* previously received private data (inherent once a token was held).

---

### No blocker / major findings

No path found where seat-private `view` / redacted `event` arrays / `hints` / minted raw tokens are sent to a connection that does not currently hold that seat in `sessions` (post-claim or post-hello token resolution).

---

## CHECKED, NO FINDING

### (1) Leak paths

| Path | Verdict |
|------|---------|
| **`fanOutEvents`** | Nested `for (ws, seats) for (seat of seats)` — redacts **per seat**, not once per socket. Multi-seat sockets get N independently redacted copies. |
| **`hello` resync** | Only after token→hash resolve; `view` / delta events / `hints` only for resolved seats; only sent to the hello socket. |
| **`welcome` / `roomChanged` / `RoomInfo`** | Public lobby fields only (`gameId`, `status`, `config`, seat name/claimed/connected, `seq`). No hands, no seed, no tokens, no full state. |
| **`seatClaimed`** | Raw `token` only on claimer's `send`; other sockets get `{seat, name}` without `token`. |
| **`presence` / `started` / `configChanged` / `rejected`** | No seat-private payloads. |
| **Unseated sockets** | In `sessions` with `∅` seats → receive public broadcasts only; inner fan-out loop is a no-op. |
| **Takeover vs concurrent fan-out** | DO single-writer (PLAN §4): takeover mutates other sockets' seat sets + attachments **before** resync; no interleaved action fan-out mid-handler. Post-takeover, old socket is out of the held set for that seat. |
| **Duplicate-action resync** | Only after `heldSeats(ws).has(seat)`; resync is for **that** seat's `playerView` / `legalActions`. |
| **`/dump`** | Full unredacted state/events by design; gated (see below). Seats export `tokenHash` only. |
| **HTTP `GET …/info`** | Same public `RoomInfo` as welcome. |
| **M0 `/hello` / `/status`** | Probe counters only. |
| **Mutation logs** | `logMutation` JSON lines: room/seq/actionId/seat/type/outcome/error — never raw token or full action body. |

Redaction egress is centralized: live and resync events go through `redactEventsFor` → `game.viewEvent`; views via `game.playerView(state, seat)` with `seat` taken only from held seats.

### (2) Token lifecycle

| Check | Verdict |
|-------|---------|
| **Mint entropy** | 32 bytes `crypto.getRandomValues` → hex (256-bit, exceeds PLAN "128-bit+"). |
| **Hash at rest** | Only `sha256Hex(token)` stored in `seats.token_hash`. |
| **Raw token** | Returned once on claimer's `seatClaimed`; not in SQL, dump, logs, or other sockets' messages. |
| **Resolve** | Hello hashes presented tokens; SQL lookup by hash; unknown tokens silently fail (no existence oracle beyond "which of *my* tokens resolved"). |
| **Timing-safe seat-token compare** | Equality is on SHA-256 digests of 256-bit secrets via SQL. Forging by timing is not a realistic threat relative to brute force; less critical than dump-token compare (F2). |
| **Replay after takeover** | Token **ownership** is the DB hash; takeover only moves **delivery**. Presenting the same token on a new socket re-resolves the seat and takes over again. **Matches PLAN §4** (delivery move, not re-mint/revoke). |
| **Session binding** | After claim/hello, authority is the socket attachment `seats[]` (server-only). Re-presentation not required per action — standard session model; property interpreted as "holds" = authenticated delivery mapping. |

### (3) Action authority

| Path | Check |
|------|--------|
| **Client `action`** | `handleActionMsg` requires `heldSeats(ws).has(msg.seat)` before `applyGameAction`. Trusts message seat **only as which held seat acts**, not as free authority. |
| **Duplicate** | Same gate; cannot pull another seat's view via foreign `actionId`. |
| **Timeout / alarm** | `ws: null`; seat from server `deadlines` + `defaultAction`; no client seat trust. Still fans out via held-seat map only. |
| **Lobby `setConfig` / `start`** | Any connection with `held.size > 0` (PLAN: any seated player). Not a redaction issue. |
| **No alternate action entry** | Single `applyGameAction` for player + timeout. |

### (4) `/dump` gate

| Case | Result |
|------|--------|
| `ENVIRONMENT === 'dev'` | Open (intended; `wrangler.jsonc` production default; `.dev.vars` local). |
| `ENVIRONMENT` unset / `'production'` | Dump only if `DEBUG_DUMP_TOKEN` is **defined and non-empty** **and** header equals it. |
| Empty configured token `''` | Rejected (`!== ''`). |
| Missing header / wrong value | 404 `notFound` (indistinguishable). |
| Header name casing | `headers.get('x-debug-dump-token')` — HTTP case-insensitive. |
| Worker bypass | Worker only routes by room-code shape; does not strip the gate; DO enforces. Non-`/api` does not reach dump. |

---

## COULD-NOT-VERIFY

| Item | Reason |
|------|--------|
| **Game-plugin redaction quality** (`playerView` / `viewEvent` / `legalActions` never encode other seats' secrets) | Room layer correctly **keys** by held seat; actual concealment is per-game. Guandan (and future games) not fully re-audited here — only wiring in listed server files. |
| **True wall-clock interleaving of DO handlers under all CF runtime versions** | Audit relies on documented DO single-writer semantics (PLAN §4 + code comments). Not independently proven in this pass. |
| **Operational misconfig** (`ENVIRONMENT=dev` in a public deploy, dump token leaked) | Config/process risk, not a code bypass. |
| **Client storage / XSS / MitM of claimer WebSocket** | Token on the wire to the claimer is intentional; transport/client compromise is outside the DO authority model. |
| **Hibernation attachment integrity under platform compromise** | Attachment is server-written; if the platform/DO storage is hostile, seat maps could be forged — outside app-level model. |

---

## Property summary

```
claim  → mint token → raw token ONLY to claimer; hash only in DB
hello  → hash(tokens) → seats; strip seat from other sockets; attach to this socket
action → must be in connection's held seats
egress → playerView / redactEventsFor / legalActions only for those seats
dump   → full state, but ENVIRONMENT/dev or matching DEBUG_DUMP_TOKEN
```

**Bottom line:** Against the single required property, the seat-token authority + redaction model is **sound**. No blocker or major leak/bypass in the room layer. Remaining issues are minor (presence/deadline on seat-drop via hello, dump-token timing compare, PLAN §5 wording drift).

---

**Invocation:** `~/.grok/bin/grok --cwd /Users/mikechwu/Projects/smashegg --prompt-file <audit-prompt.md> --permission-mode auto --disable-web-search --max-turns 120` — succeeded on the first attempt (exit code 0); Grok read all four named source files plus PLAN §4/§8 and tests before reporting.