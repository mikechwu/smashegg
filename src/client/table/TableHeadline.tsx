// TableHeadline — the ring's always-on topbar, COMPACTED (owner directive:
// the big level numeral and the heart-wild chip are gone — the two team badges
// ARE the level story now, reading "Us level 2 - Them level 2"
// (zh: with the guandan "da X" wording). What remains is what a decision needs:
//  • both teams' levels as two anchored badges (never one banner), each
//    rank in goldleaf (F7's bold move, at badge scale), with A-attempt dots
//    and the suspension state — the real level-rail state, kept;
//  • whose turn it is, IN WORDS, naming the player (F8), with the turn
//    CLOCK riding the same line — right-anchored, sharing the bar's single
//    row when it fits and wrapping under it at phone widths. The chip
//    carries the planning-window word and escalates only when it is YOUR
//    turn running short (the auto-pass moment).
// The wild is no longer stated here (owner: the heart-of-level rule is
// learned once; the wild card's own seal marks it in play — F6 superseded).
// Meaning never rides on colour alone: the turn is a sentence, suspension
// is a tag, the clock's aria states the seconds.

import { type Rank } from '../../engine/guandan/cards';
import { rankText } from './helpers';
import { t } from '../i18n';

export interface TableHeadlineProps {
  levels: readonly [Rank, Rank];
  aAttempts: readonly [number, number];
  aAttemptsExhausted: readonly [boolean, boolean];
  viewerTeam: 0 | 1;
  /** The team whose level THIS HAND is being played at — derived by
   *  helpers.playingLevelTeam against the engine's currentLevel, so an
   *  A-SUSPENDED declarer redirects the tag to the opponents' badge (their
   *  level is the live one); null before a declarer exists. Panel MED
   *  (Codex + Grok converging, twice): once team levels diverge, "Us level
   *  A · Them level 5" alone no longer says which level — and therefore
   *  which wild — is live, so the playing team's badge carries a small
   *  goldleaf-underlined "in play" tag. The compact bar stays; the
   *  attribution returns. */
  playingTeam: 0 | 1 | null;
  /** True when (one of) the viewer's held seats is an expected actor. */
  yourTurn: boolean;
  /** Name of an expected actor when it is NOT your turn; null between turns. */
  actorName: string | null;
  /** Whole seconds left on the NAMED seat's own deadline — the viewer's seat
   *  on their turn, else the actor the turn sentence names — never another
   *  timed seat's clock (concurrent per-seat budgets genuinely diverge; the
   *  panel-HIGH fix binds the number to the seat the sentence attributes it
   *  to). Null when no clock should show — no armed deadline for that seat,
   *  or GameTable's ceremony/deal/concealed-leader suppression. */
  dueSeconds: number | null;
  /** True when the running clock is the post-deal PLANNING window (M4
   *  timingClass) — the chip carries the word so a long first think never
   *  reads as a stuck turn. */
  planning: boolean;
  /** D4 (elder-visibility round): true while the LOUD play desk owns the
   *  viewer's turn sentence and clock — the headline's own-turn line then
   *  becomes a desktop-only echo (hidden under 720px by CSS), so the phone
   *  never carries two competing own-turn signals. A your-turn state with
   *  NO desk (anti-tribute decision, the ceremony cut) passes false and
   *  keeps the sentence everywhere. */
  deskOwnsTurn?: boolean;
}

function TeamBadge({
  mine,
  level,
  attempts,
  exhausted,
  playing,
}: {
  mine: boolean;
  level: Rank;
  attempts: number;
  exhausted: boolean;
  /** True when THIS team's level is the one the current hand is played at. */
  playing: boolean;
}) {
  const classes = ['gd-team', mine ? 'gd-team--us' : 'gd-team--them'];
  if (exhausted) classes.push('gd-team--suspended');
  if (playing) classes.push('gd-team--playing');
  const label = mine ? t('game.rail.us') : t('game.rail.them');
  // Composed accessible name (panel LOW, Codex): the visual spans rely on
  // flex gap, so raw text extraction reads "Uslevel2" — the aria label says
  // it with real spaces. It must carry EVERYTHING the badge shows (panel
  // round-2 LOW, Grok): an aria-label suppresses the children, so the
  // playing tag, the suspension state and the A-attempt count all join it.
  const aria = [
    label,
    t('game.rail.teamLevel'),
    rankText(level),
    playing ? t('game.rail.playingNow') : '',
    exhausted ? t('game.rail.suspended') : '',
    level === 'A' && attempts > 0 ? t('game.rail.aAttempts', { count: attempts }) : '',
  ]
    .filter((part) => part !== '')
    .join(' ');
  return (
    <span className={classes.join(' ')} aria-label={aria}>
      <span className="gd-team__label">{label}</span>
      <span className="gd-team__lvword">{t('game.rail.teamLevel')}</span>
      {/* Keyed by rank: the interlude's level-transition stage swaps the
          badge old → new, and the remount plays the .gd-team__rank change
          animation — the beat animates the durable rail itself. */}
      <span key={level} className="gd-team__rank">{rankText(level)}</span>
      {playing && <span className="gd-team__now">{t('game.rail.playingNow')}</span>}
      {level === 'A' && attempts > 0 && (
        <span className="gd-team__dots" role="img" aria-label={t('game.rail.aAttempts', { count: attempts })}>
          {'•'.repeat(Math.min(attempts, 3))}
        </span>
      )}
      {exhausted && <span className="gd-team__susp">{t('game.rail.suspended')}</span>}
    </span>
  );
}

export function TableHeadline(props: TableHeadlineProps) {
  const {
    levels,
    aAttempts,
    aAttemptsExhausted,
    viewerTeam,
    playingTeam,
    yourTurn,
    actorName,
    dueSeconds,
    planning,
    deskOwnsTurn = false,
  } = props;
  const otherTeam = (1 - viewerTeam) as 0 | 1;

  const turnText = yourTurn
    ? t('game.turn.yours')
    : actorName !== null
      ? t('game.turn.actor', { name: actorName })
      : null;

  // The clock only ever rides the turn line — a deadline with no named actor
  // (nothing to attribute the seconds to) stays silent, like the old pills.
  const clock = turnText !== null && dueSeconds !== null ? dueSeconds : null;

  return (
    <header className="gd-headline">
      <div className="gd-headline__teams">
        <TeamBadge
          mine
          level={levels[viewerTeam]}
          attempts={aAttempts[viewerTeam]}
          exhausted={aAttemptsExhausted[viewerTeam]}
          playing={playingTeam === viewerTeam}
        />
        <TeamBadge
          mine={false}
          level={levels[otherTeam]}
          attempts={aAttempts[otherTeam]}
          exhausted={aAttemptsExhausted[otherTeam]}
          playing={playingTeam === otherTeam}
        />
      </div>

      {turnText !== null && (
        <p
          className={[
            'gd-headline__turn',
            yourTurn ? 'gd-headline__turn--you' : '',
            yourTurn && deskOwnsTurn ? 'gd-headline__turn--echo' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="status"
        >
          <span className="gd-headline__turnText">{turnText}</span>
          {clock !== null && (
            <span
              className={[
                'gd-headline__clock',
                yourTurn && clock <= 10 ? 'gd-headline__clock--urgent' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={t('game.turn.countdown', { seconds: clock })}
            >
              {planning && (
                <span className="gd-headline__clockNote">{t('table.deadline.planning')}</span>
              )}
              <span className="gd-headline__clockNum">{clock}</span>
            </span>
          )}
        </p>
      )}
    </header>
  );
}
