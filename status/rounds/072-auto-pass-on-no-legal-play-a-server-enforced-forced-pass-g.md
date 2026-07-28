> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Auto-pass on no-legal-play — a server-enforced forced-pass grace — shipping on the owner's word (2026-07-24)

PLAN OF RECORD for this feature. Owner signed off the three decisions + three
strengthenings; the gate below is complete and the owner gave the deploy word.

GATE RESULT (all green): typecheck (4 tsconfigs) + unit 1109/1109 (47 files) +
lint:hooks + build; the auto-pass e2e 4/4 (auto-pass-fires with the forcedPass
class + ~4s grace; manual-press exactly-once + idempotent resubmit; near-boundary
alarm-first where a late manual pass is REJECTED out-of-turn — the real mechanism;
OFF ≡ today; untimed+ON keeps the ~4s row). New pins: the engine property
passOnly⇔forcedPass⇔defaultAction=pass biconditional + a suite coverage floor
(≥1 pass-only state sampled) + the closed-union widening; the exactly-once ROW-DROP
regression (an applied action drops the acted seat's deadline row — strengthen #1)
with a site comment naming what breaks it; the clampBudgetMs forcedPass exemption
(imported by the liveness MODEL so DL1 agrees — the pin ~4s is real); the NARROW
dead-press swallow structural test (allowlist is exactly {notYourTurn,wrongPhase},
only pass ids enter the pending set); a replay through a forced-pass hand
(bit-for-bit). AUDITS: **Codex** on the deadline/idempotency/liveness surface —
SHIP, 0 confirmed defects across all 7 load-bearing claims (exactly-once three
facts, clamp exemption, engine time-freedom, union widening, back-compat,
OFF/untimed, narrow swallow). **Independent design review** on config
placement/engine-time-freedom (Grok tooling unavailable this session — a fresh
adversarial general-purpose agent stood in, disclosed) — SHIP; room-layer
placement endorsed decisively (engine placement would be doc-vs-code drift AND an
inert key); ONE improvement applied: timeoutMsFor is now an EXHAUSTIVE switch
(default: assertNever) so a future TimingClass can't silently map to perTurnMs.
VISUAL VERIFY (live table, true 390px + desktop + reduced-motion): the forced-pass
composition confirmed — the ambient turn-clock FROZEN (no countdown), the reason
line the loud panel, the pass button carrying the tonal fill-sweep, Play disabled;
the UNTIMED room reads "壓不過,將自動代過" — unmistakably no-play, never "hurry up"
(owner decision-3 caveat verified in an untimed room specifically); reduced-motion
carries the meaning via the reason line + a static fill.

WHAT IT IS: when it is your turn to FOLLOW and you have NO legal play (pass is
your only legal action), the game auto-passes after a short grace (~4s). Within
that window you may press 過 yourself. A room option, default ON.

ARCHITECTURE (verified by a 6-agent research pass, adversarially): the feature is
a TIMING-CLASS REFINEMENT of the existing deadline machinery — NO new action, NO
new apply path, NO new replay surface, engine stays time-free AND flag-free.
  • "pass is the only legal action" is already a pure engine judgement:
    !mustLead && legalPlays(...).length===0 (generate.ts). New pure export
    `isForcedPass(...)` names it; the product calls it, never re-derives.
  • `defaultPlayAction` already returns {type:'pass'} for any follower, and the DO
    already auto-applies `defaultAction` on deadline expiry via the SAME
    applyGameAction path. So auto-pass = that existing default-on-expiry path with
    a SHORTER deadline. No new action type.
  • The engine emits a new TimingClass label 'forcedPass' UNCONDITIONALLY (a
    truthful per-seat state label) for a follower with zero legal plays;
    precedence forcedPass > planning > turn (a first-of-hand forced pass has
    nothing to plan, so it must NOT get the 90s planning window). The ROOM maps
    the label to ms.

DECISIONS (owner):
  1. The on/off flag lives in the ROOM layer (RoomTiming), NOT the engine
     RuleVariant. Auto-pass changes neither legality nor outcome (the pass happens
     either way) — it is pacing, RoomTiming's job. Stronger: RuleVariant's header
     STATES every key there changes legality/outcome; a pacing toggle would make
     that claim false — doc-vs-code drift, the exact failure class this project
     catches. So the engine's timingClass emits 'forcedPass' unconditionally; the
     room's `autoPassNoPlay` boolean decides ON→~4s-auto-fire vs OFF→normal-turn
     budget.
  2. Duration = 4s (not 3s). Read 無牌可出 → grasp it → move to tap can eat 2-3s
     for an elder; missing the window is harmless (pass is the only legal move).
     Single named constant AUTO_PASS_MS, clamp-exempt (see below).
  3. Untimed rooms DO apply auto-pass (a forced pass carries no decision, so it is
     not a fake timer). PRESENTATION CAVEAT (owner): a player who chose 不限時
     expects never to be rushed — the reason line must make it unmistakable at a
     glance that this is "you have nothing to play", not "hurry up". VERIFY THIS
     SPECIFICALLY IN AN UNTIMED ROOM at 390px, not only a timed one.

DIAGNOSES (owner asked to confirm, not assume):
  • The `game-room.ts:1786` class-coercion (and its twin `room-helpers.ts:300`
    toWireDeadlines) is NOT a pre-existing bug. Both are UNION-WHITELIST sites:
    they coerce a persisted timing_class string to the valid TimingClass union,
    mapping unknown→null/omitted. Correct for today's 'turn'|'planning'. This
    feature WIDENS the union, so every closed-over-the-union site must move
    together; these two whitelists are two of them. Extending them is a direct,
    necessary consequence of the widening — part of this feature, documented as a
    union-widening site, not an unexplained ride-along.
    UNION-WIDENING SITES (move together): game.ts TimingClass; index.ts timingClass;
    shared/timing.ts timeoutMsFor + validateRoomTiming + TIMING_PRESETS;
    game-room.ts:1786 rebuild coercion; room-helpers.ts:300 toWireDeadlines;
    the property-test closed-union assertion + timing-class.test.
  • Mid-hand across the deploy: CONFIRMED graceful, not assumed. A deploy never
    re-arms an in-flight deadline row — `recomputeDeadlines` only runs on the next
    applied action (or start), so a seat mid-decision keeps its already-armed
    budget; the new 'forcedPass' shortening only takes effect at the NEXT decision
    point. Legacy rooms (timing_json without autoPassNoPlay) read as ON per the
    back-compat default. So a pass-only state reached AFTER the deploy gets ~4s
    instead of ~45s — a mid-hand timing change, but the outcome is identical (a
    pass), no player loses a decision, and there are no long-running real matches
    (pre-launch). Accepted as a deliberate, benign transition.

THREE STRENGTHENINGS (owner):
  1. PIN THE FACTS, not just the outcome. Exactly-once rests on three structural
     facts, NOT on the actions_seen idempotency table (the manual press and the
     alarm's pass carry DIFFERENT actionIds — client UUID vs 'timeout:seat:seq' —
     and expectedSeq is advisory, never rejected): (i) the DO is single-threaded;
     (ii) an applied action REPLACES the deadline row (nextDeadlines drops
     non-actors; applyNextDeadlines DELETEs+re-INSERTs wholesale, driven from
     applyGameAction after the state advances); (iii) a late manual press is
     re-validated by the engine and rejected as out-of-turn. Fact (ii) is the
     fragile one — a write-ordering change would break exactly-once with NO test
     failing. So: a COMMENT at the recompute-after-apply site naming what breaks
     it, PLUS a named regression test that fails if the acted seat's deadline row
     SURVIVES an applied action. The near-boundary e2e asserts the ACTUAL
     mechanism (loser gets rejected / stale-row dropped), never a phantom seq
     no-op, and asserts exactly ONE passed event at that seat.
  2. The dead-press swallow must be NARROW. Today a race-losing manual pass gets a
     'rejected' → generic error toast (the dead press). Fix: capture the pass's
     actionId; convert a rejection to success ONLY when it is a pass the local
     player just submitted AND the seat is already no longer an expected actor /
     already passed at this seq. Apply the describeError lesson: ENUMERATE the
     rejection reason(s) legitimately convertible to success (the out-of-turn
     class for a just-submitted local pass), and add a STRUCTURAL test proving
     nothing else can be swallowed. A broad "any rejection after a pass → success"
     is a worse failure than the toast.
  3. The 1786/300 coercion is explained above (union-widening site), not folded in
     silently.

CLAMP: AUTO_PASS_MS (4000) is below ACTION_TIMEOUT_MIN_MS (5000). forcedPass is a
non-decision auto-fire grace with a FIXED constant duration (not untrusted
config), so it is deliberately exempt from the [5s,120s] decision-budget clamp in
nextDeadlines. The deadline-liveness property MODEL's clamp() must match the
product's class-aware clamp — that agreement is itself the pin that ~4s is real.

BACK-COMPAT: validateRoomTiming tolerates a MISSING autoPassNoPlay as default true
(ON) rather than throwing — else legacy M4 timing_json rows throw → parseTiming
degrades them to null → a running room silently loses its configured timers. A
justified exception to the strict-no-default idiom, mirroring timing's existing
whole-object-null legacy escape.

UI (owner sign-off, research-refined): the 過 button carries a FILL-toward-commit
sweep (left→right; the instant full = the pass) — a growing fill reads "the system
is finishing this for you", never a draining bomb-timer. TONAL split (a deeper
shade of the button's own colour), NOT a stoplight hue. NO ticking digit. A
4-char reason line 無牌可出 carries the WHAT; the bar carries the WHEN. FREEZE the
ambient turn-clock when the window starts so the sweep is the ONLY thing moving
(resolves the 390px loudness conflict by subtraction). Reduced motion: discrete
stepped segments or a static 將自動代過 caption + aria-live; no continuous motion.
Reuse the existing gd-desk__bar geometry, not a second bar.

GATE: pure-predicate extraction (isForcedPass, product-called); liveness property
extended (no stall at the short deadline + the untimed case + the row-drop pin);
e2e auto-pass-fires / manual-press-exactly-once / near-boundary-exactly-once (real
mechanism) / off-behaves-as-today / untimed; replay through a forced-pass hand;
Codex on deadline/idempotency/liveness + Grok on config placement & engine-time-
freedom; visual verify desktop + true 390px + reduced-motion (incl. the untimed
reason line). Ratchet: exactly-once at the boundary, off-setting, the untimed
decision.
