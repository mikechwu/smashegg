// InterludeOutcome — STAGE A of the end-of-hand beat (owner UX round): the
// outcome shown ON THE TABLE, adjacent to the winning play, so the player's eye
// (already on the cards it just won with) meets "these cards → so this happened"
// without hunting. Renders inside the ring's centre cell, above the held final
// play (GameTable keeps that in the well beneath). Shows ONLY what matters at
// that instant — who won + the finishing order — never the level meaning (that
// is Stage B, so the two stages never repeat each other). A light scrim keeps
// the winning cards readable underneath. Purely presentational: GameTable owns
// the stage timer + tap-to-advance and passes onAdvance.

import type { Seat } from '../../engine/core/game';
import type { InterludeFx } from './helpers';
import { t, type TranslationKey } from '../i18n';

export interface InterludeOutcomeProps {
  interlude: InterludeFx;
  viewerTeam: 0 | 1;
  nameFor: (seat: Seat) => string;
  /** Tap-to-advance to the level-up stage (whichever of tap or timer first). */
  onAdvance: () => void;
}

function placeWord(place: number): string {
  return place >= 1 && place <= 4 ? t(`game.place.${place}` as TranslationKey) : String(place);
}

export function InterludeOutcome({ interlude, viewerTeam, nameFor, onAdvance }: InterludeOutcomeProps) {
  const r = interlude.result;
  const won = r.winnerTeam === viewerTeam;
  return (
    <div
      className="gd-outcome"
      role="status"
      aria-label={t('game.interlude.title')}
      onClick={onAdvance}
    >
      <p className={`gd-outcome__verdict${won ? ' gd-outcome__verdict--won' : ''}`}>
        {t(won ? 'game.interlude.winUs' : 'game.interlude.winThem', { n: r.levelDelta })}
      </p>
      <ol className="gd-outcome__order">
        {r.finishOrder.map((seat, i) => (
          <li key={seat} className="gd-outcome__place">
            <span className="gd-outcome__rank">{placeWord(i + 1)}</span>
            <span className="gd-outcome__name">{nameFor(seat)}</span>
          </li>
        ))}
      </ol>
      <p className="gd-outcome__hint" aria-hidden="true">
        {t('game.interlude.skip')}
      </p>
    </div>
  );
}
