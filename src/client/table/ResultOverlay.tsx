// ResultOverlay — matchEnded: serif headline from the viewer's team
// perspective (勝利/敗北 — goldleaf ONLY on victory, per the design
// system's goldleaf restraint), final levels, standings, and 再來一局
// back to the home route.

import type { Seat } from '../../engine/core/game';
import type { Rank } from '../../engine/guandan/cards';
import { navigate } from '../router';
import { rankText } from './helpers';
import { t } from '../i18n';

export interface ResultOverlayProps {
  winnerTeam: 0 | 1;
  viewerTeam: 0 | 1;
  levels: readonly [Rank, Rank];
  nameFor: (seat: Seat) => string;
}

export function ResultOverlay({ winnerTeam, viewerTeam, levels, nameFor }: ResultOverlayProps) {
  const won = winnerTeam === viewerTeam;
  const winners: Seat[] = [winnerTeam, winnerTeam + 2];
  const losers: Seat[] = [1 - winnerTeam, 3 - winnerTeam];
  return (
    <div className="gd-overlay" role="dialog" aria-label={t('game.result.title')}>
      <div className="gd-result">
        <h3 className={`gd-result__headline ${won ? 'gd-result__headline--victory' : ''}`}>
          {won ? t('game.result.victory') : t('game.result.defeat')}
        </h3>
        <p>
          {t('game.result.finalLevels', {
            us: rankText(levels[viewerTeam]),
            them: rankText(levels[(1 - viewerTeam) as 0 | 1]),
          })}
        </p>
        <ol className="gd-result__standings">
          <li>{t('game.result.winners', { a: nameFor(winners[0]!), b: nameFor(winners[1]!) })}</li>
          <li>{t('game.result.runnersUp', { a: nameFor(losers[0]!), b: nameFor(losers[1]!) })}</li>
        </ol>
        <button type="button" className="gd-actions__primary" onClick={() => navigate('#/')}>
          {t('game.action.playAgain')}
        </button>
      </div>
    </div>
  );
}
