> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Owner live-build feedback round (2026-07-15) — 6 items from the owner's own play session

**Item 1 — RULES CORRECTION (engine, in-house).** Uncountable = jokers + the WILD (the HEART
level card) ONLY; other suits of the level rank COUNT. The previous all-suits rule was drift
from the sourced official text ("jokers or the red-heart 2"); the owner caught it live when a
clubs-2 flip was refused. isCountable now uses isWild. Re-derived consequences, all restated
consistently: 6 uncountables (was 12) => AFK termination bound <=7 alarm cuts (200-seed pin +
the named liveness case updated); the level-2 conditional split becomes 32/22/24/24 over 102
countables => P(even)=56/102~54.9% vs 45.1% — the residue edge SHRINKS to ~9.8pt (was 16.7pt)
— conditional test re-pinned with the new numbers; copy in all three locales now says jokers +
the heart level card.

**Items 2-6 (presentation).** The landing reveal sits centred just below the deck pile (never
over plates/fan); the trick-well lead prompt appears only after the centre is CLEAR (gated
through the whole deal, fades in); the sort toggle hidden through cut/ceremony/deal; countdown
chips (planning window included) wait for the sorted hand, every seat; the ceremony panel shows
ONLY the final two cards in any condition and the cut panel only the LATEST flip (the full flip
history stays public in payload/feed — the redaction pins unchanged). Unused reflip key dropped
x3 locales.

Live-verified (zh-Hant, desktop 907px, TIMED room): exactly 2 ceremony cards; no
toggle/prompt/planning label through cut->ceremony->deal; reveal at x-centre below the deck;
settled state restores all three.

**FOCUSED PANEL EXECUTED (both lineages, clean auditors — in-house build).** Both independently
re-derived the heart-only arithmetic (32/22/24/24 over 102 => 56/102~54.9%) and confirmed the
engine change, the five UI gates, and the scope. Grok caught a HIGH the sandboxed Codex could
not reach: the e2e still pinned "counted flip is never rank 2" (all-suits thinking) — a
legally-counted non-heart 2 failed the suite, which Grok REPRODUCED live (its e2e run: 2
failures). Fixed (e131091): the pin now forbids exactly 2H, engine-guaranteed. Both flagged the
stale 7/12 odds in types.ts + 12-uncountables comments (fixed same commit; prose pin extended
with the stale numbers; historical STATUS entries annotated with SUPERSEDED brackets, never
rewritten). Codex: runtime clean, 768 unit green (e2e sandbox-blocked). Grok: all claims PASS
after fixes, 768 unit + e2e verified. 768 unit + 40 e2e + 4 typechecks green at close.
