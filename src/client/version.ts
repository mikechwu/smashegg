// Version-skew signal (M4): the client learns the server's build from
// welcome.build on every (re)connect and prompts a reload when the two
// builds provably differ. Module-level listener-set signal, same pattern as
// i18n/index.ts, so the banner survives navigating from a room back to '#/'
// and React consumes it via useSyncExternalStore. No framework imports —
// unit-testable through createVersionSignal with an arbitrary local build.

/** The bundle's own build identity: vite's `define` compiles the injected
 *  git SHA in as a literal; the typeof guard makes vitest (no define) and
 *  un-defined builds agree on the 'dev' sentinel. */
export function clientBuild(): string {
  return typeof __BUILD_VERSION__ === 'undefined' ? 'dev' : __BUILD_VERSION__;
}

export interface VersionSignal {
  /** Record the build a welcome carried; absent (old server) clears nothing
   *  and signals nothing. Notifies listeners only on actual change. */
  reportServerBuild(build: string | undefined): void;
  /** True iff both builds are known-real ('dev' on EITHER side suppresses —
   *  fail-safe silent in local dev), unequal, and not dismissed for this
   *  exact server build. Direction is deliberately ignored: during a rollout
   *  race the client can briefly be newer, and a reload is harmless. */
  updateAvailable(): boolean;
  /** 'Later': hide for the session, keyed by the offending server build —
   *  the same deploy never re-nags, a second newer deploy re-shows. */
  dismiss(): void;
  subscribe(listener: () => void): () => void;
}

export function createVersionSignal(localBuild: string): VersionSignal {
  let serverBuild: string | null = null;
  let dismissedFor: string | null = null;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    reportServerBuild(build: string | undefined): void {
      if (build === undefined || build === serverBuild) return;
      serverBuild = build;
      notify();
    },
    updateAvailable(): boolean {
      return (
        serverBuild !== null &&
        serverBuild !== 'dev' &&
        localBuild !== 'dev' &&
        serverBuild !== localBuild &&
        serverBuild !== dismissedFor
      );
    },
    dismiss(): void {
      if (serverBuild === null || dismissedFor === serverBuild) return;
      dismissedFor = serverBuild;
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app-wide instance: the store reports into it, the App shell banner
 *  subscribes to it. */
export const versionSignal = createVersionSignal(clientBuild());
