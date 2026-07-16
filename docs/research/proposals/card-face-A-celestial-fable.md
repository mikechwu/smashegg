# Proposal A (Fable) — "Seal & Celestial" ledger deck

Premise taken literally: the sliver IS the card. Everything identity-bearing stacks in one
LEFT COLUMN sized to the measured pitch (17.2px @390 = 0.40w); the body is reserved for the
few moments a full face is visible. One real aesthetic risk, spent in one place: the jokers
become celestial medallions (sun/moon) instead of words — the deck's signature.

## 1. Sliver architecture (top→bottom, fractions of card width w)
Fixed left inset 0.08w; column width 0.32w; everything left-aligned in the column.
- RANK 0.44w bold Songti serif (up from 0.42w), tabular, tight line-height.
- SUIT 0.34w directly beneath — glyph shapes distinct by silhouette (♠♥♦♣ differ in outline;
  additionally ♦ rendered as a sharper lozenge than ♥'s round shoulders at small sizes).
- WILD SEAL (framework overlay, only on the wild): 0.28w solid cinnabar rounded-square "chop"
  with an ivory four-petal cutout, sitting UNDER the suit inside the same column. Nothing else
  on any face is a filled square → shape-unique, not colour-alone.

Fanned run (ascending: A♠ 2♦ 2♥wild 小王 大王):

```
┌──┬──┬──┬──┬──────┐
│A │2 │2 │☾ │  ✹   │   rank / celestial glyph
│♠ │♦ │♥ │  │      │   suit (none on jokers)
│  │  │▣ │  │ .... │   ▣ = cinnabar chop (wild only)
│  │  │  │  │      │   last card shows full body
└──┴──┴──┴──┴──────┘
```
The chop lives BETWEEN the card's own left border and the neighbour's border — attachment is
structurally unambiguous (the junction triangle dies).

## 2. Wild marker — symbol, and why
YES, the wild goes language-neutral with the jokers: one deck, one artifact, every locale.
A localized glyph (配/W) competes with the rank for column space and drags i18n into the one
place it never belonged (faces). The chop is the Lacquer Ledger's own vocabulary — a seal
stamped on a ledger entry — so the wild reads as "officially stamped special". Framework-owned
as today (position/form supplied by theme metrics; the framework draws it). Accessibility: the
aria-label still says 逢人配/wild via cardLabel — speech stays localized; the FACE doesn't.

## 3. Jokers — celestial, language-neutral, shape-first
- BIG joker = SUN: a rayed disc medallion, cinnabar core + goldleaf rays (the deck's ONLY
  goldleaf use). Sliver shows the sun glyph at rank position (0.44w).
- SMALL joker = MOON: an ink crescent, monochrome. Sliver shows the crescent at rank position.
- Shape separation is silhouette-level (rayed disc vs crescent) — survives greyscale and 12px;
  colour (warm vs ink) is redundant reinforcement, honouring no-colour-alone.
- No words anywhere on the face (fixes the vertical-Joker overflow class entirely); the
  aria-label keeps the localized name. Body: a larger sun/moon medallion, fine line rays on
  desktop sizes, plain silhouette at mini. 大王=sun, 小王=moon is also semantically natural.
- IP: celestial motifs are ancient generic deck/tarot vocabulary; drawn as our own simple
  geometry (SVG-free CSS/inline-SVG shapes), no resemblance to any published deck's art.

## 4. Face body by size tier
- mini: index column only (today's behavior, tuned sizes). Nothing else.
- hand: index column + a faint 0.9w suit WATERMARK centered (8% ink opacity) — gives the last
  card and lifted/selected cards a finished look without noise at the pitch.
- trick/desktop-last-card: REAL French pip layouts (2-10 standard arrangements — public
  domain geometry), A as a single large ornamented pip; courts J/Q/K as typographic
  medallions: large serif letter in a goldleaf-hairline lozenge frame + suit below — "in the
  spirit of a classic deck" without figurative court art (IP-safe, 清楚簡約, and honest about
  our craft budget: bad court art reads cruder than no court art).

## 5. One adaptive theme (commit)
One theme whose detail tier keys off the EXISTING size prop (mini/hand/trick), not viewport:
the family sees one game everywhere; the conformance suite already renders every card at every
size, so the tiers are inside the contract's anticipated dimension. Two themes would fork the
identity and double the ratchet surface for zero family value.

## 6. Tokens
- Palette: unchanged table palette. Face ivory #f5efe3; ink #1f2430 for ♠♣ + moon; cinnabar
  #c3392b for ♥♦ + sun core + chop; goldleaf #c9a227 ONLY on sun rays + court frames.
- Type: Songti/Noto Serif for ranks (existing --font-card); no new fonts (CSP + weight).
- Corner radius 6px; border: 1px rosewood hairline + 1px inset ivory bevel (crisp edge on the
  dark table, reads "printed card" not "div").
- SIGNATURE: the celestial jokers (sun/moon medallions).

## 7. Risks & degradation
- Sun rays at mini (12px) can blur → silhouette fallback: filled disc (sun) vs crescent —
  still shape-distinct; rays appear only ≥ hand size.
- The chop lengthens the column: @390 rank 19 + suit 15 + chop 12 ≈ 46px of a 62px card ✓;
  if a future size shrinks height, the chop overlaps the watermark zone, never the suit.
- Watermark under 8% opacity may band on cheap panels → pure flat fallback below hand size.
- Two-row 27-card fit untouched (column geometry ≤ today's footprint).
