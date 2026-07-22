// CardFace — the card-rendering FRAMEWORK (item 5). Face/back CONTENT comes
// from the active DeckTheme; everything that encodes GAME STATE is drawn
// HERE, over the theme, so no theme has a code path to remove it:
//  • the cinnabar wild marker (a game-state indicator, never decoration)
//    — appended as a frame-level overlay AFTER the theme face;
//  • the ghost faces (the identity a wild plays as) with the same marker.
// Selection lift / tribute glow are framework CSS on the FACE inside the
// wrapping fan button (variant D hit/paint decoupling — the button's hit
// box never moves; table.css fan block), the focus ring on the button
// itself; all outside any theme. Sizes: 'hand' / 'trick' /
// 'mini' — the frame carries the size class, so the marker's --gd-cardw
// arithmetic works regardless of what the theme renders inside.

import type { ReactElement } from 'react';
import { isJoker, isWild, rankOf, suitOf, type Card, type Rank, type Suit } from '../../engine/guandan/cards';
import type { JokerRank } from '../../engine/guandan/combos';
import type { CanonicalForm } from '../../engine/guandan/types';
import { comboKey, declJokerRank, declRunText, isRedSuit, rankText } from './helpers';
import { SuitMark } from './suits';
import type { CardFaceSize } from './theme';
import { useDeckTheme } from './useDeckTheme';
import './themes/lacquer'; // registers the default theme (owner decision)
import './themes/cinnabar-court'; // registers the alternate theme (still selectable)
import { t } from '../i18n';

export type { CardFaceSize } from './theme';

export interface CardFaceProps {
  card: Card;
  /** Current level — determines the wild ribbon. */
  level: Rank;
  size: CardFaceSize;
}

/** Localized joker name (small joker/big joker, Joker/Big Joker) — level-independent
 *  (jokers are never wild), so it needs no card/level context. Factored out
 *  of {@link cardLabel} so combo labels can name a joker-keyed single/pair
 *  (bug: playing a lone BJ rendered as "single A" — the FROZEN-TYPES keyRank
 *  'A' placeholder leaking into the label instead of jokerRank, the real
 *  identity — see {@link comboRankLabel}) without needing a Card/level. */
export function jokerLabel(rank: JokerRank): string {
  return rank === 'BJ' ? t('game.card.bj') : t('game.card.sj');
}

/** Localized accessible name of a card (buttons wrapping a CardFace use
 *  this as their aria-label). */
export function cardLabel(card: Card, level: Rank): string {
  if (isJoker(card)) return jokerLabel(card);
  const base = t('game.card.label', {
    suit: t(`game.suit.${suitOf(card)!}` as const),
    rank: rankText(rankOf(card)!),
  });
  return isWild(card, level) ? `${base} (${t('game.card.wild')})` : base;
}

/** The combo label's "rank" segment: every call site that renders a decl as
 *  `${t(comboKey(decl))} ${<rank segment>}` (ActionBar's chooser + its aria
 *  label — the trick well no longer captions its own play, quiet-table
 *  round) must route the rank segment through here so a
 *  joker-keyed single/pair (decl.jokerRank set, FROZEN-TYPES NOTE in
 *  combos.ts) names the joker instead of printing the never-compared
 *  keyRank 'A' placeholder. Total over every CanonicalForm shape — the
 *  chooser never actually offers a jokerRank decl (jokers take no wild
 *  substitutions), but this still resolves correctly if one ever reached
 *  it. */
export function comboRankLabel(decl: CanonicalForm): string {
  const jokerRank = declJokerRank(decl);
  return jokerRank !== undefined ? jokerLabel(jokerRank) : rankText(decl.keyRank);
}

/** A decl's full display label as a NODE: combo name + rank segment + the
 *  straight-flush run window with its suit drawn as the shared SuitMark
 *  part (suits.tsx — never a Unicode suit character; the mark carries the
 *  localized suit name for screen readers). The desk status and the
 *  chooser's option label both render THIS, so the two never diverge; the
 *  chooser's aria string (optionAria) is the text-only parallel using the
 *  localized suit word. */
export function comboDeclNode(decl: CanonicalForm): ReactElement {
  const run = declRunText(decl);
  return (
    <>
      {t(comboKey(decl))} {comboRankLabel(decl)}
      {run !== null && (
        <>
          {' ('}
          {run}
          {decl.suit !== undefined && (
            <SuitMark suit={decl.suit} label={t(`game.suit.${decl.suit}` as const)} />
          )}
          {')'}
        </>
      )}
    </>
  );
}

/** Language-neutral wild seal (item 1): a cinnabar circle stamp with an
 *  ivory four-petal cutout and center dot — reads as a seal at any card
 *  size without translation, replacing the old localized glyph (the
 *  now-removed 'game.card.wildBadge' key). Purely decorative: the
 *  accessible wild fact is carried by cardLabel's " (Wild)" suffix (below),
 *  so the mark itself is aria-hidden. */
function WildSeal() {
  return (
    <svg className="gd-card__wild" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="var(--cinnabar)" />
      <g fill="var(--ivory)">
        <ellipse cx="12" cy="6" rx="3" ry="5" />
        <ellipse cx="18" cy="12" rx="5" ry="3" />
        <ellipse cx="12" cy="18" rx="3" ry="5" />
        <ellipse cx="6" cy="12" rx="5" ry="3" />
        <circle cx="12" cy="12" r="2" />
      </g>
    </svg>
  );
}

export function CardFace({ card, level, size }: CardFaceProps) {
  const theme = useDeckTheme();
  return (
    <span className={`gd-cardframe gd-card--${size}`} aria-hidden="true">
      <theme.Face card={card} level={level} size={size} />
      {/* The wild marker is FRAMEWORK-drawn over the theme (contract): a
          theme has no code path to remove or obscure it. */}
      {isWild(card, level) && <WildSeal />}
    </span>
  );
}

/** A face-down card in the active theme — the deck pile, deal flights, any
 *  hidden card. Framework-level like CardFace. */
export function CardBack({ size }: { size: CardFaceSize }) {
  const theme = useDeckTheme();
  return (
    <span className={`gd-cardframe gd-card--${size}`} aria-hidden="true">
      <theme.Back size={size} />
    </span>
  );
}

export interface GhostFaceProps {
  rank: Rank;
  /** null ⇒ suit-blind target: rank only, no suit glyph, ink-colored —
   *  the engine never picks a suit for it (wild-chooser-ux.md §2.5). */
  suit: Suit | null;
  size: CardFaceSize;
}

/** The identity a wild plays as (the chooser's substituted faces). Always
 *  carries the same cinnabar wild corner marker the wild's own face uses —
 *  one convention, one meaning: the wild is at work on this card (§2.3). */
export function GhostFace({ rank, suit, size }: GhostFaceProps) {
  const classes = ['gd-card', `gd-card--${size}`, 'gd-card--ghost'];
  if (suit !== null) classes.push(isRedSuit(suit) ? 'gd-card--red' : 'gd-card--black');
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      <span className="gd-card__index">
        <span className="gd-card__rank">{rankText(rank)}</span>
        {suit !== null && (
          <span className="gd-card__suit">
            <SuitMark suit={suit} />
          </span>
        )}
      </span>
      <WildSeal />
    </span>
  );
}
