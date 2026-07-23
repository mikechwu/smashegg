// The SEAL wild mark (archived option) — a language-neutral cinnabar circle
// stamp with an ivory four-petal cutout and centre dot, drawn as an overlay
// over the wild card. It reads as a seal at any size without translation, but
// it sits in the lower-left corner (.gd-card__wild) and is easily hidden under
// the next card in the fan — which is why the owner moved the ACTIVE mark to
// the gold heart. Kept here as a reusable option (one line in ./index.ts).
// Purely decorative: the accessible wild fact rides cardLabel's " (Wild)"
// suffix, so the mark is aria-hidden.

import type { ReactElement } from 'react';
import type { WildMark } from './types';

function WildSeal(): ReactElement {
  return (
    <svg className="gd-card__wild" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--cinnabar)" />
      <g fill="var(--ivory)">
        <ellipse cx="12" cy="6" rx="3" ry="5" />
        <ellipse cx="18" cy="12" rx="5" ry="3" />
        <ellipse cx="12" cy="18" rx="3" ry="5" />
        <ellipse cx="6" cy="12" rx="5" ry="3" />
        <circle cx="12" cy="12" r="2" />
      </g>
    </svg>
  );
}

export const SEAL_MARK: WildMark = {
  name: 'seal',
  Overlay: WildSeal,
};
