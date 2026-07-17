// SeatPlate — one seat's IDENTITY-AND-STATE pill (seat-zone round: the pill
// wraps ONLY identity and state; a remote seat's card backs and count now
// live OUTSIDE it, as siblings inside the .gd-seatzone container — see
// SeatStack.tsx). Two reads:
//  • remote seat (partner / opponent): connection dot, name, the partner tag
//    (a non-colour team cue, F5), pass/committed chips, the planning note,
//    the countdown, and the finish-place badge once the seat goes out.
//  • self seat (you): name + you tag + the active-turn ring/clock; your own
//    hand fan shows your count, so nothing card-shaped here either.
// Meaning is never colour-only: the active turn = an active ring on the plate
// PLUS the turn-in-words line on TableHeadline (the plate itself carries no
// turn label); connection = dot + aria label; partner = a text tag. The
// active-turn ring stays on THIS pill (owner rule R8), never on the cards.

import type { Seat } from '../../engine/core/game';
import { placeKey, remainingSeconds } from './helpers';
import { t } from '../i18n';

export interface SeatPlateProps {
  seat: Seat;
  name: string;
  connected: boolean;
  isViewer: boolean;
  /** True when this seat is the viewer's partner (across the ring) — a text
   *  tag, so partnership never rides on position or colour alone (F5). */
  partner: boolean;
  /** 1-based finish place, or null while still holding cards. */
  place: number | null;
  active: boolean;
  /** Server-clock deadline (epoch ms) or null; `now` drives the countdown. */
  dueAt: number | null;
  /** True when the deadline was armed as a 'planning' window (M4). */
  planning: boolean;
  /** De-emphasize the countdown (e.g. while the ceremony overlay is up). */
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
    partner,
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
  if (partner) classes.push('gd-plate--partner');

  const badge = place !== null ? placeKey(place) : null;
  const seconds = active && dueAt !== null ? remainingSeconds(dueAt, now) : null;

  return (
    <div className={classes.join(' ')}>
      <span className="gd-plate__head">
        <span
          className={`gd-plate__dot ${connected ? 'gd-plate__dot--on' : 'gd-plate__dot--off'}`}
          role="img"
          aria-label={connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')}
        />
        <span className="gd-plate__name">{name}</span>
        {isViewer && <span className="gd-plate__tag gd-plate__tag--you">{t('game.seat.you')}</span>}
        {partner && !isViewer && (
          <span className="gd-plate__tag gd-plate__tag--partner">{t('game.seat.partner')}</span>
        )}
      </span>

      {badge !== null && <span className="gd-plate__badge">{t(badge)}</span>}

      <span className="gd-plate__state">
        {passed && <span className="gd-plate__pass">{t('game.action.pass')}</span>}
        {committed && <span className="gd-plate__pass">{t('game.tribute.committedChip')}</span>}
        {seconds !== null && planning && connected && (
          <span className={dimTimer ? 'gd-plate__timerNote gd-plate__timerNote--dim' : 'gd-plate__timerNote'}>
            {t('table.deadline.planning')}
          </span>
        )}
        {seconds !== null && (
          <span
            className={[
              'gd-plate__timer',
              dimTimer ? 'gd-plate__timer--dim' : '',
              // Escalate the clock on YOUR OWN seat when time is short (owner
              // decision): the moment you're about to be auto-passed.
              isViewer && seconds <= 10 && !dimTimer ? 'gd-plate__timer--urgent' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={t('game.turn.countdown', { seconds })}
          >
            {seconds}
          </span>
        )}
      </span>
    </div>
  );
}
