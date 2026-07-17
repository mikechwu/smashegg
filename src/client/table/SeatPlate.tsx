// SeatPlate — one seat's IDENTITY-AND-STATE pill. Refinement round: the pill
// is the seat's single text surface — identity (dot, name, you/partner tag),
// the finish-place badge, the CARD COUNT chip (owner item 5: the count moved
// off the table surface into the pill, so the freed line lets the pill lap
// over the card block), and the pass/committed chips. The COUNTDOWN moved OUT
// (owner item 6): turn timing now renders once, on TableHeadline's turn line,
// never on a seat — so the pill carries no clock, no planning note.
//  • remote seat (partner / opponent): dot, name, partner tag, count chip,
//    pass/committed chips, the finish-place badge once the seat goes out.
//  • self seat (you): name + you tag; your own hand fan shows your count, so
//    no count chip here (cardCount stays undefined).
// Meaning is never colour-only: the active turn = an active ring on the plate
// PLUS the turn-in-words line (with its clock) on TableHeadline; connection =
// dot + aria label; partner = a text tag; the low-count escalation carries an
// aria wording, not just cinnabar. The active-turn ring stays on THIS pill
// (owner rule R8), never on the cards.

import type { Seat } from '../../engine/core/game';
import { handSizeTier, placeKey } from './helpers';
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
  /** Passed in the current trick. */
  passed: boolean;
  /** Committed a face-down tribute/return card this phase. */
  committed: boolean;
  /** Remote seat's remaining-card count chip. A number renders "{n} cards"
   *  with the handSizeTier escalation; null renders the "—" chip (spec §8
   *  hidden-count configs); omit (undefined) for seats that show no count —
   *  the viewer's own pill (the fan says it) and finished seats (R6). */
  cardCount?: number | null;
  /** True while the deal choreography is counting the chip up from 0 — tier
   *  escalation is suppressed (a hand mid-deal is not a low-hand alarm, and
   *  the critical tier's larger font would jitter the reserved layout). */
  dealing?: boolean;
}

export function SeatPlate(props: SeatPlateProps) {
  const { name, connected, isViewer, partner, place, active, passed, committed, cardCount, dealing } =
    props;

  const classes = ['gd-plate'];
  if (active) classes.push('gd-plate--active');
  if (isViewer) classes.push('gd-plate--viewer');
  if (partner) classes.push('gd-plate--partner');

  const badge = place !== null ? placeKey(place) : null;

  const tier = cardCount == null || dealing === true ? 'normal' : handSizeTier(cardCount);
  const countClasses = ['gd-plate__count'];
  if (tier === 'low' || tier === 'critical') countClasses.push('gd-plate__count--low');
  if (tier === 'critical') countClasses.push('gd-plate__count--critical');

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

      {(cardCount !== undefined || passed || committed) && (
        <span className="gd-plate__state">
          {cardCount === null && (
            <span
              className="gd-plate__count gd-plate__count--hidden"
              aria-label={t('game.plate.hiddenCount')}
            >
              —
            </span>
          )}
          {typeof cardCount === 'number' && (
            <span
              className={countClasses.join(' ')}
              aria-label={tier === 'critical' ? t('game.plate.cardsLow', { count: cardCount }) : undefined}
            >
              {t('game.stack.cards', { count: cardCount })}
            </span>
          )}
          {passed && <span className="gd-plate__pass">{t('game.action.pass')}</span>}
          {committed && <span className="gd-plate__pass">{t('game.tribute.committedChip')}</span>}
        </span>
      )}
    </div>
  );
}
