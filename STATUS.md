# STATUS

## Current phase: M4 (reconnection + timeouts + owner items A/B) — in progress

**Last updated:** 2026-07-14

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
