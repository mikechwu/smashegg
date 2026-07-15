# STATUS

## Current phase: pre-M5 UX/UI polish COMPLETE — Lacquer Ledger ring DEPLOYED (main 6bc63e9); M5 next (owner gate)

**Last updated:** 2026-07-15

## Pre-M5 UX/UI polish (2026-07-15) — AUDIT done; PLAN pending owner pick (strict AUDIT→PLAN→EXECUTE)

Owner brief: fix the structural UX problems before four family members see it —
"would someone who didn't build this know what to do?" Sequence is strict:
audit (collect, don't fix) → plan WITH owner → execute. Deliverables:
[docs/audits/preM5-ux-audit.md](docs/audits/preM5-ux-audit.md) (findings) +
a visual proposal artifact (ring wireframes + 3 style directions):
https://claude.ai/code/artifact/805c4d3a-4f93-44c8-a790-74dc52317d2d

**Phase A method:** computer-use self-play on the deployed build (f6d6bc6), desktop
1440px + TRUE 390px (the Chrome window clamps at innerWidth 606, so 390 was rendered
via an injected same-origin iframe — shared localStorage → same seats). Companion
research: an 11-agent workflow (design-system / four-handed layouts / small-screen
legibility / CJK-a11y), journal spot-checked, no placeholder junk.

**The framing finding:** `seatLayout(you)` already maps south=you, north=(you+2)=partner,
E/W=opponents — the ring semantics EXIST but render as a 3-plates-across-top + hand-at-
bottom stack with a dead center. Converting to the asymmetric ring is a LAYOUT change,
not a seat-logic change, and is the canvas every other decision sits on → decided first.

**Findings (full log in the audit doc):**
- **P1 F3** — raw error codes leak to the player (`room.notSeated` etc.); pre-seat pickers
  are rejected but look editable; the rejection never clears, follows you into the game,
  renders on 2 surfaces and covers the hand. (a reload clears it — per-session client state.)
- **P1 F4/F5** — partner invisible (3 identical top plates; 我隊/對方 only on the level rail).
- **P2** — whose-turn is spectator-phrased on your own seat (F8); level 打幾 not headlined
  (F7); wild 紅心級牌 never stated unless held (F6); no 報牌 ≤10 escalation (F11, confirmed
  from SeatPlate.tsx — count chip is value-independent); no legal-play cue on a normal turn
  (F9 — owner decision, per-card legality is genuinely ambiguous in Guandan).
- **P3** — lobby 2×2 grid → lobby ring; 掼 vs Traditional 摜 glyph (confirm).
- **Keep:** rule/timing pickers, ceremony, level STATE (Phase B folded it into the
  headline badges; the LevelRail ladder was retired), 配 marker, trick well, CCW order,
  27-card hand legible in 2 rows @true-390 (no overflow), sort toggle, 3-locale integrity,
  起手思考 planning-clock distinction.
- **Not re-driven live (recently verified M3/M4; Phase-B re-verify vs the ring):** wild
  multi-reading chooser, tribute/anti-tribute/接風, match-end overlay, live 1–2-card state.

**Proposal:** the asymmetric ring (you bottom · partner top · opponents flanking a bounded
center) on BOTH lobby and table, + shared information fixes (turn-in-words, level+wild
headline, ≤10 escalation, two team badges, partner-by-position, human error copy). Three
style directions to choose from — **Lacquer Ledger (recommended)** / Ink & Goldleaf /
Table Around You — all on the same ring + fixes. Recommendation: Lacquer Ledger base +
one bold move (a Songti 打幾 level headline). 5 owner decisions surfaced (style, clock
placement, partner-hand visibility, 4-colour deck, legal-play cue). **No behaviour/engine/
protocol/timing change** proposed — layout & presentation only.

### Phase B APPROVED (owner, 2026-07-15) — Lacquer Ledger ring, F3 first + independent

Owner picks: **Lacquer Ledger** + the one bold move (a Songti 打幾 headline, spent on the
most under-served fact F7). Clock on the seat plate (escalate on your own seat when short;
不限時 keeps no clock; keep the 起手思考 planning distinction). Partner/opponent hands
**value-dependent** (2 cards must LOOK different from 27 — solves F11 structurally; take the
idea from card-back arcs, leave the felt). Legal-play cue **binary** (「你有可以壓的牌」 vs
「壓不過,只能過」, 過 prominent when no) — NOT per-card highlighting (legality is per-combo).
4-colour deck = settings toggle default off, BUT ♥/♦ must be distinguishable at true 390px
in the DEFAULT deck (verify + report). No behaviour/engine/protocol/timing change. Model
dispatch: Opus layout/hierarchy, Sonnet CSS/components once the direction holds.

**Sequencing:** F3 (independent, done) → ring skeleton 390px-first → info fixes
(turn-in-words, 打幾+紅心級牌 headline, two team badges + partner-by-position, human error
copy, lobby ring) → Songti bold move → visual re-verify incl. the not-re-driven list →
cross-model panel (VISUAL-change brief) → deploy.

**F3 SHIPPED (feat/preM5-ux-ring, first + independent).** The first-thirty-seconds chain
fixed whole: pickers read as disabled-until-seated (Lobby.configEditable pure predicate) with
a "先入座才能調整規則與計時" hint, so an unseated edit can't fire; a NEW `describeError`
(src/client/errors.ts) is the single user-facing mapper for the lobby banner AND the in-table
toast — every server rejection code → human copy in all 3 locales, unknown → generic human
line, NEVER the raw code (retired errorKeyFor + the leaky room.rejected/game.error.unknown
`{code}` keys); rejections clear on next action / lobby→game / dismiss, and the app-shell
banner is lobby-only so one failure never renders on two surfaces. Regressions: errors.test.ts
(no code leaks in any locale + dedicated copy), lobby.test.ts (configEditable), store.test.ts
(clear-on-action/start). Unit suite green (670 at F3; 680+ after the ring predicates
and the panel-fix regressions). Live-verified on wrangler dev:
pre-seat pickers dimmed + hint + no rejection on click; seating enables them and clears the hint.

**Methodology flag to close (owner):** Phase A found Chrome clamps at innerWidth 606, so true
390 needs an injected same-origin iframe. What width were M3/M4's "390px verified" claims made
at? To be recorded in this STATUS + the iframe recipe added to METHODOLOGY so 390 is never
claimed loosely again. (Substance survives — this round confirms the 27-card hand is legible at
true 390.)

### Phase B BUILD — ring shipped-ready (feat/preM5-ux-ring); panel running

The M3 3-plates-across-top table is now the asymmetric RING in Lacquer Ledger: you bottom,
partner across the top, opponents flanking a bounded centre (seatLayout already mapped the
directions → a rendering change, not seat logic). Commits: b51e7ed (audit) → 96b5726 (F3) →
54b92e2 (ring + F9) → 0ae25ac (lobby ring + ratchet) → 61d8e56 (cleanup + desktop).

**Info fixes shipped + LIVE-VERIFIED** (dev server, real states driven to via a hints-only bot):
- **F7** 打幾: a large Songti goldleaf level headline (the one bold move).
- **F6** wild: the 紅心級牌 stated ALWAYS (♥{rank} 配 chip), not only when held.
- **F8** turn-in-words: 輪到你 / 輪到 X on your own seat, not spectator-phrased.
- **F5** partner: a 隊友 tag (ivory, non-colour cue) + partner-across-the-top position.
- **F11** 報牌: a value-dependent mini card-back fan — 2 cards LOOK unlike 27 (verified 13 vs 3 vs
  2 at true 390) — + numeral escalation at the ≤10 / ≤2 lines (handSizeTier).
- **F9** legal-play: binary cue 「壓不過,只能過」 with 過 promoted when you can't beat; 「你有可以壓的牌」
  otherwise (beatState).
- Lobby ring: the same partners-across layout (§2).
- Ratchet: beatState + handSizeTier extracted as pure predicates, pinned in ring.test.ts (the
  client suite is DOM-free — the visual gates live as testable decisions).

**Edge states re-verified in the ring** (all render correctly, undisturbed): the wild
multi-reading chooser (opens over the centre, NOT clipped, both readings + substitution chips),
the match-end result overlay, the hand-1 ceremony, the tribute panel, the trick well, low-card
divergence; 3-locale integrity (zh-Hant/zh-Hans/en, no break, endonyms verbatim; 配→Wild,
隊友→Partner, 打幾→LEVEL, 輪到→'s turn). Suits distinguish by GLYPH SHAPE (♥ vs ♦), not colour
alone. Anti-tribute / 接風 are seed-dependent center-panel/banner content (TributePanel /
TrickWell verified) — to confirm in the post-deploy live pass.

**True-390** verified via an injected same-origin iframe (Chrome clamps at innerWidth 606): no
horizontal overflow, the 27-card hand legible, fans read. Method + iframe recipe to be added to
METHODOLOGY (closes the "what width was 390?" flag).

**Deferred (flagged for owner):** the full 2..A level LADDER visualisation — the LevelRail
component was deleted; its STATE (team levels, A-attempts, suspension) is carried by the
headline + team badges, but the climbing-ladder view is gone (re-addable as an expandable).
4-colour deck stays a settings toggle default-off; default ♥/♦ separation rests on the glyph
shape (confirm crispness in the post-deploy pass).

**Cross-model panel (Codex + Grok, a scratch clone each, VISUAL-change brief).** Round 1: 6
findings (0 high, 2 medium, 4 low). Both mediums were F8-completeness — the headline turn cue
keyed on ring/deadline data (empty for untimed anti-tribute → `yourTurn = hints !== null`), and
the CENTRE well still spectator-phrased YOUR own lead (the original F8 defect → `leadPromptKey`
→ 輪到你出牌). Lows: the error-ratchet comment overstated + missing room.notFound; dead
.gd-rail/.gd-layout/… CSS orphaned by the LevelRail delete; a stale test count; a SeatPlate
comment. All fixed + regressioned. Fix re-audit: **Grok 0 findings**; **Codex 1 medium** — the
error ratchet's code list was an incomplete subset (engine forwards more codes); fixed by listing
the COMPLETE Guandan-reachable inventory + a structural forged-code test proving leak-safety by
construction. BOTH auditors' checked-clean, twice, independently confirmed the two correctness
gates: **no engine/server/redaction/timing change**, and **the ring exposes no other seat's hand**
(the mini-fan/count read only view.cardCounts). 680 unit + 4 typechecks green.

**DEPLOYED (main 6bc63e9, 2026-07-15).** Fast-forward merge feat/preM5-ux-ring → main → push;
CI + Deploy green; live build == 6bc63e9 confirmed; the lobby ring verified rendering on
production. Revertible by redeploying main@f6d6bc6 if the aesthetic needs a change for M5.

**Deferred / for M5 (flagged):** the full 2..A level LADDER (state kept in the headline badges;
ladder viz re-addable as an expandable); a real-device iOS/Android matrix; anti-tribute / 接風
seed-dependent center-panel states (TributePanel/TrickWell verified — confirm live in M5); the
4-colour-deck default is off (♥/♦ separate by glyph shape). Next: M5 — 4 real people on different
networks, ≥1 mid-game reconnect, live language switch, free tier only (OWNER GATE to start).

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

## M4 (2026-07-14) — reconnection + timeouts + owner items A/B: implementation complete, gate report final

### M4 GATE REPORT — all criteria green; audits resolved

Owner did not approve the gate outright — instead redirected to a close-out
pass (below) plus a question-first free-tier-efficiency research interlude
([docs/research/free-tier-efficiency.md](docs/research/free-tier-efficiency.md),
propose-then-implement) before the M5 decision. This report is final: every
criterion is green and both cross-model audits are archived and resolved.

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Reconnection acceptance (PLAN §5) | e2e reconnection suite: mid-hand drop → reconnect(token, lastSeenSeq) → delta resync with exact contiguous events + per-seat redaction + presence recovery + game continues; snapshot fallback FORCED via lobby-era lastSeenSeq (resync.events === undefined asserted, then plays from the snapshot); no duplicated action across a drop (same actionId resent → resync-not-reapply + witness seq-gap proof) | ✅ |
| Deadlock-freedom property | tests/unit/server/deadline-liveness.property.test.ts: virtual clock over the REAL pure helpers, both games × {fast, standard, untimed, legacy-null}, DL1–DL3 + I1–I4 after every event; named cases incl. untimed + sole-actor disconnect → grace row in the same event → alarm resolves (the PLAN §4 null-timeout case), double tribute co-actor preservation, reconnect-restores-base | ✅ |
| Version skew vs actual redeploy | LIVE DRILL on production (rooms P2FFYD, build bd505e6→7f5744d): tab on old bundle + real deploy → no banner while socket persists (documented limitation observed) → reconnect → 「已有新版本…」 banner over the INTACT mid-hand table; played an action (the wild chooser!) with the banner up (non-blocking proven); 稍後 dismissal survives further reconnects (keyed by build); reload restored the same seat/hand on the new bundle (console: old build ×4 → new build). Every future deploy self-verifies: the smoke check asserts /api/health build == pushed SHA (retry loop after the first versioned deploy raced edge propagation — diagnosed, fixed) | ✅ |
| Timing config (owner item B) | TimingPicker live (快棋/標準/悠閒/不限時, frozen after start, seated-only authority observed rejecting over the wire); defaults standard 45s/90s justified in docs/research/room-timing.md §5 against an honest research null result; untimed preset live (no clocks connected; hint discloses the 60s grace); planning window OBSERVED live: leader's plate showed 起手思考 82s after the ceremony — the 90s window armed at start and absorbed the ~5s ceremony per design; e2e pins preset→wire deadline windows, timeout auto-play observed end to end (~5s custom timing), untimed grace row on disconnect | ✅ |
| Fresh-clock fix (M2 item) | base_due_at decision table (doc §2) implemented in pure nextDeadlines; every table row unit-pinned by name; wire-level e2e regression: drop + reconnect on the clock → dueAt restored EXACTLY to base, never re-armed; presence isolation (seat X blip leaves seat Y byte-identical) | ✅ |
| Wild chooser card faces (owner item A) | docs/research/wild-chooser-ux.md (data-availability verdict: derivable client-side, zero engine change — obligation 4 untouched); wildSubstitutions/resolveComboFaces unit-tested against validatePlay reconstruction; 390px fit pinned by CSS-token arithmetic ratchet; LIVE: one-wild chooser ({10,10,Q,Q,配} → 三帶二 Q / 三帶二 10, weaker picked and bound), TWO-WILD chooser hunted onto production ({A,A,Q,配,配} → mixed chips W→A + W→Q vs collapsed ×2 W→Q, single row height, weaker picked and bound), 390px multi-option chooser verified in a true 390px viewport | ✅ |
| Boundaries | Engine pure/time-free (timingClass is a pure state→label); DO game-agnostic (grep: zero game imports; timing map is opaque); RuleVariant 25 keys untouched; legacy rooms bit-identical (timing_json NULL → actionTimeoutMs path) | ✅ |
| Suites | 609 unit + 25 e2e green ×(independent verification), 4 typechecks; CI + versioned Deploy green | ✅ |

**Visual-round findings (ratchet), both closed:** (1) big-joker single labeled 單張 A (client renders keyRank, a frozen placeholder for joker-keyed forms; jokerRank carries the identity) — regression pinned then fixed, LANDED (commit cb21c24; the fix's non-vacuity was proven by temporary revert). (2) mid-ceremony countdown-dim: no live screenshot was taken this round (the ~4.6s ceremony window closed before capture; cosmetic). Closed the ratchet the durable way instead of chasing a flaky screenshot — the gating logic was extracted to a pure `isCeremonyShowing` predicate (client suite is DOM-free, `environment: 'node'`, so a className swap has no logic to isolate, but the four-condition gate that drives BOTH the ceremony overlay and the dimTimer does) and unit-pinned across all four conditions (hand-1-only, undismissed, ceremony-present, not-past-match-end). UX note carried to M5 polish: seat tabs reset to 座位 1 after hash re-entry (cosmetic); hot-seat leader-clock grace.

**Cross-model audits** (Codex → [docs/audits/M4-codex.md](docs/audits/M4-codex.md); Grok → [docs/audits/M4-grok.md](docs/audits/M4-grok.md); Gemini skipped — same partitioning rationale as M1–M3, the two primary lineages fully covered the split surface):
- **Codex: ZERO majors, 2 minors, both fixed.** (1) The doc's I2 invariant wording ("never increases") contradicted the intended restore-to-base semantics the code and tests correctly implement — doc reworded to the never-above-base bound. (2) Property-test fidelity honestly bounded (pure-layer only; DO SQL/ordering owned by e2e — scope note added to the test header) and the alarm loop now asserts it DRAINS all currently-due rows within MAX_ALARM_APPLIES instead of tolerating exhaustion. Checked-clean: full §2 decision table (hunted for uncovered inputs — none), presence semantics, fire-and-forget SQL-before-await boundary, hello reconcile-before-welcome, takeover no-delta path, alarm termination + class re-arming, timeout: namespace, exactly-once seq-gap proof validity, resync/skew field additions (no redaction leak). Sandbox caveat (weighted, owner §0): Codex ran reasoned-only again — an EPERM blocked test execution in its sandbox — so its ZERO-majors is an **inspection** verdict (it read the code, decision table, and tests and found no major defect by reasoning), NOT an independent green run. The executable guarantee comes from OUR CI (the same suites, green, including today's strict E2E_REQUIRE_WIRE=1 dispatch); Codex corroborates that by inspection rather than re-proving it. Read the two together, not the inspection alone.
- **Grok: 1 medium + 2 low, all fixed.** Medium (the genuine catch): the manual `npm run build && npm run deploy` path shipped a 'dev'-sentinel client bundle with a SHA-versioned Worker — permanently suppressing the skew banner for those clients; the deploy script now captures ONE SHA and feeds both the client build and the Worker var. Low: chooser aria strings said 配牌 while the rest of the product says 逢人配 (aligned); the planning label could sit on a disconnect-grace countdown, promising a budget the clock wasn't giving (label now shown only while connected). Checked-clean: game-agnosticism sweep found ZERO leakage (imports, opaque config/timing, no hardcoded seats, class map opacity), the 108-card 'planning' predicate verified sound across ALL hand-opening paths and rule variants with the obligations pin confirmed independent, guess-number omission verified at every DO call site, version-skew CI path/dev-suppression/dismissal-rekeying/non-destructive guarantees, i18n parity + script correctness + preset-number consistency across all 18 new keys, picker freeze/aria/authority.

**Pre-gate strict e2e (CI, workflow_dispatch):** green — all three rare paths reached wire level under E2E_REQUIRE_WIRE=1 with 3× hunt budgets on the runner.

## Free-tier efficiency research interlude (owner mission §1, 2026-07-14) — PROPOSE, awaiting sign-off

Question-first research pass on a batch of free-tier proposals; deliverable
[docs/research/free-tier-efficiency.md](docs/research/free-tier-efficiency.md).
Research-only — **no efficiency code has landed; the action set awaits owner
sign-off** (§0 M4 close-out changes below did land). Method: framing before
findings (METHODOLOGY practice 5), 5 Cloudflare-docs verifiers (VERIFIED with
source URLs + 2026-07-14 fetch dates), 1 empirical rows/match measurement, and
2 Opus adversarial skeptics — **both the load-bearing Q3 design and the Q2
arithmetic were found wrong on first pass and corrected** (the value of the
adversarial pass). Two of the owner's premises were contradicted by the source
and reported plainly.

- **Q1 (auto-response): ALREADY DONE.** `setWebSocketAutoResponse('ping','pong')`
  is live (game-room.ts:195); VERIFIED it answers without waking the DO / no
  duration; presence is close-event-driven so the no-wake behavior can't touch
  liveness. No action.
- **Q2 (zombie/TTL): NO TTL exists; the real risk is bigger than estimated.** The
  binding meter is **rows-written**, not requests: an abandoned mid-match room
  auto-plays the *entire* remaining match at ~1 wake/60s ≈ **~11.5k rows/day per
  room** for possibly multiple days; **~8–9 concurrent abandoned rooms approach
  the 100k rows/day cap** (corrects the request-axis "dozens" estimate). Rows/
  action corrected to ~8 (missed the `actions_seen` TEXT-PK auto-index; DELETE
  and setAlarm both count). Measured ~9–23k rows/match (degenerate defaultAction
  baseline — real play differs).
- **Q3 (pause on connected==0): right direction, first design BROKEN, corrected.**
  Skeptic found a timer-dodge (HIGH) + a permanent-stall (HIGH) + 2 medium. Fix:
  preserve *remaining* budget as a duration at pause, re-arm *all* actors on
  resume (not the changedSeats path), guard `alarm()` with connected==0 — M4/I2/
  I4-consistent. Load-bearing → property-test + wire e2e + Codex/Grok audit at
  implementation. Strictly better than the pre-rejected purge (preserves room +
  replay).
- **Q4 (rate limiting): cheap easy-yes, low urgency.** Vector confirmed
  (unauthenticated `POST /api/rooms`); zone WAF/rate-limit rules don't apply to
  `*.workers.dev`; the fit is the native Workers `ratelimits` binding (~10 lines,
  $0) + a client retry-loop guard — pending a Free-plan availability smoke test.
- **Q5 (rejections): both UPHELD (verified).** Hibernation discards in-memory
  state after ~10s idle → batching unsafe under 45s clocks; static-asset requests
  are already free/unlimited off the Worker meter → caching saves nothing and
  would reintroduce the skew bug. The one safe row-reduction kept: merge the two
  per-action snapshot UPDATEs (−1 row/action).
- **Recommended sequence:** (1) trivial snapshot-UPDATE merge; (2) Q3 corrected
  design, gated; (3) Q4 binding after a smoke test; no-ops Q1/Q5-batch/Q5-cache;
  defer a SQLite retention sweep to M5+.

### Sign-off + expansion (owner, 2026-07-15) — APPROVED + retention/TTL + cleanup script

All three approved (Q3 pause corrected / Q5-merge / Q4 ratelimits). Owner pulled
retention/TTL forward from M5+ (it is the other half of Q3 — Q3 makes abandoned
rooms *inert but immortal*, so it removes the burn and creates accumulation;
design+gate them together) and added an owner-facing cleanup/inspection script.

**§1 live-burn check — CONFIRMED, and it validates Q2's arithmetic.** The likely
zombie generator is our own dev process, not the family. Direct per-room probe
(GET /api/rooms/CODE, no auth) found THREE M4-drill rooms still auto-playing,
0 connected: **P2FFYD (seq 109→110), YM2C72 (133→134), M74D3N (105→107)** over
81s — the ~1 action/60s disconnect-grace cadence, i.e. ~11.5k rows/day EACH
(~34.5k/day for all three, ~⅓ of the 100k/day cap) and climbing until each match
auto-completes (~1–2 more days at seq ~110). This is the live-data validation the
owner wanted — the model was right. NULL result: the account-wide rows-written
aggregate could not be pulled programmatically (wrangler's OAuth token is
rejected by the GraphQL analytics API, 9106); the per-room probe is the direct
evidence instead. These 3 rooms are to be stopped via the §4 cleanup script once
it lands (burn is slow — ~24 rows/min total — so no hasty destructive purge).

**Q5-merge: LANDED.** applyGameAction now writes seq+state_json in ONE combined
UPDATE (was bumpSeq's seq UPDATE + a separate state UPDATE) — −1 row-write/action
(~12%). Behavior-preserving (609 unit + 25 e2e green; e2e covers seq advancement
+ resync). game-room.ts ~1197.

**Gating research landed (read-only workflow):**
- **Delete-metering (the §3 gotcha) — MIXED, one decision-critical UNCERTAIN.**
  Row-wise DELETE is billed per row (+ index entries), so purging a 10–20k-row
  match row-by-row costs a comparable chunk of the 100k/day cap — the disease is
  real. `ctx.storage.deleteAll()` is the ONLY op that reclaims a DO's storage,
  and is a Storage-API primitive (not a SQL query) so it MIGHT be flat-billed —
  but Cloudflare documents no carve-out, so its cost is genuinely UNKNOWN and
  **must be measured on the live Free account.** DROP TABLE doesn't reclaim
  storage; a DO never self-deletes. **Reframe:** Q3 stops the URGENT compute burn;
  retention only reclaims ALREADY-accumulated STORAGE (abundant 5GB, tiny/room) —
  purging spends the SCARCE meter to save the ABUNDANT one, so if `deleteAll()`
  is per-row, retention should be LAZY/storage-pressure-gated, not eager. The
  design forks on the `deleteAll()` measurement; the conservative (lazy) branch is
  safe either way and is the default until measured.
- **PLAN documentation-drift sweep — 7 findings (the process win the owner asked
  for).** The known one is worse than thought: "A room-TTL alarm also self-purges
  abandoned rooms" appears in **§4, §1.6 AND §8** (a reader hits the false claim
  three times) — and STATUS already recorded the gap under Q2 but PLAN was never
  corrected (exactly the drift-survives-audit failure mode). Five more are
  descriptive text that fell behind a MORE-capable implementation: §4 hibernation
  (claims seat-tagged sockets + `{seat,tokenHash}` attachment → really no tags +
  `{seats: Seat[]}`), §6 dump route (`/api/debug/rooms/:code/dump` + `players` →
  really `/api/rooms/:code/dump` + `seats` + an `actions` array), §5 reconnection
  step 4 ("returns the recorded event" → really sends `resync`, never re-applies),
  §4 deadline recompute (still describes the pre-M4 fresh-clock mechanism = the
  M2 bug the code was redesigned to kill), §5 hello (`token` → `tokens[]`, action
  missing `seat`), §4 schema (`players` w/ connected/last_seen_seq → really
  `seats` w/o them). Everything load-bearing else CHECKED-CLEAN (dump gating,
  redaction, idempotency ledger + reserved namespace, single-writer, advisory
  expectedSeq, version-skew, agnosticism, ping-pong). **Correction plan:** fold
  the TTL-claim fix into the §3 TTL implementation (so PLAN describes the real new
  mechanism, not just "none"); correct the 6 descriptive drifts in the same PLAN
  pass. METHODOLOGY self-correction: a design doc that asserts an unbuilt
  mitigation lets a real gap survive audits — the PLAN sweep is now a standing
  check when a milestone claims a mechanism.
- **DO enumeration — REFUTED for code-driven purge (re-run gave real data; first
  run was junk).** The namespace-objects LIST API
  (`GET .../durable_objects/namespaces/{id}/objects`) exists and returns hex `id`
  + `hasStoredData`, but NOT the name — and `idFromName` is one-way (`ctx.id.name`
  is `undefined` when rebuilt via `idFromString`, the only thing a listed hex ID
  gives you). So enumeration can't recover room codes → it's only a coarse audit
  ("does orphan storage exist my registry doesn't know?"). **§4 script model:**
  explicit room codes (owner-supplied / STATUS-recorded) as primary input,
  re-derived via `idFromName(code)`; the per-room self-purge TTL (§3) needs no
  enumeration; an optional future "list all rooms" capability uses a
  **write-once-at-creation KV registry** (1 KV write/create — the idle 1,000/day
  KV meter, NOT the scarce rows-written meter; `expirationTtl` doubles as registry
  retention). Registry is deferrable — the 3 known zombies + on-demand cleanup
  need only explicit codes.

**Then:** §3 TTL + Q3 designed+gated together (`scheduleAlarm` = min(TTL,
seat-deadlines-when-connected>0, probe); Q3's `alarm()` guard scoped so a TTL wake
still fires; conservative/lazy purge via `deleteAll()`+`deleteAlarm()`, replay
preserved by a retention window) → property test w/ connected-count dimension +
wire e2e + Codex resync/liveness + Grok invariant sweep + live drill → §4 script
(dump-then-delete, token-gated, dry-run default) + PLAN corrections folded in →
Q4 last (after a Free-plan smoke test of the binding). `deleteAll()` billing
measured with owner meter-access to optionally unlock eager purge; the 3 live
zombie rooms stopped once the §4 purge path exists.

### Path A approved + two owner catches folded in (owner, 2026-07-15)

Owner approved **Path A**: implement Q3+TTL now; the `smashegg-analytics` token +
`deleteAll()` measurement are non-blocking (SETUP.md §2.5 always marked token
creation `[HUMAN]` — M0's browser automation was the deviation, not my refusing to
mint credentials via automation). Two of the owner's earlier arguments withdrawn
and recorded: (1) "purge now, 20× cheaper" assumed we'd ever purge — under the
lazy/storage-pressure-gated policy we probably never pay that bill (storage
abundant); (2) the `deleteAll()` measurement was never on the critical path. The
3 zombies are left to burn (~34.5k rows/day, ~⅓ cap, $0) — Q3 freezes them at
~1k rows or they auto-complete first; no detour.

Two real gaps the owner caught (neither the research nor my reframe found them),
now folded into [pause-and-retention.md](docs/research/pause-and-retention.md)
§3.1/§3.2/§5-P4/§7 and the audit brief:
- **Deploy-transition `pause_started_at`-NULL bug.** A room already at
  `connected==0` when Q3 deploys never hit the 1→0 stamp → resume computes a
  NULL offset (garbage shift). The clean-state property tests are structurally
  blind to it. Fix: constructor lazy-stamps `pause_started_at=now` when it wakes a
  playing room with 0 sockets and NULL stamp (before any resume math); + a named
  migration-case test (invariant P4).
- **TTL lazy-branch was self-contradictory.** "TTL reclaims after the window,
  automatically" IS eager reclamation — spending the SCARCE rows-written meter to
  reclaim ABUNDANT storage if `deleteAll()` is per-row. Resolved (§3.1): in the
  default lazy mode, auto-purge **lobby-abandoned only** (a few rows, cheap);
  finished/paused rooms arm NO TTL alarm and are reclaimed **manually via §4** (or
  auto once `RETENTION_MODE='eager'` after the measurement proves `deleteAll()`
  flat). PLAN must describe THIS — the unconditional "self-purges abandoned rooms"
  is exactly the drift that survived four audits.

## Process: model dispatch policy change (owner mission, 2026-07-14)

Opus replaces Fable as the default hard tier from M4 on; Fable is
escalation-only on logged demonstrated need (policy text: PLAN §9; ladder
rule: METHODOLOGY; verified mechanism + sources: docs/research/
model-dispatch.md). Applied as committed repo-level `.claude/settings.json`
(`"model": "opus"` — project settings override the user default; subagents
inherit unless a per-invocation model is stated). **Sanity-checked live**
(owner §5): three probe subagents self-reported Haiku 4.5 (explicit haiku),
Opus 4.8 (explicit opus), and Fable 5 (no param — inherit from this
still-Fable session), confirming both that explicit routing works and why
unannotated calls are banned while a Fable session is live. Honest caveats:
(a) the project `model` setting is read at session start — this running
session stays on Fable; the next session in this repo starts on Opus (the
startup header names the settings file, per docs); (b) the M4 implementation
workflow already in flight was launched pre-policy with inherited-Fable
agents — allowed to finish rather than restarted (M4 is the last scheduled
hard-tier milestone; a restart would cost more than it saves); all
subsequent dispatch follows the new ladder.

## M3 hardening (2026-07-14) — watch-items + wild disambiguation + QA ratchet: GATE REACHED

- **M3 gate approved by owner.** Hardening scope before deep M4: §1 wild-card disambiguation (the general fix behind the play-becomes-pass class — dedicated research + engine enumeration + chooser + property tests + Codex audit), §2 QA ratchet (e2e traverses REAL product paths: UI-default config, feature-visibility defaults, concrete-selection incl. wild chooser, forced anti-tribute + suspension over the wire; standing METHODOLOGY rule: every computer-use find becomes a regression before its fix counts), §3 descending-sort toggle, §4 zh-Hans + device auto-locale (3-way parity), §5 cache revalidation watch-item.
- **§5 verified (headers checked live):** `index.html` already ships `max-age=0, must-revalidate` — HTTP caching is correct; hashed assets revalidate via ETag (safe; `immutable` would be a minor optimization; Workers-assets default). **Real skew vector identified:** long-lived SPA sessions never refetch index.html, so a mid-session deploy strands the RUNNING page — the round-3 false alarm was exactly this (a tab held the pre-fix bundle). Not fixable with headers → **tracked to M4: protocol-level version signal + reload prompt on skew** (reconnection-adjacent by design).
- In flight: research doc (fable) ∥ sort toggle (sonnet) ∥ zh-Hans+auto-locale (sonnet); then §1 implementation from the doc → §2 ratchet e2e → deploy → visual re-check (wild chooser, sort, zh-Hans, auto-locale, phone width) → Codex (§1 algorithm) + Grok (i18n/sort/§2 coverage) audits.

### M3-HARDENING GATE REPORT (2026-07-14) — all criteria green

| Criterion | Evidence | Verdict |
|---|---|---|
| §1 research doc | docs/research/wild-disambiguation.md — 5 formalized sub-rules, 47-row probe-verified enumeration, gap analysis (classifyPlays sound+complete; deltas G1/G2), algorithm ≤76 template validations, oracle'd test plan; post-implementation Corrections (FH-9/SF-8 — the oracle beat manual enumeration) | ✅ |
| §1 implementation + tests | Spec v1.4 (owner mission §1 = the G1 sign-off); G1 in validatePlay (all call sites inherit), G2 compareComboStrength; 54 named rows + 4 properties vs an independent brute-force oracle (2,768 selections, ZERO engine disagreements) | ✅ |
| §1 chooser over the wire | e2e (client's own matchSelection round-trip) AND live on production: {8,8,9,9,配} → chooser 「选择宣告的牌型」 larger-on-top (三带二 9 / 三带二 8) → picked the WEAKER → well shows 阿福・三带二 8 with the wild as the third 8 | ✅ |
| §2 QA ratchet | 5 product-path e2e: UI-literal creation payload + config:null loud contract (stays lobby, asserted); feature defaults (ceremony on); wild path via client matcher; anti-tribute + aMaxAttempts:1 suspension — all three rare paths hit WIRE level every verification run; METHODOLOGY standing rule + title-honesty addendum | ✅ |
| §3 sort toggle | Exact-reverse descending (unit-pinned index stability), persisted client pref, localized ×3; verified live both directions | ✅ |
| §4 zh-Hans + auto-locale | Hand-adapted simplified locale (mainland terminology), 3-way parity, detectLocale (languages + language fallback, zh-MO→Hant), saved-choice precedence; verified live (natural 创建房间/房号 copy; the visual round's switcher self-labeling nit fixed per the ratchet — endonym constants replace per-locale translated language names, glyphs regression-pinned) | ✅ |
| §5 cache watch-item | index.html revalidates correctly; real skew vector = long-lived SPA sessions → M4 version-signal item | ✅ closed |
| Boundaries | Engine pure/locale-free, DO game-agnostic, 3-locale parity; 523 unit + 16 e2e green, 4 typechecks | ✅ |

**Cross-model audit** (Codex: §1 algorithm → [docs/audits/M3H-codex.md](docs/audits/M3H-codex.md); Grok: i18n/sort/§2 coverage → [docs/audits/M3H-grok.md](docs/audits/M3H-grok.md)):
- **Codex: ZERO findings** — suppression both call paths, obligation-4 agreement, ordering incl. variants, oracle independence (verified non-circular), FH-9/SF-8 corrections covered. Caveat recorded: its sandbox blocked test execution (reasoned-only); our CI executes the same suites green.
- **Grok: 2 majors + 4 minors, all fixed.** M1/M2 (the genuine catch): rare-path e2e titles advertised "full wire stack" while the wire phase was optional and proof level console-only — CI could green while proving less. Fixed: honest retitles ("engine-guaranteed, wire-verified when seed-huntable"), machine-readable proof-level record asserted by a dedicated summary test, opt-in E2E_REQUIRE_WIRE=1 strict mode (passed 16/16 on its verification run), METHODOLOGY title-honesty rule. Minors: event feed re-localizes at render time (semantic params — a mid-game language switch no longer mixes locales in history); detectLocale consults navigator.language and maps zh-MO→zh-Hant; fallback-chain comment corrected to what is implemented. Checked-clean: full i18n mapping/parity/terminology sweep (进贡/还贡/抗贡/接风/逢人配 correct, no Taiwan-isms), sort reverse/index-stability/pref isolation, tests 1–2 path honesty.

**Visual re-check log (production, desktop + 390px):** three-locale switcher works with auto-detect; zh-Hans natural throughout; the wild chooser demo took three attempts against the 45s turn clock (the leader's deadline starts at trick-win and my slow multi-seat passing consumed it — the alarm auto-leading each time is itself the timeout system visibly working); succeeded with all-in-one-batch input; descending sort verified; no overflow. UX note for M5 polish: consider pausing/longer grace on the leader clock for hot-seat self-play. The round's other find — locale options translated instead of self-labeled (簡體中文 shown under zh-Hant) — was fixed in-round: endonyms are now constants outside the locale files, with a unit regression pinning the glyphs.

## M3 (2026-07-14) — Guandan into the table UI: GATE REPORT

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Full Guandan match, 4 clients, over the wire | e2e `guandan.e2e.test.ts`: full match (~1–2k actions) to `matchEnded`, room `finished`; multi-run stability across 5 server-minted seeds | ✅ |
| Multi-seat / self-play | e2e: one socket drives all 4 seats to a hand end with per-seat redaction proven; visually driven live (rounds 2–3) | ✅ |
| Tribute / anti-tribute / 接风 / A-attempt / suspension reachable & correct | Tribute + 接风 observed over the wire every run; anti-tribute & suspension reachability is seed-dependent over the wire — owned by named engine tests (house-rules, tribute suites), documented in the e2e header | ✅ (honest split) |
| Lobby rule-picker alters play | e2e: `cardCountVisibility` change → opponents' counts numeric vs hidden | ✅ |
| drawCard ceremony on hand 1, engine-seeded | e2e: ceremony payload public + identical across seats, markerSeat leads; visually verified live (owner counting rule animating: 切牌 → 重翻 → count → 先出) | ✅ |
| Dump→replay reproduces a full Guandan match (config incl.) | e2e: seq-tagged snapshot verification post-matchEnd | ✅ |
| Visual gate (owner-required) | 3 computer-use rounds on production, 8-point checklist PASS (see iteration log below) — caught a start-blocking config bug, frozen ceremony, play-becomes-pass matcher bug | ✅ |
| Boundaries intact | game-room.ts zero game imports (grep+compile); engine purity guard clean; i18n parity green; 431 unit + 10 e2e | ✅ |

**Cross-model audit** (Codex: Guandan↔interface integration + ceremony determinism → [docs/audits/M3-codex.md](docs/audits/M3-codex.md); Grok: turn-direction/seat-offset sweep + picker wiring → [docs/audits/M3-grok.md](docs/audits/M3-grok.md); Gemini skipped — same partitioning rationale):
- **Codex: ZERO findings.** Checked-clean: registration/replay resolution, init/replay PRNG order, owner counting rule exact, re-flip recording, uniformity-by-construction, selection matching (actively hunted counterexamples across all-wild/joker/SF edges — none), hint round-trip, lobby start path.
- **Grok: 1 major + 3 minors, all addressed.** F1 (major): a PARTIAL config (foreign/old client) missing `turnDirection` silently rotated the engine clockwise — nextSeat's ternary + no init validation. Fixed systemically: `validateRuleVariant` now strictly validates all 25 keys at init (missing/out-of-range → `config.invalid: <key>`, unknown keys → `config.unknownKey: <key>` — typos can never no-op), surfacing as `room.startFailed` with the lobby retained; `nextSeat` also flipped to make CCW the structural fallback (defense in depth). Default/UI paths were never affected. F2/F3: labeling/doc fixes (fixedSeat is implemented-but-uncurated, not "guarded"; ceremony JSDoc now says in-turn-direction). F4 (accepted, tracked to polish): a foreign valid-but-non-curated config displays as defaults in the read-only lobby until edited — write path is safe; cosmetic read-path nit.
- Grok's checked-clean sweep: every guandan seat-progression site (trick/tribute/ceremony/jiefeng/levels) coherent under both turnDirection values via the single nextSeat convention; client plate geometry proven consistent with both engine branches without a layout flip; picker happy-path create=display=send; the three real guards UI-unreachable AND init-rejected.

**M3 (2026-07-14, build log) — Guandan into the table UI

- **M2 gate approved by owner.** M3 target bar: playable, clean, clearly usable — not final-pixel polish (that is M5/polish scope). Two gates: functional (e2e) AND visual (computer-use iteration on the deployed URL against a UX checklist — required, logged per pass).
- **Owner feature now fully specified — 翻牌定先 (drawCard ceremony):** engine-side seeded ceremony data in `handStarted` (hand 1 only): cutter (PRNG), counting flips with re-flip on joker/level-rank, **counting rule pinned: rank counts CCW with the cutter as position 1 (A=self, 2=next, 3=partner, 4=remaining; (rank−1) mod 4)**, marker draw = leader; UI animates exactly the event data. Uniformity preserved (statistical test) — flavor, not fairness. This resolves the previously-UNCERTAIN first-lead offset; `turnDirection` stays a config key with CCW default, and a consistency sweep of all seat-progression sites is part of the engine task.
- Build plan: engine (ceremony + guandan registration + CCW sweep) ∥ client infra (partysocket RoomConnection, multi-seat store, routing, lobby shell) → table UI + rule-picker → Guandan e2e → deploy → computer-use visual iteration rounds → Codex/Grok audits (integration+ceremony determinism / CCW sweep+picker wiring).

### Visual iteration log (computer use on the deployed URL — owner-required gate)

**Round 1 (2026-07-14, desktop 1568px):** walked home → create → lobby → claim ×4 (self-play) → start. Findings:
1. **BUG (blocker, caught only by live walkthrough):** room creation sent `config: null` (HomePage comment wrongly assumed init defaults it) → `開始遊戲` rejected with `room.startFailed`. Every e2e run passed because they all send explicit configs — this is precisely the class of gap the owner's visual-iteration requirement exists for.
2. Ceremony would NEVER appear in the product: created rooms used the engine default `firstLeadMethod:'random'` and the picker didn't expose it. Product default for created rooms → `drawCard`; picker gains the 翻牌定先 toggle.
3. App shell (home/room/lobby) completely unstyled — default browser look (blue underlined header link, raw buttons, bullet-list seats, white background) while table/picker carry the design system; jarring clash.
4. Lobby primary action (開始遊戲) was the least visible element (tiny unstyled button below the fold); room code shown as plain heading text instead of the shareable hero it should be for a friends-and-family flow.
5. Claim input stayed active after all 4 seats were filled.
6. Rejection toast showed only the raw error code, no explanatory params.
Positives: rule-picker panel already reads well (rosewood/segmented, natural zh-Hant labels); zh-Hant copy natural; language switch works; multi-claim self-play flow works. Fix batch dispatched (round-1 fixes workflow); table itself not yet reachable — inspected in round 2 after the start bug fix.

**Round 2 (2026-07-14, desktop, after round-1 fixes deployed):** home/lobby transformed and on-system (lacquer shell, hero create, serif room-code chip + copy link, seat plates with claim-form-in-plate and prefilled name, start button with live disabled-reason, 首局先手 toggle present with drawCard product default). Reached the real table. Findings:
1. **Ceremony overlay stuck on 洗牌中… indefinitely** (never advances stages; tap-skip works) — and the first actor's 45s clock drains behind it: 阿蘭's opening turn was consumed by the alarm (the timeout auto-play visibly worked in production, which is its own positive).
2. **小王 card faces render nearly blank** (vertical 王 text invisible; 大王 correct).
3. **2♥ wild ribbon not distinguishable** at hand size.
4. **PLAY-BECOMES-PASS (major, reproduced ×2):** with a legal beating single selected and lifted, clicking the primary action logged a pass — suspected hint-matcher demanding multiset equality against the engine's single wild-frugal representative (4♦ selection vs 4♠ hint) leaving 出牌 dead and 過 catching the click; no pass-with-selection guard.
5. Selection persists after the turn resolves.
Positives: level rail + goldleaf 打2 with 我隊/對方 markers reads immediately; turn ring + countdown unmistakable and moves correctly; seat-tab self-play works with correct per-seat rotation and redacted hands; trick well labels plays (阿蘭・單張 3); event feed localized and clear; pass badges on plates. Round-2 fix batch dispatched with mandated root-cause reporting.

**Round 3 (2026-07-14, desktop + 390px phone width, after round-2 fixes deployed): CHECKLIST PASS.**
- Root causes confirmed fixed live: ceremony animates the full owner sequence (老王 切牌 → grey '2' flip labeled 重翻 → 'J' counted → (11−1) mod 4 = 2 CCW steps → 數到 阿福 → marker leads) in ~5s and unmounts; a selected 4♣ PLAYED as 單張 4 (select→出牌→trick well, selection cleared, turn advanced) — play-becomes-pass dead; 小王 legible; 2♥/4♥ wilds carry the visible cinnabar 配 corner. Note: one "still stuck" false alarm during verification was my browser's cached pre-fix bundle (hard reload resolved; normal users revalidate index.html — not a product defect, logged for honesty).
- Phone width (390×844): level rail collapses to the 我隊/對方/打幾 strip, three plates fit, hand wraps to two clean rows, zero horizontal overflow, CJK wraps correctly.
- Tribute phase inspected live (local room driven to hand-2 tribute by a 147-action bot, seats adopted via localStorage): panel reads without instruction — 老王 進貢給 小美 with the actual 小王 card public, 還貢 pending with the receiver on the clock; the eligible-return glow highlights exactly the levelValue≤10 cards (no 4s at level 4 — the owner's rule made visible); strip shows 打4 with per-viewer team perspective correct.
- Visual/UX exit checklist: hand legible+sorted ✓ · current player unmistakable ✓ · legal hints visible ✓ · tribute understandable without instruction ✓ · ceremony reads clearly ✓ · no phone-width overflow ✓ · CJK rendering ✓ · joker/wild legibility ✓.

## M2 (2026-07-14) — GameRoom DO + session/room plumbing: GATE REACHED

- **M1 gate approved by owner.** The three audit findings resolved: **all stay guarded** (loud init rejection + tests, already in place) — `tributeLevelBasis='previousLevel'` (hair-split, owner never selects it), `levelTrack='shared'`+`demote` (semantics undefined by any source, combination nobody wants), `equalTributeAssignment='winnersChoose'` (Western variant, wrong lineage). The `aceFinishDemotes`×suspension ambiguity stays logged as-is. Documented in spec §10 "Implementation status" with per-decision reasoning; any can be promoted later behind its existing key.
- **New owner requirements folded into PLAN §4/§5/§9:** (A) seat-token authority model — one connection may hold up to all 4 seat tokens (full self-play); redaction keyed strictly on tokens held (the one correctness property that matters under the deliberately relaxed anti-cheat posture); one multiplexed socket chosen over N sockets. (B) lobby phase — per-room `{gameId, config}` opaque to the room layer, editable pre-start with live broadcast, frozen at `Game.init`; chosen default: any seated player edits, any starts once all seats claimed. Guandan's rule-picker UI and the draw-card ceremony are tracked M3 items.
- Build order: guess-number engine + registry (agent) → protocol + GameRoom DO rewrite (orchestrator, hard tier) → e2e harness / dump→replay generalization / live gates → Codex (resync) + Grok (seat-token redaction) audits.

### M2 GATE REPORT (2026-07-14) — all criteria green

| Gate criterion | Evidence | Verdict |
|---|---|---|
| 4 simulated clients complete a game via `wrangler dev` | e2e "4 clients complete a guess-number game" | ✅ |
| Multi-seat + solo (owner req. A) | e2e: one socket drives 2 seats; 4-seat solo playthrough with 4 redacted copies per seq on one socket | ✅ |
| Lobby cycle (owner req. B) | e2e: edit → live `configChanged` → invalid-config `room.startFailed` (stays lobby) → start → post-start freeze | ✅ |
| DO game-agnostic | `game-room.ts` imports only protocol/games-registry/engine-core/room-helpers/Env/`cloudflare:workers`; grep + compile proven | ✅ |
| Kill/restart mid-game → resume | e2e: process kill, same persist dir, reconnect → delta events bit-identical to live copies, view deep-equal, game finished | ✅ |
| Dump→replay roundtrip (config incl.) | room records seed + per-action rows; `dump-room.ts --replay` live verdict `ok:true` (19 actions, snapshotSeq 23), duplicate-actionId proven not double-recorded | ✅ |
| **G-ALARM (hibernated)** | Production: seq advanced 4→7 with zero sockets connected (3 alarm-applied default actions), clean 3-event delta on reconnect | ✅ PASS |
| **G-WSMETER** | Production dashboard: DO requests **57** vs 44 counted client WS messages + ~13 HTTP/upgrade/alarm invocations → **≈1:1 accounting confirmed** (PLAN §1.6's conservative assumption holds; 0.343 GB-s duration, 376/83 SQL rows, $0.00 billable) | ✅ PASS |

**Cross-model audit** (Codex: resync skeleton → [docs/audits/M2-codex.md](docs/audits/M2-codex.md); Grok: seat-token authority/redaction → [docs/audits/M2-grok.md](docs/audits/M2-grok.md); both anchoring-free; Gemini skipped again — same partitioning rationale, recorded):
- **Codex, 1 major (fixed):** client-forgeable `timeout:seat:seq` actionIds could poison `actions_seen` and swallow a genuine future timeout (stall). Fix: `timeout:` is now a reserved namespace, rejected with `action.reservedActionId` + e2e test. Checked-clean: resync gap math (incl. lobby-seq offsets), view/event consistency, idempotency, attachment rehydration, single-writer atomicity (no interleaving awaits), zero-socket alarms. Could-not-verify: platform-level mid-broadcast eviction granularity (mitigated by design: SQLite persists before fan-out).
- **Grok, 0 blockers/majors — redaction model sound.** 3 minors, all addressed: (F1, fixed) hello dropping seats now broadcasts disconnected-presence + recomputes deadlines (was a soft-disconnect timer dodge); (F2, fixed) dump-token compare now constant-time-ish (`timingSafeEqualStr`); (F3, fixed) PLAN §5 stale-socket wording aligned to the implemented soft takeover. Checked-clean: every egress path per-seat redacted (fan-out, resync, welcome/RoomInfo, seatClaimed token privacy, dump hashes-only, logs), token lifecycle (256-bit mint, SHA-256 at rest, replay-after-takeover = delivery move per PLAN §4), action authority on all three paths, dump gate (no bypass incl. empty-token/env-unset).

**Notes for later milestones:** deadline recompute on presence change restarts phase timers (M4 refinement); replay's direct guandan fallback becomes dead code when M3 registers guandan; e2e restart test degrades to prefix-consistency assertions if a CI restart exceeds the 15s turn timeout (documented in-test); Codex's platform-eviction question stays open as a design-mitigated unknown.

## M1 (2026-07-14) — pure Guandan engine + replay harness: GATE REPORT

Build shape: foundations (PRNG/cards/config/types) by the orchestrator; five modules (combos+wilds → generate; tribute, levels, trick) by a staged fable/sonnet workflow against frozen foundations; `GameDefinition` glue by the orchestrator; four gate suites by a parallel workflow. **296 tests green, 4 typecheck configs clean (engine purity guard included), engine line coverage 97.94% (gate ≥90%).**

### Exit gate — the three owner-review items

| # | Gate criterion | Evidence | Verdict |
|---|---|---|---|
| 1 | Property tests for all six PLAN §3 obligations | `tests/unit/engine/obligations.property.test.ts` — 19 tests over the default profile + 14 single-key config variants (~31 seeded playouts); failures emit replayable `{seed, config, actions}` artifacts (verified end-to-end by fault injection) | ✅ pass |
| 2 | Every spec §9 edge case a named test; coverage ≥90%; purity guard | `tests/unit/engine/spec-edge-cases.test.ts` — §9.1…§9.22 map 1:1 to tests named "§9.N …"; coverage 97.94% lines; `tsconfig.engine.json` compiles with zero platform types | ✅ pass |
| 3 | Replay reconstructs a scripted match bit-for-bit | `scripts/replay.ts` (engine-pure core) + `replay-cli.ts`; `tests/unit/replay.test.ts` proves every-seq snapshot equality across ≥3 full hands (default + variant config), tamper detection at the exact seq, harness self-determinism | ✅ pass |

Obligation → test mapping: (1) determinism, (2) serializability, (3) zero-trust views incl. no-PRNG-leak + redaction under every visibility config, (4) legalActions⇔applyAction (canonical-form for plays, exact for choice phases — plus generate.test.ts's brute-force completeness property), (5) liveness incl. defaultAction-applies-ok in every phase, (6) locale-free error/event grammar — all in `obligations.property.test.ts`, cross-covered by `integration.test.ts` (seeded bot playouts to natural matchEnd, bit-identical same-seed replays).

Owner house rules: `tests/unit/engine/house-rules.test.ts` — 14 named engine-driven tests: 1-2/1-3 win at A, 1-4 does not; K+3 clamps to A; the full suspension lifecycle (exhaust → opponents' level with `suspensionApplied` → win clears flag → fresh counter → A window reopens); return-tribute `levelValue ≤ 10` at level T incl. fallback; mixed SJ+BJ never a pair anywhere (validator + 120-combination generator sweep); 接风 both branches.

### Cross-model audit (panel: Codex + Grok primary; Gemini fallback)

Surface split per plan — **Codex** (deep: wilds validator/generator + tribute machine; spot: levels/beats) → [docs/audits/M1-codex.md](docs/audits/M1-codex.md); **Grok** (deep: levels/A-attempt/level-selection + bomb hierarchy + comparison + hand-boundary glue; spot: tribute leader/equal-assign, generate feasibility) → [docs/audits/M1-grok.md](docs/audits/M1-grok.md). Both anchoring-free (spec + code only, no conclusions shared). Mutual spot-check areas: both clean. **Gemini: skipped** — the surface partitioned cleanly into per-subsystem reads within Codex/Grok context windows; no single-pass whole-repo need (per-milestone decision, recorded here).

Findings (all in NON-default config space; zero blockers; default/CORE paths clean in both reports):
1. **`tributeLevelBasis:'previousLevel'` was dead config (silently ignored)** — found INDEPENDENTLY by both lineages (convergence; our own 15-config test matrix missed this key, which is exactly the panel's value). Mitigated: loud `config.notImplemented` at init + test. **Owner decision pending:** implement pre-M3 vs leave guarded.
2. **`levelTrack:'shared'` + `aFailConsequence:'demote'` desyncs the shared ladder** (Grok; per-team demotion breaks the shared invariant and a later shared upgrade drags the other team down). Spec leaves shared-ladder demotion undefined. Mitigated: loud init rejection of the combination + test. **Owner decision pending:** define semantics vs leave guarded.
3. `equalTributeAssignment:'winnersChoose'` unusable — known, deliberate, init-rejected (needs a decision action). **Owner decision pending:** implement pre-M3 vs leave guarded.

Spec ambiguity logged (Grok, not scored a defect): `aceFinishDemotes` × `suspendPlayOpponentLevel` on the same hand — spec silent; engine applies the ace demote after suspension and can wipe the flag; both keys non-default.

### Honest uncertainties (from suite authors, verbatim substance)
- `antiTributeDecision` phase is exercised via documented constructed states (bounded playouts can't guarantee both big jokers land on payers); §9.19's "leftovers never consulted" proven indirectly (fresh-27-card assertion after a real hand transition); §9.4's invariant-holds is probabilistic (4 seeded playouts, no throw, jiefeng exercised).
- Long-horizon A-machinery under `demote`/`none` exercised only as far as ≤8-hand playouts climb (house-rules tests cover the A scenarios via constructed states instead).

### M1 deltas worth noting
- `@cloudflare/workers-types` v5 + `@types/node` + `@vitest/coverage-v8` added; `tsconfig.scripts.json` is the 4th typecheck config (replay CLI split from the engine-pure core so node types never leak into client/engine checks).

## Round 3 (2026-07-13) — owner sign-off + rule-default decisions → M0 started

- **Owner signed off PLAN.md rev 2** subject to rule-default decisions, all now applied (spec v1.3):
  - Confirmed: `aWinPartnerNotLast=true`, `overshootWinsGame=false`, `returnTributeMaxRank=10`, `fullHouseJokerPair=true` (mixed SJ+BJ never a pair — CORE reaffirmed; spec §2.2/§4.1 already enforce it, M1 tests will assert it), `jiefengRecipient=partner` with the exact §5.6 condition (already specified verbatim — no change needed, confirmed).
  - **Changed:** A-attempt failure → `aFailConsequence: suspendPlayOpponentLevel|demote|none`, owner default `suspendPlayOpponentLevel` — never demote; per-team `aAttemptsExhausted` flag; hands play at opponents' level while set (a §1.5 level-selection refinement); flag clears on the team's next hand win, so A resumes automatically. Sub-decision taken per owner intent: attempt counter restarts **fresh** on resumption (`aAttemptCounterReset`, default `fresh`, sub-config kept cheap). Table now 25 keys.
  - Light research on whether "suspend + play opponents' level" is a documented named variant: launched (results logged here when in).
- **Build order confirmed:** M0 → M1 → M2 → M3 → M4 → M5; G-COMPOSE + G-ALARM retired first at hello-world cost. `aFailConsequence` module tracked pre-M3 (M1 engine work).
- **M0 scaffold built and locally verified** (4 scaffold agents + orchestrator verification pass):
  - Green: all 3 typechecks (engine purity guard / server strict + workers-types v5 / client), 5/5 unit tests (i18n key parity, default zh-Hant, interpolation), vite build, and a full `wrangler dev` smoke: `/api/health` JSON; static SPA served with `lang="zh-Hant"`; DO SQLite counter; **alarm armed and fired at +15.003s (G-ALARM local sanity — real gate is the free-tier deploy)**; hibernation-API WebSocket echo (raw-socket handshake + frame test); invalid room codes and unknown `/api/*` paths → JSON 404.
  - Fixes found by verification (all applied): `@cloudflare/workers-types` pin didn't exist on the registry and wrangler 4.110 requires the v5 major (→ `^5.20260708.1`); `GameRoom` wasn't re-exported from the Worker entrypoint (wrangler refuses to boot); demo room code `HELLO2A` was 7 chars against a 6-char route regex (orchestrator's own prompt bug → `TABLE2`); unknown `/api/*` fell through to the SPA fallback and answered API calls with HTML (→ explicit 404 guard).
  - **aFailConsequence research (light) — clean null result:** the exact suspend/never-demote/resume-on-win combination is not documented anywhere as a named variant; closest analogues are 联众's "继续打A不会降级" room toggle and pagat's David Wu demote-to-opponents'-level. Tagged house VARIANT, owner-specified. → docs/research/afail-consequence-research.md; spec §6.4 notes it.
  - **Ops constraint (owner, 2026-07-13): Firecrawl disabled** (credit limit reached) — all research agents now use built-in WebSearch/WebFetch + curl + `gh`; recorded in METHODOLOGY.md's tool ladder.
  - **Live gates PASSED (2026-07-13, free tier):** first deploy succeeded — `https://smashegg.mikechwu-iams.workers.dev`. **G-COMPOSE ✅**: one deploy serves the zh-Hant SPA + Worker API + Durable Object (SQLite counter persisted). **G-ALARM ✅**: DO alarm armed at epoch-ms 1783991776736 and fired at 1783991791736 — exactly +15.000s — on the deployed free plan. API hardening verified live (unknown `/api/*` → JSON 404). Note: a freshly registered workers.dev subdomain returned Cloudflare `error 1042` for the first ~1 minute — plain propagation delay, recovered on retry; logged so nobody debugs it as a code bug later.
  - **GitHub live (2026-07-14):** repo `mikechwu/smashegg` (public, owner-created), both commits pushed. **CI workflow: green** on GitHub runners (typecheck ×3, unit tests, build, dist assertions). `CLOUDFLARE_ACCOUNT_ID` secret and `WORKER_URL` variable set via `gh`. **Deploy workflow: red, expected** — fails precisely at wrangler auth because `CLOUDFLARE_API_TOKEN` is not yet set (verified in the run log; nothing else is wrong).
  - **M0 CLOSED (2026-07-14).** CI API token `smashegg-ci` created in the dashboard via browser automation (Workers-edit template; Account Resources = the single account; Zone Resources = all zones of that account; a distinct name so the pre-existing similarly-templated token used elsewhere stays untouched). Token verified active against `/user/tokens/verify`, stored only as the `CLOUDFLARE_API_TOKEN` GitHub secret, then the Deploy workflow re-ran **green** (run 29298708261: typecheck → tests → build → dist assertions → `wrangler deploy` → post-deploy smoke against WORKER_URL). M0 exit gate fully satisfied: push-to-main auto-deploys the localized hello page; PLAN/STATUS/SETUP in repo; CI green; **G-COMPOSE ✅ G-ALARM ✅** on the deployed free tier.

### Next: M1 — pure Guandan rules engine + deterministic replay harness
Per PLAN §9: combination detection/comparison, the 逢人配 template-matching validator (spec §4.4), legal-move generation, tribute state machine, level/A-attempt logic incl. `aFailConsequence=suspendPlayOpponentLevel`, 25-key RuleVariant config, property tests for the six interface obligations, spec-§9 edge cases as named tests, `scripts/replay.ts`. Cross-model audit (Codex + Gemini) at the gate.

## Round 2 (2026-07-13) — owner feedback incorporated

**Cross-model usage this round** (per PLAN §9 panel policy): web-research fan-out + synthesis by Claude-family agents (2 researchers: research-methodology extraction, Guandan tribute verification); **Codex CLI** ran the anchoring-free consistency review of the revised tribute/anti-tribute spec sections (load-bearing rules change → independent lineage required). **Codex result: 0 rule errors, 13 areas checked-clean (coverage documented), 4 blocking ambiguities found and fixed** — `seatOrder` direction now bound to `turnDirection` (not absolute clockwise); double-tribute payment staging + atomic reveal defined (was only defined for returns); `returnNoLowCardPolicy: anyCard` semantics scoped; `antiTributeMode: optional` state machine specified (decide-before-reveal, unanimity for split jokers, decline reveals nothing, default-action = invoke). Gemini/Grok not run this round — no large-context or third-lineage-corroboration task met the budget bar; both verified installed for milestone gates.

### Done (verified)
- **Rules corrections (owner + official-source verification).** Located the official 《竞技掼蛋竞赛规则（试行）》 tribute clause verbatim (two agreeing copies); full per-question verification: [docs/research/guandan-tribute-verification.md](docs/research/guandan-tribute-verification.md). Spec bumped to v1.2:
  - Tribute/return are **choices over eligible sets** (rank forced, card chosen); `legalActions` exposes the sets for UI hinting; `applyAction` validates membership.
  - Tribute and return cards **public to all four players** (owner-pinned; official + pagat concordant); double-tribute returns revealed simultaneously → engine applies both `tributeReturned` events atomically.
  - Anti-tribute: condition verified verbatim; **mandatory public reveal** of the qualifying big jokers with holder attribution, nothing else; `antiTributeMode: auto|optional` (default `auto`).
  - `equalTributeAssignment: seatOrder|random|winnersChoose` replaces `doubleTributeTieAward` (three-way source conflict: official/唐人游/pagat); `doubleTributeTieLead` **removed** (lead rule unanimous & derivable); `returnNoLowCardPolicy` fallback now CORE-backed by official text. Table now 23 keys, each tagged house-rules-sensitive (✓) or technical (—).
- **PLAN.md rev 2:** new §6 Debuggability (deterministic replay harness, gated room-dump affordance, structured per-mutation logs — required deliverables in the M1/M2 gates); per-seat `hints` in the wire protocol; obligations delta stated (ob. 4 split combination/choice scope, ob. 3 gains reveal-scope assertions); named gate checks **G-COMPOSE / G-ALARM / G-WSMETER** promoted from the risk register into M0/M2 exit gates; audit panel = Codex + Gemini + optional Grok (all three CLIs verified installed).
- **Research methodology adopted from an internal reference research project** → [docs/research/METHODOLOGY.md](docs/research/METHODOLOGY.md) (full extraction with file-level provenance kept in local notes, not pushed). Adopted: research-over-memory with fetch dates; ≥2-source corroboration with low-trust-source discarding; per-claim VERIFIED/UNCERTAIN tags; null results headlined with diagnosis; question-first research prompts; anchoring-free cross-checks; "checked, no finding" coverage lists; named pre-declared gates; dated supersession markers; self-correction logging. Not adopted (domain-specific): backtesting conventions, walk-forward/purged CV, DSR/PBO, market-data hygiene, conformal gating, trading metrics, cost modeling.

### Null results / dead ends (this round)
- **No decline flow for 抗贡 exists anywhere.** Targeted searches (放弃抗贡 / 可以不抗贡 / 选择进贡) found nothing across official rules, platforms, and explainers; the option is also strategically dominated. Diagnosis: genuinely unspecified because unwanted — `antiTributeMode:'optional'` is retained as future-proofing only.
- **The official clause text does not spell out the anti-tribute reveal step** — platform practice and physical necessity make it standard; tagged UNCERTAIN (narrow sense) in spec §7.6 while the reveal remains required behavior here.
- **Equal-tribute assignment is a genuine three-way source conflict** (official seat-order / 唐人游 random / pagat winners-choose) — documented as such and made a config key rather than resolved.
- (Carried from round 1) No Cloudflare-endorsed "event log + seq resync" recipe; no documented per-DO WS-connection or session-duration caps beyond the 32,768 ceiling.

### Corrections log
- Round-1 self-corrections (from the 3-reviewer adversarial pass, 24 findings — 2 blockers among them: no randomness path for mid-match deals; tribute computed from leftover cards in three spec locations): all fixed; details in the 2026-07-13 round-1 entry below.
- Round-2: `doubleTributeTieAward/-TieLead` design superseded by verified sources (see above) — logged here rather than silently rewritten.

### Assumed (explicitly, not verified)
- Wrangler v4 still the current major (docs confirm v4 line active; npm blocked) — re-verified at M0.
- DO request accounting for inbound WS messages — named gate **G-WSMETER** (M2).
- DO Alarms free-plan availability (inferred from pricing structure) — named gate **G-ALARM** (M0, re-checked hibernated M2).
- Assets+DO-in-one-Worker composition (two documented config blocks, no single worked example) — named gate **G-COMPOSE** (M0).

### Next
1. **[BLOCKED on user]** Sign-off on PLAN.md rev 2 (checklist in PLAN §11). Owner said they'll personally review the RuleVariant table: docs/rules/guandan.md §10 — 23 keys, house-rules-sensitive ones tagged ✓.
2. Then M0 (needs SETUP.md human steps 2.1–2.5).

## Round 1 (2026-07-13) — initial research & plan

- Research fan-out (4 parallel agents): Cloudflare facts, reconnection patterns, reference-implementation audit (local notes), Guandan spec — findings in docs/research/ + docs/rules/ with per-item VERIFIED/UNCERTAIN tags.
- PLAN.md v1 drafted; then a 3-reviewer adversarial pass (interface adequacy / rules consistency / infra-fact consistency) returned 24 findings, all triaged and fixed — including 2 blockers: (a) the interface had no randomness path for dealing hand N+1 of an unbounded match (fixed: serializable PRNG state inside S + no-actorless-phases rule); (b) the rules spec computed tribute from the previous hand's leftover cards (fixed: newly dealt hand). Majors: advisory `expectedSeq` (double-tribute concurrency), `viewEvent(config)`, canonical-form obligation 4, generation-range/joker-guard/joker-bomb fixes, §3.8 wild policy, demotion timing, fabricated "20:1" figure removed, alarms uncertainty surfaced, token-template name de-asserted.

## Milestone tracker
| Milestone | State |
|---|---|
| Research & PLAN | ✅ rev 2 drafted, awaiting sign-off |
| M0 skeleton + CI/CD (G-COMPOSE, G-ALARM) | ✅ closed 2026-07-14 |
| M1 rules engine + replay harness | ✅ gate approved 2026-07-14 |
| M2 generic GameRoom DO + dump/replay roundtrip (G-ALARM hibernated, G-WSMETER) | ✅ gate approved 2026-07-14 |
| M3 Guandan plugged in | 🟡 gate reached 2026-07-14, awaiting owner review |
| M4 reconnection | ⏸ not started |
| M5 live MVP | ⏸ not started |
