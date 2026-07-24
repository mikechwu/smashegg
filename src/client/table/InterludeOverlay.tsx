// InterludeOverlay — STAGE B of the end-of-hand beat (owner UX round): the
// LEVEL-UP payoff, a larger covering presentation that may sit over the table
// and hand. It advances the story the outcome (Stage A) opened — what the result
// MEANS: "us level 5 → level 7" + the A-attempt story + the next hand — and DELIBERATELY
// never restates the finishing order (each stage earns its screen time). It is
// hand-end only: at match end this stage is skipped and ResultOverlay is the
// covering payoff (GameTable). Purely presentational — GameTable owns the stage
// timer + tap-to-advance and passes onAdvance; a tap advances (never skips a
// step). REDUCED MOTION is the one combined form: `reduced` folds Stage A's
// outcome back in so a no-motion player gets one static plate (with a dismiss
// button + GameTable's safety auto-release) instead of a timed two-stage run.

import type { Seat } from '../../engine/core/game';
import { rankText, type InterludeFx } from './helpers';
import { t, type TranslationKey } from '../i18n';

export interface InterludeOverlayProps {
  interlude: InterludeFx;
  viewerTeam: 0 | 1;
  nameFor: (seat: Seat) => string;
  /** Maximum failed A-attempts (room config) — the burn line's "N left".
   *  Null = unlimited attempts, where a burn is routine and gets no line. */
  aMaxAttempts: number | null;
  /** Reduced motion: render ONE static plate (outcome + level-up) with a
   *  dismiss button, rather than the timed second stage. */
  reduced: boolean;
  /** Tap-to-advance / dismiss (GameTable maps both to advancing the stage). */
  onAdvance: () => void;
}

function placeWord(place: number): string {
  return place >= 1 && place <= 4 ? t(`game.place.${place}` as TranslationKey) : String(place);
}

function teamWord(team: 0 | 1, viewerTeam: 0 | 1): string {
  return t(team === viewerTeam ? 'game.rail.us' : 'game.rail.them');
}

export function InterludeOverlay({
  interlude,
  viewerTeam,
  nameFor,
  aMaxAttempts,
  reduced,
  onAdvance,
}: InterludeOverlayProps) {
  const isMatchEnd = interlude.matchWinner !== null;
  const r = interlude.result;
  const won = r.winnerTeam === viewerTeam;

  // One team line of the level transition: "us/them level old → new" when it
  // moved, "us/them level X" when it did not (or the before-side is unknown —
  // a mid-match join shows only the new truth).
  const levelLine = (team: 0 | 1): string => {
    const oldRank = interlude.oldLevels?.[team] ?? null;
    const newRank = interlude.newLevels[team];
    return oldRank !== null && oldRank !== newRank
      ? t('game.interlude.levelUp', {
          team: teamWord(team, viewerTeam),
          old: rankText(oldRank),
          new: rankText(newRank),
        })
      : t('game.interlude.levelSame', { team: teamWord(team, viewerTeam), rank: rankText(newRank) });
  };

  const suspendedTeam = ([0, 1] as const).find((team) => interlude.aAttemptsExhausted[team]) ?? null;

  return (
    <div
      className="gd-levelup"
      role="dialog"
      aria-label={t('game.interlude.title')}
      onClick={onAdvance}
    >
      <div className="gd-levelup__plate">
        {/* Reduced motion folds Stage A's outcome in here so a no-motion player
            still gets who-won + order; the timed flow shows those on the table. */}
        {reduced && (
          <>
            <p className={`gd-levelup__verdict${won ? ' gd-levelup__verdict--won' : ''}`}>
              {t(won ? 'game.interlude.winUs' : 'game.interlude.winThem', { n: r.levelDelta })}
            </p>
            <ol className="gd-levelup__order">
              {r.finishOrder.map((seat, i) => (
                <li key={seat} className="gd-levelup__orderLine">
                  <span className="gd-levelup__place">{placeWord(i + 1)}</span>
                  <span className="gd-levelup__name">{nameFor(seat)}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {!isMatchEnd && (
          <>
            <div className="gd-levelup__levels">
              <p className="gd-levelup__line">{levelLine(viewerTeam)}</p>
              <p className="gd-levelup__line">{levelLine((1 - viewerTeam) as 0 | 1)}</p>
              {interlude.aSuspendedTeam !== null ? (
                <p className="gd-levelup__aline gd-levelup__aline--suspended">
                  {t('game.interlude.aSuspended', {
                    team: teamWord(interlude.aSuspendedTeam, viewerTeam),
                  })}
                </p>
              ) : interlude.aBurnedTeam !== null && aMaxAttempts !== null ? (
                <p className="gd-levelup__aline">
                  {t('game.interlude.aBurned', {
                    team: teamWord(interlude.aBurnedTeam, viewerTeam),
                    left: Math.max(0, aMaxAttempts - interlude.aAttempts[interlude.aBurnedTeam]),
                  })}
                </p>
              ) : null}
            </div>

            {interlude.next !== null && (
              <p className="gd-levelup__curtain">
                {t('game.interlude.nextHand', {
                  n: interlude.next.handNo,
                  rank: rankText(interlude.next.level),
                })}
                {suspendedTeam !== null && (
                  <span className="gd-levelup__curtainNote">
                    {t('game.interlude.suspendedNote', { team: teamWord(suspendedTeam, viewerTeam) })}
                  </span>
                )}
              </p>
            )}
          </>
        )}

        {reduced ? (
          <button type="button" className="gd-interlude__dismiss" onClick={onAdvance}>
            {t('game.action.dismiss')}
          </button>
        ) : (
          <p className="gd-levelup__skip" aria-hidden="true">
            {t('game.interlude.skip')}
          </p>
        )}
      </div>
    </div>
  );
}
