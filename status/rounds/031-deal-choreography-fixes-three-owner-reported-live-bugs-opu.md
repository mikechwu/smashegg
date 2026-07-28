> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deal-choreography fixes (2026-07-16) — three owner-reported live bugs — OPUS round — local, unpushed

Owner reported (with screenshots + a slow-motion find): (1) the full sorted hand visible
behind the hand-1 ceremony overlay — "should be NOTHING before receiving cards"; (2) the
face-up ceremony marker lingering on the table after flying to the leader; (3) the marker
PEEKING out of the deck pile (90% covered) during the deal, before its flight beat. The
owner also invited Opus onto dev — dispatched: Opus implemented, ran the exhaustive behavior
lens, and staffed the fix phase; Sonnet ran the live-repro and honesty lenses (logged per
the ladder).

Fixes (workflow closed with ZERO review findings across all three lenses; peek fix + pin
applied by the orchestrator after the owner's follow-up report):
1. PRE-DEAL GATE: new pure predicate holdPreDealFan (helpers) — the fan renders EMPTY (an
   explicit `hidden` prop, chosen over empty-hand/display:none so the DealOverlay's
   slot-measurement path stays byte-identical) from the moment a fresh deal exists until
   the choreography starts revealing. Opus also caught and closed a ONE-FRAME full-hand
   flash on hands 2+ (the event fold ran in useEffect, so dealNo lagged a paint) by moving
   the fold to useLayoutEffect (isomorphic wrapper keeps SSR/renderToStaticMarkup clean).
   Red-then-green pins: holdPreDealFan truth table + HandFan hidden/dealing markup +
   GameTable cut-beat wiring.
2. MARKER DESPAWN: the marker was never removed after landing — fill:'backwards' snapped it
   to the deck centre with the flying opacity stuck on. markerEl.remove() now runs in the
   land callback AFTER onMarkerLanded (suspense timing unchanged); the skip path (.finish()
   -> onfinish) runs the same callback; the viewer-is-leader path leaves the fan slot as
   the single owner. Pinned structurally (single marker source element); runtime is
   eyes-gated, stated.
3. MARKER PRE-BEAT PEEK (owner slow-motion find): the --flying class (opacity 1) was added
   synchronously at schedule time, so the face-up marker peeked from the pile for its whole
   pre-flight delay. Now timer-scheduled at exactly tick.delayMs via the shared skip-cleared
   timers list (a skipped deal keeps the marker invisible end to end). Pinned: rest-state
   opacity 0 (CSS token) + the class-add is timer-scheduled and appears exactly once
   (source pin, marked brittle-by-design); MUTATION-VERIFIED (synchronous re-add fails it).

Visual verification (locale stated with width): desktop 1466 [zh-Hant], slow-motion x4
(duration + delay both stretched). Observed live in one run: ceremony overlay over a
COMPLETELY EMPTY fan (vs the owner's screenshot of the full dimmed hand); the deck pile
showing only backs at every observed beat (the marker's sole appearance was mid-flight,
which is correct); after landing, a clean table — no stray face-up card — with the leader's
ring lit by the reveal. The fixes are width-independent choreography changes; no 390-specific
surface (stated, not skipped silently).

Suite 828/828; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.
