
# Reliable Reconnection for Turn-Based Multiplayer on Cloudflare Durable Objects (Hibernation) — Implementation Patterns, July 2026

## 1. Canonical DO + Hibernation WebSocket server shape

**VERIFIED** (Cloudflare official docs)

The Hibernation API replaces the plain `WebSocket` accept flow (`ws.accept()`) with `ctx.acceptWebSocket(ws, tags?)`. Once accepted this way, the runtime is allowed to evict the DO from memory (stop billing wall-clock duration) while the TCP/WS connection to the client stays open at the edge. When a message arrives on a hibernated socket, the runtime re-instantiates the DO (reruns the constructor) and dispatches to `webSocketMessage`/`webSocketClose`/`webSocketError`.

Canonical shape:

```ts
export class GameRoom extends DurableObject {
  sessions = new Map<WebSocket, SessionState>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rehydrate in-memory index from the sockets the runtime kept alive
    for (const ws of ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment) this.sessions.set(ws, attachment);
    }
    // Ping/pong handled without waking the DO (no duration charge)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request) {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [`player:${playerId}`]); // tags
    server.serializeAttachment({ playerId, lastSeenSeq: 0 });
    this.sessions.set(server, { playerId, lastSeenSeq: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) { /* ... */ }
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason); // now optional with newer compat flag, see below
    this.sessions.delete(ws);
  }
}
```

Key API details, all **VERIFIED** against `developers.cloudflare.com/durable-objects/api/state/` and `.../best-practices/websockets/`:

- `acceptWebSocket(ws, tags?: string[])` — up to **10 tags per socket**, each **max 256 characters**; up to **32,768 WebSocket connections per DO**.
- `getWebSockets(tag?: string)` — returns the live `WebSocket[]` for the DO (or filtered by tag), used to rebuild indices after wake. This is the recommended way to enumerate connections; DO **not** rely on the JS `Map` surviving hibernation.
- `getTags(ws)` — retrieve a socket's tags.
- `serializeAttachment(value)` / `deserializeAttachment()` — attach a small JSON-serializable blob to a socket that **survives hibernation** (persisted by the runtime alongside the socket, not lost on eviction). **Max serialized size is 16,384 bytes** (not 2KB — that figure is a commonly misremembered/older number). Attachments are lost only if either side actually closes the connection.
- `setWebSocketAutoResponse(pair)` / `getWebSocketAutoResponse()` / `getWebSocketAutoResponseTimestamp(ws)` — server-side automatic ping/pong that fires **without waking the hibernated DO and without duration billing** (request/response strings capped at 2,048 chars each).
- `setHibernatableWebSocketEventTimeout()` / `getHibernatableWebSocketEventTimeout()` — bounds how long a woken handler may run.
- The runtime **also** auto-replies to protocol-level WS ping frames transparently, independent of `setWebSocketAutoResponse` (that one is for your own app-level ping/pong strings).
- New in the 2026-04-07+ compatibility flag `web_socket_auto_reply_to_close`: the runtime now auto-replies to Close frames, so calling `ws.close()` inside `webSocketClose` is no longer strictly required (still safe to call). **VERIFIED** — seen directly in the current Cloudflare example code comments (dated within scope of this report).

**Why in-DO-memory `Map<WebSocket, X>` breaks, and the fix (VERIFIED):** Hibernation wipes *all* JS heap state, including any `Map`/`Set` you built keyed on live `WebSocket` objects or player IDs — the constructor reruns from scratch on wake, with no memory of prior state, only the sockets the runtime chose to keep and whatever you serialized onto them. The documented fix (see Cloudflare's own example, and corroborated in a third-party deep-dive) is:
1. Never treat an in-memory `Map` as authoritative — it's a rebuildable cache.
2. On every `fetch()` upgrade, `serializeAttachment()` the durable identity (playerId/sessionId, and ideally lastSeenSeq) onto the socket.
3. In the constructor, call `ctx.getWebSockets()` + `ws.deserializeAttachment()` to rebuild the in-memory index before any handler runs.
4. Anything beyond ~16KB or that must outlive the socket's lifetime (event log, room state) goes to `ctx.storage` (SQLite), not the attachment.

Sources:
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/api/state/
- https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- https://thomasgauvin.com/writing/how-cloudflare-durable-objects-websocket-hibernation-works/ (independent confirmation of the "hibernation wipes in-memory state" gotcha and the serializeAttachment/getWebSockets rehydration pattern)

---

## 2. Event-log / sequence-number resync design

**VERIFIED (pattern, generically documented)** — Cloudflare docs do not prescribe a specific game-resync protocol; this is standard practice cross-checked against a dedicated WebSocket-reconnection engineering guide and general resumable-protocol discussions (not Cloudflare-specific, but directly applicable and consistent with what the DO storage primitives support).

Recommended shape for "DO is single source of truth, client resumes from lastSeenSeq":

- **Monotonic per-room sequence number**: maintain `nextSeq` in DO storage (or in-memory + persisted per-write); every mutating game event gets `seq = nextSeq++` atomically inside the same synchronous DO request that computed it (DOs process a single request at a time per instance, so this is race-free by construction — no separate lock needed).
- **Persist recent events to DO SQLite storage** (`ctx.storage.sql.exec(...)`, GA per Cloudflare's SQLite-backed storage): an `events(seq INTEGER PRIMARY KEY, room_id, type, payload, created_at)` table (or an in-memory ring buffer for the hot window, mirrored to SQLite for durability across full eviction/restart). Cap retention (count or age) and trim old rows — SQLite storage is per-object (10GB per DO), transactional, and low-latency (co-located with the DO), which is why it's the natural place for this log versus KV.
- **Replay-from-seq on reconnect**: client's resync request carries `lastSeenSeq`. Server does `SELECT * FROM events WHERE seq > ? ORDER BY seq`. If the row set is present and contiguous, ship the delta and the client is caught up.
- **Full-snapshot fallback**: if `lastSeenSeq` predates the oldest retained row (log truncated) or the gap is large, the DO computes/serializes current authoritative game state (a snapshot) and sends `snapshot(state, seq=current)` instead of a delta, then continues streaming subsequent deltas normally. This mirrors the same pattern described generically for chat/collab reconnection ("server replays all messages after that sequence number... plus deduplication/idempotency"), and is the natural complement to a capped event log.
- **Idempotency**: 
  - Client-generated action IDs (e.g. `crypto.randomUUID()` per submitted action) let the server dedup retried submissions (client resent an action after a flaky ack) — store recently-seen action IDs (or just the resulting seq they produced) and return the cached result/seq instead of double-applying.
  - **Sequence-guarded actions**: for turn-based mutations, have the client submit `expectedSeq` (the seq it believes the room is currently at) alongside its move. Server rejects/renegotiates if `expectedSeq !== currentSeq`, forcing a resync round-trip rather than silently applying a move against stale state — this is the standard optimistic-concurrency guard for turn-based games and prevents "acted on stale board" bugs after a reconnect race.

Sources:
- https://websocket.org/guides/reconnection/ (explicit sequence-number replay + idempotency-key dedup pattern, generic but directly transferable)
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ (SQLite-backed storage: per-object, transactional, GA)
- https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/

**UNCERTAIN**: there is no Cloudflare-specific worked example of "game event log + resync-by-seq" in their docs — this section is architecture pattern, not a documented recipe, so treat the specific schema/thresholds as design guidance to validate against your game's event volume, not a Cloudflare-endorsed blueprint.

---

## 3. Persisted vs in-memory state; rehydration; cost model

**VERIFIED**

**Must persist (survive full eviction, not just hibernation-with-socket-open):**
- Authoritative game state (board/turn/scores) and the event log — `ctx.storage` (SQLite-backed, transactional).
- The current alarm deadline is implicitly persisted by the platform (`setAlarm`/`getAlarm` are storage operations, so they survive DO restarts).
- Anything you need if *all* clients disconnect and the DO is later re-created from cold storage (no in-memory or attachment survives that).

**Safe in-memory (rebuilt on every wake):**
- Connection→session index (`Map<WebSocket, SessionState>`) — rebuilt in the constructor from `ctx.getWebSockets()` + `deserializeAttachment()`.
- Derived/cached views of storage state, request-scoped scratch data.

**Per-socket attachment (survives hibernation, tied to socket lifetime, ≤16KB):**
- Small identity/session data (playerId, room role, lastSeenSeq at connect time) via `serializeAttachment`/`deserializeAttachment` — this is explicitly the intended bridge between "socket stays open across hibernation" and "DO memory gets wiped."

**Rehydration-on-wake pattern**: constructor runs `getWebSockets()` → `deserializeAttachment()` → repopulate maps, *before* any handler executes (Cloudflare's own example does exactly this). Do not lazily rehydrate inside each handler — the constructor is the single choke point guaranteed to run on every wake.

**Cost model — CONFIRMED**: "Durable Objects are billed for compute duration (wall-clock time) while the Durable Object is actively running or is idle in memory but unable to hibernate. Durable Objects that are idle and eligible for hibernation are not billed for duration, even before the runtime has hibernated them." Plain (non-hibernatable) `ws.accept()` keeps the DO pinned in memory and duration-billed for the entire connection lifetime — this is the core reason to use the Hibernation API for any long-lived, mostly-idle game room. `setWebSocketAutoResponse` ping/pong specifically does **not** incur wall-clock/duration charges either. Caveat: an *outbound* connection (TCP or outbound WebSocket) from inside the DO keeps it pinned in memory and billed for up to 15 minutes per connection even without inbound requests — don't hold outbound sockets open unnecessarily.

Sources:
- https://developers.cloudflare.com/durable-objects/platform/pricing/ (billing rules, hibernation-exempt duration, auto-response exemption, outbound-connection caveat)
- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

---

## 4. Turn timeouts via DO Alarms while hibernated

**VERIFIED**

- `ctx.storage.setAlarm(timestampMs)` schedules exactly one alarm per DO (calling it again overwrites the pending one — useful for "reset the clock every time a move is made": just call `setAlarm(Date.now() + turnDurationMs)` on each turn transition).
- **Alarms reliably wake a hibernated/evicted DO**: the alarm mechanism is independent of any open WebSocket — "Alarms also provide a mechanism to guarantee that operations within a Durable Object will complete without relying on incoming requests to keep the Durable Object alive." When the scheduled time arrives, the runtime instantiates the DO (reruns constructor, rehydrating sockets via the pattern above) and invokes `alarm()`.
- **Guaranteed at-least-once execution**: on an uncaught exception in `alarm()`, the platform retries with exponential backoff starting at 2s, up to 6 retries. `alarm(info)` receives `{ retryCount, isRetry }` so handlers can detect/guard re-entrancy.
- **Only one alarm per DO** — for multiple pending deadlines (e.g., separate timers per player in a multi-turn queue), store a schedule table in `ctx.storage` and have `alarm()` process all due entries, then re-`setAlarm()` for the next soonest one (this is literally Cloudflare's documented "scheduling multiple events with a single alarm" pattern).
- **Pattern for per-turn deadline + auto-action**: on turn start, `setAlarm(now + turnMs)`; in `alarm()`, check if the current turn's deadline has actually passed (guard against a stale alarm firing after the turn already advanced) and if so, auto-apply a pass/default action, advance turn, bump seq, broadcast to connected sockets (waking them via a normal message causes momentary duration billing only for that handler's execution), and schedule the next deadline.
- **Limits / free plan**: doc text does not call out a *lower* alarm-granularity/rate limit specific to the free tier beyond the general one-alarm-per-DO constraint and the retry/backoff numbers above; I did not find an explicit "N alarms/day on free plan" cap in the fetched Alarms docs — **UNCERTAIN**, verify current plan limits directly against `developers.cloudflare.com/durable-objects/platform/pricing/` and the Workers Free/Paid limits pages before relying on a specific quota number, since pricing/limits pages are the part of Cloudflare docs most likely to have shifted by your read-date.

Sources:
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://blog.cloudflare.com/durable-objects-alarms/

---

## 5. partysocket as the client library

**VERIFIED**

- **Reconnect/backoff**: exponential backoff with jitter, defaults: `minReconnectionDelay: 1000 + random*4000`, `maxReconnectionDelay: 10000`, `reconnectionDelayGrowFactor: 1.3`, `connectionTimeout` to retry if not connected within a window, `maxRetries` unset by default (keeps retrying). Fully configurable via constructor options.
- **Buffers messages sent while disconnected**: yes — "Buffering. Will send accumulated messages on open." Controlled by `maxEnqueuedMessages` (default `Infinity`); messages queued during a disconnected state are flushed on the next successful `open`. For a resync protocol, you generally want to **not** rely on this queue for game actions across a reconnect gap (send an explicit resync request instead, and re-submit pending actions guarded by `expectedSeq`), but it's useful for low-stakes traffic.
- **Signals reconnection to app code**: standard `WebSocket`-compatible events — `onOpen`/`addEventListener('open', ...)`, `onClose`, `onError`, plus a `retryCount` property. The app's `onOpen` handler is exactly where you trigger the resync request (send `lastSeenSeq`, wait for delta/snapshot) — this is the intended integration point, since partysocket deliberately mirrors the browser `WebSocket` API plus reconnection semantics rather than inventing its own resync protocol (that's left to the application, consistent with what this task is asking you to build).
- **Works with plain DOs (not just PartyKit-hosted rooms)**: yes — partysocket is a generic reconnecting-WebSocket client; it works against any WebSocket endpoint, including a raw Cloudflare Worker/DO `fetch()` upgrade handler, not only PartyKit's own room server. (It is maintained by the PartyKit team but is decoupled from requiring PartyKit's server framework.)
- **Maintenance signal (checked directly against the npm registry, July 2026)**:
  - `partysocket@1.3.0`, published 19 days before this check (i.e. late June 2026).
  - `dist-tags.latest = 1.3.0`; package metadata last modified 2026-06-23.
  - Weekly downloads (via npm's download API): **2,189,196** for the week of 2026-07-05–07-11 — an actively maintained, widely used package.
- **Comparison**:
  - **reconnecting-websocket** (the underlying/sibling library partysocket's options are modeled on — same option names like `minReconnectionDelay`/`reconnectionDelayGrowFactor`) is a lower-level, protocol-agnostic reconnecting-WebSocket wrapper with no app-framework opinions; partysocket adds room/party-URL ergonomics (`updateProperties()` + `reconnect()` to change target params without a full re-instantiate) on top of essentially the same reconnection engine.
  - **Hand-rolled**: gives full control (e.g., custom resync-request-on-open sequencing, bespoke backoff tuned to your alarm/turn cadence) but you must reimplement backoff+jitter, buffering policy, and reconnection-state signaling correctly — given partysocket's exponential-backoff-with-jitter defaults and event model already fit the resync flow (do work in `onOpen`), there's limited reason to hand-roll unless you need behavior partysocket's options can't express.

Sources:
- https://docs.partykit.io/reference/partysocket-api/
- https://www.npmjs.com/package/partysocket
- https://registry.npmjs.org/partysocket (dist-tags/time.modified, fetched directly)
- https://api.npmjs.org/downloads/point/last-week/partysocket (fetched directly)

---

## 6. Known pitfalls

- **Duplicate `webSocketMessage` delivery**: Cloudflare's docs describe at-least-once semantics for *alarms* explicitly, but do **not** document at-least-once/duplicate-delivery guarantees for `webSocketMessage` itself (a woken DO delivering a message is a normal in-order dispatch of a frame that arrived on an open connection, not a retried job). **UNCERTAIN** whether any edge-case (e.g., DO eviction racing with an in-flight message, or a retry after an uncaught exception in `webSocketMessage`) can cause redelivery — I found no explicit statement either way in the fetched docs. Given this ambiguity, the safe design is exactly what section 2 already requires for other reasons: **make every client-submitted action idempotent via a client-generated action ID**, regardless of the transport-layer guarantee, so a hypothetical duplicate delivery is harmless.
- **Ordering**: within a single WebSocket connection, frame order is preserved by the underlying TCP/WS transport; Cloudflare doesn't document any reordering risk for hibernated sockets specifically. Cross-connection ordering (multiple players' messages interleaving) is naturally serialized because a DO instance processes one request/handler at a time — this is the standard DO single-threaded-per-instance guarantee, which is exactly what makes the "seq++ inside the same synchronous handler" design in section 2 race-free.
- **Client-perceived-connected-but-server-dropped**: yes, this is a real class of bug (half-open TCP, NAT/proxy silently dropping) and the docs' own mitigation is **`setWebSocketAutoResponse`** — a server-side WS ping/pong pair that Cloudflare answers *without waking the DO or billing duration*, letting the edge/runtime and a well-behaved client library (partysocket sends/observes standard pings) detect true liveness cheaply. This is distinct from the runtime's transparent handling of RFC6455 protocol ping frames (also documented, also hibernation-safe). For app-level "is my game session actually still valid," combine this with the resync handshake on `onOpen` rather than trusting `readyState === OPEN` alone.
- **Multiple tabs / same player two sockets**: not addressed by Cloudflare's docs as a built-in policy — this is entirely an app-level decision. The mechanism to implement whatever policy you choose is `acceptWebSocket(ws, tags)` + `getWebSockets(tag)`: tag every socket with the player's ID, and on a new connection for the same player-tag, either (a) close the older socket(s) for that tag (single-session-per-player policy) or (b) allow multiple and fan out to all tagged sockets (multi-tab-mirroring policy). **UNCERTAIN/architecture decision, not a documented Cloudflare recommendation** — pick based on product requirements; tags are simply the mechanism Cloudflare exposes to implement either.
- **Close-frame handling changed recently**: the newer `web_socket_auto_reply_to_close` compat flag (compat date ≥ 2026-04-07) makes the runtime auto-reply to Close frames, so `ws.close()` in your `webSocketClose` handler is no longer required (but remains harmless/safe to call) — worth checking your `wrangler.toml` compatibility_date against this if you're debugging close-handshake behavior differences between environments.

Sources:
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/ (auto-response ping/pong, tags, getWebSockets, close-frame compat flag)
- https://developers.cloudflare.com/durable-objects/api/state/ (acceptWebSocket/getWebSockets/getTags/setWebSocketAutoResponse signatures and limits)
- https://developers.cloudflare.com/durable-objects/api/alarms/ (at-least-once semantics scoped to alarms)

---

### Summary of UNCERTAIN items to verify before locking the architecture
1. Free-plan-specific alarm rate/granularity limits (not found in fetched Alarms docs — check current pricing/limits pages directly).
2. Whether `webSocketMessage` can ever be redelivered (no explicit Cloudflare statement found) — mitigated by idempotency regardless.
3. No Cloudflare-endorsed reference implementation of "event log + seq resync" exists — the design in section 2 is standard practice cross-checked against a generic WebSocket-reconnection guide, not a Cloudflare tutorial; validate your SQLite log-retention thresholds against real traffic before shipping.
4. Same-player multi-tab policy is a product decision with no default Cloudflare guidance — tags are just the mechanism.