// DeckTheme — the FOURTH axis of variation (item 5), following the same
// discipline as the other three (game → pluggable engine; rules → config;
// locale → i18n resources): data-driven, no hardcoding, and the ENGINE
// NEVER LEARNS IT EXISTS — card presentation is pure client rendering keyed
// on (rank, suit).
//
// Contract boundary (enforced structurally, not by convention): a theme
// provides ONLY face content, back art and metrics. Everything that encodes
// GAME STATE is drawn by the framework (CardFace/GhostFace in CardFace.tsx)
// OVER the theme's face — the cinnabar wild marker, selection lift,
// focus ring, tribute glow. Precisely what that guarantees: the REAL marker
// always renders (the framework appends it; a theme has no code path to
// omit it) and always PAINTS ON TOP (.gd-cardframe is an isolated stacking
// context with the marker on its own layer — CSS-pinned by the conformance
// suite), and a theme emitting the marker's own markup fails conformance.
// What it deliberately does NOT claim: code cannot detect a LOOKALIKE decoy
// a hostile theme paints inside its face — that is the 390px eyes-gate's
// job, like every other purely visual property. F11 (2-vs-27 legibility) is
// carried by SeatStack rendering one REAL theme Back per remaining card —
// the stack length IS the count — so it survives any back design by
// construction. TRUE-390px legibility is the hard gate a theme must pass
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
  /** Fraction of card WIDTH exposed (as a height, in --gd-cardw units) per
   *  covered card in a same-value settled-layout pile — the strip tall
   *  enough to show this theme's OWN covered-card identity mark and no more
   *  (HandFan.tsx's stackOffsetW reads this as its cap). A theme with a
   *  one-line index (lacquer) needs less height than one with a taller
   *  identity column (cinnabar-court's vertical rank+suit strip).
   *  Conformance range: [0.3, 1.0]. */
  stackStripW: number;
  /** CSS color describing this theme's back-art edge. Honest status
   *  (seat-zone round): the F11 mini-fan slivers — the last framework
   *  consumer — were replaced by real CardBack stacks (SeatStack), so no
   *  framework CSS reads this today; it stays in the metrics contract
   *  (conformance-pinned) as the declared token for any future surface that
   *  needs the back palette without rendering the Back component. */
  backEdge: string;
  /** CSS background describing this theme's back fill — same status as
   *  backEdge above: contract-retained, currently consumer-free. */
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
  /** Localized display name (the App header switcher, item 3). */
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

// In-memory override (item 2): set by setDeckTheme(), read first by
// activeDeckTheme(). Kept SEPARATE from the localStorage read below rather
// than an eagerly-initialized cache, because registration is a SIDE EFFECT
// of importing a theme module (CardFace.tsx's `import './themes/lacquer'`)
// that can run after this module's top-level code — an eager read here
// could race an empty registry. null means "no override; fall through to
// storage", so the switch still applies for the session even when
// localStorage itself is unavailable (private mode, storage quota, etc).
let overrideThemeId: string | null = null;

const listeners = new Set<() => void>();

/** The active theme: a per-client preference (same idiom as handSort),
 *  defaulting to DEFAULT_DECK_THEME_ID. Every render site goes through this
 *  (directly, or via useDeckTheme() in components — see sibling
 *  useDeckTheme.ts). */
export function activeDeckTheme(): DeckTheme {
  let id = overrideThemeId ?? DEFAULT_DECK_THEME_ID;
  if (overrideThemeId === null) {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== null && registry.has(stored)) id = stored;
      }
    } catch {
      // storage unavailable — the default carries.
    }
  }
  const theme = registry.get(id);
  if (!theme) throw new Error(`deck theme registry empty: missing '${id}'`);
  return theme;
}

/** Set the active deck-theme preference (item 2, the switcher's write
 *  side): an unregistered id is silently rejected — no crash, no persist,
 *  no notify — the same "invalid input is a no-op" idiom as setLocale.
 *  Notifies every subscriber (useDeckTheme() render sites — faces, backs,
 *  SeatStack's aspect metric) so the switch is a pure re-render everywhere
 *  at once. */
export function setDeckTheme(id: string): void {
  if (!registry.has(id)) return;
  overrideThemeId = id;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // storage unavailable — overrideThemeId still carries the switch for
    // this session, it just doesn't persist.
  }
  for (const listener of listeners) listener();
}

/** Subscribe to deck-theme preference changes. Returns an unsubscribe
 *  function — the useSyncExternalStore subscribe half (see useDeckTheme.ts,
 *  kept out of this module so theme.ts stays React-free). */
export function subscribeDeckTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
