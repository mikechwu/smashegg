# Joker faces — cross-model audit (2026-07-22)

Scope: the joker round — the owner's three SVG parts (figure illustration
145 paths / JOKER wordmark 5 / dollar-J logo 1, extracted VERBATIM from
the supplied files into joker-art-data.ts) composed into JokerFace
(jokers.tsx) per the owner's reference: wordmark across the top reading
on from the top-left corner logo, the logo mirrored bottom-right by a
180-degree turn about the card center, the illustration filling the
body. Small joker fully monochrome (currentColor); big joker's marks
red (currentColor via the face class) with the illustration in FULL
COLOR — 18 flat palette patches under the open linework (JOKER_PALETTE,
one place). Both themes' previous joker code deleted (lacquer's marks;
cinnabar-court's figures + emblems from the frozen art module — the
disclosed edit; courts untouched). Producer: Claude. Auditors: Codex
(isolated clone, reasoned-only) + Grok (isolated clone; suite green
1069/1069; mutation-tested the pins) + an 11-agent workflow sweep (five
modalities, findings adversarially verified).

## The no-color-only property (the owner's first named check): HOLDS

The chosen cue (evaluated against the owner's offered options via
screenshot rounds — a filled-vs-outline logo died at small sizes, bars
looked tacked-on): both variants keep a SOLID corner logo, and the big
joker adds a solid five-point star under each corner logo — presence of
a glyph survives any size, grayscale, and the fan sliver; the big
joker's shaded body masses vs the small's white line art are the second
cue. Verified three ways:
- Grok BROKE it on purpose: removing one corner's star failed the
  count===2 pin; removing all stars failed three pins across both
  themes; swapping the coloring alone failed the palette/monochrome
  pin. Verdict: "holds structurally — yes."
- Codex re-derived the geometry independently: star box x 8..34 of 200
  (inside the 0.40w sliver, JOKER_CORNER_MAX_X ~34.06 <= 80); the
  rotated corner lands at x 165.97..191.97 / y 203..229, star inward,
  inside the card.
- Live at true 390 zh-Hant in a REAL fan (room Z22CWC, a hand holding
  BJ+SJ side by side): 6/6 checks — star on BJ only, no text nodes,
  full composition path counts (152 small / 172 big); the grayscale
  crop separates the pair by star + body mass; the sliver shows the
  dollar-logo + wordmark head + star-or-not. The corner star measures
  4.6px at 390 — small but visible (see the grayscale crop); the
  isolated-mark ladder was verified in the prototype at 24/14/10px
  (clear/clear/faint — at real card sizes the mark region never
  renders below ~22px).

## The id/defs question (the owner's second named check): CLEAN

The supplied art contains no id/defs/gradients/url() anywhere (verified
at intake by grep, re-verified by both lineages and the sweep); the
composition introduces none; the pin (joker-faces.test.tsx) scans both
registry files AND the rendered markup — hardened same-round on Grok's
note (word-boundary id match).

## Findings (all addressed same-round)

- MED (Grok): the per-theme star pin was presence-only — a one-corner
  star drop only failed the direct JokerFace pin, not the theme loop.
  Fixed: the theme loop now asserts star count === 2 per theme/size.
- LOW (Grok): the rendered-output id scan used a space-prefixed match.
  Fixed: word-boundary regex.
- LOW (workflow, dangling ×2): art.tsx's header and suit-round comment
  still said "2 jokers"/"court/joker geometry". Fixed.
- LOW (workflow, surfaces): ActionBar's faceLabel re-implemented
  jokerLabel inline. Fixed: calls the exported helper.
- INFO (workflow, quality, acknowledged): composition constants
  hardcode part dimensions (148/284, 150/600) rather than deriving from
  the parts' viewBox fields — left as-is for the court round to decide
  a shared idiom.

## Clean areas (per the auditors, one line each)

Render-surface walk total: every joker path routes CardFace ->
theme.Face -> JokerFace (fan, desk, trick well, chooser, deal/ceremony/
cut overlays, tribute panel); GhostFace can never receive a joker
(type + data + pin, three levels). Geometry: all 18 patches inside the
figure box; figure/wordmark/corners inside the 200x290 card; no clip
needed. Contract: DeckTheme untouched, wild seal framework-drawn as
before, SeatStack back-count untouched, suit round intact (the
no-suit-codepoint scan covers the new files). Deletion hygiene: zero
live references to the removed components/classes. React/perf: keys
correct, pure components; worst case ~4 joker faces in one fan.

## Verification boundary (stated)

The iframe verified the composition at 390 (hand ~51px) and the
prototype at 240/50/36px + grayscale + a 40% sliver mock; the fan crops
are REAL gameplay. Not exercised live: a joker at trick size on the
table (static pins + the 36px prototype cover it) and mini (dormant
size, renders the same composition). The detail-ladder check passed
WITHOUT a reduced form: the line-art illustration stays legible at hand
size (it reads as texture, the wordmark + corner column carry identity)
— screenshots in the round records.

## Post-fix state

Gate 1069/1069 (45 files) + typecheck (4 tsconfigs) + lint:hooks +
build (bundle +34KB gzip — the owner art's real cost). The registry
seam (data module + parts + palette + composition) is the door the
court cards come through next; Codex: "a reasonable shape for the
court-card round."

## Verdict

**Ship (both lineages + the sweep): the pair is distinguishable without
color in every tested failure mode, the art composes with zero
collision surface, and both themes consume the one registry part.**
