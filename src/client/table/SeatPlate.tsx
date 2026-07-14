// SeatPlate — one player's rosewood plate: name, presence dot, card count
// (null = hidden per cardCountVisibility), finish-place badge, the
// active-turn cinnabar ring and (when the deadlines broadcast has this
// seat) a countdown ring with monospace seconds. No deadline → no ring.

import type { Seat } from '../../engine/core/game';
import { placeKey, remainingSeconds } from './helpers';
import { t } from '../i18n';

export interface SeatPlateProps {
  seat: Seat;
  name: string;
  connected: boolean;
  isViewer: boolean;
  /** null = hidden from this viewer (spec §8 card-count visibility). */
  cardCount: number | null;
  /** 1-based finish place, or null while still holding cards. */
  place: number | null;
  active: boolean;
  /** Server-clock deadline (epoch ms) or null; `now` drives the countdown. */
  dueAt: number | null;
  /** True when the deadline was armed as a 'planning' window (M4
   *  WireDeadline.timingClass) — a small label distinguishes it from an
   *  ordinary turn countdown. */
  planning: boolean;
  /** De-emphasize the countdown (e.g. while the ceremony overlay is up —
   *  the window absorbs the ceremony, room-timing.md §4). Cosmetic only. */
  dimTimer: boolean;
  now: number;
  /** Passed in the current trick. */
  passed: boolean;
  /** Committed a face-down tribute/return card this phase. */
  committed: boolean;
}

export function SeatPlate(props: SeatPlateProps) {
  const {
    name,
    connected,
    isViewer,
    cardCount,
    place,
    active,
    dueAt,
    planning,
    dimTimer,
    now,
    passed,
    committed,
  } = props;
  const classes = ['gd-plate'];
  if (active) classes.push('gd-plate--active');
  if (isViewer) classes.push('gd-plate--viewer');
  const badge = place !== null ? placeKey(place) : null;
  const seconds = active && dueAt !== null ? remainingSeconds(dueAt, now) : null;

  return (
    <div className={classes.join(' ')}>
      <span
        className={`gd-plate__dot ${connected ? 'gd-plate__dot--on' : 'gd-plate__dot--off'}`}
        role="img"
        aria-label={connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')}
      />
      <span className="gd-plate__name">
        {name}
        {isViewer && <span className="gd-plate__you"> {t('game.seat.you')}</span>}
      </span>
      {badge !== null && <span className="gd-plate__badge">{t(badge)}</span>}
      {badge === null &&
        (cardCount !== null ? (
          <span className="gd-plate__count" aria-label={t('game.plate.cards', { count: cardCount })}>
            {cardCount}
          </span>
        ) : (
          <span className="gd-plate__count gd-plate__count--hidden" aria-label={t('game.plate.hiddenCount')}>
            —
          </span>
        ))}
      {passed && <span className="gd-plate__pass">{t('game.action.pass')}</span>}
      {committed && <span className="gd-plate__pass">{t('game.tribute.committedChip')}</span>}
      {seconds !== null && planning && (
        <span className={dimTimer ? 'gd-plate__timerNote gd-plate__timerNote--dim' : 'gd-plate__timerNote'}>
          {t('table.deadline.planning')}
        </span>
      )}
      {seconds !== null && (
        <span
          className={dimTimer ? 'gd-plate__timer gd-plate__timer--dim' : 'gd-plate__timer'}
          aria-label={t('game.turn.countdown', { seconds })}
        >
          {seconds}
        </span>
      )}
    </div>
  );
}
