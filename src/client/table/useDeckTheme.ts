// useDeckTheme — the React binding for the deck-theme preference (item 2).
// theme.ts stays React-free by design (it imports only types from 'react');
// this sibling module is the one place a component subscribes, via
// useSyncExternalStore, so setDeckTheme() drives every render site to
// re-render in place — no key changes, no remount, no lost hand-fan or
// selection state.

import { useSyncExternalStore } from 'react';
import { activeDeckTheme, subscribeDeckTheme, type DeckTheme } from './theme';

export function useDeckTheme(): DeckTheme {
  // getServerSnapshot === getSnapshot: this app has no SSR pass, but
  // react-dom/server (used by the conformance suite's renderToStaticMarkup)
  // still requires the third argument or it throws.
  return useSyncExternalStore(subscribeDeckTheme, activeDeckTheme, activeDeckTheme);
}
