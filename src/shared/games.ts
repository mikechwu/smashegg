// The game registry (PLAN.md §2 dependency rule): the server (and any
// other platform code) looks games up here, and NEVER imports a specific
// game's module directly. This file itself imports only from
// src/engine/**, so it is safe for src/server and src/client to depend on
// without pulling in game-specific types.

import type { GameDefinition } from '../engine/core/game';
import { GuandanGame } from '../engine/guandan';
import { GuessNumberGame } from '../engine/guess-number';

/**
 * The ONE deliberate type-erasure point in the codebase. `GameDefinition`
 * is generic over a game's concrete state/action/event/view/config types
 * (S, A, E, V, C), but the registry has to hold many different games
 * side by side behind one type, so those five type parameters are erased
 * to `any` here. This is intentional and safe: the room layer only ever
 * calls the game-agnostic methods of `GameDefinition` (init/applyAction/
 * playerView/etc.) and treats S/A/E/V/C as opaque JSON — it never needs to
 * know what they actually are. Each game's own module (and its test suite)
 * carries the real, non-erased generic types; this file is not where
 * type safety for a game's rules lives.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any, any, any>;

export const GAME_REGISTRY: Record<string, AnyGameDefinition> = {
  'guess-number': GuessNumberGame,
  // Registered at M3 (PLAN §9): the room layer reaches guandan ONLY through
  // this registry — game-room.ts stays guandan-agnostic by construction.
  guandan: GuandanGame,
};

export function getGame(gameId: string): AnyGameDefinition | null {
  return GAME_REGISTRY[gameId] ?? null;
}
