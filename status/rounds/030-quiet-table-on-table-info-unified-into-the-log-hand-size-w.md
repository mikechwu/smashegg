> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Quiet table (2026-07-16) — on-table info unified into the log; hand-size well; sort below hand — local, unpushed

Owner principle: judge every piece of on-table text by its value to the player — move it to
the bottom log or remove it; the table center shows ONLY cards, at the player's own card
size; the sort toggle moves below the hand.

Built (Sonnet workflow + three-lens review; final 818/818 green, typecheck + lint:hooks
clean):
- TrickWell = cards only, at HAND size (size="hand"; played cards measure exactly equal to
  hand cards — verified 50.7px == 50.7px at true 390). Deleted: the name-combo caption (the
  log's feed.played line is the same info), the waiting/lead prompt (headline turn sentence
  + active plate ring/timer already carry it), and the jiefeng banner — whose FULLER
  sentence ("{leader} leads for {finisher}") now REPLACES the terser feed.jiefeng line in
  all three locales (fold passes both names; semantic-at-fold, localized-at-render kept).
  concealLeader/nameFor/viewerSeat props dropped from the well; the HEADLINE's suspense
  gate is untouched byte-for-byte; dead leadPromptKey + game.trick.* keys removed.
  Well overlap tracks the hand clamp at -0.6; widest legal play = 10-CARD bomb (engine cap;
  the workflow's 8-card comment was corrected) = 4.6w, wrapping gracefully if the bounded
  centre cannot fit it.
- Sort toggle below the hand: HandFan -> .gd-actionsRow (grid 1fr/auto/1fr: ActionBar
  centered, pill right-aligned in its own track — no shared flex line with Pass, no mis-tap
  adjacency) -> bottombar.

Review findings, both fixed with live-browser proof: (1) HIGH — the actions row mis-centered
Play/Pass at 390 whenever the reason line rendered (the auto middle track sized off the
reason text and starved the flanks unevenly; grid measured "0px 316.7px 41.3px"); fixed by
taking the reason line out of flow over a reserved band — post-fix the middle track is a
constant 212px across ALL reason states/locales at 375/390/1024. (2) MED — the implementer's
own well-overlap analysis was wrong (gd-cardframe and gd-card--hand are co-classed on ONE
span, so the added wrapper --gd-cardw was dead code, proven via `initial !important` leaving
margins unchanged); removed, comment corrected. Plus two LOWs cleaned by hand: a leftover
debug harness (already gone) and the 8-vs-10-card-bomb comment (corrected with re-checked
arithmetic).

Visual verification (locale stated with width): desktop 1472 [zh-Hans + zh-Hant] and true
390 iframe [zh-Hant]. Verified live: a played pair renders in the well at exactly hand-card
size with ZERO text; the log's newest-first line carries the play ("阿華 出 對子 3" on top);
empty-center waiting text gone in cut and playing phases; sort pill below the hand,
right-aligned, present/hidden per phase; feed scrollbar engaged at 3+ lines; zero horizontal
overflow at 390 (scrollWidth 375); actions-row flanks measured symmetric.

Suite 818/818; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.
