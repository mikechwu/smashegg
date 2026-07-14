// Worker entry (PLAN.md §1.2, §4). Stateless: route, validate room-code
// shape, dispatch to the GameRoom Durable Object by name, forward its
// response. All game/room authority lives in the DO, never here.

import type { HealthResponse } from "../shared/protocol";

// The DO class must be exported from the Worker entrypoint so the runtime
// can bind the wrangler.jsonc migration ("new_sqlite_classes") to it.
export { GameRoom } from "./game-room";

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}

// 6-char unambiguous room-code alphabet (no 0/O/1/I) — PLAN.md §8.
const ROOM_PATH = /^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(\/.*)?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const body: HealthResponse = { ok: true };
      return Response.json(body);
    }

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
