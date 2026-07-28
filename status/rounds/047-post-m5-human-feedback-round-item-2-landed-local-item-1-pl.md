> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Post-M5 human-feedback round (2026-07-21) — item 2 LANDED local; item 1 plan AWAITING SIGN-OFF

First real-human playtest feedback, two items, both presentation-only (polish gate).

**Item 2 — tribute panel cards at hand size: DONE, committed locally.** The panel's
three reveal sites (paid/returned pairings, anti-tribute jokers, own staged card) moved
from the dormant 'trick' size to size="hand"; 'trick' joins 'mini' as a dormant token
(CSS comment updated). `.gd-tribute__own` gains flex-wrap (pairings already wrapped).
Ratchet: tests/unit/client/tribute-faces.test.ts — TributePanel hand-only, a
directory-swept "no trick/mini anywhere" pin (Codex LOW fix: enumerated, not
hand-listed), wrap + max-width structure; all pins failed pre-fix. Live-verified
zh-Hant (stated): first-hint bot drove a real room to the hand-2 return-tribute
reveal; tribute card == fan card at TRUE 390px (50.7px) and desktop (68px), zero
overflow. Honest find: the sparse joker face is the lacquer theme's designed
corner-emblem-only look (DOM-probed identical on a fan joker) — pre-existing, not
this change. Codex audit (isolated clone): no HIGH/MED, 2 LOW (both fixed —
self-maintaining sweep pin + three stale mini-era comments). Gate 935/935 (39
files) + typecheck + lint:hooks + build. docs/audits/tribute-panel.md.

**Item 1 — the end-of-hand → next-hand beat: PLAN PROPOSED, no code.** Verified
architecture fact: finishHand commits handEnded + the next hand atomically in one
batch — no server inter-hand phase exists, so the beat is client-side framing over a
committed result (the owner's preferred answer; timeout surface untouched; next hand's
clocks run during the beat, so it stays ~5s and skippable). Independent design panel
(Codex + Grok, isolated clones, same brief, no cross-visibility) CONVERGED on every
load-bearing choice: staged sub-beats in one overlay plate; final play HELD in the
trick well (never lifted into chrome); one tap skips the WHOLE beat; ~4.9s auto /
6.5s hard cap; the level transition rendered by the HEADLINE badges crossfading
old→new; a conditional A-attempt/suspension insert with the round's hardest copy;
matchEnded gets a shortened hold that dissolves into ResultOverlay (never two
endings); snapshot reconnects never synthesize the beat. Web research corroborates
(verdict-first, sequential-reveal-as-pedagogy, tap-to-skip as hard convention, and
the genre's two-tier settlement: light per-hand vs heavy per-match). Full plan +
provenance + implementation shape: docs/research/hand-interlude.md. Build starts
only on owner sign-off.
