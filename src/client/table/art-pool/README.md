# Card-art pool

A pool of swappable card pictures. Each card's illustration is a **pool entry**;
which entry is active is one line in a registry, so a picture can be changed
without touching the composition, and old art stays **archived and reusable**.

## joker-figures/

The joker card's **frame is fixed** — the JOKER wordmark, the dollar-J corner
logos, and the big joker's star (composed in `../jokers.tsx` from the verbatim
parts in `../joker-art-data.ts`). Only the **body figure** ("main pic") is a
pool entry.

- `types.ts` — the `JokerFigure` contract (`name`, `viewBox`, a `Body`
  component) + `fitTransform` (fit-contain any figure's viewBox into the card
  body) + the `JokerPalette` seam.
- `bomb.tsx` + `bomb-art-data.ts` — **active**: the two bomb illustrations
  (owner art). Self-coloured (baked per-path fills); the big joker is the
  full-colour bomb, the small joker the monochrome bomb. Generated verbatim
  from the owner's SVGs; the full-canvas white background rect was dropped so
  the card's own `--card-face` base shows through.
- `jester.tsx` — **archived**: the original jester illustration (monochrome
  paths recoloured per variant + flat colour patches). One line from returning.
- `index.ts` — the registry. `JOKER_FIGURES` lists every entry;
  `ACTIVE_JOKER_FIGURE` names the one the cards use now.

### Swap the joker picture

Re-point `ACTIVE_JOKER_FIGURE` in `joker-figures/index.ts` (e.g.
`JOKER_FIGURES.jester` restores the original). Nothing else changes — the frame,
both deck themes, and the tests all consume the one composed `JokerFace`.

### Add a figure

Drop a module exporting a `JokerFigure` (a `viewBox` + a `Body` that renders the
already-coloured figure in that space — tinted figures read the palette,
self-coloured ones ignore it), then register it in `index.ts`. No id/defs/text
nodes (deck contract); place nothing in card-space numbers — `fitTransform`
handles placement.
