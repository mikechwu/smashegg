# Socket liveness: does the DO ever learn a human is gone? (2026-07-14)

Owner-commissioned pre-M5 research (item 2 of the pre-M5 must-dos). Every
liveness decision in the system keys on "is a socket attached" — Q3 pause
(connected seats → 0), the disconnect grace (a close event), T3 (live socket
count). Q1's edge auto-response answers pings WITHOUT waking the DO, so the DO
has no signal about whether a *human* is there — only whether a *socket* is.
Those coincide only if the browser reliably closes the socket when the human
leaves. M5 is four phones; the single most common event is a screen lock
mid-wait. Nothing had ever tested it.

**Resolution criteria (stated before looking):** the question is resolved when
we know, with sources or measurements, (a) whether a silent-but-attached socket
is ever closed for us — by the browser, the OS, or Cloudflare — and on what
timescale; (b) whether the client's 25s ping keeps flowing when a phone locks
or a tab backgrounds; (c) what signal, if any, the DO can read cheaply enough
to detect ping-silence without sacrificing hibernation. A null on any of these
is acceptable only with a reason (undocumented? version-fragmented? needs a
device?).

**Verdict up front: the gap is real and structural.** No layer closes a silent
socket on a game-relevant timescale (measured ≥30 min on production; nothing in
the docs promises otherwise), the pings do stop on every mobile departure path,
and the DO reads none of it. A locked phone's seat stays "connected"
indefinitely: no grace, no pause — the 45s clock auto-plays an absent human.
The fix direction is evidence-forced and cheap (§5): the runtime already
timestamps every edge-answered ping per socket (`getWebSocketAutoResponseTimestamp`,
readable without waking the DO); we generate that clock today and never read it.

---

## §1 Q-A — code facts (grep, minutes)

- `setWebSocketAutoResponse(PING_PONG)` is armed in the GameRoom constructor;
  the client sends the bare `'ping'` text every 25s (`src/client/room/connection.ts`,
  `setInterval`, guarded on OPEN — precisely the kind of timer background tabs
  throttle and locked phones suspend).
- **`getWebSocketAutoResponseTimestamp` is never read anywhere in the repo.**
  `docs/research/free-tier-efficiency.md` even records the decision: "not
  needed (close events + the onOpen resync suffice)". That assumption is what
  this document overturns: close events are exactly what mobile departure paths
  fail to deliver (§3), so the timestamp is not a nice-to-have — it is the only
  per-socket liveness clock the DO has.

## §2 Q-B — synthetic silent-socket measurement

Probe (Node + `ws`, session scratchpad `probe/probe.mjs`): create a room, claim
a seat over a real WebSocket, then behave per mode; a sidecar poller reads
`GET /info` (public per-seat `connected` flags = the DO's own view) every 60s.

| mode | behavior it models | client behavior |
|------|--------------------|-----------------|
| L1 | frozen tab, TCP stack alive (background-throttled/frozen JS) | never sends app pings; still reads (library would pong protocol pings) |
| L2 | suspended process (locked phone, radio up) | stops reading the socket entirely after the claim |
| L3 | healthy foreground client (control) | sends `'ping'` every 25s |

**Production results (smashegg.mikechwu-iams.workers.dev, 2026-07-14, 30 min):**
- **L1 and L2 sockets were NEVER closed** — open at the 30-minute cap, and the
  DO reported the seat `connected` the entire time. The classic "Cloudflare
  kills idle connections at 100s" did NOT apply (that figure is the
  origin-side Proxy Read Timeout, not a WebSocket idle policy — §3 fact 10).
- **Zero server-initiated protocol pings** in any mode: neither the edge nor
  workerd probes the client. There is no transport-level liveness check AT ALL
  in either direction unless the app makes one.
- L3 control: ping/pong healthy throughout (the edge answers without waking
  the DO, as designed).

**Interpretation:** an "attached-but-silent socket" is, to this platform,
indistinguishable from a healthy one, indefinitely. The only close events the
DO ever gets are (a) a clean client close frame — which locked/frozen mobile
pages mostly never send (§3) — or (b) an eventual TCP-level failure surfacing
as `webSocketClose(1006, wasClean=false)`, whose latency is undocumented and
unbounded (workerd notices only when a read/write fails; §3 fact 12).

**Local (workerd `wrangler dev`) runs:** invalidated for the duration question —
all three local sockets died at the same wall instant with 1006 because I
edited `game-room.ts` while they ran and the dev server hot-reloaded (own
mistake, recorded per the honest-nulls rule; the run still contributed two real
observations: a reload/deploy closes every hibernated socket as 1006 with no
close frame, and `/info.connected` flips promptly once a close IS delivered).
Local workerd had not closed a silent socket in the 4.4 min before the reload;
the production numbers above are the decisive ones, so the local matrix was not
re-run (bounded coverage, stated).

Also measured incidentally (fix round, `repro-g1.mjs` on workerd):
**`ctx.getWebSockets()` still CONTAINS the closing socket during
`webSocketClose`** — any close-time decision keyed on it overcounts by one.
This is why the TTL re-arm self-refused (the immortal-lobby HIGH found by the
restored panel) and why `socketCount()` now reads the sessions map instead.

## §3 Q-C — platform research (5-area sweep, per-claim skeptic-verified)

Fifteen decisive facts, each VERIFIED/UNCERTAIN per source; fetched 2026-07-14.
(Q-C ran as a 5-researcher + 5-skeptic + synthesis workflow; the claim-level
detail lives in the session workflow journal — the load-bearing facts are
reproduced here.)

1. **iOS Safari fully SUSPENDS page JS (setInterval included) on backgrounding
   or screen lock** — the 25s ping loop stops dead. VERIFIED (Apple Frameworks
   Engineer, developer.apple.com/forums/thread/777860).
2. **On iOS lock/app-switch the socket usually dies silently**: no close frame,
   client `readyState` stuck OPEN, no `onclose`; the server holds a half-open
   connection. VERIFIED as the common case (github.com/enisdenjo/graphql-ws/discussions/290);
   packet-level mechanics inferred, not captured.
3. iOS kill timing after lock: seconds-scale but **officially undocumented**,
   device- and version-fragmented. UNCERTAIN (websocket.org/guides/troubleshooting/timeout/).
4. **Safari has no Page Lifecycle `freeze` event** (Chromium-only) — an iOS
   page gets no "about to be frozen" callback to close cleanly in. VERIFIED
   (caniuse.com/mdn-api_document_freeze_event).
5. `visibilitychange`→hidden is the last page-observable event, but iOS fires
   NO events on tab close/app kill (WebKit bug 199854, open since 2019); its
   firing on screen lock specifically is spec-mandated but real-device-unverified.
   UNCERTAIN.
6. **Android Chrome freezes all freezable task queues 5 minutes after
   backgrounding/lock; pings stop; the socket is left open with no close
   frame.** VERIFIED (blink-dev Intent to Ship + field reports).
7. **Desktop Chrome background tabs keep pinging at ~1/minute** (intensive
   throttling degrades the 25s interval; onset 1–5 min, exact shipped state
   UNCERTAIN) — the connection stays healthy while the human may be gone for
   hours. VERIFIED for the throttling rules (developer.chrome.com/blog/timer-throttling-in-chrome-88).
8. **An open WebSocket no longer exempts a page from throttling or freezing
   anywhere** (exemption removed March 2021; Chrome 133 Energy Saver freeze;
   Memory Saver discards kill the connection). VERIFIED.
9. Page discard is unobservable at discard time; bfcache/pagehide are
   navigation-only (irrelevant to lock). Chrome 149 closes WebSockets on
   bfcache entry. VERIFIED (chromestatus.com/feature/5068439115923456).
10. **Cloudflare documents that idle WebSocket teardown exists but publishes NO
    number; the classic "100 seconds" is the origin-side Proxy Read Timeout
    (100→120s, Oct 2025), never a WebSocket/Workers figure.** VERIFIED
    (developers.cloudflare.com/network/websockets/). Our §2 measurement fills
    this hole: ≥30 min, no teardown observed on the Workers/DO path.
11. **`setWebSocketAutoResponse` pings are answered on the DO's host without
    waking the actor; ONLY an exact-match text frame updates
    `getWebSocketAutoResponseTimestamp` (protocol pings never do); the
    timestamp survives hibernation; null if never matched; reading it does not
    wake/bill the DO.** VERIFIED — workerd source
    (src/workerd/io/legacy-hibernation-manager.c++) + developers.cloudflare.com/durable-objects/api/state/.
12. **Silent TCP death eventually surfaces as `webSocketClose` (not Error) with
    code 1006, reason "WebSocket disconnected without sending Close frame.",
    wasClean=false — and it DOES wake a hibernated DO — but detection latency
    is completely undocumented** (workerd has no liveness probing; it notices
    when a receive throws). Event semantics VERIFIED (workerd source); latency
    UNCERTAIN/unbounded.
13. **Deploys, runtime updates, and host relocations terminate ALL hibernated
    sockets** (no documented client-visible close code); DO Alarms are the only
    hibernation-compatible server timer. VERIFIED. (Matches the §2 local
    observation: hot-reload → mass 1006.)
14. **Industry splits transport liveness from human presence**: server-enforced
    heartbeat deadlines for the former (Socket.IO 25s/20s, Colyseus 3s×2,
    Discord zombie detection); client-declared away for the latter (Slack ~10
    min, Discord `since`/`afk`). Turn-based platforms overlay per-turn grace +
    claim-victory (lichess 10s/30s×speed, halved when losing; chess.com
    clamped 30s–3min) — never instant auto-move. VERIFIED.
15. **The alarm-sweep idiom** — periodic `alarm()` reading
    `getWebSocketAutoResponseTimestamp` per socket and closing stale ones — is
    API-sanctioned and used in the wild (casouri/collab-mode, 10-min threshold),
    though PartyKit/PartyServer ship no stale-socket detection. VERIFIED.

**Honest nulls that remain** (documentation cannot answer; noted with reasons):
iOS exact kill timing and whether `visibilitychange` fires on lock (needs a
real-device matrix — the smallest decisive owner experiment: open room → claim
seat → lock phone → wait past a turn → unlock; report what the seat did);
silent-TCP-death → 1006 latency at the DO (needs an unclean-kill measurement —
airplane mode); the deploy close code as seen by clients (observable once
reconnect telemetry exists). None of these blocks the design in §5 — it is
correct for ANY value of them (that is the point of a deadline).

## §4 The reframe, tested: is ping-silence ≈ human-absent?

**One direction holds, and it is the direction we need.** Every verified path
by which a human disappears on mobile (iOS lock, iOS app-switch, Android
lock/background past 5 min, tab discard, process kill) stops the ping stream —
and no path exists where an attentive FOREGROUND player stops pinging. So
silence ⇒ backgrounded-or-gone ⇒ not going to play their turn: treating
ping-silence as absence is not a workaround, it is the more accurate presence
signal, and it makes Q3 pause and the disconnect grace fire in exactly the
situations they were designed for.

**The converse fails, so calibration matters:** a backgrounded DESKTOP tab
keeps pinging at ~1/min indefinitely (fact 7) — pinging does not prove the
human is watching. The staleness deadline must therefore tolerate a legitimate
~60s cadence (never reap a merely-backgrounded desktop tab), and sub-5-minute
"away" detection on Android is impossible from ping-silence alone (pings
continue until the 5-min freeze). Both bounds shape the threshold below; the
richer "connected but hidden" presence UX (client-declared away) is out of
scope (§6).

## §5 Q-D — design: the staleness sweep (evidence-forced)

**Principle: transport staleness accelerates the missing close event; nothing
downstream changes.** A socket whose last edge-answered ping is older than the
deadline is declared dead and CLOSED BY THE SERVER — from there the existing,
already-gated machinery (presence broadcast → disconnect grace clamp → Q3
pause stamp → TTL re-arm) runs unchanged. No new player-visible states, no new
rules: a locked phone becomes exactly what the design already handles, "a
disconnected player", within a bounded time instead of never. (Industry fact
14 is this same split; fact 15 is this same mechanism.)

- **Per-socket last-seen clock:** `lastSeen(ws) = max(getWebSocketAutoResponseTimestamp(ws),
  acceptedAt(ws))`. The timestamp is null until the first ping (fact 11), so
  the socket's accept time — newly carried in the attachment — is the
  baseline. Deploy transition: existing attachments lack `acceptedAt`; on
  rehydration treat as NOW (fail-safe young — a live client re-pings within
  25s; a dead one is reaped one deadline later). Same fail-safe direction as
  the purge gate: never destroy on a missing datum.
- **Deadline:** `STALE_SOCKET_MS = 180_000` (3 min). Calibration: ≥ 2 missed
  worst-case-legitimate 60s throttled pings + margin (fact 7 — never reap a
  backgrounded desktop tab that is still pinging); ≫ the 25s nominal cadence
  and any transient network wobble; small enough that a locked phone's seat
  enters grace/pause within ~3 min. Android's 5-min freeze means silence
  starts late there, not that the deadline must stretch: the sweep reaps
  relative to LAST ping, whenever the silence began. A test-only
  `STALE_SOCKET_TEST_MS` env override (same pattern as
  `RETENTION_TEST_WINDOW_MS`) makes the sweep e2e-drivable in seconds.
- **When the sweep runs:** at the top of every wake that already happens —
  `alarm()` (before the TTL check and the auto-play loop, so both see
  post-sweep truth), and the hello path (before the presence delta). Plus the
  one wake the platform does NOT give us for free: **a fourth alarm candidate**
  in `alarmCandidates` — armed iff any live socket exists, due at
  `oldestLastSeen + STALE`. Without it, an all-phantom LOBBY (no seat
  deadlines, TTL refused under T3) would never wake again — the same
  immortal-lobby shape the panel just caught, one layer up; this candidate
  closes T3's known half-open-socket limitation for good. Cost: one wake per
  ~3 min per room, ONLY while sockets are attached; a fully abandoned (or
  empty) room arms it never.
- **Auto-play interaction (the M5 scenario):** co-players' actions and turn
  alarms are frequent wakes, so a locked phone among active players is reaped
  within ~STALE of its last ping. If ALL players vanish simultaneously
  mid-game, turn alarms keep firing (seats still look connected) until the
  sweep deadline passes, then the sweep closes every phantom → seats hit 0 →
  Q3 pause. Burn is bounded at ~STALE (a handful of auto-played turns), versus
  unbounded today.
- **Close semantics:** server-side `ws.close(4002, 'stale')` (app-range code),
  then the normal `webSocketClose` bookkeeping runs (on workerd the runtime
  delivers our handler for server-initiated closes via the auto-reply-to-close
  compat behavior — verified in the e2e). The client treats it like any drop:
  partysocket reconnects with backoff; a genuinely-alive client that was
  wrongly reaped (deadline misjudged) reconnects within seconds and re-helloes
  — the failure mode is a blip, not a loss (tokens re-attach seats).
- **Client hardening (one listener):** on `visibilitychange`→visible, send an
  immediate `'ping'` (revalidates a zombie-OPEN iOS socket: the send fails →
  the library notices → reconnect NOW rather than at the next 25s tick — §3
  fragmentation rule "never trust readyState on resume").
- **Model=product, gated like the machinery it touches:** the decisions are
  pure — `socketLastSeen(autoResponseAt, acceptedAt)`, `isStaleSocket(lastSeen,
  now, staleMs)`, and the `alarmCandidates` extension — unit/property-tested as
  the same functions the DO calls; wire e2e drives a real reap (non-pinging
  client + tiny override → swept → grace/pause → TTL) and a real keep-alive
  (pinging client survives the window); the restored external panel audits the
  diff.

## §6 Out of scope this round (owner decisions, recorded not smuggled)

- **Client-declared away / presence UX** ("connected but hidden" dimming,
  Slack-style): a product decision; also the only route to sub-5-min Android
  away-detection (fact 6). Needs the visibility signal design.
- **Claim-victory / abandonment affordances** (lichess/chess.com style,
  fact 14): a gameplay rule — owner's by the standing constraint. Today's rule
  (auto-play the default action on deadline) is unchanged.
- **The real-device matrix** (iOS/Android lock behavior as the DO sees it):
  designed as the smallest decisive experiment in §3; needs the owner's phone
  for two minutes per case. The §5 design does not depend on the answer.

## §7 Method note

Q-C ran as a 5-area research + per-claim adversarial-skeptic + synthesis
workflow (11 agents); claim-level returns spot-checked against the journal
before use. Q-B is a direct measurement against production (30-min cap, three
client behaviors, DO-side view via public /info). Q-A is a grep. Sources and
fetch dates inline above; primary-source bias throughout (workerd source,
vendor docs/blogs, spec trackers).
