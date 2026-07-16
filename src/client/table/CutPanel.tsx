// CutPanel — the REAL cut's interaction (item 3, restyled per obs 1): the
// cutter drags a slider spread to the SAME width as the face-down deck ribbon
// above it, and the deck genuinely splits into two packets at the chosen
// point, live as the slider moves. The other three watch, with the actor
// named. No numeric index is ever shown — cutting has no numeric analogue at
// a physical table, and (ceremony-marker round) the number would also make
// residue-class counting trivial: ABSOLUTE leader uniformity holds, but
// conditional on the cutter the depth's residue carries a documented edge
// (see cut.ts / the engine's conditional test). The semantics are unchanged:
// a position in CUT_MIN..CUT_MAX submitted as a cutDeck action.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Seat } from '../../engine/core/game';
import { CUT_MIN, CUT_MAX, DEFAULT_CUT_POSITION } from '../../engine/guandan';
import { CardBack } from './CardFace';
import { CUT_RIBBON_SLIVERS, cutLeftCount } from './cut';
import { t } from '../i18n';

export interface CutPanelProps {
  cutter: Seat;
  /** True when the viewer's active seat IS the cutter. */
  isCutter: boolean;
  nameFor: (seat: Seat) => string;
  onCut: (position: number) => void;
}

/** The spread ribbon: CUT_RIBBON_SLIVERS overlapping card backs, each shifted
 *  right by the gap once it falls past the split (data-side='right'). The CSS
 *  transitions the shift, so dragging the slider slides the split along the
 *  ribbon — the deck visibly parting into two packets. */
function CutRibbon({ leftCount }: { leftCount: number }) {
  return (
    <div className="gd-cut__ribbon" aria-hidden>
      {Array.from({ length: CUT_RIBBON_SLIVERS }, (_, i) => (
        <span
          key={i}
          className="gd-cut__sliver"
          data-side={i < leftCount ? 'left' : 'right'}
          style={{ '--i': i } as CSSProperties}
        >
          <CardBack size="mini" />
        </span>
      ))}
    </div>
  );
}

export function CutPanel({ cutter, isCutter, nameFor, onCut }: CutPanelProps) {
  const [position, setPosition] = useState(DEFAULT_CUT_POSITION);

  if (!isCutter) {
    return (
      <div className="gd-cut" role="status">
        <p className="gd-cut__title">{t('game.ceremony.title')}</p>
        <CutRibbon leftCount={CUT_RIBBON_SLIVERS} />
        <p className="gd-well__waiting">{t('game.cut.waiting', { name: nameFor(cutter) })}</p>
      </div>
    );
  }

  return (
    <div className="gd-cut">
      <p className="gd-cut__title">{t('game.ceremony.title')}</p>
      <CutRibbon leftCount={cutLeftCount(position)} />
      <p className="gd-cut__prompt">{t('game.cut.prompt')}</p>
      <input
        className="gd-cut__slider"
        type="range"
        min={CUT_MIN}
        max={CUT_MAX}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label={t('game.cut.sliderLabel')}
      />
      <button type="button" className="gd-cut__confirm" onClick={() => onCut(position)}>
        {t('game.cut.confirm')}
      </button>
    </div>
  );
}
