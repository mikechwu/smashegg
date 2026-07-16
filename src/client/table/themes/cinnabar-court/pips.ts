// Classic French pip arrangements in the 200x290 card space (public-domain
// geometry). Columns at x=100/156 with the axis at 128: the grid sits right
// of the identity column so pips never crowd the corner index. Pips in the
// lower half flip 180° like a real double-ended card.

export type PipSpot = { x: number; y: number; scale?: number; flip?: boolean };

export const PIP_LAYOUTS: Record<string, PipSpot[]> = {
  A: [{ x: 128, y: 145, scale: 2.2 }],
  '2': [
    { x: 128, y: 60 },
    { x: 128, y: 230, flip: true },
  ],
  '3': [
    { x: 128, y: 60 },
    { x: 128, y: 145 },
    { x: 128, y: 230, flip: true },
  ],
  '4': [
    { x: 100, y: 60 }, { x: 156, y: 60 },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  '5': [
    { x: 100, y: 60 }, { x: 156, y: 60 }, { x: 128, y: 145 },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  '6': [
    { x: 100, y: 60 }, { x: 156, y: 60 },
    { x: 100, y: 145 }, { x: 156, y: 145 },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  '7': [
    { x: 100, y: 60 }, { x: 156, y: 60 }, { x: 128, y: 102 },
    { x: 100, y: 145 }, { x: 156, y: 145 },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  '8': [
    { x: 100, y: 60 }, { x: 156, y: 60 }, { x: 128, y: 102 },
    { x: 100, y: 145 }, { x: 156, y: 145 }, { x: 128, y: 188, flip: true },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  '9': [
    { x: 100, y: 60 }, { x: 156, y: 60 },
    { x: 100, y: 116 }, { x: 156, y: 116 }, { x: 128, y: 145 },
    { x: 100, y: 174, flip: true }, { x: 156, y: 174, flip: true },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
  T: [
    { x: 100, y: 60 }, { x: 156, y: 60 }, { x: 128, y: 88 },
    { x: 100, y: 116 }, { x: 156, y: 116 },
    { x: 100, y: 174, flip: true }, { x: 156, y: 174, flip: true },
    { x: 128, y: 202, flip: true },
    { x: 100, y: 230, flip: true }, { x: 156, y: 230, flip: true },
  ],
};
