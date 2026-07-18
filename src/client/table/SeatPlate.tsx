// SeatPlate — one seat's IDENTITY pill. Flank round (owner items 1-2): the
// pill carries identity ONLY — connection dot, name, you/partner tag, the
// finish-place badge, and the committed-tribute chip (a persistent phase
// state). Everything transient or numeric lives elsewhere, per the owner's
// top-view layout:
//  • the CARD COUNT is a standalone chip on the OTHER side of the seat's
//    cards (SeatCount, rendered by the zone) — never inside this pill;
//  • PASS is a transient fade over the cards themselves (the zone's pass
//    overlay), not a pill chip;
//  • the COUNTDOWN lives on TableHeadline's turn line (and, on your own
//    turn, above the sort pill) — the pill carries no clock.
// The pill itself sits at the seat's own RIGHT HAND (top-view physics, the
// same handedness R10 uses): north's right is the screen's left, east's is
// its strip top, west's is its strip bottom — the zone's flex direction
// places it; this component is position-agnostic.
// Meaning is never colour-only: the active turn = an active ring on the
// plate PLUS the turn-in-words line (with its clock) on TableHeadline;
// connection = dot + aria label; partner = a text tag. The active-turn ring
// stays on THIS pill (owner rule R8), never on the cards.

import type { Seat } from '../../engine/core/game';
import { placeKey } from './helpers';
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
  /** Committed a face-down tribute/return card this phase. */
  committed: boolean;
  /** Set on a HELD (multi-seat self-play) seat that is not the active view:
   *  the pill renders as a button and clicking it switches the view — the
   *  name overlay IS the seat selector (owner: the Seat 1-4 tab bar was
   *  redundant chrome and is gone). Omit everywhere else: the pill stays a
   *  plain div. */
  onSelect?: () => void;
}

export function SeatPlate(props: SeatPlateProps) {
  const { name, connected, isViewer, partner, place, active, committed, onSelect } = props;

  const classes = ['gd-plate'];
  if (active) classes.push('gd-plate--active');
  if (isViewer) classes.push('gd-plate--viewer');
  if (partner) classes.push('gd-plate--partner');
  if (onSelect !== undefined) classes.push('gd-plate--held');

  const badge = place !== null ? placeKey(place) : null;

  if (onSelect !== undefined) {
    return (
      <button
        type="button"
        className={classes.join(' ')}
        onClick={onSelect}
        aria-label={t('game.seat.switchTo', { name })}
      >
        <PlateBody {...props} badge={badge} />
      </button>
    );
  }
  return (
    <div className={classes.join(' ')}>
      <PlateBody {...props} badge={badge} />
    </div>
  );
}

/** The pill's shared innards — identical whether the shell is the plain div
 *  or the held-seat switcher button. */
function PlateBody(props: SeatPlateProps & { badge: ReturnType<typeof placeKey> | null }) {
  const { name, connected, isViewer, partner, committed, badge } = props;
  return (
    <>
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

      {committed && (
        <span className="gd-plate__state">
          <span className="gd-plate__chip">{t('game.tribute.committedChip')}</span>
        </span>
      )}
    </>
  );
}
