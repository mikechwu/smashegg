// DeckTheme — the FOURTH axis of variation (item 5), following the same
// discipline as the other three (game → pluggable engine; rules → config;
// locale → i18n resources): data-driven, no hardcoding, and the ENGINE
// NEVER LEARNS IT EXISTS — card presentation is pure client rendering keyed
// on (rank, suit).
//
// Contract boundary (enforced structurally, not by convention): a theme
// provides ONLY face content, back art and metrics. Everything that encodes
// GAME STATE is drawn by the framework (CardFace/GhostFace in CardFace.tsx)
// OVER the theme's face — the 配 cinnabar wild marker, selection lift,
// focus ring, tribute glow. Precisely what that guarantees: the REAL marker
// always renders (the framework appends it; a theme has no code path to
// omit it) and always PAINTS ON TOP (.gd-cardframe is an isolated stacking
// context with the marker on its own layer — CSS-pinned by the conformance
// suite), and a theme emitting the marker's own markup fails conformance.
// What it deliberately does NOT claim: code cannot detect a LOOKALIKE decoy
// a hostile theme paints inside its face — that is the 390px eyes-gate's
// job, like every other purely visual property. The F11 value-dependent mini-fan reads the
// theme's back tokens from metrics, so 2-vs-27 legibility survives any
// back design. TRUE-390px legibility is the hard gate a theme must pass
// visually before shipping (conformance suite covers the code-checkable
// half; the eyes-gate covers the rest — a theme that fails it does not
// ship).

import type { ComponentType } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import type { TranslationKey } from '../i18n';

export type CardFaceSize = 'hand' | 'trick' | 'mini';

export interface DeckThemeMetrics {
  /** Card height/width ratio (1.45 today). Dependent layout math (fan
   *  overlap, chooser 390px arithmetic) reads THIS, never a hardcoded
   *  number. Conformance range: [1.3, 1.6]. */
  aspect: number;
  /** The corner-index legibility floor (px) this theme claims at its
   *  smallest shipped size. Conformance: ≥ 10. */
  cornerIndexMinPx: number;
  /** CSS color for the F11 mini-fan sliver edges. */
  backEdge: string;
  /** CSS background for mini-fan slivers and back fills. */
  backGradient: string;
}

export interface DeckThemeFaceProps {
  card: Card;
  /** Current level — a theme may style the level rank, but the WILD MARKER
   *  itself is framework-drawn and outside the theme's reach. */
  level: Rank;
  size: CardFaceSize;
}

export interface DeckTheme {
  id: string;
  /** Localized display name (for the future settings toggle). */
  name: TranslationKey;
  /** Face CONTENT only — rank/suit/joker identity at a size. */
  Face: ComponentType<DeckThemeFaceProps>;
  /** Back art (the deck pile, deal flights, any face-down card). */
  Back: ComponentType<{ size: CardFaceSize }>;
  metrics: DeckThemeMetrics;
}

// --- registry ---------------------------------------------------------------

const registry = new Map<string, DeckTheme>();

export function registerDeckTheme(theme: DeckTheme): void {
  registry.set(theme.id, theme);
}

export function deckThemes(): DeckTheme[] {
  return [...registry.values()];
}

export const DEFAULT_DECK_THEME_ID = 'lacquer';
const THEME_STORAGE_KEY = 'pref:deckTheme';

/** The active theme: a per-client preference (same idiom as handSort),
 *  defaulting to lacquer. The SELECTION UI ships later (owner: framework
 *  now, not a deck library) — until then this only ever resolves the
 *  default, but every render site already goes through it. */
export function activeDeckTheme(): DeckTheme {
  let id = DEFAULT_DECK_THEME_ID;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored !== null && registry.has(stored)) id = stored;
    }
  } catch {
    // storage unavailable — the default carries.
  }
  const theme = registry.get(id);
  if (!theme) throw new Error(`deck theme registry empty: missing '${id}'`);
  return theme;
}
