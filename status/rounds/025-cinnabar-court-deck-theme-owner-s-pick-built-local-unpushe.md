> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Cinnabar Court deck theme (2026-07-16) — owner's pick BUILT — local, unpushed, panel pending

The owner picked a figurative Eastern-minimalist court reimagining (overriding unanimous
point 5 of the redesign research — recorded as a dated owner decision in
docs/research/card-face-redesign.md §2 with both reasons answered: IP by constraint, craft
by an explicit pre-drawing quality bar with abstract fallback). Full design record:
docs/design/deck-themes/cinnabar-court/DESIGN.md; the owner's five reference images live in
its reference/ (direction, not spec — 8.9 MB, docs-only, never bundled).

Decisions: SVG shipped / raster reference-only (pipeline fork resolved, reasons recorded);
name "Cinnabar Court" (id cinnabar-court, 朱砂宮廷/朱砂宫廷; Lacquer Court rejected for
app-identity collision, Goldtrace for naming technique not content); five original pieces
(3 courts x 4 suits by emblem+palette, 2 jokers), not fourteen; ONE adaptive theme,
detail keyed to the size prop; DEFAULT flipped to cinnabar-court (one-line revert:
DEFAULT_DECK_THEME_ID — flagged for owner veto), classic lacquer stays selectable.

CRAFT GATE: PASSED at ship sizes (52/42.9/36px on the table ground + 17.2px fan slivers),
two iterations + one emblem micro-iteration, judged on live renders (DESIGN.md §5 gate
result). Figurative courts ship; no fallback needed.

Build (two workflows, Sonnet implementers + three-lens reviews, one confirmed finding each,
both fixed): framework wild seal is now a language-neutral cinnabar circle-seal INSIDE the
identity column (left 0.07w / top 0.92w / 0.26w — junction triangle dead, CSS-token-pinned,
localized aria unchanged, wildBadge key removed from all three locales); reactive theme
switching (setDeckTheme/subscribeDeckTheme/useDeckTheme via useSyncExternalStore; localStorage
'pref:deckTheme'; in-memory override survives storage failure); header switcher beside the
locale control (client preference, not on the decision surface; three locales); lacquer
jokers wordless (filled star vs hollow lozenge — the vertical-rl letter-stack defect class is
CSS-pinned dead); cinnabar-court theme module wired around the FROZEN art modules (art.tsx +
pips.ts, Fable-drawn per owner dispatch). Conformance additions: no text nodes on joker faces
(every theme), wild-seal geometry pin, joker-emblem geometry pin per theme (right <= 0.40w,
no fixed-px horizontal offsets), mini=index-only ladder pin, pip-count pin against an
INDEPENDENT expected-count table (the self-referential version was caught by mutation
testing in review and fixed). Workflow review findings fixed: lacquer jokerMark box
originally landed at ~0.52-0.56w (occlusion regression) -> absolute 0.06w/0.30w; pip pin
self-reference -> independent table.

VISUAL VERIFICATION (live rooms, in-page adoption; locale stated with width): desktop
1260px [en + zh-Hant] and TRUE 390px iframe [zh-Hant]. Verified: 27 cards two rows zero
overflow at 390; identity column crisp at 17.2px pitch; wild 2H carries the seal in-column
in sliver AND full view (both copies at once in one hand); jokers distinct by emblem
silhouette + colour amount; K/Q/J separate by silhouette (crown+sword / red hood+flower /
flat hat+diagonal); cut ribbon + split halves + deal flights + arrival order + sort beat all
render the new back/faces; theme switch mid-hand is a pure re-render (selection made under
lacquer survived switching to cinnabar-court; F11 mini-fan back tokens swap live both ways).
NOT captured live: the ceremony flip/marker MINI-face frames (beats outpaced the slow-mo
patch, whose setTimeout/animate hooks the choreography partly bypasses) — covered by
component identity (same CardFace size="mini" as conformance + harness); stated honestly.

TWO defects found live, both fixed WITH ratchets before counting: (1) HIGH — useDeckTheme()
placed below GameTable's early returns = Rules-of-Hooks crash, blank table the moment a game
starts (invisible to the DOM-free suite); fixed by hoisting + NEW eslint ratchet
(eslint.config.mjs, react-hooks/rules-of-hooks only, scoped src/client; npm run lint:hooks;
wired into ci.yml + deploy.yml; MUTATION-VERIFIED — re-introducing the bug fails the rule).
(2) MEDIUM — the new header controls overflowed true 390 (page scrollWidth 485), fixed
structurally (flex-wrap on .app-header/.app-controls, max-width 100%) and re-measured
(scrollWidth 390, zero elements past the viewport); layout has no browser-test pin — the
390 eyes-gate checklist now carries the header check.

Image-gen research filed (docs/research/image-generation-options.md, sources + fetch dates
2026-07-16; Codex CLI image_generation VERIFIED reachable at $0 marginal — null option
stands, five owner images suffice).

PANEL (contract compliance, Codex + Grok on scratch clones, identical briefs; Codex clean as
auditor — compliance is a different artifact from the aesthetics it once proposed): verdicts
CLEAN on engine/protocol/DO theme-ignorance, switching isolation, locale/aria handling,
english-only coverage, and both ratchets' wiring. Four findings, ALL FIXED with pins:
(1) MED, found INDEPENDENTLY by both — the stacking pin overclaimed: .gd-card
(position:relative, z-index auto) created no stacking context, so a positioned theme
descendant with a large z-index could paint over the sibling wild seal; fixed with
z-index: 0 on .gd-card (traps the theme subtree) + the pin now requires the DECLARATION with
comments stripped — the first pin version passed on the explanatory comment's prose, caught
by ITS OWN mutation check, then re-verified (delete declaration → fails; restore → 789/789).
(2) LOW (both): the wild-seal pin lacked the joker pins' fixed-px/margin/transform
horizontal ban — parity added. (3) LOW (Grok): the reactive suite never asserted a switch to
a NON-default id — test added (lacquer round-trip with restore). (4) LOW-SUSPECTED (Grok):
single-nav growth could still widen the page at 390 — .app-theme/.app-locale now wrap too.
Codex's clone saw one unrelated property-test timeout under 3-way machine contention
(obligations.property.test.ts, 5s budget); green in Grok's clone and locally x4 — not a
round defect. Final: suite 789/789, 36 files; typecheck clean; lint:hooks clean. Committed
locally; push only on the owner's word.

Owner refinement (2026-07-16): the theme switcher is now a DROP-DOWN (styled native select,
one pill showing the active theme's localized name, goldleaf chevron; native picker on
phones, keyboard/AT free). Verified live: switching through it re-renders mid-hand both
directions and persists; at true 390 [zh-Hant] the header now fits ONE row (scrollWidth 375,
zero overflowing elements). Suite/typecheck/lint green.
