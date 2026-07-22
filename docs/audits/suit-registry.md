# Suit registry — cross-model audit (2026-07-22)

Scope: the suit round — every Unicode suit glyph replaced by SVG parts
from the new single-source registry (src/client/table/suits.tsx: the
owner's four paths normalized as a family, SuitMark, fill=currentColor),
consumed by lacquer (corner + body pip), GhostFace, cinnabar-court
(corner + pip field + court cartouche; art.tsx's local 24x28 paths
deleted), and the desk/chooser SF run labels (declRunText now rank-window
only; the suit renders as SuitMark visually and the localized suit WORD
in aria via the new i18n/react.tsx tNode seam). Producer: Claude.
Auditors: Codex (isolated clone, reasoned-only — its sandbox blocks
vitest/network) + Grok (isolated clone; ran the full suite green,
1058/1058 at audit time; mutation-tested the pins) + a 17-agent
workflow sweep (six independent search modalities, each finding
adversarially verified).

## The completeness question (the owner's named failure mode): TOTAL

Three independent verdicts concur. Codex: "Replacement is total in the
current src/client tree." Grok: "No live Unicode suit leftovers under
src/client; path data single-sourced in suits.tsx." The workflow's
codepoint hunt searched the whole repo for literal chars (filled+white
forms, the U+1F0A0 playing-card block), escapes (♠ forms, CSS
\2660, surrogate pairs), entities (named/hex/decimal), and numeric
construction (fromCharCode/fromCodePoint, bare 0x2660/9824) — zero
rendered-surface hits; every raw hit (STATUS/PLAN prose, engine test
comments, it() names, the guard test's own regex) was adversarially
refuted as inert. The render-surface walk over every src/client
component found no second way a suit reaches the screen; EventFeed's
semantic combo records never stored a suit, so no caller expected the
old run-includes-suit string.

## Findings (all addressed same-round)

- **MED (Codex; Grok concurring with a proof-by-mutation): the pin's
  escape blind spot.** The literal-only codepoint scan would miss
  '♠', '\u{2660}', '&spades;', '&#x2660;', CSS content "\2660" —
  Grok mutated an escape into a component and the suite stayed green.
  Fixed: SUIT_PATTERNS now bans escapes, entities, surrogate pairs,
  fromCharCode/fromCodePoint construction (Grok's addition), and the
  U+2763/2764 heart stand-ins, with a self-test proving every smuggling
  form is caught so the scan itself cannot rot.
- **MED (Grok): the local-helper hole.** The "suitGlyph is gone" pin
  only checked the helpers export; a reintroduced LOCAL suitGlyph (or a
  copied path map) elsewhere would pass. Fixed: a scan bans the
  suitGlyph/SUIT_GLYPHS identifiers and any SUIT_PATHS definition
  outside suits.tsx across src/client. Honest boundary, stated in the
  test: a copied path under a fresh name evades any static scan — that
  residual belongs to review and the eyes-gate.
- **LOW (Grok, acknowledged + comment): cinnabar's dual color wire.**
  The corner inherits .gd-card--red/--black via currentColor while the
  pip field/cartouche fill with the theme's SUIT_FILL — identical tokens
  today; a future palette edit touching one wire alone would split
  corner from body. art.tsx now carries the alignment note.
- **LOW (workflow, CONFIRMED): a table.css comment over-claimed**
  "(font-size has no effect on an <svg>)" — false in general precisely
  because .gd-suit's em sizing exists to track font-size. Reworded.

## Clean areas (one line each, per the auditors)

Theme recolor path intact end to end: currentColor discipline, lacquer/
GhostFace class inheritance, desk/chooser text-color inheritance judged
intentional, a SuitMark-only future theme recolors without touching
shapes. Label restructure clean: declRunText's two consumers render the
suit separately; optionAria/visible parity holds; tNode handles
end-of-template and missing params (pinned). art.tsx edit minimal —
shape source + cartouche transform only; Codex re-derived the scale
math (0.31 x 82..87 ~ 25.4..27 vs the old 25.5 cartouche ink; 0.415 x
82..87 ~ 34..36 vs the old 34.4 pip ink). i18n: zero suit codepoints in
all three locales; game.suit.* parity exact.

## Verification boundary (stated)

Desktop Chrome and iPhone rendered the OLD Unicode suits fine — the bug
is Chinese-brand Android's emoji promotion, which NO desktop/iframe
check can exercise. What is verified here: the cause is structurally
gone (zero suit codepoints, pinned against reintroduction in every
known encoding) and the SVG rendering is correct at true 390px zh-Hant
(13/13 live checks: every corner/pip/ghost/desk mark is the shared
part; pip ink clears the wild seal 3.4px and the corner index 11.4px,
re-measured per the CSS comment's own rule; corner ink ~12px at 390 and
the four silhouettes separate — screenshots). The emoji-gone
confirmation on a real Xiaomi/Huawei/OPPO/vivo device is a named M5
check, batched with the elder session.

## Post-fix state

Gate 1060/1060 (44 files) + typecheck (4 tsconfigs) + lint:hooks +
build. The registry seam is ready for the jokers/court-cards follow-on
(stated in suits.tsx's header: further part maps join the registry, not
inline SVG at call sites).

## Verdict

**Ship (all three lineages/verdicts): the replacement is total, the
recolor path holds, and the pin suite — after the panel's two MEDs —
now bans every known smuggling encoding with a self-test.**
