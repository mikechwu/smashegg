## Findings

**MED — [status/CURRENT.md](../../../status/CURRENT.md#L68)**  
The documented “one-line alternative” uses `--gd-cardw: 44px`, but the shipped shared source is `--gd-handcardw`. A root-level `--gd-cardw` override would not drive sites like `.gd-cut__ribbon`, `.gd-fan__row`, `.gd-fan__stack`, `.gd-desk__stage`, `.gd-seatstack`, and `.gd-sf__faces`, all of which now read `--gd-handcardw` directly or through an ancestor declaration. I would change the note to `--gd-handcardw: 44px`; line 14 should likewise name `--gd-handcardw`, not `--gd-cardw`, when describing the shipped constant.

**LOW — [src/client/table/table.css](../../../src/client/table/table.css#L590)**  
The comment says `margin(s=9)` at `cardW=48.15` is `15.23px`, `5.23px` above the 10px floor. From `status/model.json`’s formulas with authoritative `aspect=1.45`, I get `436.0 - (4*1.45 + 0.42*7)*48.15 = 15.17px`, `5.17px` above the floor. The script prints `15.23px` because `scripts/cardw-gate.mjs` still uses `73.5/50.7`. I would either update the comment to the model/CSS value or explicitly label it as the script-aspect figure.

**MED — [tests/unit/client/model-drift.test.ts](../../../tests/unit/client/model-drift.test.ts#L75)**  
`model-drift` checks that each constant’s source literal is present, but it does not check formula implementations or operative use. A change such as altering `capacityFor(W,w)` in `scripts/cardw-gate.mjs` from `0.7*w` to `0.8*w` while leaving the constants present would make `MODEL.md`’s capacity formula wrong and this test would not catch it. I would add source bindings or executable checks for the formulas in `status/model.json`, not just constants.

**LOW — [tests/unit/client/status-structure.test.ts](../../../tests/unit/client/status-structure.test.ts#L63)**  
The history hash is read from mutable `status/rounds/INDEX.md`. Editing a historical round and updating the hash in the same commit passes the suite, so the test enforces “matches the current manifest,” not immutability by itself. That may be an intentional review gate, but it is a blind spot in the mechanism. I would pin the migration baseline in the test or maintain per-round hashes so edits are distinguishable from appends in review.

**LOW — [tests/unit/client/withdrawn-numbers.test.ts](../../../tests/unit/client/withdrawn-numbers.test.ts#L46)**  
The withdrawn registry parser silently ignores malformed table rows, and the non-vacuity check only requires at least six rows. The current registry has seven rows, so one malformed or newly added unparseable row could be unprotected while the test stays green. I would fail on any non-header row in `## Registry` that starts with `|` but does not parse.

**MED — [tests/unit/client/prose-figures.test.ts](../../../tests/unit/client/prose-figures.test.ts#L35)**  
The test name says “same section,” but it concatenates `CURRENT.md` and `VALIDATED.md` and then checks whether a prose figure appears in any table anywhere in that combined text. A stale prose figure in `CURRENT.md` could be “backed” by an unrelated table row in `VALIDATED.md`. I would split by file and heading section before comparing prose figures to tables.

## Checked clean

- CSS cascade: `--gd-handcardw` and `--gd-handglyphw` are declared on `:root` in [app.css](../../../src/client/app.css#L116), so descendants can inherit them. The desktop `@media (min-width: 720px)` override is also on `:root`, so the breakpoint branch resolves globally.
- `.gd-card` sets `--gd-glyphw: var(--gd-cardw)` before `.gd-card--hand`; `.gd-card--hand` later overrides `--gd-cardw` and `--gd-glyphw`, so the hand override wins on both `CardFace` frames and `GhostFace` cards.
- The hand width token use count is exactly nine in `table.css`: cut ribbon, hand card, fan ancestor, flat fan overlap, stack-row padding, stack margin, desk stage, seat stack, and straight-flush faces.
- Trick, mini, ghost, chooser/result cards not explicitly hand-sized retain the default `.gd-card` glyph basis. Sites that render hand-size chooser/well/fan/pile cards intentionally get the hand token.
- I did not find a `--gd-cardw`/`--gd-handcardw` cascade error in the current CSS. Ancestor cases that need their own width basis have it; same-element margin cases rely on co-classed `gd-cardframe gd-card--hand`, which the React components render.
- Glyph cap arithmetic: `3.009375rem * 16 = 48.15px`; the cap binds at about root `19.27px`. With root sizes below 16px, the ink shrinks below the fixed box; that is a behavior choice, not a cascade failure.
- `--gd-pipw` is used only as the pip size basis, defaulting to glyph width; pip position and wild seal clearance stay on box width. I did not find a pip/box token swap in current CSS.
- Capacity ceilings independently reproduced: 320 `46.10`, 360 `52.88`, 375 `55.42`, 390 `57.97`, 430 `64.75`.
- Capacity at `cardW=48.15`: 320 is `7`, 360 is `8`, 375 is `9`, 390 is `9`, 430 is `10`. Crossover is `48.0 + 5.9*48.15 = 332.08`, reported as `332.1`.
- `T(w) = 455.9 - 2.90w` gives `316.265px` at `w=48.15`; the mismatch I found is specifically the `15.23px` margin figure under model-vs-script aspect, not the threshold formula itself.
- The four re-aimed lockstep tests do protect token use at the former literal-copy sites. What they no longer protect is semantic equivalence of all future width-dependent calculations, which is covered in the findings above.

AUDIT VERDICT: 6 findings