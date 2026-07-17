// TrickWell — the table center during play: ONLY the current top play's
// cards, at hand size (owner "quiet table" round). The combo-name meta line,
// the waiting/lead prompt, and the jiefeng goldleaf banner all duplicated a
// signal the log or the turn indicators already carry — the log's
// feed.played line names the combo, the headline's turn sentence plus the
// active seat plate's ring/timer name whose turn it is, and the log's
// upgraded feed.jiefeng line now carries the full jiefeng sentence — so none
// of the three render here anymore. The sweep animation on trickWon and the
// empty-well state are the only "table talk" left.

import type { Rank } from '../../engine/guandan/cards';
import type { TrickState } from '../../engine/guandan/types';
import { CardFace } from './CardFace';

export interface TrickWellProps {
  trick: TrickState | null;
  level: Rank;
  /** Bumped by each trickWon event — keys the sweep animation. */
  sweepKey: number;
}

export function TrickWell({ trick, level, sweepKey }: TrickWellProps) {
  const top = trick?.top ?? null;
  return (
    <div className="gd-well" key={sweepKey}>
      {top !== null && (
        <div className="gd-well__cards">
          {top.cards.map((card, i) => (
            <CardFace key={i} card={card} level={level} size="hand" />
          ))}
        </div>
      )}
    </div>
  );
}
