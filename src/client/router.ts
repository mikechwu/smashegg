// Minimal hash router (M3 shell): three routes, no router dependency —
// '#/' home, '#/room/CODE' the room screen, '#/debug' the M0 connectivity
// demo kept reachable per the M3 task. parseHash is a pure function so the
// unit tests exercise it without a DOM.

import { useSyncExternalStore } from 'react';
import { ROOM_CODE_RE } from '../shared/protocol';

export type Route =
  | { page: 'home' }
  | { page: 'room'; code: string }
  | { page: 'debug' };

export function parseHash(hash: string): Route {
  // Normalize '#/room/abc123' → ['room', 'ABC123']: codes are shared aloud/
  // pasted, so joining must be case-insensitive (the alphabet is uppercase).
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (segments[0] === 'debug' && segments.length === 1) return { page: 'debug' };
  if (segments[0] === 'room' && segments.length === 2 && segments[1] !== undefined) {
    const code = segments[1].toUpperCase();
    if (ROOM_CODE_RE.test(code)) return { page: 'room', code };
  }
  // Anything unrecognized falls back to home — the SPA has no dead ends.
  return { page: 'home' };
}

export function roomHash(code: string): string {
  return `#/room/${code}`;
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function currentHash(): string {
  return window.location.hash;
}

/** The current route, re-rendered on every hashchange. Returns the raw hash
 *  string from the store and parses per-render: parseHash is cheap, and a
 *  string snapshot keeps useSyncExternalStore's identity check trivial. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToHash, currentHash);
  return parseHash(hash);
}
