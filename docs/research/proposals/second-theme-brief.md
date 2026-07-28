# Brief: a deck theme whose defining property is incompatible with the layout

You are advising on an APPEARANCE and product judgement, not on arithmetic. The arithmetic
below is settled and independently reconstructed; do not re-derive it. **Do not modify any
files** — produce a report only.

Tooling note: Firecrawl is disabled (credit limit reached 2026-07-13). Do not attempt to use
it. Web search is off; reason from the repository and from your own design judgement.

## The situation

A four-player Guandan card table renders the player's 27-card hand as a fan of columns, one
per value class, wrapped onto two lines. Each column is a STACK: cards overlap vertically and
each covered card shows a strip of itself. The fraction shown is a per-theme metric,
`stackStripW`.

Two themes ship, both reachable from a `<select>` in the app header at any time:

| theme | `stackStripW` | why |
|---|---|---|
| `lacquer` (default) | 0.42 | its index is a one-line HORIZONTAL rank+suit row, so a short strip suffices |
| `cinnabar-court` | **0.841** | its index is a VERTICAL rank-over-suit column, which needs the taller strip to stay readable |

The strip multiplies directly into the fan's height. With `c(s) = 4*aspect + stripW*(s-2)`
and a fixed vertical budget of 436px, the largest hand depth that fits at card width `w` is
the largest `s` with `436 >= c(s)*w`. Consequences, all verified:

| | lacquer | cinnabar-court |
|---|---|---|
| deepest hand that fits at the shipped 46.51px card | 10 | **6** |
| modelled share of hands that do NOT fit, inner 390x664 | 0.1% | **51.3%** |
| the same at the previously shipped 48.15px card | 1.3% | **94.8%** |
| card width needed to fit depth 10 | 47.60px | **34.81px** |
| `stackStripW` needed to fit depth 10 at a 46.51px card | 0.42 | **<= 0.447** |

An independent browser measurement in an earlier round found the primary action below the
fold on **95.8%** of deals at cinnabar-court against **4.2%** at lacquer — measured at a
viewport height this project has since declared void, so it corroborates the DIRECTION and
not the number.

**So the theme's defining visual property and a two-line fan cannot both hold at any card
size anyone would ship.** It has been in this state since it shipped, and nobody has
reported it.

## The four options

1. **Withdraw the theme** — remove the picker entry. Reversible at any time.
2. **Give it its own card size**, ~35px against lacquer's 46.51 — a 25% smaller card, only
   on this theme.
3. **Change its `stackStripW` to ~0.42**, which removes the thing that distinguishes it and
   requires its vertical index to work in lacquer's strip height.
4. **Give it its own fan layout** — keeps both the strip and the card size. By far the most
   work.

## Read before answering

`src/client/table/themes/cinnabar-court/index.tsx` and its face component,
`src/client/table/themes/lacquer.tsx`, `src/client/table/HandFan.tsx` (how `stackStripW`
becomes a margin), and `status/rounds/098-*.md` (where the defect was first measured).

## Questions

**Q1. Is a cinnabar-court card at ~35px still cinnabar-court?** Its identity is a vertical
rank-over-suit column plus its own body art. At 35px wide the index column is roughly 12px
of glyph. Look at what the face actually draws before answering.

**Q2. Is a per-theme card scale acceptable at all?** Two players at the same table, on the
same phone model, would see cards of visibly different sizes depending on a cosmetic
preference — and the fan's column pitch, the trick well, the staged card and the seat stacks
all follow the card. Say what breaks that is not obvious.

**Q3. Could the vertical index survive lacquer's 0.42 strip?** That is option 3, and it is
the cheapest structural fix. What would have to change about the face for it to work, and
would the result still be a distinct theme or a re-skin of lacquer?

**Q4. Which option would you take, and what would you need to believe for that to be
wrong?** Include "withdraw" as a serious candidate rather than a failure state — it has been
broken since it shipped with no report, which is itself information.

**Q5. What would you NOT do.** Name the part of this framing you think is wrong.

## Report format (mandatory)

Markdown, sections `## Q1` … `## Q5`, then `## Checked clean` listing what you examined and
found no problem with. End with a literal final line:

`THEME VERDICT: <N> recommendations`
