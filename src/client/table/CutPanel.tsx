// CutPanel — the REAL cut's interaction (item 3): the cutter picks WHERE to
// split the face-down deck; the other three watch, with the actor named.
// Functional form now — item 4 restyles this into the physical deck ribbon;
// the semantics (a position in CUT_MIN..CUT_MAX submitted as a cutDeck
// action) stay identical.

import { useState } from 'react';
import type { Seat } from '../../engine/core/game';
import { CUT_MIN, CUT_MAX, DEFAULT_CUT_POSITION } from '../../engine/guandan';
import { t } from '../i18n';

export interface CutPanelProps {
  cutter: Seat;
  /** True when the viewer's active seat IS the cutter. */
  isCutter: boolean;
  nameFor: (seat: Seat) => string;
  onCut: (position: number) => void;
}

export function CutPanel({ cutter, isCutter, nameFor, onCut }: CutPanelProps) {
  const [position, setPosition] = useState(DEFAULT_CUT_POSITION);

  if (!isCutter) {
    return (
      <div className="gd-cut" role="status">
        <p className="gd-cut__title">{t('game.ceremony.title')}</p>
        <p className="gd-well__waiting">{t('game.cut.waiting', { name: nameFor(cutter) })}</p>
      </div>
    );
  }

  return (
    <div className="gd-cut">
      <p className="gd-cut__title">{t('game.ceremony.title')}</p>
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
      <p className="gd-cut__pos" aria-live="polite">
        {t('game.cut.position', { position })}
      </p>
      <button type="button" className="gd-cut__confirm" onClick={() => onCut(position)}>
        {t('game.cut.confirm')}
      </button>
    </div>
  );
}
