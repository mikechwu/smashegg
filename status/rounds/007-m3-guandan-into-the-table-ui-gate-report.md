> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## M3 (2026-07-14) — Guandan into the table UI: GATE REPORT

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Full Guandan match, 4 clients, over the wire | e2e `guandan.e2e.test.ts`: full match (~1–2k actions) to `matchEnded`, room `finished`; multi-run stability across 5 server-minted seeds | ✅ |
| Multi-seat / self-play | e2e: one socket drives all 4 seats to a hand end with per-seat redaction proven; visually driven live (rounds 2–3) | ✅ |
| Tribute / anti-tribute / jiefeng / A-attempt / suspension reachable & correct | Tribute + jiefeng observed over the wire every run; anti-tribute & suspension reachability is seed-dependent over the wire — owned by named engine tests (house-rules, tribute suites), documented in the e2e header | ✅ (honest split) |
| Lobby rule-picker alters play | e2e: `cardCountVisibility` change → opponents' counts numeric vs hidden | ✅ |
| drawCard ceremony on hand 1, engine-seeded | e2e: ceremony payload public + identical across seats, markerSeat leads; visually verified live (owner counting rule animating: the cut → re-flip → count → lead) | ✅ |
| Dump→replay reproduces a full Guandan match (config incl.) | e2e: seq-tagged snapshot verification post-matchEnd | ✅ |
| Visual gate (owner-required) | 3 computer-use rounds on production, 8-point checklist PASS (see iteration log below) — caught a start-blocking config bug, frozen ceremony, play-becomes-pass matcher bug | ✅ |
| Boundaries intact | game-room.ts zero game imports (grep+compile); engine purity guard clean; i18n parity green; 431 unit + 10 e2e | ✅ |

**Cross-model audit** (Codex: Guandan↔interface integration + ceremony determinism → [docs/audits/M3-codex.md](docs/audits/M3-codex.md); Grok: turn-direction/seat-offset sweep + picker wiring → [docs/audits/M3-grok.md](docs/audits/M3-grok.md); Gemini skipped — same partitioning rationale):
- **Codex: ZERO findings.** Checked-clean: registration/replay resolution, init/replay PRNG order, owner counting rule exact, re-flip recording, uniformity-by-construction, selection matching (actively hunted counterexamples across all-wild/joker/SF edges — none), hint round-trip, lobby start path.
- **Grok: 1 major + 3 minors, all addressed.** F1 (major): a PARTIAL config (foreign/old client) missing `turnDirection` silently rotated the engine clockwise — nextSeat's ternary + no init validation. Fixed systemically: `validateRuleVariant` now strictly validates all 25 keys at init (missing/out-of-range → `config.invalid: <key>`, unknown keys → `config.unknownKey: <key>` — typos can never no-op), surfacing as `room.startFailed` with the lobby retained; `nextSeat` also flipped to make CCW the structural fallback (defense in depth). Default/UI paths were never affected. F2/F3: labeling/doc fixes (fixedSeat is implemented-but-uncurated, not "guarded"; ceremony JSDoc now says in-turn-direction). F4 (accepted, tracked to polish): a foreign valid-but-non-curated config displays as defaults in the read-only lobby until edited — write path is safe; cosmetic read-path nit.
- Grok's checked-clean sweep: every guandan seat-progression site (trick/tribute/ceremony/jiefeng/levels) coherent under both turnDirection values via the single nextSeat convention; client plate geometry proven consistent with both engine branches without a layout flip; picker happy-path create=display=send; the three real guards UI-unreachable AND init-rejected.

**M3 (2026-07-14, build log) — Guandan into the table UI

- **M2 gate approved by owner.** M3 target bar: playable, clean, clearly usable — not final-pixel polish (that is M5/polish scope). Two gates: functional (e2e) AND visual (computer-use iteration on the deployed URL against a UX checklist — required, logged per pass).
- **Owner feature now fully specified — the draw ceremony (flip-to-lead) (drawCard ceremony):** engine-side seeded ceremony data in `handStarted` (hand 1 only): cutter (PRNG), counting flips with re-flip on joker/level-rank, **counting rule pinned: rank counts CCW with the cutter as position 1 (A=self, 2=next, 3=partner, 4=remaining; (rank−1) mod 4)**, marker draw = leader; UI animates exactly the event data. Uniformity preserved (statistical test) — flavor, not fairness. This resolves the previously-UNCERTAIN first-lead offset; `turnDirection` stays a config key with CCW default, and a consistency sweep of all seat-progression sites is part of the engine task.
- Build plan: engine (ceremony + guandan registration + CCW sweep) ∥ client infra (partysocket RoomConnection, multi-seat store, routing, lobby shell) → table UI + rule-picker → Guandan e2e → deploy → computer-use visual iteration rounds → Codex/Grok audits (integration+ceremony determinism / CCW sweep+picker wiring).

### Visual iteration log (computer use on the deployed URL — owner-required gate)

**Round 1 (2026-07-14, desktop 1568px):** walked home → create → lobby → claim ×4 (self-play) → start. Findings:
1. **BUG (blocker, caught only by live walkthrough):** room creation sent `config: null` (HomePage comment wrongly assumed init defaults it) → `Start game` rejected with `room.startFailed`. Every e2e run passed because they all send explicit configs — this is precisely the class of gap the owner's visual-iteration requirement exists for.
2. Ceremony would NEVER appear in the product: created rooms used the engine default `firstLeadMethod:'random'` and the picker didn't expose it. Product default for created rooms → `drawCard`; picker gains the draw ceremony (flip-to-lead) toggle.
3. App shell (home/room/lobby) completely unstyled — default browser look (blue underlined header link, raw buttons, bullet-list seats, white background) while table/picker carry the design system; jarring clash.
4. Lobby primary action (Start game) was the least visible element (tiny unstyled button below the fold); room code shown as plain heading text instead of the shareable hero it should be for a friends-and-family flow.
5. Claim input stayed active after all 4 seats were filled.
6. Rejection toast showed only the raw error code, no explanatory params.
Positives: rule-picker panel already reads well (rosewood/segmented, natural zh-Hant labels); zh-Hant copy natural; language switch works; multi-claim self-play flow works. Fix batch dispatched (round-1 fixes workflow); table itself not yet reachable — inspected in round 2 after the start bug fix.

**Round 2 (2026-07-14, desktop, after round-1 fixes deployed):** home/lobby transformed and on-system (lacquer shell, hero create, serif room-code chip + copy link, seat plates with claim-form-in-plate and prefilled name, start button with live disabled-reason, first-hand leader toggle present with drawCard product default). Reached the real table. Findings:
1. **Ceremony overlay stuck on shuffling… indefinitely** (never advances stages; tap-skip works) — and the first actor's 45s clock drains behind it: A-Lan's opening turn was consumed by the alarm (the timeout auto-play visibly worked in production, which is its own positive).
2. **small joker card faces render nearly blank** (vertical joker text invisible; big joker correct).
3. **2♥ wild ribbon not distinguishable** at hand size.
4. **PLAY-BECOMES-PASS (major, reproduced ×2):** with a legal beating single selected and lifted, clicking the primary action logged a pass — suspected hint-matcher demanding multiset equality against the engine's single wild-frugal representative (4♦ selection vs 4♠ hint) leaving Play dead and Pass catching the click; no pass-with-selection guard.
5. Selection persists after the turn resolves.
Positives: level rail + goldleaf playing 2 with our team/opponents markers reads immediately; turn ring + countdown unmistakable and moves correctly; seat-tab self-play works with correct per-seat rotation and redacted hands; trick well labels plays (A-Lan・single 3); event feed localized and clear; pass badges on plates. Round-2 fix batch dispatched with mandated root-cause reporting.

**Round 3 (2026-07-14, desktop + 390px phone width, after round-2 fixes deployed): CHECKLIST PASS.**
- Root causes confirmed fixed live: ceremony animates the full owner sequence (Lao Wang the cut → grey '2' flip labeled re-flip → 'J' counted → (11−1) mod 4 = 2 CCW steps → count reaches A-Fu → marker leads) in ~5s and unmounts; a selected 4♣ PLAYED as single 4 (select→Play→trick well, selection cleared, turn advanced) — play-becomes-pass dead; small joker legible; 2♥/4♥ wilds carry the visible cinnabar wild corner. Note: one "still stuck" false alarm during verification was my browser's cached pre-fix bundle (hard reload resolved; normal users revalidate index.html — not a product defect, logged for honesty).
- Phone width (390×844): level rail collapses to the our team/opponents/the level (rank) strip, three plates fit, hand wraps to two clean rows, zero horizontal overflow, CJK wraps correctly.
- Tribute phase inspected live (local room driven to hand-2 tribute by a 147-action bot, seats adopted via localStorage): panel reads without instruction — Lao Wang paid tribute to Xiao Mei with the actual small joker card public, return tribute pending with the receiver on the clock; the eligible-return glow highlights exactly the levelValue≤10 cards (no 4s at level 4 — the owner's rule made visible); strip shows playing 4 with per-viewer team perspective correct.
- Visual/UX exit checklist: hand legible+sorted ✓ · current player unmistakable ✓ · legal hints visible ✓ · tribute understandable without instruction ✓ · ceremony reads clearly ✓ · no phone-width overflow ✓ · CJK rendering ✓ · joker/wild legibility ✓.
