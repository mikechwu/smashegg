// Worker entry (PLAN.md §1.2, §4). Stateless: route, validate room-code
// shape, dispatch to the GameRoom Durable Object by name, forward its
// response. All game/room authority lives in the DO, never here.

import type { HealthResponse } from "../shared/protocol";
import { getGame } from "../shared/games";
import { roomCodeFromBytes } from "./room-helpers";

// The DO class must be exported from the Worker entrypoint so the runtime
// can bind the wrangler.jsonc migration ("new_sqlite_classes") to it.
export { GameRoom } from "./game-room";

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** 'dev' (via .dev.vars) opens the room-dump route unconditionally;
   *  'production' (wrangler.jsonc vars) gates it behind DEBUG_DUMP_TOKEN
   *  (PLAN.md §6). */
  ENVIRONMENT?: string;
  /** Optional secret: when set, GET .../dump is allowed iff the request
   *  presents it in the 'x-debug-dump-token' header (PLAN.md §6). */
  DEBUG_DUMP_TOKEN?: string;
  /** Build identity (M4 version-skew signal): the git SHA injected at
   *  deploy time via `--var BUILD_VERSION:...`; absent under plain
   *  `wrangler dev`, where every consumer falls back to 'dev'. */
  BUILD_VERSION?: string;
  /** TEST ONLY (pause-and-retention.md §7): shrinks the retention window to N ms
   *  so the e2e can drive a real self-purge without waiting 48h. Never set in
   *  production (`--var RETENTION_TEST_WINDOW_MS:...` only in the retention e2e). */
  RETENTION_TEST_WINDOW_MS?: string;
  /** Q4 (free-tier-efficiency.md): native Workers rate limiter over POST
   *  /api/rooms. OPTIONAL — absent under `wrangler dev` and degrades to no-limit,
   *  so the app never depends on it (and a paid-gating deploy failure is the only
   *  signal it's unavailable). */
  CREATE_LIMITER?: RateLimiter;
}

/** The `ratelimits` binding surface we use (Workers runtime). Minimal by hand so
 *  we don't depend on a specific @cloudflare/workers-types version. */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// 6-char unambiguous room-code alphabet (no 0/O/1/I) — PLAN.md §8.
const ROOM_PATH = /^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(\/.*)?$/;

/** ~1 billion codes (32^6); collisions are near-impossible but the DO
 *  answers 409 on one, so a handful of retries makes creation robust. */
const CREATE_ATTEMPTS = 5;

function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return roomCodeFromBytes(bytes);
}

/** POST /api/rooms {gameId, config, timing?} → {code}. Validates the gameId
 *  against the registry; config is OPAQUE game-defined data, forwarded
 *  untouched (PLAN.md §4 lobby phase); timing is forwarded as-is and
 *  validated authoritatively in the DO (absent = the standard preset). */
async function handleCreateRoom(request: Request, env: Env, origin: string): Promise<Response> {
  // Q4: rate-limit creates per client IP — defense-in-depth against an accidental
  // retry loop spinning up thousands of lobby DOs (the UI already debounces the
  // button; this guards non-UI callers and future bugs). Permissive + eventually
  // consistent by design; absent binding (dev) → no limit.
  if (env.CREATE_LIMITER !== undefined) {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const { success } = await env.CREATE_LIMITER.limit({ key: ip });
    if (!success) return Response.json({ error: 'rate.limited' }, { status: 429 });
  }
  let body: { gameId?: unknown; config?: unknown; timing?: unknown };
  try {
    body = (await request.json()) as { gameId?: unknown; config?: unknown; timing?: unknown };
  } catch {
    return Response.json({ error: "request.invalidJson" }, { status: 400 });
  }
  const gameId = body.gameId;
  if (typeof gameId !== "string" || getGame(gameId) === null) {
    return Response.json({ error: "game.unknown" }, { status: 400 });
  }

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
    const res = await stub.fetch(
      new Request(`${origin}/api/rooms/${code}/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, config: body.config ?? null, timing: body.timing ?? null }),
      }),
    );
    if (res.status === 409) continue; // code collision — mint another
    if (!res.ok) return res;
    return Response.json({ code }, { status: 201 });
  }
  return Response.json({ error: "room.createRetriesExhausted" }, { status: 500 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const body: HealthResponse = { ok: true, build: env.BUILD_VERSION ?? "dev" };
      return Response.json(body);
    }

    if (url.pathname === "/api/rooms") {
      if (request.method !== "POST") {
        return Response.json({ error: "methodNotAllowed" }, { status: 405 });
      }
      return handleCreateRoom(request, env, url.origin);
    }

    // GET /api/rooms/:code → RoomInfo (DO /info), and the pass-through for
    // /ws, /hello, /status, /dump — the DO routes on the leaf segment.
    const roomMatch = ROOM_PATH.exec(url.pathname);
    if (roomMatch) {
      const roomCode = roomMatch[1];
      const id = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Unknown /api/* paths must 404 as JSON — never fall through to the
    // SPA asset fallback, which would answer an API call with index.html.
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "notFound" }, { status: 404 });
    }

    // Assets are normally matched before the Worker runs at all (see
    // wrangler.jsonc); this fallback only fires for requests that reach
    // `fetch` without matching a static file or an /api/* route above.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
