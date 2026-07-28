> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Design-refinement round (2026-07-15) — PROPOSAL out; items 1-2 decided+justified, 3/4/5 forks with owner

Owner brief: 5 items — (1) nickname edit + leave/change seat [FULL gate: AUTHORITY —
release MUST invalidate the seat token, row-level hash delete + delivery-map purge +
stale-token starvation e2e]; (2) per-seat planning window [FULL: TIMING — actedThisHand
per-seat flag replaces the fragile global held===108 predicate; timingClass(state, seat);
tribute CONSUMES the window (owner lean adopted + justified); untimed stays moot];
(3) REAL cut in the draw ceremony (flip-to-lead) [FULL: ENGINE — cutDeck action, the committed deck in S
(ceremonyCut.deck, redacted like PRNG), flips AND deal derive from the cut, defaultAction middle cut,
uniformity re-proven]; (4) physical deal animation [presentation; proposal said ≤4s, landed
at ≈4.2s landings / ≤5s full choreography inside the 90s planning window; AFTER item 5]; (5) DeckTheme framework [presentation; framework owns the
wild marker/selection/focus overlays so no theme can remove them; conformance ratchet].
Buckets stated per the brief; full proposal:
[design-refinement-preM5.md](docs/research/design-refinement-preM5.md).
Background research (deck depth / deal pacing / cut UX / theme architecture) landed
(journal spot-checked) and drove items 4-5's numbers.

**BUILD COMPLETE (owner batch-approved: "simulate as realistic as possible, and practical"):**
- **Item 1 (eb9822a):** release = row-level token invalidation + delivery-map purge; the
  stale token is granted NOTHING at hello, seat.notHeld on action, ZERO event/resync copies
  across a started game (4-test wire e2e); choose-your-seat via claimSeat.seat + seat.taken
  race code; rename anytime; lobby UI (leave/rename on your seats, every empty seat claimable).
- **Item 2 (48a2195):** per-seat planning window — actedThisHand[4] in S, reset at every deal,
  marked on first APPLIED action (tribute consumes, owner pick); timingClass(state, seat);
  nextDeadlines takes a per-seat resolver (co-actors can arm DIFFERENT fresh clocks);
  obligations pin per-seat vs an independent tracker across the config grid; the owner
  scenario pinned on the wire (follower's first row = planning/45s under fast, leader's
  second = turn/20s); legacy persisted states read as not-yet-acted (named migration test).
- **Item 3 (9dfebd5):** the REAL cut — the shuffled deck committed in S (ceremonyCut.deck, redacted like the PRNG,
  no-card-token grammar pin on every ceremonyCut view), cutDeck 6..102 exact-set choice
  phase, flips AND the deal derive from the rotated deck (marker card REALLY lands at the
  leader; a different position REALLY changes every hand), default middle cut on the
  deadline (AFK cutter named liveness case), class 'turn' + consumes nobody's window,
  BOTH 400-seed uniformity sweeps pass (fixed + varied positions), replay reproduces the
  cut from the log, 29-test ceremony suite vs a deck-arithmetic oracle. SEMANTIC NOTE for
  the record: the old U{0..3} marker draw made the leader uniform even CONDITIONAL on the
  cutter; the real mechanics follow physical rank arithmetic (absolute uniformity holds via
  the PRNG-uniform cutter — the real table's distribution, deliberately).
- **Item 5 (f674289):** DeckTheme contract — themes provide ONLY Face/Back/metrics; the
  framework (CardFace.tsx) draws every game-state indicator OVER the theme (wild marker et al — no
  code path to remove them); F11 mini-fan reads theme back tokens; conformance ratchet runs
  per registered theme (incl. renderToStaticMarkup of every card at every size).
- **Item 4 (37ceca7 + 792a446):** the physical deal — 36ms stagger / 320ms flight round-robin
  (≈4.2s landings ≤4.5s + full choreography ≤5s, both PINNED; the 90s window absorbs it),
  pre-reserved sorted slots — SUPERSEDED by the cut & deal refinement round below, which
  corrects the false "true arrival order unknowable BY REDACTION" justification (the order was
  always in handStarted.hands) and animates true arrival order + one sort beat instead —
  WAAPI + tap-anywhere .finish() (purely local), reduced-motion instant,
  4-tier shadow-slab deck depletion, marker fly-in to the leader. Visual pass: full
  cut→ceremony(real flips incl. joker re-flip)→deal sequence verified at desktop; cut UI +
  settled layouts verified at TRUE 390 (iframe recipe); ONE 390 find — the lobby ring's
  north/south cells inherited the narrow centre column and crushed — fixed (full-row spans)
  and re-verified live.

718 unit + 40 e2e + 4 typechecks green at build close. PLAN §3/§4/§5 updated (per-seat
timingClass — also closing a pre-existing M4 drift where PLAN never gained timingClass at
all — ceremonyCut/cutDeck/actedThisHand, release/rename protocol + lobby semantics).
**PANEL EXECUTED (both lineages, scratch clones, headless; both ran the full 718-test suite
green independently).** Codex: 2 findings (med: timingClass JSDoc overstated "engine never
sees ms" — actionTimeoutMs exists as a legacy suggestion; low: a theme could z-index over
the wild marker). Grok: 4 (med: same marker occlusion; med: deck redaction pinned only in the
named ceremony tests, not continuously in the property walk; low: STATUS/design-doc numbers
drifted from landed values; low: the ≤4.5s pin silently covered landings only, not the full
4.87s choreography). Both checked-clean lists independently confirmed the redaction hard
line (release starves the stale token at hello/action/delivery), first-leader uniformity
under a player-chosen cut, deck unreachability from every runtime view, engine
time/locale/theme-freedom, DO game-agnosticism, the per-seat decision table, and the deal's
client-only-ness. **All findings fixed (6bc3d61 + this commit):** isolated stacking context
+ z-index CSS pin for the marker (conformance-suite enforced), continuous
'deck'/'ceremonyCut'/card-grammar assertions in every obligation-3 view sample, honest
JSDoc/PLAN wording, superseded-numbers notes, dual budget pins (landings ≤4.5s, full ≤5s).
Fix re-audit (Codex, scratch clone): 3× FIXED, 1× PARTIAL (a residual stale ≤4s claim in
this file — corrected here), no new issues. 720 unit + 40 e2e + 4 typechecks green.

**Last updated:** 2026-07-15
