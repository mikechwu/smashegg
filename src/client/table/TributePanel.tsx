// TributePanel — the table center during tribute phases: phase banner
// (tribute/return tribute), who-pays-whom arrows, committed markers, the atomic
// paid/returned reveals, and the anti-tribute reveal (both big jokers with holder
// names — a significant moment: brief cinnabar flash, deliberately NOT
// goldleaf, which is reserved for jiefeng and match victory).
//
// Double-tribute direction honesty: before the atomic reveal the payer→
// receiver pairing DOESN'T EXIST yet (staging, spec §7.3), so pre-reveal
// double tribute shows per-payer "committing" lines; once `paid` is set the
// real pairings render, and the return arrows follow them (corresponding, §7.4).

import type { Seat } from '../../engine/core/game';
import type { Card, Rank } from '../../engine/guandan/cards';
import type { GuandanView, TributePairing } from '../../engine/guandan/types';
import { CardFace } from './CardFace';
import { t } from '../i18n';

export interface TributePanelProps {
  view: GuandanView;
  nameFor: (seat: Seat) => string;
  /** Anti-tribute reveals from the event feed; null when none this hand. */
  antiReveals: readonly { seat: Seat; card: Card }[] | null;
}

function Pairings({
  pairings,
  level,
  nameFor,
  lineKey,
}: {
  pairings: readonly TributePairing[];
  level: Rank;
  nameFor: (seat: Seat) => string;
  lineKey: 'game.tribute.paidLine' | 'game.tribute.returnedLine';
}) {
  return (
    <ul className="gd-tribute__pairings">
      {pairings.map((p, i) => (
        <li key={i} className="gd-tribute__pairing">
          <span>{t(lineKey, { from: nameFor(p.from), to: nameFor(p.to) })}</span>
          <CardFace card={p.card} level={level} size="hand" />
        </li>
      ))}
    </ul>
  );
}

export function TributePanel({ view, nameFor, antiReveals }: TributePanelProps) {
  const tribute = view.tribute;

  if (antiReveals !== null) {
    return (
      <div className="gd-tribute gd-tribute--anti">
        <p className="gd-tribute__banner">{t('game.tribute.antiBanner')}</p>
        <ul className="gd-tribute__pairings">
          {antiReveals.map((r, i) => (
            <li key={i} className="gd-tribute__pairing">
              <span>{t('game.tribute.antiHolder', { name: nameFor(r.seat) })}</span>
              <CardFace card={r.card} level={view.currentLevel} size="hand" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view.phase === 'antiTributeDecision') {
    return (
      <div className="gd-tribute">
        <p className="gd-tribute__banner">{t('game.tribute.decisionBanner')}</p>
      </div>
    );
  }

  if (tribute === null) return null;
  const returning = view.phase === 'returnTribute';

  return (
    <div className="gd-tribute">
      <p className="gd-tribute__banner">
        {returning ? t('game.tribute.returnBanner') : t('game.tribute.payBanner')}
      </p>
      {!returning && (
        <ul className="gd-tribute__flows">
          {tribute.payers.map((payer) => (
            <li key={payer}>
              {tribute.kind === 'single'
                ? t('game.tribute.paysTo', {
                    from: nameFor(payer),
                    to: nameFor(tribute.receivers[0]!),
                  })
                : t('game.tribute.paysPending', { name: nameFor(payer) })}
              {tribute.committed.includes(payer) && (
                <span className="gd-tribute__committed"> {t('game.tribute.committedChip')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {returning && tribute.paid !== null && (
        <ul className="gd-tribute__flows">
          {tribute.paid.map((p) => (
            <li key={p.to}>
              {t('game.tribute.returnsTo', { from: nameFor(p.to), to: nameFor(p.from) })}
              {tribute.committed.includes(p.to) && (
                <span className="gd-tribute__committed"> {t('game.tribute.committedChip')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {tribute.ownStaged !== null && (
        <div className="gd-tribute__own">
          <span>{t('game.tribute.ownStaged')}</span>
          <CardFace card={tribute.ownStaged} level={view.currentLevel} size="hand" />
        </div>
      )}
      {tribute.paid !== null && (
        <Pairings
          pairings={tribute.paid}
          level={view.currentLevel}
          nameFor={nameFor}
          lineKey="game.tribute.paidLine"
        />
      )}
      {tribute.returned !== null && (
        <Pairings
          pairings={tribute.returned}
          level={view.currentLevel}
          nameFor={nameFor}
          lineKey="game.tribute.returnedLine"
        />
      )}
    </div>
  );
}
