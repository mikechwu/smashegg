> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Q3 pause-on-idle + retention-TTL (2026-07-15) — GATE REACHED on feat/q3-ttl

Free-tier action set (owner-approved Path A). Design:
[pause-and-retention.md](docs/research/pause-and-retention.md); audit:
[Q3TTL-audit.md](docs/audits/Q3TTL-audit.md). Built autonomously under the owner's
run-to-completion grant, off `main` until the gate passed.

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Model = product (no virtual-model test) | The pause/resume/TTL DECISIONS extracted to pure fns (isPausedRoom / mayAutoPlay / resumeOffsetMs / alarmCandidates + retention.ts) that BOTH game-room.ts AND the tests call | ✅ |
| Property test P1–P4 | deadline-liveness.property.test.ts: P1 (paused ⇒ no alarm), P2 (resume conserves remaining — exactly 60s not fresh 90s), P3 (non-actor resume leaves absent actor armed), P4 (deploy-transition stamp + one guard-path auto-play); coverage counter proves the random driver reached pause AND resume | ✅ |
| Decision matrix T1–T3 | retention.test.ts (32): lazy=lobby-only auto-purge, T3 live-socket-never-purged, guard-path arithmetic, fail-safe NULL anchor, stamp≡pause | ✅ |
| Wire e2e | retention.e2e.test.ts: stamp-ordering, no-auto-play-while-paused, resume, real deleteAll → 404, seatless-socket T3, ordinary-reconnect regression | ✅ |
| Two counts unswappable | branded ConnectedSeatCount/LiveSocketCount, constructed only at seatCount()/socketCount() — swap = compile error | ✅ |
| Suites | 645 unit + 29 e2e green, 4 typechecks | ✅ |

**Owner catches folded in during build (6):** deploy-transition NULL-offset
(constructor lazy-stamp); lazy-TTL contradiction (auto-purge lobby-only, meter
asymmetry); live-socket TTL gate + T3; guard-path 0-remaining pin (no floor);
paranoid purge gate (null → fail safe); branded counts + 2-accessor surface;
honest eager-flip comment (not retroactive).

**Bugs the gate caught + fixed autonomously (3):** never-joined-room orphan
(arm TTL on create); warm-instance-after-deleteAll 500 (restore empty schema →
404); Codex's resume-path fragility (gate resume on the true 0→1 edge).

**Cross-model audit — partial, honestly weighted.** Codex (independent lineage)
reviewed and contributed the resume-path fix — but its headless CLI hit the M4
read-only-sandbox EPERM and never flushed a clean report (finding recovered from
its trace; weighted as reasoned corroboration, not a green run). **Grok did NOT
run** — headless `-p` cut after the preamble (TUI needs a real terminal). The
independent-lineage panel the owner emphasized is therefore DEGRADED this round;
a fuller external sweep would need the owner to run codex/grok interactively.
The substantive review is the independent adversarial pass + the tests above.

**Sequence COMPLETE (2026-07-15, autonomous run):**
- **Merged + deployed** (build 944656f, self-verified). **Live-confirmed the
  retroactive pause:** the 3 zombies (P2FFYD/YM2C72/M74D3N, which had climbed to
  seq 364/469/359 — burning the whole time) FROZE — 0 seq advance over 95s. The
  burn is stopped. They'll be reclaimed via §4 on owner confirmation (frozen at
  ~3–4k rows each; not urgent).
- **§4 cleanup script** (scripts/cleanup-rooms.ts) + token-gated `POST
  /api/rooms/:code/purge`: explicit codes, dry-run default, dump-first,
  irreversible only on --delete. e2e: dump→purge→404. NOT auto-invoked.
- **7 PLAN drifts corrected** (R3 sweep) — the false TTL claim (×3) replaced with
  the real lazy mechanism; players→seats + new columns; hibernation tags;
  dump route path/shape + purge; resync-not-event; pre-M4 fresh-clock wording.
- **Q4:** the native Workers `ratelimits` binding on POST /api/rooms is
  Free-available (deploy accepted — closes the one UNCERTAIN) + wired in
  (optional, degrades to no-limit). Functional note: an 18-request burst did NOT
  trip it — the documented permissive/eventually-consistent behavior (per-PoP,
  not an accurate accounting system); it backstops a SUSTAINED accidental loop,
  not a burst. Primary guard = the client's already-debounced create button (no
  retry loop) + fail-closed-at-$0. 18 test rooms created will lobby-TTL self-purge.
- Suites: 650 unit + 30 e2e green, 4 typechecks; CI + Deploy green.

**Audit caveat carried:** the independent-lineage panel was DEGRADED — Codex
contributed 1 fix (resume 0→1 edge) but its headless CLI never flushed a clean
report; Grok did not run (TUI needs a terminal). See docs/audits/Q3TTL-audit.md.
A fuller external sweep needs the owner to run codex/grok interactively.
