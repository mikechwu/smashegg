// TableHeadline — the ring's always-on topbar (pre-M5 Lacquer Ledger). It
// makes the three facts every decision depends on impossible to miss:
//  • the hand LEVEL the level (rank) as a large Songti numeral — the one bold move, spent
//    on the most under-served fact (F7);
//  • the WILD the wild (heart level card), stated ALWAYS, not only when you hold one (F6);
//  • whose turn it is, IN WORDS, naming the player (F8), with the turn CLOCK
//    riding the same line (owner item 6: the countdown moved OFF the seat
//    pills — timing is table-wide state, said once, where the turn already
//    is; the seat keeps only its active ring). The chip sits at the line's
//    far end (label left, number right — one scan), carries the planning-
//    window word when that is what the clock is timing, and escalates only
//    when it is YOUR turn running short (the moment you're about to be
//    auto-passed — the owner's original urgency rule, relocated intact),
// plus both teams' standings as two anchored badges (never one banner), with
// A-attempt dots and the suspension state — the real level-rail state, kept.
// Meaning never rides on colour alone: the wild carries a ♥ glyph + wild tag, the
// turn is a sentence, suspension is a tag, the clock's aria states the seconds.

import { type Rank } from '../../engine/guandan/cards';
import { rankText } from './helpers';
import { t } from '../i18n';

export interface TableHeadlineProps {
  currentLevel: Rank;
  levels: readonly [Rank, Rank];
  aAttempts: readonly [number, number];
  aAttemptsExhausted: readonly [boolean, boolean];
  viewerTeam: 0 | 1;
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
}

function TeamBadge({
  mine,
  level,
  attempts,
  exhausted,
}: {
  mine: boolean;
  level: Rank;
  attempts: number;
  exhausted: boolean;
}) {
  const classes = ['gd-team', mine ? 'gd-team--us' : 'gd-team--them'];
  if (exhausted) classes.push('gd-team--suspended');
  return (
    <span className={classes.join(' ')}>
      <span className="gd-team__label">{mine ? t('game.rail.us') : t('game.rail.them')}</span>
      <span className="gd-team__rank">{rankText(level)}</span>
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
    currentLevel,
    levels,
    aAttempts,
    aAttemptsExhausted,
    viewerTeam,
    yourTurn,
    actorName,
    dueSeconds,
    planning,
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
      <div className="gd-headline__level" aria-label={t('game.rail.playing', { rank: rankText(currentLevel) })}>
        <span className="gd-headline__pre">{t('game.level.playPrefix')}</span>
        <span className="gd-headline__rank">{rankText(currentLevel)}</span>
      </div>

      <span className="gd-headline__wild">
        <span className="gd-headline__wildSuit" aria-hidden="true">
          ♥
        </span>
        <span className="gd-headline__wildRank">{rankText(currentLevel)}</span>
        <span className="gd-headline__wildTag">{t('game.wild.tag')}</span>
      </span>

      <div className="gd-headline__teams">
        <TeamBadge
          mine
          level={levels[viewerTeam]}
          attempts={aAttempts[viewerTeam]}
          exhausted={aAttemptsExhausted[viewerTeam]}
        />
        <TeamBadge
          mine={false}
          level={levels[otherTeam]}
          attempts={aAttempts[otherTeam]}
          exhausted={aAttemptsExhausted[otherTeam]}
        />
      </div>

      {turnText !== null && (
        <p className={yourTurn ? 'gd-headline__turn gd-headline__turn--you' : 'gd-headline__turn'} role="status">
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
