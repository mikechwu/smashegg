// CutPanel — the REAL cut's interaction: the cutter drags a slider spread to
// the SAME width as the face-down deck ribbon above it, and the deck
// genuinely splits into two packets at the chosen point, live as the slider
// moves. The other three watch, with the actor named.
//
// Re-cut round (owner rule): an applied cut whose count-card flip is
// uncountable (a joker or the WILD — the heart level card only) shows the flipped card IN
// THIS PANEL and the cutter cuts again, with a fresh clock; the flip history
// arrives via view.ceremonyFlips (public — the table watched each one).
//
// No numeric index is shown VISUALLY — cutting has no numeric analogue at a
// physical table, and the number would make residue-class counting trivial
// (see the engine's conditional-uniformity test). Stated honestly: this
// mitigation is PARTIAL — a native range input still exposes exact positions
// through the keyboard (Home/End anchor, arrows step by 1) and through
// assistive tech (aria-valuenow), and cutPosition is public in the post-cut
// payload anyway. For a family game that is documented, not policed (owner
// decision) — but anyone adding a numeric readout, or replacing the slider
// with stepping buttons, makes the residue edge trivially reachable and
// should re-read that test first. The 24-sliver ribbon is deliberately
// coarser than the 97 positions, so the SPLIT cannot be counted by eye.
// The semantics are unchanged: a position in CUT_MIN..CUT_MAX submitted as
// a cutDeck action.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Seat } from '../../engine/core/game';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CUT_MIN, CUT_MAX, DEFAULT_CUT_POSITION } from '../../engine/guandan';
import { CardBack, CardFace, cardLabel } from './CardFace';
import { CUT_RIBBON_SLIVERS, cutLeftCount } from './cut';
import { t } from '../i18n';

export interface CutPanelProps {
  cutter: Seat;
  /** True when the viewer's active seat IS the cutter. */
  isCutter: boolean;
  /** Public flip history across cut attempts (view.ceremonyFlips): nonempty
   *  exactly when previous cuts flipped uncountable cards. */
  flips: readonly Card[];
  level: Rank;
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
          <CardBack size="hand" />
        </span>
      ))}
    </div>
  );
}

/** ONLY the latest uncountable flip, shown in the SAME panel so the re-cut
 *  reads as one continuous ritual (owner: never a growing history — earlier
 *  attempts' cards are already gone from the table's attention). */
function FlipRow({ flips, level }: { flips: readonly Card[]; level: Rank }) {
  const last = flips.length > 0 ? flips[flips.length - 1]! : null;
  if (last === null) return null;
  return (
    <div className="gd-cut__flips">
      <span className="gd-cut__flip" role="img" aria-label={cardLabel(last, level)}>
        <CardFace card={last} level={level} size="hand" />
      </span>
    </div>
  );
}

export function CutPanel({ cutter, isCutter, flips, level, nameFor, onCut }: CutPanelProps) {
  const [position, setPosition] = useState(DEFAULT_CUT_POSITION);
  const lastFlip = flips.length > 0 ? flips[flips.length - 1]! : null;

  if (!isCutter) {
    return (
      <div className="gd-cut" role="status">
        <p className="gd-cut__title">{t('game.ceremony.title')}</p>
        <CutRibbon leftCount={CUT_RIBBON_SLIVERS} />
        <FlipRow flips={flips} level={level} />
        <p className="gd-well__waiting">
          {lastFlip !== null
            ? t('game.cut.flippedWaiting', { name: nameFor(cutter) })
            : t('game.cut.waiting', { name: nameFor(cutter) })}
        </p>
      </div>
    );
  }

  return (
    <div className="gd-cut">
      <p className="gd-cut__title">{t('game.ceremony.title')}</p>
      <CutRibbon leftCount={cutLeftCount(position)} />
      <FlipRow flips={flips} level={level} />
      <p className="gd-cut__prompt">
        {lastFlip !== null
          ? t('game.cut.flipped', { card: cardLabel(lastFlip, level) })
          : t('game.cut.prompt')}
      </p>
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
