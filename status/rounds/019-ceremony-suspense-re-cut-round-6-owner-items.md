> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Ceremony suspense/re-cut round (2026-07-15) — 6 owner items

**PROCESS ENTRY — SUPERSESSION (METHODOLOGY 9/10), dated 2026-07-15.** The previous round's Q4
rule ("the count walks from the cut to the first countable card, skipping jokers/level cards")
is SUPERSEDED by the owner's re-cut rule: an uncountable flip means the cutter CUTS AGAIN in the
same panel, with a fresh clock; the count never walks. A re-cut re-picks the marker too (one
physical act). Recorded in types.ts (ceremony payload doc), the engine comments, and the test
headers — not silently rewritten.

**Item 2 (engine + a sanctioned timing change, built in-house — load-bearing).** cutDeck is now
repeatable while the flip is uncountable: state carries attempts + the PUBLIC flip history
(view.ceremonyFlips — the stated redaction exception now includes attempt flips; everyone at the
table watched them); each failed attempt emits public ceremonyCutFlipped. LIVENESS FINDING FIXED
EN ROUTE: the room's decision table preserved base for a seat that "remained an actor", so an
alarm-fired default cut flipping uncountable left an EXPIRED base → the alarm would refire the
same deterministic middle cut in a tight infinite loop. Two-part fix: (a) nextDeadlines gains
actedSeat — the seat that just ACTED and remains an actor re-arms FRESH (the owner's restart timer;
preserve-base stays scoped to co-actor actions, i.e. the second tribute payer); (b) defaultAction
varies its position with attempts, so the AFK path terminates in ≤13 alarm cuts [SUPERSEDED
2026-07-15 by the heart-only correction: 6 uncountables, bound ≤7] (only 12
uncountables exist in a double deck) — both pinned (decision-table cases; a named hunted-seed
alarm-path re-cut case; a 200-seed AFK termination sweep). Bonus correctness: a cutter who
becomes the LEADER now gets a real planning window instead of inheriting a stale turn clock.
Termination for a LIVE cutter: no hard bound exists (they could keep hitting ~11% flips), but
the cutter cannot TARGET uncountables (the deck is hidden), each attempt is ~89% countable
(expected attempts ≈1.14, geometric tail), and the alarm path bounds the AFK case — argued in
the engine comment, deliberately unbounded for humans. Replay reproduces the whole logged cut
sequence; both uniformity sweeps + the conditional edge re-measured over the LOOP; e2e cut
steps loop.

**Item 1 (suspense — the reveal moves to the marker's LANDING).** The ceremony panel now ends at
the marker's IDENTITY ("this card is tucked back into the deck — whoever draws it leads") and
never names who gets it; when the face-up marker lands mid-deal, the leader's name fades in
(goldleaf) and the until-then-suppressed seat ring lights up. STATED HONESTLY everywhere: this
is UI-LEVEL suspense, not concealment — markerSeat/cutPosition are public in the payload and the
client needs the depth to fly the marker; devtools could peek; a presentation choice for a
family game. No comment claims the leader is hidden.

**Item 3.** MARKER_FLY_MS 500→900. Budgets re-derived honestly: duration = max(backs, marker
landing) — at the deepest legal cut the marker IS the last landing (the drama pointing at the
right card); typical full experience ≤5s, worst legal cut ≤5.5s, both pinned.

**Item 5 (exploitability update + a finding CONTRADICTING the owner's premise).** The ribbon is
24 slivers (not 108 countable edges) ✓, and no number is displayed ✓ — but the mitigation is
PARTIAL: a native range input exposes exact positions through the KEYBOARD (Home/End anchor +
arrow keys step by 1) and through assistive tech (aria-valuenow announces the exact value). So
"the cutter can't reach the exploit through the UI" is NOT fully true today — a keyboard cutter
can target a residue class. Documented at the slider (CutPanel header) per the owner's
don't-police stance; options if he wants it closed: a small per-mount jitter on the slider→
position mapping (~±2, physical-feeling, closes both channels), or accepting it as-is. OWNER
DECISION PENDING — reported, not pre-empted.

**Item 4 (English-only sweep):** in flight (Codex, non-load-bearing per the allocation policy) —
CJK swept from comments/test-names/expect-messages/docs prose; locale files and locale-DATA
assertions exempt (data, not code); direct quotes of official rule text in research docs kept as
citations; a structural CJK lint test pins the rule. Item 6: tiers logged per subtask (item 2
hard→main loop on the owner-set session model; items 1/3 standard→main loop alongside; item 4
standard→Codex).

764 unit + 40 e2e + 4 typechecks green at build close. Visual verify (desktop + TRUE 390, and a
zh-Hant pass — locale now recorded alongside width) + both-lineage panel next.

**Last updated (prior below):** 2026-07-15 (ceremony marker)
