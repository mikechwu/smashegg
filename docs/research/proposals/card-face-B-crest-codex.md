**1. Sliver Architecture**

Direction: **Seal Column Deck**. The left visible 40% becomes a disciplined identity column; everything important lives inside the card’s own first **0.36W**, leaving a **0.04W right safety gutter** before the fan junction.

Top to bottom in the 17px mobile sliver:

- **Inset/border:** 0.045W rosewood border, ivory face inside.
- **Rank zone:** x 0.07W, y 0.07W, font 0.31W. `10` uses a narrower two-glyph lockup, not a smaller random fallback.
- **Suit zone:** x 0.09W, y 0.36W, glyph 0.24W. Suits are shape-primary; red/black only reinforces.
- **Wild seal zone:** x 0.08W, y 0.63W, size 0.22W. Only appears for wilds, inside the same column.
- **Joker crest zone:** x 0.07W, y 0.08W, width 0.27W, height 0.56W. Jokers replace rank/suit with a single crest.

ASCII fan, showing only the visible left slivers:

```text
┌A♠╮ ┌7♥╮ ┌◆╮ ┌♛╮ ┌◐╮
│ ♠│ │ ♥│ │9│ │╋│ │●│
│  │ │ ◆│ │♦│ │ │ │ │
│  │ │  │ │✦│ │ │ │ │
╰──╯ ╰──╯ ╰──╯ ╰──╯ ╰──╯
 A♠   7♥   wild  big  small
           9♦    joker joker
```

`◆/✦` here means a cinnabar wild seal, not text. `♛` and `◐` are placeholders for custom joker shapes, not literal type glyphs.

**2. Wild Marker**

Make the wild marker **language-neutral**. No `配`, no `W`.

Form: a **small cinnabar seal lozenge** with an ivory four-point spark cutout. Think “game-state stamp,” not decoration.

Position: **left identity column, below suit**, centered around x 0.19W, y 0.70W, max size 0.22W. It must not touch the card’s bottom-left corner and must not cross x 0.34W.

Why it cannot be mis-attributed: the marker sits fully inside the same vertical column as that card’s rank and suit. It no longer occupies the fan junction or the bottom-left triangular corner where the next card visually steals ownership. The player reads one vertical sentence: **rank → suit → wild seal**.

**3. Jokers**

Jokers become language-neutral artifacts.

Small joker:
- Sliver: **black hollow crescent-disc crest**, like a moon clipped by a vertical stem.
- Body: monochrome ink jester medallion, sparse linework, one bell shape.
- Identifiable without color by the crescent silhouette.

Big joker:
- Sliver: **cinnabar crowned sun crest**, round center plus three-point crown.
- Body: cinnabar/ink/goldleaf ceremonial medallion, same geometry as small but expanded with crown rays.
- Identifiable without color by crown + sun silhouette.

No `Joker`, `Big Joker`, `大王`, or `小王` appears on the face. Accessibility can stay localized; the printed artifact should not.

**4. Face Body**

Number cards use classic French-suited pip logic, but simplified:

- Mobile hand: only the sliver identity column matters; body pips may be hidden by overlap.
- Trick well / last fan card: real-deck pip layouts appear, restrained and geometric.
- Desktop: fuller pip layouts, fine inner rule, small center pips for 2-10.
- J/Q/K: no copied court art. Use original Songti-inspired court silhouettes: jack = narrow baton, queen = oval hairpin crown, king = square crown and vertical tablet. Two-color line art only, with goldleaf as a hairline accent.
- Mini: body art drops away; rank/suit/wild/joker crest survive.

**5. One Theme Adaptive**

Use **one adaptive theme**, not two viewport themes.

The core problem is recognition continuity. Players should learn one deck: the same wild seal, same joker crests, same rank/suit column. The rendering can progressively reveal detail as card width grows, but the identity system must not switch. At small sizes, remove body pips and court detail; at larger sizes, restore them. Do not change the grammar.

**6. Tokens**

Palette:
- Face: `#f5efe3` ivory
- Border: `#4a2c27` rosewood
- Table harmony shadow: `#2b1a18` lacquer
- Red suits / big joker / wild seal: `#c3392b` cinnabar
- Black suits / small joker: `#1f2430` ink
- Accent hairlines only: `#c9a227` goldleaf

Type:
- Rank: Songti / Noto Serif, semibold, tabular numerals where possible.
- Suit: custom or system suit glyphs, optically centered, not color-dependent.

Shape:
- Corner radius: 0.14W, capped visually near current 8px.
- Border: 2px hand/trick, 1px mini if needed.
- Inner hairline: rosewood at low opacity on trick/desktop only.

Signature element: **the cinnabar seal system**. Wilds, big joker, and deck premium feel all come from seal-like geometry, but only the wild seal encodes game state.

**7. Risks**

At true 390px, the main risk is the `10` rank and the wild seal competing vertically. Degrade by tightening rank to 0.29W and moving the seal slightly lower, never by pushing it toward the fan junction.

The second risk is joker crests becoming abstract blobs. Degrade by preserving silhouette first: big keeps crown points; small keeps crescent cutout. Interior linework disappears before outline identity does.

No web research used; this proposal is based on the supplied constraints and inspected repo geometry.