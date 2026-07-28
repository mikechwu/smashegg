> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Visual refinement — a scale-token SYSTEM + goldleaf/amber split + off-system pickers folded in — BUILT local (2026-07-23); awaiting the owner's deploy word

Art-only refinement round (Lacquer Ledger + Cinnabar Court kept — polish, not a
redesign). Roles per the owner brief: **ChatGPT 5.6 Sol (Codex lineage) = art
director** produced the visual DIRECTION; **Claude = implementer** wrote the
code; **Codex audited the CODE** (clean lineage — it did not write it); **Grok
judged the DESIGN** (Sol/Codex share a lineage, so Codex could NOT be the check
on the direction — disclosed, not a blanket two-lineage pass). Sol's direction
converged with an independent Claude candidate; Grok sanity-checked it before
implementation. Owner ruled **Option A** on the amber question (below), with an
elder-distinguishability + contrast condition, and green-lit the rest.

THE SYSTEM: the palette was already tokenized; type/space/radius/tracking were
raw literals (~22 near-dup font sizes, ~19 gaps, 10 radii, 7 tracking values)
across the two stylesheets. Added ONE scale-token layer at :root (app.css),
inherited by .gd-table (which re-declares palette + fonts for self-containment)
and the pickers' inline <style>: --fs-3xs..6xl (0.625→1.75rem, 10→28px; floor is
10px, never 9.6, for aging eyes), --space-3xs..4xl, --radius-hair..table + pill +
circle, --track-tight..widest, --weight-body/medium/bold. ALIAS-FIRST: every step
anchors on an already-dominant value, so the large majority of the migration
changes ZERO pixels; only the sub-pixel near-dupes snap (the visible refinement).

PIXEL-DELTA SET (everything that actually moved — the rest is pure alias):
- Font-size snaps (all ≤ the next scale step): 0.6/0.62→0.625, 0.68→0.6875,
  0.72→0.75, 0.8→0.8125, 0.85→0.875, 0.9→0.9375, 1.15→1.125, 0.1em→0.12em.
- Two intentional ~1px GROWTHS (owner-approved, elder clarity): primary CTA
  1.0625→1.125rem; team level-rank 1.05→1.125rem.
- Mobile wordmark 1.05→1.0rem (snapped DOWN, not up — preserves the ≤719px
  compression; the desktop wordmark stays --fs-4xl). [Codex-flagged delta.]
- Spacing snaps (all ≤0.8px): gaps 0.2→0.25, 0.3/0.3125/0.35/0.4→0.375, 0.6→0.625;
  paddings 0.15→0.125, 0.2→0.25, 0.3/0.3125/0.35/0.4→0.375, 0.45/0.55→0.5,
  0.6/0.65→0.625. Functional/fit constants left literal (action-slots 2.25rem,
  cut ribbon 1.4rem, headline 0.7rem col-gap, fan 0.875rem lift).
- Picker normalization [Codex-flagged deltas]: panel padding 0.9/1/1.1→1rem
  uniform; option padding-x 0.85→0.75rem (into the app's pill family).
- Card-metric calc(var(--gd-cardw)*N), the hand/ribbon clamps, wild-seal offsets,
  and the chooser/app-main/gd-table FIT-BUDGET paddings stay EXPLICIT literals
  (measured constants — their pins stay literal-parsing, unchanged).

THE FIXES (owner-flagged + confirmed):
- goldleaf → achievement ONLY. The play-desk clock's mid-urgency "amber" stage
  used goldleaf (a semantic collision: gold = "you won" AND "time low"). Owner
  Option A: a distinct caution hue **--amber #e37628** (burnt amber-orange).
  Data-chosen for perceptual separation — OKLab ΔE ~0.11 from goldleaf, ~0.15
  from cinnabar; contrast 4.7:1 on the desk panel. The planning-window border
  (a THIRD goldleaf meaning — calm "thinking room") moved to a calm ivory edge.
- Shell deck-theme chevron: goldleaf → ivory. It contradicted the shell's own
  stated rule ("goldleaf never in the shell") — a standing self-contradiction.
- Cut-ceremony "waiting" line: infinite gd-pulse loop → static weight+opacity
  (the no-blink non-negotiable; the urgent clock keeps its sole sanctioned pulse).
- RulePicker + TimingPicker were styled OFF-SYSTEM with DUPLICATED palette hex
  (#4A2C27/#F5EFE3/#C3392B) and off-scale sizes (0.95/0.8/1.1rem) invisible to
  the stylesheets — migrated onto palette + scale tokens (CSS-string only; no
  JSX/handler/ARIA change). A whole-codebase scan confirmed these were the ONLY
  off-system UI screens (deck art in themes/ + art-pool/ legitimately colour-literal).

STRUCTURAL GUARDS (owner reqs — made structural, not remembered):
- tests/unit/client/design-system.test.ts: (1) palette colours may appear as raw
  hex ONLY in the token definitions — a component/rule re-writing a palette hex
  fails; (2) every font-size rides var(--fs-*) / card-metric / clamp / em — a raw
  off-scale rem fails. Proven NON-VACUOUS (injected violation → both checks fail;
  reverted → pass). (3) The loudness hierarchy pinned by COMPUTED rem: desk clock
  loudest in the desk, seatcount--critical > seatcount, victory > banner > line.
- Pins that used to parse a literal font-size now resolve the token to its
  computed value (Grok/owner: assert the computed rem, not the token name) —
  tests/unit/client/css-tokens.ts helper; chooser arrow, iOS-16px guard,
  wordmark/turn compression, amber-distinctness all re-expressed by value.

AUDITS: **Codex (code)** — no behaviour/logic/protocol/timing/redaction change;
scope art-only; migration faithful; tokens sound (no undefined/var(var/NUL);
--amber defined); all four fixes confirmed; pins non-vacuous. Findings: 3
disclosure deltas (folded into the delta set above) + 3 stale comments/test-name
(all fixed). **Grok (design)** — SHIP: type scale coherent; no load-bearing
contrast fail (amber 4.7:1; the only soft edge is the DECORATIVE planning
perimeter, intentional); non-negotiables intact (loudness/no-blink/not-colour-
only/390px); amber "reads as caution orange, not gold — acceptance condition
met"; snaps below perceptual threshold, no meaning-bearing pair collapsed.

VISUAL VERIFY (localhost:8787 dev, true 390px iframe unless noted; locale stated):
- 390px zh-Hant (default, longest glyphs): home, lobby (empty + 4 seats claimed),
  seat bubble (ivory/cinnabar, tail on the pressed seat), rule + timing pickers
  (rosewood panels, cinnabar active pills, ivory labels — on-token), cut ceremony
  + table headline + ring, the DEALT playing table (team badges w/ goldleaf rank
  at the new size, ring + 27-card remote stacks, hand fan, joker bomb, WILD 2♥
  gold heart, cream faces), the error-alert surface — all with zero h-overflow.
- 390px en + zh-Hans: home (no length-driven breakage).
- 900px desktop zh-Hant: playing table (felt ring ground; opponent clock stays a
  QUIET chip — loudness hierarchy holds).
- Amber acceptance (owner condition): a swatch renders the real ivory→amber→
  cinnabar ramp + a gold/amber/cinnabar adjacency + hue strip at 390px on the
  actual desk-panel background — gold reads yellow-brass, amber reads clearly
  orange; the step is unmistakable, amber legible, planning ivory reads calm.
- NOT each live-captured (transient overlays needing specific game state): wild
  chooser, tribute/anti-tribute reveal, jiefeng, inter-hand interlude, match end.
  These are alias-only changes; their 390px fit is test-pinned (chooser-faces
  re-proves the chooser budget from the stylesheet) and their goldleaf usage
  (interlude standings / result victory) is unchanged. Verified by code + tests,
  not live — carried to the owner honestly.

FLAGGED, LEFT UNTOUCHED (outside the owner's amber-clock decision — possible
follow-up): goldleaf still appears on two focus outlines (.gd-plate--held,
.gd-cut__ribbon) and the sort-toggle active state (.gd-handSort[aria-pressed]) —
non-achievement uses; not changed this round (would be a scope expansion beyond
the ruling). Deck-art goldleaf (card backs, cut handle coin) is legitimate.

Gate 1085/1085 (46 files; +7 design-system guards) + typecheck (4 tsconfigs) +
lint:hooks + build. Diff is CSS + the two pickers' CSS strings + client tests
only — no engine/server/protocol/GameTable logic touched. Outgoing sweep clean
(zero sibling-name hits, zero secret patterns, dist gitignored). NOT pushed — no
deploy word.
