// TrickWell — the table center during play: the current top play (cards +
// localized combo name + seat), a subtle sweep on trickWon, and the 接風
// goldleaf moment (banner from finisher to leader). Pass state renders on
// the seat plates; the well stays quiet (design-system restraint).

import type { Seat } from '../../engine/core/game';
import type { Rank } from '../../engine/guandan/cards';
import type { TrickState } from '../../engine/guandan/types';
import { CardFace, comboRankLabel } from './CardFace';
import { comboKey } from './helpers';
import { t } from '../i18n';

export interface TrickWellProps {
  trick: TrickState | null;
  level: Rank;
  nameFor: (seat: Seat) => string;
  /** Bumped by each trickWon event — keys the sweep animation. */
  sweepKey: number;
  /** Set while a 接風 is pending/being granted. */
  jiefeng: { finisher: Seat; leader: Seat } | null;
}

export function TrickWell({ trick, level, nameFor, sweepKey, jiefeng }: TrickWellProps) {
  const top = trick?.top ?? null;
  return (
    <div className="gd-well" key={sweepKey}>
      {jiefeng !== null && (
        <p className="gd-well__jiefeng">
          {t('game.trick.jiefeng', {
            finisher: nameFor(jiefeng.finisher),
            leader: nameFor(jiefeng.leader),
          })}
        </p>
      )}
      {top === null ? (
        trick !== null && (
          <p className="gd-well__waiting">{t('game.trick.waitingLead', { name: nameFor(trick.toAct) })}</p>
        )
      ) : (
        <div className="gd-well__top">
          <div className="gd-well__cards">
            {top.cards.map((card, i) => (
              <CardFace key={i} card={card} level={level} size="trick" />
            ))}
          </div>
          <p className="gd-well__meta">
            {nameFor(top.seat)} · {t(comboKey(top.decl))} {comboRankLabel(top.decl)}
          </p>
        </div>
      )}
    </div>
  );
}
