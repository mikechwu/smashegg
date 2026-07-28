# If cinnabar-court is ever revived

Round M2 withdrew `cinnabar-court` from the picker. The face, back, art module and design
record all stay in tree; re-registering is one import in `src/client/table/CardFace.tsx`.

This file exists so that a revival starts from the right question. **Nothing here is
planned work.**

## The bar

A covered mark designed for the framework's strip ceiling — `stripCeilingFor(cardW,
depthFloor)` in `src/client/table/theme.ts`, 0.447 at the card and depth floor shipped in
round L0. Not a smaller card (rejected: one root constant drives the fan pitch, staged card,
seat stacks and cut geometry), and not a silent clamp of the strip the theme asks for (a
theme rendered at a reveal its designer did not choose is a different design).

## An assumption the costed options all made, which may be false

The four options priced in round L1 — withdraw, its own card, strip to 0.42, its own fan
layout — share an unexamined premise: **that a covered card's suit must be readable.**

`status/MODEL.md` records that a value class present in the hand is exactly one fan column.
So every card in a column is the same rank and suit-family position as the one on top. **The
covered cards do not need to convey WHICH card they are. They need to convey HOW MANY.**

If that is right, options open that none of the four consider, and none of them needs a
per-theme card width or a new fan layout:

- **A count affordance instead of a peek.** The column shows its depth as a number or a set
  of tick marks, and the reveal collapses to whatever the framework's ceiling allows.
- **Compress only the deep columns.** The first covered card keeps the full strip — where
  the identity mark actually reads — and the reveals below it share what is left. This is
  what `stackOffsetW`'s 2.95 card-width budget already does; the theme would be opting into
  a tighter budget rather than a different mechanism.

Both are speculative and neither has been costed. The reason to write them down is that the
premise they attack was never stated as a premise, and a revival that re-runs the same four
options would inherit it silently.

## What would have to be true first

Some signal that the theme is wanted. It was broken from the day it shipped and nobody
reported it, and **that silence supports removal but does not diagnose anything** — it is
equally consistent with nobody choosing it and with people choosing it, finding it worse,
and switching back. Neither reading is evidence for revival.
