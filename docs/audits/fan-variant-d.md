# Fan variant D (hit/paint decoupling) — cross-model audit (2026-07-22)

Scope: the item-1 build per the owner's F1–F3 sign-off — table.css fan
block (every lift/nudge transform moved to the card FACE with
pointer-events:none), two play-desk pins updated, the new
fan-tap-targets.test.ts invariant suite, and the committed sweep script
scripts/measure-fan-tap-targets.mjs. Producer: Claude. Auditors: Codex +
Grok in isolated clones. The two owner-named questions: did the
decoupling actually hold (transform on the face, pointer-events none,
base-layout hit boxes), and did presentation-only hold.

## Both lineages: both questions HELD — zero HIGH, zero MED

- **Decoupling:** full fan transform inventory walked (Grok's table):
  hover nudge, selected, selected:hover all on the face; no button rule
  carries a transform; pointer-events:none present and fan-scoped (the
  desk's tap-to-unstage staged faces stay directly interactive); the
  transition moved with the transform; the reduced-motion block collapses
  the FACE transforms including hover — the stale-button-override trap
  the prompt named is closed. No path found where a lifted face steals a
  tap; the intentional top-of-lifted-card trade is documented with the
  guard-3 desk dependency note.
- **Blast radius:** patch surface is table.css + tests + the script —
  no HandFan/GameTable JS, no engine/timing. Keyboard focus/activation
  stays on the buttons (pointer-events does not affect focus or
  Enter/Space); the FLIP sort beat animates BUTTON elements and is
  unaffected by face transforms; deal-mode faces get the same (correct)
  transparency; tribute glow (face box-shadow) and D3 dim (button
  opacity) untouched. Grok ran the suites in its clone green (44/44 D
  pins + hand-fan 19/19 at audit time).

## LOWs → outcomes

- **Fixed (Codex):** the button-transform scan regexed selector blocks by
  their final selector, so a fan selector hiding FIRST in a comma list
  could slip it — the scan now splits every selector list and attributes
  a rule to the fan if ANY selector targets a fan button. Pinned by its
  own strengthened form.
- **Fixed (Grok):** the reduced-motion face override was pinned only in
  the play-desk suite — deleting the block outright would have slipped
  the D suite alone; a dedicated reduced-motion pin now lives with the
  other D pins. Also fixed: CardFace.tsx's stale header still attributed
  the selection lift to the wrapping buttons.
- **Acknowledged, kept:** the panel's variantD.patch was review context,
  not a ship artifact (the repo tree is the artifact — noted for future
  panels); the :focus-visible ring outlines the unlifted BUTTON while
  the face paints 14px higher (an intentional consequence of the split;
  keyboard users see the ring at the true hit position, which is
  arguably the honest place); the sweep script stays a documented
  manual gate (playwright deliberately not a repo dependency, config
  dump documented with its re-dump note) rather than CI wiring.

## Post-fix state

Gate 1025/1025 (43 files) + typecheck + lint:hooks + build. The named
end-to-end check ran on the shipped code before the panel: ZERO victims
across the full 27×27 sweep at true 390×844 zh-Hant (baseline
min/median/max 700/1000/3750 px² preserved in every selection state);
computed-style probe faceLifted=14, buttonTransform=none,
pointerEvents=none.

## Verdict

**PASS from both lineages — the decoupling is complete and
presentation-only.** Open with real players (batched elder session):
the top-of-lifted-card unselect in practice (guard 1), plus the desk
round's reflow read and dual-render checks.
