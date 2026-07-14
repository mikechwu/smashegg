// Compile-time global injected by vite.config.ts's `define` (M4 version-skew
// signal). Only version.ts may read it, through its typeof-guarded accessor —
// under vitest (no define) the global simply doesn't exist.
declare const __BUILD_VERSION__: string;
