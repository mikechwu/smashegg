# smashegg

An online card-table platform. The first game is Guandan (掼蛋), a
four-player partnership climbing/shedding game with tribute rounds and
progressive team levels. Built as a single Cloudflare Worker: static
assets serve the frontend, and a `GameRoom` Durable Object (SQLite-backed,
WebSocket Hibernation) holds each room's authoritative game state. The UI
defaults to Traditional Chinese (zh-Hant), with a runtime language
switcher.

See [PLAN.md](PLAN.md) for the full architecture and design decisions,
[STATUS.md](STATUS.md) for current progress, and [SETUP.md](SETUP.md) for
the account/token setup steps required to deploy. The Guandan rules spec
lives at [docs/rules/guandan.md](docs/rules/guandan.md); the research
methodology behind this project's fact-checking is documented at
[docs/research/METHODOLOGY.md](docs/research/METHODOLOGY.md).

## Quickstart

```sh
npm install
npm run build       # builds the client into dist/client
npm run cf:dev       # runs the Worker + assets + Durable Object locally
```

Other scripts: `npm run dev:client` (Vite dev server, client-only),
`npm run typecheck`, `npm run test` (Vitest unit tests), `npm run deploy`
(`wrangler deploy`).

## Status: M0 (toolchain skeleton)

This is the M0 milestone: the TypeScript/Vite/React/Cloudflare-Workers
toolchain skeleton, not a playable game yet. There is no Guandan engine,
no lobby, and no table UI here — those land in M1–M3. M0's own scope is a
hello-world Worker that serves static assets and answers through the
`GameRoom` Durable Object in a single deploy, proving two empirical gate
checks named in PLAN.md §9:

- **G-COMPOSE** — one Worker can serve static assets *and* host a Durable
  Object together, in one `wrangler.jsonc` and one deploy.
- **G-ALARM** — a Durable Object alarm fires on the Cloudflare free tier.
