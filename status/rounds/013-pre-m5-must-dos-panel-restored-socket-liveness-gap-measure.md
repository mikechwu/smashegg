> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Pre-M5 must-dos (2026-07-14/15) — panel restored; socket-liveness gap measured, designed, shipped

Owner brief: (1) restore the independent-lineage panel — the Q3/TTL round's
null was called too early; (2) research→design→gate the socket-liveness gap.
Full audit record: [preM5-liveness-audit.md](docs/audits/preM5-liveness-audit.md);
research: [socket-liveness.md](docs/research/socket-liveness.md).
Model note (ladder): Fable owner-authorized for this round (both items); the
Q-C research fan-out inherited it (load-bearing M5 design input).

**Item 1 — the panel runs headlessly now (the null was an invocation error, not a TTY law).**
`grok -p/--single` had swallowed `--output-format` as its prompt value; the
right recipe is `--prompt-file … --output-format plain --always-approve`.
Codex's missing "clean flushed report" was `codex exec -o <file>`. Recipes +
protocol (throwaway clone per auditor, mandatory verdict-line format) are in
METHODOLOGY's tool ladder; cost is minutes per change, so the panel ran THREE
times this round. It immediately earned it:

- **Re-sweep of Q3/TTL (the missed sweep):** Grok 5 findings (1 HIGH: socket
  departures never re-armed the TTL after a live-socket wake cleared it —
  abandoned lobbies became immortal; root-caused by wire repro to
  `ctx.getWebSockets()` still containing the closing socket during
  webSocketClose, which also broke the ordinary last-tab-closes lobby).
  Codex 3 findings (1 medium: /purge had no live-socket refusal). All fixed
  + wire-regressioned (2b61c9c); fix re-audit: Codex 0, Grok 2 minor (fixed).
  Q3TTL-audit.md's "no surviving defect" header superseded (addendum there).
- **Liveness sweep + verify (below).**

**Item 2 — socket liveness: measured, then designed, then shipped.**
- **Q-B (measurement, production, 30 min):** NOTHING closes a silent socket —
  app-silent and fully-frozen probes both ended OPEN with the DO holding the
  phantom seat "connected" throughout; zero server-initiated pings either
  direction. The classic "100s Cloudflare idle kill" is origin Proxy Read
  Timeout lore, not a WebSocket policy.
- **Q-C (5-area research workflow, per-claim skeptic-verified):** iOS lock
  suspends JS in seconds and kills the socket with NO close frame; Android
  freezes at 5 min, socket left open; desktop Chrome backgrounds keep pinging
  ~1/min (so ping-presence ≠ human-present, but ping-SILENCE ⇒ absent holds —
  no departure path keeps pinging, no attentive foreground player stops);
  `getWebSocketAutoResponseTimestamp` semantics verified from workerd source
  (only exact-match pings update it; readable without waking; null until the
  first ping).
- **Q-D (shipped, 82d13e5 + 3972539):** the staleness sweep — on every wake
  (and armed AT the attach: a 4th alarmCandidates candidate guarantees a wake
  while any socket is attached) the DO closes (4002) sockets ping-silent ≥
  STALE_SOCKET_MS (180s: > Chrome's ~60s throttled legit cadence, > every
  turn budget + grace — calibration pinned in the matrix); the ORDINARY
  disconnect machinery (presence → grace → Q3 pause → TTL re-arm) runs from
  the close. Client hardening: an immediate ping on visibilitychange→visible
  (zombie-OPEN iOS sockets fail the send and reconnect NOW). The T3 half-open
  immortal-lobby limitation is CLOSED (pause-and-retention.md updated).
- **Gate:** pure decisions (socketLastSeen/isStaleSocket/candidates) matrix-
  tested; property model carries the healthy-socket candidate (its untimed
  case caught the semantic change); 4 liveness e2e incl. the M5 locked-phone
  scenario (silent playing client → PAUSE before the turn deadline, seq
  frozen) and the decoupled-window arming proof (production 48h TTL — the
  attach-armed sweep alone reaps). Panel on the liveness diff: both lineages
  independently converged on the same computed-but-never-armed defect (fixed
  + regressioned); verify pass Codex 0 / Grok 2 comment-lows (fixed).
  658 unit + 36 e2e + 4 typechecks green.

**Out of scope, recorded not smuggled (socket-liveness.md §6):** client-declared
away/presence UX (also the only sub-5-min Android detection route);
claim-victory affordances (gameplay rule — owner's); the real-device iOS/Android
matrix (smallest decisive experiment designed in §3; needs the owner's phone
~2 min per case; the shipped design is correct for any outcome).

**Production notes:** three probe lobbies (V3B92T/BLQSFN/4AFJ9D) created for
Q-B were re-armed post-deploy (connect+close touch) and will self-purge in 48h;
pre-existing lobbies whose last tab closed before this deploy have no armed
alarm — any future touch (a socket attach) re-arms them, or the §4 script
reclaims known codes.
