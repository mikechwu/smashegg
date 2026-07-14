// Serializable PRNG (xoshiro128**) — the engine's ONLY randomness source.
// The four uint32 words live inside game state S (PLAN.md §3 randomness
// idiom), so a match is a pure function of (seed, action log): dealing hand
// N+1 draws from and advances this state inside the hand-ending applyAction.
// Functions return advanced copies; nothing here mutates its input.

export interface PrngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Derive an initial state from an arbitrary seed string (FNV-1a hash
 *  stretched through splitmix32 — short/similar seeds still diverge). */
export function seedPrng(seed: string): PrngState {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const next = (): number => {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  const state = { a: next(), b: next(), c: next(), d: next() };
  // xoshiro's all-zero state is a fixed point; the hash makes it
  // astronomically unlikely, but guard anyway.
  if ((state.a | state.b | state.c | state.d) === 0) state.a = 1;
  return state;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** One xoshiro128** step: a uint32 plus the advanced state. */
export function nextU32(s: PrngState): { value: number; state: PrngState } {
  const value = Math.imul(rotl(Math.imul(s.b, 5) >>> 0, 7), 9) >>> 0;
  const t = (s.b << 9) >>> 0;
  let c = (s.c ^ s.a) >>> 0;
  let d = (s.d ^ s.b) >>> 0;
  const b = (s.b ^ c) >>> 0;
  const a = (s.a ^ d) >>> 0;
  c = (c ^ t) >>> 0;
  d = rotl(d, 11);
  return { value, state: { a, b, c, d } };
}

/** Uniform integer in [0, bound) via rejection sampling — unbiased, so
 *  replays can rely on exact draw counts only within one engine version. */
export function nextInt(s: PrngState, bound: number): { value: number; state: PrngState } {
  const limit = Math.floor(0x100000000 / bound) * bound;
  let state = s;
  for (;;) {
    const r = nextU32(state);
    state = r.state;
    if (r.value < limit) return { value: r.value % bound, state };
  }
}

/** Deterministic Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], s: PrngState): { items: T[]; state: PrngState } {
  const out = items.slice();
  let state = s;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextInt(state, i + 1);
    state = r.state;
    const t = out[i]!;
    out[i] = out[r.value]!;
    out[r.value] = t;
  }
  return { items: out, state };
}
