# Audit brief — the hand card becomes a constant, and STATUS becomes a folder

You are an INDEPENDENT AUDITOR. You did not write this change and must not defend it.
Do not modify any files. Produce a report only.

Tooling note: Firecrawl is disabled (credit limit reached 2026-07-13). Do not attempt to use
it. Use the repository itself.

## What changed, in one paragraph

The hand card's CSS width was `clamp(2.75rem, 13vw, 4.25rem)` written out at NINE sites in
`src/client/table/table.css`. It is now a single `--gd-handcardw` declared in
`src/client/app.css :root` — a constant `48.15px` on phones, with the old expression
restored verbatim inside `@media (min-width: 720px)`. A second token `--gd-handglyphw`
(`min(3.009375rem, 58px)`, reverting to the card width above the breakpoint) drives the card
INK — the corner rank/suit and the body pip — so that user text scaling still enlarges the
glyphs while no longer changing whether the hand fits. Separately, the 7,895-line root
`STATUS.md` was split into `status/` (CURRENT, model.json, generated MODEL.md, VALIDATED,
WITHDRAWN, README, rounds/), and four scanner tests were re-scoped.

## What to check, in priority order

1. **CSS CORRECTNESS AND CASCADE.** Does `--gd-handcardw` resolve at every site that now
   reads it? Consider elements that are NOT descendants of where you might expect, custom
   property inheritance, the `:root` media override, and whether any rule reads
   `--gd-cardw` where it needed the hand token or vice versa. Name any site whose value
   changes in a way the change did not intend. `.gd-card` sets `--gd-glyphw: var(--gd-cardw)`
   as a default and `.gd-card--hand` overrides it — check the specificity and source order
   actually produce what is claimed, and check the trick/mini/ghost/chooser sizes are
   genuinely unaffected.

2. **THE GLYPH CAP.** `--gd-glyphw: min(3.009375rem, 58px)`. Is `3.009375rem` exactly
   `48.15px` at root 16? Does `min()` behave as intended when the root font-size is SMALLER
   than 16 (the ink shrinks — is that acceptable or a defect)? Is there any site that reads
   `--gd-glyphw` where it should read the box, or `--gd-pipw` where it should read glyph?

3. **ARITHMETIC.** Verify independently, from the formulas in `status/model.json`:
   - `(W - 48.0) / 5.9` at W = 320, 360, 375, 390, 430 -> 46.10, 52.88, 55.42, 57.97, 64.75
   - the crossover `48.0 + 5.9 * 48.15 = 332.1`
   - capacity at cardW 48.15 for each of those widths
   - `T(w) = 455.9 - 2.90w` and the marginal bin at w = 48.15
   Report any figure you cannot reproduce.

4. **THE TESTS THAT WERE RE-AIMED.** Four pins previously asserted that N copies of a clamp
   literal were character-identical. They now assert the sites read the shared token. Is
   anything now UNPROTECTED that was protected before? Be specific. Look hardest at
   `tests/unit/client/desktop-mode.test.ts`, `hand-fan.test.tsx`, `seat-stack.test.tsx`,
   `cut-panel.test.tsx`, and at `chooser-faces.test.ts` which had a viewport-dependent
   card-width derivation replaced by a constant.

5. **THE NEW MECHANISMS.** `tests/unit/client/model-drift.test.ts` claims `status/model.json`
   cannot drift from the code. Can you construct a change to the code that this test would
   NOT catch but which makes MODEL.md wrong? Same question for
   `status-structure.test.ts` (history immutability) and the re-scoped
   `withdrawn-numbers.test.ts` / `prose-figures.test.ts`. A blind spot you can name is the
   most valuable thing in this audit.

6. **ANYTHING THE DIFF BREAKS THAT THE SUITE DOES NOT COVER.** The full suite is green
   (1312 tests) and typecheck is clean, which is exactly why this question matters.

## Report format (mandatory)

Markdown. For each finding: SEVERITY (HIGH/MED/LOW), the file and line, what is wrong, and
what you would do. Then a section `## Checked clean` listing what you examined and found no
problem with — that section is required and a short one will be read as a shallow audit.
End with a literal final line:

`AUDIT VERDICT: <N> findings`
