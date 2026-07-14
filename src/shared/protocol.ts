// Minimal M0 wire types (PLAN.md §1.2, §9 — G-COMPOSE / G-ALARM gate probes).
// These are NOT the real game protocol (PLAN.md §5) — that lands with the
// GameRoom transport work in later milestones. M0 only needs enough shape
// to prove the Worker+assets+DO composition and the alarm gate.

/** GET /api/health response. */
export interface HealthResponse {
  ok: true;
}

/** GET /api/rooms/:code/hello and /status response (G-ALARM probe state). */
export interface HelloStatus {
  roomCode: string;
  count: number;
  alarmSetAt: number | null;
  alarmFiredAt: number | null;
}
