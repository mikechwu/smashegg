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
 *  transitions the shift, so moving the split slides it along the ribbon —
 *  the deck visibly parting into two packets.
 *
 *  Owner cut-by-hand round: the ribbon ITSELF is the control — the visible
 *  slider bar is gone. For the cutter, an INVISIBLE native range input lies
 *  over the cards (absolute, inset 0, opacity 0): a finger or mouse dragged
 *  across the deck IS the native slider drag, so the split follows the touch
 *  like really cutting a deck — while keyboard arrows, Home/End and the
 *  aria slider semantics all survive untouched (the §leak note about
 *  aria-valuenow exposing exact positions is unchanged: same input, same
 *  documented PARTIAL mitigation). Spectators get the bare ribbon. */
function CutRibbon({
  leftCount,
  value,
  onChange,
  sliderLabel,
}: {
  leftCount: number;
  /** Present only for the CUTTER — mounts the invisible drag surface. */
  value?: number;
  onChange?: (position: number) => void;
  sliderLabel?: string;
}) {
  return (
    <div
      className={`gd-cut__ribbon${value !== undefined ? ' gd-cut__ribbon--live' : ''}`}
      style={{ '--split': leftCount } as CSSProperties}
      data-split-edge={
        leftCount === 0 ? 'low' : leftCount === CUT_RIBBON_SLIVERS ? 'high' : undefined
      }
    >
      {Array.from({ length: CUT_RIBBON_SLIVERS }, (_, i) => (
        <span
          key={i}
          className="gd-cut__sliver"
          data-side={i < leftCount ? 'left' : 'right'}
          style={{ '--i': i } as CSSProperties}
          aria-hidden
        >
          <CardBack size="hand" />
        </span>
      ))}
      {value !== undefined && (
        <>
          {/* The touch affordance (panel MED, Grok; glyph refined on owner
              feedback — the chevrons rendered as a confusable diamond): a
              small goldleaf POINTING HAND on a coin badge rides the split
              itself — visible chrome saying "your finger goes here", moving
              with the cut. Inline SVG in the WildSeal idiom; decorative
              (the invisible input carries the semantics). */}
          <span className="gd-cut__handle" aria-hidden="true">
            <svg viewBox="0 0 28 28" focusable="false">
              <circle cx="14" cy="14" r="13" fill="var(--lacquer)" stroke="var(--goldleaf)" strokeWidth="1.6" />
              <g transform="translate(2,2.6)">
                <path
                  d="M10.6 4a1.7 1.7 0 0 1 3.4 0v7.2l3.9.9c1.6.4 2.7 1.8 2.7 3.4 0 .6-.1 1.2-.4 1.8l-1.2 2.6a3.4 3.4 0 0 1-3.1 2h-3.2c-1.3 0-2.6-.6-3.4-1.6l-3-3.7c-.6-.7-.5-1.8.2-2.4.7-.6 1.7-.5 2.3.2l1.8 2V4z"
                  fill="var(--goldleaf)"
                />
              </g>
            </svg>
          </span>
          <input
            className="gd-cut__slider"
            type="range"
            min={CUT_MIN}
            max={CUT_MAX}
            value={value}
            onChange={(e) => onChange?.(Number(e.target.value))}
            aria-label={sliderLabel}
          />
        </>
      )}
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
      <CutRibbon
        leftCount={cutLeftCount(position)}
        value={position}
        onChange={setPosition}
        sliderLabel={t('game.cut.sliderLabel')}
      />
      <FlipRow flips={flips} level={level} />
      <p className="gd-cut__prompt">
        {lastFlip !== null
          ? t('game.cut.flipped', { card: cardLabel(lastFlip, level) })
          : t('game.cut.prompt')}
      </p>
      <button type="button" className="gd-cut__confirm" onClick={() => onCut(position)}>
        {t('game.cut.confirm')}
      </button>
    </div>
  );
}
