# Card-art pool

A pool of swappable card presentations. Each entry is one **pool entry**; which
entry is active is one line in a registry, so a presentation can be changed
without touching the composition, and old art stays **archived and reusable**.

Two pools so far: `joker-figures/` (the joker body illustration) and
`wild-marks/` (how a wild card is marked).

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

## wild-marks/

A wild card (the level rank of hearts) is marked by the **active** wild-mark,
applied by the framework (`CardFace` / `GhostFace`) over every wild surface —
no theme can remove it.

- `types.ts` — the `WildMark` contract: a `frameClass` (a class the framework
  adds when wild, so CSS recolours/edges the face) and/or an `Overlay` (an
  element stamped over the face).
- `gold-heart.ts` — **active**: turns the wild card's heart pips goldleaf
  (`frameClass: gd-wild--gold`; `table.css` recolours `.gd-suit` under it). The
  gold heart sits in the corner index — the fan's always-visible sliver.
- `seal.tsx` — **archived**: the cinnabar seal stamp. It sat in the lower-left
  corner and was easily hidden under the next card in the fan — the reason the
  owner moved to the gold heart. Kept as a reusable option.
- `index.ts` — the registry. `ACTIVE_WILD_MARK` names the one in use.

### Swap the wild presentation

Re-point `ACTIVE_WILD_MARK` in `wild-marks/index.ts` (e.g. `WILD_MARKS.seal`
restores the stamp). Nothing else changes — `CardFace` and `GhostFace` consume
the active mark.
