> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

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
- **P1 F4/F5** — partner invisible (3 identical top plates; our team/opponents only on the level rail).
- **P2** — whose-turn is spectator-phrased on your own seat (F8); the level (rank) not headlined
  (F7); wild the wild (heart level card) never stated unless held (F6); no low-card alert ≤10 escalation (F11, confirmed
  from SeatPlate.tsx — count chip is value-independent); no legal-play cue on a normal turn
  (F9 — owner decision, per-card legality is genuinely ambiguous in Guandan).
- **P3** — lobby 2×2 grid → lobby ring; Guan vs Traditional Guan glyph (confirm).
- **Keep:** rule/timing pickers, ceremony, level STATE (Phase B folded it into the
  headline badges; the LevelRail ladder was retired), wild marker, trick well, CCW order,
  27-card hand legible in 2 rows @true-390 (no overflow), sort toggle, 3-locale integrity,
  opening-hand thinking planning-clock distinction.
- **Not re-driven live (recently verified M3/M4; Phase-B re-verify vs the ring):** wild
  multi-reading chooser, tribute/anti-tribute/jiefeng, match-end overlay, live 1–2-card state.

**Proposal:** the asymmetric ring (you bottom · partner top · opponents flanking a bounded
center) on BOTH lobby and table, + shared information fixes (turn-in-words, level+wild
headline, ≤10 escalation, two team badges, partner-by-position, human error copy). Three
style directions to choose from — **Lacquer Ledger (recommended)** / Ink & Goldleaf /
Table Around You — all on the same ring + fixes. Recommendation: Lacquer Ledger base +
one bold move (a Songti the level (rank) level headline). 5 owner decisions surfaced (style, clock
placement, partner-hand visibility, 4-colour deck, legal-play cue). **No behaviour/engine/
protocol/timing change** proposed — layout & presentation only.

### Phase B APPROVED (owner, 2026-07-15) — Lacquer Ledger ring, F3 first + independent

Owner picks: **Lacquer Ledger** + the one bold move (a Songti the level (rank) headline, spent on the
most under-served fact F7). Clock on the seat plate (escalate on your own seat when short;
untimed keeps no clock; keep the opening-hand thinking planning distinction). Partner/opponent hands
**value-dependent** (2 cards must LOOK different from 27 — solves F11 structurally; take the
idea from card-back arcs, leave the felt). Legal-play cue **binary** (「you have a playable beating hand」 vs
「cannot beat, must pass」, Pass prominent when no) — NOT per-card highlighting (legality is per-combo).
4-colour deck = settings toggle default off, BUT ♥/♦ must be distinguishable at true 390px
in the DEFAULT deck (verify + report). No behaviour/engine/protocol/timing change. Model
dispatch: Opus layout/hierarchy, Sonnet CSS/components once the direction holds.

**Sequencing:** F3 (independent, done) → ring skeleton 390px-first → info fixes
(turn-in-words, the level (rank)+the wild (heart level card) headline, two team badges + partner-by-position, human error
copy, lobby ring) → Songti bold move → visual re-verify incl. the not-re-driven list →
cross-model panel (VISUAL-change brief) → deploy.

**F3 SHIPPED (feat/preM5-ux-ring, first + independent).** The first-thirty-seconds chain
fixed whole: pickers read as disabled-until-seated (Lobby.configEditable pure predicate) with
a "sit before changing rules and timing" hint, so an unseated edit can't fire; a NEW `describeError`
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
- **F7** the level (rank): a large Songti goldleaf level headline (the one bold move).
- **F6** wild: the wild (heart level card) stated ALWAYS (♥{rank} wild chip), not only when held.
- **F8** turn-in-words: your turn / turn: X on your own seat, not spectator-phrased.
- **F5** partner: a Partner tag (ivory, non-colour cue) + partner-across-the-top position.
- **F11** low-card alert: a value-dependent mini card-back fan — 2 cards LOOK unlike 27 (verified 13 vs 3 vs
  2 at true 390) — + numeral escalation at the ≤10 / ≤2 lines (handSizeTier).
- **F9** legal-play: binary cue 「cannot beat, must pass」 with Pass promoted when you can't beat; 「you have a playable beating hand」
  otherwise (beatState).
- Lobby ring: the same partners-across layout (§2).
- Ratchet: beatState + handSizeTier extracted as pure predicates, pinned in ring.test.ts (the
  client suite is DOM-free — the visual gates live as testable decisions).

**Edge states re-verified in the ring** (all render correctly, undisturbed): the wild
multi-reading chooser (opens over the centre, NOT clipped, both readings + substitution chips),
the match-end result overlay, the hand-1 ceremony, the tribute panel, the trick well, low-card
divergence; 3-locale integrity (zh-Hant/zh-Hans/en, no break, endonyms verbatim; wild→Wild,
Partner→Partner, the level (rank)→LEVEL, turn:→'s turn). Suits distinguish by GLYPH SHAPE (♥ vs ♦), not colour
alone. Anti-tribute / jiefeng are seed-dependent center-panel/banner content (TributePanel /
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
→ your turn to play). Lows: the error-ratchet comment overstated + missing room.notFound; dead
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
ladder viz re-addable as an expandable); a real-device iOS/Android matrix; anti-tribute / jiefeng
seed-dependent center-panel states (TributePanel/TrickWell verified — confirm live in M5); the
4-colour-deck default is off (♥/♦ separate by glyph shape). Next: M5 — 4 real people on different
networks, ≥1 mid-game reconnect, live language switch, free tier only (OWNER GATE to start).
