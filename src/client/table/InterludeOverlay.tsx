// InterludeOverlay — the end-of-hand beat (docs/research/hand-interlude.md).
// Client-side framing over an already-committed batch: staged sub-beats in
// ONE plate over a vignette dim, the winning final play staying in the trick
// well underneath (GameTable holds it there). The overlay self-drives its
// stages on the CeremonyOverlay timer idiom and reports two things upward:
// onLevelsReached (the headline badges swap old → new levels at that stage)
// and onDone (auto completion OR the one-tap whole-beat skip — never a
// per-step skip). Reduced motion renders one static plate with a dismiss
// control (plus a 30s safety auto-release so an away player's table never
// stays curtained).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Seat } from '../../engine/core/game';
import { rankText, interludeSteps, interludeStepAt, type InterludeFx, type InterludeStepKind } from './helpers';
import { t, type TranslationKey } from '../i18n';

export interface InterludeOverlayProps {
  interlude: InterludeFx;
  viewerTeam: 0 | 1;
  nameFor: (seat: Seat) => string;
  /** Maximum failed A-attempts (room config) — the burn line's "N left".
   *  Null = unlimited attempts, where a burn is routine and gets no line. */
  aMaxAttempts: number | null;
  /** The level-transition stage began: the parent un-freezes the headline. */
  onLevelsReached: () => void;
  /** The beat finished (auto) or was skipped (one tap anywhere). */
  onDone: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const REDUCED_AUTO_RELEASE_MS = 30_000;

/** The place word for a 1-based finishing place (locale-checked keys exist
 *  for 1..4; guarded so a malformed place can never throw the overlay). */
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
  onLevelsReached,
  onDone,
}: InterludeOverlayProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  const isMatchEnd = interlude.matchWinner !== null;
  // The dwell extension must match the RENDER condition exactly (Codex audit
  // LOW): under unlimited attempts (aMaxAttempts null) the burn line is
  // suppressed, so the extra 900ms would be dead air.
  const insert =
    interlude.aSuspendedTeam !== null ||
    (interlude.aBurnedTeam !== null && aMaxAttempts !== null);
  const steps = useMemo(
    () => interludeSteps({ insert, match: isMatchEnd }),
    [insert, isMatchEnd],
  );
  // Remount catch-up (a mid-beat seat switch must not replay from the top):
  // start at the step the wall-clock stamp says we are in.
  const [stepIdx, setStepIdx] = useState(() => interludeStepAt(Date.now() - interlude.at, steps));

  // The ceremony's re-render trap: GameTable re-renders on its 500ms clock
  // tick, and fresh callback closures as effect deps would cancel every step
  // timer before it fires. Refs keep the timer chain untouchable while still
  // calling the latest callbacks.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onLevelsRef = useRef(onLevelsReached);
  onLevelsRef.current = onLevelsReached;

  useEffect(() => {
    if (reduced) {
      // Static plate: everything visible, the headline un-freezes at once.
      onLevelsRef.current();
      const timer = setTimeout(() => onDoneRef.current(), REDUCED_AUTO_RELEASE_MS);
      return () => clearTimeout(timer);
    }
    if (stepIdx >= steps.length) {
      onDoneRef.current();
      return;
    }
    const step = steps[stepIdx]!;
    if (step.kind !== 'hold' && step.kind !== 'standings') onLevelsRef.current();
    const timer = setTimeout(() => setStepIdx((i) => i + 1), step.ms);
    return () => clearTimeout(timer);
  }, [reduced, stepIdx, steps]);

  if (!reduced && stepIdx >= steps.length) return null;

  const reached = (kind: InterludeStepKind): boolean => {
    if (reduced) return steps.some((s) => s.kind === kind);
    const at = steps.findIndex((s) => s.kind === kind);
    return at !== -1 && stepIdx >= at;
  };

  const r = interlude.result;
  const won = r.winnerTeam === viewerTeam;
  const finalSeat = interlude.finalPlay?.seat ?? null;

  // One team line of the level transition: "us/them level old → new" when it
  // moved, "us/them level X" when it did not (or when the before-side is
  // unknown — a mid-match join shows only the new truth).
  const levelLine = (team: 0 | 1): string => {
    const oldRank = interlude.oldLevels?.[team] ?? null;
    const newRank = interlude.newLevels[team];
    return oldRank !== null && oldRank !== newRank
      ? t('game.interlude.levelUp', {
          team: teamWord(team, viewerTeam),
          old: rankText(oldRank),
          new: rankText(newRank),
        })
      : t('game.interlude.levelSame', {
          team: teamWord(team, viewerTeam),
          rank: rankText(newRank),
        });
  };

  const suspendedTeam = ([0, 1] as const).find((team) => interlude.aAttemptsExhausted[team]) ?? null;

  return (
    <div
      className="gd-interlude"
      role="dialog"
      aria-label={t('game.interlude.title')}
      onClick={() => onDoneRef.current()}
    >
      <div className="gd-interlude__plate">
        <h3 className="gd-interlude__title">{t('game.interlude.title')}</h3>

        {finalSeat !== null && (
          <p className="gd-interlude__line gd-interlude__final">
            {t('game.interlude.finalBy', { name: nameFor(finalSeat) })}
          </p>
        )}

        {reached('standings') && (
          <>
            <ul className="gd-interlude__order">
              {r.finishOrder.map((seat, i) => (
                <li key={seat} className="gd-interlude__orderLine">
                  <span className="gd-interlude__place">{placeWord(i + 1)}</span>
                  <span className="gd-interlude__name">{nameFor(seat)}</span>
                </li>
              ))}
            </ul>
            <p className={`gd-interlude__verdict${won ? ' gd-interlude__verdict--won' : ''}`}>
              {t(won ? 'game.interlude.winUs' : 'game.interlude.winThem', { n: r.levelDelta })}
            </p>
          </>
        )}

        {!isMatchEnd && reached('levels') && (
          <div className="gd-interlude__levels">
            <p className="gd-interlude__line">{levelLine(viewerTeam)}</p>
            <p className="gd-interlude__line">{levelLine((1 - viewerTeam) as 0 | 1)}</p>
            {interlude.aSuspendedTeam !== null ? (
              <p className="gd-interlude__aline gd-interlude__aline--suspended">
                {t('game.interlude.aSuspended', {
                  team: teamWord(interlude.aSuspendedTeam, viewerTeam),
                })}
              </p>
            ) : interlude.aBurnedTeam !== null && aMaxAttempts !== null ? (
              <p className="gd-interlude__aline">
                {t('game.interlude.aBurned', {
                  team: teamWord(interlude.aBurnedTeam, viewerTeam),
                  left: Math.max(0, aMaxAttempts - interlude.aAttempts[interlude.aBurnedTeam]),
                })}
              </p>
            ) : null}
          </div>
        )}

        {!isMatchEnd && reached('curtain') && interlude.next !== null && (
          <p className="gd-interlude__curtain">
            {t('game.interlude.nextHand', {
              n: interlude.next.handNo,
              rank: rankText(interlude.next.level),
            })}
            {suspendedTeam !== null && (
              <span className="gd-interlude__curtainNote">
                {t('game.interlude.suspendedNote', { team: teamWord(suspendedTeam, viewerTeam) })}
              </span>
            )}
          </p>
        )}

        {isMatchEnd && reached('matchline') && (
          <p className="gd-interlude__match">
            {t(
              interlude.matchWinner === viewerTeam
                ? 'game.interlude.matchWinUs'
                : 'game.interlude.matchWinThem',
            )}
          </p>
        )}

        {reduced ? (
          <button type="button" className="gd-interlude__dismiss" onClick={() => onDoneRef.current()}>
            {t('game.action.dismiss')}
          </button>
        ) : (
          <p className="gd-interlude__skip" aria-hidden="true">
            {t('game.interlude.skip')}
          </p>
        )}
      </div>
    </div>
  );
}
