// SeatPlate — one seat on the ring (pre-M5 Lacquer Ledger restyle). Two reads:
//  • remote seat (partner / opponent): name, a VALUE-DEPENDENT mini card-back
//    fan whose width tracks the remaining count (2 cards must LOOK different
//    from 27 — the structural fix for 報牌 / F11), the count numeral escalating
//    at the ≤10 alert line, the active-turn ring + clock, connection, and the
//    partner tag (a non-colour team cue, F5).
//  • self seat (you): name + you tag + the active-turn ring/clock; your own
//    hand fan shows your count, so no mini-fan here.
// Meaning is never colour-only: turn = ring + label, connection = dot + label,
// partner = a text tag, count = a length + a numeral.

import type { Seat } from '../../engine/core/game';
import { placeKey, remainingSeconds } from './helpers';
import { t } from '../i18n';

/** ≤ this many cards is the rule-defined 報牌 alert line — the numeral
 *  escalates here, sharper again at 1–2 (docs/research digest). */
const ALERT_AT = 10;
/** Mini-fan sliver cap: 2..27 must read differently, but the fan needn't grow
 *  past a phone-friendly width — the numeral carries the exact count above the
 *  cap, and every count in the danger zone (≤ cap) shows its true width. Kept
 *  modest so a full fan + a 2-digit count still fits the compact side plate. */
const FAN_CAP = 12;

export interface SeatPlateProps {
  seat: Seat;
  name: string;
  connected: boolean;
  isViewer: boolean;
  /** True when this seat is the viewer's partner (across the ring) — a text
   *  tag, so partnership never rides on position or colour alone (F5). */
  partner: boolean;
  /** null = hidden from this viewer (spec §8 card-count visibility). */
  cardCount: number | null;
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

/** A value-dependent mini card-back fan: N overlapping slivers, N tracking the
 *  remaining count (capped). Decorative — the numeral beside it is the
 *  accessible source of the exact number. */
function MiniFan({ count }: { count: number }) {
  const slivers = Math.max(1, Math.min(count, FAN_CAP));
  return (
    <span className="gd-plate__fan" aria-hidden="true">
      {Array.from({ length: slivers }, (_, i) => (
        <span key={i} className="gd-plate__fanCard" />
      ))}
    </span>
  );
}

export function SeatPlate(props: SeatPlateProps) {
  const {
    name,
    connected,
    isViewer,
    partner,
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
  if (partner) classes.push('gd-plate--partner');

  const badge = place !== null ? placeKey(place) : null;
  const seconds = active && dueAt !== null ? remainingSeconds(dueAt, now) : null;
  // A count is shown only for a remote seat that still holds cards (no finish
  // badge) and whose count is visible; your own hand carries your count.
  const showCount = !isViewer && badge === null && cardCount !== null;
  const low = cardCount !== null && cardCount <= ALERT_AT;
  const critical = cardCount !== null && cardCount <= 2;

  const countClasses = ['gd-plate__count'];
  if (low) countClasses.push('gd-plate__count--low');
  if (critical) countClasses.push('gd-plate__count--critical');

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

      {showCount && (
        <span className="gd-plate__hand">
          <MiniFan count={cardCount} />
          <span
            className={countClasses.join(' ')}
            aria-label={
              critical
                ? t('game.plate.cardsLow', { count: cardCount })
                : t('game.plate.cards', { count: cardCount })
            }
          >
            {cardCount}
          </span>
        </span>
      )}
      {badge !== null && <span className="gd-plate__badge">{t(badge)}</span>}
      {!isViewer && cardCount === null && badge === null && (
        <span className="gd-plate__count gd-plate__count--hidden" aria-label={t('game.plate.hiddenCount')}>
          —
        </span>
      )}

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
