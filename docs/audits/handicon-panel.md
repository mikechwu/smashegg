# Cut-handle icon round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff replacing the cut handle's chevron
glyph — which rendered as a small confusable DIAMOND (owner screenshot) —
with a 24px pointing-hand coin badge (inline SVG, WildSeal idiom: lacquer
disc, goldleaf ring, goldleaf hand path), riding the SAME pixel-exact split
geometry verified in the previous round. Of the owner's offered options
(hide / pointing hand / anything practical and elegant), the hand won: the
affordance exists for touch discoverability, so hiding it would reopen
that hole. Three hand candidates were rendered and compared at 18/28/72px
before choosing; the coin backing is what keeps the hand legible at handle
size.
Producer: Claude. Auditors: Codex + Grok, isolated clones, light
single-round brief (`BRIEF-HANDICON.md`), gate re-run by each. Producer did
not audit its own change.

Verified live before the panel (390 en): drag 12 → 20 slivers; Home/End
handle centres at 11.2px / width−11.2px exactly (no geometry regression);
the badge clearly legible on the parted gap.

## Round 1 — both auditors CLEAN (single round)

- **Codex — no findings.** Confirmed: the SVG is inline, minimal,
  decorative (aria-hidden span + focusable=false), theme-driven via
  var(--lacquer)/var(--goldleaf), no CSP surface (no script/external
  ref/handlers); the banned-codepoint pin holds; split geometry, z-29,
  pointer-events none, the left transition, both edge overrides and
  reduced-motion all intact; the 24px badge's ~0.8px-per-side overhang on
  the 22.4px gap is the intended sit-proud look. Gate: typecheck + lint
  pass; vitest/build EPERM in its read-only sandbox (environment, every
  round).
- **Grok — approve as-is.** Same confirmations plus the accessibility
  framing (the decorative handle is invisible to AT by design; the
  invisible input carries the slider semantics) and a note that the
  upward-pointing finger along the gap's long axis is a reasonable reading
  of the owner's ask. One NIT: a stale "chevron pair" phrase in the CSS
  block comment — fixed immediately. Gate in its clone: **932/932 +
  typecheck + lint + build PASS.**

## Verdict

**Clean in one round.** A pure visual replacement: the confusable glyph is
gone, the pointing-hand coin says "your finger goes here" at the exact
parted midpoint, and every load-bearing property of the audited cut-by-hand
mechanism — geometry, stacking, transition, reduced motion, accessibility
— is untouched and still pinned. Gate 932/932 + typecheck + lint:hooks +
build, green locally and in Grok's clone.
