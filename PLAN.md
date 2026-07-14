# PLAN — Online Card-Table Platform (first game: Guandan)

**Status:** SIGNED OFF — rev 2 approved by owner 2026-07-13 (round 3), subject to the rule-default decisions now applied in docs/rules/guandan.md v1.3 (five confirmations + `aFailConsequence=suspendPlayOpponentLevel`). Implementation authorized; M0 in progress. The `aFailConsequence` level-selection module is a tracked pre-M3 item (lands with M1 engine work), not an M0 blocker.
**Date:** 2026-07-13
**Supporting research (verified against official docs / actual files on 2026-07-13):**
- [docs/research/cloudflare-facts.md](docs/research/cloudflare-facts.md) — Cloudflare platform facts with source URLs, VERIFIED/UNCERTAIN per item
- [docs/research/reconnection-patterns.md](docs/research/reconnection-patterns.md) — DO WebSocket Hibernation + resync patterns
- [docs/rules/guandan.md](docs/rules/guandan.md) — implementation-grade Guandan rules spec (CORE/VARIANT/UNCERTAIN tagged)

---

## 1. Architecture proposal

### 1.1 Workers static assets, not Pages

**Decision: a single Cloudflare Worker serves the static frontend AND hosts the Durable Object.**

Reasons (verified, see cloudflare-facts §1 — with one carried caveat: the assets+DO-in-one-Worker combination is confirmed as two independently documented config blocks composed together, not as a single worked example in the docs; named gate check **G-COMPOSE** at M0):
- Cloudflare's current recommendation for new full-stack projects is Workers with static assets; Pages is legacy-positioned.
- Durable Objects are **Workers-only** — Pages cannot host them. Pages projects end up needing companion Workers for anything Pages can't do (cron, DOs); a single Worker avoids split-brain deploys entirely.
- One `wrangler.jsonc` declares assets directory + DO binding + migrations; one `wrangler deploy`; one CI pipeline.

### 1.2 Single Worker script (entry + DO co-located)

**Decision: one Worker script exports both the stateless `fetch` entry handler and the `GameRoom` DO class.** A separate entry-Worker/DO-Worker split (via `script_name`) buys nothing at this scale and doubles deploy/config surface. The *logical* separation (stateless routing/validation vs. authoritative room state) is enforced by module boundaries and the `Game` interface, not by deployment topology.

Request flow:

```
Browser ── GET /* ──────────────► Worker: static assets (client app)
Browser ── POST /api/rooms ─────► Worker: create room code, init DO, return code
Browser ── GET /api/rooms/:code ► Worker: room existence/metadata check
Browser ── WS /api/rooms/:code/ws ► Worker: validate, forward Upgrade to DO
                                        └► GameRoom DO (one per room code, SQLite)
```

The Worker entry is stateless: route, validate room-code shape, `idFromName(code)`, forward. All game authority lives in the DO.

### 1.3 D1: deferred (not in MVP)

**Decision: no D1 in the MVP.** All live room state lives in the DO's own SQLite storage (per-object, transactional, co-located). D1's use case here is *cross-room* data — match history, leaderboards, accounts — all post-MVP. The design keeps a clean slot for it — the DO can record a match summary at game end through the game-agnostic `result()` accessor (§3), without ever importing Guandan types — but adding D1 now is scope without payoff. Free-tier D1 (5M reads/100k writes per day) is ample when we do add it.

### 1.4 Frontend: Vite + React + TypeScript

**Decision: Vite + React + TS** — a toolchain we have verified working against this exact deploy target in a prior project. Card-table UI has enough interactive state (hand selection, animations, seat layout) that React earns its weight; bundle size is a non-issue on Cloudflare's edge. No SSR — pure static SPA + WebSocket.

### 1.5 Client reconnect library: partysocket

**Decision: use `partysocket`** (Cloudflare-maintained, v1.3.0 June 2026, ~2.2M weekly downloads — verified by direct npm-registry fetch, reconnection-patterns §5, which supersedes the older 1.1.19 figure in cloudflare-facts §9). It is a drop-in reconnecting WebSocket that works against a plain DO endpoint: exponential backoff + jitter, `open` event as the resync trigger point. We do **not** rely on its message buffering for game actions — actions are re-submitted through our own idempotent protocol (§5).

### 1.6 Free-tier budget check

| Meter (free/day) | Limit | One 4-player game (~1h) | Verdict |
|---|---|---|---|
| Worker requests | 100k | ~10 (page loads + room API + 4 WS upgrades + reconnects) | trivial |
| DO requests | 100k | a few hundred (each inbound WS message) | trivial |
| DO duration | 13,000 GB-s | near zero — hibernation stops duration billing between messages | trivial |
| DO SQL rows written | 100k | ~1–2k (event log + snapshots + deadlines) | fine; batch if needed |
| DO storage | 5 GB | KB per room; rooms self-purge at game end + TTL alarm | trivial |

Open verification item: how inbound WS messages are accounted against the DO request meter is not documented at all; the table conservatively assumes 1:1, and the numbers hold with >50× headroom even then. WebSocket messages do not count against *Worker* request limits (verified).

---

## 2. Repository layout

```
smashegg/
├── PLAN.md  STATUS.md  SETUP.md  README.md  LICENSE (MIT)
├── wrangler.jsonc              # Worker + assets + DO binding + migrations
├── package.json  vite.config.ts
├── tsconfig.json               # base/shared compiler options
├── tsconfig.engine.json        # src/engine: NO dom, NO workers-types  ← purity guard
├── tsconfig.server.json        # src/server + src/shared: workers-types, strict
├── tsconfig.client.json        # src/client + src/shared: dom, strict
├── docs/
│   ├── research/…              # verified platform research (this plan's evidence)
│   └── rules/guandan.md        # the rules spec (single source for the engine)
├── src/
│   ├── engine/
│   │   ├── core/               # Game interface + game-agnostic types (no card types)
│   │   ├── guandan/            # Guandan engine implementing the interface
│   │   └── guess-number/       # M2 dummy game (kept as living proof of agnosticism)
│   ├── shared/                 # wire protocol types, room types (client+server)
│   ├── server/                 # Worker entry + GameRoom DO
│   └── client/
│       ├── i18n/               # i18n runtime + locales/{zh-Hant,en}.json
│       └── …                   # app, components, table UI
├── tests/
│   ├── unit/                   # Vitest: engine (bulk of tests), protocol, i18n keys
│   └── e2e/                    # Playwright vs `wrangler dev`: WS flows, reconnection
└── .github/workflows/          # ci.yml (PR/push checks), deploy.yml (main → deploy)
```

**Dependency rule (CI-enforced):** `engine` imports nothing from `server`/`client`/`shared`; `server` never imports `engine/guandan` directly — only `engine/core` types plus a game registry injected at the entry point. `tsconfig.engine.json` compiles the engine with `"lib": ["ES2022"]` and no ambient platform types, so a stray `fetch`/`localStorage`/`WebSocket` reference is a **compile error**, not a review comment.

### Engineering conventions adopted from our reference implementation (a working GitHub + Cloudflare project; audit kept in local notes)

**Copy:** per-runtime tsconfig split (we go `strict: true` everywhere, unlike its frontend); package.json script naming (`typecheck`, `cf:dev`, composed checks); two-workflow CI shape (ci.yml on PR/push, deploy.yml on main + manual) with checkout→node→`npm ci`→typecheck→unit→build→e2e ladder; Playwright browser cache keyed on lockfile; `concurrency: group: deploy, cancel-in-progress: false`; workflow-level `permissions: contents: read`; `.dev.vars.example` committed + `.dev.vars` gitignored; build-output verification step before deploy; domain-organized `src/`.

**Change:** `wrangler.toml` (Pages) → `wrangler.jsonc` (Worker: `main`, `assets`, `durable_objects.bindings`, `migrations.new_sqlite_classes`); `pages deploy dist` → `wrangler deploy`; drop `_routes.json` and `functions/` file-routing (single `fetch` router); no companion cron Worker (plain Workers can register `scheduled` handlers if ever needed); drop D1/R2/OAuth machinery; **add** what the reference had none of: WebSocket upgrade handling, Hibernation API usage, and a Playwright harness that opens real WebSockets against `wrangler dev`.

---

## 3. The `Game` interface contract

Everything below lives in `src/engine/core/` and is fully game-agnostic — no card concepts, no Guandan concepts, no strings destined for humans.

```ts
export type Seat = number;                 // 0-based seat index

/** Semantic error — a key + params. UI localizes; engine never emits prose. */
export interface RuleError { code: string; params?: Record<string, unknown> }

export type ApplyResult<S, E> =
  | { ok: true; state: S; events: E[] }
  | { ok: false; error: RuleError };

/** Game-agnostic outcome, so the room layer can record results (post-MVP
 *  D1 match history) without importing any game's types. rank 1 = best;
 *  teammates share a standings entry. */
export interface GameResult {
  standings: { rank: number; seats: Seat[] }[];
  summary?: Record<string, unknown>;       // opaque game-specific details
}

/**
 * A pure, deterministic, locale-free rules engine.
 * S = full authoritative state, A = action, E = event, V = per-seat view,
 * C = rule-variant config. All five MUST be plain JSON-serializable data.
 * Every method is pure: no IO, no clocks, no global RNG.
 *
 * Randomness idiom: init receives a seed and derives a SERIALIZABLE PRNG
 * state (plain numbers; engine/core ships xoshiro128**) stored inside S.
 * All later randomness — e.g. dealing hand N+1 of an unbounded-length
 * match — draws from and advances that stored state inside applyAction.
 * Purity and replayability are preserved; games with draw piles or
 * mid-game reshuffles fit the same idiom.
 */
export interface GameDefinition<S, A, E, V, C> {
  readonly gameId: string;                 // e.g. 'guandan'
  readonly minSeats: number;
  readonly maxSeats: number;

  /** Start a new match. seed is the only randomness for the whole match. */
  init(config: C, seats: number, seed: string): { state: S; events: E[] };

  /** Seats currently allowed to act. Usually one; Guandan's double-tribute
   *  phase has two payers (then two returners) acting concurrently.
   *  Non-empty whenever !isTerminal — there are NO actorless resting
   *  phases; transitions needing no human decision (e.g. dealing the next
   *  hand) happen atomically inside the applyAction that triggers them. */
  expectedActors(state: S): Seat[];

  /** Legal action set for a seat. For combination plays: complete up to
   *  canonical-form equivalence (see obligation 4) — one representative
   *  per distinct canonical form, not every concrete card realization.
   *  For choice phases (tribute / return tribute): the EXACT eligible
   *  card set, one action per concrete card, so the UI can highlight
   *  precisely which cards are playable (sets are small). */
  legalActions(state: S, seat: Seat): A[];

  /** Validate + apply. Returns new state + semantic events, or a RuleError.
   *  MUST be a pure function of (state, seat, action). */
  applyAction(state: S, seat: Seat, action: A): ApplyResult<S, E>;

  /** The action applied on timeout/disconnect for this seat. Guandan:
   *  playing → pass, or lowest legal single when leading (pass illegal);
   *  tribute → the forced highest card; return tribute → lowest qualifying
   *  card. null = seat cannot act right now. */
  defaultAction(state: S, seat: Seat): A | null;

  /** Suggested per-action deadline for the current phase, in ms;
   *  null = untimed phase (connected seats only — see §4 deadline rule).
   *  The room layer may clamp/override via room config. */
  actionTimeoutMs(state: S): number | null;

  isTerminal(state: S): boolean;

  /** Non-null exactly when isTerminal(state). */
  result(state: S): GameResult | null;

  /** Redacted view for one seat — NEVER includes other seats' hidden info
   *  nor the PRNG state. This is the only game data the room layer ever
   *  sends to a client. */
  playerView(state: S, seat: Seat): V;

  /** Per-seat event redaction (e.g. a deal event shows only your cards;
   *  tribute visibility per variant config — hence config is a parameter).
   *  null = hide entirely. Also used to re-redact stored events on resync. */
  viewEvent(event: E, seat: Seat, config: C): E | null;
}
```

Contract obligations the room layer relies on (tested per game in M1/M3):

1. **Purity/determinism** — same `(state, seat, action)` → same result. All randomness derives from the init-time seed, either consumed at init or via PRNG state carried inside `S`; never `Date.now()`/`Math.random()`.
2. **Serializability** — `S/A/E/V/C` survive `JSON.parse(JSON.stringify(x))` unchanged. The DO persists `S` as JSON.
3. **Zero trust in views** — `playerView`/`viewEvent` are the *only* egress; property tests assert that neither other seats' hidden info **nor the PRNG state** (it determines every future deal) is reachable from them, under every config value.
4. **`legalActions` ⇔ `applyAction` agreement** — for combination plays, up to canonical form: (i) every generated action applies OK; (ii) every action that applies OK has the same canonical form (`type, size, keyRank[, suit]`) as some generated action; (iii) fuzzed actions whose canonical form is not in the generated set are rejected. Concrete card multisets are validated by multiset inclusion, not by membership in `legalActions`' output — holding 9♠9♥9♦, a player may play *any* two of them as the pair of 9s. For choice phases (tribute / return tribute) the agreement is **exact**: `applyAction` accepts an action iff it is literally in the generated eligible set.
5. **Liveness** — whenever `!isTerminal(state)`, `expectedActors` is non-empty and each expected actor has `defaultAction ≠ null` **or** ≥1 legal action; so a table with timeouts can never deadlock.
6. **Locale-free** — events/errors are keys + structured params. CI greps the engine for CJK/English prose as a backstop.

**What round 2 changed in the obligations and their tests** (explicit, per owner request): obligation **4** is split in scope — canonical-form equivalence for combination plays, *exact*-set agreement for tribute/return choices (test suites updated accordingly). Obligation **3**'s property tests gain two assertions: `antiTribute` reveals exactly the qualifying big jokers and their holders and nothing else, under every config value; `tributePaid`/`tributeReturned` reveal only the moved cards. Obligations **1, 2, 5, 6** and all signatures are unchanged (`viewEvent` already takes `config` since the round-1 review).

**How Guandan implements it (sketch; full rules in docs/rules/guandan.md):**

- `S`: team levels, per-seat hands (multisets), phase (`tribute | returnTribute | playing | matchEnd` — no actorless phases: the hand-ending `applyAction` atomically scores, deals hand N+1 from the stored PRNG state, and enters the next hand's tribute/playing phase), current trick (top play + declared combo + passes), finish order, tribute bookkeeping, variant config, hand number, PRNG state.
- `A`: `{type:'play', cards, decl}` (decl = declared canonical combination — required when wilds make ≥2 interpretations valid, per spec §4.4), `{type:'pass'}`, `{type:'payTribute', card}` *(a **choice**: the rank is forced — highest by levelValue in the newly dealt hand, heart-level wilds excluded — but when several cards share that rank the payer picks the concrete card; suit choice is strategic, e.g. preserving a straight-flush suit. `legalActions` returns the exact eligible set; `applyAction` validates membership in it, not equality to one precomputed card)*, `{type:'returnTribute', card}` *(same choice treatment over the eligible `levelValue ≤ 10` set)*. Anti-tribute needs no action in `auto` mode (`antiTributeMode`, spec §7.6); an explicit decision action exists only under the `optional` variant.
- `E`: `dealt`, `played`, `passed`, `trickWon`, `jiefeng`, `tributePaid{from,to,card}`, `tributeReturned{from,to,card}`, `antiTribute{reveals:[{seat,card}]}`, `handEnded{finishOrder, levelDelta}`, `matchEnded{winner}` — all as data. `viewEvent` redacts `dealt` to own cards; `tributePaid`/`tributeReturned` are **public to all seats by default** (`tributeVisibility: 'public'`, matching the physical game; the `returnHidden` variant strips the card for uninvolved seats); `antiTribute` is **always public in full** — it reveals exactly the qualifying big jokers and who holds each (so everyone sees why tribute was skipped), and never anything else from those hands.
- `C`: exactly the 25-key `RuleVariant` table from the spec (§10), default profile `JIANGSU_OFFICIAL_ONLINE`, house-rules-sensitive keys tagged. Note the round-3 `aFailConsequence='suspendPlayOpponentLevel'` default: level selection consults a per-team `aAttemptsExhausted` flag in `S` (spec §1.5/§6.4) — engine state, no interface change.
- Wild-card validation/generation uses the **template-matching algorithm** from spec §4.4: canonical forms `(type, size, keyRank[, suit])`, multiset-inclusion validation, template enumeration for generation — wild suit assignments enumerated only for straight-flush windows. This is the M1 hard core and gets the heaviest test budget (property tests + golden cases + the spec's §9 edge-case checklist as a named test suite).

The M2 dummy game (`guess-number`) implements the same interface in ~100 lines, and stays in-tree permanently: CI boots the GameRoom against it, which structurally proves the DO never imports Guandan.

---

## 4. Transport & session layer (GameRoom Durable Object)

One DO instance per room code (`idFromName(code)`), SQLite-backed, WebSocket Hibernation API throughout (all patterns below verified in docs/research/reconnection-patterns.md).

**In-DO SQLite schema:**

```sql
room     (id, game_id, variant_json, room_cfg_json, created_at, status)
players  (seat INTEGER PRIMARY KEY, token_hash TEXT, name TEXT, connected INT,
          last_seen_seq INTEGER)
snapshot (seq INTEGER, state_json TEXT)          -- latest authoritative S
events   (seq INTEGER PRIMARY KEY, seat, event_json, at)   -- retained window
actions_seen (action_id TEXT PRIMARY KEY, result_seq INTEGER, at)  -- idempotency
deadlines(seat INTEGER PRIMARY KEY, due_at INTEGER)         -- alarm schedule
```

**Hibernation discipline:** `ctx.acceptWebSocket(ws, [seat:N tag])`; per-socket `serializeAttachment({seat, tokenHash})` (≤16KB limit — we store ~100B); constructor rehydrates the socket→seat map from `getWebSockets()+deserializeAttachment()`; in-memory maps are rebuildable caches, never authoritative; `setWebSocketAutoResponse('ping'→'pong')` for zero-cost liveness — note this matches **exact literal strings only**, so clients send the bare string `ping` *outside* the JSON envelope (a JSON-wrapped ping would wake the DO and be billed). Duration billing stops while hibernated (verified). `compatibility_date` will be ≥ 2026-04-07, which enables `web_socket_auto_reply_to_close`: the runtime auto-replies to Close frames, so `webSocketClose` must not assume it owes a close handshake.

**Turn timeouts (DO Alarms):** on every state transition, recompute `deadlines` (one row per expected actor: `now + actionTimeoutMs`, clamped by room config; disconnected seats get `min(that, now + disconnectGraceMs)` — and when `actionTimeoutMs` is `null`, a **disconnected** expected actor still gets `now + disconnectGraceMs`; `null` disables the timeout only for connected seats), then `setAlarm(min(due_at))`. `alarm()` re-reads deadlines (stale-alarm guard), applies `defaultAction` for each overdue seat via the normal action path (same seq/broadcast machinery), reschedules. Alarms wake hibernated DOs and survive eviction (verified). A room-TTL alarm also self-purges abandoned rooms. The null-timeout-while-disconnected case is part of the M4 deadlock-freedom property test.

**Single-writer guarantee:** a DO processes one message at a time, so `seq++` + state write + event insert happen atomically per action — no locks, no races (verified DO semantics).

**Seat-token authority model (owner direction, M2):** the platform is for friends/family — "fair" means the **system** is fair, not that players are policed. The hard line: redaction is keyed on **which seat tokens a connection actually holds** — a connection holding seat X's token legitimately receives seat X's redacted view; a connection that doesn't, never does. Legality stays fully server-verified. Deliberately NOT built (owner): anti-collusion, one-human-per-seat enforcement, multi-account friction, anti-cheat beyond server authority. One connection may hold **multiple seat tokens, up to all 4** (full self-play): a single **multiplexed socket** carries all held seats (chosen over N sockets — one resync stream, fewer moving parts); actions name their seat, and per-seat messages are delivered on the same socket, one message per held seat. Multi-tab: a new authenticated socket presenting a seat's token takes over delivery for that seat; the old socket keeps any other seats it still holds.

**Lobby phase (owner direction, M2):** rooms start in a pre-game LOBBY: seats are claimed (each claim mints that seat's token), and the room's `{gameId, config}` — **opaque game-defined data to the room layer** — is editable with live `configChanged` broadcasts. Chosen default (simple, family-friendly; owner delegated the detail): **any seated player may edit the config and any seated player may start once all seats are claimed**; start runs `Game.init` (a guarded/invalid config fails the start with a semantic error and the room stays in lobby), then config is **frozen for the match**. The M3 Guandan lobby UI surfaces a curated subset of the 25 RuleVariant keys over this transport; the room layer never learns any Guandan key.

---

## 5. Wire protocol & reconnection design

Versioned JSON envelope on the wire (`v:1`). Semantic keys only — the protocol is locale-free.

**Client → server:**

```ts
{ v:1, type:'hello', token, lastSeenSeq }            // first message after (re)connect
{ v:1, type:'action', actionId, expectedSeq, action } // actionId = client UUID
'ping'                                                // bare literal string, NOT JSON —
                                                      // only exact literals match the DO's
                                                      // auto-response; answered while hibernated
```

**Server → client (every message carries the room seq after it applied):**

```ts
{ v:1, type:'welcome', seq, seat, view, roomInfo, hints? }  // fresh join
{ v:1, type:'resync',  seq, view, events?, hints? }         // reconnect (see below)
{ v:1, type:'event',   seq, event, view, hints? }           // one applied action
{ v:1, type:'presence', seq, seat, connected }
{ v:1, type:'rejected', actionId, error: RuleError }        // semantic key + params
```

`hints` is the recipient's own current legal-action set (`legalActions(state, seat)`), attached game-agnostically by the room layer whenever that seat is an expected actor, and sent **only to that seat**. It powers concrete-card UI highlighting — which cards are tributable at the forced rank, which are eligible returns, which plays beat the current top — without the client re-implementing rules.

**Design choice — view-carrying events:** every `event` message includes the recipient's fresh redacted `view` alongside the semantic event. The event drives animation/log; the view is the authoritative client state. This removes the classic resync trap (client state = fragile fold over an event stream) at negligible bandwidth (a Guandan view ≈ 1–2 KB × 4 players). Clients are rendering functions of the last received `view`.

**Public-tribute consequences (round 2):** none structural — events were already broadcast per-seat after `viewEvent` redaction. With the public defaults, `tributePaid`/`tributeReturned` carry the concrete card to all four seats, and `antiTribute{reveals}` goes to everyone in full (the two big jokers + holders, nothing else). The `returnHidden` variant changes only what `viewEvent` strips, not the protocol. Stored events in the DO log are always full-fidelity; redaction happens at send/resync time, so a variant change mid-match cannot leak or lose history. Double-tribute payments and returns are **staged**: the first committed card produces at most a card-less `tributeCommitted` marker; both `tributePaid` (and later both `tributeReturned`) events are applied and broadcast atomically once both are in, so neither payer/returner reacts to the other's card (spec §7.3).

**Reconnection flow (M4 acceptance):**

1. Client persists `token` + `lastSeenSeq` (memory + localStorage — survives tab reload, not just socket drop).
2. partysocket reconnects with backoff → `open` fires → client sends `hello{token, lastSeenSeq}`.
3. DO authenticates token(s) → seat(s); delivery for each seat moves to the newest socket presenting its token (soft takeover — the older socket stays open and keeps its other seats, per §4); then:
   - gap within retained `events` window → `resync{seq, view, events: redacted delta}` (UI can show what was missed);
   - gap too large / log trimmed → `resync{seq, view}` (snapshot only). Either way the `view` alone is sufficient to resume.
4. Any action the client had in flight is re-submitted with its original `actionId`:
   - already applied → server returns the recorded `event` (dedup via `actions_seen`) — no double play;
   - not applied → revalidated against the *current* state via `applyAction`: accepted if still legal, else `rejected{error}` — and the client, already resynced, re-decides.
5. Presence broadcast on drop/return; the seat's turns are auto-played by `defaultAction` after `disconnectGraceMs` — the table never deadlocks (interface obligation 5).

**Idempotency + ordering:** `actionId` is exactly-once across retries/duplicate delivery. `expectedSeq` is **advisory** (diagnostics/telemetry), not a hard reject: the engine's own `applyAction` validation is the real guard. This matters because `expectedActors` can legitimately hold two seats — in a double tribute both payers submit against the same observed seq, the DO's single-writer loop applies one (seq advances), and the second must still be accepted (it commutes and remains exactly legal). A stale action that is *no longer* legal (e.g. a pass that arrives after the turn was auto-passed) gets a semantic rejection. Together these close every duplicate/stale race identified in research §6 without spurious rejections in concurrent-actor phases.

---

## 6. Debuggability, replay & observability (first-class)

Owner direction: complexity cost is **not** a primary concern — a usable, easy-to-debug, maintainable foundation wins over fewer moving parts. The event-log / seq-resync / snapshot-fallback / idempotency machinery stays at full strength, and the following are **required deliverables**, not nice-to-haves:

- **Deterministic replay harness** (`scripts/replay.ts`, CLI + test utility). Because the engine is pure and seeded, `(seed, config, ordered action log)` reconstructs any match bit-for-bit. Input: a room dump (below) or a bare action log; output: re-derived state at every seq, asserted against recorded snapshots. Three uses: postmortem debugging (replay to the failing seq and inspect), regression-test generation (freeze a real game as a golden test), and property-test failure capture (every fuzz failure emits a replayable log). In the M1 and M2 exit gates.
- **Room dump as a first-class affordance.** The DO's SQLite content *is* the audit trail; dumping it is a documented operation, not spelunking. `GET /api/debug/rooms/:code/dump` returns `{room, players (token hashes only), snapshot, events, actions_seen, deadlines}` in the replay harness's input format. Gating: always on under `wrangler dev`; in production the route 404s unless a `DEBUG_DUMP_TOKEN` secret is configured *and* presented — never public by default. A `scripts/dump-room.ts` wrapper invokes it via wrangler for local/live diagnosis.
- **Structured server logs.** Every state mutation emits one JSON line — `{room, seq, actionId, seat, actionType, outcome: 'applied'|'rejected', error?}` — greppable and correlatable by `room`+`seq` through `wrangler tail`. Semantic error codes are specific enough to diagnose from a single line (`tribute.cardNotEligible`, not `invalidAction`).
- **Readable engine code.** The wild-card template matcher and the tribute state machine carry why-comments and named intermediate values; cleverness loses to auditability in review.

## 7. i18n design

- **Resources:** `src/client/i18n/locales/zh-Hant.json`, `en.json` — flat namespaced keys (`lobby.create`, `game.action.pass`, `card.rank.K`, `error.notYourTurn`, `event.trickWon`), ICU-style `{param}` interpolation. Adding a locale = adding one file.
- **Runtime:** a small typed module (`t(key, params?)`), no framework dependency. Locale files are imported as typed JSON; `keyof typeof zhHant` makes every key typo a compile error and missing-key parity between locales a unit test.
- **Default locale = config:** `src/client/config.ts` → `export const DEFAULT_LOCALE: Locale = 'zh-Hant'` — the one-line change required by the brief. Runtime switcher persists to `localStorage` and re-renders live.
- **Engine/transport locale-freedom:** the engine emits `{code, params}` / semantic events; the server relays them untouched; the client maps `error.${code}` / `event.${type}` → localized strings. Card identities travel as structured data (`{rank:'K', suit:'♠'}`) and are localized/rendered client-side.
- **Enforcement:** ESLint `react/jsx-no-literals` on `src/client` components (allow-list for punctuation/numerals) + locale-parity unit test + CI grep for prose in `src/engine`/`src/server`. "No hardcoded user-facing strings" becomes a build failure, not a convention.

---

## 8. Security

- No secrets in the repo — `CLOUDFLARE_API_TOKEN` (scoped to the single deploy account via the Workers-edit token template; the exact current template name is confirmed at creation time — it's a dashboard-only step and template names drift) + `CLOUDFLARE_ACCOUNT_ID` live in GitHub Actions secrets; local secrets via `.dev.vars` (gitignored, `.dev.vars.example` committed). MVP has no server secrets beyond this.
- Player identity = per-seat random 128-bit token minted at claim time, hashed (SHA-256) at rest in the DO; possession of a token = authority over that seat, and one connection may hold several (self-play is a feature, not an attack — see §4 seat-token authority model). No accounts in MVP.
- Room codes: 6-char unambiguous alphabet (no 0/O/1/I), ~1 billion combinations, non-enumerable (creation returns the code; joining requires it), rooms TTL-purged.
- Server-authoritative everything: hands never leave the DO unredacted; all combination validation (including wild declarations) server-side; client `decl` is a claim the engine verifies.
- Input hardening at the Worker: room-code shape check before DO dispatch; message size caps; JSON schema validation of the envelope.

---

## 9. Milestones & exit gates

Auto-iteration loop within each milestone: implement → tests → self-review → **cross-model audit panel** → STATUS.md update. Panel composition (updated at M1 per owner subscriptions): **Codex CLI and Grok CLI are the primary independent lineages** (both subscribed, ample quota) — for each gate they split the audit surface between them, then spot-check each other's area; Grok additionally corroborates any rules claim research left UNCERTAIN. **Gemini CLI is fallback only** (limited quota, no subscription): invoked solely when a genuine single-pass whole-repo large-context sweep exceeds what Codex/Grok windows can cover — the orchestrator decides per milestone and records the invoke-or-skip reason in STATUS. Each pass and gate records in STATUS.md which models ran, why, what each checked (including checked-clean coverage); a load-bearing check never relies on same-family self-review alone (lineage diversity is the point — historically that's where the catches come from). A gate passes only with everything green; load-bearing audit findings go to the owner before applying.

**Model dispatch (owner policy, updated at M4 — the post-M4 workload shifts to UI/polish):** subtasks are routed by tier, stated one line per subtask (tier, model, why). **Trivial → Haiku-class** (scaffolding, config, boilerplate, mechanical test skeletons). **Standard → Sonnet-class** (routine implementation, components, CI, and most UI/polish work — the default workhorse from M5 on). **Hard → Opus-class, the default top tier** (architecture, protocol/state-space reasoning, root-cause diagnosis, tricky engine logic). **Fable is escalation-only, never a default**: reach for it solely on demonstrated need — a cheaper rung demonstrably failed or is clearly inadequate (mirrors METHODOLOGY's tool-ladder rule) — and log the escalation with its one-line reason in STATUS. Illustrative triggers: Opus stalls on a load-bearing root-cause diagnosis; an audit finding Opus cannot close; genuinely novel engine work at M1 scale. Routine UI/copy/i18n/layout/test-writing is never Fable work; borderline cases prefer Opus and note it. Mechanism: repo-level `.claude/settings.json` pins the session default to `opus` (project settings override user settings; subagents and workflow agents inherit the session model unless explicitly overridden per invocation — see docs/research/model-dispatch.md for the verified mechanism details). The **audit panel above is unaffected and is not a budget lever** — lineage diversity is about catching what same-family review misses, not cost; audit weight per gate remains a recorded judgement call.

Round-3 tracked item: the `aFailConsequence` level-selection module (suspend/resume, spec §1.5/§6.4) is engine work — lands in M1, must be complete and tested before the M3 gate. Not an M0 blocker. ✅ Landed in M1 with named lifecycle tests.

M3 tracked items (owner, M2 kickoff): the Guandan lobby rule-picker UI (curated subset of the 25 keys over the M2 opaque-config transport); the offline draw-card first-lead ceremony as presentation only (engine emits seeded ceremony data under `firstLeadMethod='drawCard'`; outcome distributionally equal to `random` — animation lives in the UI). ✅ Both landed in M3.

M4 tracked items (M3-hardening kickoff): protocol-level **version-skew signal** — long-lived SPA sessions never refetch index.html, so a mid-session deploy strands the running bundle (verified: index.html itself revalidates correctly with max-age=0/must-revalidate; hashed assets ETag-revalidate); the server should advertise its build/protocol version so stale clients can prompt a reload on reconnect. Also: the M2-noted deadline-recompute-restarts-timers refinement.

Named empirical gate checks (promoted from the risk register per round-2 feedback):
- **G-COMPOSE** (M0): the deployed hello-world proves one Worker serves static assets *and* answers through a Durable Object in a single deploy.
- **G-ALARM** (M0, re-checked M2): a DO alarm fires on the free tier — at M0 as hello-world, at M2 while the DO is hibernated.
- **G-WSMETER** (M2): inbound WS-message accounting against the DO request meter measured on real dashboards; budget table §1.6 re-validated with observed numbers.

| M | Deliverable | Exit gate (acceptance) |
|---|---|---|
| **M0** | Repo (MIT), TS toolchain, tsconfig triple, i18n scaffold (zh-Hant/en, config default), CI/CD, hello-world Worker+assets+DO deployed | Push to main auto-deploys a localized hello page to `*.workers.dev`; PLAN/STATUS/SETUP in repo; CI green; **G-COMPOSE** and **G-ALARM** pass |
| **M1** | Pure Guandan engine: combos, comparison, wilds, legal-move gen, tribute, levels — full unit + property tests; **deterministic replay harness** (`scripts/replay.ts`) | 100% of spec §9 edge cases as named tests; property tests (obligations 1–6) pass; zero platform imports (tsconfig.engine compiles); coverage report on engine ≥ 90% lines; **replay harness reconstructs a scripted match bit-for-bit from (seed, config, action log)**; dead-ends recorded in STATUS |
| **M2** | GameRoom DO proven with `guess-number`: connect, broadcast, turn loop, hibernation, alarms, resync skeleton; **lobby phase with live opaque-config editing**; **multi-seat tokens incl. full self-play**; **room-dump route + `scripts/dump-room.ts`** (dump includes `{gameId, config}` + token-hash→seat map); structured mutation logs | 4 simulated clients complete a game via `wrangler dev`; one client claims ≥2 seats and plays them + a 4-seat solo playthrough completes; full lobby → edit → broadcast → freeze-on-start cycle proven on dummy toggles; DO code imports only `engine/core` + the game registry (zero Guandan imports — compile-proven); kill/restart DO mid-game → clients resume from snapshot; **dump→replay roundtrip (config included) reproduces the DO's snapshot**; **G-ALARM (hibernated)** and **G-WSMETER** pass; Codex audits the resync skeleton, Grok the seat-token redaction model |
| **M3** | Guandan behind the interface; table UI (usable, zh-Hant default) | 4 browser clients finish a full match locally (tribute + upgrade + 報牌 visible); e2e test drives a scripted full hand |
| **M4** | Reconnection + timeouts (own milestone) | e2e: drop one client mid-hand → reconnect → same game, correct view, no duplicated action; timeout auto-pass observed; deadlock-freedom property test |
| **M5** | Live MVP: deployed, room-code flow, polish pass on clarity | **Definition of Done:** 4 real people on different networks finish a full game via room code; ≥1 mid-game reconnect; zh-Hant default with live language switch; free tier only |

---

## 10. Risks & open items (tracked, not blocking sign-off)

1. **DO request accounting for WS messages** (1:1 vs folded) — unverified in docs; 50×+ headroom either way. Named gate check **G-WSMETER** (M2).
2. **Preview deploys**: DOs are exempt from version-preview isolation — a `versions upload` preview shares live DO classes. MVP: PRs run CI only, no preview deploys; revisit post-MVP.
3. **Rules spec UNCERTAIN items** (equal-tribute assignment — a verified three-way source conflict, minor combo rulings) — all behind RuleVariant keys with documented defaults; a wrong default is a config fix, not an engine change. ~~Owner table review~~ **done (round 3)**: five defaults confirmed, A-attempt consequence changed to `suspendPlayOpponentLevel` (spec §10, 25 keys).
4. **Hibernation eviction timing** is not precisely documented — the design is eviction-safe by construction (everything rehydrates), so this is a cost/latency curiosity, not a correctness risk.
5. **wrangler v4 assumed current** (npm check was blocked; docs confirm v4 line active) — re-verified at M0 scaffold time by C3 itself.
6. **DO Alarms on the free plan is inferred, not explicitly documented** — the Alarms page states no plan restriction and alarms bill under free-tier-eligible meters (cloudflare-facts §4), but no "available on Free" sentence exists. The turn-timeout design depends on it; named gate check **G-ALARM** (M0, re-checked hibernated at M2).

---

## 11. Sign-off checklist (what you're approving)

- [ ] Single Worker + static assets + co-located GameRoom DO; no Pages; no D1 in MVP (§1)
- [ ] Repo layout + reference-implementation copy/change list (§2)
- [ ] `Game` interface contract + its 6 tested obligations, incl. tribute/return as **choices** surfaced through exact `legalActions` sets (§3)
- [ ] DO design: hibernation discipline, SQLite schema, alarm-driven timeouts (§4)
- [ ] Wire protocol: view-carrying events, per-seat `hints`, `actionId` idempotency, public tribute/anti-tribute reveal semantics (§5)
- [ ] Debuggability: deterministic replay harness, gated room-dump affordance, structured per-mutation logs (§6)
- [ ] i18n: typed key module, zh-Hant default via one-line config, lint-enforced no-literals (§7)
- [ ] Guandan rules defaults: `JIANGSU_OFFICIAL_ONLINE` profile with round-2 pins — tribute/return public, anti-tribute both-big-jokers + mandatory public reveal, tribute/return as player choices (docs/rules/guandan.md §10 — **you said you'll review this table personally**; house-rules-sensitive keys are tagged)
- [ ] Milestones M0–M5, named gate checks G-COMPOSE / G-ALARM / G-WSMETER, cross-model audit panel Codex + Gemini + optional Grok (§9)
