// LevelRail — THE signature element (design system): a slim vertical rail
// of ranks 2..A with both teams' current levels as team-colored markers
// (viewer's team cinnabar, opponents ink-on-ivory), goldleaf ONLY on the
// hand's current level, A-attempt dots for a team standing at A, and a
// hollow marker when that team's A attempts are exhausted (suspension).
// It encodes real state — never decorative. On phones it collapses to a
// one-line strip (levels + 打幾) that expands on tap.

import { useState } from 'react';
import { RANKS, type Rank } from '../../engine/guandan/cards';
import { rankText } from './helpers';
import { t } from '../i18n';

export interface LevelRailProps {
  levels: readonly [Rank, Rank];
  aAttempts: readonly [number, number];
  aAttemptsExhausted: readonly [boolean, boolean];
  currentLevel: Rank;
  /** The viewer's team index — its marker is the cinnabar one. */
  viewerTeam: 0 | 1;
}

function TeamMarker({
  mine,
  hollow,
  label,
}: {
  mine: boolean;
  hollow: boolean;
  label: string;
}) {
  const classes = ['gd-rail__marker', mine ? 'gd-rail__marker--us' : 'gd-rail__marker--them'];
  if (hollow) classes.push('gd-rail__marker--hollow');
  return (
    <span className={classes.join(' ')} role="img" aria-label={label}>
      {mine ? t('game.rail.us') : t('game.rail.them')}
    </span>
  );
}

export function LevelRail(props: LevelRailProps) {
  const { levels, aAttempts, aAttemptsExhausted, currentLevel, viewerTeam } = props;
  const [expanded, setExpanded] = useState(false);
  const otherTeam = (1 - viewerTeam) as 0 | 1;
  const anyExhausted = aAttemptsExhausted[0] || aAttemptsExhausted[1];

  const stripText = [
    `${t('game.rail.us')} ${rankText(levels[viewerTeam])}`,
    `${t('game.rail.them')} ${rankText(levels[otherTeam])}`,
    t('game.rail.playing', { rank: rankText(currentLevel) }),
  ].join(' · ');

  // Rendered A on top, 2 at the bottom — climbing reads upward.
  const ranksTopDown = [...RANKS].reverse();

  return (
    <aside className={`gd-rail ${expanded ? 'gd-rail--expanded' : ''}`}>
      <button
        type="button"
        className="gd-rail__strip"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {stripText}
      </button>
      <div className="gd-rail__ladder" aria-label={t('game.rail.title')}>
        {ranksTopDown.map((rank) => {
          const isCurrent = rank === currentLevel;
          const teamsHere: (0 | 1)[] = [];
          if (levels[viewerTeam] === rank) teamsHere.push(viewerTeam);
          if (levels[otherTeam] === rank) teamsHere.push(otherTeam);
          return (
            <div key={rank} className={`gd-rail__row ${isCurrent ? 'gd-rail__row--current' : ''}`}>
              <span className="gd-rail__rank">{rankText(rank)}</span>
              <span className="gd-rail__markers">
                {teamsHere.map((team) => (
                  <span key={team} className="gd-rail__team">
                    <TeamMarker
                      mine={team === viewerTeam}
                      hollow={aAttemptsExhausted[team]}
                      label={
                        aAttemptsExhausted[team]
                          ? t('game.rail.suspended')
                          : team === viewerTeam
                            ? t('game.rail.us')
                            : t('game.rail.them')
                      }
                    />
                    {rank === 'A' && aAttempts[team] > 0 && (
                      <span
                        className="gd-rail__dots"
                        role="img"
                        aria-label={t('game.rail.aAttempts', { count: aAttempts[team] })}
                      >
                        {'•'.repeat(Math.min(aAttempts[team], 3))}
                      </span>
                    )}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
        {anyExhausted && <p className="gd-rail__legend">{t('game.rail.suspended')}</p>}
      </div>
    </aside>
  );
}
