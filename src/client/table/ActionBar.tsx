// ActionBar — the acting seat's controls. 出牌 is enabled iff the current
// selection matches some play hint (matchSelection, unit-tested); when the
// same selection admits several declared forms (the wild-ambiguity case) a
// small chooser lists each decl as localized combo name + key rank. 過
// renders only when a pass hint exists. Tribute phases collapse to a single
// confirm (貢牌/還貢) over the glowing eligible card. Rejections surface as
// a dismissible toast, localized by error code.

import type { GuandanAction } from '../../engine/guandan/types';
import type { Rank } from '../../engine/guandan/cards';
import { comboKey, rankText, type PlayMatch } from './helpers';
import { t } from '../i18n';

export interface ActionBarProps {
  /** null = this seat is not an expected actor right now. */
  hints: readonly GuandanAction[] | null;
  phase: string;
  /** Distinct decl interpretations of the current selection. */
  matches: readonly PlayMatch[];
  passAvailable: boolean;
  /** Tribute confirm: which action the single selected eligible card maps
   *  to, or null when the selection doesn't qualify. */
  tributeAction: Extract<GuandanAction, { type: 'payTribute' | 'returnTribute' }> | null;
  tributePhase: 'payTribute' | 'returnTribute' | null;
  chooserOpen: boolean;
  onPlay: (match: PlayMatch) => void;
  onOpenChooser: () => void;
  onCloseChooser: () => void;
  onPass: () => void;
  onTribute: () => void;
  onAntiDecision: (invoke: boolean) => void;
}

export function ActionBar(props: ActionBarProps) {
  const { hints, phase, matches, passAvailable, tributeAction, tributePhase, chooserOpen } = props;
  if (hints === null) return null;

  if (phase === 'antiTributeDecision') {
    return (
      <div className="gd-actions">
        <button type="button" className="gd-actions__primary" onClick={() => props.onAntiDecision(true)}>
          {t('game.action.antiInvoke')}
        </button>
        <button type="button" onClick={() => props.onAntiDecision(false)}>
          {t('game.action.antiDecline')}
        </button>
      </div>
    );
  }

  if (tributePhase !== null) {
    return (
      <div className="gd-actions">
        <p className="gd-actions__hint">{t('game.tribute.selectHint')}</p>
        <button
          type="button"
          className="gd-actions__primary"
          disabled={tributeAction === null}
          onClick={props.onTribute}
        >
          {tributePhase === 'payTribute' ? t('game.action.payTribute') : t('game.action.returnTribute')}
        </button>
      </div>
    );
  }

  // Playing phase.
  return (
    <div className="gd-actions">
      <button
        type="button"
        className="gd-actions__primary"
        disabled={matches.length === 0}
        onClick={() => {
          if (matches.length === 1) props.onPlay(matches[0]!);
          else if (matches.length > 1) props.onOpenChooser();
        }}
      >
        {t('game.action.play')}
      </button>
      {passAvailable && (
        <button type="button" onClick={props.onPass}>
          {t('game.action.pass')}
        </button>
      )}
      {chooserOpen && matches.length > 1 && (
        <div className="gd-chooser" role="dialog" aria-label={t('game.chooser.title')}>
          <p className="gd-chooser__title">{t('game.chooser.title')}</p>
          {matches.map((match, i) => (
            <button key={i} type="button" onClick={() => props.onPlay(match)}>
              {t(comboKey(match.decl))} {rankText(match.decl.keyRank as Rank)}
            </button>
          ))}
          <button type="button" onClick={props.onCloseChooser}>
            {t('game.chooser.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
