
## Cloudflare Free-Tier Stack Fact Sheet — Static Frontend + Entry Worker + SQLite Durable Objects + WebSockets (+ D1)
*Verified July 2026*

### 1. Workers Static Assets vs. Pages
**Fact:** Cloudflare now recommends **Workers with static assets** for new full-stack projects, not Pages. A single Worker can serve a static asset directory *and* run Durable Objects — Durable Objects, Workflows, Containers, and Secrets Store remain Workers-only (not available on Pages), which is a key reason for the shift. Pages remains supported with no forced migration deadline, but is positioned as legacy for anything beyond pure static/SSR sites. Config: one `assets` block (directory + optional binding) plus a normal `main` entrypoint; you can combine this in the same `wrangler.jsonc` with `durable_objects.bindings` and a `migrations` array.
```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-11",
  "assets": { "directory": "public", "binding": "ASSETS" },
  "durable_objects": { "bindings": [{ "name": "MY_OBJECT", "class_name": "MyDurableObject" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyDurableObject"] }]
}
```
**Source:** https://developers.cloudflare.com/workers/static-assets/ , https://developers.cloudflare.com/workers/static-assets/binding/ , https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
**VERIFIED** (recommendation + config confirmed in official docs; the exact "single Worker runs assets AND DO" combo is inferred by combining two documented, independently-confirmed config blocks rather than found as one worked example on a single page — treat that composite as VERIFIED with minor caveat).

---

### 2. Durable Objects — Free Plan
**Fact:** SQLite-backed Durable Objects **are available on the Free plan** — in fact, SQLite storage is the *only* backend available to Free-tier accounts (the older key-value storage backend requires a paid plan). Free-tier limits:
- Requests: 100,000 / day
- Duration: 13,000 GB-s / day
- Storage: 5 GB total (rows read/written billing not yet metered — SQLite storage billing begins January 2026)
- Rows read: 5,000,000 / day
- Rows written: 100,000 / day
- Class count limit: not specified/documented (no explicit cap found)

Exceeding any single limit causes further operations of that type to fail with an error (no overage billing on Free plan).
**Source:** https://developers.cloudflare.com/durable-objects/platform/pricing/
**VERIFIED** (all numeric limits confirmed); class-count limit **UNCERTAIN** (not documented).

---

### 3. WebSocket Hibernation API
**Fact:** Current API surface:
- `ctx.acceptWebSocket(ws, tags?)` — accepts a server WebSocket in a way that allows the Durable Object to hibernate (vs. `ws.accept()`, which prevents hibernation).
- Handlers: `webSocketMessage(ws, message)`, `webSocketClose(ws, code, reason, wasClean)`, `webSocketError(ws, error)`.
- `ws.serializeAttachment(value)` / `ws.deserializeAttachment()` persist small per-connection state across hibernation; max serialized size **16,384 bytes**; value must support the structured-clone algorithm; lost if the connection closes.
- `ctx.getWebSockets(tag?)` returns attached WebSockets, optionally filtered by tag supplied at `acceptWebSocket` time; `ws.getTags()` returns a WebSocket's tags.
- Billing: **Billable Duration (GB-s) charges do NOT accrue while the Durable Object is hibernated** — clients stay connected while the object is evicted from memory.
- In-memory state: confirmed **none survives** — "in-memory state is reset" on hibernation/wake, and the constructor re-runs on wake (only `serializeAttachment` data survives).
**Source:** https://developers.cloudflare.com/durable-objects/best-practices/websockets/ , https://developers.cloudflare.com/durable-objects/api/state/ , https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
**VERIFIED**

---

### 4. Durable Object Alarms
**Fact:** Alarms are available on the Free plan (no plan-gating documented; they're billed under the same Requests/Duration meters as normal DO invocations, all covered by the Free tier limits in item 2). API: `ctx.storage.setAlarm(scheduledTimeMs)`, `ctx.storage.getAlarm()` (returns ms-epoch or `null`), `ctx.storage.deleteAlarm()`; handler is `async alarm(alarmInfo)` with `alarmInfo.retryCount`/`isRetry`, guaranteed at-least-once execution, retried with exponential backoff starting at 2s, up to 6 retries. **Alarms do wake a hibernated Durable Object** — note the constructor runs again before the `alarm()` handler fires, so check for pending alarms in the constructor rather than assuming in-memory continuity.
**Source:** https://developers.cloudflare.com/durable-objects/api/alarms/
**VERIFIED** (alarm API and wake-on-hibernation behavior explicit in docs); free-plan availability is **UNCERTAIN** in the strict sense that the alarms page itself doesn't state a plan restriction — absence of a restriction plus alarms billing under the same free-tier-eligible meters supports "available on Free," but this is inferred rather than an explicit "Alarms: available on Free plan" statement.

---

### 5. Wrangler v4
**Fact:** Wrangler **v4.0.0** shipped March 2025 and is current major version through mid-2026 (v3 supported with bug/security fixes until Q1 2026, critical security fixes until Q1 2027 — so v4 is the actively developed line now). Config format: Cloudflare recommends **`wrangler.jsonc`** for new projects ("some newer Wrangler features will only be available to projects using a JSON config file"); `wrangler.toml` still supported. DO declaration:
```jsonc
"durable_objects": { "bindings": [{ "name": "MY_OBJECT", "class_name": "MyDurableObject" }] },
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyDurableObject"] }]
```
Local dev: `wrangler dev` runs Durable Objects (SQLite-backed) and WebSocket connections locally by default since v4 defaults all dual-mode commands to local mode (use `--remote` to hit the real API/edge).
**Source:** https://developers.cloudflare.com/changelog/post/2025-03-13-wrangler-v4/ , https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/ , https://developers.cloudflare.com/workers/wrangler/configuration/
**VERIFIED** (I could not confirm this is still literally the latest major version as of the exact current date — npmjs.com fetch was blocked by a 403 — the changelog/migration docs confirm v4 is current and actively supported; treat "no v5 exists yet" as **UNCERTAIN**, not independently re-verified against the live npm registry).

---

### 6. D1 Free Tier
**Fact:**
- Storage: 5 GB total per account (500 MB max per individual database)
- Rows read: 5,000,000 / day
- Rows written: 100,000 / day
- Number of databases: 10 (Free plan)
- Queries per Worker invocation: 50
**Source:** https://developers.cloudflare.com/d1/platform/pricing/ , https://developers.cloudflare.com/d1/platform/limits/
**VERIFIED**

---

### 7. Workers Free Plan Limits
**Fact:**
- Requests: 100,000 / day (resets daily at midnight UTC)
- CPU time: 10 ms per invocation (wall-clock/duration is not capped the same way — CPU time is what's metered)
- WebSocket billing: the initial `Upgrade` request that establishes a WebSocket connection counts as **one request**; subsequent WebSocket **messages routed through the Worker do NOT count as separate requests** — no per-message billing on any plan.
- Concurrent WebSocket connection caps / duration caps: **not explicitly documented** on the general limits/pricing pages.
**Source:** https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/workers/platform/pricing/
**VERIFIED** (requests, CPU time, message-billing rule); concurrent-connection/duration caps **UNCERTAIN** (not found in general docs — see item 10).

---

### 8. cloudflare/wrangler-action@v3
**Fact:** Recommended pattern for deploy-on-push:
```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```
For preview deploys, `wrangler versions upload` uploads a non-deployed Worker version and returns a **preview URL** of the form `https://<version-prefix>-<worker-name>.<subdomain>.workers.dev`. This mechanism works for versions/deployments generally, but **Durable Objects are a documented exception to gradual/version-based deployments**: "only one version of each Durable Object class can run at a time," so DO code changes tied to `versions upload` previews don't get isolated per-version DO instances the way stateless Worker code does — you should expect the preview version to talk to the *same* live DO instances as production rather than isolated ones.
**Source:** https://developers.cloudflare.com/workers/configuration/versions-and-deployments/ , https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/ , https://developers.cloudflare.com/changelog/post/2025-07-23-workers-preview-urls/ , https://github.com/cloudflare/wrangler-action/issues/302 , https://github.com/cloudflare/wrangler-action/issues/343
**VERIFIED** for the deploy pattern and preview-URL format and the "DO gradual-deployment caveat"; **UNCERTAIN** on whether `wrangler-action`'s own `versions upload` GitHub Action path currently surfaces a `deployment-url` output automatically for DO-bound Workers — open GitHub issues (#302, #343) suggest this integration point has had rough edges/gaps as of the source dates found.

---

### 9. partyserver / partysocket
**Fact:** Both are maintained by Cloudflare under the `cloudflare/partykit` monorepo.
- `partysocket` (npm): latest **1.1.19**, published ~May 2026, install size ~180.7 kB, zero flagged vulnerabilities — actively maintained. *(Stale: a later direct npm-registry fetch found `partysocket@1.3.0`, published late June 2026 — see docs/research/reconnection-patterns.md §5, which supersedes this figure.)*
- `partyserver` (npm): latest **0.5.8**, published recently (within the last month as of the search) — actively maintained, 17+ dependent projects.
- `partysocket` is explicitly designed as a general reconnecting-WebSocket client (drop-in-ish replacement for the browser `WebSocket` API) with **automatic reconnection and outgoing-message buffering during disconnection** — it works against any WebSocket server, including a hand-rolled Durable Object, not only `partyserver`-based backends.
- Bundle size: ~180 kB unpacked install size (not gzip figure) per npm registry stats found.
- Given both packages are actively maintained, **no alternative is necessary**; if one wanted to avoid the dependency, plain browser `WebSocket` + manual reconnect/backoff logic is the standard fallback.
**Source:** https://www.npmjs.com/package/partysocket , https://www.npmjs.com/package/partyserver , https://github.com/cloudflare/partykit
**VERIFIED** for maintenance status and general-purpose-client behavior; exact gzip bundle size figure is **UNCERTAIN** (only unpacked npm size was retrieved, not a minified+gzipped bundle-size measurement).

---

### 10. Free-Plan Gotchas for a 4-Player, ~1-Hour WebSocket Card Game
**Fact / assessment:**
- **Duration billing is not a real risk**: hibernation stops GB-s billing while idle, and a single 1-hour, 4-connection game session generating occasional card-game messages will stay far under 13,000 GB-s/day and 100,000 requests/day (only the WebSocket upgrade counts as a request, not each message).
- **DO liveness while a session is active**: docs note an active outbound WebSocket connection can keep a Durable Object alive/non-hibernating "for up to 15 minutes per connection" in some scenarios — worth confirming empirically that a live 4-player game (with periodic messages) doesn't get prematurely evicted mid-game; the hibernation API is specifically designed so eviction is safe (reconnect-transparent to the client) even if it does happen.
- **No documented hard cap** on concurrent WebSocket connections per Durable Object, message size, or connection duration was found in the general Workers/DO docs — this is the single biggest **UNCERTAIN** in the whole verification: Cloudflare does not appear to publish an explicit "max concurrent WS per DO" or "max session duration" number on the Free plan in the pages checked.
- **D1 100,000 rows-written/day** and **DO 100,000 rows-written/day** are both generous for a card game's turn-by-turn state persistence at hobby scale, but a chatty implementation that writes DO SQLite storage on every card play across many concurrent tables could approach the 100k/day rows-written ceiling faster than requests/duration would — worth batching writes.
- **10 D1 databases per account** cap is irrelevant if you use one DO-per-game-table + a single shared D1 database for account/lobby data (the intended architecture) rather than one D1 database per game.
**Source:** https://developers.cloudflare.com/durable-objects/best-practices/websockets/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/platform/pricing/
**UNCERTAIN** overall — the individual numeric limits cited (requests, duration, rows) are VERIFIED, but the specific "gotchas" (concurrent-connection caps, hard session-duration caps, eviction timing precision) are **not explicitly documented** in the pages retrieved and should be load-tested rather than assumed safe purely from docs.

---

### Summary of Uncertain Items
- DO class-count limit on Free plan (item 2)
- Explicit "Alarms available on Free plan" statement (item 4) — inferred, not stated verbatim
- Whether v4 is still the newest major Wrangler version at this exact moment (npm registry check blocked by 403) (item 5)
- wrangler-action's automatic `deployment-url` output for DO-bound Workers via `versions upload` (item 8)
- Exact gzip bundle size of partysocket (item 9)
- Concurrent WebSocket connection caps / hard session-duration caps per Durable Object on Free plan (item 10)