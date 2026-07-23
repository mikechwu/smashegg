// ACTIVE joker figure — the bombs (owner art round, 2026-07-22). The joker as
// a bomb is on-theme for Guandan: the jokers ARE the top bombs. Each variant
// is its OWN self-coloured drawing (baked fills, bomb-art-data.ts):
//   • big joker: the full-colour bomb — red/gold diamond + lit spark;
//   • small joker: the monochrome bomb — an OUTLINE diamond, no red.
// So big vs small differs by SHAPE/fill (filled-vs-outline diamond, shaded-vs-
// flat body), not colour alone — it survives grayscale (verified) — and the
// frame's star (jokers.tsx, big only) still guarantees the no-colour cue.
// The palette prop is unused: the bombs carry their own colours.

import type { ReactElement } from 'react';
import { BOMB_BLACK, BOMB_RED, BOMB_VIEWBOX, type BombPath } from './bomb-art-data';
import type { JokerFigure } from './types';

function paint(bomb: readonly BombPath[]): ReactElement {
  return (
    <>
      {bomb.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
    </>
  );
}

function BombBody({ big }: { big: boolean }): ReactElement {
  return paint(big ? BOMB_RED : BOMB_BLACK);
}

export const BOMB_FIGURE: JokerFigure = {
  name: 'bomb',
  viewBox: BOMB_VIEWBOX,
  Body: BombBody,
};
