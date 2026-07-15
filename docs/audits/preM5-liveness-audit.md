# Pre-M5 round — restored panel + socket-liveness audits (2026-07-14/15)

Two owner-commissioned items: (1) restore the independent-lineage panel whose
Q3/TTL-round null was called too early; (2) research-then-design-then-gate the
socket-liveness gap (does the DO ever learn a human is gone?). Both external
CLIs now run headlessly per METHODOLOGY's tool ladder (recipes there); every
sweep below is a CLEAN EXECUTED verdict with a checked-clean list — no trace
recoveries, no reasoned-only weighting.

## Sweep 1 — Q3/TTL re-audit (the missed sweep, original brief)

- **Grok: 5 findings (1 HIGH, 2 medium, 2 low)** + a 20-item checked-clean
  list. The HIGH: a socket departure never re-armed the TTL once a
  live-socket wake had cleared the alarm → abandoned lobbies became IMMORTAL.
  Verified against the code, then root-caused by wire repro:
  `ctx.getWebSockets()` still contains the closing socket during
  `webSocketClose` (measured on workerd), so close-time re-arms refused
  themselves — which meant the ordinary "last tab closes on a lobby" was
  broken too, beyond Grok's lurker scenario.
- **Codex: 3 findings (1 medium)** + checked-clean + ran the unit suite
  itself. The medium: token-gated /purge deleted rooms with live sockets
  attached (no last-gate refusal).
- Overlapping lows from both: the touchActivity comment overstated its call
  sites; the stamp≡pause unit test was a tautology.
- **All fixed with wire regressions** (commit 2b61c9c): socketCount() reads
  the sessions map (deleted-first at close); seatless departures do the full
  bookkeeping; /purge 409s unless ?force=1 (CLI --force + non-zero exit on
  refusal); claim/config/timing/start stamp the activity anchor; the
  stamp≡pause test became a source contract pinning the exact call shape —
  which immediately caught the hello-empties site re-deriving the predicate
  (now calls isPausedRoom like the other two sites).
- **Fix re-audit:** Codex 0 findings; Grok 2 minor (CLI exit code on refusal;
  tighten the source-contract regex) — both fixed in the same commit lineage.

## Sweep 2 — socket-liveness change (commit 82d13e5)

The staleness sweep (design: docs/research/socket-liveness.md §5) audited by
both lineages against a 7-item hunt list (reap-the-living, sweep/alarm
reentrancy, the 0→1 resume edge, attachment rehydration, model divergence,
the client visibility ping, comment overstatement).

- **Both lineages independently converged on the same real defect** (Grok:
  HIGH; Codex: medium — its only finding): the sweep candidate was COMPUTED
  in alarmCandidates but never ARMED on the attach path — the upgrade
  handler, the common tokenless first hello (no presence delta), and
  claimSeat all skipped scheduleAlarm, so an idle lobby's frozen phone
  waited for the 48h TTL wake instead of acceptedAt+180s. Both auditors also
  caught that the e2e masked it: retention and staleness were shrunk to the
  same 1.5s, so the create-time TTL alarm bootstrapped the reap.
- Grok additionally: [low] the healthy-world property model cannot reach the
  one-quiet-peer ordering; [nit] setSeats' acceptedAt fallback should
  backfill the map.
- **All fixed** (commit 3972539): the attach itself parks the sweep wake
  (upgrade awaits scheduleAlarm; every hello exit schedules); a NEW
  decoupled-window e2e (production 48h retention + 1.5s stale override — the
  TTL cannot provide the wake) proves the arming alone reaps; a named
  quiet-peer unit case pins the pull-forward ordering; the map backfill and
  the doc/e2e overclaims corrected.
- **Fix verify pass:** see the addendum below.

## Checked clean (both sweeps, condensed)

Deadline invariants I1–I4 and liveness DL1–DL3 post-shift; P1–P4 incl. the
deploy transition and the guard-path 0-remaining pin; T1–T3 with the
live-socket gate; stamp≡pause at all three sites; meter asymmetry
(lazy = lobby-only auto-purge; finished stays for replay — now also proven on
the wire); alarm() ordering (probe → sweep → TTL → auto-play → re-arm) with
no reentrancy or spin (isStaleSocket ≥ so a due wake reaps); the branded-count
seam (sessions-sourced socketCount, its close-time edge intentional);
purge-path safety incl. warm-instance 404 and the new 409 gate; the hello
sweep before the presence delta (no double-shift on the 0→1 edge);
attachment/rehydration fail-safe-young; the client's single bound
visibility listener. Suites at close: 658 unit + 36 e2e + 4 typechecks.

## Process notes

- The panel now costs minutes per change (headless recipes in METHODOLOGY),
  so it ran three times this round instead of once per milestone — and each
  run earned its keep: sweep 1's HIGH and sweep 2's convergent
  computed-but-never-armed defect were both invisible to the in-house review
  AND to a fully green suite.
- The lineages disagree productively: Grok called /purge clean where Codex
  flagged it; Codex missed the TTL re-arm HIGH that Grok caught. Two models
  is the minimum panel, not a luxury.
- Q3TTL-audit.md's "no surviving defect" header is superseded (addendum
  there) — the ratchet's lesson repeated: a clean verdict is a statement
  about the checks that ran, never about the code.

## ADDENDUM — verify pass on commit 3972539

- **Codex: 0 findings.** Checked the async-upgrade promise chain, the
  no-half-init claim (alarm due is future; single-threaded DO), the no-delta
  hello exits, the map backfill, the decoupled e2e's false-pass surface (no
  probe armed, no lobby seat deadlines, claim never schedules), and the
  quiet-peer arithmetic. One nuance recorded: the e2e proves the accept+hello
  bootstrap jointly, not upgrade-only isolation (the designed redundancy).
- **Grok: 2 low — both comment precision, both fixed.** The upgrade comment
  called the pre-fix hole "immortal" (it was a 48h-DELAYED phantom — the TTL
  wake's own sweep would eventually reap it; true immortality was the earlier
  seatless/T3 bug); a unit expect-message said "reaped" where only the
  decision-layer ordering is asserted. Grok's checked-clean additionally
  pinned: every hello exit schedules; the e2e cannot false-pass on any
  seconds-scale wake (probe is 15s HTTP-armed-only; 48h TTL both far and
  T3-suppressed); the quiet-peer arithmetic.

Final state at close: 658 unit + 36 e2e + 4 typechecks green; three panel
rounds this cycle (re-sweep, liveness sweep, fix verify), all clean executed
verdicts from both lineages.
