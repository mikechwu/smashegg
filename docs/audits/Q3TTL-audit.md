# Q3 pause-on-idle + retention-TTL — cross-model audit (2026-07-15)

Feature: docs/research/pause-and-retention.md, implemented on `feat/q3-ttl`.
Load-bearing DO deadline/alarm machinery whose corrected design came from a
SINGLE adversarial lineage and whose first draft broke in two high-severity ways
— so the panel re-audits it independently, and it is NOT trusted for having
caught earlier bugs.

## Outcome: 1 audit finding fixed; 3 bugs total caught by the gate; no surviving defect

### Codex (external lineage) — 1 finding, FIXED + regressioned
Codex (gpt-5.5, read-only intent) reviewed `git diff main..HEAD` + the design doc.

- **Resume-path fragility (robustness).** `resumeFromPause` was entered on ANY
  hello with `connectedAfter.size > 0`, relying on "it no-ops when
  `pause_started_at` is NULL" for correctness on ordinary mid-game hellos. The
  code was correct today (`pause_started_at` is non-NULL only when seats==0), but
  that is correctness-by-invariant, not by construction — a latent fragility if a
  future change ever set the stamp with seats connected. **Fix:** the resume now
  fires ONLY on the true `connectedBefore==0 && connectedAfter>0` edge, so an
  ordinary mid-game hello can never shift deadlines regardless of the invariant.
  Regression: retention.e2e "an ordinary mid-game reconnect never pauses or
  shifts". (commit b5507f1)

**Codex tooling caveat (WEIGHTED, per the M4 standard — and worse this round):**
Codex could not flush a synthesized findings report to redirected stdout in the
headless/background harness (3 invocations: `review` and read-only `exec` both
hit the macOS read-only-sandbox EPERM on git's cache — the M4 pattern — and a
default-sandbox `exec` avoided EPERM but still ended on the diff dump without a
final list). The finding above was recovered from Codex's *exploration trace*
(its own assessment: "the resume path is entered on any hello while
connectedAfter.size > 0, not only on a true 0→1 edge … would convert an ordinary
hello into an unintended deadline shift"). So Codex DID contribute a real finding,
but its verdict is a partial/reasoned pass, not a clean executed one — weight it
as corroboration of the independent review below, not as an independent green run.

### Grok (external lineage) — NOT RUN this round (honest null)
Two headless attempts (`grok -p`) printed the exploration preamble then exited
without a findings list — the Grok TUI needs an interactive terminal the
background harness doesn't provide. Grok's sweep (I1–I4/DL1–DL3/P1–P4/T1–T3,
stamp≡pause, meter-asymmetry, comment overstatement) was NOT obtained. This is a
real gap in the panel, recorded plainly; a fuller external sweep would need the
owner to run `grok`/`codex` interactively (they have a TTY).

### Independent adversarial review (the substantive pass) — no high-severity defect
Traced every load-bearing path (grounded, not trusting the design):
- **Resume re-arms:** the 0→1 hello → resumeFromPause (shift) → reconcileDeadlines
  → scheduleAlarm re-arms the seat alarm at min(shifted due); no connected player
  is ever stranded without an armed alarm.
- **No dodge / no fresh clock:** resume shifts base by the paused duration, then
  restore-to-base gives the preserved remainder (I1 holds post-shift); double
  resume is idempotent (`pausedAt===null` guard); property P2 pins "exactly 60s,
  not a fresh 90s".
- **stamp≡pause:** `pause_started_at` is set only when seats hit 0 (handleSocketGone
  / hello-empties / constructor) and cleared only on resume, so paused ⟺
  non-NULL; the constructor stamps only when NULL (a normally-paused room keeps
  its true offset).
- **Deploy transition:** a pre-Q3 zombie's stale alarm self-clears on its first
  post-deploy wake (scheduleAlarm → deleteAlarm), stopping the burn; the
  constructor lazy-stamp means no reachable NULL-offset resume; the guard-path
  resumes to exactly one 0-remaining auto-play (P4, no floor).
- **alarm() scoping:** seat auto-play guarded on connected SEATS (mayAutoPlay); the
  TTL purge on live SOCKETS (T3) and runs regardless; a paused room auto-plays
  nothing (e2e: seq unchanged 6s past the deadline).
- **Purge gate:** isAutoPurgeEligible refuses on a null status/anchor (fail-safe);
  deleteAll()+ensureSchema() yields a clean 404 (never a 500 or resurrection).
- **Meter asymmetry:** lazy mode auto-purges lobby-abandoned only; finished/paused
  arm no TTL (reclaimed manually) — no scarce-meter spend for abundant storage.
- **Binding seam:** the two branded counts are constructed only at
  seatCount()/socketCount(), each bound to its correct source; a swap is a compile
  error.

### 3 bugs the gate caught + I fixed (autonomously)
1. A room nobody ever joins would orphan forever (idle DO runs no code) → arm the
   lobby TTL on creation.
2. After deleteAll() drops the tables, a warm DO instance's next read hit a
   missing table → 500 (not 404) → restore an empty schema post-purge.
3. (Codex) the resume-path fragility above.

## Coverage backing the verdict
645 unit — retention decision matrix (32; T1–T3, guard-path, stamp≡pause,
fail-safe anchor) + property P1–P4 driving the REAL pure decisions, with a
coverage counter proving the random driver reached pause AND resume. 29 e2e —
wire integration: stamp-ordering, no-auto-play-while-paused, resume, real
deleteAll purge → 404, seatless-socket T3, and the ordinary-reconnect regression.
4 typechecks clean.

## Standing process note (owner)
The PLAN-drift standing check now extends to **load-bearing comments in new code**,
not only PLAN.md — the "eager flip is not retroactive" correction was a fresh
comment overstating the code, caught this round.
