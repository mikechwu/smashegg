// The JOKER-FIGURE POOL contract (owner art round, 2026-07-22). The joker
// card keeps its frame — the JOKER wordmark and the corner logos (+ the big
// joker's star) live in jokers.tsx — and the BODY illustration ("main pic")
// is a swappable pool entry. Each entry is a `JokerFigure`; the active one is
// named in ./index.ts, so swapping the joker picture is a one-line change and
// the old art stays archived and reusable. See ./README (../README.md).
//
// Two figure styles already coexist through this one interface:
//  • the jester (archived): monochrome paths recoloured per variant — big in
//    the palette (flat patches under the linework), small in currentColor;
//  • the bombs (active): SELF-COLOURED illustrations (baked per-path fills),
//    one distinct drawing per variant (red bomb big / black bomb small).
// The palette is passed to every Body so a tinted figure can use it; a
// self-coloured figure simply ignores it.

import type { ReactElement } from 'react';

/** The big joker illustration's flat palette — ONE place a future theme can
 *  swap it. Table tokens where the table already has the hue; the regal vest
 *  purple is the deck's own. A self-coloured figure (e.g. the bombs) ignores
 *  this. */
export interface JokerPalette {
  red: string;
  gold: string;
  ink: string;
  purple: string;
}
export const JOKER_PALETTE: JokerPalette = {
  red: 'var(--cinnabar)',
  gold: 'var(--goldleaf)',
  ink: 'var(--ink)',
  purple: '#4a2d68',
};

/** A swappable joker BODY illustration. `viewBox` is the figure's own
 *  coordinate space; JokerFace fit-places it into the card body via
 *  fitTransform, so a figure never hard-codes card-space numbers. `Body`
 *  renders the already-coloured figure content in that space (big = big joker). */
export interface JokerFigure {
  /** Stable registry key (./index.ts). */
  name: string;
  viewBox: string;
  Body: (props: { big: boolean; palette: JokerPalette }) => ReactElement;
}

/** A rectangle in the 200×290 card space. */
export interface FitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Fit-CONTAIN a figure's viewBox into a card-space box, centred — the same
 *  scale on both axes (no distortion), so ANY figure aspect drops in cleanly.
 *  Respects the viewBox ORIGIN (min-x/min-y), so a figure whose art does not
 *  start at 0,0 (e.g. "-50 -50 100 100") still lands inside the box — the pool
 *  must accept any figure (panel-audit INFO, Codex). Returns an SVG transform
 *  string for the placement group. */
export function fitTransform(viewBox: string, box: FitBox): string {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const minX = parts[0] || 0;
  const minY = parts[1] || 0;
  const vw = parts[2] || 1;
  const vh = parts[3] || 1;
  const scale = Math.min(box.w / vw, box.h / vh);
  const tx = box.x + (box.w - vw * scale) / 2 - minX * scale;
  const ty = box.y + (box.h - vh * scale) / 2 - minY * scale;
  return `translate(${r3(tx)} ${r3(ty)}) scale(${r3(scale)})`;
}
